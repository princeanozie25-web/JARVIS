import { describe, expect, it } from "vitest";

import {
  OrbDisplayStateSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultOrbDisplayState,
  deriveOrbDisplayStateFromSafeMetadata,
  listOrbForbiddenRawPayloadFields,
  validateOrbDisplayState,
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

function expectNoAuthority(
  state: ReturnType<typeof createDefaultOrbDisplayState>,
) {
  expect(state).toMatchObject({
    display_only: true,
    metadata_only: true,
    render_safe: true,
    replay_safe: false,
    authority_surface: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    callbacks_allowed: false,
    transition_trigger_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    capture_actions_allowed: false,
    network_actions_allowed: false,
    ...SIDE_EFFECT_FALSES,
  });
}

function collectKeys(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap((item) => collectKeys(item));
  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 9C1 Rest screen orb state contract", () => {
  it("creates a deterministic safe default orb state", () => {
    const first = createDefaultOrbDisplayState();
    const second = createDefaultOrbDisplayState();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "command_center.orb_display_state",
      phase: "9C1",
      heartbeat_state: "resting",
      load_band: "none",
      last_event_class: "none",
      governance_posture: "normal",
      kill_switch_display: "available",
      approval_attention_state: "none",
      degraded_state: "none",
      generated_at: 0,
      source: {
        source_kind: "static_fallback_state",
        read_only: true,
        metadata_only: true,
        redaction_required: true,
        live_source_wired: false,
        fetch_performed: false,
        raw_payloads_allowed: false,
      },
    });
    expectNoAuthority(first);
    expect(validateOrbDisplayState(first)).toMatchObject({
      passed: true,
      reasons: ["orb_state_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("passes valid orb states", () => {
    const state = {
      ...createDefaultOrbDisplayState(),
      heartbeat_state: "alive",
      load_band: "medium",
      last_event_class: "system_metadata",
      governance_posture: "guarded",
      kill_switch_display: "engaged",
      approval_attention_state: "pending_metadata",
      degraded_state: "partial",
      generated_at: 99,
    };

    expect(OrbDisplayStateSchema.parse(state)).toEqual(state);
    expect(validateOrbDisplayState(state)).toMatchObject({
      passed: true,
      reasons: ["orb_state_valid"],
      render_safe: true,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails closed for unknown enum values", () => {
    const validation = validateOrbDisplayState({
      ...createDefaultOrbDisplayState(),
      heartbeat_state: "listening",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
      render_safe: false,
      raw_payloads_included: false,
      mutated_input: false,
    });
  });

  it("fails closed for raw payload-like fields", () => {
    for (const field of listOrbForbiddenRawPayloadFields()) {
      const validation = validateOrbDisplayState({
        ...createDefaultOrbDisplayState(),
        [field]: "unsafe",
      });

      expect(validation).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining([
          "raw_payload_field_present",
          "schema_rejected",
        ]),
        withheld_fields: [field],
        render_safe: false,
        raw_payloads_included: false,
        exact_pii_included: false,
      });
    }
  });

  it("fails closed for non-serializable values", () => {
    const validation = validateOrbDisplayState({
      ...createDefaultOrbDisplayState(),
      on_execute: () => undefined,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "non_serializable_value",
        "mutating_hook_field_present",
        "schema_rejected",
      ]),
      withheld_fields: ["on_execute"],
      render_safe: false,
      mutated_input: false,
    });
  });

  it("derives orb state from safe metadata", () => {
    const envelope = createCommandCenterObservabilityResponseEnvelope({
      query_id: "orb:metadata",
      category: "safety",
      generated_at: 123,
      payload: [
        {
          item_id: "orb:item",
          item_class: "orb_summary",
          status: "degraded",
          count_band: "high",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
    });

    const state = deriveOrbDisplayStateFromSafeMetadata({
      ...envelope,
      payload: [
        {
          ...envelope.payload[0],
          heartbeat_state: "alive",
          governance_posture: "locked",
          kill_switch_display: "engaged",
          approval_attention_state: "blocked",
        },
      ],
    });

    expect(state).toMatchObject({
      heartbeat_state: "alive",
      load_band: "high",
      last_event_class: "none",
      governance_posture: "locked",
      kill_switch_display: "engaged",
      approval_attention_state: "blocked",
      degraded_state: "partial",
      generated_at: 123,
      source: {
        source_kind: "observability_response_envelope",
        source_ref: "orb:metadata",
      },
    });
    expectNoAuthority(state);
  });

  it("falls back to default state for unsafe metadata", () => {
    const state = deriveOrbDisplayStateFromSafeMetadata({
      heartbeat_state: "alive",
      raw_prompt: "unsafe",
    });

    expect(state).toEqual(createDefaultOrbDisplayState());
  });

  it("contains no authority hooks or action surfaces", () => {
    const state = createDefaultOrbDisplayState();

    expectNoAuthority(state);
    const keys = collectKeys(state);
    expect(keys.filter((key) => key.startsWith("on_"))).toEqual([]);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "tool_call_hook",
        "approval_hook",
        "routine_hook",
        "capture_started_by_orb",
        "network_route",
      ]),
    );
  });

  it("exports orb helpers from the command-center index", () => {
    expect(typeof createDefaultOrbDisplayState).toBe("function");
    expect(typeof validateOrbDisplayState).toBe("function");
    expect(typeof deriveOrbDisplayStateFromSafeMetadata).toBe("function");
    expect(OrbDisplayStateSchema.parse(createDefaultOrbDisplayState())).toEqual(
      createDefaultOrbDisplayState(),
    );
  });
});
