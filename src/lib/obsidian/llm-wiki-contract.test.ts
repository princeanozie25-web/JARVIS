import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_GOVERNANCE_CONTRACT,
  LLM_WIKI_LINT_FINDINGS,
  LLM_WIKI_MAINTENANCE_OPERATIONS,
  LLM_WIKI_PAGE_TYPES,
  LLM_WIKI_PATTERN_SOURCE_URL,
  LLM_WIKI_RAW_SOURCE_TYPES,
  LLM_WIKI_SPECIAL_FILES,
  LlmWikiPageDraftSchema,
  LlmWikiRawSourceSchema,
  createLlmWikiLibrarianEnvelope,
  lintLlmWikiPageDraft,
  planLibrarianIngestion,
  planLlmWikiMaintenanceOperation,
  routeVaultNote,
} from "./index";
import type {
  LlmWikiPageDraft,
  LlmWikiRawSource,
} from "./llm-wiki-contract";

const NOW = "2026-06-02T12:00:00.000Z";
const HASH = `sha256:${"7".repeat(64)}`;

function rawSource(
  overrides: Partial<LlmWikiRawSource> = {},
): LlmWikiRawSource {
  return {
    source_type: "user_note",
    source_id: "source:llm-wiki.raw",
    source_ref: null,
    content_hash: HASH,
    captured_at: NOW,
    immutable: true,
    source_of_truth: true,
    raw_mutation_supported: false,
    ...overrides,
  };
}

function page(
  overrides: Partial<LlmWikiPageDraft> = {},
): LlmWikiPageDraft {
  return {
    contract_version: "phase21.llm-wiki-contract.v1",
    page_id: "llm-wiki:concept.compounding",
    page_type: "concept_page",
    title: "Knowledge Compounding",
    project: null,
    source_refs: ["source:llm-wiki.raw"],
    source_hashes: [HASH],
    synthesis_supported: true,
    derived_from_raw_sources: true,
    durable_requested: false,
    canonical_requested: false,
    approval_status: "pending",
    approval_id: null,
    sensitivity: "private",
    generated_at: NOW,
    ...overrides,
  };
}

describe("Phase 21 LLM Wiki source and page contracts", () => {
  it("models immutable raw sources as source-of-truth and wiki pages as derived", () => {
    expect(LLM_WIKI_RAW_SOURCE_TYPES).toEqual([
      "user_note",
      "imported_document",
      "external_research",
      "gitnexus",
      "agent_output",
    ]);

    for (const sourceType of LLM_WIKI_RAW_SOURCE_TYPES) {
      expect(
        LlmWikiRawSourceSchema.parse(
          rawSource({
            source_type: sourceType,
          }),
        ),
      ).toMatchObject({
        source_type: sourceType,
        immutable: true,
        source_of_truth: true,
        raw_mutation_supported: false,
      });
    }

    expect(LlmWikiPageDraftSchema.parse(page())).toMatchObject({
      derived_from_raw_sources: true,
    });
  });

  it("defines the approved wiki page types", () => {
    expect(LLM_WIKI_PAGE_TYPES).toEqual([
      "hub_page",
      "concept_page",
      "system_page",
      "person_page",
      "project_page",
      "source_page",
      "decision_page",
      "comparison_page",
      "synthesis_page",
    ]);
  });

  it.each([
    ["hub_page", "10-wiki/hubs"],
    ["concept_page", "10-wiki/concepts"],
    ["system_page", "10-wiki/systems"],
    ["person_page", "10-wiki/people"],
    ["project_page", "10-wiki/projects"],
    ["source_page", "10-wiki/sources"],
    ["decision_page", "10-wiki/decisions"],
    ["comparison_page", "10-wiki/concepts"],
    ["synthesis_page", "10-wiki/concepts"],
  ] as const)("routes %s through the vault taxonomy", (pageType, folder) => {
    const envelope = createLlmWikiLibrarianEnvelope({
      page: page({
        page_type: pageType,
      }),
      raw_sources: [rawSource()],
    });

    expect(routeVaultNote(envelope.proposed_frontmatter)).toMatchObject({
      folder,
      write_attempted: false,
    });
  });
});

describe("Phase 21 LLM Wiki special files and maintenance operations", () => {
  it("models index.md and log.md without write authority", () => {
    expect(LLM_WIKI_SPECIAL_FILES).toEqual([
      {
        kind: "index",
        path: "10-wiki/index.md",
        orientation: "content",
        future_write_model: "update",
        write_supported: false,
      },
      {
        kind: "log",
        path: "10-wiki/log.md",
        orientation: "chronological",
        future_write_model: "append_only",
        write_supported: false,
      },
    ]);
  });

  it("defines dry-run maintenance operation contracts", () => {
    expect(LLM_WIKI_MAINTENANCE_OPERATIONS).toEqual([
      "ingest_source",
      "update_entity_concept_pages",
      "update_index",
      "append_log_entry",
      "answer_query",
      "file_useful_answer_back_into_wiki",
      "lint_wiki",
    ]);

    expect(planLlmWikiMaintenanceOperation("append_log_entry")).toMatchObject({
      operation: "append_log_entry",
      dry_run_only: true,
      write_supported: false,
      requires_librarian: true,
      raw_source_mutation_supported: false,
    });

    expect(planLlmWikiMaintenanceOperation("answer_query")).toMatchObject({
      operation: "answer_query",
      dry_run_only: true,
      write_supported: false,
      requires_librarian: false,
    });
  });
});

