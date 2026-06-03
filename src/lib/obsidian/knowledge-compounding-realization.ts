import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

import { ApprovalIdSchema } from "../approval-runtime/types";
import {
  KnowledgeDraftSchema,
  KnowledgeReindexPlanSchema,
  KnowledgeWritePlanSchema,
  buildBoundedKnowledgeReindexPlan,
  buildKnowledgeReindexPlan,
  type KnowledgeDraft,
  type KnowledgeWritePlan,
} from "./knowledge-compounding-workflow";
import { VAULT_FRONTMATTER_SCHEMA_VERSION } from "./frontmatter";
import {
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  planVaultWriteProposalDryRun,
  type VaultWriteProposal,
} from "./write-gateway";

export const KNOWLEDGE_COMPOUNDING_REALIZATION_VERSION =
  "phase21g-r.knowledge-compounding-realization.v1" as const;

export const KNOWLEDGE_WRITE_APPROVAL_STATUSES = [
  "approved",
  "rejected",
  "deferred",
  "pending",
] as const;

export const KNOWLEDGE_WRITE_EXECUTION_STATUSES = [
  "written",
  "rejected",
  "deferred",
  "approval_missing",
  "path_escape_rejected",
  "writer_unavailable",
  "writer_error",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(240);
const BoundedTextSchema = z.string().trim().min(1).max(1200);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const KnowledgeWriteApprovalStatusSchema = z.enum(
  KNOWLEDGE_WRITE_APPROVAL_STATUSES,
);

export const KnowledgeWriteExecutionStatusSchema = z.enum(
  KNOWLEDGE_WRITE_EXECUTION_STATUSES,
);

export const KnowledgeWriteApprovalDecisionSchema = z.strictObject({
  approval_id: BoundedIdSchema.nullable(),
  approval_status: KnowledgeWriteApprovalStatusSchema,
  approved_by: BoundedTextSchema.nullable().default(null),
  decided_at: IsoDateTimeSchema.nullable().default(null),
  raw_approval_token_included: z.literal(false),
});

export const KnowledgeVaultWriterInputSchema = z.strictObject({
  draft_id: BoundedIdSchema,
  write_plan_id: BoundedIdSchema,
  vault_root_path: BoundedTextSchema,
  relative_vault_path: BoundedTextSchema,
  absolute_target_path: BoundedTextSchema,
  markdown: z.string().min(1).max(20000),
  content_hash: HashReferenceSchema,
  metadata_only: z.literal(false),
});

export const KnowledgeVaultWriterResultSchema = z.strictObject({
  bytes_written: z.number().int().nonnegative(),
  completed_at: IsoDateTimeSchema,
  writer_ref_hash: HashReferenceSchema.nullable().default(null),
  raw_body_logged: z.literal(false),
});

export const KnowledgeReindexTriggerSchema = z.strictObject({
  trigger_id: BoundedIdSchema,
  reindex_plan_id: BoundedIdSchema,
  bounded_target_count: z.number().int().nonnegative(),
  skipped_target_count: z.number().int().nonnegative(),
  execution_required: z.literal(true),
  explicit_after_approved_write: z.literal(true),
  scheduler_triggered: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
  raw_vault_body_included: z.literal(false),
});

export const KnowledgeWriteTelemetrySchema = z.strictObject({
  realization_version: z.literal(KNOWLEDGE_COMPOUNDING_REALIZATION_VERSION),
  draft_id: BoundedIdSchema,
  write_plan_id: BoundedIdSchema,
  target_path_hash: HashReferenceSchema.nullable(),
  content_hash: HashReferenceSchema,
  write_status: KnowledgeWriteExecutionStatusSchema,
  timing_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_draft_body_included: z.literal(false),
  raw_vault_body_included: z.literal(false),
  scheduler_write_attempted: z.literal(false),
});

export const KnowledgeWriteExecutionResultSchema = z.strictObject({
  realization_version: z.literal(KNOWLEDGE_COMPOUNDING_REALIZATION_VERSION),
  execution_id: BoundedIdSchema,
  draft_id: BoundedIdSchema,
  write_plan_id: BoundedIdSchema,
  write_status: KnowledgeWriteExecutionStatusSchema,
  approval: KnowledgeWriteApprovalDecisionSchema,
  vault_mutated: z.boolean(),
  writer_invoked: z.boolean(),
  bytes_written: z.number().int().nonnegative(),
  content_hash: HashReferenceSchema,
  target_path_alias: BoundedTextSchema.nullable(),
  target_path_hash: HashReferenceSchema.nullable(),
  reindex_plan: KnowledgeReindexPlanSchema.nullable(),
  reindex_trigger: KnowledgeReindexTriggerSchema.nullable(),
  telemetry: KnowledgeWriteTelemetrySchema,
  governance: z.strictObject({
    approval_gated: z.literal(true),
    dry_run_planned_before_execution: z.literal(true),
    target_inside_vault_validated: z.boolean(),
    rejection_touched_vault: z.literal(false),
    defer_touched_vault: z.literal(false),
    no_scheduler_direct_write: z.literal(true),
    raw_body_telemetry_forbidden: z.literal(true),
    gateway_execution_attempted: z.literal(false),
  }),
});

export type KnowledgeWriteApprovalDecision = z.infer<
  typeof KnowledgeWriteApprovalDecisionSchema
>;
export type KnowledgeVaultWriterInput = z.infer<
  typeof KnowledgeVaultWriterInputSchema
>;
export type KnowledgeVaultWriterResult = z.infer<
  typeof KnowledgeVaultWriterResultSchema
>;
export type KnowledgeReindexTrigger = z.infer<
  typeof KnowledgeReindexTriggerSchema
>;
export type KnowledgeWriteTelemetry = z.infer<
  typeof KnowledgeWriteTelemetrySchema
>;
export type KnowledgeWriteExecutionResult = z.infer<
  typeof KnowledgeWriteExecutionResultSchema
>;

export interface KnowledgeVaultWriter {
  write(
    input: KnowledgeVaultWriterInput,
  ):
    | Promise<KnowledgeVaultWriterResult | unknown>
    | KnowledgeVaultWriterResult
    | unknown;
}

export async function executeApprovedKnowledgeWrite(input: {
  readonly draft: KnowledgeDraft;
  readonly write_plan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteApprovalDecision;
  readonly vault_root_path: string;
  readonly writer?: KnowledgeVaultWriter;
  readonly max_reindex_targets?: number;
  readonly now?: () => Date;
}): Promise<KnowledgeWriteExecutionResult> {
  const draft = KnowledgeDraftSchema.parse(input.draft);
  const writePlan = KnowledgeWritePlanSchema.parse(input.write_plan);
  const approval = KnowledgeWriteApprovalDecisionSchema.parse(input.approval);
  const started = input.now?.().getTime() ?? Date.now();
  const target = resolveKnowledgeVaultTarget({
    vault_root_path: input.vault_root_path,
    relative_vault_path: writePlan.target.vault_path,
  });
  const contentHash = hashReference(renderKnowledgeDraftMarkdown(draft));

  if (approval.approval_status === "rejected") {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "rejected",
      contentHash,
      target,
      started,
      now: input.now,
    });
  }

  if (approval.approval_status === "deferred") {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "deferred",
      contentHash,
      target,
      started,
      now: input.now,
    });
  }

  if (approval.approval_status !== "approved" || !approval.approval_id) {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "approval_missing",
      contentHash,
      target,
      started,
      now: input.now,
    });
  }

  if (!target.inside_vault) {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "path_escape_rejected",
      contentHash,
      target,
      started,
      now: input.now,
    });
  }

  if (!input.writer) {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "writer_unavailable",
      contentHash,
      target,
      started,
      now: input.now,
    });
  }

  try {
    const markdown = renderKnowledgeDraftMarkdown(draft);
    const gatewayProposal = buildKnowledgeGatewayProposal({
      draft,
      writePlan,
      approval,
      markdown,
      contentHash,
      createdAt: approval.decided_at ?? nowIso(input.now),
    });
    const gatewayDryRun = planVaultWriteProposalDryRun(gatewayProposal);
    if (
      !gatewayDryRun.accepted ||
      gatewayDryRun.state !== "ready_to_write" ||
      gatewayDryRun.target_path !== writePlan.target.vault_path
    ) {
      return knowledgeWriteResult({
        draft,
        writePlan,
        approval,
        status: "rejected",
        contentHash,
        target,
        started,
        now: input.now,
      });
    }
    const writerResult = KnowledgeVaultWriterResultSchema.parse(
      await input.writer.write(
        KnowledgeVaultWriterInputSchema.parse({
          draft_id: draft.draft_id,
          write_plan_id: writePlan.write_plan_id,
          vault_root_path: input.vault_root_path,
          relative_vault_path: writePlan.target.vault_path,
          absolute_target_path: target.absolute_target_path,
          markdown,
          content_hash: contentHash,
          metadata_only: false,
        }),
      ),
    );
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "written",
      contentHash,
      target,
      started,
      now: input.now,
      maxReindexTargets: input.max_reindex_targets,
      bytesWritten: writerResult.bytes_written,
      writerInvoked: true,
    });
  } catch {
    return knowledgeWriteResult({
      draft,
      writePlan,
      approval,
      status: "writer_error",
      contentHash,
      target,
      started,
      now: input.now,
      writerInvoked: true,
    });
  }
}

