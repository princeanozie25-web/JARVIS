import { describe, expect, it } from "vitest";

import {
  buildKnowledgeDraft,
  buildKnowledgeWritePlan,
  identifyKnowledgeHubCandidates,
  type KnowledgeDraftSource,
  type KnowledgeVaultPageMetadata,
} from "./knowledge-compounding-workflow";
import {
  executeApprovedKnowledgeWrite,
  renderKnowledgeDraftMarkdown,
  resolveKnowledgeVaultTarget,
  type KnowledgeVaultWriter,
  type KnowledgeVaultWriterInput,
} from "./knowledge-compounding-realization";

const pages: KnowledgeVaultPageMetadata[] = [
  {
    page_id: "page:langgraph",
    title: "LangGraph",
    path: "10-wiki/concepts/langgraph.md",
    note_type: "concept",
    word_count: 180,
    cross_references: ["page:agent-runtime", "page:state-machines"],
    backlinks: ["page:agent-runtime"],
    concept_tags: ["agent-orchestration"],
    source_ids: ["source:langgraph"],
    existing_hub_path: null,
    metadata_only: true,
  },
  {
    page_id: "page:agent-runtime",
    title: "Agent Runtime",
    path: "10-wiki/systems/agent-runtime.md",
    note_type: "system",
    word_count: 320,
    cross_references: ["page:langgraph"],
    backlinks: ["page:langgraph"],
    concept_tags: ["agent-orchestration"],
    source_ids: ["source:runtime"],
    existing_hub_path: null,
    metadata_only: true,
  },
];

const sources: KnowledgeDraftSource[] = [
  {
    source_id: "source:langgraph",
    page_id: "page:langgraph",
    title: "LangGraph",
    path: "10-wiki/concepts/langgraph.md",
    snippet: "LangGraph is referenced in supplied vault notes.",
    source_hash: "hash-langgraph",
    metadata_only: true,
  },
  {
    source_id: "source:runtime",
    page_id: "page:agent-runtime",
    title: "Agent Runtime",
    path: "10-wiki/systems/agent-runtime.md",
    snippet: "Agent Runtime is linked to orchestration notes.",
    source_hash: "hash-runtime",
    metadata_only: true,
  },
];

