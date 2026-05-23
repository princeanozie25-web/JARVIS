import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_AUDIT_VIEWER_SLOTS,
  COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
  COMMAND_CENTER_RENDER_SAFE_METADATA_FIELDS,
  COMMAND_CENTER_WORKING_PANEL_SLOTS,
  DEFAULT_COMMAND_CENTER_RENDER_SAFE_METADATA_ALLOWLIST,
  AuditScreenDescriptorSchema,
  CommandCenterScreenDescriptorSchema,
  RestScreenViewModelSchema,
  WorkingScreenDescriptorSchema,
  createAuditScreenDescriptor,
  createAuditScreenViewModel,
  createRestScreenDescriptor,
  createRestScreenViewModel,
  createWorkingScreenDescriptor,
  createWorkingScreenViewModel,
  validateCommandCenterScreenDescriptor,
  type CommandCenterScreenDescriptor,
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

function assertDescriptorIsPassive(
  descriptor: CommandCenterScreenDescriptor,
): void {
  expect(descriptor).toMatchObject({
    phase: "9A2",
    presentation_only: true,
    render_contract_only: true,
    authority_surface: false,
    mutating_callbacks_allowed: false,
    tool_call_hooks_allowed: false,
    approval_hooks_allowed: false,
    routine_hooks_allowed: false,
    raw_payloads_allowed: false,
    exact_pii_allowed: false,
    ...SIDE_EFFECT_FALSES,
  });
}

