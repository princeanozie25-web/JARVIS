import type {
  WakeWordPolicy,
  WakeWordPolicyDecision,
  WakeWordPolicyDenialReason,
  WakeWordPolicyValidationResult,
} from "./types";

export const WAKE_WORD_POLICY_LIMITS = {
  min_activation_window_ms: 250,
  max_activation_window_ms: 30_000,
} as const;

export const DEFAULT_WAKE_WORD_POLICY: WakeWordPolicy = {
  enabled: false,
  explicit_opt_in: false,
  local_only: true,
  visible_mic_indicator_required: true,
  hard_kill_switch_enabled: true,
  push_to_talk_fallback_required: true,
  max_activation_window_ms: 5000,
  allow_cloud_detection: false,
  allow_pre_wake_transcription: false,
  allow_raw_audio_persistence: false,
  allow_wake_triggered_tools: false,
  allow_wake_triggered_approval: false,
  allow_autonomous_loop: false,
  metadata_only: true,
};

export function createDefaultWakeWordPolicy(): WakeWordPolicy {
  return { ...DEFAULT_WAKE_WORD_POLICY };
}

export function validateWakeWordPolicy(
  value: unknown,
): WakeWordPolicyValidationResult {
  if (!isWakeWordPolicyShape(value)) {
    return failure(["malformed_policy"]);
  }

  const reasons: WakeWordPolicyDenialReason[] = [];
  if (value.enabled !== true) reasons.push("wake_word_disabled");
  if (value.explicit_opt_in !== true) {
    reasons.push("explicit_opt_in_required");
  }
  if (value.local_only !== true) reasons.push("local_only_required");
  if (value.visible_mic_indicator_required !== true) {
    reasons.push("visible_mic_indicator_required");
  }
  if (value.hard_kill_switch_enabled !== true) {
    reasons.push("hard_kill_switch_required");
  }
  if (value.push_to_talk_fallback_required !== true) {
    reasons.push("push_to_talk_fallback_required");
  }
  if (
    value.max_activation_window_ms <
      WAKE_WORD_POLICY_LIMITS.min_activation_window_ms ||
    value.max_activation_window_ms >
      WAKE_WORD_POLICY_LIMITS.max_activation_window_ms
  ) {
    reasons.push("activation_window_out_of_bounds");
  }
  if (value.allow_cloud_detection) reasons.push("cloud_detection_forbidden");
  if (value.allow_pre_wake_transcription) {
    reasons.push("pre_wake_transcription_forbidden");
  }
  if (value.allow_raw_audio_persistence) {
    reasons.push("raw_audio_persistence_forbidden");
  }
  if (value.allow_wake_triggered_tools) {
    reasons.push("wake_triggered_tools_forbidden");
  }
  if (value.allow_wake_triggered_approval) {
    reasons.push("wake_triggered_approval_forbidden");
  }
  if (value.allow_autonomous_loop) reasons.push("autonomous_loop_forbidden");

  if (reasons.length > 0) return failure(reasons);
  return {
    ok: true,
    policy: { ...value },
    reasons: [],
    metadata_only: true,
  };
}

export function canArmWakeWord(policy: unknown): WakeWordPolicyDecision {
  const validation = validateWakeWordPolicy(policy);
  if (!validation.ok) {
    return deny(validation.reasons[0] ?? "malformed_policy");
  }
  return allow();
}

export function canOpenActivationWindow(
  policy: unknown,
  requestedWindowMs: unknown,
): WakeWordPolicyDecision {
  const validation = validateWakeWordPolicy(policy);
  if (!validation.ok) {
    return deny(validation.reasons[0] ?? "malformed_policy");
  }
  if (
    typeof requestedWindowMs !== "number" ||
    !Number.isInteger(requestedWindowMs) ||
    requestedWindowMs <= 0 ||
    requestedWindowMs > validation.policy.max_activation_window_ms
  ) {
    return deny("activation_window_out_of_bounds");
  }
  return allow();
}

function allow(): WakeWordPolicyDecision {
  return {
    allowed: true,
    reason: null,
    metadata_only: true,
  };
}

function deny(reason: WakeWordPolicyDenialReason): WakeWordPolicyDecision {
  return {
    allowed: false,
    reason,
    metadata_only: true,
  };
}

function failure(
  reasons: readonly WakeWordPolicyDenialReason[],
): WakeWordPolicyValidationResult {
  return {
    ok: false,
    policy: null,
    reasons: [...new Set(reasons)],
    metadata_only: true,
  };
}

const WAKE_WORD_POLICY_KEYS = [
  "enabled",
  "explicit_opt_in",
  "local_only",
  "visible_mic_indicator_required",
  "hard_kill_switch_enabled",
  "push_to_talk_fallback_required",
  "max_activation_window_ms",
  "allow_cloud_detection",
  "allow_pre_wake_transcription",
  "allow_raw_audio_persistence",
  "allow_wake_triggered_tools",
  "allow_wake_triggered_approval",
  "allow_autonomous_loop",
  "metadata_only",
] as const;

function isWakeWordPolicyShape(value: unknown): value is WakeWordPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record, WAKE_WORD_POLICY_KEYS)) return false;
  return (
    typeof record.enabled === "boolean" &&
    typeof record.explicit_opt_in === "boolean" &&
    typeof record.local_only === "boolean" &&
    typeof record.visible_mic_indicator_required === "boolean" &&
    typeof record.hard_kill_switch_enabled === "boolean" &&
    typeof record.push_to_talk_fallback_required === "boolean" &&
    typeof record.max_activation_window_ms === "number" &&
    Number.isInteger(record.max_activation_window_ms) &&
    typeof record.allow_cloud_detection === "boolean" &&
    typeof record.allow_pre_wake_transcription === "boolean" &&
    typeof record.allow_raw_audio_persistence === "boolean" &&
    typeof record.allow_wake_triggered_tools === "boolean" &&
    typeof record.allow_wake_triggered_approval === "boolean" &&
    typeof record.allow_autonomous_loop === "boolean" &&
    record.metadata_only === true
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
