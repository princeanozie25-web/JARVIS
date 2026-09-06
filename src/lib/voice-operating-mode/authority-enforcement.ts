import {
  decideVoiceAuthority,
  type VoiceAuthorityAction,
  type VoiceAuthorityDecision,
  type VoiceAuthorityRequest,
  type VoiceAuthorityTier,
} from "./authority";

// Phase 25C (E-043) — LIVE-path hardening over the Phase 22 authority decision.
//
// decideVoiceAuthority (frozen) decides purely on the caller-supplied `tier`;
// it never checks that the `action` actually belongs to that tier. Nothing
// stops a mis-wired — or hostile — caller from asking for a destructive action
// at a permissive tier: decideVoiceAuthority({ tier: "T0", action: "shell" })
// returns a read_only_answer. On the live voice path that would be a tier
// downgrade, so this module removes the caller's discretion: every action has
// exactly ONE canonical tier, and the live entrypoint DERIVES the tier from the
// action so a lower tier can never be smuggled in.

// The single source of truth: every VoiceAuthorityAction -> its authority tier.
//   T0 read-only answers            (status, questions, notes, summaries)
//   T1 low-stakes, standing-consent (lights, timers, local_notes)
//   T2 external / UI-confirmed gate (external_send)
//   T3 destructive / manual only    (file_delete, shell, restricted_device)
export const CANONICAL_VOICE_ACTION_TIERS: Record<
  VoiceAuthorityAction,
  VoiceAuthorityTier
> = {
  status: "T0",
  questions: "T0",
  notes: "T0",
  summaries: "T0",
  lights: "T1",
  timers: "T1",
  local_notes: "T1",
  external_send: "T2",
  file_delete: "T3",
  shell: "T3",
  restricted_device: "T3",
};

export function canonicalTierForAction(
  action: VoiceAuthorityAction,
): VoiceAuthorityTier {
  return CANONICAL_VOICE_ACTION_TIERS[action];
}

// True iff a caller's claimed tier matches the action's canonical tier. The
// live path never trusts a claimed tier; this exists so a boundary that still
// receives one can detect a mismatch and fail closed (an audit signal), rather
// than silently honouring the downgrade.
export function isCanonicalVoiceTier(
  request: Pick<VoiceAuthorityRequest, "tier" | "action">,
): boolean {
  return canonicalTierForAction(request.action) === request.tier;
}

// A request WITHOUT a tier — the tier is not the caller's to state.
export type VoiceAuthorityActionRequest = Omit<VoiceAuthorityRequest, "tier">;

// The LIVE entrypoint. The tier is DERIVED from the action, never taken from
// the caller, so the decision is always made at the action's true authority.
// Standing consent / UI confirmation still apply exactly as decideVoiceAuthority
// defines them for the derived tier.
export function decideVoiceAuthorityForAction(
  request: VoiceAuthorityActionRequest,
): VoiceAuthorityDecision {
  return decideVoiceAuthority({
    ...request,
    tier: canonicalTierForAction(request.action),
  });
}
