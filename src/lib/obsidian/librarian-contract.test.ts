import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARIAN_CLASSIFICATION_TRANSITIONS,
  LIBRARIAN_CLASSIFICATIONS,
  LIBRARIAN_CONTRACT_VERSION,
  LIBRARIAN_DEDUPLICATION_CONTRACT,
  LIBRARIAN_ROUTE_TARGETS,
  LIBRARIAN_SOURCE_TYPES,
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  LibrarianIngestionEnvelopeSchema,
  planLibrarianIngestion,
} from "./index";
import type { VaultFrontmatter } from "./frontmatter";
import type { LibrarianIngestionEnvelope } from "./librarian-contract";

const NOW = "2026-06-01T12:00:00.000Z";
const HASH = `sha256:${"d".repeat(64)}`;

function frontmatter(
  overrides: Partial<VaultFrontmatter> = {},
): VaultFrontmatter {
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: "note:librarian.example",
    title: "Librarian Example",
    note_type: "concept",
    domain: "wiki",
    status: "draft",
    created_at: NOW,
    updated_at: NOW,
    tags: ["phase21"],
    sensitivity: "private",
    project: null,
    provenance: {
      source_type: "human",
      source_id: "source:librarian",
      source_url: null,
      content_hash: HASH,
    },
    agent: {
      created_by: null,
      run_id: null,
      model_id: null,
      promotion_status: "candidate",
    },
    links: {
      related: [],
      sources: [],
      decisions: [],
    },
    lifecycle: {
      durable: false,
      canonical: false,
      approval_status: "pending",
      approval_id: null,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
    ...overrides,
  };
}

function envelope(
  overrides: Partial<LibrarianIngestionEnvelope> = {},
): LibrarianIngestionEnvelope {
  const fm = overrides.proposed_frontmatter ?? frontmatter();
  return {
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    envelope_id: "librarian:envelope.example",
    source: {
      source_type: "user_note",
      source_id: "source:librarian",
      source_ref: null,
      captured_at: NOW,
      provenance_source_type: fm.provenance.source_type,
      content_hash: fm.provenance.content_hash ?? HASH,
    },
    proposed_frontmatter: fm,
    declared_classification: "candidate",
    requested_route_target: null,
    requested_target_folder: null,
    content_hash: fm.provenance.content_hash ?? HASH,
    body_ref: "body:librarian.example",
    raw_body_included: false,
    received_at: NOW,
    ...overrides,
  };
}

