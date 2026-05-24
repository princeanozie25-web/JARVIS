import {
  RoomAdapterCommandSchema,
  RoomAdapterDryRunPlanSchema,
  RoomAdapterHealthStatusSchema,
  RoomAdapterOperationResultSchema,
  createRoomAdapterContractDescriptor,
  isMutatingCapability,
  type RoomAdapterCommand,
  type RoomAdapterContract,
  type RoomAdapterContractDescriptor,
  type RoomAdapterDryRunPlan,
  type RoomAdapterExecutionContext,
  type RoomAdapterHealthStatus,
  type RoomAdapterOperationResult,
} from "./contract";
import { parseRoomProfile } from "../schema";
import type {
  Capability,
  Device,
  DeviceState,
  RoomProfile,
  Sensor,
  SensorState,
} from "../types";

type KnownEntity =
  | { kind: "device"; record: Device; state: DeviceState }
  | { kind: "sensor"; record: Sensor; state: SensorState };

export interface FakeRoomAdapterInput {
  readonly profile?: RoomProfile;
  readonly devices?: readonly Device[];
  readonly sensors?: readonly Sensor[];
  readonly adapterId?: string;
}

export class FakeRoomAdapter implements RoomAdapterContract {
  readonly descriptor: RoomAdapterContractDescriptor;
  private readonly adapterId: string;
  private readonly entities = new Map<string, KnownEntity>();

  constructor(input: FakeRoomAdapterInput) {
    const devices = input.profile
      ? parseRoomProfile(input.profile).devices
      : [...(input.devices ?? [])];
    const sensors = input.profile
      ? parseRoomProfile(input.profile).sensors
      : [...(input.sensors ?? [])];
    this.adapterId = input.adapterId ?? "fake-room-adapter";

    for (const device of devices) {
      this.entities.set(device.id, {
        kind: "device",
        record: clone(device),
        state: clone(device.state),
      });
    }
    for (const sensor of sensors) {
      this.entities.set(sensor.id, {
        kind: "sensor",
        record: clone(sensor),
        state: clone(sensor.state),
      });
    }

    this.descriptor = createRoomAdapterContractDescriptor({
      identity: {
        adapter_id: this.adapterId,
        adapter_kind: "fake",
        display_name: "Fake Room Adapter",
        fake_first: true,
        conformance_required_before_real_hardware: true,
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      },
      supported_capabilities: supportedCapabilities(this.entities),
    });
  }

  async readState(input: {
    deviceId: string;
    capability: Capability;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    const entity = this.entities.get(input.deviceId);
    const supported = entity
      ? capabilitiesFor(entity).includes(input.capability)
      : false;
    return this.result({
      operation: "read_state",
      mode: "read_only",
      deviceId: input.deviceId,
      capability: input.capability,
      state: entity && supported ? clone(entity.state) : null,
      ok: Boolean(entity && supported),
      failureClass: entity && supported ? null : "unsupported_capability",
      approvalRequired: false,
      approvalId: null,
    });
  }

  async planCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterDryRunPlan> {
    const command = RoomAdapterCommandSchema.parse(input.command);
    const entity = this.requireSupportedEntity(
      command.device_id,
      command.capability,
    );
    const intended = applyCommandToState(entity.state, command);

    return RoomAdapterDryRunPlanSchema.parse({
      plan_id: `plan-${command.command_id}`,
      command,
      provenance: this.provenance(command, "dry_run", null),
      current_state: clone(entity.state),
      intended_state: intended,
      approval: command.approval,
      mode: "dry_run",
      executable_now: false,
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
    });
  }

  async executeCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    const command = RoomAdapterCommandSchema.parse(input.command);
    const entity = this.requireSupportedEntity(
      command.device_id,
      command.capability,
    );
    if (!isMutatingCapability(command.capability)) {
      return this.result({
        operation: "execute_command",
        mode: command.mode,
        deviceId: command.device_id,
        capability: command.capability,
        state: clone(entity.state),
        ok: false,
        failureClass: "invalid_command",
        approvalRequired: false,
        approvalId: null,
      });
    }
    if (command.mode !== "approved_execution" || !input.context.approvalId) {
      return this.result({
        operation: "execute_command",
        mode: command.mode,
        deviceId: command.device_id,
        capability: command.capability,
        state: clone(entity.state),
        ok: false,
        failureClass: "approval_missing",
        approvalRequired: true,
        approvalId: input.context.approvalId ?? null,
      });
    }

    entity.state = applyCommandToState(entity.state, command);
    return this.result({
      operation: "execute_command",
      mode: "approved_execution",
      deviceId: command.device_id,
      capability: command.capability,
      state: clone(entity.state),
      ok: true,
      failureClass: null,
      approvalRequired: true,
      approvalId: input.context.approvalId,
    });
  }

