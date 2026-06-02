import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARIAN_DRY_RUN_PLANNER_VERSION,
  LIBRARIAN_PROMOTION_RECOMMENDATIONS,
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  planLibrarianIngestionDryRun,
} from "./index";
import type { VaultFrontmatter } from "./frontmatter";
import type { LibrarianIngestionEnvelope } from "./librarian-contract";
import type { LibrarianExistingMetadataEntry } from "./librarian-dry-run-planner";

const NOW = "2026-06-01T12:00:00.000Z";
const HASH = `sha256:${"f".repeat(64)}`;
const OTHER_HASH = `sha256:${"1".repeat(64)}`;

function frontmatter(
  overrides: Partial<VaultFrontmatter> = {},
): VaultFrontmatter {
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: "note:librarian.dry.run",
    title: "Librarian Dry Run",
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
      source_id: "source:librarian.dry.run",
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
    contract_version: "phase21.librarian-contract.v1",
    envelope_id: "librarian:dry.run",
    source: {
      source_type: "user_note",
      source_id: fm.provenance.source_id ?? "source:librarian.dry.run",
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
    body_ref: "body:librarian.dry.run",
    raw_body_included: false,
    received_at: NOW,
    ...overrides,
  };
}

function metadata(
  overrides: Partial<LibrarianExistingMetadataEntry> = {},
): LibrarianExistingMetadataEntry {
  return {
    note_id: "note:existing",
    title: "Existing Note",
    path: "10-wiki/concepts/existing-note.md",
    content_hash: OTHER_HASH,
    source_type: "user_note",
    source_id: "source:existing",
    note_type: "concept",
    ...overrides,
  };
}

