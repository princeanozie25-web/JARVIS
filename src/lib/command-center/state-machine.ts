import {
  COMMAND_CENTER_DISABLED_FEATURES,
  CommandCenterDisabledFeatureGuardSchema,
  CommandCenterDisabledFeatureGuardValidationSchema,
  CommandCenterIdleWakePolicySchema,
  CommandCenterShellConfigSchema,
  CommandCenterShellStateSchema,
  CommandCenterTransitionEventSchema,
  CommandCenterTransitionResultSchema,
  type CommandCenterDisabledFeature,
  type CommandCenterDisabledFeatureGuard,
  type CommandCenterDisabledFeatureGuardValidation,
  type CommandCenterIdleWakePolicy,
  type CommandCenterMode,
  type CommandCenterShellConfig,
  type CommandCenterShellState,
  type CommandCenterSideEffectSnapshot,
  type CommandCenterTransitionEvent,
  type CommandCenterTransitionEventType,
  type CommandCenterTransitionReason,
  type CommandCenterTransitionResult,
} from "./types";

export const DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT: CommandCenterSideEffectSnapshot =
  {
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    routine_scheduled: false,
    routine_triggered: false,
    memory_written: false,
    project_written: false,
    device_action_triggered: false,
    cloud_fallback_triggered: false,
    db_write_performed: false,
    network_called: false,
    audio_capture_started: false,
    video_capture_started: false,
  };

export const DEFAULT_COMMAND_CENTER_IDLE_WAKE_POLICY: CommandCenterIdleWakePolicy =
  CommandCenterIdleWakePolicySchema.parse({
    kind: "command_center.idle_wake_policy",
    version: 1,
    wake_word_enabled: false,
    microphone_wake_enabled: false,
    camera_wake_enabled: false,
    presence_wake_enabled: false,
    user_input_only_wake: true,
    automatic_wake_enabled: false,
    idle_return_to_rest_allowed: true,
    rest_audio_capture_allowed: false,
    rest_video_capture_allowed: false,
  });

export const DEFAULT_COMMAND_CENTER_DISABLED_FEATURE_GUARD: CommandCenterDisabledFeatureGuard =
  CommandCenterDisabledFeatureGuardSchema.parse({
    guard_id: "phase9_command_center_disabled_features_v1",
    disabled_features: Object.fromEntries(
      COMMAND_CENTER_DISABLED_FEATURES.map((feature) => [feature, false]),
    ),
    presentation_only: true,
    authority_surface: false,
    api_route_added: false,
    runtime_wired: false,
    telemetry_stream_wired: false,
    db_access_wired: false,
    camera_wired: false,
    microphone_wired: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });

export function createCommandCenterShellState(
  configInput: CommandCenterShellConfig = {},
): CommandCenterShellState {
  const config = CommandCenterShellConfigSchema.parse(configInput);
  const initialMode = config.initial_mode ?? "rest";

  return CommandCenterShellStateSchema.parse({
    kind: "command_center.shell_state",
    phase: "9A1",
    mode: initialMode,
    previous_mode: null,
    transition_count: 0,
    initialized_from_explicit_config: config.initial_mode !== undefined,
    presentation_only: true,
    authority_surface: false,
    can_execute: false,
    can_request_approval: false,
    can_schedule_routine: false,
    audio_capture_active: false,
    video_capture_active: false,
  });
}

export function transitionCommandCenterMode(
  stateInput: CommandCenterShellState,
  eventInput: unknown,
): CommandCenterTransitionResult {
  const state = CommandCenterShellStateSchema.parse(stateInput);
  const parsedEvent = CommandCenterTransitionEventSchema.safeParse(eventInput);
  if (!parsedEvent.success) {
    return transitionResult({
      state,
      eventType: "unknown",
      nextMode: state.mode,
      reason: "unknown_event",
    });
  }

  const event = parsedEvent.data;
  const nextMode = nextModeForEvent(state.mode, event);
  return transitionResult({
    state,
    eventType: event.type,
    nextMode,
    reason: reasonForEvent(state.mode, event, nextMode),
  });
}

export function wakeCommandCenterFromUserInput(
  state: CommandCenterShellState,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state, {
    type: "explicit_user_wake_to_working",
  });
}

export function enterCommandCenterAuditFromUserInput(
  state: CommandCenterShellState,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state, {
    type: "explicit_user_enter_audit",
  });
}

export function returnCommandCenterToWorkingFromUserInput(
  state: CommandCenterShellState,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state, {
    type: "explicit_user_return_to_working",
  });
}