export function renderKnowledgeDraftMarkdown(draft: KnowledgeDraft): string {
  const parsed = KnowledgeDraftSchema.parse(draft);
  const sections = parsed.sections
    .map((section) => `## ${section.heading}\n\n${section.body}`)
    .join("\n\n");
  const sources = parsed.sources
    .map(
      (source) => `- ${source.title} (${source.path}) [${source.source_hash}]`,
    )
    .join("\n");
  return `# ${parsed.title}\n\n${sections}\n\n## Sources\n\n${sources}\n`;
}

export function resolveKnowledgeVaultTarget(input: {
  readonly vault_root_path: string;
  readonly relative_vault_path: string;
}): {
  readonly inside_vault: boolean;
  readonly absolute_target_path: string;
  readonly target_path_alias: string | null;
  readonly target_path_hash: string | null;
} {
  const vaultRoot = resolve(input.vault_root_path);
  const requested = input.relative_vault_path.trim();
  if (
    !requested ||
    isAbsolute(requested) ||
    requested.includes("\\") ||
    requested.split("/").includes("..")
  ) {
    return {
      inside_vault: false,
      absolute_target_path: resolve(vaultRoot, requested),
      target_path_alias: null,
      target_path_hash: null,
    };
  }
  const target = resolve(vaultRoot, requested);
  const rel = relative(vaultRoot, target);
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  return {
    inside_vault: inside,
    absolute_target_path: target,
    target_path_alias: inside ? requested : null,
    target_path_hash: inside ? hashReference(requested) : null,
  };
}

