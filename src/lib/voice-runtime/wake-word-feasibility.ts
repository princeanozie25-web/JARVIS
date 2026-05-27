export const WAKE_WORD_MODES = [
  "disabled",
  "future_optional_local_only",
] as const;

export const WAKE_WORD_INVARIANTS = [
  "visible_mic_active_indicator",
  "explicit_user_opt_in",
  "local_only_wake_detection",
  "no_pre_wake_transcript_persistence",
  "no_raw_audio_persistence",
  "no_cloud_wake_processing",
  "hard_kill_switch",
  "push_to_talk_fallback",
  "explicit_wake_session_boundaries",
  "bounded_activation_timeout",
  "no_hidden_background_capture_state",
  "no_silent_background_transcription",
  "no_hidden_mic_state",
  "no_automatic_approval_execution",
  "no_cloud_wake_routing",
  "no_wake_triggered_autonomous_loops",
  "no_wake_triggered_tool_execution",
  "no_always_listening_without_visible_state",
  "metadata_only_feasibility_output",
] as const;

export const WAKE_WORD_GOVERNANCE_REQUIREMENTS = [
  "voice_transport_only",
  "runtime_governance_remains_authoritative",
  "approval_layers_remain_authoritative",
  "safety_layers_remain_authoritative",
  "metadata_only_feasibility_output",
] as const;

export type WakeWordMode = (typeof WAKE_WORD_MODES)[number];
export type WakeWordInvariant = (typeof WAKE_WORD_INVARIANTS)[number];
export type WakeWordGovernanceRequirement =
  (typeof WAKE_WORD_GOVERNANCE_REQUIREMENTS)[number];

export interface WakeWordActivationPolicy {
  readonly mode: WakeWordMode;
  readonly visible_mic_active_indicator: boolean;
  readonly explicit_user_opt_in: boolean;
  readonly local_only_wake_detection: boolean;
  readonly pre_wake_transcript_persistence: false;
  readonly raw_audio_persistence: false;
  readonly cloud_wake_processing: false;
  readonly hard_kill_switch: boolean;
  readonly push_to_talk_fallback: boolean;
  readonly explicit_wake_session_boundaries: boolean;
  readonly bounded_activation_timeout_ms: number;
  readonly hidden_background_capture_state: false;
  readonly silent_background_transcription: false;
  readonly hidden_mic_state: false;
  readonly automatic_approval_execution: false;
  readonly cloud_wake_routing: false;
  readonly wake_triggered_autonomous_loops: false;
  readonly wake_triggered_tool_execution: false;
  readonly always_listening_without_visible_state: false;
  readonly voice_transport_only: true;
  readonly runtime_governance_remains_authoritative: true;
  readonly approval_layers_remain_authoritative: true;
  readonly safety_layers_remain_authoritative: true;
  readonly metadata_only: true;
}

export type WakeWordFeasibilityResult =
  | {
      readonly ok: true;
      readonly feasible: true;
      readonly mode: WakeWordMode;
      readonly missing_invariants: readonly [];
      readonly violated_invariants: readonly [];
      readonly governance_requirements: readonly WakeWordGovernanceRequirement[];
      readonly explanation: readonly string[];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly feasible: false;
      readonly mode: WakeWordMode | null;
      readonly missing_invariants: readonly WakeWordInvariant[];
      readonly violated_invariants: readonly WakeWordInvariant[];
      readonly governance_requirements: readonly WakeWordGovernanceRequirement[];
      readonly explanation: readonly string[];
      readonly metadata_only: true;
    };

export function evaluateWakeWordFeasibility(
  policy: unknown,
): WakeWordFeasibilityResult {
  const validation = validateWakeWordGovernance(policy);
  if (!validation.ok) return validation;

  return {
    ok: true,
    feasible: true,
    mode: validation.mode,
    missing_invariants: [],
    violated_invariants: [],
    governance_requirements: [...WAKE_WORD_GOVERNANCE_REQUIREMENTS],
    explanation: explainWakeWordConstraints(validation.mode),
    metadata_only: true,
  };
}