export function returnCommandCenterToRestForIdle(
  state: CommandCenterShellState,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state, { type: "idle_return_to_rest" });
}

export function returnCommandCenterToRestManually(
  state: CommandCenterShellState,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state, { type: "manual_return_to_rest" });
}

export function validateCommandCenterDisabledFeatureGuard(
  input: unknown,
): CommandCenterDisabledFeatureGuardValidation {
  const parsed = CommandCenterDisabledFeatureGuardSchema.safeParse(input);
  const violations = parsed.success ? [] : disabledFeatureViolations(input);

  return CommandCenterDisabledFeatureGuardValidationSchema.parse({
    passed: parsed.success && violations.length === 0,
    violations,
    disabled_feature_count: COMMAND_CENTER_DISABLED_FEATURES.length,
    enabled_feature_count: violations.length,
    presentation_only: true,
    authority_surface: false,
    api_route_added: false,
    runtime_wired: false,
    telemetry_stream_wired: false,
    db_access_wired: false,
    camera_wired: false,
    microphone_wired: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function nextModeForEvent(
  mode: CommandCenterMode,
  event: CommandCenterTransitionEvent,
): CommandCenterMode {
  if (mode === "rest" && event.type === "explicit_user_wake_to_working") {
    return "working";
  }
  if (
    mode === "working" &&
    (event.type === "idle_return_to_rest" ||
      event.type === "manual_return_to_rest")
  ) {
    return "rest";
  }
  if (mode === "working" && event.type === "explicit_user_enter_audit") {
    return "audit";
  }
  if (mode === "audit" && event.type === "explicit_user_return_to_working") {
    return "working";
  }
  if (
    mode === "audit" &&
    (event.type === "idle_return_to_rest" ||
      event.type === "manual_return_to_rest")
  ) {
    return "rest";
  }
  return mode;
}

function reasonForEvent(
  mode: CommandCenterMode,
  event: CommandCenterTransitionEvent,
  nextMode: CommandCenterMode,
): CommandCenterTransitionReason {
  if (event.type === "voice_wake_word_detected") {
    return "disabled_voice_transition";
  }
  if (event.type === "microphone_activity_detected") {
    return "disabled_microphone_transition";
  }
  if (event.type === "camera_activity_detected") {
    return "disabled_camera_transition";
  }
  if (event.type === "presence_detected") {
    return "disabled_presence_transition";
  }
  if (event.type === "automatic_audit_requested") {
    return "automatic_audit_blocked";
  }
  if (event.type === "automatic_execution_requested") {
    return "automatic_execution_blocked";
  }
  if (nextMode === mode) {
    return "unsupported_transition";
  }
  if (event.type === "idle_return_to_rest") {
    return "idle_return_to_rest";
  }
  if (event.type === "manual_return_to_rest") {
    return "manual_return_to_rest";
  }
  return "explicit_user_input";
}

function transitionResult(input: {
  state: CommandCenterShellState;
  eventType: CommandCenterTransitionEventType | "unknown";
  nextMode: CommandCenterMode;
  reason: CommandCenterTransitionReason;
}): CommandCenterTransitionResult {
  const changed = input.nextMode !== input.state.mode;
  const nextState = CommandCenterShellStateSchema.parse({
    ...input.state,
    mode: input.nextMode,
    previous_mode: changed ? input.state.mode : input.state.previous_mode,
    transition_count: changed
      ? input.state.transition_count + 1
      : input.state.transition_count,
  });

  return CommandCenterTransitionResultSchema.parse({
    kind: "command_center.transition_result",
    event_type: input.eventType,
    previous_mode: input.state.mode,
    next_mode: input.nextMode,
    changed,
    reason: input.reason,
    state: nextState,
    presentation_only: true,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function disabledFeatureViolations(
  input: unknown,
): CommandCenterDisabledFeature[] {
  if (!input || typeof input !== "object" || !("disabled_features" in input)) {
    return [...COMMAND_CENTER_DISABLED_FEATURES];
  }

  const disabledFeatures = (input as { disabled_features?: unknown })
    .disabled_features;
  if (!disabledFeatures || typeof disabledFeatures !== "object") {
    return [...COMMAND_CENTER_DISABLED_FEATURES];
  }

  return COMMAND_CENTER_DISABLED_FEATURES.filter(
    (feature) =>
      (
        disabledFeatures as Partial<
          Record<CommandCenterDisabledFeature, unknown>
        >
      )[feature] !== false,
  );
}
