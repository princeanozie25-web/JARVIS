import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_COMPOUNDING_CANDIDATE_TYPES,
  KNOWLEDGE_COMPOUNDING_DETECTION_INPUTS,
  KNOWLEDGE_COMPOUNDING_GOVERNANCE_CONTRACT,
  KNOWLEDGE_COMPOUNDING_PROPOSED_ACTIONS,
  createKnowledgeCompoundingLibrarianEnvelope,
  createKnowledgeCompoundingProposal,
  detectKnowledgeCompoundingCandidates,
  planLibrarianIngestion,
} from "./index";
import type { KnowledgeCompoundingDetectionInput } from "./knowledge-compounding-contract";

const NOW = "2026-06-02T14:00:00.000Z";
const HASH = `sha256:${"6".repeat(64)}`;

function detectionInput(
  overrides: Partial<KnowledgeCompoundingDetectionInput> = {},
): KnowledgeCompoundingDetectionInput {
  return {
    page_id: "llm-wiki:system.jarvis",
    page_type: "system_page",
    title: "JARVIS System",
    path: "10-wiki/systems/jarvis-system.md",
    references_count: 3,
    backlinks_count: 0,
    page_word_count: 120,
    source_count: 1,
    update_age_days: 200,
    duplicate_title_count: 0,
    hub_exists: false,
    related_page_count: 4,
    source_ids: ["source:jarvis.system"],
    source_hashes: [HASH],
    ...overrides,
  };
}

describe("Phase 21 Knowledge Compounding candidate and detection contracts", () => {
  it("defines the approved candidate types and detection metadata inputs", () => {
    expect(KNOWLEDGE_COMPOUNDING_CANDIDATE_TYPES).toEqual([
      "missing_hub",
      "sparse_hub",
      "fragmented_concept",
      "missing_backlinks",
      "weak_source_coverage",
      "duplicate_concept",
      "stale_wiki_page",
      "underlinked_system",
    ]);
    expect(KNOWLEDGE_COMPOUNDING_DETECTION_INPUTS).toEqual([
      "references_count",
      "backlinks_count",
      "page_word_count",
      "source_count",
      "update_age_days",
      "duplicate_title_count",
      "hub_exists",
      "related_page_count",
    ]);
  });

  it("detects metadata-only compounding candidates without execution", () => {
    expect(detectKnowledgeCompoundingCandidates([detectionInput()]))
      .toEqual([
        expect.objectContaining({
          candidate_type: "missing_hub",
          proposed_action: "create_hub",
          affected_pages: ["llm-wiki:system.jarvis"],
          supporting_sources: ["source:jarvis.system"],
          source_hashes: [HASH],
          write_attempted: false,
        }),
        expect.objectContaining({
          candidate_type: "missing_backlinks",
          proposed_action: "create_backlinks",
        }),
        expect.objectContaining({
          candidate_type: "weak_source_coverage",
          proposed_action: "refresh_stale_page",
        }),
        expect.objectContaining({
          candidate_type: "stale_wiki_page",
          proposed_action: "refresh_stale_page",
        }),
        expect.objectContaining({
          candidate_type: "underlinked_system",
          proposed_action: "create_backlinks",
        }),
      ]);
  });

  it("supports all approved LLM Wiki improvement actions as proposals only", () => {
    expect(KNOWLEDGE_COMPOUNDING_PROPOSED_ACTIONS).toEqual([
      "create_hub",
      "update_hub",
      "merge_pages",
      "create_backlinks",
      "refresh_stale_page",
    ]);
  });
});

