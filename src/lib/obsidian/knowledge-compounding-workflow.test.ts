import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildBoundedKnowledgeReindexPlan,
  buildKnowledgeCompoundingCloseoutReport,
  buildKnowledgeDraft,
  buildKnowledgeReindexPlan,
  buildKnowledgeWritePlan,
  executeApprovedKnowledgeCompoundingWrite,
  identifyKnowledgeHubCandidates,
  rankKnowledgeHubCandidates,
  summarizeKnowledgeDraft,
  summarizeKnowledgeHubCandidates,
  summarizeKnowledgeWritePlan,
  validateKnowledgeDraftSources,
  type KnowledgeApprovedVaultWriter,
  type KnowledgeApprovedVaultWriterInput,
  type KnowledgeDraftSource,
  type KnowledgeHubCandidate,
  type KnowledgeVaultPageMetadata,
  type KnowledgeWriteExecutionApproval,
} from "./knowledge-compounding-workflow";

const fixturePages: KnowledgeVaultPageMetadata[] = [
  {
    page_id: "page:langgraph-overview",
    title: "LangGraph Overview",
    path: "10-wiki/concepts/langgraph-overview.md",
    note_type: "concept",
    word_count: 180,
    cross_references: ["page:agent-runtime", "page:state-machines"],
    backlinks: ["page:llm-agents"],
    concept_tags: ["agent-orchestration", "langgraph"],
    source_ids: ["source:langgraph-docs"],
    existing_hub_path: null,
    metadata_only: true,
  },
  {
    page_id: "page:agent-runtime",
    title: "Agent Runtime",
    path: "10-wiki/systems/agent-runtime.md",
    note_type: "system",
    word_count: 620,
    cross_references: ["page:langgraph-overview", "page:state-machines"],
    backlinks: ["page:langgraph-overview", "page:llm-agents"],
    concept_tags: ["agent-orchestration"],
    source_ids: ["source:jarvis-agent-runtime"],
    existing_hub_path: null,
    metadata_only: true,
  },
  {
    page_id: "page:state-machines",
    title: "State Machines",
    path: "10-wiki/concepts/state-machines.md",
    note_type: "concept",
    word_count: 140,
    cross_references: ["page:agent-runtime"],
    backlinks: ["page:langgraph-overview"],
    concept_tags: ["agent-orchestration"],
    source_ids: ["source:state-machine-notes"],
    existing_hub_path: null,
    metadata_only: true,
  },
  {
    page_id: "page:sqlite-vec",
    title: "SQLite Vec",
    path: "10-wiki/concepts/sqlite-vec.md",
    note_type: "concept",
    word_count: 420,
    cross_references: ["page:obsidian-semantic-search"],
    backlinks: [],
    concept_tags: ["local-vector-search"],
    source_ids: ["source:sqlite-vec"],
    existing_hub_path: null,
    metadata_only: true,
  },
  {
    page_id: "page:obsidian-semantic-search",
    title: "Obsidian Semantic Search",
    path: "10-wiki/systems/obsidian-semantic-search.md",
    note_type: "system",
    word_count: 380,
    cross_references: ["page:sqlite-vec"],
    backlinks: ["page:sqlite-vec"],
    concept_tags: ["local-vector-search"],
    source_ids: ["source:obsidian-semantic"],
    existing_hub_path: null,
    metadata_only: true,
  },
];

