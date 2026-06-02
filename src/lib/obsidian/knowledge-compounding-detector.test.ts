import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION,
  KnowledgeCompoundingDetectorInputSchema,
  createKnowledgeCompoundingLibrarianEnvelope,
  detectKnowledgeCompoundingCandidatesFromSnapshots,
  planLibrarianIngestion,
} from "./index";
import type {
  KnowledgeCompoundingDetectorInput,
  KnowledgeCompoundingWikiPageSnapshot,
} from "./knowledge-compounding-detector";

const DETECTED_AT = "2026-06-02T15:00:00.000Z";
const OLD = "2025-10-01T15:00:00.000Z";
const RECENT = "2026-05-15T15:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;

function page(
  overrides: Partial<KnowledgeCompoundingWikiPageSnapshot> = {},
): KnowledgeCompoundingWikiPageSnapshot {
  return {
    page_id: "llm-wiki:concept.alpha",
    page_type: "concept_page",
    title: "Alpha Concept",
    path: "10-wiki/concepts/alpha-concept.md",
    references_count: 2,
    backlinks: [],
    page_word_count: 180,
    source_ids: ["source:alpha"],
    source_hashes: [HASH_A],
    updated_at: OLD,
    hub_id: null,
    related_page_ids: [],
    ...overrides,
  };
}

function detectorInput(
  overrides: Partial<KnowledgeCompoundingDetectorInput> = {},
): KnowledgeCompoundingDetectorInput {
  return {
    wiki_metadata_snapshot: {
      detected_at: DETECTED_AT,
      pages: [
        page({
          page_id: "llm-wiki:hub.sparse",
          page_type: "hub_page",
          title: "Sparse Hub",
          path: "10-wiki/hubs/sparse-hub.md",
          references_count: 1,
          backlinks: ["llm-wiki:concept.alpha"],
          page_word_count: 90,
          source_ids: ["source:hub"],
          source_hashes: [HASH_B],
          updated_at: RECENT,
          hub_id: null,
          related_page_ids: [],
        }),
        page({
          page_id: "llm-wiki:concept.alpha",
          page_type: "concept_page",
          title: "Alpha Concept",
          path: "10-wiki/concepts/alpha-concept.md",
          references_count: 2,
          backlinks: [],
          page_word_count: 180,
          source_ids: ["source:alpha"],
          source_hashes: [HASH_A],
          updated_at: OLD,
          hub_id: null,
          related_page_ids: [
            "llm-wiki:concept.alpha-part-2",
            "llm-wiki:concept.alpha-part-3",
            "llm-wiki:concept.alpha-part-4",
          ],
        }),
        page({
          page_id: "llm-wiki:concept.alpha.duplicate",
          page_type: "concept_page",
          title: "Alpha Concept",
          path: "10-wiki/concepts/alpha-concept-copy.md",
          references_count: 0,
          backlinks: ["llm-wiki:hub.sparse"],
          page_word_count: 260,
          source_ids: ["source:duplicate"],
          source_hashes: [HASH_C],
          updated_at: RECENT,
          hub_id: "llm-wiki:hub.sparse",
          related_page_ids: [],
        }),
        page({
          page_id: "llm-wiki:system.jarvis",
          page_type: "system_page",
          title: "JARVIS System",
          path: "10-wiki/systems/jarvis-system.md",
          references_count: 3,
          backlinks: ["llm-wiki:concept.alpha"],
          page_word_count: 420,
          source_ids: ["source:system"],
          source_hashes: [HASH_B],
          updated_at: RECENT,
          hub_id: "llm-wiki:hub.sparse",
          related_page_ids: [],
        }),
      ],
    },
    librarian_metadata_snapshot: {
      pending_approval_page_ids: [],
      rejected_page_ids: [],
      durable_page_ids: [],
      canonical_page_ids: [],
    },
    source_metadata_snapshot: {
      sources: [
        {
          source_id: "source:alpha",
          source_type: "user_note",
          content_hash: HASH_A,
          referenced_by_page_ids: ["llm-wiki:concept.alpha"],
          captured_at: RECENT,
        },
        {
          source_id: "source:hub",
          source_type: "user_note",
          content_hash: HASH_B,
          referenced_by_page_ids: ["llm-wiki:hub.sparse"],
          captured_at: RECENT,
        },
      ],
    },
    generate_proposals: true,
    durable_proposals: true,
    ...overrides,
  };
}

