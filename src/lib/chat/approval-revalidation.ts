// FC-2 approval-time re-validation (24C-2b) — executor-side leaf.
//
// A gateway-originated proposal (24C-2) was hash-frozen at submission. This leaf
// re-validates it at the human-decision point, BEFORE runtime.runTool, closing
// the TOCTOU window (EoP-8 / EoP-14): the human approves a specific hash; the
// executor must run ONLY that hash. If the frozen effect or its hash drifted, or
// the proposal expired, the approval is no longer valid.
//
// This module imports ONLY node:crypto. It does NOT import the gateway (the
// executor must never depend on src/lib/mcp-gateway/). It recomputes the FC-2
// hash from the stored canonical_effect_json — the EXACT stable serialization the
// gateway hashed — so the algorithm here is a one-line digest, not a re-implement
// of the gateway's key-sorting. A cross-check test pins this to the gateway's
// computeCanonicalEffectHash so the two can never drift.

import { createHash } from "node:crypto";

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
  | "hash_mismatch"; // recomputed hash != stored hash (the effect/hash drifted)

/** The subset of the approval row the guard needs. */
export interface RevalidationRow {
  canonical_effect_hash: string | null;
  canonical_effect_json: string | null;
  expires_at: number | null;
}

export type RevalidationOutcome =
  | { kind: "legacy" } // no canonical_effect_hash: a normal chat approval, proceed unchanged
  | { kind: "ok" } // gateway proposal, still valid: proceed
  | { kind: "deny"; reason: RevalidationFailureReason };

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
 *   - otherwise                       -> ok
 */
export function revalidateGatewayProposal(
  row: RevalidationRow,
  now: number,
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

  return { kind: "ok" };
}
