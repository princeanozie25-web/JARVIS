import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_GENERATION_PLANNER_VERSION,
  createKnowledgeCompoundingProposal,
  detectKnowledgeCompoundingCandidates,
  planLlmWikiGeneration,
} from "./index";
import type {
  KnowledgeCompoundingDetectionInput,
  KnowledgeCompoundingProposal,
} from "./knowledge-compounding-contract";
import type { LlmWikiGenerationPlannerInput } from "./llm-wiki-generation-planner";

const CREATED_AT = "2026-06-02T15:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;

function detectionInput(
  overrides: Partial<KnowledgeCompoundingDetectionInput> = {},
): KnowledgeCompoundingDetectionInput {
  return {
    page_id: "llm-wiki:concept.alpha",
    page_type: "concept_page",
    title: "Alpha Concept",
    path: "10-wiki/concepts/alpha-concept.md",
    references_count: 2,
    backlinks_count: 0,
    page_word_count: 180,
    source_count: 2,
    update_age_days: 220,
    duplicate_title_count: 0,
    hub_exists: false,
    related_page_count: 0,
    source_ids: ["source:alpha", "source:beta"],
    source_hashes: [HASH_A, HASH_B],
    ...overrides,
  };
}

function proposalFor(
  overrides: Partial<KnowledgeCompoundingDetectionInput> = {},
  proposalOverrides: Partial<KnowledgeCompoundingProposal> = {},
  candidateType?: KnowledgeCompoundingProposal["candidate_type"],
): KnowledgeCompoundingProposal {
  const candidates = detectKnowledgeCompoundingCandidates([
    detectionInput(overrides),
  ]);
  const candidate = candidateType
    ? candidates.find((entry) => entry.candidate_type === candidateType)
    : candidates[0];
  if (!candidate) throw new Error("candidate fixture missing");
  return {
    ...createKnowledgeCompoundingProposal({
      candidate,
      proposal_id: `proposal:generation.${candidate.candidate_type}`,
      created_at: CREATED_AT,
      durable_candidate: true,
      approval_status: "pending",
    }),
    ...proposalOverrides,
  };
}

function plannerInput(
  proposal: KnowledgeCompoundingProposal,
  overrides: Partial<LlmWikiGenerationPlannerInput> = {},
): LlmWikiGenerationPlannerInput {
  return {
    proposal,
    wiki_metadata_snapshot: {
      pages: [
        {
          page_id: "llm-wiki:concept.alpha",
          page_type: "concept_page",
          title: "Alpha Concept",
          path: "10-wiki/concepts/alpha-concept.md",
          source_ids: ["source:alpha", "source:beta"],
          source_hashes: [HASH_A, HASH_B],
          backlinks: [],
          hub_id: null,
          updated_at: CREATED_AT,
        },
      ],
      index_entries: [],
      log_entry_ids: [],
    },
    source_metadata_snapshot: {
      sources: [
        {
          source_id: "source:alpha",
          source_type: "user_note",
          content_hash: HASH_A,
          path: "70-references/source-alpha.md",
          captured_at: CREATED_AT,
        },
        {
          source_id: "source:beta",
          source_type: "user_note",
          content_hash: HASH_B,
          path: "70-references/source-beta.md",
          captured_at: CREATED_AT,
        },
      ],
    },
    ...overrides,
  };
}

