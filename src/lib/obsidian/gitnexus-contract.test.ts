import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GITNEXUS_ARTIFACT_TYPES,
  GITNEXUS_AUTHORITY_CONTRACT,
  GITNEXUS_CONTRACT_VERSION,
  GitNexusArtifactSchema,
  GitNexusSourceContractSchema,
  createGitNexusLibrarianEnvelope,
  planLibrarianIngestion,
  routeGitNexusArtifact,
} from "./index";
import type { GitNexusArtifact } from "./gitnexus-contract";

const NOW = "2026-06-02T10:00:00.000Z";
const HASH = `sha256:${"9".repeat(64)}`;
const SHA = "abcdef1234567890abcdef1234567890abcdef12";

function artifact(
  overrides: Partial<GitNexusArtifact> = {},
): GitNexusArtifact {
  const base: GitNexusArtifact = {
    contract_version: GITNEXUS_CONTRACT_VERSION,
    artifact_id: "gitnexus:jarvis.repo.graph",
    artifact_type: "repo_graph",
    source: {
      contract_version: GITNEXUS_CONTRACT_VERSION,
      repo: {
        project: "jarvis",
        repo_full_name: "prince/jarvis",
        repo_remote_url: "https://github.com/prince/jarvis",
        default_branch: "main",
      },
      analyzed_commit_sha: SHA,
      generated_graph_id: "gitnexus:graph.jarvis",
      generated_wiki_id: "gitnexus:wiki.jarvis",
      generated_at: NOW,
      source_tool: {
        name: "GitNexus",
        version: "contract-only",
        source_url: "https://github.com/abhigyanpatwari/GitNexus",
      },
    },
    title: "Jarvis Repository Graph",
    content_hash: HASH,
    sensitivity: "private",
    durable_requested: false,
    canonical_requested: false,
    approval_status: "pending",
    approval_id: null,
    raw_diff_included: false,
    full_log_included: false,
    raw_payload_included: false,
  };
  return { ...base, ...overrides };
}

describe("Phase 21 GitNexus source contract", () => {
  it("captures repo identity, analyzed commit, generated ids, timestamp, and source tool", () => {
    expect(GitNexusSourceContractSchema.parse(artifact().source)).toMatchObject({
      repo: {
        project: "jarvis",
        repo_full_name: "prince/jarvis",
        default_branch: "main",
      },
      analyzed_commit_sha: SHA,
      generated_graph_id: "gitnexus:graph.jarvis",
      generated_wiki_id: "gitnexus:wiki.jarvis",
      generated_at: NOW,
      source_tool: {
        name: "GitNexus",
        version: "contract-only",
        source_url: "https://github.com/abhigyanpatwari/GitNexus",
      },
    });
  });

  it("supports the approved GitNexus artifact types", () => {
    expect(GITNEXUS_ARTIFACT_TYPES).toEqual([
      "repo_graph",
      "dependency_cluster",
      "call_chain",
      "execution_flow",
      "code_wiki_page",
      "blast_radius_report",
      "stale_index_report",
    ]);

    for (const artifactType of GITNEXUS_ARTIFACT_TYPES) {
      expect(
        GitNexusArtifactSchema.safeParse(
          artifact({ artifact_type: artifactType }),
        ).success,
      ).toBe(true);
    }
  });

  it("does not require or retain raw diffs, full logs, or raw payloads", () => {
    expect(GitNexusArtifactSchema.parse(artifact())).toMatchObject({
      raw_diff_included: false,
      full_log_included: false,
      raw_payload_included: false,
    });

    expect(
      GitNexusArtifactSchema.safeParse({
        ...artifact(),
        raw_diff_included: true,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 21 GitNexus routing and Librarian integration", () => {
  it.each([
    ["repo_graph", "graphs"],
    ["dependency_cluster", "graphs"],
    ["call_chain", "graphs"],
    ["execution_flow", "graphs"],
    ["code_wiki_page", "wiki"],
    ["blast_radius_report", "blast-radius"],
    ["stale_index_report", "stale-index"],
  ] as const)("routes %s under project gitnexus/%s", (artifactType, folder) => {
    expect(routeGitNexusArtifact(artifact({ artifact_type: artifactType })))
      .toMatchObject({
        artifact_type: artifactType,
        project: "jarvis",
        folder: `20-projects/jarvis/gitnexus/${folder}`,
        requires_librarian_routing: true,
        write_attempted: false,
        repo_mutated: false,
        vault_mutated: false,
      });
  });

  it("converts GitNexus outputs into gitnexus Librarian envelopes", () => {
    const envelope = createGitNexusLibrarianEnvelope(artifact());

    expect(envelope).toMatchObject({
      source: {
        source_type: "gitnexus",
        source_id: "gitnexus:jarvis.repo.graph",
        source_ref: SHA,
        provenance_source_type: "git",
        content_hash: HASH,
      },
      requested_route_target: "project",
      requested_target_folder: "20-projects/jarvis/gitnexus/graphs",
      raw_body_included: false,
      proposed_frontmatter: {
        note_type: "repo_graph",
        domain: "project",
        project: "jarvis",
        provenance: {
          source_type: "git",
          content_hash: HASH,
        },
      },
    });

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "gitnexus",
      classification: "candidate",
      route_target: "project",
      target_folder: "20-projects/jarvis/gitnexus/graphs",
    });
  });

  it("requires approval before durable GitNexus output can promote", () => {
    const envelope = createGitNexusLibrarianEnvelope(
      artifact({
        durable_requested: true,
        approval_status: "pending",
      }),
    );

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: false,
      source_type: "gitnexus",
      classification: "durable",
      target_folder: "20-projects/jarvis/gitnexus/graphs",
      reasons: ["durable_agent_promotion_requires_human_approval"],
      promotion: {
        approval_required: true,
        approval_status: "pending",
        human_approval_required: true,
        promotion_allowed: false,
      },
    });
  });

  it("allows approved durable GitNexus metadata through Librarian but not as authority", () => {
    const envelope = createGitNexusLibrarianEnvelope(
      artifact({
        durable_requested: true,
        approval_status: "approved",
        approval_id: "approval:gitnexus.ready",
      }),
    );

    expect(planLibrarianIngestion(envelope)).toMatchObject({
      accepted: true,
      source_type: "gitnexus",
      classification: "durable",
      target_folder: "20-projects/jarvis/gitnexus/graphs",
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

describe("Phase 21 GitNexus governance tripwires", () => {
  it("documents GitNexus as source-only, not governance truth", () => {
    expect(GITNEXUS_AUTHORITY_CONTRACT).toMatchObject({
      source_only: true,
      governance_truth: false,
      write_authority: false,
      execution_authority: false,
      repo_mutation_allowed: false,
      vault_mutation_allowed: false,
      requires_librarian_routing: true,
      raw_diffs_required: false,
      full_logs_required: false,
    });
  });

  it("contains no install, MCP config, write, execution, scheduler, or network path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/gitnexus-contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /executeApprovedVaultWriteProposal|renderVaultMarkdown|gitnexus setup|npx gitnexus|mcpServers|auto-reindex/i,
    );
    expect(source).not.toMatch(
      /raw_diff:|raw_log:|full_diff|full_log_body|governance_truth:\s*true/,
    );
  });
});
