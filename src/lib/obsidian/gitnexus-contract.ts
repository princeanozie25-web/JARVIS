import { z } from "zod";
import { ApprovalIdSchema } from "../approval-runtime/types";
import {
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VaultSensitivitySchema,
  type VaultFrontmatter,
} from "./frontmatter";
import {
  LIBRARIAN_CONTRACT_VERSION,
  LibrarianIngestionEnvelopeSchema,
  type LibrarianIngestionEnvelope,
} from "./librarian-contract";
import { routeVaultNote, slugPathSegment } from "./routing";
import {
  VAULT_GITNEXUS_ARTIFACT_TYPES,
  VAULT_GITNEXUS_ROUTE_SUBFOLDERS,
  type VaultGitNexusArtifactType,
} from "./taxonomy";

export const GITNEXUS_CONTRACT_VERSION =
  "phase21.gitnexus-contract.v1" as const;

export const GITNEXUS_ARTIFACT_TYPES = VAULT_GITNEXUS_ARTIFACT_TYPES;

export const GITNEXUS_AUTHORITY_CONTRACT = {
  source_only: true,
  governance_truth: false,
  write_authority: false,
  execution_authority: false,
  repo_mutation_allowed: false,
  vault_mutation_allowed: false,
  mcp_configuration_supported: false,
  auto_reindexing_supported: false,
  graphify_implemented: false,
  build_monitor_implemented: false,
  requires_librarian_routing: true,
  raw_diffs_required: false,
  full_logs_required: false,
} as const;

const GitShaSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{7,64}$/);

const GitNexusIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const GitNexusArtifactTypeSchema = z.enum(GITNEXUS_ARTIFACT_TYPES);

export const GitNexusRepoIdentitySchema = z.strictObject({
  project: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  repo_full_name: z.string().trim().min(1).max(240),
  repo_remote_url: z.string().trim().min(1).nullable().default(null),
  default_branch: z.string().trim().min(1).nullable().default(null),
});

export const GitNexusSourceToolSchema = z.strictObject({
  name: z.literal("GitNexus"),
  version: z.string().trim().min(1),
  source_url: z
    .literal("https://github.com/abhigyanpatwari/GitNexus")
    .default("https://github.com/abhigyanpatwari/GitNexus"),
});

export const GitNexusSourceContractSchema = z.strictObject({
  contract_version: z.literal(GITNEXUS_CONTRACT_VERSION),
  repo: GitNexusRepoIdentitySchema,
  analyzed_commit_sha: GitShaSchema,
  generated_graph_id: GitNexusIdSchema.nullable(),
  generated_wiki_id: GitNexusIdSchema.nullable(),
  generated_at: z.string().trim().datetime({ offset: true }),
  source_tool: GitNexusSourceToolSchema,
});

export const GitNexusArtifactSchema = z.strictObject({
  contract_version: z.literal(GITNEXUS_CONTRACT_VERSION),
  artifact_id: GitNexusIdSchema,
  artifact_type: GitNexusArtifactTypeSchema,
  source: GitNexusSourceContractSchema,
  title: z.string().trim().min(1).max(200),
  content_hash: ContentHashSchema,
  sensitivity: VaultSensitivitySchema.default("private"),
  durable_requested: z.boolean().default(false),
  canonical_requested: z.boolean().default(false),
  approval_status: z
    .enum(["not_required", "pending", "approved", "denied", "expired"])
    .default("pending"),
  approval_id: ApprovalIdSchema.nullable().default(null),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  raw_payload_included: z.literal(false),
});

export const GitNexusRouteDecisionSchema = z.strictObject({
  artifact_type: GitNexusArtifactTypeSchema,
  project: z.string().trim().min(1),
  folder: z.string().trim().min(1),
  requires_librarian_routing: z.literal(true),
  write_attempted: z.literal(false),
  repo_mutated: z.literal(false),
  vault_mutated: z.literal(false),
});

export type GitNexusArtifactType = z.infer<typeof GitNexusArtifactTypeSchema>;
export type GitNexusRepoIdentity = z.infer<
  typeof GitNexusRepoIdentitySchema
