import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPOUNDING_TO_WIKI_ACTION_MAP,
  COMPOUNDING_WIKI_BRIDGE_VERSION,
  detectKnowledgeCompoundingCandidates,
  planKnowledgeCompoundingWikiBridge,
} from "./index";
import type { KnowledgeCompoundingDetectionInput } from "./knowledge-compounding-contract";

const HASH = `sha256:${"5".repeat(64)}`;

function detectionInput(
  overrides: Partial<KnowledgeCompoundingDetectionInput> = {},
): KnowledgeCompoundingDetectionInput {
  return {
    page_id: "llm-wiki:concept.bridge",
    page_type: "concept_page",
    title: "Bridge Concept",
    path: "10-wiki/concepts/bridge-concept.md",
    references_count: 2,
    backlinks_count: 0,
    page_word_count: 120,
    source_count: 1,
    update_age_days: 220,
    duplicate_title_count: 1,
    hub_exists: false,
    related_page_count: 4,
    source_ids: ["source:bridge"],
    source_hashes: [HASH],
    ...overrides,
  };
}

function allCandidateFixtures() {
  return [
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.missing-hub",
        hub_exists: false,
      }),
    ]).find((candidate) => candidate.candidate_type === "missing_hub"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:hub.sparse",
        page_type: "hub_page",
        hub_exists: true,
        page_word_count: 50,
      }),
    ]).find((candidate) => candidate.candidate_type === "sparse_hub"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.fragmented",
        related_page_count: 4,
      }),
    ]).find((candidate) => candidate.candidate_type === "fragmented_concept"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.missing-backlinks",
        backlinks_count: 0,
        references_count: 3,
      }),
    ]).find((candidate) => candidate.candidate_type === "missing_backlinks"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.weak-source",
        source_count: 1,
      }),
    ]).find((candidate) => candidate.candidate_type === "weak_source_coverage"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.duplicate",
        duplicate_title_count: 1,
      }),
    ]).find((candidate) => candidate.candidate_type === "duplicate_concept"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.stale",
        update_age_days: 220,
      }),
    ]).find((candidate) => candidate.candidate_type === "stale_wiki_page"),
    detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:system.underlinked",
        page_type: "system_page",
        hub_exists: true,
        backlinks_count: 1,
      }),
    ]).find((candidate) => candidate.candidate_type === "underlinked_system"),
  ].filter((candidate) => candidate !== undefined);
}

describe("Phase 21 Knowledge Compounding to LLM Wiki bridge", () => {
  it("maps all candidate types to approved LLM Wiki actions", () => {
    expect(COMPOUNDING_TO_WIKI_ACTION_MAP).toEqual({
      missing_hub: "create_hub",
      sparse_hub: "update_hub",
      fragmented_concept: "merge_pages",
      missing_backlinks: "create_backlinks",
      weak_source_coverage: "update_hub",
      duplicate_concept: "merge_pages",
      stale_wiki_page: "refresh_stale_page",
      underlinked_system: "create_backlinks",
    });

    const plan = planKnowledgeCompoundingWikiBridge({
      candidates: allCandidateFixtures(),
      llm_wiki_metadata_snapshot: {
        pages: [],
        index_entries: [],
        log_entry_ids: [],
      },
    });

    expect(plan.recommendations.map((entry) => [
      entry.candidate_type,
      entry.wiki_action,
    ])).toEqual([
      ["missing_hub", "create_hub"],
      ["sparse_hub", "update_hub"],
      ["fragmented_concept", "merge_pages"],
      ["missing_backlinks", "create_backlinks"],
      ["weak_source_coverage", "update_hub"],
      ["duplicate_concept", "merge_pages"],
      ["stale_wiki_page", "refresh_stale_page"],
      ["underlinked_system", "create_backlinks"],
    ]);
  });

  it("reuses the LLM Wiki planner and aggregates Librarian drafts and lint findings", () => {
    const candidates = allCandidateFixtures().slice(0, 3);
    const plan = planKnowledgeCompoundingWikiBridge({
      candidates,
      llm_wiki_metadata_snapshot: {
        pages: [],
        index_entries: [],
        log_entry_ids: [],
      },
    });

    expect(plan).toMatchObject({
      bridge_version: COMPOUNDING_WIKI_BRIDGE_VERSION,
      accepted: true,
      reasons: ["wiki_plans_created"],
      governance: {
        write_attempted: false,
        vault_mutated: false,
        execution_authority: false,
        llm_calls_made: false,
        network_used: false,
      },
      write_attempted: false,
    });
    expect(plan.wiki_maintenance_plans).toHaveLength(3);
    expect(plan.wiki_maintenance_plans[0]).toMatchObject({
      page_plans: [expect.objectContaining({ write_supported: false })],
      index_draft: expect.objectContaining({
        path: "10-wiki/index.md",
        write_supported: false,
      }),
      log_draft: expect.objectContaining({
        path: "10-wiki/log.md",
        write_supported: false,
      }),
      write_attempted: false,
    });
    expect(plan.librarian_envelope_drafts.length).toBe(3);
    expect(plan.lint_findings.length).toBeGreaterThan(0);
    expect(plan.warnings).toContain("llm_wiki_planner_reused");
  });

  it("produces Gateway proposal drafts when requested, without execution", () => {
    const candidate = detectKnowledgeCompoundingCandidates([
      detectionInput({
        page_id: "llm-wiki:concept.gateway",
      }),
    ]).find((entry) => entry.candidate_type === "missing_hub");
    if (!candidate) throw new Error("missing candidate fixture");

    const plan = planKnowledgeCompoundingWikiBridge({
      candidates: [candidate],
      llm_wiki_metadata_snapshot: {
        pages: [],
        index_entries: [],
        log_entry_ids: [],
      },
      routing_preferences: {
        include_gateway_proposal_drafts: true,
        proposal_markdown_body: "Compounding bridge proposal body.",
      },
    });

    expect(plan).toMatchObject({
      accepted: true,
      reasons: ["wiki_plans_created", "gateway_drafts_created"],
      gateway_proposal_drafts: [
        expect.objectContaining({
          markdown_body: "Compounding bridge proposal body.",
          approval_required: true,
          approval_status: "approved",
        }),
      ],
      governance: {
        write_attempted: false,
        vault_mutated: false,
      },
    });
    expect(plan.warnings).toContain("gateway_proposals_are_drafts");
    expect(
      JSON.stringify(plan.wiki_maintenance_plans[0]),
    ).not.toContain("executeApprovedVaultWriteProposal");
  });

  it("returns an explicit no-candidates plan", () => {
    expect(
      planKnowledgeCompoundingWikiBridge({
        candidates: [],
        llm_wiki_metadata_snapshot: {
          pages: [],
          index_entries: [],
          log_entry_ids: [],
        },
      }),
    ).toMatchObject({
      accepted: false,
      recommendations: [],
      wiki_maintenance_plans: [],
      librarian_envelope_drafts: [],
      gateway_proposal_drafts: [],
      reasons: ["no_candidates"],
      write_attempted: false,
    });
  });
});

describe("Phase 21 Knowledge Compounding bridge governance tripwires", () => {
  it("contains no model, network, write, scheduler, watcher, or execution path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/compounding-wiki-bridge.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /from ["'](?:openai|@anthropic|ollama|deepseek)|new OpenAI|chat\.completions|responses\.create|generateText|runAgent|autonomousAgent/i,
    );
  });
});