function knowledgeWriteResult(input: {
  readonly draft: KnowledgeDraft;
  readonly writePlan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteApprovalDecision;
  readonly status: z.infer<typeof KnowledgeWriteExecutionStatusSchema>;
  readonly contentHash: string;
  readonly target: ReturnType<typeof resolveKnowledgeVaultTarget>;
  readonly started: number;
  readonly now?: () => Date;
  readonly bytesWritten?: number;
  readonly writerInvoked?: boolean;
  readonly maxReindexTargets?: number;
}): KnowledgeWriteExecutionResult {
  const reindexPlan =
    input.status === "written"
      ? buildBoundedKnowledgeReindexPlan(
          input.writePlan,
          input.maxReindexTargets ?? 8,
        )
      : null;
  const unboundedReindexPlan =
    input.status === "written"
      ? buildKnowledgeReindexPlan(input.writePlan)
      : null;
  const timing = (input.now?.().getTime() ?? Date.now()) - input.started;

  return KnowledgeWriteExecutionResultSchema.parse({
    realization_version: KNOWLEDGE_COMPOUNDING_REALIZATION_VERSION,
    execution_id: `knowledge-write-execution:${input.writePlan.write_plan_id}`,
    draft_id: input.draft.draft_id,
    write_plan_id: input.writePlan.write_plan_id,
    write_status: input.status,
    approval: input.approval,
    vault_mutated: input.status === "written",
    writer_invoked: input.writerInvoked === true,
    bytes_written: input.bytesWritten ?? 0,
    content_hash: input.contentHash,
    target_path_alias: input.target.target_path_alias,
    target_path_hash: input.target.target_path_hash,
    reindex_plan: reindexPlan,
    reindex_trigger: reindexPlan
      ? {
          trigger_id: `knowledge-reindex-trigger:${reindexPlan.reindex_plan_id}`,
          reindex_plan_id: reindexPlan.reindex_plan_id,
          bounded_target_count: reindexPlan.summary.target_count,
          skipped_target_count: Math.max(
            0,
            (unboundedReindexPlan?.summary.target_count ?? 0) -
              reindexPlan.summary.target_count,
          ),
          execution_required: true,
          explicit_after_approved_write: true,
          scheduler_triggered: false,
          filesystem_write_attempted: false,
          database_write_attempted: false,
          raw_vault_body_included: false,
        }
      : null,
    telemetry: {
      realization_version: KNOWLEDGE_COMPOUNDING_REALIZATION_VERSION,
      draft_id: input.draft.draft_id,
      write_plan_id: input.writePlan.write_plan_id,
      target_path_hash: input.target.target_path_hash,
      content_hash: input.contentHash,
      write_status: input.status,
      timing_ms: Math.max(0, timing),
      metadata_only: true,
      raw_draft_body_included: false,
      raw_vault_body_included: false,
      scheduler_write_attempted: false,
    },
    governance: {
      approval_gated: true,
      dry_run_planned_before_execution: true,
      target_inside_vault_validated: input.target.inside_vault,
      rejection_touched_vault: false,
      defer_touched_vault: false,
      no_scheduler_direct_write: true,
      raw_body_telemetry_forbidden: true,
      gateway_execution_attempted: false,
    },
  });
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function buildKnowledgeGatewayProposal(input: {
  readonly draft: KnowledgeDraft;
  readonly writePlan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteApprovalDecision;
  readonly markdown: string;
  readonly contentHash: string;
  readonly createdAt: string;
}): VaultWriteProposal {
  const approvalId = ApprovalIdSchema.parse(input.approval.approval_id);
  const frontmatter = {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slug(input.draft.draft_id)}`,
    title: input.draft.title,
    note_type: "hub" as const,
    domain: "wiki" as const,
    status: "active" as const,
    created_at: input.createdAt,
    updated_at: input.createdAt,
    tags: ["knowledge-compounding", "hub"],
    sensitivity: "private" as const,
    project: null,
    provenance: {
      source_type: "agent" as const,
      source_id: input.draft.draft_id,
      source_url: null,
      content_hash: input.contentHash,
    },
    agent: {
      created_by: "knowledge-compounding",
      run_id: input.writePlan.write_plan_id,
      model_id: null,
      promotion_status: "human_approved" as const,
    },
    links: {
      related: input.draft.candidate.source_page_ids,
      sources: input.draft.sources.map((source) => source.source_id),
      decisions: [approvalId],
    },
    lifecycle: {
      durable: true,
      canonical: false,
      approval_status: "approved" as const,
      approval_id: approvalId,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };

  return {
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: `proposal:${slug(input.writePlan.write_plan_id)}`,
    note_type: "hub",
    target_path: input.writePlan.target.vault_path,
    frontmatter,
    markdown_body: input.markdown,
    provenance: frontmatter.provenance,
    proposing_agent: {
      agent_id: "knowledge-compounding",
      agent_kind: "knowledge-compounding",
      run_id: input.writePlan.write_plan_id,
    },
    approval_required: true,
    approval_status: "approved",
    approval_id: approvalId,
    sensitivity: "private",
    content_hash: input.contentHash,
    created_at: input.createdAt,
  };
}

function nowIso(now?: () => Date): string {
  return (now?.() ?? new Date(0)).toISOString();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
