import { describe, expect, it } from "vitest";

import {
  ROOM_ADAPTER_COMMAND_MODES,
  ROOM_ADAPTER_FAILURE_CLASSES,
  ROOM_ADAPTER_OPERATION_NAMES,
  type RoomAdapterCommandMode,
  RoomAdapterCommandSchema,
  RoomAdapterContractDescriptorSchema,
  RoomAdapterDryRunPlanSchema,
  RoomAdapterOperationResultSchema,
  createRoomAdapterContractDescriptor,
  isMutatingCapability,
} from "../../../src/room/adapters/contract";

function freshness() {
  return {
    observed_at_ms: 0,
    stale_after_ms: 30_000,
    expires_at_ms: 30_000,
    source: "mock",
  } as const;
}

function deviceState() {
  return {
    power: "off",
    brightness_percent: 0,
    color_hex: null,
    derived: false,
    freshness: freshness(),
  } as const;
}

function approval(required = true) {
  return {
    required,
    policy_id: required ? "fake-approval-policy" : null,
    reason: required ? "Mutating command requires approval." : null,
    dry_run_required: true,
    auto_approval_allowed: false,
    voice_only_approval_allowed: false,
  } as const;
}

function provenance(mode: RoomAdapterCommandMode = "dry_run") {
  return {
    correlation_id: "correlation-1",
    requested_at_ms: 0,
    requested_by: "jarvis_room_os",
    source_phase: "10B.3",
    adapter_id: "fake-contract",
    device_id: "desk_lamp",
    capability: "power.switch",
    mode,
    dry_run: mode === "dry_run",
    approval_id: mode === "approved_execution" ? "approval-1" : null,
    metadata_only: true,
  } as const;
}

function command() {
  return {
    command_id: "command-1",
    mode: "dry_run",
    device_id: "desk_lamp",
    capability: "power.switch",
    action: "set_power",
    value: true,
    one_command_one_action: true,
    approval: approval(true),
    timeout_ms: 5_000,
    cancellation_supported: true,
  } as const;
}

describe("Phase 10B.3 room adapter contract", () => {
  it("exports stable operation names", () => {
    expect(ROOM_ADAPTER_OPERATION_NAMES).toEqual([
      "read_state",
      "plan_command",
      "execute_command",
      "verify_state",
      "health_check",
    ]);
    expect(
      createRoomAdapterContractDescriptor({
        identity: {
          adapter_id: "fake-contract",
          adapter_kind: "fake",
          display_name: "Fake Contract",
          fake_first: true,
          conformance_required_before_real_hardware: true,
          real_hardware_io: false,
          network_access: false,
          persistence_access: false,
          ui_access: false,
          implementation_enabled: false,
        },
        supported_capabilities: ["power.observe", "power.switch"],
      }).operations,
    ).toEqual(ROOM_ADAPTER_OPERATION_NAMES);
  });

  it("includes read_only, dry_run, and approved_execution command modes", () => {
    expect(ROOM_ADAPTER_COMMAND_MODES).toEqual([
      "read_only",
      "dry_run",
      "approved_execution",
    ]);
  });

  it("requires approval metadata for mutating capabilities", () => {
    expect(isMutatingCapability("power.switch")).toBe(true);
    expect(RoomAdapterCommandSchema.parse(command())).toMatchObject({
      approval: { required: true, policy_id: "fake-approval-policy" },
    });
    expect(
      RoomAdapterCommandSchema.safeParse({
        ...command(),
        approval: approval(false),
      }).success,
    ).toBe(false);
  });

  it("maps one command to one device and one capability action", () => {
    expect(RoomAdapterCommandSchema.parse(command())).toMatchObject({
      device_id: "desk_lamp",
      capability: "power.switch",
      action: "set_power",
      one_command_one_action: true,
    });
    expect(
      RoomAdapterCommandSchema.safeParse({
        ...command(),
        action: "set_color",
      }).success,
    ).toBe(false);
  });

  it("keeps failure classes deterministic and typed", () => {
    expect(ROOM_ADAPTER_FAILURE_CLASSES).toEqual([
      "unsupported_capability",
      "invalid_command",
      "approval_required",
      "approval_missing",
      "approval_expired",
      "adapter_unavailable",
      "timeout",
      "cancelled",
      "verification_failed",
      "hardware_io_disabled",
      "network_disabled",
    ]);
  });

  it("requires provenance metadata for plans and results", () => {
    const plan = RoomAdapterDryRunPlanSchema.parse({
      plan_id: "plan-1",
      command: command(),
      provenance: provenance(),
      current_state: deviceState(),
      intended_state: { ...deviceState(), power: "on" },
      approval: approval(true),
      mode: "dry_run",
      executable_now: false,
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
    });
    const result = RoomAdapterOperationResultSchema.parse({
      operation: "execute_command",
      mode: "approved_execution",
      ok: false,
      provenance: provenance("approved_execution"),
      state: null,
      failure_class: "hardware_io_disabled",
      approval: approval(true),
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });

    expect(plan.provenance).toMatchObject({
      source_phase: "10B.3",
      metadata_only: true,
    });
    expect(result.provenance.approval_id).toBe("approval-1");
    expect(
      RoomAdapterDryRunPlanSchema.safeParse({
        ...plan,
        provenance: undefined,
      }).success,
    ).toBe(false);
  });

  it("has no implementation-side effects", () => {
    const descriptor = createRoomAdapterContractDescriptor({
      identity: {
        adapter_id: "fake-contract",
        adapter_kind: "fake",
        display_name: "Fake Contract",
        fake_first: true,
        conformance_required_before_real_hardware: true,
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      },
      supported_capabilities: ["power.observe"],
    });

    expect(RoomAdapterContractDescriptorSchema.parse(descriptor)).toMatchObject(
      {
        real_adapter_executable_in_phase_10b3: false,
        implementation_side_effects_enabled: false,
        identity: {
          real_hardware_io: false,
          network_access: false,
          persistence_access: false,
          ui_access: false,
          implementation_enabled: false,
        },
      },
    );
  });

  it("does not make real adapter kinds executable from this slice", async () => {
    const contractModule = await import("../../../src/room/adapters/contract");
    const exportedNames = Object.keys(contractModule);

    expect(
      RoomAdapterContractDescriptorSchema.safeParse({
        identity: {
          adapter_id: "real-hue",
          adapter_kind: "hue",
          display_name: "Real Hue",
          fake_first: true,
          conformance_required_before_real_hardware: true,
          real_hardware_io: false,
          network_access: false,
          persistence_access: false,
          ui_access: false,
          implementation_enabled: false,
        },
        supported_capabilities: ["power.switch"],
        operations: ROOM_ADAPTER_OPERATION_NAMES,
        supported_modes: ROOM_ADAPTER_COMMAND_MODES,
        failure_classes: ROOM_ADAPTER_FAILURE_CLASSES,
        real_adapter_executable_in_phase_10b3: false,
        implementation_side_effects_enabled: false,
      }).success,
    ).toBe(false);
    expect(
      exportedNames.some((name) => /connect|dispatch|persist|wire/i.test(name)),
    ).toBe(false);
  });
});