describe("Phase 21 Knowledge Compounding proposal and integration contracts", () => {
  it("creates proposal objects with confidence, rationale, sources, and approval requirements", () => {
    const candidate = detectKnowledgeCompoundingCandidates([
      detectionInput({
        duplicate_title_count: 1,
      }),
    ]).find((entry) => entry.candidate_type === "duplicate_concept");

    const proposal = createKnowledgeCompoundingProposal({
      candidate,
      proposal_id: "proposal:knowledge-compounding.merge",
      created_at: NOW,
      durable_candidate: true,
    });

    expect(proposal).toMatchObject({
      proposal_id: "proposal:knowledge-compounding.merge",
      candidate_type: "duplicate_concept",
      affected_pages: ["llm-wiki:system.jarvis"],
      supporting_sources: ["source:jarvis.system"],
      source_hashes: [HASH],
      proposed_action: "merge_pages",
      approval_required: true,
      approval_status: "pending",
      durable_candidate: true,
      write_attempted: false,
      execution_supported: false,
    });
    expect(proposal.confidence).toBeGreaterThan(0);
    expect(proposal.rationale).toContain("metadata-only");
  });

  it("routes compounding proposals into Librarian as knowledge_compounding source envelopes", () => {
    const candidate = detectKnowledgeCompoundingCandidates([
      detectionInput(),
    ])[0];
    const proposal = createKnowledgeCompoundingProposal({
      candidate,
      proposal_id: "proposal:knowledge-compounding.missing-hub",
      created_at: NOW,
      durable_candidate: false,
    });
    const envelope = createKnowledgeCompoundingLibrarianEnvelope(proposal);

    expect(envelope).toMatchObject({
      source: {
        source_type: "knowledge_compounding",
        source_id: "proposal:knowledge-compounding.missing-hub",
        source_ref: "llm-wiki:system.jarvis",
        provenance_source_type: "system",
        content_hash: HASH,
      },
      declared_classification: "candidate",
      requested_route_target: "wiki",
      requested_target_folder: "10-wiki/decisions",
      raw_body_included: false,
      proposed_frontmatter: {
        note_type: "decision",
        domain: "wiki",
        tags: ["knowledge-compounding", "missing_hub"],
      },
    });

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "knowledge_compounding",
      classification: "candidate",
      target_folder: "10-wiki/decisions",
      governance: {
        write_authority: false,
        execution_authority: false,
      },
    });
  });

  it("requires approval for durable compounding proposals", () => {
    const candidate = detectKnowledgeCompoundingCandidates([
      detectionInput(),
    ])[0];
    const proposal = createKnowledgeCompoundingProposal({
      candidate,
      proposal_id: "proposal:knowledge-compounding.durable",
      created_at: NOW,
      durable_candidate: true,
      approval_status: "pending",
    });
    const envelope = createKnowledgeCompoundingLibrarianEnvelope(proposal);

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: false,
      source_type: "knowledge_compounding",
      classification: "durable",
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

  it("allows approved durable proposal metadata without granting execution", () => {
    const candidate = detectKnowledgeCompoundingCandidates([
      detectionInput(),
    ])[0];
    const proposal = createKnowledgeCompoundingProposal({
      candidate,
      proposal_id: "proposal:knowledge-compounding.approved",
      created_at: NOW,
      durable_candidate: true,
      approval_status: "approved",
      approval_id: "approval:knowledge-compounding.ready",
    });

    expect(planLibrarianIngestion(
      createKnowledgeCompoundingLibrarianEnvelope(proposal),
    )).toMatchObject({
      accepted: true,
      source_type: "knowledge_compounding",
      classification: "durable",
      target_folder: "10-wiki/decisions",
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

describe("Phase 21 Knowledge Compounding governance tripwires", () => {
  it("keeps compounding proposal-only with no write, execution, scheduler, network, or LLM authority", () => {
    expect(KNOWLEDGE_COMPOUNDING_GOVERNANCE_CONTRACT).toMatchObject({
      proposal_only: true,
      write_authority: false,
      execution_authority: false,
      approval_authority: false,
      scheduler_supported: false,
      watcher_supported: false,
      background_jobs_supported: false,
      network_supported: false,
      llm_calls_supported: false,
      obsidian_mutation_supported: false,
      bypass_librarian_supported: false,
      bypass_vault_write_gateway_supported: false,
      wiki_page_generation_supported: false,
    });

    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/knowledge-compounding-contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-gateway|write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /openai|anthropic|chat\.completions|responses\.create|generateText|runAgent|autonomous/i,
    );
  });
});
