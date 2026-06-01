import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  VAULT_WRITE_PROPOSAL_STATES,
  VaultWriteProposalSchema,
  planVaultWriteProposalDryRun,
} from "./index";
import type { VaultFrontmatter } from "./frontmatter";
import type { VaultWriteProposal } from "./write-gateway";

const NOW = "2026-06-01T12:00:00.000Z";
const HASH = `sha256:${"b".repeat(64)}`;

function frontmatter(
  overrides: Partial<VaultFrontmatter> = {},
): VaultFrontmatter {
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: "note:gateway.example",
    title: "Gateway Example",
    note_type: "concept",
    domain: "wiki",
    status: "active",
    created_at: NOW,
    updated_at: NOW,
    tags: ["phase21"],
    sensitivity: "private",
    project: null,
    provenance: {
      source_type: "human",
      source_id: "source:gateway",
      source_url: null,
      content_hash: HASH,
    },
    agent: {
      created_by: null,
      run_id: null,
      model_id: null,
      promotion_status: "human_approved",
    },
    links: {
      related: [],
      sources: [],
      decisions: [],
    },
    lifecycle: {
      durable: true,
      canonical: true,
      approval_status: "approved",
      approval_id: "approval:gateway.ready",
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
    ...overrides,
  };
}

function proposal(
  overrides: Partial<VaultWriteProposal> = {},
): VaultWriteProposal {
  const fm = overrides.frontmatter ?? frontmatter();
  return {
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: "proposal:gateway.ready",
    note_type: fm.note_type,
    target_path: "10-wiki/concepts/gateway-example.md",
    frontmatter: fm,
    markdown_body: "Gateway proposal body.",
    provenance: fm.provenance,
    proposing_agent: {
      agent_id: "librarian",
      agent_kind: "librarian",
      run_id: "run:librarian.1",
    },
    approval_required: true,
    approval_status: fm.lifecycle.approval_status,
    approval_id: fm.lifecycle.approval_id,
    sensitivity: fm.sensitivity,
    content_hash: fm.provenance.content_hash ?? HASH,
    created_at: NOW,
    ...overrides,
  };
}

describe("Phase 21 Vault Write Gateway proposal contract", () => {
  it("models every required proposal lifecycle state", () => {
    expect(VAULT_WRITE_PROPOSAL_STATES).toEqual([
      "proposed",
      "rejected_by_policy",
      "awaiting_approval",
      "approved",
      "denied",
      "expired",
      "ready_to_write",
    ]);
  });

  it("accepts a typed proposal object with all required fields", () => {
    expect(VaultWriteProposalSchema.parse(proposal())).toMatchObject({
      proposal_id: "proposal:gateway.ready",
      note_type: "concept",
      target_path: "10-wiki/concepts/gateway-example.md",
      markdown_body: "Gateway proposal body.",
      approval_required: true,
      approval_status: "approved",
      sensitivity: "private",
      content_hash: HASH,
      created_at: NOW,
    });
  });
});

