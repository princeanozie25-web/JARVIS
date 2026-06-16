// Shared canonicalization policy leaf (24D-2b) — closes E-016.
//
// THE STRUCTURAL CRUX: the gateway derives a canonical effect + classifies
// capabilities at SUBMISSION; the executor must RE-CHECK the same policy at the
// human-DECISION point (registry drift: a tool declassified / a scope tightened
// AFTER queueing but BEFORE approval). The executor must NOT import the gateway
// (mcp-gateway/), and the gateway must NOT import the executor (chat/). So the
// pure policy lives HERE — a neutral leaf BOTH depend DOWN onto. No cycle.
//
// PURITY (GATE-2): this module imports NOTHING — only string-literal vocab, pure
// derivation functions, the capability classification map, and pure predicates.
// No mutator tree, no db, no fs, no mcp-gateway, no chat. The gateway adds this
// prefix to its transitive-import allowlist (it is the safest possible leaf).

// --- vocab (the canonical effect's value space) ------------------------------
export type ReversibilityClass =
  | "NO_SIDE_EFFECT"
  | "PURE_READ"
  | "REVERSIBLE_WRITE"
  | "IRREVERSIBLE";

export type SafetyTag = "ALLOW" | "CONFIRM_ONCE" | "CONFIRM_ALWAYS" | "BLOCK";

export type MutationType =
  | "none"
  | "read"
  | "reversible_write"
  | "irreversible_write";

/** Mirrors approval-runtime APPROVAL_RISK_CLASSES. */
export type RiskClass = "low" | "medium" | "high" | "critical";

export type ApprovalTier =
  | "auto"
  | "confirm_once"
  | "confirm_always"
  | "elevated";

// --- pure derivation (server policy over registry metadata) ------------------
export function mutationTypeOf(
  reversibility: ReversibilityClass,
): MutationType {
  switch (reversibility) {
    case "NO_SIDE_EFFECT":
      return "none";
    case "PURE_READ":
      return "read";
    case "REVERSIBLE_WRITE":
      return "reversible_write";
    case "IRREVERSIBLE":
      return "irreversible_write";
    default:
      // fail-safe: an unrecognized class is treated as the most dangerous
      return "irreversible_write";
  }
}

const RISK_ORDER: RiskClass[] = ["low", "medium", "high", "critical"];

function bumpRisk(risk: RiskClass, by: number): RiskClass {
  const index = RISK_ORDER.indexOf(risk);
  const next = Math.min(RISK_ORDER.length - 1, Math.max(0, index + by));
  return RISK_ORDER[next];
}

/** risk_class is a pure function of reversibilityClass + requiredSafetyTag —
 * never the client. CONFIRM_ALWAYS escalates one level; BLOCK pins to critical. */
export function riskClassOf(
  reversibility: ReversibilityClass,
  safetyTag: SafetyTag,
): RiskClass {
  let base: RiskClass;
  switch (reversibility) {
    case "NO_SIDE_EFFECT":
    case "PURE_READ":
      base = "low";
      break;
    case "REVERSIBLE_WRITE":
      base = "medium";
      break;
    case "IRREVERSIBLE":
      base = "high";
      break;
    default:
      base = "critical"; // fail-safe
  }
  if (safetyTag === "BLOCK") return "critical";
  if (safetyTag === "CONFIRM_ALWAYS") return bumpRisk(base, 1);
  return base;
}

/** approval_tier is derived from requiredSafetyTag (the confirm requirement) +
 * reversibilityClass. A write is never weaker than confirm_once; an irreversible
 * action is never weaker than confirm_always. */
export function approvalTierOf(
  reversibility: ReversibilityClass,
  safetyTag: SafetyTag,
): ApprovalTier {
  const isWrite =
    reversibility === "REVERSIBLE_WRITE" || reversibility === "IRREVERSIBLE";

  let tier: ApprovalTier;
  if (safetyTag === "ALLOW") tier = isWrite ? "confirm_once" : "auto";
  else if (safetyTag === "CONFIRM_ONCE") tier = "confirm_once";
  else tier = "confirm_always"; // CONFIRM_ALWAYS or BLOCK

  if (reversibility === "IRREVERSIBLE") {
    tier = tier === "confirm_always" ? "elevated" : "confirm_always";
  }
  return tier;
}

/**
 * Structurally summarize a raw scope/target string so NO raw path/value/secret
 * enters the metadata-only effect. Filesystem paths collapse to
 * "filesystem:<ext-shape>"; scheme-prefixed scopes keep the scheme only
 * ("memory:<target>"); anything else is "opaque:<target>".
 */