describe("Phase 21 Librarian ingestion contract", () => {
  it("registers the supported future source types without enabling execution", () => {
    expect(LIBRARIAN_SOURCE_TYPES).toEqual([
      "user_note",
      "agent_output",
      "gitnexus",
      "llm_wiki",
      "knowledge_compounding",
      "imported_document",
      "external_research",
    ]);

    for (const sourceType of LIBRARIAN_SOURCE_TYPES) {
      expect(
        LibrarianIngestionEnvelopeSchema.safeParse(
          envelope({
            source: {
              ...envelope().source,
              source_type: sourceType,
            },
          }),
        ).success,
      ).toBe(true);
    }
  });

  it("rejects raw body inclusion at the envelope boundary", () => {
    expect(
      LibrarianIngestionEnvelopeSchema.safeParse({
        ...envelope(),
        raw_body_included: true,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 21 Librarian classification and promotion model", () => {
  it("defines the approved classification ladder and transition gates", () => {
    expect(LIBRARIAN_CLASSIFICATIONS).toEqual([
      "transient",
      "candidate",
      "durable",
      "canonical",
    ]);
    expect(LIBRARIAN_CLASSIFICATION_TRANSITIONS).toEqual([
      {
        from: "transient",
        to: "candidate",
        requires_approval: false,
        requires_provenance: true,
        requires_content_hash: true,
      },
      {
        from: "candidate",
        to: "durable",
        requires_approval: true,
        requires_provenance: true,
        requires_content_hash: true,
      },
      {
        from: "durable",
        to: "canonical",
        requires_approval: true,
        requires_provenance: true,
        requires_content_hash: true,
      },
    ]);
  });

  it("accepts candidate intake without granting durable promotion", () => {
    const decision = planLibrarianIngestion(envelope());

    expect(decision).toMatchObject({
      accepted: true,
      classification: "candidate",
      route_target: "wiki",
      target_folder: "10-wiki/concepts",
      reasons: ["accepted"],
      promotion: {
        classification: "candidate",
        approval_required: false,
        human_approval_required: false,
        promotion_allowed: true,
      },
      governance: {
        write_authority: false,
        execution_authority: false,
        scheduler_authority: false,
        vault_mutated: false,
      },
    });
  });

  it("requires approval before status-durable content can be promoted", () => {
    const decision = planLibrarianIngestion(
      envelope({
        proposed_frontmatter: frontmatter({
          status: "active",
        }),
      }),
    );

    expect(decision).toMatchObject({
      accepted: false,
      classification: "durable",
      route_target: "inbox",
      target_folder: "01-inbox/pending-approval",
      reasons: ["durable_promotion_requires_approval"],
      promotion: {
        approval_required: true,
        approval_status: "pending",
        human_approval_required: true,
        promotion_allowed: false,
      },
    });
  });

  it("requires human approval before durable agent output can be promoted", () => {
    const fm = frontmatter({
      status: "active",
      provenance: {
        source_type: "agent",
        source_id: "agent-output:librarian",
        source_url: null,
        content_hash: HASH,
      },
      agent: {
        created_by: "research-agent",
        run_id: "run:research.1",
        model_id: "local-model",
        promotion_status: "candidate",
      },
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "approved",
        approval_id: "approval:librarian.agent",
        review_after: null,
        supersedes: [],
        superseded_by: [],
      },
    });

    const decision = planLibrarianIngestion(
      envelope({
        source: {
          source_type: "agent_output",
          source_id: "agent-output:librarian",
          source_ref: "run:research.1",
          captured_at: NOW,
          provenance_source_type: "agent",
          content_hash: HASH,
        },
        proposed_frontmatter: fm,
      }),
    );

    expect(decision).toMatchObject({
      accepted: false,
      classification: "durable",
      reasons: ["durable_agent_promotion_requires_human_approval"],
      promotion: {
        approval_required: true,
        approval_status: "approved",
        human_approval_required: true,
        promotion_allowed: false,
      },
    });
  });

  it("recognizes approved durable human content as promotable metadata", () => {
    const fm = frontmatter({
      status: "active",
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "approved",
        approval_id: "approval:librarian.durable",
        review_after: null,
        supersedes: [],
        superseded_by: [],
      },
      agent: {
        created_by: null,
        run_id: null,
        model_id: null,
        promotion_status: "human_approved",
      },
    });

    expect(planLibrarianIngestion(envelope({ proposed_frontmatter: fm })))
      .toMatchObject({
        accepted: true,
        classification: "durable",
        reasons: ["accepted"],
        promotion: {
          may_become_durable: true,
          approval_required: true,
          approval_status: "approved",
          promotion_allowed: true,
        },
      });
  });
});

describe("Phase 21 Librarian routing and deduplication model", () => {
  it("keeps the required routing targets available to the contract", () => {
    expect(LIBRARIAN_ROUTE_TARGETS).toEqual([
      "inbox",
      "wiki",
      "project",
      "research",
      "learning",
      "career",
      "agent",
      "reference",
      "review",
      "archive",
      "meta",
    ]);
  });

  it.each([
    [
      "project",
      frontmatter({ domain: "project", project: "jarvis" }),
      "20-projects/jarvis",
    ],
    ["research", frontmatter({ domain: "research" }), "30-research"],
    ["career", frontmatter({ domain: "career" }), "50-career"],
    ["archive", frontmatter({ domain: "archive" }), "90-archive"],
  ] as const)("routes %s metadata through existing taxonomy", (_, fm, folder) => {
    expect(
      planLibrarianIngestion(envelope({ proposed_frontmatter: fm })),
    ).toMatchObject({
      accepted: true,
      target_folder: folder,
      governance: {
        routing_bypass_allowed: false,
      },
    });
  });

  it("rejects requested target folders that bypass taxonomy routing", () => {
    const decision = planLibrarianIngestion(
      envelope({
        requested_target_folder: "90-archive",
      }),
    );

    expect(decision).toMatchObject({
      accepted: false,
      target_folder: "10-wiki/concepts",
      reasons: ["routing_bypass_rejected"],
      governance: {
        routing_bypass_allowed: false,
      },
    });
  });

  it("models deduplication as hash-first with no embedding execution", () => {
    const decision = planLibrarianIngestion(envelope());

    expect(LIBRARIAN_DEDUPLICATION_CONTRACT).toMatchObject({
      content_hash_algorithm: "sha256",
      near_duplicate_strategy: "metadata_similarity_contract_only",
      embedding_execution_supported: false,
      vector_lookup_supported: false,
    });
    expect(decision.deduplication).toMatchObject({
      content_hash: HASH,
      exact_duplicate_keys: [
        "content_hash",
        "source.source_type",
        "source.source_id",
        "proposed_frontmatter.id",
      ],
      near_duplicate_strategy: "metadata_similarity_contract_only",
      embedding_execution_supported: false,
      vector_lookup_supported: false,
    });
  });

  it("requires provenance and matching content hashes for durable traceability", () => {
    const decision = planLibrarianIngestion(
      envelope({
        content_hash: `sha256:${"e".repeat(64)}`,
      }),
    );

    expect(decision).toMatchObject({
      accepted: false,
      reasons: ["content_hash_mismatch"],
    });
  });
});

describe("Phase 21 Librarian governance tripwires", () => {
  it("contains no vault write authority, execution imports, scheduler, or network path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/librarian-contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-gateway|write-execution|planVaultWriteProposalDryRun|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /ensureVaultScaffold|writeVaultFileAtomically|memory\.note|src\/lib\/memory\/vault|src\\lib\\memory\\vault/,
    );
  });
});
