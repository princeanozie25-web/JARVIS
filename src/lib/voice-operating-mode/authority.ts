import type { StandingConsentConfig } from "./standing-consent";
import { hasStandingConsent } from "./standing-consent";

export const VOICE_AUTHORITY_TIERS = ["T0", "T1", "T2", "T3"] as const;

export type VoiceAuthorityTier = (typeof VOICE_AUTHORITY_TIERS)[number];
export type VoiceAuthorityAction =
  | "status"
  | "questions"
  | "notes"
  | "summaries"
  | "lights"
  | "timers"
  | "local_notes"
  | "external_send"
  | "file_delete"
  | "shell"
  | "restricted_device";

export type VoiceAuthorityDecision =
  | {
      readonly allowed: true;
      readonly tier: VoiceAuthorityTier;
      readonly action: VoiceAuthorityAction;
      readonly path:
        | "read_only_answer"
        | "standing_consent_action"
        | "ui_confirmed_proposal";
      readonly human_gate_required: boolean;
      readonly voice_executed: boolean;
      readonly metadata_only: true;
    }
  | {
      readonly allowed: false;
      readonly tier: VoiceAuthorityTier;
      readonly action: VoiceAuthorityAction;
      readonly reason:
        | "standing_consent_required"
        | "ui_confirmation_required"
        | "manual_only"
        | "unknown_tier";
      readonly human_gate_required: boolean;
      readonly voice_executed: false;
      readonly metadata_only: true;
    };

export interface VoiceAuthorityRequest {
  readonly tier: VoiceAuthorityTier;
  readonly action: VoiceAuthorityAction;
  readonly scope?: string;
  readonly standingConsent?: StandingConsentConfig;
  readonly uiConfirmed?: boolean;
}

export function decideVoiceAuthority(
  request: VoiceAuthorityRequest,
): VoiceAuthorityDecision {
  if (request.tier === "T0") {
    return allow(request, "read_only_answer", false, false);
  }

  if (request.tier === "T1") {
    if (
      request.standingConsent &&
      hasStandingConsent(request.standingConsent, request.action, request.scope)
    ) {
      return allow(request, "standing_consent_action", false, true);
    }
    return deny(request, "standing_consent_required", false);
  }

  if (request.tier === "T2") {
    if (request.uiConfirmed === true) {
      return allow(request, "ui_confirmed_proposal", true, false);
    }
    return deny(request, "ui_confirmation_required", true);
  }

  if (request.tier === "T3") {
    return deny(request, "manual_only", true);
  }

  return deny(request, "unknown_tier", true);
}

export function isVoiceT3ExecutionForbidden(
  request: Pick<VoiceAuthorityRequest, "tier">,
): boolean {
  return request.tier === "T3";
}

function allow(
  request: VoiceAuthorityRequest,
  path: Extract<VoiceAuthorityDecision, { allowed: true }>["path"],
  humanGateRequired: boolean,
  voiceExecuted: boolean,
): VoiceAuthorityDecision {
  return {
    allowed: true,
    tier: request.tier,
    action: request.action,
    path,
    human_gate_required: humanGateRequired,
    voice_executed: voiceExecuted,
    metadata_only: true,
  };
}

function deny(
  request: VoiceAuthorityRequest,
  reason: Extract<VoiceAuthorityDecision, { allowed: false }>["reason"],
  humanGateRequired: boolean,
): VoiceAuthorityDecision {
  return {
    allowed: false,
    tier: request.tier,
    action: request.action,
    reason,
    human_gate_required: humanGateRequired,
    voice_executed: false,
    metadata_only: true,
  };
}
