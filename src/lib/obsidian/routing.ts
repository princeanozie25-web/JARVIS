import {
  VaultFrontmatterSchema,
  type VaultFrontmatter,
} from "./frontmatter";
import { VAULT_CANONICAL_SOURCE_POLICY } from "./taxonomy";

export type VaultRoutingGovernanceReason =
  | "durable_agent_note_requires_human_approval"
  | "durable_note_requires_approval"
  | "transient_agent_output"
  | "gitnexus_project_required"
  | "markdown_is_canonical"
  | "derived_indexes_only";

export type VaultRouteStatus =
  | "routed"
  | "held_for_approval"
  | "invalid_metadata";

export type VaultRouteKind =
  | "canonical"
  | "pending_approval"
  | "inbox"
  | "agent_run"
  | "derived_project";

export interface VaultRouteDecision {
  readonly status: VaultRouteStatus;
  readonly route_kind: VaultRouteKind;
  readonly folder: string;
  readonly durable: boolean;
  readonly requires_approval: boolean;
  readonly write_attempted: false;
  readonly approved_for_durable_write: boolean;
  readonly durable_write_allowed: boolean;
  readonly requires_librarian_review: boolean;
  readonly governance_reasons: readonly VaultRoutingGovernanceReason[];
  readonly canonical_source: typeof VAULT_CANONICAL_SOURCE_POLICY.canonical_source;
  readonly derived_indexes: typeof VAULT_CANONICAL_SOURCE_POLICY.derived_indexes;
  readonly index_is_authoritative: typeof VAULT_CANONICAL_SOURCE_POLICY.index_is_authoritative;
}

const WIKI_ROUTE_BY_TYPE: Partial<Record<VaultFrontmatter["note_type"], string>> =
  {
    hub: "10-wiki/hubs",
    concept: "10-wiki/concepts",
    system: "10-wiki/systems",
    person: "10-wiki/people",
    project: "10-wiki/projects",
    source: "10-wiki/sources",
    decision: "10-wiki/decisions",
  };

export function routeVaultNote(input: unknown): VaultRouteDecision {
  const frontmatter = VaultFrontmatterSchema.parse(input);
  const reasons: VaultRoutingGovernanceReason[] = [
    "markdown_is_canonical",
    "derived_indexes_only",
  ];
  const transientAgentOutput = isTransientAgentOutput(frontmatter);
  const durable = isDurableNote(frontmatter) && !transientAgentOutput;
  const agentCreated = frontmatter.agent.created_by !== null;
  const lifecycleApproved =
    frontmatter.lifecycle.approval_status === "approved" &&
    frontmatter.lifecycle.approval_id !== null;
  const agentApproved =
    !agentCreated || frontmatter.agent.promotion_status === "human_approved";
  const requiresLifecycleApproval = durable && !lifecycleApproved;
  const requiresAgentApproval = durable && agentCreated && !agentApproved;
  const requiresApproval = requiresLifecycleApproval || requiresAgentApproval;

  if (transientAgentOutput) {
    reasons.push("transient_agent_output");
  }
  if (requiresLifecycleApproval) {
    reasons.push("durable_note_requires_approval");
  }
  if (requiresAgentApproval) {
    reasons.push("durable_agent_note_requires_human_approval");
  }

  const route = selectRoute(frontmatter, {
    transientAgentOutput,
    requiresApproval,
    reasons,
  });
  const durableWriteAllowed = durable && !requiresApproval;

  return {
    status: requiresApproval ? "held_for_approval" : "routed",
    route_kind: route.kind,
    folder: route.folder,
    durable,
    requires_approval: requiresApproval,
    write_attempted: false,
    approved_for_durable_write: durableWriteAllowed,
    durable_write_allowed: durableWriteAllowed,
    requires_librarian_review: requiresApproval,
    governance_reasons: reasons,
    canonical_source: VAULT_CANONICAL_SOURCE_POLICY.canonical_source,
    derived_indexes: VAULT_CANONICAL_SOURCE_POLICY.derived_indexes,
    index_is_authoritative: VAULT_CANONICAL_SOURCE_POLICY.index_is_authoritative,
  };
}

