import {
  RoomAdapterCommandSchema,
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
import {
  EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
  parseHueReadOnlyAdapterConfig,
  type HueReadOnlyAdapterConfig,
} from "./hue-config";
import type { Capability } from "../types";

export const HUE_READ_ONLY_ADAPTER_MODE = {
  adapter_kind: "hue",
  mode: "read_only",
  enabled: false,
  source: "local_hue_bridge",
  writes_supported: false,
  discovery_supported: false,
  cloud_supported: false,
  network_called: false,
  real_reads_implemented: false,
  real_writes_implemented: false,
} as const;

export class DisabledHueReadOnlyAdapter implements RoomAdapterContract {
  readonly descriptor: RoomAdapterContractDescriptor;
  readonly config: HueReadOnlyAdapterConfig;

  constructor(
    config: HueReadOnlyAdapterConfig = EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
  ) {
    this.config = parseHueReadOnlyAdapterConfig(config);
    this.descriptor = createRoomAdapterContractDescriptor({
      identity: {
        adapter_id: this.config.adapter_id,
        adapter_kind: "hue",
        display_name: "Disabled Hue Read-Only Adapter",
        fake_first: true,
        conformance_required_before_real_hardware: true,
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      },
      supported_capabilities: ["power.observe", "light.observe"],
    });
  }

  getModeMetadata(): typeof HUE_READ_ONLY_ADAPTER_MODE {
    return HUE_READ_ONLY_ADAPTER_MODE;
  }

  async readState(input: {
    deviceId: string;
    capability: Capability;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    return this.disabledResult({
      operation: "read_state",
      mode: "read_only",
      deviceId: input.deviceId,
      capability: input.capability,
      approvalRequired: false,
      approvalId: null,
    });
  }

  async planCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterDryRunPlan> {
    void input;
    throw new Error("Hue adapter write planning disabled in Phase 16B.1.");
  }

  async executeCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    const command = RoomAdapterCommandSchema.parse(input.command);

    return this.disabledResult({
      operation: "execute_command",
      mode: command.mode,
      deviceId: command.device_id,
      capability: command.capability,
      approvalRequired: isMutatingCapability(command.capability),
      approvalId: input.context.approvalId ?? null,
    });
  }

  async verifyState(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult> {
    const command = RoomAdapterCommandSchema.parse(input.command);

    return this.disabledResult({
      operation: "verify_state",
      mode: input.context.mode,
      deviceId: command.device_id,
      capability: command.capability,
      approvalRequired: isMutatingCapability(command.capability),
      approvalId: input.context.approvalId ?? null,
    });
  }

  async healthCheck(input?: {
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterHealthStatus> {
    void input;

    return RoomAdapterHealthStatusSchema.parse({
      adapter_id: this.config.adapter_id,
      status: "unavailable",
      checked_at_ms: 0,
      failure_class: "adapter_unavailable",
      hardware_io_performed: false,
      network_called: false,
    });
  }

  private disabledResult(input: {
    operation: "read_state" | "execute_command" | "verify_state";
    mode: "read_only" | "dry_run" | "approved_execution";
    deviceId: string;
    capability: Capability;
    approvalRequired: boolean;
    approvalId: string | null;
  }): RoomAdapterOperationResult {
    return RoomAdapterOperationResultSchema.parse({
      operation: input.operation,
      mode: input.mode,
      ok: false,
      provenance: {
        correlation_id: `${input.operation}-${input.deviceId}-${input.capability.replace(".", "-")}`,
        requested_at_ms: 0,
        requested_by: "jarvis_room_os",
        source_phase: "10B.3",
        adapter_id: this.config.adapter_id,
        device_id: input.deviceId,
        capability: input.capability,
        mode: input.mode,
        dry_run: input.mode === "dry_run",
        approval_id: input.approvalId,
        metadata_only: true,
      },
      state: null,
      failure_class:
        input.operation === "read_state"
          ? "adapter_unavailable"
          : "hardware_io_disabled",
      partial_success: null,
      compensation: null,
      approval: {
        required: input.approvalRequired,
        policy_id: input.approvalRequired ? "fake-room-approval-policy" : null,
        reason: input.approvalRequired
          ? "Hue adapter writes are disabled in Phase 16B.1."
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
}
