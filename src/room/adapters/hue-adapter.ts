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
  validateHueReadOnlyAdapterConfig,
  type HueReadOnlyAdapterConfigValidation,
} from "./hue-config";
import {
  createHueDryRunPlan,
  type HueDryRunIntendedState,
  type HueDryRunPlan,
} from "./hue-dry-run";
import {
  mapHueReadPayloadsToBridgeSnapshot,
  type HueBridgeV2BridgePayloadFixture,
  type HueBridgeV2LightPayloadFixture,
  type HueReadBridgeSnapshot,
  type HueReadLightSnapshot,
  type HueReadMapperOptions,
} from "./hue-read-mapper";
import {
  DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  type Phase16RoomAdapterDisabledGuardMatrix,
} from "./phase-16-disabled-guards";
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

export interface HueReadHealthMetadata {
  readonly status:
    | "disabled"
    | "config_missing"
    | "config_invalid"
    | "ready_for_future_read_only";
  readonly reason:
    | "adapter_disabled"
    | "manual_config_missing"
    | "manual_config_invalid"
    | "ready_but_execution_disabled";
  readonly error_class:
    | "adapter_disabled"
    | "config_missing"
    | "config_invalid"
    | null;
  readonly adapter_id: string;
  readonly adapter_kind: "hue";
  readonly source: "local_hue_bridge";
  readonly enabled: false;
  readonly read_only: true;
  readonly bridge_ip_configured: boolean;
  readonly bridge_ip_source: "manual" | "not_configured";
  readonly api_key_config_ref_status: "configured" | "not_configured";
  readonly validation_errors: readonly {
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }[];
  readonly writes_supported: false;
  readonly discovery_supported: false;
  readonly cloud_supported: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly metadata_only: true;
}

export interface DisabledHueFixtureDryRunReadInput {
  readonly bridge: HueBridgeV2BridgePayloadFixture;
  readonly lights: readonly HueBridgeV2LightPayloadFixture[];
  readonly options?: HueReadMapperOptions;
}

export interface DisabledHueFixtureDryRunReadResult {
  readonly status: "fixture_mapped";
  readonly adapter_id: string;
  readonly adapter_kind: "hue";
  readonly mode: "read_only";
  readonly source: "local_hue_bridge";
  readonly fixture_only: true;
  readonly dry_run_read: true;
  readonly enabled: false;
  readonly read_only: true;
  readonly config_status: HueReadHealthMetadata["status"];
  readonly bridge_ip_configured: boolean;
  readonly api_key_config_ref_status: HueReadHealthMetadata["api_key_config_ref_status"];
  readonly writes_supported: false;
  readonly discovery_supported: false;
  readonly cloud_supported: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly metadata_only: true;
  readonly snapshot: HueReadBridgeSnapshot;
}

export interface HueLiveReadPreflightOptions {
  readonly disabledGuards?: Partial<Phase16RoomAdapterDisabledGuardMatrix>;
}

export interface HueLiveReadPreflightDecision {
  readonly allowed: false;
  readonly status: "denied" | "ready_for_manual_live_read_implementation";
  readonly reason:
    | "manual_config_missing"
    | "manual_config_invalid"
    | "disabled_guard_unsafe"
    | "ready_but_live_read_not_implemented";
  readonly error_class:
    | "config_missing"
    | "config_invalid"
    | "disabled_guard_unsafe"
    | "live_read_not_implemented";
  readonly adapter_kind: "hue";
  readonly mode: "read_only";
  readonly source: "local_hue_bridge";
  readonly config_status: HueReadOnlyAdapterConfigValidation["status"];
  readonly fake_conformance_status: "required_and_pinned";
  readonly disabled_guard_status: "pinned_off" | "unsafe";
  readonly enabled: false;
  readonly read_only: true;
  readonly network_allowed: false;
  readonly discovery_allowed: false;
  readonly cloud_allowed: false;
  readonly writes_allowed: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly metadata_only: true;
  readonly live_read_implemented: false;
}

export interface DisabledHueAdapterDryRunPlanInput {
  readonly plan_id?: string;
  readonly target_light_id: string;
  readonly intended_state: HueDryRunIntendedState;
  readonly current_state_snapshot?: HueReadLightSnapshot | null;
}

