import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  OBSIDIAN_VAULT_PATH_ENV,
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  VaultFrontmatterSchema,
  executeApprovedVaultWriteProposal,
} from "./index";
import type { VaultFrontmatter } from "./frontmatter";
import type { VaultWriteProposal } from "./write-gateway";

const NOW = "2026-06-01T12:00:00.000Z";
const HASH = `sha256:${"c".repeat(64)}`;
const RAW_BODY = "Approved vault execution body.";

function frontmatter(
  overrides: Partial<VaultFrontmatter> = {},
): VaultFrontmatter {
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: "note:execution.example",
    title: "Execution Example",
    note_type: "concept",
    domain: "wiki",
    status: "active",
    created_at: NOW,
    updated_at: NOW,
    tags: ["phase21"],
    sensitivity: "private",
    project: null,
    provenance: {
      source_type: "human",
      source_id: "source:execution",
      source_url: null,
      content_hash: HASH,
    },
    agent: {
      created_by: null,
      run_id: null,
      model_id: null,
      promotion_status: "human_approved",
    },
    links: {
      related: [],
      sources: [],
      decisions: [],
    },
    lifecycle: {
      durable: true,
      canonical: true,
      approval_status: "approved",
      approval_id: "approval:execution.ready",
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
    ...overrides,
  };
}

function proposal(
  overrides: Partial<VaultWriteProposal> = {},
): VaultWriteProposal {
  const fm = overrides.frontmatter ?? frontmatter();
  return {
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: "proposal:execution.ready",
    note_type: fm.note_type,
    target_path: "10-wiki/concepts/execution-example.md",
    frontmatter: fm,
    markdown_body: RAW_BODY,
    provenance: fm.provenance,
    proposing_agent: {
      agent_id: "librarian",
      agent_kind: "librarian",
      run_id: "run:librarian.execution",
    },
    approval_required: true,
    approval_status: fm.lifecycle.approval_status,
    approval_id: fm.lifecycle.approval_id,
    sensitivity: fm.sensitivity,
    content_hash: fm.provenance.content_hash ?? HASH,
    created_at: NOW,
    ...overrides,
  };
}

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "jarvis-vault-exec-"));
}

function env(vaultPath?: string): Record<string, string | undefined> {
  return vaultPath ? { [OBSIDIAN_VAULT_PATH_ENV]: vaultPath } : {};
}

function frontmatterBlock(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  expect(normalized.startsWith("---\n")).toBe(true);
  const end = normalized.indexOf("\n---\n", 4);
  expect(end).toBeGreaterThan(0);
  return normalized.slice(4, end);
}

