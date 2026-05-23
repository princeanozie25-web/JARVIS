import { describe, expect, it } from "vitest";

import {
  OrbVisualTokenSetSchema,
  createDefaultOrbDisplayState,
  createDefaultOrbVisualTokens,
  deriveOrbVisualTokensFromState,
  listOrbForbiddenRenderInstructionFields,
  listOrbForbiddenVisualAuthorityKeys,
  validateOrbVisualTokens,
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

function expectDisplayOnlyTokens(
  tokens: ReturnType<typeof createDefaultOrbVisualTokens>,
) {
  expect(tokens).toMatchObject({
    display_only: true,
    metadata_only: true,
    render_safe: true,
    semantic_tokens_only: true,
    render_instructions_included: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    transition_trigger_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    capture_actions_allowed: false,
    network_actions_allowed: false,
    ...SIDE_EFFECT_FALSES,
  });
}

function collectEntries(
  input: unknown,
  path: string[] = [],
): Array<{ key: string; value: unknown; path: string }> {
  if (!input || typeof input !== "object") return [];
  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  return entries.flatMap(([key, value]) => [
    { key, value, path: [...path, key].join(".") },
    ...collectEntries(value, [...path, key]),
  ]);
}

describe("Phase 9C2 Rest orb visual token contract", () => {
  it("creates deterministic safe default visual tokens", () => {
    const first = createDefaultOrbVisualTokens();
    const second = createDefaultOrbVisualTokens();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "command_center.orb_visual_token_set",
      phase: "9C2",
      heartbeat_ring_token: "ring_resting",
      inner_glow_token: "glow_resting",
      outer_halo_token: "halo_none",
      color_band_token: "band_neutral",
      motion_token: "motion_still",
      intensity_token: "intensity_low",
      surface_label_token: "label_resting",
      accessibility_label: "JARVIS resting",
    });
    expectDisplayOnlyTokens(first);
    expect(validateOrbVisualTokens(first)).toMatchObject({
      passed: true,
      reasons: ["orb_visual_tokens_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("derives expected broad token labels from safe orb state", () => {
    const state = {
      ...createDefaultOrbDisplayState(),
      heartbeat_state: "alive",
      load_band: "high",
      last_event_class: "safety_status",
      governance_posture: "guarded",
      approval_attention_state: "pending_metadata",
      generated_at: 90,
    };

    const tokens = deriveOrbVisualTokensFromState(state);

    expect(tokens).toMatchObject({
      heartbeat_ring_token: "ring_attention",
      inner_glow_token: "glow_guarded",
      outer_halo_token: "halo_attention",
      color_band_token: "band_attention",
      motion_token: "motion_attention_pulse",
      intensity_token: "intensity_high",
      surface_label_token: "label_attention",
      accessibility_label: "JARVIS needs attention",
    });
    expectDisplayOnlyTokens(tokens);
  });

  it("falls back to default tokens for unsafe orb state", () => {
    const tokens = deriveOrbVisualTokensFromState({
      ...createDefaultOrbDisplayState(),
      raw_prompt: "unsafe",
    });

    expect(tokens).toEqual(createDefaultOrbVisualTokens());
  });

  it("fails validation for unknown token values", () => {
    const validation = validateOrbVisualTokens({
      ...createDefaultOrbVisualTokens(),
      motion_token: "spin_300ms",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
      render_safe: false,
      render_instructions_included: false,
      mutated_input: false,
    });
  });

  it("fails validation for raw render instruction fields", () => {
    for (const field of listOrbForbiddenRenderInstructionFields()) {
      const validation = validateOrbVisualTokens({
        ...createDefaultOrbVisualTokens(),
        [field]: "unsafe",
      });

      expect(validation).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining([
          "raw_render_instruction_present",
          "schema_rejected",
        ]),
        withheld_fields: [field],
        render_safe: false,
        render_instructions_included: false,
      });
    }
  });

  it("fails validation for callback/function/non-serializable token fields", () => {
    const callbackValidation = validateOrbVisualTokens({
      ...createDefaultOrbVisualTokens(),
      onTokenRender: () => undefined,
    });
    expect(callbackValidation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "non_serializable_value",
        "schema_rejected",
      ]),
      render_safe: false,
      mutated_input: false,
    });

    const circular: Record<string, unknown> = {
      ...createDefaultOrbVisualTokens(),
    };
    circular.self = circular;
    const circularValidation = validateOrbVisualTokens(circular);
    expect(circularValidation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "non_serializable_value",
        "schema_rejected",
      ]),
      render_safe: false,
      mutated_input: false,
    });
  });

  it("fails validation for authority-like keys", () => {
    for (const key of listOrbForbiddenVisualAuthorityKeys()) {
      const validation = validateOrbVisualTokens({
        ...createDefaultOrbVisualTokens(),
        [key]: "forbidden",
      });

      expect(validation).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining([
          "authority_key_present",
          "schema_rejected",
        ]),
        withheld_fields: [key],
        render_safe: false,
      });
    }
  });

  it("contains no raw render instructions, raw CSS, event handlers, or executable surfaces", () => {
    const tokens = createDefaultOrbVisualTokens();
    const entries = collectEntries(tokens);
    const keys = entries.map((entry) => entry.key);
    const stringValues = entries
      .map((entry) => entry.value)
      .filter((value): value is string => typeof value === "string");

    expect(keys).not.toEqual(
      expect.arrayContaining([
        ...listOrbForbiddenRenderInstructionFields(),
        ...listOrbForbiddenVisualAuthorityKeys(),
        "className",
        "animation_ms",
        "svg",
        "canvas",
        "webgl",
      ]),
    );
    expect(
      stringValues.filter((value) =>
        /#|rgb\(|rgba\(|hsl\(|hsla\(|\bpx\b|\bms\b|class=|<svg|canvas|webgl/i.test(
          value,
        ),
      ),
    ).toEqual([]);
    expectDisplayOnlyTokens(tokens);
  });

  it("exports visual token helpers from the command-center index", () => {
    expect(typeof createDefaultOrbVisualTokens).toBe("function");
    expect(typeof validateOrbVisualTokens).toBe("function");
    expect(typeof deriveOrbVisualTokensFromState).toBe("function");
    expect(
      OrbVisualTokenSetSchema.parse(createDefaultOrbVisualTokens()),
    ).toEqual(createDefaultOrbVisualTokens());
  });
});
