// FC-2 approval-time re-validation (24C-2b) + registry-drift re-check (24D-2b)
// + per-client grant re-check (24D-4).
//
// A gateway-originated proposal (24C-2) was hash-frozen at submission. This leaf
// re-validates it at the human-decision point, BEFORE runtime.runTool, closing
// the TOCTOU window (EoP-8 / EoP-14): the human approves a specific hash; the
// executor must run ONLY that hash. If the frozen effect or its hash drifted, or
// the proposal expired, the approval is no longer valid.
//
// 24D-2b (closes E-016): the frozen hash proves the effect is UNCHANGED, but it
// cannot prove the effect is STILL VALID against current reality. Between queueing
// and approval the REGISTRY/POLICY can drift — a capability declassified, or its
// required approval tier tightened. So after the hash check we ALSO re-derive the
// policy: parse the (hash-verified) frozen effect and re-check capability +
// approval_tier against the CURRENT classification via the shared canonical-policy
// leaf. DENY on drift, by the same mirror, before any execution.
//
// 24D-4 (closes E-017): the hash + policy re-checks are client-AGNOSTIC. They do
// NOT catch PER-CLIENT grant revocation — a SPECIFIC client's scope withdrawn
// between queueing and approval. So the approval row now persists the gateway's
// client_id, and the guard takes an injected CurrentGrantLookup (host-wired to the
// live registry; the executor still imports NO gateway code) to re-read that
// client's CURRENT grant and DENY (grant_revoked) if it no longer authorizes the
// capability. Legacy/chat approvals (no client_id) are unaffected.
//
// This module imports ONLY node:crypto and the canonical-policy leaf (a pure,
// mutator-free module). It does NOT import the gateway (the executor must never
// depend on src/lib/mcp-gateway/) — the leaf is the neutral home BOTH sides share
// so the re-check uses the SAME policy the gateway derived from, with no cycle.
// It recomputes the FC-2 hash from the stored canonical_effect_json — the EXACT
// stable serialization the gateway hashed — so the algorithm here is a one-line
// digest, not a re-implement of the gateway's key-sorting. A cross-check test
// pins this to the gateway's computeCanonicalEffectHash so the two can never drift.

import { createHash } from "node:crypto";

import {
  classifyCapability,
  clientGrantStillAuthorizes,
  recheckFrozenEffectPolicy,
  type ClassificationLookup,
  type CurrentGrantLookup,
} from "@/lib/canonical-policy";

/** Recompute the FC-2 canonical_effect_hash from the stored stable serialization.
 * MUST match the gateway format exactly: "hash:sha256:" + sha256(json). */
export function recomputeCanonicalEffectHash(
  canonicalEffectJson: string,
): string {
  return `hash:sha256:${createHash("sha256")
    .update(canonicalEffectJson, "utf8")
    .digest("hex")}`;
}

export type RevalidationFailureReason =
  | "hash_missing" // claimed gateway origin but the hash is empty (fail-closed)
  | "effect_missing" // claimed gateway origin but the frozen serialization is absent
  | "expired" // past expires_at at decision time
  | "hash_mismatch" // recomputed hash != stored hash (the effect/hash drifted)
  | "effect_unparsable" // hash matched but the frozen JSON isn't a usable effect
  | "tool_declassified" // capability no longer exposable in current policy (24D-2b)
  | "approval_policy_changed" // required approval tier drifted since freeze (24D-2b)
  | "grant_revoked"; // THIS client's grant no longer authorizes the capability (24D-4)

/** The subset of the approval row the guard needs. */
export interface RevalidationRow {
  canonical_effect_hash: string | null;
  canonical_effect_json: string | null;
  expires_at: number | null;
  /** The gateway's server-derived client_id (24D-4). Null/absent for legacy/chat
   * approvals (the per-client grant re-check then does not apply) — so existing
   * callers/rows that predate this field are unaffected. */
  client_id?: string | null;
}

export type RevalidationOutcome =
  | { kind: "legacy" } // no canonical_effect_hash: a normal chat approval, proceed unchanged
  | { kind: "ok" } // gateway proposal, still valid: proceed
  | { kind: "deny"; reason: RevalidationFailureReason };