  async verifyState(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    const command = RoomAdapterCommandSchema.parse(input.command);
    const entity = this.requireSupportedEntity(
      command.device_id,
      command.capability,
    );
    return this.result({
      operation: "verify_state",
      mode: input.context.mode,
      deviceId: command.device_id,
      capability: command.capability,
      state: clone(entity.state),
      ok: true,
      failureClass: null,
      approvalRequired: isMutatingCapability(command.capability),
      approvalId: input.context.approvalId ?? null,
    });
  }

  async healthCheck(input?: {
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterHealthStatus> {
    void input;
    return RoomAdapterHealthStatusSchema.parse({
      adapter_id: this.adapterId,
      status: "healthy",
      checked_at_ms: 0,
      failure_class: null,
      hardware_io_performed: false,
      network_called: false,
    });
  }

  private requireSupportedEntity(
    deviceId: string,
    capability: Capability,
  ): KnownEntity {
    const entity = this.entities.get(deviceId);
    if (!entity || !capabilitiesFor(entity).includes(capability)) {
      throw new Error(
        `Unsupported fake room capability: ${deviceId}:${capability}`,
      );
    }
    return entity;
  }

  private result(input: {
    operation: "read_state" | "execute_command" | "verify_state";
    mode: "read_only" | "dry_run" | "approved_execution";
    deviceId: string;
    capability: Capability;
    state: DeviceState | SensorState | null;
    ok: boolean;
    failureClass:
      | null
      | "unsupported_capability"
      | "invalid_command"
      | "approval_missing";
    approvalRequired: boolean;
    approvalId: string | null;
  }): RoomAdapterOperationResult {
    return RoomAdapterOperationResultSchema.parse({
      operation: input.operation,
      mode: input.mode,
      ok: input.ok,
      provenance: {
        correlation_id: `${input.operation}-${input.deviceId}-${input.capability.replace(".", "-")}`,
        requested_at_ms: 0,
        requested_by: "jarvis_room_os",
        source_phase: "10B.3",
        adapter_id: this.adapterId,
        device_id: input.deviceId,
        capability: input.capability,
        mode: input.mode,
        dry_run: input.mode === "dry_run",
        approval_id: input.approvalId,
        metadata_only: true,
      },
      state: input.state,
      failure_class: input.failureClass,
      approval: {
        required: input.approvalRequired,
        policy_id: input.approvalRequired ? "fake-room-approval-policy" : null,
        reason: input.approvalRequired
          ? "Fake mutating command requires approval metadata."
          : null,
        dry_run_required: true,
        auto_approval_allowed: false,
        voice_only_approval_allowed: false,
      },
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
  }

  private provenance(
    command: RoomAdapterCommand,
    mode: "dry_run" | "approved_execution",
    approvalId: string | null,
  ) {
    return {
      correlation_id: `plan-${command.command_id}`,
      requested_at_ms: 0,
      requested_by: "jarvis_room_os",
      source_phase: "10B.3",
      adapter_id: this.adapterId,
      device_id: command.device_id,
      capability: command.capability,
      mode,
      dry_run: mode === "dry_run",
      approval_id: approvalId,
      metadata_only: true,
    } as const;
  }
}

function supportedCapabilities(
  entities: Map<string, KnownEntity>,
): Capability[] {
  const capabilities = new Set<Capability>();
  for (const entity of entities.values()) {
    for (const capability of capabilitiesFor(entity))
      capabilities.add(capability);
  }
  return [...capabilities].sort();
}

function capabilitiesFor(entity: KnownEntity): Capability[] {
  return [...entity.record.capabilities];
}

function applyCommandToState(
  state: DeviceState | SensorState,
  command: RoomAdapterCommand,
): DeviceState | SensorState {
  if (!isDeviceState(state)) return clone(state);
  const next = clone(state);
  switch (command.capability) {
    case "power.switch":
      next.power = command.value === true ? "on" : "off";
      break;
    case "light.dimmer":
      if (typeof command.value !== "number")
        throw new Error("Brightness must be numeric.");
      next.brightness_percent = Math.min(
        100,
        Math.max(0, Math.round(command.value)),
      );
      break;
    case "light.color":
      if (typeof command.value !== "string")
        throw new Error("Color must be a string.");
      next.color_hex = command.value;
      break;
    default:
      return next;
  }
  next.derived = true;
  next.freshness = {
    observed_at_ms: 0,
    stale_after_ms: state.freshness.stale_after_ms,
    expires_at_ms: state.freshness.expires_at_ms,
    source: "mock",
  };
  return next;
}

function isDeviceState(state: DeviceState | SensorState): state is DeviceState {
  return "power" in state;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
