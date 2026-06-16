// MCP gateway — GATE-5: the enqueue needle's eye + the submit pipeline (24C-2).
//
// This is the FIRST gateway write-adjacent capability. The allowlist lets the
// gateway touch exactly ONE boundary: enqueueing a pending proposal. If that
// boundary accepted anything beyond a fully server-built canonical proposal, the
// boundary itself would become the new mutator. So it is a NEEDLE'S EYE: it
// accepts ONLY the exact server-built CanonicalProposal and REJECTS — visibly,
// not by stripping — any client effect/hash/client_id/status/approval/metadata.
//
// The actual write happens through an INJECTED EnqueueProposal function the host
// wires to the real db createPendingApproval path OUTSIDE the gateway import
// graph — so db/ and approval-runtime/ never enter the gateway's graph (GATE-2).
//
// THIS SLICE STOPS AT `pending`. No approval, no execution, no runtime.runTool.
// The proposal awaits the human; the executor-side re-validation guard is 24C-2b.

import {
  canonicalizeProposalRequest,
  type CanonicalEffect,
  type ToolMetadataLookup,
} from "./canonicalize";
import {
  buildCanonicalProposal,
  CanonicalProposalSchema,
  computeCanonicalEffectHash,
  computeScopeSnapshotHash,
  type CanonicalProposal,
} from "./proposal";
import { findForbiddenFields } from "./sanitizer";
import { checkProposeScope, type ClientScope } from "./scope";

/** The injected write boundary. The host wires this to the real
 * createPendingApproval (db), OUTSIDE the gateway import graph. It performs the
 * pure write of an already-validated proposal and returns the persisted id. */
export type EnqueueProposal = (proposal: CanonicalProposal) => {
  proposal_id: string;
};

export type EnqueueRejectionReason =
  | "malformed_proposal" // failed the strict shape (extra/forbidden top-level or effect field)
  | "no_provenance" // EoP-5: no server-derived client_id
  | "hash_mismatch" // canonical_effect_hash != server recomputation (forged hash)
  | "scope_hash_mismatch" // scope_snapshot_ref_hash != server recomputation
  | "sanitizer_blocked" // the effect leaked a raw payload/path/secret
  | "enqueue_failed"; // the injected boundary threw

export type EnqueueOutcome =
  | { ok: true; proposal_id: string }
  | { ok: false; reason: EnqueueRejectionReason };

/**
 * GATE-5 needle's eye. Accepts ONLY a fully server-built canonical proposal and
 * enqueues it via the injected boundary. Every gate below is fail-closed:
 *   1. strict shape  — rejects status/approval/decision/metadata/extra fields,
 *                      and any client-injected effect field (CanonicalEffectSchema
 *                      is strict).
 *   2. provenance    — a missing/blank client_id is rejected (EoP-5: no origin,
 *                      no queue).
 *   3. hash integrity— the canonical_effect_hash and scope_snapshot_ref_hash MUST
 *                      equal the server's recomputation; a client-forged hash is
 *                      rejected.
 *   4. metadata-only — the canonical effect must pass the leaf sanitizer (the
 *                      hash digests themselves are server-computed references, not
 *                      raw content, so the content surface that is checked is the
 *                      effect).
 */
export function enqueueCanonicalProposal(
  proposal: unknown,
  enqueue: EnqueueProposal,
): EnqueueOutcome {
  const parsed = CanonicalProposalSchema.safeParse(proposal);
  if (!parsed.success) return { ok: false, reason: "malformed_proposal" };
  const p = parsed.data as CanonicalProposal;

  if (p.client_id.trim().length === 0) {
    return { ok: false, reason: "no_provenance" };
  }
  if (
    p.canonical_effect_hash !== computeCanonicalEffectHash(p.canonical_effect)
  ) {
    return { ok: false, reason: "hash_mismatch" };
  }
  if (
    p.scope_snapshot_ref_hash !== computeScopeSnapshotHash(p.canonical_effect)
  ) {
    return { ok: false, reason: "scope_hash_mismatch" };
  }
  // The leak-prone surface is the effect (+ its summary); the *_hash fields are
  // one-way sha256 digests of that already-masked effect, not raw content.
  if (findForbiddenFields(p.canonical_effect).length > 0) {
    return { ok: false, reason: "sanitizer_blocked" };
  }

  try {
    const result = enqueue(p);
    return { ok: true, proposal_id: result.proposal_id };
  } catch {
    return { ok: false, reason: "enqueue_failed" };
  }
}

export interface SubmitProposalDeps {
  /** FC-1 registry lookup (narrow projection). */
  lookup: ToolMetadataLookup;
  /** EoP-5 provenance: the server-derived client_id from the identity seam. A
   * null/absent identity means the submit is rejected, not queued. */
  clientId: string | null;
  /** GATE-5 injected write boundary (host -> real createPendingApproval). */
  enqueue: EnqueueProposal;
  now_ms: number;
  ttl_ms: number;
  /** Per-client scope (24D-2a). When supplied, the proposal is scope-checked on
   * the client's identity before freeze (EoP-13 + EoP-4). An FC-3 client always
   * carries one; absent (undefined) is the legacy/unscoped path. */
  scope?: ClientScope | null;
  /** Injectable for deterministic tests. */
  proposal_id?: string;
}

export type SubmitOutcome =
  | {
      ok: true;
      proposal_id: string;
      canonical_effect: CanonicalEffect;
    }
  | {
      ok: false;
      stage: "canonicalize" | "scope" | "provenance" | "enqueue";
      reason: string;
    };

/**
 * The ONLY submit path: FC-1 canonicalize -> EoP-5 provenance -> FC-2 freeze ->
 * GATE-5 enqueue. The client supplies ONLY { tool, args } (FC-1's strict schema
 * rejects anything else); the client_id is the server's, from the identity seam.
 * There is no path here to approval or execution — the proposal sits `pending`.
 */
export function submitProposalRequest(
  rawClientRequest: unknown,
  deps: SubmitProposalDeps,
): SubmitOutcome {
  const canon = canonicalizeProposalRequest(rawClientRequest, deps.lookup);
  if (!canon.ok) {
    return { ok: false, stage: "canonicalize", reason: canon.reason };
  }

  // SCOPE-CHECK (24D-2a): enforce the client's GRANTED scope on the server-derived
  // effect, on the client's identity (EoP-4), BEFORE freeze/enqueue. Enforced only
  // when a scope is supplied — an FC-3 client always carries one; a null scope
  // denies (fail-closed); undefined is the legacy/unscoped path.
  if (deps.scope !== undefined) {
    const scopeResult = checkProposeScope({
      capability: canon.canonical_effect.capability,
      rawTarget: canon.raw_target,
      args: canon.args,
      ttlMs: deps.ttl_ms,
      scope: deps.scope,
    });
    if (!scopeResult.ok) {
      return { ok: false, stage: "scope", reason: scopeResult.reason };
    }
  }

  if (!deps.clientId || deps.clientId.trim().length === 0) {
    return { ok: false, stage: "provenance", reason: "no_provenance" };
  }

  const proposal = buildCanonicalProposal({
    canonical_effect: canon.canonical_effect,
    client_id: deps.clientId,
    now_ms: deps.now_ms,
    ttl_ms: deps.ttl_ms,
    proposal_id: deps.proposal_id,
  });

  const enqueued = enqueueCanonicalProposal(proposal, deps.enqueue);
  if (!enqueued.ok) {
    return { ok: false, stage: "enqueue", reason: enqueued.reason };
  }

  return {
    ok: true,
    proposal_id: enqueued.proposal_id,
    canonical_effect: canon.canonical_effect,
  };
}
