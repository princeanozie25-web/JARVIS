import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_DISABLED_FEATURES,
  COMMAND_CENTER_TRANSITION_EVENT_TYPES,
  DEFAULT_COMMAND_CENTER_DISABLED_FEATURE_GUARD,
  DEFAULT_COMMAND_CENTER_IDLE_WAKE_POLICY,
  CommandCenterTransitionResultSchema,
  createCommandCenterShellState,
  enterCommandCenterAuditFromUserInput,
  returnCommandCenterToRestForIdle,
  returnCommandCenterToRestManually,
  returnCommandCenterToWorkingFromUserInput,
  transitionCommandCenterMode,
  validateCommandCenterDisabledFeatureGuard,
  wakeCommandCenterFromUserInput,
  type CommandCenterMode,
  type CommandCenterShellState,
  type CommandCenterTransitionEventType,
  type CommandCenterTransitionResult,
} from "./index";

const SIDE_EFFECT_FALSES = {
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
} as const;

function state(mode: CommandCenterMode): CommandCenterShellState {
  return createCommandCenterShellState({ initial_mode: mode });
}

function transition(
  mode: CommandCenterMode,
  eventType: CommandCenterTransitionEventType,
): CommandCenterTransitionResult {
  return transitionCommandCenterMode(state(mode), { type: eventType });
}