export function validateWakeWordGovernance(
  policy: unknown,
): WakeWordFeasibilityResult {
  if (!isRecord(policy)) {
    return fail(
      null,
      WAKE_WORD_INVARIANTS,
      [],
      [
        "Wake-word feasibility requires an explicit metadata-only policy object.",
      ],
    );
  }
  if (!hasExactKeys(policy, WAKE_WORD_POLICY_KEYS)) {
    return fail(
      readMode(policy.mode),
      ["metadata_only_feasibility_output"],
      [],
      ["Wake-word feasibility rejects unknown or missing policy fields."],
    );
  }

  const mode = readMode(policy.mode);
  if (mode === null) {
    return fail(
      null,
      ["metadata_only_feasibility_output"],
      [],
      ["Wake-word mode must be disabled or future_optional_local_only."],
    );
  }

  const missing: WakeWordInvariant[] = [];
  const violated: WakeWordInvariant[] = [];
  requireTrue(
    policy.visible_mic_active_indicator,
    "visible_mic_active_indicator",
    missing,
  );
  requireTrue(policy.explicit_user_opt_in, "explicit_user_opt_in", missing);
  requireTrue(
    policy.local_only_wake_detection,
    "local_only_wake_detection",
    missing,
  );
  requireFalse(
    policy.pre_wake_transcript_persistence,
    "no_pre_wake_transcript_persistence",
    violated,
  );
  requireFalse(
    policy.raw_audio_persistence,
    "no_raw_audio_persistence",
    violated,
  );
  requireFalse(
    policy.cloud_wake_processing,
    "no_cloud_wake_processing",
    violated,
  );
  requireTrue(policy.hard_kill_switch, "hard_kill_switch", missing);
  requireTrue(policy.push_to_talk_fallback, "push_to_talk_fallback", missing);
  requireTrue(
    policy.explicit_wake_session_boundaries,
    "explicit_wake_session_boundaries",
    missing,
  );
  if (
    typeof policy.bounded_activation_timeout_ms !== "number" ||
    !Number.isInteger(policy.bounded_activation_timeout_ms) ||
    policy.bounded_activation_timeout_ms <= 0 ||
    policy.bounded_activation_timeout_ms > 30_000
  ) {
    missing.push("bounded_activation_timeout");
  }
  requireFalse(
    policy.hidden_background_capture_state,
    "no_hidden_background_capture_state",
    violated,
  );
  requireFalse(
    policy.silent_background_transcription,
    "no_silent_background_transcription",
    violated,
  );
  requireFalse(policy.hidden_mic_state, "no_hidden_mic_state", violated);
  requireFalse(
    policy.automatic_approval_execution,
    "no_automatic_approval_execution",
    violated,
  );
  requireFalse(policy.cloud_wake_routing, "no_cloud_wake_routing", violated);
  requireFalse(
    policy.wake_triggered_autonomous_loops,
    "no_wake_triggered_autonomous_loops",
    violated,
  );
  requireFalse(
    policy.wake_triggered_tool_execution,
    "no_wake_triggered_tool_execution",
    violated,
  );
  requireFalse(
    policy.always_listening_without_visible_state,
    "no_always_listening_without_visible_state",
    violated,
  );

  if (policy.voice_transport_only !== true) {
    missing.push("no_wake_triggered_autonomous_loops");
  }
  if (
    policy.runtime_governance_remains_authoritative !== true ||
    policy.approval_layers_remain_authoritative !== true ||
    policy.safety_layers_remain_authoritative !== true
  ) {
    violated.push("no_automatic_approval_execution");
  }
  if (policy.metadata_only !== true) {
    violated.push("no_pre_wake_transcript_persistence");
  }

  const uniqueMissing = unique(missing);
  const uniqueViolated = unique(violated);
  if (uniqueMissing.length > 0 || uniqueViolated.length > 0) {
    return fail(
      mode,
      uniqueMissing,
      uniqueViolated,
      explainWakeWordConstraints(mode),
    );
  }

  return {
    ok: true,
    feasible: true,
    mode,
    missing_invariants: [],
    violated_invariants: [],
    governance_requirements: [...WAKE_WORD_GOVERNANCE_REQUIREMENTS],
    explanation: explainWakeWordConstraints(mode),
    metadata_only: true,
  };
}

export function explainWakeWordConstraints(
  mode: WakeWordMode = "future_optional_local_only",
): readonly string[] {
  return [
    `Wake-word mode ${mode} is feasibility-only and does not implement detection.`,
    "A future wake-word layer must be explicit opt-in, visible, local-only, and bounded.",
    "Pre-wake transcripts, raw audio persistence, cloud wake processing, hidden mic state, autonomous loops, tool execution, and approval execution remain forbidden.",
    "Push-to-talk fallback, hard kill switch, and explicit wake session boundaries are mandatory.",
  ];
}

function fail(
  mode: WakeWordMode | null,
  missing: readonly WakeWordInvariant[],
  violated: readonly WakeWordInvariant[],
  explanation: readonly string[],
): WakeWordFeasibilityResult {
  return {
    ok: false,
    feasible: false,
    mode,
    missing_invariants: unique(missing),
    violated_invariants: unique(violated),
    governance_requirements: [...WAKE_WORD_GOVERNANCE_REQUIREMENTS],
    explanation: [...explanation],
    metadata_only: true,
  };
}

const WAKE_WORD_POLICY_KEYS = [
  "mode",
  "visible_mic_active_indicator",
  "explicit_user_opt_in",
  "local_only_wake_detection",
  "pre_wake_transcript_persistence",
  "raw_audio_persistence",
  "cloud_wake_processing",
  "hard_kill_switch",
  "push_to_talk_fallback",
  "explicit_wake_session_boundaries",
  "bounded_activation_timeout_ms",
  "hidden_background_capture_state",
  "silent_background_transcription",
  "hidden_mic_state",
  "automatic_approval_execution",
  "cloud_wake_routing",
  "wake_triggered_autonomous_loops",
  "wake_triggered_tool_execution",
  "always_listening_without_visible_state",
  "voice_transport_only",
  "runtime_governance_remains_authoritative",
  "approval_layers_remain_authoritative",
  "safety_layers_remain_authoritative",
  "metadata_only",
] as const;

function requireTrue(
  value: unknown,
  invariant: WakeWordInvariant,
  missing: WakeWordInvariant[],
): void {
  if (value !== true) missing.push(invariant);
}

function requireFalse(
  value: unknown,
  invariant: WakeWordInvariant,
  violated: WakeWordInvariant[],
): void {
  if (value !== false) violated.push(invariant);
}

function readMode(value: unknown): WakeWordMode | null {
  return value === "disabled" || value === "future_optional_local_only"
    ? value
    : null;
}

function unique<T extends string>(items: readonly T[]): readonly T[] {
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