describe("Phase 9A2 command center screen contracts", () => {
  it("keeps the shared render-safe metadata allowlist metadata-only", () => {
    expect(DEFAULT_COMMAND_CENTER_RENDER_SAFE_METADATA_ALLOWLIST).toEqual({
      kind: "command_center.render_safe_metadata_allowlist",
      version: 1,
      allowed_fields: [...COMMAND_CENTER_RENDER_SAFE_METADATA_FIELDS],
      forbidden_payload_fields: [
        ...COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
      ],
      metadata_only: true,
      raw_payloads_allowed: false,
      exact_pii_allowed: false,
    });
  });

  it("accepts Rest screen metadata and rejects raw display payloads", () => {
    const viewModel = createRestScreenViewModel({
      heartbeat_status: "alive",
      load_band: "low",
      last_event_class: "system_metadata",
      governance_posture: "normal",
      kill_switch_display_state: "available",
    });
    const descriptor = createRestScreenDescriptor(viewModel);

    expect(RestScreenViewModelSchema.parse(viewModel)).toEqual(viewModel);
    expect(descriptor.view_model).toEqual({
      kind: "command_center.rest_screen_view_model",
      heartbeat_status: "alive",
      load_band: "low",
      last_event_class: "system_metadata",
      governance_posture: "normal",
      kill_switch_display_state: "available",
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
    assertDescriptorIsPassive(descriptor);

    expect(
      RestScreenViewModelSchema.safeParse({
        ...viewModel,
        raw_prompt: "private user prompt",
      }).success,
    ).toBe(false);
  });

  it("keeps Working screen panel-slot only and unable to execute anything", () => {
    const viewModel = createWorkingScreenViewModel();
    const descriptor = createWorkingScreenDescriptor(viewModel);

    expect(viewModel.panel_slots.map((slot) => slot.slot_id)).toEqual([
      ...COMMAND_CENTER_WORKING_PANEL_SLOTS,
    ]);
    for (const slot of viewModel.panel_slots) {
      expect(slot).toMatchObject({
        slot_status: "placeholder",
        implementation_wired: false,
        executable: false,
        can_call_tool: false,
        can_request_approval: false,
        can_schedule_routine: false,
        metadata_only: true,
      });
    }
    expect(descriptor.view_model).toMatchObject({
      panel_implementation_wired: false,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
    assertDescriptorIsPassive(descriptor);

    expect(
      WorkingScreenDescriptorSchema.safeParse({
        ...descriptor,
        view_model: {
          ...descriptor.view_model,
          panel_slots: [
            {
              ...descriptor.view_model.panel_slots[0],
              executable: true,
            },
            ...descriptor.view_model.panel_slots.slice(1),
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("keeps Audit screen viewer-slot only and unable to retry or execute replay", () => {
    const viewModel = createAuditScreenViewModel();
    const descriptor = createAuditScreenDescriptor(viewModel);

    expect(viewModel.viewer_slots.map((slot) => slot.slot_id)).toEqual([
      ...COMMAND_CENTER_AUDIT_VIEWER_SLOTS,
    ]);
    for (const slot of viewModel.viewer_slots) {
      expect(slot).toMatchObject({
        slot_status: "placeholder",
        renderer_wired: false,
        executable: false,
        can_retry: false,
        can_replay_execute: false,
        can_call_tool: false,
        metadata_only: true,
      });
    }
    expect(descriptor.view_model).toMatchObject({
      viewer_rendering_wired: false,
      replay_execution_enabled: false,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
    assertDescriptorIsPassive(descriptor);

    expect(
      AuditScreenDescriptorSchema.safeParse({
        ...descriptor,
        view_model: {
          ...descriptor.view_model,
          replay_execution_enabled: true,
        },
      }).success,
    ).toBe(false);
  });

  it("fails closed when forbidden raw fields are present", () => {
    const descriptor = createRestScreenDescriptor();

    for (const field of COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS) {
      const validation = validateCommandCenterScreenDescriptor({
        ...descriptor,
        view_model: {
          ...descriptor.view_model,
          [field]: "unsafe",
        },
      });

      expect(validation).toMatchObject({
        passed: false,
        violations: expect.arrayContaining([
          "raw_payload_field_present",
          "schema_rejected",
        ]),
        raw_payloads_included: false,
        exact_pii_included: false,
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("contains no mutating callbacks, tool-call hooks, approval hooks, or routine hooks", () => {
    const descriptor = createWorkingScreenDescriptor();
    const validation = validateCommandCenterScreenDescriptor({
      ...descriptor,
      on_execute: () => "nope",
      tool_call_hook: () => "nope",
      approval_hook: () => "nope",
      routine_hook: () => "nope",
    });

    expect(validation).toMatchObject({
      passed: false,
      violations: expect.arrayContaining([
        "mutating_hook_field_present",
        "schema_rejected",
        "not_serializable",
      ]),
      mutating_callbacks_allowed: false,
      tool_call_hooks_allowed: false,
      approval_hooks_allowed: false,
      routine_hooks_allowed: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("keeps all screen descriptors deterministic and serializable", () => {
    const descriptors = [
      createRestScreenDescriptor(),
      createWorkingScreenDescriptor(),
      createAuditScreenDescriptor(),
    ];
    const replayedDescriptors = [
      createRestScreenDescriptor(),
      createWorkingScreenDescriptor(),
      createAuditScreenDescriptor(),
    ];

    expect(descriptors).toEqual(replayedDescriptors);
    for (const descriptor of descriptors) {
      expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
      expect(validateCommandCenterScreenDescriptor(descriptor)).toMatchObject({
        passed: true,
        violations: [],
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("exports all screen contracts from the command-center index", () => {
    const descriptors = [
      createRestScreenDescriptor(),
      createWorkingScreenDescriptor(),
      createAuditScreenDescriptor(),
    ];

    for (const descriptor of descriptors) {
      expect(CommandCenterScreenDescriptorSchema.parse(descriptor)).toEqual(
        descriptor,
      );
    }
    expect(typeof createRestScreenViewModel).toBe("function");
    expect(typeof createWorkingScreenViewModel).toBe("function");
    expect(typeof createAuditScreenViewModel).toBe("function");
    expect(typeof validateCommandCenterScreenDescriptor).toBe("function");
  });
});