describe("Phase 21 Librarian dry-run planner", () => {
  it("classifies candidate intake and keeps output metadata-only", () => {
    const plan = planLibrarianIngestionDryRun({
      envelope: envelope(),
    });

    expect(plan).toMatchObject({
      planner_version: LIBRARIAN_DRY_RUN_PLANNER_VERSION,
      accepted: true,
      classification: "candidate",
      target_route: {
        route_target: "wiki",
        target_folder: "10-wiki/concepts",
      },
      dedupe: {
        status: "no_match",
        embedding_execution_used: false,
        vector_lookup_used: false,
      },
      promotion: {
        recommendation: "promote_to_candidate",
        required_approval: false,
        gateway_proposal_recommended: false,
      },
      gateway_proposal_draft: null,
      write_attempted: false,
      vault_mutated: false,
    });
    expect(plan.reasons).toContain("gateway_proposal_not_applicable");
    expect(plan.warnings).toEqual([
      "dry_run_only_no_write_executed",
      "metadata_only_output",
    ]);
  });

  it("uses deterministic classification recommendations", () => {
    expect(LIBRARIAN_PROMOTION_RECOMMENDATIONS).toEqual([
      "stay_transient",
      "promote_to_candidate",
      "propose_durable_write",
      "reject",
    ]);

    const transient = planLibrarianIngestionDryRun({
      envelope: envelope({
        proposed_frontmatter: frontmatter({
          id: "note:librarian.agent.run",
          note_type: "agent_run",
          domain: "agent",
          status: "draft",
          provenance: {
            source_type: "agent",
            source_id: "agent-output:dry-run",
            source_url: null,
            content_hash: HASH,
          },
          agent: {
            created_by: "research-agent",
            run_id: "run:research.1",
            model_id: "local-model",
            promotion_status: "transient",
          },
        }),
        source: {
          source_type: "agent_output",
          source_id: "agent-output:dry-run",
          source_ref: "run:research.1",
          captured_at: NOW,
          provenance_source_type: "agent",
          content_hash: HASH,
        },
      }),
    });

    expect(transient).toMatchObject({
      classification: "transient",
      promotion: {
        recommendation: "stay_transient",
        gateway_proposal_recommended: false,
      },
    });
  });

  it("detects exact, source, and possible duplicates without embeddings", () => {
    expect(
      planLibrarianIngestionDryRun({
        envelope: envelope(),
        existing_metadata_index: [metadata({ content_hash: HASH })],
      }),
    ).toMatchObject({
      accepted: false,
      dedupe: {
        status: "exact_duplicate",
        duplicate_note_ids: ["note:existing"],
        embedding_execution_used: false,
        vector_lookup_used: false,
      },
      reasons: ["duplicate_exact_content", "gateway_proposal_not_applicable"],
      promotion: {
        recommendation: "reject",
      },
    });

    expect(
      planLibrarianIngestionDryRun({
        envelope: envelope(),
        existing_metadata_index: [
          metadata({
            content_hash: OTHER_HASH,
            source_id: "source:librarian.dry.run",
          }),
        ],
      }),
    ).toMatchObject({
      accepted: false,
      dedupe: {
        status: "source_duplicate",
      },
      reasons: ["duplicate_source", "gateway_proposal_not_applicable"],
    });

    expect(
      planLibrarianIngestionDryRun({
        envelope: envelope(),
        existing_metadata_index: [
          metadata({
            title: "Librarian Dry Run",
            path: "10-wiki/concepts/librarian-dry-run.md",
          }),
        ],
      }),
    ).toMatchObject({
      accepted: true,
      dedupe: {
        status: "possible_duplicate",
      },
      reasons: [
        "possible_duplicate_metadata",
        "gateway_proposal_not_applicable",
      ],
      warnings: [
        "dry_run_only_no_write_executed",
        "metadata_only_output",
        "duplicate_warning",
      ],
    });
  });

  it("rejects route preference mismatches", () => {
    const plan = planLibrarianIngestionDryRun({
      envelope: envelope(),
      route_preference: {
        route_target: "archive",
        target_folder: "90-archive",
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      target_route: {
        route_target: "wiki",
        target_folder: "10-wiki/concepts",
      },
      reasons: [
        "route_preference_mismatch",
        "gateway_proposal_not_applicable",
      ],
      promotion: {
        recommendation: "reject",
      },
      write_attempted: false,
    });
  });

  it("requires approval before durable promotion can proceed", () => {
    const plan = planLibrarianIngestionDryRun({
      envelope: envelope({
        proposed_frontmatter: frontmatter({
          status: "active",
        }),
      }),
    });

    expect(plan).toMatchObject({
      accepted: false,
      classification: "durable",
      target_route: {
        route_target: "inbox",
        target_folder: "01-inbox/pending-approval",
      },
      promotion: {
        recommendation: "reject",
        required_approval: true,
        approval_status: "pending",
        human_approval_required: true,
      },
    });
    expect(plan.reasons).toContain("librarian_contract_rejected");
  });

  it("requires human approval for agent-created durable notes", () => {
    const fm = frontmatter({
      status: "active",
      provenance: {
        source_type: "agent",
        source_id: "agent-output:durable",
        source_url: null,
        content_hash: HASH,
      },
      agent: {
        created_by: "research-agent",
        run_id: "run:research.2",
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

    const plan = planLibrarianIngestionDryRun({
      envelope: envelope({
        source: {
          source_type: "agent_output",
          source_id: "agent-output:durable",
          source_ref: "run:research.2",
          captured_at: NOW,
          provenance_source_type: "agent",
          content_hash: HASH,
        },
        proposed_frontmatter: fm,
      }),
    });

    expect(plan).toMatchObject({
      accepted: false,
      classification: "durable",
      reasons: [
        "librarian_contract_rejected",
        "gateway_proposal_not_applicable",
      ],
      promotion: {
        recommendation: "reject",
        required_approval: true,
        human_approval_required: true,
      },
    });
  });

  it("emits a gateway-compatible proposal draft only when explicitly supplied body is needed", () => {
    const fm = frontmatter({
      status: "active",
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "approved",
        approval_id: "approval:librarian.ready",
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
    const plan = planLibrarianIngestionDryRun({
      envelope: envelope({
        envelope_id: "librarian:durable.ready",
        proposed_frontmatter: fm,
      }),
      include_markdown_body_for_gateway_proposal: true,
      proposal_markdown_body: "Durable note body for gateway proposal.",
      proposing_agent_id: "librarian",
      proposing_agent_run_id: "run:librarian.1",
    });

    expect(plan).toMatchObject({
      accepted: true,
      classification: "durable",
      promotion: {
        recommendation: "propose_durable_write",
        required_approval: true,
        approval_status: "approved",
        gateway_proposal_recommended: true,
      },
      gateway_proposal_draft: {
        contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
        proposal_id: "proposal:librarian-durable-ready",
        target_path: "10-wiki/concepts/librarian-dry-run.md",
        markdown_body: "Durable note body for gateway proposal.",
        approval_status: "approved",
      },
      redaction_summary: {
        metadata_only: true,
        raw_body_included: false,
        markdown_body_included: true,
        markdown_body_included_only_in_gateway_proposal: true,
      },
      write_attempted: false,
      vault_mutated: false,
    });
    expect(plan.reasons).toContain("gateway_proposal_ready");
    expect(plan.warnings).toContain("proposal_draft_contains_markdown_body");
  });

  it("omits raw body from output when proposal draft is not explicitly enabled", () => {
    const secretBody = "do-not-echo-this-body";
    const plan = planLibrarianIngestionDryRun({
      envelope: envelope({
        proposed_frontmatter: frontmatter({
          status: "active",
          lifecycle: {
            durable: false,
            canonical: false,
            approval_status: "approved",
            approval_id: "approval:librarian.ready",
            review_after: null,
            supersedes: [],
            superseded_by: [],
          },
        }),
      }),
      proposal_markdown_body: secretBody,
    });

    expect(plan.gateway_proposal_draft).toBeNull();
    expect(JSON.stringify(plan)).not.toContain(secretBody);
    expect(plan).toMatchObject({
      accepted: false,
      reasons: ["proposal_body_required"],
      warnings: [
        "dry_run_only_no_write_executed",
        "metadata_only_output",
        "proposal_draft_omitted_without_body",
        "approval_required_before_durable_write",
      ],
    });
  });
});

describe("Phase 21 Librarian dry-run governance tripwires", () => {
  it("contains no write execution, scheduler, watcher, or network authority", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/librarian-dry-run-planner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /ensureVaultScaffold|writeVaultFileAtomically|memory\.note|src\/lib\/memory\/vault|src\\lib\\memory\\vault/,
    );
  });
});
