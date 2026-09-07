// Self Model (E-050) — reconciliation and freshness.
//
// Sources never see each other. Here their claims about the same SUBJECT
// meet: the highest trust class wins, disagreeing losers are kept on the
// winner as contradictions (so `self.explain` can show "the registry says
// operational, the live probe says offline"), and every claim is stamped
// with a freshness state relative to `now`.
import {
  SELF_TRUST_PRECEDENCE,
  type SelfClaim,
  type SelfClaimStatus,
  type SelfFreshnessState,
} from "./contracts";

const MAX_EVIDENCE = 12;
const MAX_CONTRADICTIONS = 12;

function precedence(c: SelfClaim): number {
  return SELF_TRUST_PRECEDENCE[c.trust_class];
}

function observedMs(c: SelfClaim): number {
  const t = Date.parse(c.observed_at);
  return Number.isFinite(t) ? t : 0;
}

/** Winner first: higher trust, then more recent observation. */
export function compareClaims(a: SelfClaim, b: SelfClaim): number {
  const p = precedence(b) - precedence(a);
  if (p !== 0) return p;
  return observedMs(b) - observedMs(a);
}

export function reconcileClaims(claims: readonly SelfClaim[]): SelfClaim[] {
  const bySubject = new Map<string, SelfClaim[]>();
  for (const c of claims) {
    const bucket = bySubject.get(c.subject);
    if (bucket) bucket.push(c);
    else bySubject.set(c.subject, [c]);
  }
  const out: SelfClaim[] = [];
  for (const bucket of bySubject.values()) {
    const sorted = [...bucket].sort(compareClaims);
    const winner = sorted[0]!;
    const evidence = [...winner.evidence];
    const contradictions = [...winner.contradictions];
    for (const loser of sorted.slice(1)) {
      if (loser.status !== winner.status) {
        contradictions.push({
          status: loser.status,
          trust_class: loser.trust_class,
          ref: loser.evidence[0]!.ref,
        });
      }
      // Agreeing (or overruled) sources still count as evidence trail.
      for (const e of loser.evidence) {
        if (!evidence.some((x) => x.ref === e.ref && x.kind === e.kind))
          evidence.push(e);
      }
    }
    out.push({
      ...winner,
      evidence: evidence.slice(0, MAX_EVIDENCE),
      contradictions: contradictions.slice(0, MAX_CONTRADICTIONS),
    });
  }
  return out.sort((a, b) => a.claim_id.localeCompare(b.claim_id));
}

export function freshnessOf(
  claim: SelfClaim,
  nowMs: number,
): SelfFreshnessState {
  if (
    claim.status === "unknown" &&
    claim.evidence.every((e) => e.kind === "unavailable")
  )
    return "unknown";
  if (claim.ttl_ms === null) return "static";
  const age = nowMs - observedMs(claim);
  return age <= claim.ttl_ms ? "fresh" : "stale";
}

/** A stale live claim must not be reported as current truth: it decays to
 *  "unknown" while keeping its last observed status in the statement. */
export function decayStaleClaim(claim: SelfClaim, nowMs: number): SelfClaim {
  if (freshnessOf(claim, nowMs) !== "stale") return claim;
  if (claim.status === "unknown") return claim;
  const last: SelfClaimStatus = claim.status;
  return {
    ...claim,
    status: "unknown",
    statement:
      `${claim.statement} (last observed ${last} at ${claim.observed_at}; probe result expired)`.slice(
        0,
        400,
      ),
  };
}
