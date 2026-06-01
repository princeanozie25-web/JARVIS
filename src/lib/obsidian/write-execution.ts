import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import { ApprovalIdSchema, ProposalIdSchema } from "../approval-runtime/types";
import {
  OBSIDIAN_VAULT_PATH_ENV,
  ObsidianVaultPathError,
  validateObsidianVaultPath,
} from "./pull-indexer";
import {
  VaultWriteProposalSchema,
  planVaultWriteProposalDryRun,
  type VaultWriteProposal,
} from "./write-gateway";

export const VAULT_WRITE_EXECUTION_CONTRACT_VERSION =
  "phase21.vault-write-execution.v1" as const;

export const VAULT_WRITE_EXECUTION_STATUSES = [
  "written",
  "rejected_by_policy",
  "missing_vault_path",
  "path_escape_rejected",
  "overwrite_rejected",
  "filesystem_error",
] as const;

export const VaultWriteExecutionStatusSchema = z.enum(
  VAULT_WRITE_EXECUTION_STATUSES,
);

export const VaultWriteExecutionMetadataSchema = z.strictObject({
  contract_version: z.literal(VAULT_WRITE_EXECUTION_CONTRACT_VERSION),
  proposal_id: ProposalIdSchema,
  note_id: z.string().trim().min(1),
  target_path: z.string().trim().min(1).nullable(),
  bytes_written: z.number().int().nonnegative(),
  content_hash: z.string().trim().regex(/^sha256:[a-f0-9]{64}$/),
  created_at: z.string().trim().min(1),
  approval_id: ApprovalIdSchema.nullable(),
  write_status: VaultWriteExecutionStatusSchema,
  raw_body_included: z.literal(false),
  vault_mutated: z.boolean(),
});

export interface ExecuteApprovedVaultWriteProposalOptions {
  readonly env?: Record<string, string | undefined>;
  readonly allowOverwrite?: boolean;
}

export type VaultWriteExecutionStatus = z.infer<
  typeof VaultWriteExecutionStatusSchema
>;
export type VaultWriteExecutionMetadata = z.infer<
  typeof VaultWriteExecutionMetadataSchema
>;

export async function executeApprovedVaultWriteProposal(
  input: unknown,
  options: ExecuteApprovedVaultWriteProposalOptions = {},
): Promise<VaultWriteExecutionMetadata> {
  const dryRun = planVaultWriteProposalDryRun(input);
  const parsed = VaultWriteProposalSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedExecution("rejected_by_policy");
  }

  const proposal = parsed.data;
  if (
    !dryRun.accepted ||
    dryRun.state !== "ready_to_write" ||
    dryRun.required_approval_gate.proposal_kind !== "obsidian_write" ||
    dryRun.required_approval_gate.lifecycle_stage !== "APPROVED" ||
    dryRun.required_approval_gate.approval_id !== proposal.approval_id ||
    proposal.approval_status !== "approved" ||
    proposal.frontmatter.lifecycle.approval_status !== "approved" ||
    !proposal.approval_id ||
    proposal.approval_id !== proposal.frontmatter.lifecycle.approval_id
  ) {
    return executionMetadata(proposal, {
      status: "rejected_by_policy",
      targetPath: dryRun.target_path,
      bytesWritten: 0,
      vaultMutated: false,
    });
  }

  const vaultPath = await resolveExecutionVaultPath(options.env);
  if (!vaultPath) {
    return executionMetadata(proposal, {
      status: "missing_vault_path",
      targetPath: proposal.target_path,
      bytesWritten: 0,
      vaultMutated: false,
    });
  }

  const target = resolveVaultTarget(vaultPath, proposal.target_path);
  if (!target) {
    return executionMetadata(proposal, {
      status: "path_escape_rejected",
      targetPath: proposal.target_path,
      bytesWritten: 0,
      vaultMutated: false,
    });
  }

  const markdown = renderVaultMarkdown(proposal);
  const bytes = Buffer.byteLength(markdown, "utf8");

  try {
    if (!(await deepestExistingAncestorInsideVault(vaultPath, dirname(target)))) {
      return executionMetadata(proposal, {
        status: "path_escape_rejected",
        targetPath: proposal.target_path,
        bytesWritten: 0,
        vaultMutated: false,
      });
    }
    await mkdir(dirname(target), { recursive: true });
    if (!(await isResolvedInsideVault(vaultPath, dirname(target)))) {
      return executionMetadata(proposal, {
        status: "path_escape_rejected",
        targetPath: proposal.target_path,
        bytesWritten: 0,
        vaultMutated: false,
      });
    }
    const overwriteCheck = await validateOverwriteTarget(
      vaultPath,
      target,
      options.allowOverwrite === true,
    );
    if (overwriteCheck === "path_escape") {
      return executionMetadata(proposal, {
        status: "path_escape_rejected",
        targetPath: proposal.target_path,
        bytesWritten: 0,
        vaultMutated: false,
      });
    }
    if (overwriteCheck === "blocked") {
      return executionMetadata(proposal, {
        status: "overwrite_rejected",
        targetPath: proposal.target_path,
        bytesWritten: 0,
        vaultMutated: false,
      });
    }
    await writeFile(target, markdown, {
      encoding: "utf8",
      flag: options.allowOverwrite ? "w" : "wx",
    });
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      return executionMetadata(proposal, {
        status: "overwrite_rejected",
        targetPath: proposal.target_path,
        bytesWritten: 0,
        vaultMutated: false,
      });
    }
    return executionMetadata(proposal, {
      status: "filesystem_error",
      targetPath: proposal.target_path,
      bytesWritten: 0,
      vaultMutated: false,
    });
  }

  return executionMetadata(proposal, {
    status: "written",
    targetPath: proposal.target_path,
    bytesWritten: bytes,
    vaultMutated: true,
  });
}

