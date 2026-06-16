// MCP gateway — per-client scope + EoP-13 capability classification (24D-2a).
//
// A client's authority is FINE-GRAINED — action + target + argument + time +
// rate — and enforced at the gateway boundary on the AUTHENTICATED client's
// identity (FC-3). The proposal's authority IS the client's authority; it is
// NEVER elevated by the internal capability path it touches (EoP-4 confused-
// deputy defense). Coarse "can propose" is forbidden — it would reopen EoP-4.
//
// TWO default-deny layers gate a proposal:
//   1. CAPABILITY_CLASSIFICATION (gateway POLICY): every MUTATING capability must
//      be declared {mcp_exposable, proposal_allowed, required_scope,
//      required_approval_tier}. An undeclared/unknown capability is NOT exposable
//      (the completeness test fails the build if a mutating capability is missing).
//   2. the per-client GRANT (human-provisioned scope on the client record): which
//      capabilities this client may propose, and under which target/arg/time
//      constraints. No grant => denied.
//
// Rate/time LIMITS are DECLARED here; the running rate COUNTER is enforced in
// 24D-3. The per-proposal time_bound IS enforced at submission (this slice).
//
// GATE-2: imports only the canonical-policy leaf (pure vocab + the EoP-13
// classification, re-exported here for existing importers). No db, no tools/
// tree, no fs — a pure policy + enforcement leaf.

import {
  CAPABILITY_CLASSIFICATION,
  classifyCapability,
  findUnclassifiedMutatingCapabilities,
  isCapabilityExposable,
  type CapabilityClassification,
} from "@/lib/canonical-policy";

// Re-export the shared EoP-13 classification surface so existing importers of
// "./scope" are unaffected by the 24D-2b move into the canonical-policy leaf
// (the policy now lives in one place both the gateway and the executor import).
export {
  CAPABILITY_CLASSIFICATION,
  classifyCapability,
  findUnclassifiedMutatingCapabilities,
  isCapabilityExposable,
};
export type { CapabilityClassification };

// --- read scope (ID-2) -------------------------------------------------------
export const READABLE_RESOURCE_NAMES = [
  "pipeline-view-model",
  "queue-status",
] as const;

// --- the per-client scope grant ----------------------------------------------
export interface ProposeGrant {
  /** Exact capability id (e.g. "memory.note"). */
  capability: string;
  /** The DERIVED (raw) target must start with this (target-bound). */
  target_prefix?: string;
  /** Max byte size of the serialized args (argument-bound). */
  max_args_bytes?: number;
  /** Arg keys that must be ABSENT (e.g. "attachments", "external_links"). */
  forbid_arg_keys?: string[];
  /** Arg keys that, if present, must be === false (e.g. "overwrite"). */
  require_false_arg_keys?: string[];
  /** The proposal's lifetime (ttl) must be <= this (time-bound). */
  time_bound_ms?: number;
  /** DECLARED per-client rate limit. ENFORCED by the counter in 24D-3. */
  rate_limit?: { max: number; per_ms: number };
}

export interface ClientScope {
  /** Subset of READABLE_RESOURCE_NAMES this client may read (ID-2). */
  read: string[];
  /** The fine-grained capabilities this client may propose. */
  propose: ProposeGrant[];
}

// --- EoP-13 capability classification ----------------------------------------
// CapabilityClassification / CAPABILITY_CLASSIFICATION / classifyCapability /
// isCapabilityExposable / findUnclassifiedMutatingCapabilities now live in the
// canonical-policy leaf (imported + re-exported above). The executor re-checks
// the SAME map at the decision point without importing the gateway (E-016).

// --- read-scope enforcement (ID-2) -------------------------------------------
export function isReadAllowed(
  scope: ClientScope | null | undefined,
  resourceName: string,
): boolean {
  if (!scope || !Array.isArray(scope.read)) return false; // fail-closed
  return scope.read.includes(resourceName);
}

// --- propose-scope enforcement (EoP-13 + EoP-4) ------------------------------
export type ScopeDenyReason =
  | "not_classified" // capability absent from the gateway policy map
  | "not_exposable" // classified but mcp_exposable/proposal_allowed false
  | "no_grant" // the client has no propose grant for this capability
  | "target_out_of_scope" // derived target violates target_prefix
  | "arg_out_of_scope" // args violate size/forbidden/require-false constraints
  | "time_out_of_scope"; // proposal ttl exceeds time_bound_ms

export type ScopeCheckResult =
  | { ok: true }
  | { ok: false; reason: ScopeDenyReason };