describe("Phase 9A1 command center shell state machine", () => {
  it("starts in Rest unless safe config explicitly overrides the initial mode", () => {
    expect(createCommandCenterShellState()).toMatchObject({
      mode: "rest",
      previous_mode: null,
      transition_count: 0,
      initialized_from_explicit_config: false,
      presentation_only: true,
      authority_surface: false,
      can_execute: false,
      audio_capture_active: false,
      video_capture_active: false,
    });

    expect(
      createCommandCenterShellState({ initial_mode: "working" }),
    ).toMatchObject({
      mode: "working",
      initialized_from_explicit_config: true,
      presentation_only: true,
      authority_surface: false,
    });
  });

  it("allows Rest to transition to Working only through explicit user input", () => {
    const result = wakeCommandCenterFromUserInput(state("rest"));

    expect(result).toMatchObject({
      previous_mode: "rest",
      next_mode: "working",
      changed: true,
      reason: "explicit_user_input",
      state: {
        mode: "working",
        previous_mode: "rest",
        transition_count: 1,
      },
      ...SIDE_EFFECT_FALSES,
    });

    for (const eventType of COMMAND_CENTER_TRANSITION_EVENT_TYPES.filter(
      (item) => item !== "explicit_user_wake_to_working",
    )) {
      const denied = transition("rest", eventType);
      expect(denied.state.mode).toBe("rest");
      expect(denied.changed).toBe(false);
    }
  });

  it("does not allow voice or wake-word events to transition modes", () => {
    expect(transition("rest", "voice_wake_word_detected")).toMatchObject({
      next_mode: "rest",
      changed: false,
      reason: "disabled_voice_transition",
      ...SIDE_EFFECT_FALSES,
    });
    expect(transition("rest", "microphone_activity_detected")).toMatchObject({
      next_mode: "rest",
      changed: false,
      reason: "disabled_microphone_transition",
      ...SIDE_EFFECT_FALSES,
    });
    expect(DEFAULT_COMMAND_CENTER_IDLE_WAKE_POLICY).toMatchObject({
      wake_word_enabled: false,
      microphone_wake_enabled: false,
      user_input_only_wake: true,
      rest_audio_capture_allowed: false,
    });
  });

  it("does not allow camera or presence events to transition modes", () => {
    for (const mode of [
      "rest",
      "working",
      "audit",
    ] satisfies CommandCenterMode[]) {
      expect(transition(mode, "camera_activity_detected")).toMatchObject({
        next_mode: mode,
        changed: false,
        reason: "disabled_camera_transition",
        ...SIDE_EFFECT_FALSES,
      });
      expect(transition(mode, "presence_detected")).toMatchObject({
        next_mode: mode,
        changed: false,
        reason: "disabled_presence_transition",
        ...SIDE_EFFECT_FALSES,
      });
    }
    expect(DEFAULT_COMMAND_CENTER_IDLE_WAKE_POLICY).toMatchObject({
      camera_wake_enabled: false,
      presence_wake_enabled: false,
      rest_video_capture_allowed: false,
    });
  });

  it("allows only explicit user input into and out of Audit", () => {
    expect(
      enterCommandCenterAuditFromUserInput(state("working")),
    ).toMatchObject({
      previous_mode: "working",
      next_mode: "audit",
      changed: true,
      reason: "explicit_user_input",
      ...SIDE_EFFECT_FALSES,
    });
    expect(transition("working", "automatic_audit_requested")).toMatchObject({
      next_mode: "working",
      changed: false,
      reason: "automatic_audit_blocked",
      ...SIDE_EFFECT_FALSES,
    });
    expect(
      returnCommandCenterToWorkingFromUserInput(state("audit")),
    ).toMatchObject({
      previous_mode: "audit",
      next_mode: "working",
      changed: true,
      reason: "explicit_user_input",
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("allows Working and Audit to return to Rest through idle or manual events", () => {
    expect(returnCommandCenterToRestForIdle(state("working"))).toMatchObject({
      previous_mode: "working",
      next_mode: "rest",
      changed: true,
      reason: "idle_return_to_rest",
      ...SIDE_EFFECT_FALSES,
    });
    expect(returnCommandCenterToRestManually(state("audit"))).toMatchObject({
      previous_mode: "audit",
      next_mode: "rest",
      changed: true,
      reason: "manual_return_to_rest",
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("creates no execution, action, approval, routine, write, capture, network, or cloud side effect", () => {
    for (const mode of [
      "rest",
      "working",
      "audit",
    ] satisfies CommandCenterMode[]) {
      for (const eventType of COMMAND_CENTER_TRANSITION_EVENT_TYPES) {
        const result = transition(mode, eventType);

        expect(result).toMatchObject({
          presentation_only: true,
          authority_surface: false,
          ...SIDE_EFFECT_FALSES,
        });
        expect(result.state).toMatchObject({
          presentation_only: true,
          authority_surface: false,
          can_execute: false,
          can_request_approval: false,
          can_schedule_routine: false,
          audio_capture_active: false,
          video_capture_active: false,
        });
        expect(
          CommandCenterTransitionResultSchema.safeParse({
            ...result,
            action_executed: true,
          }).success,
        ).toBe(false);
      }
    }
  });

  it("fails closed for unknown events", () => {
    const current = state("working");
    const result = transitionCommandCenterMode(current, {
      type: "ambient_magic",
    });

    expect(result).toMatchObject({
      event_type: "unknown",
      previous_mode: "working",
      next_mode: "working",
      changed: false,
      reason: "unknown_event",
      state: current,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("is deterministic for repeated state and event inputs", () => {
    const current = state("working");
    const event = { type: "explicit_user_enter_audit" } as const;

    expect(transitionCommandCenterMode(current, event)).toEqual(
      transitionCommandCenterMode(current, event),
    );

    const first = wakeCommandCenterFromUserInput(
      createCommandCenterShellState(),
    );
    const second = enterCommandCenterAuditFromUserInput(first.state);
    const replayFirst = wakeCommandCenterFromUserInput(
      createCommandCenterShellState(),
    );
    const replaySecond = enterCommandCenterAuditFromUserInput(
      replayFirst.state,
    );

    expect(second).toEqual(replaySecond);
  });

  it("keeps Phase 9 disabled-feature guards locked off", () => {
    const validation = validateCommandCenterDisabledFeatureGuard(
      DEFAULT_COMMAND_CENTER_DISABLED_FEATURE_GUARD,
    );

    expect(validation).toMatchObject({
      passed: true,
      violations: [],
      disabled_feature_count: COMMAND_CENTER_DISABLED_FEATURES.length,
      enabled_feature_count: 0,
      api_route_added: false,
      runtime_wired: false,
      telemetry_stream_wired: false,
      db_access_wired: false,
      camera_wired: false,
      microphone_wired: false,
      ...SIDE_EFFECT_FALSES,
    });

    for (const feature of COMMAND_CENTER_DISABLED_FEATURES) {
      expect(
        validateCommandCenterDisabledFeatureGuard({
          ...DEFAULT_COMMAND_CENTER_DISABLED_FEATURE_GUARD,
          disabled_features: {
            ...DEFAULT_COMMAND_CENTER_DISABLED_FEATURE_GUARD.disabled_features,
            [feature]: true,
          },
        }),
      ).toMatchObject({
        passed: false,
        violations: [feature],
        enabled_feature_count: 1,
      });
    }
  });
});
