export const WAKE_WORD_LIFECYCLE_STATES = [
  "disabled",
  "available",
  "armed",
  "detecting",
  "wake_detected",
  "activation_window",
  "expired",
  "cancelled",
  "failed",
] as const;

export const WAKE_WORD_STATE_EVENTS = [
  "enable",
  "arm",
  "begin_detection",
  "wake_detected",
  "open_activation_window",
  "expire",
  "cancel",
  "fail",
  "reset",
  "disable",
] as const;

export const WAKE_WORD_TERMINAL_STATES = [
  "expired",
  "cancelled",
  "failed",
] as const;

export const WAKE_WORD_CONFIDENCE_BANDS = ["low", "medium", "high"] as const;

export type WakeWordLifecycleState =
  (typeof WAKE_WORD_LIFECYCLE_STATES)[number];
export type WakeWordStateEvent = (typeof WAKE_WORD_STATE_EVENTS)[number];
export type WakeWordTerminalState = (typeof WAKE_WORD_TERMINAL_STATES)[number];
export type WakeWordConfidenceBand =
  (typeof WAKE_WORD_CONFIDENCE_BANDS)[number];

export type WakeWordStateTransitionFailureReason =
  | "invalid_state"
  | "invalid_event"
  | "invalid_transition";

export type WakeWordPolicyDenialReason =
  | "wake_word_disabled"
  | "explicit_opt_in_required"
  | "local_only_required"
  | "visible_mic_indicator_required"
  | "hard_kill_switch_required"
  | "push_to_talk_fallback_required"
  | "activation_window_out_of_bounds"
  | "cloud_detection_forbidden"
  | "pre_wake_transcription_forbidden"
  | "raw_audio_persistence_forbidden"
  | "wake_triggered_tools_forbidden"
  | "wake_triggered_approval_forbidden"
  | "autonomous_loop_forbidden"
  | "malformed_policy";

export interface WakeWordPolicy {
  readonly enabled: boolean;
  readonly explicit_opt_in: boolean;
  readonly local_only: boolean;
  readonly visible_mic_indicator_required: boolean;
  readonly hard_kill_switch_enabled: boolean;
  readonly push_to_talk_fallback_required: boolean;
  readonly max_activation_window_ms: number;
  readonly allow_cloud_detection: boolean;
  readonly allow_pre_wake_transcription: boolean;
  readonly allow_raw_audio_persistence: boolean;
  readonly allow_wake_triggered_tools: boolean;
  readonly allow_wake_triggered_approval: boolean;
  readonly allow_autonomous_loop: boolean;
  readonly metadata_only: true;
}

export type WakeWordPolicyValidationResult =
  | {
      readonly ok: true;
      readonly policy: WakeWordPolicy;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly policy: null;
      readonly reasons: readonly WakeWordPolicyDenialReason[];
      readonly metadata_only: true;
    };

export type WakeWordPolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: null;
      readonly metadata_only: true;
    }
  | {
      readonly allowed: false;
      readonly reason: WakeWordPolicyDenialReason;
      readonly metadata_only: true;
    };

export type WakeWordStateTransitionResult =
  | {
      readonly ok: true;
      readonly previous_state: WakeWordLifecycleState;
      readonly event: WakeWordStateEvent;
      readonly next_state: WakeWordLifecycleState;
      readonly activation_window_ms?: number;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly previous_state: WakeWordLifecycleState | null;
      readonly event: WakeWordStateEvent | null;
      readonly next_state: null;
      readonly reason: WakeWordStateTransitionFailureReason;
      readonly metadata_only: true;
    };

export interface WakeWordProviderDetectionResult {
  readonly provider_id: string;
  readonly wake_detected: boolean;
  readonly confidence_band: WakeWordConfidenceBand;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface WakeWordProviderHealth {
  readonly provider_id: string;
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly checked_at_ms?: number;
  readonly error_class?: "unavailable" | "provider_error" | "policy_blocked";
  readonly metadata_only: true;
}

export interface WakeWordProviderOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}
