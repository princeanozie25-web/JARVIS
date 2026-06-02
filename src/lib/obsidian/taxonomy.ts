export const VAULT_ROOT_FOLDERS = [
  "00-meta",
  "01-inbox",
  "10-wiki",
  "20-projects",
  "30-research",
  "40-learning",
  "50-career",
  "60-agents",
  "70-references",
  "80-reviews",
  "90-archive",
  "_attachments",
] as const;

export const LLM_WIKI_FOLDERS = [
  "hubs",
  "concepts",
  "systems",
  "people",
  "projects",
  "sources",
  "decisions",
] as const;

export const VAULT_LLM_WIKI_NOTE_TYPES = [
  "hub",
  "concept",
  "system",
  "person",
  "project",
  "source",
  "decision",
  "comparison",
  "synthesis",
] as const;

export const VAULT_LLM_WIKI_ROUTE_SUBFOLDERS = {
  hub: "hubs",
  concept: "concepts",
  system: "systems",
  person: "people",
  project: "projects",
  source: "sources",
  decision: "decisions",
  comparison: "concepts",
  synthesis: "concepts",
} as const;

export const VAULT_GITNEXUS_ARTIFACT_TYPES = [
  "repo_graph",
  "dependency_cluster",
  "call_chain",
  "execution_flow",
  "code_wiki_page",
  "blast_radius_report",
  "stale_index_report",
] as const;

export const VAULT_GITNEXUS_NOTE_TYPES = [
  "git_commit",
  "git_slice",
  ...VAULT_GITNEXUS_ARTIFACT_TYPES,
] as const;

export const VAULT_GITNEXUS_ROUTE_SUBFOLDERS = {
  git_commit: "commits",
  git_slice: "slices",
  repo_graph: "graphs",
  dependency_cluster: "graphs",
  call_chain: "graphs",
  execution_flow: "graphs",
  code_wiki_page: "wiki",
  blast_radius_report: "blast-radius",
  stale_index_report: "stale-index",
} as const;

export const VAULT_NOTE_TYPES = [
  ...VAULT_LLM_WIKI_NOTE_TYPES,
  "agent_run",
  ...VAULT_GITNEXUS_NOTE_TYPES,
  "review",
  "inbox_item",
] as const;

export const VAULT_DOMAINS = [
  "meta",
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
] as const;

export const VAULT_NOTE_STATUSES = [
  "draft",
  "candidate",
  "active",
  "superseded",
  "archived",
  "rejected",
] as const;

export const VAULT_SENSITIVITY_LEVELS = [
  "public",
  "internal",
  "private",
  "secret",
] as const;

export const VAULT_PROMOTION_STATUSES = [
  "transient",
  "candidate",
  "human_approved",
  "auto_rejected",
  "superseded",
] as const;

export const VAULT_APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "denied",
  "expired",
] as const;

export const VAULT_PROVENANCE_SOURCE_TYPES = [
  "human",
  "agent",
  "git",
  "web",
  "document",
  "system",
  "unknown",
] as const;

export const VAULT_CANONICAL_SOURCE_POLICY = {
  canonical_source: "markdown",
  derived_indexes: ["sqlite", "vector", "graph"],
  sqlite_index_derived: true,
  vector_index_derived: true,
  graph_index_derived: true,
  index_is_authoritative: false,
  vault_writes_allowed: false,
  indexes_may_be_rebuilt: true,
} as const;

export type VaultRootFolder = (typeof VAULT_ROOT_FOLDERS)[number];
export type LlmWikiFolder = (typeof LLM_WIKI_FOLDERS)[number];
export type VaultLlmWikiNoteType =
  (typeof VAULT_LLM_WIKI_NOTE_TYPES)[number];
export type VaultGitNexusArtifactType =
  (typeof VAULT_GITNEXUS_ARTIFACT_TYPES)[number];
export type VaultGitNexusNoteType =
  (typeof VAULT_GITNEXUS_NOTE_TYPES)[number];
export type VaultNoteType = (typeof VAULT_NOTE_TYPES)[number];
export type VaultDomain = (typeof VAULT_DOMAINS)[number];
export type VaultNoteStatus = (typeof VAULT_NOTE_STATUSES)[number];
export type VaultSensitivity = (typeof VAULT_SENSITIVITY_LEVELS)[number];
export type VaultPromotionStatus =
  (typeof VAULT_PROMOTION_STATUSES)[number];
export type VaultApprovalStatus = (typeof VAULT_APPROVAL_STATUSES)[number];
export type VaultProvenanceSourceType =
  (typeof VAULT_PROVENANCE_SOURCE_TYPES)[number];
