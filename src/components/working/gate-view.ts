// E-047 — the cockpit Human Gate's LIVE view (serializable, read-only).
// Mirrors voice-view.ts (E-020): the cockpit renders the honest sample fixture
// until an injected reader reports real pending rows from the operator
// decision transport (E-046). Trusted and untrusted channels stay separate all
// the way to the pixel (EoP-11 / ID-6): `canonicalEffect` is server-derived;
// `untrustedClientText` is the sanitizer's field-name summary, rendered fenced.

export type CockpitGateProvenance = "live" | "sample";

export interface CockpitGateRow {
  readonly executionId: string;
  readonly toolId: string;
  readonly toolName: string;
  readonly safetyTag: string;
  /** TRUSTED — server-derived. Never client framing. */
  readonly canonicalEffect: string;
  /** UNTRUSTED — fenced + labelled when rendered. */
  readonly untrustedClientText: string;
  /** The hash the decision is bound to (view-binding). */
  readonly boundHash: string;
  /** Single-use, short-TTL decision credential for THIS row as viewed. */
  readonly decisionToken: string;
  readonly expiresAt: number | null;
  /** false after a server restart: the row can only expire. */
  readonly operatorTokenAvailable: boolean;
}

export interface CockpitGateView {
  readonly provenance: CockpitGateProvenance;
  readonly rows: readonly CockpitGateRow[];
  readonly readAt: number;
}

export type CockpitGateDecision = "APPROVED_ONCE" | "DENIED";

export interface CockpitGateDecideInput {
  readonly executionId: string;
  readonly decision: CockpitGateDecision;
  readonly decisionToken: string;
  readonly boundHash: string;
}

export interface CockpitGateOutcome {
  readonly ok: boolean;
  readonly status?: string;
  readonly reason?: string;
  readonly message: string;
}

export type CockpitGateReader = () => Promise<CockpitGateView>;
export type CockpitGateDecider = (
  input: CockpitGateDecideInput,
) => Promise<CockpitGateOutcome>;

export function sampleCockpitGateView(): CockpitGateView {
  return { provenance: "sample", rows: [], readAt: 0 };
}

// The verdict the cockpit shows for a LIVE decision — system-fact register,
// derived only from the transport's real outcome. Never claims an audit it
// did not observe; never says "demo".
export function describeGateOutcome(
  decision: CockpitGateDecision,
  outcome: CockpitGateOutcome,
): string {
  if (decision === "DENIED") {
    return outcome.ok === false && outcome.status === "DENIED"
      ? "Denied - no side effect taken - decision persisted"
      : `Deny not applied - ${outcome.message}`;
  }
  if (outcome.ok) return "Approved - executed - verified";
  return `Approved but not executed - ${outcome.message}`;
}

export function formatGateExpiry(
  expiresAt: number | null,
  now: number,
): string {
  if (expiresAt === null) return "no expiry";
  const ms = expiresAt - now;
  if (ms <= 0) return "expired";
  const s = Math.round(ms / 1000);
  return s >= 90 ? `${Math.round(s / 60)}m` : `${s}s`;
}