/** The fields the drift re-check reads out of the (hash-verified) frozen effect. */
interface FrozenEffectShape {
  capability: unknown;
  approval_tier: unknown;
}

/**
 * Re-validate a gateway proposal at the decision point. Fail-closed:
 *   - no canonical_effect_hash       -> "legacy" (NOT a gateway proposal; the
 *                                       caller proceeds with the unchanged path)
 *   - hash present but blank          -> deny (a claimed gateway proposal must
 *                                       carry a real hash)
 *   - past expires_at                 -> deny (defense-in-depth; the existing
 *                                       lifecycle also denies expired approvals)
 *   - frozen serialization missing    -> deny (cannot prove the hash)
 *   - recomputed hash != stored hash  -> deny (the effect or hash drifted)
 *   - frozen effect not parseable     -> deny (hash matched but JSON unusable)
 *   - capability declassified         -> deny (24D-2b registry drift)
 *   - required approval tier changed  -> deny (24D-2b policy drift)
 *   - THIS client's grant revoked     -> deny (24D-4 per-client drift; only when
 *                                       the row carries a client_id AND a
 *                                       currentGrant lookup is wired)
 *   - otherwise                       -> ok
 *
 * `classify` is injectable so a test can simulate registry drift; it defaults to
 * the live canonical-policy map (the SAME map the gateway derived from).
 * `currentGrant` is the injected per-client grant lookup (24D-4): the host wires
 * it to the live client registry (the executor never imports the gateway). When a
 * row carries a client_id and the lookup is present, the guard re-reads that
 * client's CURRENT grant and denies if it no longer authorizes the capability.
 * All re-checks run only AFTER the hash check, so they inspect a hash-verified blob.
 */
export function revalidateGatewayProposal(
  row: RevalidationRow,
  now: number,
  classify: ClassificationLookup = classifyCapability,
  currentGrant?: CurrentGrantLookup,
): RevalidationOutcome {
  const hash = row.canonical_effect_hash;
  if (hash === null) return { kind: "legacy" };
  if (hash.length === 0) return { kind: "deny", reason: "hash_missing" };

  if (row.expires_at !== null && row.expires_at <= now) {
    return { kind: "deny", reason: "expired" };
  }

  const json = row.canonical_effect_json;
  if (json === null || json.length === 0) {
    return { kind: "deny", reason: "effect_missing" };
  }

  if (recomputeCanonicalEffectHash(json) !== hash) {
    return { kind: "deny", reason: "hash_mismatch" };
  }

  // 24D-2b: the hash proves the effect is UNCHANGED; now prove it is STILL VALID
  // against current policy. Parse the hash-verified frozen effect and re-derive.
  let frozen: FrozenEffectShape;
  try {
    frozen = JSON.parse(json) as FrozenEffectShape;
  } catch {
    return { kind: "deny", reason: "effect_unparsable" };
  }
  if (
    frozen === null ||
    typeof frozen !== "object" ||
    typeof frozen.capability !== "string" ||
    typeof frozen.approval_tier !== "string"
  ) {
    return { kind: "deny", reason: "effect_unparsable" };
  }

  const recheck = recheckFrozenEffectPolicy(
    { capability: frozen.capability, approval_tier: frozen.approval_tier },
    classify,
  );
  if (!recheck.ok) return { kind: "deny", reason: recheck.reason };

  // 24D-4 (closes E-017): the hash + policy re-checks above are client-AGNOSTIC.
  // If this approval carries a gateway client_id AND a current-grant lookup is
  // wired, re-read THAT client's CURRENT grant and DENY if it no longer authorizes
  // the frozen capability — i.e. the client's grant was revoked / narrowed away
  // between queueing and approval. A null client_id (legacy/chat) or an unwired
  // lookup leaves this UNAPPLIED (the prior behavior is byte-for-byte unchanged).
  const clientId = row.client_id ?? null;
  if (clientId !== null && clientId.length > 0 && currentGrant) {
    if (
      !clientGrantStillAuthorizes(currentGrant(clientId), frozen.capability)
    ) {
      return { kind: "deny", reason: "grant_revoked" };
    }
  }

  return { kind: "ok" };
}
