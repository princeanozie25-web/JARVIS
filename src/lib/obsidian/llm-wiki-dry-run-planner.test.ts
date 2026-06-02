import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_DRY_RUN_PLANNER_VERSION,
  LLM_WIKI_PAGE_TYPES,
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  LlmWikiMaintenanceDryRunInputSchema,
  planLlmWikiMaintenanceDryRun,
} from "./index";
import type { LlmWikiRawSource } from "./llm-wiki-contract";
import type { LlmWikiSnapshot } from "./llm-wiki-dry-run-planner";

const NOW = "2026-06-02T13:00:00.000Z";
const HASH = `sha256:${"8".repeat(64)}`;

function source(
  overrides: Partial<LlmWikiRawSource> = {},
): LlmWikiRawSource {
  return {
    source_type: "user_note",
    source_id: "source:llm-wiki.planner",
    source_ref: null,
    content_hash: HASH,
    captured_at: NOW,
    immutable: true,
    source_of_truth: true,
    raw_mutation_supported: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<LlmWikiSnapshot> = {}): LlmWikiSnapshot {
  return {
    pages: [],
    index_entries: [],
    log_entry_ids: [],
    ...overrides,
  };
}

describe("Phase 21 LLM Wiki dry-run planner", () => {
  it("plans a source-derived page, index draft, log draft, and Librarian envelope without writing", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot(),
      requested_operation: "ingest_source",
    });

    expect(plan).toMatchObject({
      planner_version: LLM_WIKI_DRY_RUN_PLANNER_VERSION,
      accepted: true,
      maintenance_operation: "ingest_source",
      page_plans: [
        {
          action: "create_page_draft",
          source_ids: ["source:llm-wiki.planner"],
          source_hashes: [HASH],
          source_type: "user_note",
          unsupported_synthesis: false,
          write_supported: false,
          page: {
            page_type: "source_page",
            source_refs: ["source:llm-wiki.planner"],
            source_hashes: [HASH],
            derived_from_raw_sources: true,
          },
        },
      ],
      index_draft: {
        path: "10-wiki/index.md",
        operation: "add_or_update_entry",
        write_supported: false,
      },
      log_draft: {
        path: "10-wiki/log.md",
        operation: "append_entry",
        append_only_future_slice: true,
        write_supported: false,
      },
      lint_findings: [
        {
          finding: "missing_hub_page",
          severity: "warning",
          write_attempted: false,
        },
      ],
      librarian_envelope_drafts: [
        {
          source: {
            source_type: "llm_wiki",
            content_hash: HASH,
          },
          raw_body_included: false,
        },
      ],
      gateway_proposal_drafts: [],
      write_attempted: false,
      governance: {
        raw_sources_immutable: true,
        raw_source_mutated: false,
        write_attempted: false,
        vault_mutated: false,
        vault_write_executed: false,
        llm_calls_made: false,
        network_used: false,
        scheduler_started: false,
        watcher_started: false,
        background_job_started: false,
        index_log_modeled_only: true,
      },
    });
    expect(plan.warnings).toContain("index_modeled_not_written");
    expect(plan.warnings).toContain("log_modeled_not_written");
  });

  it.each(LLM_WIKI_PAGE_TYPES)(
    "supports planning %s drafts",
    (pageType) => {
      const plan = planLlmWikiMaintenanceDryRun({
        source_envelope: source(),
        existing_wiki_snapshot: snapshot({
          pages: [
            {
              page_id: "llm-wiki:hub",
              page_type: "hub_page",
              title: "Hub",
              path: "10-wiki/hubs/hub.md",
              source_ids: [],
              source_hashes: [],
              backlinks: ["llm-wiki:planner"],
              hub_id: null,
              updated_at: NOW,
            },
          ],
        }),
        requested_operation: "update_entity_concept_pages",
        page_preference: {
          page_type: pageType,
          title: `${pageType} Planner`,
          synthesis_supported: pageType !== "synthesis_page",
        },
      });

      expect(plan.page_plans[0]).toMatchObject({
        action: "create_page_draft",
        page: {
          page_type: pageType,
          title: `${pageType} Planner`,
        },
        source_ids: ["source:llm-wiki.planner"],
        source_hashes: [HASH],
        write_supported: false,
      });
    },
  );

  it("flags unsupported synthesis and rejects the plan without writing", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot(),
      requested_operation: "file_useful_answer_back_into_wiki",
      page_preference: {
        page_type: "synthesis_page",
        title: "Unsupported Synthesis",
        synthesis_supported: false,
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      reasons: [
        "unsupported_synthesis",
        "gateway_proposal_not_requested",
      ],
      page_plans: [
        {
          unsupported_synthesis: true,
        },
      ],
      lint_findings: expect.arrayContaining([
        expect.objectContaining({
          finding: "unsupported_synthesis",
          severity: "error",
          write_attempted: false,
        }),
      ]),
      write_attempted: false,
    });
    expect(plan.warnings).toContain("unsupported_synthesis_flagged");
  });

  it("detects duplicate page snapshots and missing backlinks", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot({
        pages: [
          {
            page_id: "llm-wiki:planner-page",
            page_type: "concept_page",
            title: "Planner Page",
            path: "10-wiki/concepts/planner-page.md",
            source_ids: ["source:llm-wiki.planner"],
            source_hashes: [HASH],
            backlinks: [],
            hub_id: null,
            updated_at: NOW,
          },
        ],
      }),
      requested_operation: "update_entity_concept_pages",
      page_preference: {
        page_type: "concept_page",
        title: "Planner Page",
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      reasons: [
        "duplicate_page",
        "gateway_proposal_not_requested",
      ],
      page_plans: [
        {
          action: "update_page_draft",
        },
      ],
      lint_findings: expect.arrayContaining([
        expect.objectContaining({ finding: "duplicate_page" }),
        expect.objectContaining({ finding: "missing_backlink" }),
      ]),
    });
    expect(plan.warnings).toContain("duplicate_page_warning");
  });

  it("models index and log updates for update_index without writing", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot({
        pages: [
          {
            page_id: "llm-wiki:hub",
            page_type: "hub_page",
            title: "Hub",
            path: "10-wiki/hubs/hub.md",
            source_ids: [],
            source_hashes: [],
            backlinks: ["llm-wiki:planner"],
            hub_id: null,
            updated_at: NOW,
          },
        ],
        index_entries: [],
      }),
      requested_operation: "update_index",
      page_preference: {
        page_type: "concept_page",
        title: "Indexed Concept",
      },
    });

    expect(plan.index_draft).toMatchObject({
      path: "10-wiki/index.md",
      operation: "add_or_update_entry",
      entry_title: "Indexed Concept",
      write_supported: false,
    });
    expect(plan.log_draft).toMatchObject({
      path: "10-wiki/log.md",
      operation: "append_entry",
      append_only_future_slice: true,
      write_supported: false,
    });
    expect(plan.lint_findings).toEqual([
      expect.objectContaining({
        finding: "outdated_index_entry",
        severity: "warning",
      }),
    ]);
  });

  it("requires approval for durable drafts and can produce Gateway proposal drafts without executing", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot({
        pages: [
          {
            page_id: "llm-wiki:hub",
            page_type: "hub_page",
            title: "Hub",
            path: "10-wiki/hubs/hub.md",
            source_ids: [],
            source_hashes: [],
            backlinks: ["llm-wiki:durable"],
            hub_id: null,
            updated_at: NOW,
          },
        ],
      }),
      requested_operation: "update_entity_concept_pages",
      page_preference: {
        page_type: "concept_page",
        title: "Durable Concept",
        durable_requested: true,
        approval_status: "approved",
        approval_id: "approval:llm-wiki.durable",
      },
      include_gateway_proposal_draft: true,
      proposal_markdown_body: "Durable concept draft body.",
    });

    expect(plan).toMatchObject({
      accepted: true,
      reasons: ["gateway_proposal_ready"],
      librarian_dry_run_plans: [
        {
          promotion: {
            recommendation: "propose_durable_write",
            required_approval: true,
            approval_status: "approved",
          },
          write_attempted: false,
          vault_mutated: false,
        },
      ],
      gateway_proposal_drafts: [
        {
          contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
          target_path: "10-wiki/concepts/durable-concept.md",
          markdown_body: "Durable concept draft body.",
          approval_required: true,
          approval_status: "approved",
        },
      ],
      write_attempted: false,
      governance: {
        vault_write_executed: false,
        vault_mutated: false,
      },
    });
    expect(plan.warnings).toContain("gateway_proposal_draft_only");
  });

  it("marks unapproved durable drafts as requiring approval", () => {
    const plan = planLlmWikiMaintenanceDryRun({
      source_envelope: source(),
      existing_wiki_snapshot: snapshot(),
      requested_operation: "update_entity_concept_pages",
      page_preference: {
        page_type: "concept_page",
        title: "Pending Durable Concept",
        durable_requested: true,
        approval_status: "pending",
      },
    });

    expect(plan).toMatchObject({
      accepted: true,
      reasons: [
        "durable_requires_approval",
        "gateway_proposal_not_requested",
      ],
      librarian_dry_run_plans: [
        {
          promotion: {
            required_approval: true,
            approval_status: "pending",
            human_approval_required: true,
          },
          write_attempted: false,
          vault_mutated: false,
        },
      ],
      gateway_proposal_drafts: [],
    });
  });

  it("rejects mutable raw source inputs at the schema boundary", () => {
    expect(
      LlmWikiMaintenanceDryRunInputSchema.safeParse({
        source_envelope: {
          ...source(),
          immutable: false,
        },
        existing_wiki_snapshot: snapshot(),
        requested_operation: "ingest_source",
      }).success,
    ).toBe(false);
  });
});

describe("Phase 21 LLM Wiki dry-run governance tripwires", () => {
  it("contains no write execution, LLM, network, scheduler, watcher, or agent path", () => {
    const sourceText = readFileSync(
      join(process.cwd(), "src/lib/obsidian/llm-wiki-dry-run-planner.ts"),
      "utf8",
    );

    expect(sourceText).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(sourceText).not.toMatch(
      /write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(sourceText).not.toMatch(
      /openai|anthropic|chat\.completions|responses\.create|generateText|runAgent|autonomous/i,
    );
  });
});