export function renderVaultMarkdown(proposal: VaultWriteProposal): string {
  const yaml = stringifyYaml(proposal.frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n${proposal.markdown_body.trim()}\n`;
}

async function resolveExecutionVaultPath(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const raw = env[OBSIDIAN_VAULT_PATH_ENV]?.trim();
  if (!raw) return null;
  try {
    return await validateObsidianVaultPath(raw);
  } catch (error) {
    if (error instanceof ObsidianVaultPathError) return null;
    return null;
  }
}

function resolveVaultTarget(vaultPath: string, targetPath: string): string | null {
  if (isAbsolute(targetPath) || targetPath.includes("\\")) return null;
  const resolved = resolve(vaultPath, targetPath);
  const rel = relative(vaultPath, resolved);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  return resolved;
}

async function deepestExistingAncestorInsideVault(
  vaultPath: string,
  targetParent: string,
): Promise<boolean> {
  let current = targetParent;
  while (true) {
    const lexicalRel = relative(vaultPath, current);
    if (
      lexicalRel !== "" &&
      (lexicalRel.startsWith("..") || isAbsolute(lexicalRel))
    ) {
      return false;
    }

    try {
      await lstat(current);
      return isResolvedInsideVault(vaultPath, current);
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) return false;
      const parent = dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }
}

async function validateOverwriteTarget(
  vaultPath: string,
  targetPath: string,
  allowOverwrite: boolean,
): Promise<"ok" | "blocked" | "path_escape"> {
  try {
    const info = await lstat(targetPath);
    if (!allowOverwrite) return "blocked";
    if (info.isSymbolicLink()) return "path_escape";
    if (!info.isFile()) return "blocked";
    return (await isResolvedInsideVault(vaultPath, targetPath))
      ? "ok"
      : "path_escape";
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return "ok";
    return "blocked";
  }
}

async function isResolvedInsideVault(
  vaultPath: string,
  parentPath: string,
): Promise<boolean> {
  const realParent = await realpath(parentPath);
  const rel = relative(vaultPath, realParent);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function executionMetadata(
  proposal: VaultWriteProposal,
  input: {
    readonly status: VaultWriteExecutionStatus;
    readonly targetPath: string | null;
    readonly bytesWritten: number;
    readonly vaultMutated: boolean;
  },
): VaultWriteExecutionMetadata {
  return VaultWriteExecutionMetadataSchema.parse({
    contract_version: VAULT_WRITE_EXECUTION_CONTRACT_VERSION,
    proposal_id: proposal.proposal_id,
    note_id: proposal.frontmatter.id,
    target_path: input.targetPath,
    bytes_written: input.bytesWritten,
    content_hash: proposal.content_hash,
    created_at: proposal.created_at,
    approval_id: proposal.approval_id,
    write_status: input.status,
    raw_body_included: false,
    vault_mutated: input.vaultMutated,
  });
}

function rejectedExecution(
  status: VaultWriteExecutionStatus,
): VaultWriteExecutionMetadata {
  return VaultWriteExecutionMetadataSchema.parse({
    contract_version: VAULT_WRITE_EXECUTION_CONTRACT_VERSION,
    proposal_id: "proposal:invalid.execution",
    note_id: "invalid",
    target_path: null,
    bytes_written: 0,
    content_hash: `sha256:${"0".repeat(64)}`,
    created_at: new Date(0).toISOString(),
    approval_id: null,
    write_status: status,
    raw_body_included: false,
    vault_mutated: false,
  });
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code: unknown }).code) === code
  );
}
