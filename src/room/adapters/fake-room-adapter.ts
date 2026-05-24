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
  type RoomAdapterFailureClass,
  type RoomAdapterHealthStatus,
  type RoomAdapterOperationResult,
  type RoomAdapterProvenance,
} from "./contract";
import {
  FakeDeviceEventEmitter,
  type FakeDeviceEvent,
  type FakeDeviceEventStatus,
  type FakeDeviceEventType,
} from "./fake-events";
import {
  FakeFailureController,
  fakeFailureClassFor,
  markFakeStateStale,
  type FakeDeviceFailureMode,
  type FakeFailureSeed,
} from "./fake-failures";
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
  readonly failures?: FakeFailureController | readonly FakeFailureSeed[];
  readonly events?: FakeDeviceEventEmitter;
}

export class FakeRoomAdapter implements RoomAdapterContract {
  readonly descriptor: RoomAdapterContractDescriptor;
  private readonly adapterId: string;
  private readonly entities = new Map<string, KnownEntity>();
  private readonly failures: FakeFailureController;
  private readonly events: FakeDeviceEventEmitter;
  private readonly profileId: string | null;
  private readonly roomId: string | null;

  constructor(input: FakeRoomAdapterInput) {
    const profile = input.profile ? parseRoomProfile(input.profile) : null;
    const devices = profile ? profile.devices : [...(input.devices ?? [])];
    const sensors = profile ? profile.sensors : [...(input.sensors ?? [])];
    this.adapterId = input.adapterId ?? "fake-room-adapter";
    this.profileId = profile?.profile_id ?? null;
    this.roomId = profile?.room_id ?? null;
    this.events = input.events ?? new FakeDeviceEventEmitter();
    this.failures =
      input.failures instanceof FakeFailureController
        ? input.failures
        : new FakeFailureController(input.failures ?? []);

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
    const blockingFailure =
      entity && supported
        ? this.failures.firstBlockingFailure(input.deviceId)
        : null;
    const state =
      entity && supported && !blockingFailure
        ? this.readableState(input.deviceId, entity.state)
        : null;
    const result = this.result({
      operation: "read_state",
      mode: "read_only",
      deviceId: input.deviceId,
      capability: input.capability,
      state,
      ok: Boolean(entity && supported && !blockingFailure),
      failureClass:
        entity && supported
          ? blockingFailure
            ? fakeFailureClassFor(blockingFailure)
            : null
          : "unsupported_capability",
      approvalRequired: false,
      approvalId: null,
    });
    this.emitOperationEvent({
      eventType: "state_read",
      deviceId: entity?.kind === "device" ? input.deviceId : null,
      sensorId: entity?.kind === "sensor" ? input.deviceId : null,
      capability: input.capability,
      status: result.ok ? "ok" : "failed",
      failureClass: result.failure_class,
      provenance: result.provenance,
    });
    if (blockingFailure && entity) {
      this.emitOperationEvent({
        eventType: "failure_simulated",
        deviceId: entity.kind === "device" ? input.deviceId : null,
        sensorId: entity.kind === "sensor" ? input.deviceId : null,
        capability: input.capability,
        status: "failed",
        failureClass: result.failure_class,
        provenance: result.provenance,
      });
    }
    return result;
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
    this.throwIfPlanningBlocked(command.device_id);
    const intended = applyCommandToState(entity.state, command);

    const plan = RoomAdapterDryRunPlanSchema.parse({
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
    this.emitOperationEvent({
      eventType: "command_planned",
      deviceId: entity.kind === "device" ? command.device_id : null,
      sensorId: entity.kind === "sensor" ? command.device_id : null,
      capability: command.capability,
      commandId: command.command_id,
      planId: plan.plan_id,
      status: "planned",
      failureClass: null,
      provenance: plan.provenance,
    });
    return plan;
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
    const blockingFailure = this.failures.firstBlockingFailure(
      command.device_id,
    );
    if (blockingFailure) {
      const result = this.result({
        operation: "execute_command",
        mode: command.mode,
        deviceId: command.device_id,
        capability: command.capability,
        state: clone(entity.state),
        ok: false,
        failureClass: fakeFailureClassFor(blockingFailure),
        approvalRequired: isMutatingCapability(command.capability),
        approvalId: input.context.approvalId ?? null,
      });
      this.emitCommandResultEvent(command, entity, result);
      this.emitOperationEvent({
        eventType: "failure_simulated",
        deviceId: entity.kind === "device" ? command.device_id : null,
        sensorId: entity.kind === "sensor" ? command.device_id : null,
        capability: command.capability,
        commandId: command.command_id,
        status: "failed",
        failureClass: result.failure_class,
        provenance: result.provenance,
      });
      return result;
    }
    if (!isMutatingCapability(command.capability)) {
      const result = this.result({
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
      this.emitCommandResultEvent(command, entity, result);
      return result;
    }
    if (command.mode !== "approved_execution" || !input.context.approvalId) {
      const result = this.result({
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
      this.emitCommandResultEvent(command, entity, result);
      return result;
    }

    entity.state = applyCommandToState(entity.state, command);
    const result = this.result({
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
    this.emitCommandResultEvent(command, entity, result);
    return result;
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
    const blockingFailure = this.failures.firstBlockingFailure(
      command.device_id,
    );
    if (blockingFailure) {
      const result = this.result({
        operation: "verify_state",
        mode: input.context.mode,
        deviceId: command.device_id,
        capability: command.capability,
        state: clone(entity.state),
        ok: false,
        failureClass: fakeFailureClassFor(blockingFailure),
        approvalRequired: isMutatingCapability(command.capability),
        approvalId: input.context.approvalId ?? null,
      });
      this.emitVerificationEvent(command, entity, result);
      this.emitOperationEvent({
        eventType: "failure_simulated",
        deviceId: entity.kind === "device" ? command.device_id : null,
        sensorId: entity.kind === "sensor" ? command.device_id : null,
        capability: command.capability,
        commandId: command.command_id,
        status: "failed",
        failureClass: result.failure_class,
        provenance: result.provenance,
      });
      return result;
    }
    const result = this.result({
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
    this.emitVerificationEvent(command, entity, result);
    return result;
  }

  async healthCheck(input?: {
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterHealthStatus> {
    void input;
    const blockingFailure = this.failures.firstBlockingFailure();
    const health = RoomAdapterHealthStatusSchema.parse({
      adapter_id: this.adapterId,
      status: blockingFailure ? "unavailable" : "healthy",
      checked_at_ms: 0,
      failure_class: blockingFailure
        ? fakeFailureClassFor(blockingFailure)
        : null,
      hardware_io_performed: false,
      network_called: false,
    });
    this.emitOperationEvent({
      eventType: "health_checked",
      deviceId: null,
      sensorId: null,
      capability: null,
      status: "checked",
      failureClass: health.failure_class,
      provenance: null,
    });
    if (blockingFailure) {
      this.emitOperationEvent({
        eventType: "failure_simulated",
        deviceId: null,
        sensorId: null,
        capability: null,
        status: "failed",
        failureClass: health.failure_class,
        provenance: null,
      });
    }
    return health;
  }

  enableFailure(mode: FakeDeviceFailureMode, targetId?: string): void {
    this.failures.enable(mode, targetId);
  }

  clearFailure(mode?: FakeDeviceFailureMode, targetId?: string): void {
    this.failures.clear(mode, targetId);
  }

  clearAllFailures(): void {
    this.failures.clearAll();
  }

  getEvents(): FakeDeviceEvent[] {
    return this.events.snapshot();
  }

  clearEvents(): void {
    this.events.clear();
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

  private emitCommandResultEvent(
    command: RoomAdapterCommand,
    entity: KnownEntity,
    result: RoomAdapterOperationResult,
  ): void {
    this.emitOperationEvent({
      eventType: result.ok ? "command_executed" : "command_rejected",
      deviceId: entity.kind === "device" ? command.device_id : null,
      sensorId: entity.kind === "sensor" ? command.device_id : null,
      capability: command.capability,
      commandId: command.command_id,
      status: result.ok ? "ok" : "rejected",
      failureClass: result.failure_class,
      provenance: result.provenance,
    });
  }

  private emitVerificationEvent(
    command: RoomAdapterCommand,
    entity: KnownEntity,
    result: RoomAdapterOperationResult,
  ): void {
    this.emitOperationEvent({
      eventType: "verification_read",
      deviceId: entity.kind === "device" ? command.device_id : null,
      sensorId: entity.kind === "sensor" ? command.device_id : null,
      capability: command.capability,
      commandId: command.command_id,
      status: result.ok ? "ok" : "failed",
      failureClass: result.failure_class,
      provenance: result.provenance,
    });
  }

  private emitOperationEvent(input: {
    eventType: FakeDeviceEventType;
    deviceId: string | null;
    sensorId: string | null;
    capability: Capability | null;
    commandId?: string | null;
    planId?: string | null;
    status: FakeDeviceEventStatus;
    failureClass: RoomAdapterFailureClass | null;
    provenance: RoomAdapterProvenance | null;
  }): void {
    this.events.emit({
      event_type: input.eventType,
      adapter_id: this.adapterId,
      adapter_kind: "fake",
      room_id: this.roomId,
      profile_id: this.profileId,
      device_id: input.deviceId,
      sensor_id: input.sensorId,
      capability: input.capability,
      command_id: input.commandId ?? null,
      plan_id: input.planId ?? null,
      result_status: input.status,
      failure_class: input.failureClass,
      provenance: input.provenance,
    });
  }

  private result(input: {
    operation: "read_state" | "execute_command" | "verify_state";
    mode: "read_only" | "dry_run" | "approved_execution";
    deviceId: string;
    capability: Capability;
    state: DeviceState | SensorState | null;
    ok: boolean;
    failureClass: RoomAdapterFailureClass | null;
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

  private readableState(
    deviceId: string,
    state: DeviceState | SensorState,
  ): DeviceState | SensorState {
    return this.failures.isStale(deviceId)
      ? markFakeStateStale(state)
      : clone(state);
  }

  private throwIfPlanningBlocked(deviceId: string): void {
    const blockingFailure = this.failures.firstBlockingFailure(deviceId);
    if (!blockingFailure) return;
    throw new Error(
      `Fake room adapter planning blocked by ${fakeFailureClassFor(blockingFailure)}.`,
    );
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
    case "light.temperature":
      if (typeof command.value !== "number")
        throw new Error("Color temperature must be numeric.");
      next.color_temperature_kelvin = Math.min(
        6500,
        Math.max(2000, Math.round(command.value)),
      );
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