describe("Phase 21 Vault Write Gateway dry-run planner", () => {
  it("returns ready_to_write for an approved durable proposal without writing", () => {
    const plan = planVaultWriteProposalDryRun(proposal());

    expect(plan).toMatchObject({
      accepted: true,
      state: "ready_to_write",
      target_path: "10-wiki/concepts/gateway-example.md",
      route_folder: "10-wiki/concepts",
      reasons: ["accepted"],
      write_attempted: false,
      vault_mutated: false,
      required_approval_gate: {
        proposal_kind: "obsidian_write",
        approval_required: true,
        approval_status: "approved",
        approval_id: "approval:gateway.ready",
        lifecycle_stage: "APPROVED",
        execution_supported: false,
      },
      redaction_summary: {
        metadata_only: true,
        markdown_body_included: false,
        raw_body_retained: false,
        content_hash_included: true,
        provenance_included: true,
      },
    });
  });

  it("rejects schema-invalid proposals without exposing write authority", () => {
    const plan = planVaultWriteProposalDryRun({
      ...proposal(),
      frontmatter: {
        ...frontmatter(),
        note_type: "unknown",
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      target_path: null,
      route_folder: null,
      reasons: ["frontmatter_invalid"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects routing mismatches", () => {
    const plan = planVaultWriteProposalDryRun(
      proposal({
        target_path: "80-reviews/gateway-example.md",
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      route_folder: "10-wiki/concepts",
      reasons: ["target_path_routing_mismatch"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects empty markdown bodies", () => {
    const plan = planVaultWriteProposalDryRun(
      proposal({
        markdown_body: "   ",
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["markdown_body_empty"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects attempts to spoof approval requirements", () => {
    const plan = planVaultWriteProposalDryRun(
      proposal({
        approval_required: false,
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["approval_required_mismatch"],
      required_approval_gate: {
        approval_required: true,
        execution_supported: false,
      },
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects approval id mismatches", () => {
    const plan = planVaultWriteProposalDryRun(
      proposal({
        approval_id: "approval:gateway.other",
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["approval_id_mismatch"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects approved proposal status without an approval id", () => {
    const fm = frontmatter({
      id: "note:gateway.transient.approved",
      status: "draft",
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "not_required",
        approval_id: null,
        review_after: null,
        supersedes: [],
        superseded_by: [],
      },
    });
    const plan = planVaultWriteProposalDryRun(
      proposal({
        proposal_id: "proposal:gateway.approved-no-id",
        frontmatter: fm,
        approval_required: false,
        approval_status: "approved",
        approval_id: null,
        target_path: "10-wiki/concepts/gateway-transient-approved.md",
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["approval_id_mismatch"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("marks denied and expired proposals as not accepted", () => {
    expect(
      planVaultWriteProposalDryRun(
        proposal({
          approval_status: "denied",
        }),
      ),
    ).toMatchObject({
      accepted: false,
      state: "denied",
      reasons: ["approval_denied"],
      write_attempted: false,
      vault_mutated: false,
    });

    expect(
      planVaultWriteProposalDryRun(
        proposal({
          approval_status: "expired",
        }),
      ),
    ).toMatchObject({
      accepted: false,
      state: "expired",
      reasons: ["approval_expired"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects unsafe target paths before routing", () => {
    const plan = planVaultWriteProposalDryRun({
      ...proposal(),
      target_path: "..\\outside.md",
    });

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      target_path: null,
      route_folder: null,
      reasons: ["target_path_invalid"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("keeps raw markdown bodies out of dry-run output", () => {
    const plan = planVaultWriteProposalDryRun(
      proposal({
        markdown_body: "secret-token-123 should not leave the proposal.",
      }),
    );

    expect(JSON.stringify(plan)).not.toContain("secret-token-123");
    expect(plan.redaction_summary).toMatchObject({
      metadata_only: true,
      markdown_body_included: false,
      raw_body_retained: false,
      body_char_count: 47,
    });
  });

  it("keeps transient agent outputs away from durable write readiness", () => {
    const fm = frontmatter({
      id: "note:gateway.agent.run",
      note_type: "agent_run",
      domain: "agent",
      status: "draft",
      agent: {
        created_by: "research-agent",
        run_id: "run:research.1",
        model_id: "local-model",
        promotion_status: "transient",
      },
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "not_required",
        approval_id: null,
        review_after: null,
        supersedes: [],
        superseded_by: [],
      },
    });

    const plan = planVaultWriteProposalDryRun(
      proposal({
        proposal_id: "proposal:gateway.agent",
        note_type: "agent_run",
        target_path: "60-agents/research-agent/runs/agent-run.md",
        frontmatter: fm,
        provenance: fm.provenance,
        approval_required: false,
        approval_status: "not_required",
        approval_id: null,
      }),
    );

    expect(plan).toMatchObject({
      accepted: true,
      state: "proposed",
      route_folder: "60-agents/research-agent/runs",
      write_attempted: false,
      vault_mutated: false,
    });
    expect(plan.warnings).toContain("transient_output_not_durable");
  });

  it("rejects direct durable agent output without human approval", () => {
    const plan = planVaultWriteProposalDryRun({
      ...proposal(),
      frontmatter: {
        ...frontmatter(),
        provenance: {
          source_type: "agent",
          source_id: "agent-output:concept",
          source_url: null,
          content_hash: HASH,
        },
        agent: {
          created_by: "research-agent",
          run_id: "run:research.1",
          model_id: "local-model",
          promotion_status: "candidate",
        },
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["frontmatter_invalid"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects status-derived durable agent output without human approval", () => {
    const fm = frontmatter({
      id: "note:gateway.agent.status-durable",
      status: "active",
      lifecycle: {
        durable: false,
        canonical: false,
        approval_status: "approved",
        approval_id: "approval:gateway.ready",
        review_after: null,
        supersedes: [],
        superseded_by: [],
      },
      provenance: {
        source_type: "agent",
        source_id: "agent-output:status-durable",
        source_url: null,
        content_hash: HASH,
      },
      agent: {
        created_by: "research-agent",
        run_id: "run:research.2",
        model_id: "local-model",
        promotion_status: "candidate",
      },
    });
    const plan = planVaultWriteProposalDryRun(
      proposal({
        proposal_id: "proposal:gateway.status-durable-agent",
        frontmatter: fm,
        provenance: fm.provenance,
        target_path: "01-inbox/pending-approval/status-durable.md",
      }),
    );

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["durable_agent_note_requires_human_approval"],
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("rejects GitNexus proposals that do not carry a project", () => {
    const plan = planVaultWriteProposalDryRun({
      ...proposal(),
      note_type: "git_commit",
      target_path: "20-projects/jarvis/gitnexus/commits/commit.md",
      frontmatter: {
        ...frontmatter({
          note_type: "git_commit",
          domain: "project",
          project: null,
        }),
      },
    });

    expect(plan).toMatchObject({
      accepted: false,
      state: "rejected_by_policy",
      reasons: ["frontmatter_invalid"],
      write_attempted: false,
      vault_mutated: false,
    });
  });
});

describe("Phase 21 Vault Write Gateway governance tripwires", () => {
  it("contains no vault write, watcher, background, network, or execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/write-gateway.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /ensureVaultScaffold|writeVaultFileAtomically|memory\.note|src\/lib\/memory\/vault|src\\lib\\memory\\vault/,
    );
    expect(source).not.toMatch(/EXECUTION_PENDING|EXECUTED|execute\(|runTool/);
  });
});