describe("Phase 21 approved vault write execution", () => {
  it("writes an approved ready proposal as markdown with valid frontmatter", async () => {
    const vault = await tempVault();
    const result = await executeApprovedVaultWriteProposal(proposal(), {
      env: env(vault),
    });

    expect(result).toMatchObject({
      proposal_id: "proposal:execution.ready",
      note_id: "note:execution.example",
      target_path: "10-wiki/concepts/execution-example.md",
      content_hash: HASH,
      approval_id: "approval:execution.ready",
      write_status: "written",
      raw_body_included: false,
      vault_mutated: true,
    });
    expect(result.bytes_written).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(RAW_BODY);

    const markdown = await readFile(
      join(vault, "10-wiki/concepts/execution-example.md"),
      "utf8",
    );
    expect(markdown).toContain(RAW_BODY);
    const parsedFrontmatter = parseYaml(frontmatterBlock(markdown));
    expect(VaultFrontmatterSchema.parse(parsedFrontmatter)).toMatchObject({
      id: "note:execution.example",
      note_type: "concept",
      lifecycle: {
        approval_status: "approved",
        approval_id: "approval:execution.ready",
      },
    });
  });

  it("fails closed when OBSIDIAN_VAULT_PATH is missing", async () => {
    const result = await executeApprovedVaultWriteProposal(proposal(), {
      env: env(),
    });

    expect(result).toMatchObject({
      write_status: "missing_vault_path",
      bytes_written: 0,
      vault_mutated: false,
      raw_body_included: false,
    });
  });

  it("does not write unapproved or rejected proposals", async () => {
    const vault = await tempVault();
    const blocked = [
      proposal({
        proposal_id: "proposal:execution.pending",
        approval_status: "pending",
      }),
      proposal({
        proposal_id: "proposal:execution.denied",
        approval_status: "denied",
      }),
      proposal({
        proposal_id: "proposal:execution.expired",
        approval_status: "expired",
      }),
      proposal({
        proposal_id: "proposal:execution.route-mismatch",
        target_path: "80-reviews/execution-example.md",
      }),
      proposal({
        proposal_id: "proposal:execution.hash-mismatch",
        content_hash: `sha256:${"d".repeat(64)}`,
      }),
      proposal({
        proposal_id: "proposal:execution.approval-mismatch",
        approval_id: "approval:execution.other",
      }),
      proposal({
        proposal_id: "proposal:execution.empty-body",
        markdown_body: "   ",
      }),
    ];

    await expect(
      stat(join(vault, "10-wiki/concepts/execution-example.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    for (const input of blocked) {
      expect(
        await executeApprovedVaultWriteProposal(input, { env: env(vault) }),
      ).toMatchObject({
        write_status: "rejected_by_policy",
        bytes_written: 0,
        vault_mutated: false,
      });
    }

    await expect(
      stat(join(vault, "10-wiki/concepts/execution-example.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects overwrites by default", async () => {
    const vault = await tempVault();
    const path = join(vault, "10-wiki/concepts/execution-example.md");
    await mkdir(join(vault, "10-wiki/concepts"), { recursive: true });
    await writeFile(path, "existing", { encoding: "utf8" });

    const result = await executeApprovedVaultWriteProposal(proposal(), {
      env: env(vault),
    });

    expect(result).toMatchObject({
      write_status: "overwrite_rejected",
      bytes_written: 0,
      vault_mutated: false,
    });
    expect(await readFile(path, "utf8")).toBe("existing");
  });

  it("allows explicit overwrite only for an existing regular vault file", async () => {
    const vault = await tempVault();
    const path = join(vault, "10-wiki/concepts/execution-example.md");
    await mkdir(join(vault, "10-wiki/concepts"), { recursive: true });
    await writeFile(path, "existing", { encoding: "utf8" });

    const result = await executeApprovedVaultWriteProposal(proposal(), {
      env: env(vault),
      allowOverwrite: true,
    });

    expect(result).toMatchObject({
      write_status: "written",
      vault_mutated: true,
    });
    expect(await readFile(path, "utf8")).toContain(RAW_BODY);
  });

  it("rejects traversal and absolute target paths before writing", async () => {
    const vault = await tempVault();
    const unsafeTargets = [
      "../outside.md",
      "10-wiki/../outside.md",
      "/tmp/outside.md",
      "C:/outside.md",
      "10-wiki/concepts\\escape.md",
    ];

    for (const target_path of unsafeTargets) {
      expect(
        await executeApprovedVaultWriteProposal(
          {
            ...proposal(),
            target_path,
          },
          { env: env(vault) },
        ),
      ).toMatchObject({
        write_status: "rejected_by_policy",
        bytes_written: 0,
        vault_mutated: false,
      });
    }
    await expect(stat(join(vault, "outside.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects pre-existing parent symlink escapes before creating subdirectories", async () => {
    const vault = await tempVault();
    const outside = await tempVault();
    try {
      await symlink(
        outside,
        join(vault, "10-wiki"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    const result = await executeApprovedVaultWriteProposal(proposal(), {
      env: env(vault),
    });

    expect(result).toMatchObject({
      write_status: "path_escape_rejected",
      bytes_written: 0,
      vault_mutated: false,
    });
    await expect(
      stat(join(outside, "concepts/execution-example.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps execution metadata body-free while the written file keeps content", async () => {
    const vault = await tempVault();
    const sentinel = "RAW-BODY-SHOULD-NOT-LEAK-123";
    const result = await executeApprovedVaultWriteProposal(
      proposal({
        markdown_body: sentinel,
      }),
      { env: env(vault) },
    );

    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining(["markdown_body", "body", "raw_body", "content"]),
    );
    expect(result.raw_body_included).toBe(false);
    expect(
      await readFile(join(vault, "10-wiki/concepts/execution-example.md"), "utf8"),
    ).toContain(sentinel);
  });

  it("keeps execution source scoped to approved writes only", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/write-execution.ts"),
      "utf8",
    );
    const plannerIndex = source.indexOf("planVaultWriteProposalDryRun(input)");
    const writeIndex = source.indexOf("writeFile(");

    expect(source).not.toMatch(
      /\b(watch|watchFile|fs\.watch|chokidar|setInterval|setTimeout|fetch|WebSocket|Worker|child_process|node:http|node:https|scheduler|cron)\b/i,
    );
    expect(source).not.toMatch(
      /Librarian|KnowledgeCompounding|Knowledge Compounding|GitNexus|obsidian:\/\/|app\.vault|metadataCache|vault\.modify|\.obsidian\/plugins|runTool|ToolRegistry|ensureVaultScaffold|writeVaultFileAtomically|JARVIS_OBSIDIAN_VAULT_ROOT|\.\.\/memory\/vault/,
    );
    expect(source).toContain("planVaultWriteProposalDryRun");
    expect(source).toContain('dryRun.state !== "ready_to_write"');
    expect(plannerIndex).toBeGreaterThanOrEqual(0);
    expect(writeIndex).toBeGreaterThan(plannerIndex);
    expect(source).toMatch(/writeFile\(target, markdown,[\s\S]*flag: options\.allowOverwrite \? "w" : "wx"/);
  });
});