export function summarizeTarget(rawScope: string): {
  target: string;
  scopeCategory: string;
} {
  const trimmed = rawScope.trim();
  const winDrive = /^[a-zA-Z]:[\\/]/.test(trimmed);
  const pathLike =
    winDrive ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /[\\/]/.test(trimmed);

  if (pathLike) {
    const ext = /\.([a-z0-9]{1,8})$/i.exec(trimmed);
    const shape = ext ? `*.${ext[1].toLowerCase()}` : "path";
    return { target: `filesystem:${shape}`, scopeCategory: "filesystem" };
  }

  const schemeMatch = /^([a-z][a-z0-9_-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    return { target: `${scheme}:<target>`, scopeCategory: scheme };
  }

  return { target: "opaque:<target>", scopeCategory: "opaque" };
}

// --- EoP-13 capability classification (gateway policy, default-deny) ----------
export interface CapabilityClassification {
  mcp_exposable: boolean;
  proposal_allowed: boolean;
  required_scope: string;
  required_approval_tier: ApprovalTier;
}

/** EVERY mutating capability the tool registry can expose MUST appear here with
 * an explicit classification (the completeness test fails the build otherwise).
 * A capability proposable over MCP needs BOTH mcp_exposable AND proposal_allowed.
 * Default-deny: a capability absent from this map is NOT exposable. */
export const CAPABILITY_CLASSIFICATION: Readonly<
  Record<string, CapabilityClassification>
> = {
  "memory.note": {
    mcp_exposable: true,
    proposal_allowed: true,
    required_scope: "memory.write",
    required_approval_tier: "confirm_once",
  },
  "fs.create_file": {
    mcp_exposable: true,
    proposal_allowed: true,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "fs.write_file": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "fs.append_file": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "fs.mkdir": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "fs.rename": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "fs.delete_file": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_always",
  },
  "fs.undo": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "fs.write",
    required_approval_tier: "confirm_once",
  },
  "project.register": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "project.write",
    required_approval_tier: "confirm_once",
  },
  "project.add_source": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "project.write",
    required_approval_tier: "confirm_once",
  },
  "project.index": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "project.write",
    required_approval_tier: "confirm_once",
  },
  "project.promote_task": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "project.write",
    required_approval_tier: "confirm_once",
  },
  "project.set_status": {
    mcp_exposable: false,
    proposal_allowed: false,
    required_scope: "project.write",
    required_approval_tier: "confirm_once",
  },
};

export type ClassificationLookup = (
  capability: string,
) => CapabilityClassification | null;

export const classifyCapability: ClassificationLookup = (capability) =>
  Object.prototype.hasOwnProperty.call(CAPABILITY_CLASSIFICATION, capability)
    ? CAPABILITY_CLASSIFICATION[capability]
    : null;

/** Default-deny: only a classified capability with BOTH flags true is exposable. */
export function isCapabilityExposable(capability: string): boolean {
  const classification = classifyCapability(capability);
  return (
    classification !== null &&
    classification.mcp_exposable &&
    classification.proposal_allowed
  );
}

/** EoP-13 completeness: the mutating capabilities that have NO classification. A
 * non-empty result MUST fail the build. */
export function findUnclassifiedMutatingCapabilities(
  mutatingCapabilities: readonly string[],
): string[] {
  return mutatingCapabilities.filter((cap) => classifyCapability(cap) === null);
}

// --- decision-time registry-drift re-check (24D-2b, closes E-016) ------------
export type PolicyRecheckReason =
  | "tool_declassified" // capability no longer classified / not mcp_exposable / not proposal_allowed
  | "approval_policy_changed"; // the capability's required approval tier drifted since freeze

export type PolicyRecheckResult =
  | { ok: true }
  | { ok: false; reason: PolicyRecheckReason };

/**
 * Re-validate a FROZEN proposal's effect against CURRENT policy at the decision
 * point. Catches drift the frozen hash cannot: a capability declassified, or its
 * required approval tier tightened, AFTER the proposal was queued. Compares the
 * frozen effect (capability + approval_tier, from the stored canonical_effect)
 * against the CURRENT classification (`classify`, default = the live map).
 */
export function recheckFrozenEffectPolicy(
  frozen: { capability: string; approval_tier: string },
  classify: ClassificationLookup = classifyCapability,
): PolicyRecheckResult {
  const classification = classify(frozen.capability);
  if (
    classification === null ||
    !classification.mcp_exposable ||
    !classification.proposal_allowed
  ) {
    return { ok: false, reason: "tool_declassified" };
  }
  if (classification.required_approval_tier !== frozen.approval_tier) {
    return { ok: false, reason: "approval_policy_changed" };
  }
  return { ok: true };
}