describe("Knowledge Compounding realization", () => {
  it("writes an approved hub draft through an injected writer and emits bounded reindex metadata", async () => {
    const calls: KnowledgeVaultWriterInput[] = [];
    const writer: KnowledgeVaultWriter = {
      write(input) {
        calls.push(input);
        return {
          bytes_written: input.markdown.length,
          completed_at: "2026-06-03T09:00:00.000Z",
          writer_ref_hash:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          raw_body_logged: false,
        };
      },
    };
    const draft = fixtureDraft();
    const plan = buildKnowledgeWritePlan(draft);
    const result = await executeApprovedKnowledgeWrite({
      draft,
      write_plan: plan,
      approval: approved(),
      vault_root_path: "C:/vault",
      writer,
      now: () => new Date("2026-06-03T09:00:00.000Z"),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      draft_id: draft.draft_id,
      write_plan_id: plan.write_plan_id,
      relative_vault_path: "10-wiki/hubs/agent-orchestration.md",
      metadata_only: false,
    });
    expect(calls[0]?.markdown).toBe(renderKnowledgeDraftMarkdown(draft));
    expect(result).toMatchObject({
      write_status: "written",
      vault_mutated: true,
      writer_invoked: true,
      target_path_alias: "10-wiki/hubs/agent-orchestration.md",
    });
    expect(result.reindex_plan?.summary).toMatchObject({
      semantic_reindex_required: true,
      wiki_index_update_required: true,
      execution_attempted: false,
      metadata_only: true,
    });
    expect(result.reindex_trigger).toMatchObject({
      explicit_after_approved_write: true,
      scheduler_triggered: false,
      raw_vault_body_included: false,
    });
    expect(result.telemetry).toMatchObject({
      metadata_only: true,
      raw_draft_body_included: false,
      raw_vault_body_included: false,
      scheduler_write_attempted: false,
    });
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "LangGraph is referenced",
    );
  });

  it("rejects path traversal outside the vault before invoking the writer", async () => {
    let invoked = false;
    const draft = fixtureDraft();
    const plan = {
      ...buildKnowledgeWritePlan(draft),
      target: {
        vault_path: "../escape.md",
        filename: "escape.md",
        note_type: "hub" as const,
        overwrite_allowed: false as const,
      },
    };
    const result = await executeApprovedKnowledgeWrite({
      draft,
      write_plan: plan,
      approval: approved(),
      vault_root_path: "C:/vault",
      writer: {
        write() {
          invoked = true;
          throw new Error("must not be called");
        },
      },
    });

    expect(result.write_status).toBe("path_escape_rejected");
    expect(result.vault_mutated).toBe(false);
    expect(result.writer_invoked).toBe(false);
    expect(invoked).toBe(false);
    expect(result.governance.target_inside_vault_validated).toBe(false);
  });

  it("does not write rejected, deferred, or pending approvals", async () => {
    const draft = fixtureDraft();
    const plan = buildKnowledgeWritePlan(draft);
    let calls = 0;
    const writer: KnowledgeVaultWriter = {
      write() {
        calls += 1;
        throw new Error("must not write");
      },
    };

    for (const approval_status of [
      "rejected",
      "deferred",
      "pending",
    ] as const) {
      const result = await executeApprovedKnowledgeWrite({
        draft,
        write_plan: plan,
        approval: {
          ...approved(),
          approval_status,
          approval_id: approval_status === "pending" ? null : "approval:1",
        },
        vault_root_path: "C:/vault",
        writer,
      });
      expect(result.vault_mutated).toBe(false);
      expect(result.writer_invoked).toBe(false);
      expect(result.reindex_plan).toBeNull();
      expect(result.reindex_trigger).toBeNull();
    }

    expect(calls).toBe(0);
  });

  it("keeps scheduler and raw-body telemetry out of the approved write path", async () => {
    const draft = fixtureDraft();
    const plan = buildKnowledgeWritePlan(draft);
    const result = await executeApprovedKnowledgeWrite({
      draft,
      write_plan: plan,
      approval: approved(),
      vault_root_path: "C:/vault",
      writer: {
        write(input) {
          return {
            bytes_written: input.markdown.length,
            completed_at: "2026-06-03T09:00:00.000Z",
            writer_ref_hash: null,
            raw_body_logged: false,
          };
        },
      },
    });

    expect(result.governance).toMatchObject({
      approval_gated: true,
      dry_run_planned_before_execution: true,
      no_scheduler_direct_write: true,
      raw_body_telemetry_forbidden: true,
      gateway_execution_attempted: false,
    });
    expect(JSON.stringify(result.telemetry)).not.toContain(
      renderKnowledgeDraftMarkdown(draft),
    );
  });

  it("resolves vault targets deterministically and rejects absolute paths", () => {
    // E-025: an ABSOLUTE outside path for the running platform — "C:/..." is
    // relative on POSIX, so the Windows literal alone would not exercise the
    // absolute-path rejection there.
    const outsideAbsolute =
      process.platform === "win32" ? "C:/outside/test.md" : "/outside/test.md";
    expect(
      resolveKnowledgeVaultTarget({
        vault_root_path: "C:/vault",
        relative_vault_path: "10-wiki/hubs/test.md",
      }),
    ).toMatchObject({
      inside_vault: true,
      target_path_alias: "10-wiki/hubs/test.md",
    });

    expect(
      resolveKnowledgeVaultTarget({
        vault_root_path: "C:/vault",
        relative_vault_path: outsideAbsolute,
      }).inside_vault,
    ).toBe(false);
  });
});

function fixtureDraft() {
  const candidate = identifyKnowledgeHubCandidates(pages)[0];
  if (!candidate) throw new Error("expected candidate");
  return buildKnowledgeDraft({ candidate, sources });
}

function approved() {
  return {
    approval_id: "approval:knowledge-write:1",
    approval_status: "approved" as const,
    approved_by: "human",
    decided_at: "2026-06-03T09:00:00.000Z",
    raw_approval_token_included: false as const,
  };
}