>;
export type GitNexusSourceTool = z.infer<typeof GitNexusSourceToolSchema>;
export type GitNexusSourceContract = z.infer<
  typeof GitNexusSourceContractSchema
>;
export type GitNexusArtifact = z.infer<typeof GitNexusArtifactSchema>;
export type GitNexusRouteDecision = z.infer<
  typeof GitNexusRouteDecisionSchema
>;

export function routeGitNexusArtifact(
  input: unknown,
): GitNexusRouteDecision {
  const artifact = GitNexusArtifactSchema.parse(input);
  const subfolder = subfolderForArtifact(artifact.artifact_type);

  return GitNexusRouteDecisionSchema.parse({
    artifact_type: artifact.artifact_type,
    project: artifact.source.repo.project,
    folder: `20-projects/${slugPathSegment(
      artifact.source.repo.project,
    )}/gitnexus/${subfolder}`,
    requires_librarian_routing: true,
    write_attempted: false,
    repo_mutated: false,
    vault_mutated: false,
  });
}

export function createGitNexusLibrarianEnvelope(
  input: unknown,
): LibrarianIngestionEnvelope {
  const artifact = GitNexusArtifactSchema.parse(input);
  const frontmatter = gitnexusFrontmatter(artifact);
  const route = routeVaultNote(frontmatter);
  const expectedFolder = routeGitNexusArtifact(artifact).folder;
  if (route.folder !== expectedFolder) {
    throw new Error("GitNexus artifact route does not match vault taxonomy.");
  }

  return LibrarianIngestionEnvelopeSchema.parse({
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    envelope_id: `gitnexus:${slugPathSegment(artifact.artifact_id)}`,
    source: {
      source_type: "gitnexus",
      source_id: artifact.artifact_id,
      source_ref: artifact.source.analyzed_commit_sha,
      captured_at: artifact.source.generated_at,
      provenance_source_type: "git",
      content_hash: artifact.content_hash,
    },
    proposed_frontmatter: frontmatter,
    declared_classification: artifact.durable_requested
      ? "durable"
      : "candidate",
    requested_route_target: "project",
    requested_target_folder: expectedFolder,
    content_hash: artifact.content_hash,
    body_ref: null,
    raw_body_included: false,
    received_at: artifact.source.generated_at,
  });
}

function gitnexusFrontmatter(
  artifact: GitNexusArtifact,
): VaultFrontmatter {
  const durableRequested =
    artifact.durable_requested || artifact.canonical_requested;
  const approved = artifact.approval_status === "approved";

  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slugPathSegment(artifact.artifact_id)}`,
    title: artifact.title,
    note_type: artifact.artifact_type,
    domain: "project",
    status: durableRequested ? "active" : "candidate",
    created_at: artifact.source.generated_at,
    updated_at: artifact.source.generated_at,
    tags: ["gitnexus", artifact.artifact_type],
    sensitivity: artifact.sensitivity,
    project: artifact.source.repo.project,
    provenance: {
      source_type: "git",
      source_id: artifact.artifact_id,
      source_url: artifact.source.source_tool.source_url,
      content_hash: artifact.content_hash,
    },
    agent: {
      created_by: "gitnexus",
      run_id: artifact.source.generated_graph_id,
      model_id: null,
      promotion_status: approved ? "human_approved" : "candidate",
    },
    links: {
      related: [],
      sources: [artifact.source.analyzed_commit_sha],
      decisions: [],
    },
    lifecycle: {
      durable: artifact.durable_requested && approved,
      canonical: artifact.canonical_requested && approved,
      approval_status: artifact.approval_status,
      approval_id: artifact.approval_id,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };
}

function subfolderForArtifact(
  artifactType: VaultGitNexusArtifactType,
): (typeof VAULT_GITNEXUS_ROUTE_SUBFOLDERS)[VaultGitNexusArtifactType] {
  return VAULT_GITNEXUS_ROUTE_SUBFOLDERS[artifactType];
}
