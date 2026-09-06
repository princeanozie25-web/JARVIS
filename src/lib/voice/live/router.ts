// Voice live ROUTER — brief §14 policy, as pure, logged, testable logic.
//
//   DEFAULT            -> local
//   PREMIUM request    -> cloud realtime (only when healthy, online, under cap,
//                         and not in a local-only privacy posture)
//   PRIVATE / OFFLINE  -> local, cloud is never even considered
//   cloud unavailable  -> local
//   spend hard cap     -> local (warning threshold is logged, not enforced)
//
// Every decision carries the reason and every provider considered, so the
// evidence for "why did JARVIS pick this engine" is always on the record.
// Currency-agnostic: budgets are USD numbers the config layer converts.

import type { VoiceTelemetryEvent } from "../../voice-runtime/telemetry";
import type {
  VoiceLiveCapability,
  VoiceLiveProviderDescriptor,
  VoiceLiveProviderHealth,
} from "./contract";

export const VOICE_LIVE_MODES = [
  "auto",
  "local",
  "premium",
  "private",
  "offline",
] as const;
export type VoiceLiveMode = (typeof VOICE_LIVE_MODES)[number];

export const VOICE_LIVE_ROUTE_REASONS = [
  "default_local",
  "requested_local",
  "requested_private",
  "requested_offline",
  "privacy_local_only",
  "network_unavailable",
  "budget_hard_cap",
  "premium_selected",
  "premium_unavailable",
  "premium_credential_missing",
  "premium_disabled",
  "capability_unmet",
  "no_provider_available",
] as const;
export type VoiceLiveRouteReason = (typeof VOICE_LIVE_ROUTE_REASONS)[number];

export interface VoiceLiveBudget {
  // Spend so far in the current window (USD), and the two thresholds.
  readonly window_usd: number;
  readonly warn_usd: number;
  readonly hard_usd: number;
}

export interface VoiceLiveRouteCandidate {
  readonly descriptor: VoiceLiveProviderDescriptor;
  readonly health: VoiceLiveProviderHealth;
}

export interface VoiceLiveRouteInput {
  readonly mode: VoiceLiveMode;
  readonly privacy_local_only: boolean;
  readonly network_ok: boolean;
  readonly budget: VoiceLiveBudget;
  readonly local_provider_id: string;
  readonly premium_provider_id: string;
  readonly candidates: readonly VoiceLiveRouteCandidate[];
  readonly required_capabilities?: readonly VoiceLiveCapability[];
}

export interface VoiceLiveRouteConsidered {
  readonly provider_id: string;
  readonly selected: boolean;
  readonly rejected_because?: VoiceLiveRouteReason;
}

export interface VoiceLiveRouteDecision {
  readonly provider_id: string | null;
  readonly reason: VoiceLiveRouteReason;
  readonly budget_warning: boolean;
  readonly considered: readonly VoiceLiveRouteConsidered[];
  readonly metadata_only: true;
}

function hasCapabilities(
  descriptor: VoiceLiveProviderDescriptor,
  required: readonly VoiceLiveCapability[] | undefined,
): boolean {
  if (!required || required.length === 0) return true;
  return required.every((c) => descriptor.capabilities.includes(c));
}

function premiumFailureReason(
  health: VoiceLiveProviderHealth,
): VoiceLiveRouteReason {
  if (health.error_class === "credential_missing")
    return "premium_credential_missing";
  if (health.error_class === "disabled") return "premium_disabled";
  return "premium_unavailable";
}

export function routeVoiceLive(
  input: VoiceLiveRouteInput,
): VoiceLiveRouteDecision {
  const considered: VoiceLiveRouteConsidered[] = [];
  const budgetWarning = input.budget.window_usd >= input.budget.warn_usd;
  const overHardCap = input.budget.window_usd >= input.budget.hard_usd;

  // Why cloud is off the table, in priority order (explicit request first).
  let localOnlyReason: VoiceLiveRouteReason | null = null;
  if (input.mode === "local") localOnlyReason = "requested_local";
  else if (input.mode === "private") localOnlyReason = "requested_private";
  else if (input.mode === "offline") localOnlyReason = "requested_offline";
  else if (input.privacy_local_only) localOnlyReason = "privacy_local_only";
  else if (!input.network_ok) localOnlyReason = "network_unavailable";
  else if (overHardCap) localOnlyReason = "budget_hard_cap";

  const premium = input.candidates.find(
    (c) => c.descriptor.provider_id === input.premium_provider_id,
  );
  const local = input.candidates.find(
    (c) => c.descriptor.provider_id === input.local_provider_id,
  );

  let fallbackReason: VoiceLiveRouteReason = localOnlyReason ?? "default_local";

  if (input.mode === "premium" && localOnlyReason === null) {
    if (!premium) {
      fallbackReason = "premium_unavailable";
    } else if (
      !hasCapabilities(premium.descriptor, input.required_capabilities)
    ) {
      considered.push({
        provider_id: premium.descriptor.provider_id,
        selected: false,
        rejected_because: "capability_unmet",
      });
      fallbackReason = "capability_unmet";
    } else if (!premium.health.ok) {
      const reason = premiumFailureReason(premium.health);
      considered.push({
        provider_id: premium.descriptor.provider_id,
        selected: false,
        rejected_because: reason,
      });
      fallbackReason = reason;
    } else {
      considered.push({
        provider_id: premium.descriptor.provider_id,
        selected: true,
      });
      return {
        provider_id: premium.descriptor.provider_id,
        reason: "premium_selected",
        budget_warning: budgetWarning,
        considered,
        metadata_only: true,
      };
    }
  } else if (premium && localOnlyReason !== null) {
    // Cloud was never eligible; record that it was excluded and why.
    considered.push({
      provider_id: premium.descriptor.provider_id,
      selected: false,
      rejected_because: localOnlyReason,
    });
  }

  if (!local) {
    return {
      provider_id: null,
      reason: "no_provider_available",
      budget_warning: budgetWarning,
      considered,
      metadata_only: true,
    };
  }
  if (!hasCapabilities(local.descriptor, input.required_capabilities)) {
    considered.push({
      provider_id: local.descriptor.provider_id,
      selected: false,
      rejected_because: "capability_unmet",
    });
    return {
      provider_id: null,
      reason: "capability_unmet",
      budget_warning: budgetWarning,
      considered,
      metadata_only: true,
    };
  }
  if (!local.health.ok) {
    considered.push({
      provider_id: local.descriptor.provider_id,
      selected: false,
      rejected_because: "no_provider_available",
    });
    return {
      provider_id: null,
      reason: "no_provider_available",
      budget_warning: budgetWarning,
      considered,
      metadata_only: true,
    };
  }
  considered.push({
    provider_id: local.descriptor.provider_id,
    selected: true,
  });
  return {
    provider_id: local.descriptor.provider_id,
    reason: fallbackReason,
    budget_warning: budgetWarning,
    considered,
    metadata_only: true,
  };
}

// The decision as a frozen-contract telemetry event (allowlisted fields only):
// the reason rides in event_type, the choice in provider_id, the budget
// warning in `degraded`. Never a transcript, never a key.
export function voiceLiveRouteTelemetry(
  decision: VoiceLiveRouteDecision,
  sessionId: string,
  timestamp: string,
): VoiceTelemetryEvent {
  return {
    event_type: `voice_live.route.${decision.reason}`,
    session_id: sessionId,
    ...(decision.provider_id ? { provider_id: decision.provider_id } : {}),
    degraded: decision.budget_warning || decision.provider_id === null,
    redaction_status: "metadata_only",
    timestamp,
  };
}