/**
 * Enforce the client's GRANTED scope against the server-DERIVED canonical effect,
 * on the client's identity (EoP-4: a client cannot exceed its grant by routing
 * through any internal capability). Fail-closed at every step. Sits at the
 * gateway boundary BEFORE the FC-2 freeze / GATE-5 enqueue.
 */
export function checkProposeScope(input: {
  capability: string;
  /** The DERIVED (raw, unmasked) target, for prefix matching. */
  rawTarget: string;
  /** The client's args (untrusted) — examined only to REJECT out-of-scope. */
  args: unknown;
  /** The proposal lifetime that will be frozen (now + ttl). */
  ttlMs: number;
  scope: ClientScope | null | undefined;
}): ScopeCheckResult {
  // 1. gateway policy (default-deny): classified + exposable
  const classification = classifyCapability(input.capability);
  if (classification === null) return { ok: false, reason: "not_classified" };
  if (!classification.mcp_exposable || !classification.proposal_allowed) {
    return { ok: false, reason: "not_exposable" };
  }

  // 2. per-client grant (default-deny). A client grant can NEVER override the
  //    gateway policy above — both must pass.
  const grant = input.scope?.propose?.find(
    (g) => g.capability === input.capability,
  );
  if (!grant) return { ok: false, reason: "no_grant" };

  // 3. target-bound
  if (
    grant.target_prefix !== undefined &&
    !input.rawTarget.startsWith(grant.target_prefix)
  ) {
    return { ok: false, reason: "target_out_of_scope" };
  }

  // 4. argument-bound
  const argBytes = Buffer.byteLength(
    JSON.stringify(input.args ?? null),
    "utf8",
  );
  if (grant.max_args_bytes !== undefined && argBytes > grant.max_args_bytes) {
    return { ok: false, reason: "arg_out_of_scope" };
  }
  if (
    input.args &&
    typeof input.args === "object" &&
    !Array.isArray(input.args)
  ) {
    const argRecord = input.args as Record<string, unknown>;
    for (const key of grant.forbid_arg_keys ?? []) {
      if (key in argRecord) return { ok: false, reason: "arg_out_of_scope" };
    }
    for (const key of grant.require_false_arg_keys ?? []) {
      if (key in argRecord && argRecord[key] !== false) {
        return { ok: false, reason: "arg_out_of_scope" };
      }
    }
  }

  // 5. time-bound
  if (grant.time_bound_ms !== undefined && input.ttlMs > grant.time_bound_ms) {
    return { ok: false, reason: "time_out_of_scope" };
  }

  return { ok: true };
}

// --- defensive scope coercion (from the env-carried registry, 24D-1) ---------
function coerceProposeGrant(value: unknown): ProposeGrant | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.capability !== "string" || v.capability.length === 0)
    return null;
  const grant: ProposeGrant = { capability: v.capability };
  if (typeof v.target_prefix === "string")
    grant.target_prefix = v.target_prefix;
  if (typeof v.max_args_bytes === "number") {
    grant.max_args_bytes = v.max_args_bytes;
  }
  if (Array.isArray(v.forbid_arg_keys)) {
    grant.forbid_arg_keys = v.forbid_arg_keys.filter(
      (x): x is string => typeof x === "string",
    );
  }
  if (Array.isArray(v.require_false_arg_keys)) {
    grant.require_false_arg_keys = v.require_false_arg_keys.filter(
      (x): x is string => typeof x === "string",
    );
  }
  if (typeof v.time_bound_ms === "number")
    grant.time_bound_ms = v.time_bound_ms;
  if (v.rate_limit && typeof v.rate_limit === "object") {
    const rl = v.rate_limit as Record<string, unknown>;
    if (typeof rl.max === "number" && typeof rl.per_ms === "number") {
      grant.rate_limit = { max: rl.max, per_ms: rl.per_ms };
    }
  }
  return grant;
}

/** Coerce an untrusted value (from the env registry) into a ClientScope. Unknown
 * shapes => an empty scope (read nothing, propose nothing) — fail-closed. */
export function coerceClientScope(value: unknown): ClientScope {
  if (!value || typeof value !== "object") return { read: [], propose: [] };
  const v = value as Record<string, unknown>;
  const read = Array.isArray(v.read)
    ? v.read.filter((x): x is string => typeof x === "string")
    : [];
  const propose = Array.isArray(v.propose)
    ? v.propose
        .map(coerceProposeGrant)
        .filter((g): g is ProposeGrant => g !== null)
    : [];
  return { read, propose };
}