describe("Phase 21 LLM Wiki lint and Librarian integration", () => {
  it("defines the approved lint finding model", () => {
    expect(LLM_WIKI_LINT_FINDINGS).toEqual([
      "contradiction",
      "stale_claim",
      "orphan_page",
      "missing_backlink",
      "missing_hub_page",
      "weak_source_attribution",
      "unsupported_synthesis",
      "duplicate_page",
      "outdated_index_entry",
    ]);
  });

  it("flags weak attribution and unsupported synthesis without writing", () => {
    expect(
      lintLlmWikiPageDraft(
        page({
          page_type: "synthesis_page",
          source_refs: [],
          source_hashes: [],
          synthesis_supported: false,
        }),
      ),
    ).toEqual([
      {
        finding: "weak_source_attribution",
        severity: "error",
        page_id: "llm-wiki:concept.compounding",
        reason: "Wiki pages require source references and source content hashes.",
        write_attempted: false,
      },
      {
        finding: "unsupported_synthesis",
        severity: "error",
        page_id: "llm-wiki:concept.compounding",
        reason: "Synthesis pages must be backed by supported source attribution.",
        write_attempted: false,
      },
    ]);
  });

  it("routes LLM Wiki outputs through Librarian envelopes", () => {
    const envelope = createLlmWikiLibrarianEnvelope({
      page: page(),
      raw_sources: [rawSource()],
    });

    expect(envelope).toMatchObject({
      source: {
        source_type: "llm_wiki",
        source_id: "llm-wiki:concept.compounding",
        provenance_source_type: "system",
        content_hash: HASH,
      },
      requested_route_target: "wiki",
      requested_target_folder: "10-wiki/concepts",
      raw_body_included: false,
      proposed_frontmatter: {
        note_type: "concept",
        domain: "wiki",
        provenance: {
          source_url: LLM_WIKI_PATTERN_SOURCE_URL,
          content_hash: HASH,
        },
      },
    });

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "llm_wiki",
      classification: "candidate",
      route_target: "wiki",
      target_folder: "10-wiki/concepts",
    });
  });

  it("holds durable LLM Wiki output for approval", () => {
    const envelope = createLlmWikiLibrarianEnvelope({
      page: page({
        durable_requested: true,
        approval_status: "pending",
      }),
      raw_sources: [rawSource()],
    });

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: false,
      source_type: "llm_wiki",
      classification: "durable",
      route_target: "inbox",
      target_folder: "01-inbox/pending-approval",
      reasons: ["durable_agent_promotion_requires_human_approval"],
      promotion: {
        approval_required: true,
        approval_status: "pending",
        human_approval_required: true,
        promotion_allowed: false,
      },
    });
  });

  it("accepts approved durable LLM Wiki metadata without granting write authority", () => {
    const envelope = createLlmWikiLibrarianEnvelope({
      page: page({
        durable_requested: true,
        approval_status: "approved",
        approval_id: "approval:llm-wiki.ready",
      }),
      raw_sources: [rawSource()],
    });

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "llm_wiki",
      classification: "durable",
      target_folder: "10-wiki/concepts",
      promotion: {
        approval_required: true,
        approval_status: "approved",
        promotion_allowed: true,
      },
      governance: {
        write_authority: false,
        execution_authority: false,
        scheduler_authority: false,
      },
    });
  });
});

describe("Phase 21 LLM Wiki governance tripwires", () => {
  it("keeps the contract source-only with no write, execution, scheduler, or network path", () => {
    expect(LLM_WIKI_GOVERNANCE_CONTRACT).toMatchObject({
      raw_sources_immutable: true,
      raw_sources_are_truth: true,
      wiki_pages_are_derived: true,
      write_authority: false,
      vault_write_execution_supported: false,
      scheduler_supported: false,
      watcher_supported: false,
      background_jobs_supported: false,
      requires_librarian_envelope: true,
      durable_requires_approval: true,
      index_modeled_not_written: true,
      log_modeled_not_written: true,
    });

    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/llm-wiki-contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-gateway|write-execution|planVaultWriteProposalDryRun|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /knowledge_compounding_implemented:\s*true|source_ingestion_implemented:\s*true|autonomous_agents_implemented:\s*true/,
    );
  });
});