export interface DisabledHueAdapterDryRunPlanResult {
  readonly status: "dry_run_planned";
  readonly adapter_id: string;
  readonly adapter_kind: "hue";
  readonly mode: "dry_run";
  readonly source: "local_hue_bridge";
  readonly dry_run_source: "fixture_current_state";
  readonly fixture_only: true;
  readonly enabled: false;
  readonly read_only: true;
  readonly config_status: HueReadHealthMetadata["status"];
  readonly approval_required: true;
  readonly executable: false;
  readonly execution_supported: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly writes_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly metadata_only: true;
  readonly plan: HueDryRunPlan;
}

export function evaluateHueLiveReadPreflight(
  config?: unknown,
  options: HueLiveReadPreflightOptions = {},
): HueLiveReadPreflightDecision {
  return hueLiveReadPreflightFromValidation(
    validateHueReadOnlyAdapterConfig(config),
    options.disabledGuards ?? DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  );
}

export class DisabledHueReadOnlyAdapter implements RoomAdapterContract {
  readonly descriptor: RoomAdapterContractDescriptor;
  private readonly adapterId: string;
  private readonly validation: Omit<
    HueReadOnlyAdapterConfigValidation,
    "config"
  >;

  constructor(config?: unknown) {
    const validation = validateHueReadOnlyAdapterConfig(config);
    const safeValidation = { ...validation } as Omit<
      HueReadOnlyAdapterConfigValidation,
      "config"
    > & { config?: unknown };
    delete safeValidation.config;
    this.adapterId = "hue-read-only-disabled";
    this.validation = safeValidation;
    this.descriptor = createRoomAdapterContractDescriptor({
      identity: {
        adapter_id: this.adapterId,
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

  static withExampleConfig(): DisabledHueReadOnlyAdapter {
    return new DisabledHueReadOnlyAdapter(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    );
  }

  getModeMetadata(): typeof HUE_READ_ONLY_ADAPTER_MODE {
    return HUE_READ_ONLY_ADAPTER_MODE;
  }

  getReadHealth(): HueReadHealthMetadata {
    const configured = this.validation.status === "ready_for_future_read_only";
    const status = configured
      ? "ready_for_future_read_only"
      : this.validation.status;

    return {
      status,
      reason:
        status === "ready_for_future_read_only"
          ? "ready_but_execution_disabled"
          : status === "config_missing"
            ? "manual_config_missing"
            : status === "config_invalid"
              ? "manual_config_invalid"
              : "adapter_disabled",
      error_class:
        status === "ready_for_future_read_only"
          ? null
          : status === "config_missing"
            ? "config_missing"
            : status === "config_invalid"
              ? "config_invalid"
              : "adapter_disabled",
      adapter_id: this.adapterId,
      adapter_kind: "hue",
      source: "local_hue_bridge",
      enabled: false,
      read_only: true,
      bridge_ip_configured: this.validation.bridge_ip_configured,
      bridge_ip_source: this.validation.bridge_ip_source,
      api_key_config_ref_status: this.validation.api_key_config_ref_status,
      validation_errors: this.validation.issues,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
    };
  }

  dryRunReadFixtureSnapshot(
    input: DisabledHueFixtureDryRunReadInput,
  ): DisabledHueFixtureDryRunReadResult {
    const health = this.getReadHealth();

    return {
      status: "fixture_mapped",
      adapter_id: this.adapterId,
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      fixture_only: true,
      dry_run_read: true,
      enabled: false,
      read_only: true,
      config_status: health.status,
      bridge_ip_configured: health.bridge_ip_configured,
      api_key_config_ref_status: health.api_key_config_ref_status,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
      snapshot: mapHueReadPayloadsToBridgeSnapshot(input),
    };
  }

  getLiveReadPreflight(
    options: HueLiveReadPreflightOptions = {},
  ): HueLiveReadPreflightDecision {
    return hueLiveReadPreflightFromValidation(
      this.validation,
      options.disabledGuards ?? DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
    );
  }

  createDryRunPlan(
    input: DisabledHueAdapterDryRunPlanInput,
  ): DisabledHueAdapterDryRunPlanResult {
    const health = this.getReadHealth();
    const plan = createHueDryRunPlan({
      plan_id: input.plan_id,
      target_light_id: input.target_light_id,
      intended_state: input.intended_state,
      current_state_snapshot: input.current_state_snapshot ?? null,
    });

    return {
      status: "dry_run_planned",
      adapter_id: this.adapterId,
      adapter_kind: "hue",
      mode: "dry_run",
      source: "local_hue_bridge",
      dry_run_source: "fixture_current_state",
      fixture_only: true,
      enabled: false,
      read_only: true,
      config_status: health.status,
      approval_required: true,
      executable: false,
      execution_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      writes_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
      plan,
    };
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
    throw new Error("Hue adapter write planning disabled in Phase 16B.2.");
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
      adapter_id: this.adapterId,
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
        adapter_id: this.adapterId,
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
          ? "Hue adapter writes are disabled in Phase 16B.2."
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

function hueLiveReadPreflightFromValidation(
  validation: Omit<HueReadOnlyAdapterConfigValidation, "config">,
  disabledGuards: Partial<Phase16RoomAdapterDisabledGuardMatrix>,
): HueLiveReadPreflightDecision {
  const disabledGuardStatus = guardsPinnedOff(disabledGuards)
    ? "pinned_off"
    : "unsafe";

  if (disabledGuardStatus === "unsafe") {
    return preflightDecision(validation, {
      status: "denied",
      reason: "disabled_guard_unsafe",
      error_class: "disabled_guard_unsafe",
      disabledGuardStatus,
    });
  }

  if (validation.status === "config_missing") {
    return preflightDecision(validation, {
      status: "denied",
      reason: "manual_config_missing",
      error_class: "config_missing",
      disabledGuardStatus,
    });
  }

  if (validation.status === "config_invalid") {
    return preflightDecision(validation, {
      status: "denied",
      reason: "manual_config_invalid",
      error_class: "config_invalid",
      disabledGuardStatus,
    });
  }

  return preflightDecision(validation, {
    status: "ready_for_manual_live_read_implementation",
    reason: "ready_but_live_read_not_implemented",
    error_class: "live_read_not_implemented",
    disabledGuardStatus,
  });
}

function preflightDecision(
  validation: Omit<HueReadOnlyAdapterConfigValidation, "config">,
  input: {
    readonly status: HueLiveReadPreflightDecision["status"];
    readonly reason: HueLiveReadPreflightDecision["reason"];
    readonly error_class: HueLiveReadPreflightDecision["error_class"];
    readonly disabledGuardStatus: HueLiveReadPreflightDecision["disabled_guard_status"];
  },
): HueLiveReadPreflightDecision {
  return {
    allowed: false,
    status: input.status,
    reason: input.reason,
    error_class: input.error_class,
    adapter_kind: "hue",
    mode: "read_only",
    source: "local_hue_bridge",
    config_status: validation.status,
    fake_conformance_status: "required_and_pinned",
    disabled_guard_status: input.disabledGuardStatus,
    enabled: false,
    read_only: true,
    network_allowed: false,
    discovery_allowed: false,
    cloud_allowed: false,
    writes_allowed: false,
    network_called: false,
    discovery_attempted: false,
    cloud_attempted: false,
    hardware_io_performed: false,
    persisted: false,
    ui_rendered: false,
    raw_config_ref_exposed: false,
    raw_api_key_exposed: false,
    metadata_only: true,
    live_read_implemented: false,
  };
}

function guardsPinnedOff(
  guards: Partial<Phase16RoomAdapterDisabledGuardMatrix>,
): boolean {
  return (
    guards.real_hue_writes_enabled === false &&
    guards.hue_auto_discovery_enabled === false &&
    guards.hue_cloud_remote_api_enabled === false &&
    guards.scenes_macros_enabled === false &&
    guards.scheduled_device_actions_enabled === false &&
    guards.voice_trust_class_elevation_enabled === false &&
    guards.runtime_trust_class_elevation_enabled === false &&
    guards.jarvis_policy_edits_enabled === false &&
    guards.multi_device_routines_enabled === false &&
    guards.real_hue_adapter_enabled === false &&
    guards.fake_conformance_required_before_real_hue === true &&
    guards.real_hue_adapter_requires_fake_conformance === true &&
    guards.network_called === false &&
    guards.hardware_io_performed === false &&
    guards.cloud_called === false &&
    guards.persisted === false &&
    guards.ui_rendered === false
  );
}
