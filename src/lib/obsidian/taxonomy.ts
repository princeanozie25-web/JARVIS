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

export const VAULT_NOTE_TYPES = [
  "hub",
  "concept",
  "system",
  "person",
  "project",
  "source",
  "decision",
  "agent_run",
  "git_commit",
  "git_slice",
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
export type VaultNoteType = (typeof VAULT_NOTE_TYPES)[number];
export type VaultDomain = (typeof VAULT_DOMAINS)[number];
export type VaultNoteStatus = (typeof VAULT_NOTE_STATUSES)[number];
export type VaultSensitivity = (typeof VAULT_SENSITIVITY_LEVELS)[number];
export type VaultPromotionStatus =
  (typeof VAULT_PROMOTION_STATUSES)[number];
export type VaultApprovalStatus = (typeof VAULT_APPROVAL_STATUSES)[number];
export type VaultProvenanceSourceType =
  (typeof VAULT_PROVENANCE_SOURCE_TYPES)[number];