describe("Phase 21 Knowledge Compounding dry-run detector", () => {
  it("detects all approved candidate types from metadata snapshots", () => {
    const result = detectKnowledgeCompoundingCandidatesFromSnapshots(
      detectorInput(),
    );

    expect(result).toMatchObject({
      detector_version: KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION,
      accepted: true,
      reasons: ["proposals_generated"],
      governance: {
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
    });

    expect(new Set(result.candidates.map((candidate) => candidate.candidate_type)))
      .toEqual(
        new Set([
          "missing_hub",
          "sparse_hub",
          "fragmented_concept",
          "missing_backlinks",
          "weak_source_coverage",
          "duplicate_concept",
          "stale_wiki_page",
          "underlinked_system",
        ]),
      );
  });

  it("attaches evidence with rationale, pages, sources, metrics, confidence, and action", () => {
    const result = detectKnowledgeCompoundingCandidatesFromSnapshots(
      detectorInput(),
    );
    const evidence = result.evidence.find(
      (entry) => entry.candidate_type === "fragmented_concept",
    );

    expect(evidence).toMatchObject({
      candidate_type: "fragmented_concept",
      why_detected:
        "Concept has multiple related pages and may need consolidation.",
      supporting_pages: [
        "llm-wiki:concept.alpha",
        "llm-wiki:concept.alpha-part-2",
        "llm-wiki:concept.alpha-part-3",
        "llm-wiki:concept.alpha-part-4",
      ],
      supporting_sources: ["source:alpha"],
      metrics: {
        references_count: 2,
        backlinks_count: 0,
        page_word_count: 180,
        source_count: 1,
        duplicate_title_count: 1,
        related_page_count: 3,
      },
      proposed_action: "merge_pages",
      write_attempted: false,
    });
    expect(evidence?.confidence).toBeGreaterThan(0);
  });

  it("generates KnowledgeCompoundingProposal drafts without execution", () => {
    const result = detectKnowledgeCompoundingCandidatesFromSnapshots(
      detectorInput(),
    );
    const proposal = result.proposals.find(
      (entry) => entry.candidate_type === "missing_hub",
    );

    expect(proposal).toMatchObject({
      proposal_id: expect.stringMatching(
        /^proposal:knowledge-compounding\.kc-missing-hub-/,
      ),
      candidate_type: "missing_hub",
      affected_pages: ["llm-wiki:concept.alpha"],
      supporting_sources: ["source:alpha"],
      source_hashes: [HASH_A],
      proposed_action: "create_hub",
      approval_required: true,
      approval_status: "pending",
      durable_candidate: true,
      write_attempted: false,
      execution_supported: false,
    });
  });

  it("can skip proposal generation while preserving candidate evidence", () => {
    const result = detectKnowledgeCompoundingCandidatesFromSnapshots(
      detectorInput({
        generate_proposals: false,
      }),
    );

    expect(result).toMatchObject({
      accepted: true,
      proposals: [],
      reasons: ["proposal_generation_skipped"],
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBe(result.candidates.length);
  });

  it("routes generated proposals through Librarian without write authority", () => {
    const result = detectKnowledgeCompoundingCandidatesFromSnapshots(
      detectorInput({
        durable_proposals: false,
      }),
    );
    const envelope = createKnowledgeCompoundingLibrarianEnvelope(
      result.proposals[0],
    );

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "knowledge_compounding",
      classification: "candidate",
      governance: {
        write_authority: false,
        execution_authority: false,
        scheduler_authority: false,
      },
    });
  });

  it("rejects invalid snapshots at the schema boundary", () => {
    expect(
      KnowledgeCompoundingDetectorInputSchema.safeParse({
        wiki_metadata_snapshot: {
          detected_at: DETECTED_AT,
          pages: [
            {
              ...page(),
              page_word_count: -1,
            },
          ],
        },
      }).success,
    ).toBe(false);

    expect(detectKnowledgeCompoundingCandidatesFromSnapshots({}))
      .toMatchObject({
        accepted: false,
        candidates: [],
        evidence: [],
        proposals: [],
        reasons: ["snapshot_invalid"],
        governance: {
          write_attempted: false,
          vault_mutated: false,
          llm_calls_made: false,
        },
      });
  });
});

describe("Phase 21 Knowledge Compounding detector governance tripwires", () => {
  it("contains no model, network, write, scheduler, watcher, or execution path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/knowledge-compounding-detector.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-gateway|write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /from ["'](?:openai|@anthropic|ollama|deepseek)|new OpenAI|chat\.completions|responses\.create|generateText|runAgent|autonomousAgent/i,
    );
  });
});
