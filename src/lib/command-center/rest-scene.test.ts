import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9C_REST_SCREEN_POLICY_GUARD_STATE,
  PHASE_9C_REST_SCREEN_CLOSEOUT_GUARDS,
  PHASE_9C_REST_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS,
  Phase9CRestScreenCloseoutReportSchema,
  RestSceneDescriptorSchema,
  createDefaultOrbDisplayState,
  createPhase9CRestScreenCloseoutReport,
  createSafeFallbackRestSceneDescriptor,
  deriveOrbVisualTokensFromState,
  deriveRestSceneDescriptor,
  validateRestSceneDescriptor,
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

function expectDisplayOnlyScene(
  scene: ReturnType<typeof deriveRestSceneDescriptor>,
) {
  expect(scene).toMatchObject({
    render_safe: true,
    non_interactive: true,
    display_only: true,
    metadata_only: true,
    authority_surface: false,
    captures_audio: false,
    captures_video: false,
    starts_timer: false,
    installs_event_listener: false,
    browser_listener_wired: false,
    transition_trigger_allowed: false,
    automatic_transition_allowed: false,
    network_fetch_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    replay_run_actions_allowed: false,
    capture_actions_allowed: false,
    ...SIDE_EFFECT_FALSES,
  });
}

describe("Phase 9C3 Rest screen idle scene and closeout guards", () => {
  it("derives deterministic scene descriptors from safe orb state and tokens", () => {
    const orbState = {
      ...createDefaultOrbDisplayState(),
      heartbeat_state: "alive",
      load_band: "high",
      last_event_class: "system_metadata",
      generated_at: 77,
    };
    const visualTokens = deriveOrbVisualTokensFromState(orbState);

    const first = deriveRestSceneDescriptor({ orbState, visualTokens });
    const second = deriveRestSceneDescriptor({ orbState, visualTokens });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "command_center.rest_scene_descriptor",
      phase: "9C3",
      scene_id: "rest_scene:attentive",
      scene_kind: "attentive",
      idle_posture: "aware",
      accessibility_summary: "Rest screen attentive",
      visual_token_profile: visualTokens,
      allowed_display_modes: [
        "orb_visual_tokens",
        "metadata_status",
        "kill_switch_status",
        "accessibility_summary",
      ],
    });
    expectDisplayOnlyScene(first);
    expect(validateRestSceneDescriptor(first)).toMatchObject({
      passed: true,
      reasons: ["rest_scene_descriptor_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("falls back to safe_fallback for unsafe state or token inputs", () => {
    const unsafeStateScene = deriveRestSceneDescriptor({
      orbState: {
        ...createDefaultOrbDisplayState(),
        raw_prompt: "unsafe",
      },
    });
    const unsafeTokenScene = deriveRestSceneDescriptor({
      visualTokens: {
        ...deriveOrbVisualTokensFromState(createDefaultOrbDisplayState()),
        onClick: "forbidden",
      },
    });

    expect(unsafeStateScene).toEqual(createSafeFallbackRestSceneDescriptor());
    expect(unsafeTokenScene).toEqual(createSafeFallbackRestSceneDescriptor());
    expect(unsafeStateScene).toMatchObject({
      scene_kind: "safe_fallback",
      idle_posture: "fallback",
      accessibility_summary: "Rest screen safe fallback",
    });
  });

  it("fails validation for unknown scene kinds", () => {
    const validation = validateRestSceneDescriptor({
      ...deriveRestSceneDescriptor(),
      scene_kind: "ambient",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
      render_safe: false,
      non_interactive: true,
      mutated_input: false,
    });
  });

  it("keeps Rest scene descriptors render-safe and non-interactive", () => {
    const scene = deriveRestSceneDescriptor();

    expectDisplayOnlyScene(scene);
    expect(RestSceneDescriptorSchema.parse(scene)).toEqual(scene);
  });

  it("rejects mic, camera, wake-word, presence, network, execution, approval, routine, and replay surfaces", () => {
    for (const field of PHASE_9C_REST_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS) {
      const report = createPhase9CRestScreenCloseoutReport({
        policyGuardState: {
          ...DEFAULT_PHASE_9C_REST_SCREEN_POLICY_GUARD_STATE,
          [field]: true,
        },
      });

      expect(report).toMatchObject({
        verdict: "fail",
        failed_guards: expect.arrayContaining([expect.any(String)]),
        notes: expect.arrayContaining([
          `forbidden_rest_affordance_enabled:${field}`,
        ]),
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("passes the default closeout report", () => {
    const report = createPhase9CRestScreenCloseoutReport();

    expect(report).toEqual({
      kind: "command_center.phase_9c_rest_screen_closeout_report",
      verdict: "pass",
      checked_guards: [...PHASE_9C_REST_SCREEN_CLOSEOUT_GUARDS],
      failed_guards: [],
      notes: ["phase_9c_rest_screen_scaffold_is_display_only"],
      generated_from: "phase_9c_rest_screen_scaffold",
      display_only: true,
      metadata_only: true,
      render_safe: true,
      non_interactive: true,
      user_input_wake_only: true,
      authority_surface: false,
      captures_audio: false,
      captures_video: false,
      network_fetch_allowed: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails closeout if forbidden affordances are enabled", () => {
    const report = createPhase9CRestScreenCloseoutReport({
      policyGuardState: {
        ...DEFAULT_PHASE_9C_REST_SCREEN_POLICY_GUARD_STATE,
        microphone_activation_enabled: true,
        execution_surface_enabled: true,
        replay_run_surface_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      render_safe: false,
      failed_guards: expect.arrayContaining([
        "no_microphone_activation",
        "no_execution_surface",
        "no_replay_run_surface",
      ]),
      notes: expect.arrayContaining([
        "forbidden_rest_affordance_enabled:microphone_activation_enabled",
        "forbidden_rest_affordance_enabled:execution_surface_enabled",
        "forbidden_rest_affordance_enabled:replay_run_surface_enabled",
      ]),
    });
  });

  it("keeps closeout report output deterministic and serializable", () => {
    const first = createPhase9CRestScreenCloseoutReport();
    const second = createPhase9CRestScreenCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9CRestScreenCloseoutReportSchema.parse(first)).toEqual(first);
  });

  it("exports Rest scene closeout helpers from the command-center index", () => {
    expect(typeof deriveRestSceneDescriptor).toBe("function");
    expect(typeof validateRestSceneDescriptor).toBe("function");
    expect(typeof createPhase9CRestScreenCloseoutReport).toBe("function");
    expect(
      Phase9CRestScreenCloseoutReportSchema.parse(
        createPhase9CRestScreenCloseoutReport(),
      ),
    ).toMatchObject({
      verdict: "pass",
      generated_from: "phase_9c_rest_screen_scaffold",
    });
  });
});