export function isVaultDurableWriteAllowed(input: unknown): boolean {
  return routeVaultNote(input).approved_for_durable_write;
}

function selectRoute(
  frontmatter: VaultFrontmatter,
  governance: {
    readonly transientAgentOutput: boolean;
    readonly requiresApproval: boolean;
    readonly reasons: VaultRoutingGovernanceReason[];
  },
): { readonly folder: string; readonly kind: VaultRouteKind } {
  if (frontmatter.note_type === "agent_run") {
    return {
      folder: `60-agents/${slugPathSegment(
        frontmatter.agent.created_by ?? "unknown-agent",
      )}/runs`,
      kind: "agent_run",
    };
  }
  if (governance.transientAgentOutput) {
    return { folder: "01-inbox/agent", kind: "inbox" };
  }
  if (frontmatter.note_type === "git_commit") {
    return gitnexusRoute(frontmatter, "commits", governance.reasons);
  }
  if (frontmatter.note_type === "git_slice") {
    return gitnexusRoute(frontmatter, "slices", governance.reasons);
  }
  if (governance.requiresApproval) {
    return { folder: "01-inbox/pending-approval", kind: "pending_approval" };
  }

  if (frontmatter.note_type === "review") {
    return { folder: "80-reviews", kind: "canonical" };
  }
  if (frontmatter.note_type === "inbox_item") {
    return { folder: "01-inbox", kind: "inbox" };
  }

  if (frontmatter.domain === "project") {
    return {
      folder: `20-projects/${projectSlug(frontmatter)}`,
      kind: "canonical",
    };
  }
  if (frontmatter.domain === "research") {
    return { folder: "30-research", kind: "canonical" };
  }
  if (frontmatter.domain === "learning") {
    return { folder: "40-learning", kind: "canonical" };
  }
  if (frontmatter.domain === "career") {
    return { folder: "50-career", kind: "canonical" };
  }
  if (frontmatter.domain === "reference") {
    return { folder: "70-references", kind: "canonical" };
  }
  if (frontmatter.domain === "archive") {
    return { folder: "90-archive", kind: "canonical" };
  }
  if (frontmatter.domain === "agent") {
    return {
      folder: `60-agents/${slugPathSegment(
        frontmatter.agent.created_by ?? frontmatter.title,
      )}`,
      kind: "inbox",
    };
  }
  if (frontmatter.domain === "meta") {
    return { folder: "00-meta", kind: "canonical" };
  }

  return {
    folder: WIKI_ROUTE_BY_TYPE[frontmatter.note_type] ?? "10-wiki/concepts",
    kind: "canonical",
  };
}

function gitnexusRoute(
  frontmatter: VaultFrontmatter,
  collection: "commits" | "slices",
  reasons: VaultRoutingGovernanceReason[],
): { readonly folder: string; readonly kind: VaultRouteKind } {
  if (!frontmatter.project) {
    reasons.push("gitnexus_project_required");
  }
  return {
    folder: `20-projects/${projectSlug(frontmatter)}/gitnexus/${collection}`,
    kind: "derived_project",
  };
}

function isDurableNote(frontmatter: VaultFrontmatter): boolean {
  return (
    frontmatter.lifecycle.durable ||
    frontmatter.lifecycle.canonical ||
    ["active", "superseded", "archived"].includes(frontmatter.status)
  );
}

function isTransientAgentOutput(frontmatter: VaultFrontmatter): boolean {
  return (
    frontmatter.note_type === "agent_run" ||
    frontmatter.agent.promotion_status === "transient"
  );
}

function projectSlug(frontmatter: VaultFrontmatter): string {
  return slugPathSegment(frontmatter.project ?? frontmatter.title);
}

export function slugPathSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\0/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "unassigned";
}
