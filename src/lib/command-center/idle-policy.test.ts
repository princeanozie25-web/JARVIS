import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_IDLE_WAKE_SOURCES,
  DEFAULT_PHASE_9A_COMMAND_CENTER_AFFORDANCE_STATE,
  PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS,
  Phase9ACommandCenterCloseoutReportSchema,
  createCommandCenterIdlePolicy,
  createCommandCenterShellState,
  createPhase9ACommandCenterCloseoutReport,
  evaluateCommandCenterIdleWakeTransition,
  type CommandCenterIdleWakeSource,
  type CommandCenterMode,
  type Phase9ACommandCenterAffordanceState,
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

function evaluate(
  mode: CommandCenterMode,
  source: CommandCenterIdleWakeSource,
) {
  return evaluateCommandCenterIdleWakeTransition({
    policy: createCommandCenterIdlePolicy({ current_mode: mode }),
    request: { source },
    state: createCommandCenterShellState({ initial_mode: mode }),
  });
}

describe("Phase 9A3 command center idle policy and closeout guards", () => {
  it("allows user input to wake Rest to Working", () => {
    const evaluation = evaluate("rest", "user_input");

    expect(evaluation).toMatchObject({
      source: "user_input",
      decision: "allowed",
      reason: "user_input_wake_allowed",
      previous_mode: "rest",
      next_mode: "working",
      changed: true,
      presentation_only: true,
      authority_surface: false,
      starts_timer: false,
      installs_event_listener: false,
      captures_audio: false,
      captures_video: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("blocks voice, wake-word, microphone, camera, presence, and network wake sources", () => {
    for (const source of [
      "voice_wake_word",
      "microphone_activity",
      "camera_activity",
      "presence_detected",
      "network_event",
    ] satisfies CommandCenterIdleWakeSource[]) {
      const evaluation = evaluate("rest", source);

      expect(evaluation).toMatchObject({
        source,
        decision: "blocked",
        reason:
          source === "network_event"
            ? "network_wake_disabled"
            : "wake_source_disabled",
        previous_mode: "rest",
        next_mode: "rest",
        changed: false,
        captures_audio: false,
        captures_video: false,
        ...SIDE_EFFECT_FALSES,
      });
    }

    expect(
      createCommandCenterIdlePolicy({ current_mode: "rest" }),
    ).toMatchObject({
      wake_sources: ["user_input", "manual_idle", "timeout_idle"],
      disabled_wake_sources: [
        "voice_wake_word",
        "microphone_activity",
        "camera_activity",
        "presence_detected",
        "network_event",
        "automatic_audit",
      ],
      user_input_only_wake: true,
    });
  });

  it("allows manual and timeout idle to move Working or Audit to Rest only when policy allows", () => {
    for (const mode of ["working", "audit"] satisfies CommandCenterMode[]) {
      expect(evaluate(mode, "manual_idle")).toMatchObject({
        decision: "allowed",
        reason: "manual_idle_to_rest_allowed",
        previous_mode: mode,
        next_mode: "rest",
        changed: true,
        ...SIDE_EFFECT_FALSES,
      });
      expect(evaluate(mode, "timeout_idle")).toMatchObject({
        decision: "allowed",
        reason: "timeout_idle_to_rest_allowed",
        previous_mode: mode,
        next_mode: "rest",
        changed: true,
        ...SIDE_EFFECT_FALSES,
      });

      const blockedTimeout = evaluateCommandCenterIdleWakeTransition({
        policy: createCommandCenterIdlePolicy({
          current_mode: mode,
          timeout_idle_transition_allowed: false,
        }),
        request: { source: "timeout_idle" },
        state: createCommandCenterShellState({ initial_mode: mode }),
      });
      expect(blockedTimeout).toMatchObject({
        decision: "blocked",
        reason: "timeout_idle_not_allowed",
        previous_mode: mode,
        next_mode: mode,
        changed: false,
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("does not allow idle policy to enter Audit automatically", () => {
    for (const source of COMMAND_CENTER_IDLE_WAKE_SOURCES) {
      const evaluation = evaluateCommandCenterIdleWakeTransition({
        policy: createCommandCenterIdlePolicy({ current_mode: "working" }),
        request: { source, requested_target: "audit" },
        state: createCommandCenterShellState({ initial_mode: "working" }),
      });

      expect(evaluation).toMatchObject({
        decision: "blocked",
        reason: "automatic_audit_blocked",
        previous_mode: "working",
        next_mode: "working",
        changed: false,
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("passes closeout when all Phase 9A guards are disabled and safe", () => {
    const report = createPhase9ACommandCenterCloseoutReport();

    expect(report).toEqual({
      kind: "command_center.phase_9a_closeout_report",
      verdict: "pass",
      checked_guards: [...PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS],
      failed_guards: [],
      notes: ["phase_9a_command_center_scaffold_is_presentation_only"],
      generated_from: "phase_9a_command_center_scaffold",
      metadata_only: true,
      presentation_only: true,
      authority_surface: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails closeout if any forbidden affordance is marked enabled", () => {
    const cases: Array<[keyof Phase9ACommandCenterAffordanceState, string]> = [
      ["execution_affordance_enabled", "no_execution_affordance"],
      ["approval_affordance_enabled", "no_approval_affordance"],
      ["routine_mutation_affordance_enabled", "no_routine_mutation_affordance"],
      ["tool_mutation_affordance_enabled", "no_tool_mutation_affordance"],
      ["capture_affordance_enabled", "no_capture_affordance"],
      ["remote_dashboard_affordance_enabled", "no_remote_dashboard_affordance"],
      [
        "graph_replay_execution_affordance_enabled",
        "no_graph_replay_execution_affordance",
      ],
    ];

    for (const [field, guard] of cases) {
      const report = createPhase9ACommandCenterCloseoutReport({
        ...DEFAULT_PHASE_9A_COMMAND_CENTER_AFFORDANCE_STATE,
        [field]: true,
      });

      expect(report).toMatchObject({
        verdict: "fail",
        failed_guards: [guard],
        notes: [`forbidden_affordance_enabled:${guard}`],
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("explicitly forbids graph and replay execution affordance", () => {
    const report = createPhase9ACommandCenterCloseoutReport({
      ...DEFAULT_PHASE_9A_COMMAND_CENTER_AFFORDANCE_STATE,
      graph_replay_execution_affordance_enabled: true,
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_graph_replay_execution_affordance"],
      generated_from: "phase_9a_command_center_scaffold",
      action_executed: false,
      tool_called: false,
    });
  });

  it("keeps report outputs deterministic and serializable", () => {
    const first = createPhase9ACommandCenterCloseoutReport();
    const second = createPhase9ACommandCenterCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9ACommandCenterCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });
});