const fixtureSources: KnowledgeDraftSource[] = [
  {
    source_id: "source:langgraph-docs",
    page_id: "page:langgraph-overview",
    title: "LangGraph Overview",
    path: "10-wiki/concepts/langgraph-overview.md",
    snippet: "LangGraph notes describe stateful agent orchestration.",
    source_hash: "hash-langgraph",
    metadata_only: true,
  },
  {
    source_id: "source:jarvis-agent-runtime",
    page_id: "page:agent-runtime",
    title: "Agent Runtime",
    path: "10-wiki/systems/agent-runtime.md",
    snippet: "The runtime contract keeps agents suggestion-only.",
    source_hash: "hash-runtime",
    metadata_only: true,
  },
  {
    source_id: "source:state-machine-notes",
    page_id: "page:state-machines",
    title: "State Machines",
    path: "10-wiki/concepts/state-machines.md",
    snippet:
      "State machine notes link orchestration states to deterministic transitions.",
    source_hash: "hash-state-machines",
    metadata_only: true,
  },
];

function topCandidate(): KnowledgeHubCandidate {
  const candidate = identifyKnowledgeHubCandidates(fixturePages)[0];
  if (!candidate) {
    throw new Error("Expected fixture hub candidate.");
  }
  return candidate;
}

function approved(
  overrides: Partial<KnowledgeWriteExecutionApproval> = {},
): KnowledgeWriteExecutionApproval {
  return {
    approval_id: "approval:knowledge-compounding.write",
    approval_status: "approved",
    approved_target_path: "10-wiki/hubs/agent-orchestration.md",
    decided_at: "2026-06-03T09:00:00.000Z",
    ...overrides,
  };
}

function createDraftWithSentinel(sentinel: string) {
  const draft = buildKnowledgeDraft({
    candidate: topCandidate(),
    sources: fixtureSources,
  });
  return {
    ...draft,
    sections: [
      {
        ...draft.sections[0],
        body: sentinel,
      },
      ...draft.sections.slice(1),
    ],
  };
}