describe("Phase 21 LLM Wiki generation planner", () => {
  it("plans candidate to wiki maintenance to page draft without generating text", () => {
    const proposal = proposalFor({
      hub_exists: false,
    });
    const plan = planLlmWikiGeneration(plannerInput(proposal));

    expect(plan).toMatchObject({
      planner_version: LLM_WIKI_GENERATION_PLANNER_VERSION,
      accepted: true,
      proposal_id: proposal.proposal_id,
      generation_scope: "create_hub",
      page_type: "hub_page",
      confidence: proposal.confidence,
      approval_required: true,
      source_coverage: {
        sufficient_source_coverage: true,
        weak_source_coverage: false,
        unsupported_synthesis: false,
        conflicting_sources: false,
        source_count: 2,
        source_hash_count: 2,
      },
      page_plan: {
        generation_scope: "create_hub",
        page_type: "hub_page",
        text_generation_supported: false,
        markdown_body_generated: false,
        write_attempted: false,
      },
      gateway_proposal_draft: null,
      gateway_compatibility: {
        compatible_with_gateway_contract: true,
        gateway_proposal_draft_available: false,
        gateway_body_required: true,
        approval_required: true,
        execution_supported: false,
      },
      governance: {
        text_generated: false,
        write_attempted: false,
        vault_mutated: false,
        execution_authority: false,
        llm_calls_made: false,
        deepseek_calls_made: false,
        ollama_calls_made: false,
        network_used: false,
        scheduler_started: false,
        watcher_started: false,
        background_job_started: false,
      },
      write_attempted: false,
    });
    expect(plan.wiki_maintenance_plan).toMatchObject({
      write_attempted: false,
      page_plans: [expect.objectContaining({ write_supported: false })],
    });
    expect(plan.librarian_envelope_draft).toMatchObject({
      raw_body_included: false,
    });
    expect(plan.librarian_dry_run_plan).toMatchObject({
      write_attempted: false,
      vault_mutated: false,
    });
    expect(plan.target_location).toMatch(/^10-wiki\/hubs\/.+\.md$/);
  });

  it("maps all generation scopes from compounding proposals", () => {
    const cases = [
      [proposalFor({ hub_exists: false }, {}, "missing_hub"), "create_hub"],
      [
        proposalFor(
          {
            page_id: "llm-wiki:hub.sparse",
            page_type: "hub_page",
            hub_exists: true,
            page_word_count: 50,
          },
          {},
          "sparse_hub",
        ),
        "update_existing_page",
      ],
      [
        proposalFor(
          {
            hub_exists: true,
            backlinks_count: 2,
            related_page_count: 3,
            update_age_days: 30,
          },
          {},
          "fragmented_concept",
        ),
        "merge_pages",
      ],
      [
        proposalFor(
          {
            hub_exists: true,
            backlinks_count: 2,
            update_age_days: 30,
            source_count: 1,
            source_ids: ["source:alpha"],
            source_hashes: [HASH_A],
          },
          {},
          "weak_source_coverage",
        ),
        "refresh_page",
      ],
      [
        proposalFor(
          {
            hub_exists: true,
            backlinks_count: 0,
            references_count: 3,
            update_age_days: 30,
          },
          {},
          "missing_backlinks",
        ),
        "create_backlinks",
      ],
    ] as const;

    for (const [proposal, scope] of cases) {
      expect(planLlmWikiGeneration(plannerInput(proposal))).toMatchObject({
        generation_scope: scope,
        page_plan: {
          generation_scope: scope,
        },
      });
    }
  });

  it("blocks unsupported synthesis when merge planning has weak source coverage", () => {
    const proposal = proposalFor(
      {
        hub_exists: true,
        backlinks_count: 2,
        related_page_count: 3,
        update_age_days: 30,
        source_count: 1,
        source_ids: ["source:alpha"],
        source_hashes: [HASH_A],
      },
      {},
      "fragmented_concept",
    );
    const plan = planLlmWikiGeneration(
      plannerInput(proposal, {
        source_metadata_snapshot: {
          sources: [
            {
              source_id: "source:alpha",
              source_type: "user_note",
              content_hash: HASH_A,
              path: "70-references/source-alpha.md",
              captured_at: CREATED_AT,
            },
          ],
        },
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      generation_scope: "merge_pages",
      source_coverage: {
        weak_source_coverage: true,
        unsupported_synthesis: true,
      },
      reasons: expect.arrayContaining([
        "source_coverage_weak",
        "unsupported_synthesis",
      ]),
      warnings: expect.arrayContaining(["weak_source_coverage"]),
      write_attempted: false,
    });
  });

  it("flags conflicting sources without executing a gateway proposal", () => {
    const proposal = proposalFor();
    const plan = planLlmWikiGeneration(
      plannerInput(proposal, {
        source_metadata_snapshot: {
          sources: [
            {
              source_id: "source:alpha",
              source_type: "user_note",
              content_hash: HASH_A,
              path: "70-references/source-alpha.md",
              captured_at: CREATED_AT,
            },
            {
              source_id: "source:alpha",
              source_type: "user_note",
              content_hash: HASH_C,
              path: "70-references/source-alpha-conflict.md",
              captured_at: CREATED_AT,
            },
          ],
        },
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      source_coverage: {
        conflicting_sources: true,
      },
      reasons: expect.arrayContaining(["conflicting_sources"]),
      warnings: expect.arrayContaining(["conflicting_sources_flagged"]),
      gateway_proposal_draft: null,
      write_attempted: false,
    });
  });

  it("rejects invalid input at the planning boundary", () => {
    expect(planLlmWikiGeneration({})).toMatchObject({
      accepted: false,
      proposal_id: null,
      page_plan: null,
      source_coverage: null,
      reasons: ["input_invalid"],
      write_attempted: false,
      governance: {
        text_generated: false,
        vault_mutated: false,
        llm_calls_made: false,
      },
    });
  });
});

describe("Phase 21 LLM Wiki generation planner governance tripwires", () => {
  it("contains no model, network, write, scheduler, watcher, or execution path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/llm-wiki-generation-planner.ts"),
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