describe("knowledge compounding workflow", () => {
  it("selects and ranks real hub candidates from vault metadata deterministically", () => {
    const firstRun = identifyKnowledgeHubCandidates(fixturePages);
    const secondRun = identifyKnowledgeHubCandidates(
      [...fixturePages].reverse(),
    );

    expect(firstRun.map((candidate) => candidate.candidate_id)).toEqual(
      secondRun.map((candidate) => candidate.candidate_id),
    );
    expect(firstRun[0]?.candidate_id).toBe("knowledge-hub:agent-orchestration");
    expect(firstRun[0]?.rank).toBe(1);
    expect(firstRun[0]?.metadata_only).toBe(true);
    expect(firstRun[0]?.model_call_attempted).toBe(false);
    expect(firstRun[0]?.vault_write_attempted).toBe(false);
    expect(firstRun[0]?.reasons).toEqual(
      expect.arrayContaining([
        "concept_cluster_detected",
        "high_cross_reference_count",
        "backlink_cluster_detected",
        "sparse_pages_detected",
        "missing_hub_detected",
      ]),
    );

    const summary = summarizeKnowledgeHubCandidates(firstRun);
    expect(summary).toMatchObject({
      candidate_count: 2,
      top_candidate_id: "knowledge-hub:agent-orchestration",
      metadata_only: true,
      deterministic: true,
      model_call_attempted: false,
      vault_write_attempted: false,
    });
  });

  it("keeps explicit ranking stable when candidate scores tie", () => {
    const left: KnowledgeHubCandidate = {
      ...topCandidate(),
      candidate_id: "knowledge-hub:alpha",
      hub_key: "alpha",
      proposed_hub_title: "Alpha",
      score: { ...topCandidate().score, total_score: 10 },
      rank: 1,
    };
    const right: KnowledgeHubCandidate = {
      ...topCandidate(),
      candidate_id: "knowledge-hub:beta",
      hub_key: "beta",
      proposed_hub_title: "Beta",
      score: { ...topCandidate().score, total_score: 10 },
      rank: 1,
    };

    expect(
      rankKnowledgeHubCandidates([right, left]).map(
        (candidate) => candidate.hub_key,
      ),
    ).toEqual(["alpha", "beta"]);
  });

  it("builds vault-sourced drafts with source attribution and no unsupported claims", () => {
    const draft = buildKnowledgeDraft({
      candidate: topCandidate(),
      sources: fixtureSources,
    });
    const summary = summarizeKnowledgeDraft(draft);

    expect(draft.draft_id).toBe("knowledge-draft:agent-orchestration");
    expect(draft.external_knowledge_used).toBe(false);
    expect(draft.model_call_attempted).toBe(false);
    expect(draft.write_attempted).toBe(false);
    expect(draft.unsupported_claims_rejected).toBe(true);
    expect(draft.sections).toHaveLength(2);
    for (const section of draft.sections) {
      expect(section.source_ids).toEqual(
        fixtureSources.map((source) => source.source_id),
      );
      expect(section.unsupported_claims).toEqual([]);
      expect(section.metadata_only).toBe(true);
    }
    expect(summary).toMatchObject({
      draft_id: "knowledge-draft:agent-orchestration",
      source_count: 3,
      unsupported_claim_count: 0,
      metadata_only: true,
    });
  });

  it("rejects draft generation when supplied vault sources are unsupported", () => {
    expect(validateKnowledgeDraftSources(fixtureSources)).toBe(true);
    expect(() =>
      buildKnowledgeDraft({
        candidate: topCandidate(),
        sources: [{ ...fixtureSources[0], snippet: "" }],
      }),
    ).toThrow();
  });

  it("creates approval-gated write plans without executing gateway or vault writes", () => {
    const draft = buildKnowledgeDraft({
      candidate: topCandidate(),
      sources: fixtureSources,
    });
    const plan = buildKnowledgeWritePlan(draft);
    const summary = summarizeKnowledgeWritePlan(plan);

    expect(plan.target).toEqual({
      vault_path: "10-wiki/hubs/agent-orchestration.md",
      filename: "agent-orchestration.md",
      note_type: "hub",
      overwrite_allowed: false,
    });
    expect(plan.approval_boundary).toEqual({
      approval_required: true,
      approval_status: "awaiting_human_approval",
      approval_gate: "vault_write_gateway_required",
      gateway_execution_attempted: false,
      approval_execution_attempted: false,
    });
    expect(plan.vault_write_attempted).toBe(false);
    expect(plan.gateway_execution_attempted).toBe(false);
    expect(plan.filesystem_write_attempted).toBe(false);
    expect(summary).toMatchObject({
      approval_required: true,
      reindex_required: true,
      execution_attempted: false,
      metadata_only: true,
    });
  });

  it("plans deterministic re-index targets without running index writes", () => {
    const writePlan = buildKnowledgeWritePlan(
      buildKnowledgeDraft({
        candidate: topCandidate(),
        sources: fixtureSources,
      }),
    );
    const reindexPlan = buildKnowledgeReindexPlan(writePlan);

    expect(reindexPlan.targets.map((target) => target.target_kind)).toEqual([
      "planned_hub",
      "source_page",
      "source_page",
      "source_page",
      "semantic_index",
      "wiki_index",
    ]);
    expect(reindexPlan.summary).toEqual({
      target_count: 6,
      semantic_reindex_required: true,
      wiki_index_update_required: true,
      execution_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      metadata_only: true,
    });
  });

  it("bounds re-index plans for the approved write execution flow", () => {
    const writePlan = buildKnowledgeWritePlan(
      buildKnowledgeDraft({
        candidate: topCandidate(),
        sources: fixtureSources,
      }),
    );
    const bounded = buildBoundedKnowledgeReindexPlan(writePlan, 2);

    expect(bounded.targets.map((target) => target.target_kind)).toEqual([
      "planned_hub",
      "source_page",
    ]);
    expect(bounded.summary).toMatchObject({
      target_count: 2,
      execution_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      metadata_only: true,
    });
  });

  it("executes an approved knowledge write only through the injected gateway writer", async () => {
    const sentinel = "RAW-DRAFT-SENTINEL-DO-NOT-LEAK";
    const draft = createDraftWithSentinel(sentinel);
    const writePlan = buildKnowledgeWritePlan(draft);
    const writerCalls: KnowledgeApprovedVaultWriterInput[] = [];
    const writer: KnowledgeApprovedVaultWriter = async (request) => {
      writerCalls.push(request);
      return {
        write_status: "written",
        target_path: request.target_path,
        bytes_written: Buffer.byteLength(
          request.proposal.markdown_body,
          "utf8",
        ),
        content_hash: request.proposal.content_hash,
        metadata_only: true,
        raw_body_included: false,
      };
    };

    const result = await executeApprovedKnowledgeCompoundingWrite({
      draft,
      writePlan,
      approval: approved(),
      vaultRoot: join(process.cwd(), "tmp-vault"),
      writer,
      maxReindexTargets: 3,
      now: "2026-06-03T09:00:00.000Z",
    });

    expect(writerCalls).toHaveLength(1);
    expect(writerCalls[0]).toMatchObject({
      vault_root: join(process.cwd(), "tmp-vault"),
      target_path: "10-wiki/hubs/agent-orchestration.md",
      allow_overwrite: false,
    });
    expect(writerCalls[0]?.resolved_target_path).toBe(
      join(process.cwd(), "tmp-vault", "10-wiki/hubs/agent-orchestration.md"),
    );
    expect(writerCalls[0]?.proposal).toMatchObject({
      contract_version: "phase21.vault-write-gateway.v1",
      target_path: "10-wiki/hubs/agent-orchestration.md",
      approval_status: "approved",
      approval_id: "approval:knowledge-compounding.write",
      markdown_body: expect.stringContaining(sentinel),
      frontmatter: {
        note_type: "hub",
        domain: "wiki",
        lifecycle: {
          durable: true,
          approval_status: "approved",
          approval_id: "approval:knowledge-compounding.write",
        },
      },
    });

    expect(result).toMatchObject({
      write_plan_id: "knowledge-write-plan:agent-orchestration",
      draft_id: "knowledge-draft:agent-orchestration",
      approval_id: "approval:knowledge-compounding.write",
      target_path: "10-wiki/hubs/agent-orchestration.md",
      write_status: "written",
      writer_invoked: true,
      vault_mutated: true,
      telemetry: {
        metadata_only: true,
        raw_draft_body_included: false,
        raw_vault_body_included: false,
        raw_writer_payload_included: false,
        draft_section_count: 2,
        source_count: 3,
      },
    });
    expect(result.reindex_plan?.summary).toMatchObject({
      target_count: 3,
      execution_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      metadata_only: true,
    });
    expect(result.reindex_run).toMatchObject({
      status: "metadata_emitted_after_approved_write",
      bounded: true,
      max_targets: 3,
      target_count: 3,
      skipped_target_count: 3,
      execution_attempted: true,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      metadata_only: true,
      raw_vault_body_included: false,
    });
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(Object.keys(result.telemetry)).not.toEqual(
      expect.arrayContaining(["markdown_body", "body", "raw_body", "content"]),
    );
  });

  it("rejects pending, denied, expired, and deferred approvals without writer calls", async () => {
    const draft = buildKnowledgeDraft({
      candidate: topCandidate(),
      sources: fixtureSources,
    });
    const writePlan = buildKnowledgeWritePlan(draft);
    const writerCalls: KnowledgeApprovedVaultWriterInput[] = [];
    const writer: KnowledgeApprovedVaultWriter = async (request) => {
      writerCalls.push(request);
      return {
        write_status: "written",
        target_path: request.target_path,
        bytes_written: 1,
        content_hash: request.proposal.content_hash,
        metadata_only: true,
        raw_body_included: false,
      };
    };

    for (const approval_status of [
      "pending",
      "denied",
      "expired",
      "deferred",
    ] as const) {
      const result = await executeApprovedKnowledgeCompoundingWrite({
        draft,
        writePlan,
        approval: approved({ approval_status }),
        vaultRoot: join(process.cwd(), "tmp-vault"),
        writer,
      });

      expect(result).toMatchObject({
        write_status:
          approval_status === "deferred" ? "deferred" : "rejected_by_policy",
        writer_invoked: false,
        vault_mutated: false,
        bytes_written: 0,
        reindex_plan: null,
        reindex_run: null,
      });
    }

    expect(writerCalls).toEqual([]);
  });

  it("rejects target traversal and mismatched approved target before writer invocation", async () => {
    const draft = buildKnowledgeDraft({
      candidate: topCandidate(),
      sources: fixtureSources,
    });
    const writePlan = buildKnowledgeWritePlan(draft);
    const writerCalls: KnowledgeApprovedVaultWriterInput[] = [];
    const writer: KnowledgeApprovedVaultWriter = async (request) => {
      writerCalls.push(request);
      return {
        write_status: "written",
        target_path: request.target_path,
        bytes_written: 1,
        content_hash: request.proposal.content_hash,
        metadata_only: true,
        raw_body_included: false,
      };
    };

    const traversal = await executeApprovedKnowledgeCompoundingWrite({
      draft,
      writePlan: {
        ...writePlan,
        target: {
          ...writePlan.target,
          vault_path: "10-wiki/hubs/../../outside.md",
        },
      },
      approval: approved({
        approved_target_path: "10-wiki/hubs/../../outside.md",
      }),
      vaultRoot: join(process.cwd(), "tmp-vault"),
      writer,
    });
    const mismatch = await executeApprovedKnowledgeCompoundingWrite({
      draft,
      writePlan,
      approval: approved({
        approved_target_path: "10-wiki/hubs/other.md",
      }),
      vaultRoot: join(process.cwd(), "tmp-vault"),
      writer,
    });

    expect(traversal).toMatchObject({
      write_status: "path_escape_rejected",
      writer_invoked: false,
      vault_mutated: false,
    });
    expect(mismatch).toMatchObject({
      write_status: "rejected_by_policy",
      writer_invoked: false,
      vault_mutated: false,
    });
    expect(writerCalls).toEqual([]);
  });

  it("reports closeout through the human approval boundary only", () => {
    const report = buildKnowledgeCompoundingCloseoutReport();

    expect(report.title).toBe(
      "Knowledge Compounding workflow complete through human approval boundary",
    );
    expect(report.components).toEqual([
      "hub_candidate_selection",
      "candidate_ranking",
      "vault_sourced_draft_generation",
      "source_attribution",
      "approval_gated_write_planning",
      "reindex_planning",
    ]);
    expect(report.governance).toEqual({
      no_vault_writes: true,
      no_gateway_execution: true,
      no_provider_model_calls: true,
      no_deepseek_calls: true,
      no_external_knowledge: true,
      no_web_access: true,
      no_network_calls: true,
      no_filesystem_writes: true,
      no_database_writes: true,
      no_scheduler_execution: true,
      no_approval_execution: true,
      no_auto_write: true,
      no_new_authority_surface: true,
    });
    expect(report.readme_safe_wording.join(" ")).toContain(
      "Actual vault writes, automatic wiki creation, scheduler-driven mutation, and autonomous knowledge growth remain future work.",
    );
  });

  it("does not import provider, network, write execution, or scheduler affordances", () => {
    const source = readFileSync(
      "src/lib/obsidian/knowledge-compounding-workflow.ts",
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'](?:node:)?fs/);
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:openai|anthropic|deepseek)/i,
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bexecuteApprovedVaultWriteProposal\b/);
    expect(source).not.toMatch(/\b(?:writeFile|appendFile|mkdir|rm|unlink)\b/);
    expect(source).not.toMatch(/\b(?:setInterval|setTimeout|WebSocket)\b/);
  });
});
