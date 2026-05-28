import { z } from "zod";
import {
  AdapterKindSchema,
  CapabilitySchema,
  DeviceStateSchema,
  SensorStateSchema,
} from "../schema";
import type { Capability } from "../types";

export const ROOM_ADAPTER_OPERATION_NAMES = [
  "read_state",
  "plan_command",
  "execute_command",
  "verify_state",
  "health_check",
] as const;

export const ROOM_ADAPTER_COMMAND_MODES = [
  "read_only",
  "dry_run",
  "approved_execution",
] as const;

export const ROOM_ADAPTER_COMMAND_ACTIONS = [
  "read",
  "set_power",
  "set_brightness",
  "set_color",
  "set_temperature",
] as const;

export const ROOM_ADAPTER_FAILURE_CLASSES = [
  "unsupported_capability",
  "invalid_command",
  "approval_required",
  "approval_missing",
  "approval_expired",
  "adapter_unavailable",
  "timeout",
  "auth_error",
  "partial_success",
  "cancelled",
  "verification_failed",
  "hardware_io_disabled",
  "network_disabled",
] as const;

export const ROOM_ADAPTER_PARTIAL_SUCCESS_SUB_OPERATION_STATUSES = [
  "success",
  "failed",
] as const;

export const ROOM_ADAPTER_COMPENSATION_SCOPES = [
  "command",
  "partial_success",
] as const;

export const ROOM_MUTATING_CAPABILITIES = [
  "power.switch",
  "light.dimmer",
  "light.color",
  "light.temperature",
] as const satisfies readonly Capability[];

export const RoomAdapterOperationNameSchema = z.enum(
  ROOM_ADAPTER_OPERATION_NAMES,
);
export const RoomAdapterCommandModeSchema = z.enum(ROOM_ADAPTER_COMMAND_MODES);
export const RoomAdapterCommandActionSchema = z.enum(
  ROOM_ADAPTER_COMMAND_ACTIONS,
);
export const RoomAdapterFailureClassSchema = z.enum(
  ROOM_ADAPTER_FAILURE_CLASSES,
);
export const RoomAdapterPartialSuccessSubOperationStatusSchema = z.enum(
  ROOM_ADAPTER_PARTIAL_SUCCESS_SUB_OPERATION_STATUSES,
);
export const RoomAdapterCompensationScopeSchema = z.enum(
  ROOM_ADAPTER_COMPENSATION_SCOPES,
);

const RoomAdapterIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const RoomAdapterIdentitySchema = z.strictObject({
  adapter_id: RoomAdapterIdSchema,
  adapter_kind: AdapterKindSchema,
  display_name: z.string().trim().min(1).max(160),
  fake_first: z.literal(true),
  conformance_required_before_real_hardware: z.literal(true),
  real_hardware_io: z.literal(false),
  network_access: z.literal(false),
  persistence_access: z.literal(false),
  ui_access: z.literal(false),
  implementation_enabled: z.literal(false),
});

export const RoomAdapterProvenanceSchema = z.strictObject({
  correlation_id: RoomAdapterIdSchema,
  requested_at_ms: z.number().int().nonnegative(),
  requested_by: z.literal("jarvis_room_os"),
  source_phase: z.literal("10B.3"),
  adapter_id: RoomAdapterIdSchema,
  device_id: RoomAdapterIdSchema,
  capability: CapabilitySchema,
  mode: RoomAdapterCommandModeSchema,
  dry_run: z.boolean(),
  approval_id: RoomAdapterIdSchema.nullable(),
  metadata_only: z.literal(true),
});

export const RoomAdapterApprovalRequirementSchema = z
  .strictObject({
    required: z.boolean(),
    policy_id: RoomAdapterIdSchema.nullable(),
    reason: z.string().trim().min(1).max(500).nullable(),
    dry_run_required: z.literal(true),
    auto_approval_allowed: z.literal(false),
    voice_only_approval_allowed: z.literal(false),
  })
  .superRefine((approval, ctx) => {
    if (approval.required && approval.policy_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["policy_id"],
        message: "Mutating commands require an approval policy id.",
      });
    }
    if (!approval.required && approval.policy_id !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["policy_id"],
        message: "Read-only commands must not attach approval policy ids.",
      });
    }
  });

export const RoomAdapterCommandSchema = z
  .strictObject({
    command_id: RoomAdapterIdSchema,
    mode: RoomAdapterCommandModeSchema,
    device_id: RoomAdapterIdSchema,
    capability: CapabilitySchema,
    action: RoomAdapterCommandActionSchema,
    value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
    one_command_one_action: z.literal(true),
    approval: RoomAdapterApprovalRequirementSchema,
    timeout_ms: z.number().int().positive().max(30_000),
    cancellation_supported: z.literal(true),
  })
  .superRefine((command, ctx) => {
    const mutating = isMutatingCapability(command.capability);
    if (command.mode === "read_only" && mutating) {
      ctx.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Mutating capabilities cannot run in read_only mode.",
      });
    }
    if (!mutating && command.mode !== "read_only") {
      ctx.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Observe-only capabilities must stay in read_only mode.",
      });
    }
    if (mutating && !command.approval.required) {
      ctx.addIssue({
        code: "custom",
        path: ["approval", "required"],
        message: "Mutating capabilities require approval metadata.",
      });
    }
    if (!mutating && command.approval.required) {
      ctx.addIssue({
        code: "custom",
        path: ["approval", "required"],
        message: "Observe-only capabilities must remain read-only.",
      });
    }
    if (command.action !== expectedActionForCapability(command.capability)) {
      ctx.addIssue({
        code: "custom",
        path: ["action"],
        message: "Command action must match exactly one capability.",
      });
    }
  });

export const RoomAdapterPartialSuccessSubOperationSchema = z.strictObject({
  operation_id: RoomAdapterIdSchema,
  operation_type: z.enum(["adapter_write", "verification_read"]),
  device_id: RoomAdapterIdSchema,
  capability: CapabilitySchema,
  status: RoomAdapterPartialSuccessSubOperationStatusSchema,
  failure_class: RoomAdapterFailureClassSchema.nullable(),
  reason: z.string().trim().min(1).max(500).nullable(),
  metadata_only: z.literal(true),
});

export const RoomAdapterCompensationSubOperationSchema = z.strictObject({
  operation_id: RoomAdapterIdSchema,
  device_id: RoomAdapterIdSchema,
  capability: CapabilitySchema,
  source_status: RoomAdapterPartialSuccessSubOperationStatusSchema,
  compensation_required: z.boolean(),
  reason: z.string().trim().min(1).max(500),
  metadata_only: z.literal(true),
});

export const RoomAdapterCompensationPlanSchema = z.strictObject({
  compensation_id: RoomAdapterIdSchema,
  source_command_id: RoomAdapterIdSchema,
  source_operation: z.enum(["plan_command", "execute_command"]),
  scope: RoomAdapterCompensationScopeSchema,
  device_id: RoomAdapterIdSchema,
  capability: CapabilitySchema,
  restore_action: RoomAdapterCommandActionSchema,
  restore_value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
  description: z.string().trim().min(1).max(500),
  sub_operations: z.array(RoomAdapterCompensationSubOperationSchema).min(1),
  descriptive_only: z.literal(true),
  requires_future_approval: z.literal(true),
  approval_lifecycle: z.literal("future_approval_required"),
  auto_execute: z.literal(false),
  executed: z.literal(false),
  rollback_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
  adapter_called: z.literal(false),
  hardware_io_performed: z.literal(false),
  network_called: z.literal(false),
  persisted: z.literal(false),
  ui_rendered: z.literal(false),
});

export const RoomAdapterDryRunPlanSchema = z.strictObject({
  plan_id: RoomAdapterIdSchema,
  command: RoomAdapterCommandSchema,
  provenance: RoomAdapterProvenanceSchema,
  current_state: z.union([DeviceStateSchema, SensorStateSchema]),
  intended_state: z.union([DeviceStateSchema, SensorStateSchema]),
  compensation: RoomAdapterCompensationPlanSchema.nullable().optional(),
  approval: RoomAdapterApprovalRequirementSchema,
  mode: z.literal("dry_run"),
  executable_now: z.literal(false),
  adapter_called: z.literal(false),
  hardware_io_performed: z.literal(false),
  network_called: z.literal(false),
  persisted: z.literal(false),
});

export const RoomAdapterPartialSuccessMetadataSchema = z.strictObject({
  result_status: z.literal("partial_success"),
  successful_operations: z
    .array(RoomAdapterPartialSuccessSubOperationSchema)
    .min(1),
  failed_operations: z
    .array(RoomAdapterPartialSuccessSubOperationSchema)
    .min(1),
  automatic_retry: z.literal(false),
  fallback_adapter_used: z.literal(false),
  audit_event_required: z.literal(true),
  future_real_hue_parity: z.literal(true),
  metadata_only: z.literal(true),
});

export const RoomAdapterOperationResultSchema = z
  .strictObject({
    operation: RoomAdapterOperationNameSchema,
    mode: RoomAdapterCommandModeSchema,
    ok: z.boolean(),
    provenance: RoomAdapterProvenanceSchema,
    state: z.union([DeviceStateSchema, SensorStateSchema]).nullable(),
    failure_class: RoomAdapterFailureClassSchema.nullable(),
    partial_success:
      RoomAdapterPartialSuccessMetadataSchema.nullable().optional(),
    compensation: RoomAdapterCompensationPlanSchema.nullable().optional(),
    approval: RoomAdapterApprovalRequirementSchema,
    adapter_called: z.literal(false),
    hardware_io_performed: z.literal(false),
    network_called: z.literal(false),
    persisted: z.literal(false),
    ui_rendered: z.literal(false),
  })
  .superRefine((result, ctx) => {
    if (result.failure_class === "partial_success") {
      if (!result.partial_success) {
        ctx.addIssue({
          code: "custom",
          path: ["partial_success"],
          message: "Partial success results require sub-operation metadata.",
        });
      }
      if (result.ok) {
        ctx.addIssue({
          code: "custom",
          path: ["ok"],
          message: "Partial success cannot be reported as silent success.",
        });
      }
    }
    if (result.partial_success && result.failure_class !== "partial_success") {
      ctx.addIssue({
        code: "custom",
        path: ["failure_class"],
        message:
          "Partial success metadata requires partial_success failure class.",
      });
    }
  });

export const RoomAdapterHealthStatusSchema = z.strictObject({
  adapter_id: RoomAdapterIdSchema,
  status: z.enum(["unknown", "healthy", "degraded", "unavailable"]),
  checked_at_ms: z.number().int().nonnegative(),
  failure_class: RoomAdapterFailureClassSchema.nullable(),
  hardware_io_performed: z.literal(false),
  network_called: z.literal(false),
});

export const RoomAdapterContractDescriptorSchema = z.strictObject({
  identity: RoomAdapterIdentitySchema,
  supported_capabilities: z.array(CapabilitySchema).min(1),
  operations: z.tuple([
    z.literal("read_state"),
    z.literal("plan_command"),
    z.literal("execute_command"),
    z.literal("verify_state"),
    z.literal("health_check"),
  ]),
  supported_modes: z.tuple([
    z.literal("read_only"),
    z.literal("dry_run"),
    z.literal("approved_execution"),
  ]),
  failure_classes: z.array(RoomAdapterFailureClassSchema).min(1),
  real_adapter_executable_in_phase_10b3: z.literal(false),
  implementation_side_effects_enabled: z.literal(false),
});

export type RoomAdapterOperationName = z.infer<
  typeof RoomAdapterOperationNameSchema
>;
export type RoomAdapterCommandMode = z.infer<
  typeof RoomAdapterCommandModeSchema
>;
export type RoomAdapterCommandAction = z.infer<
  typeof RoomAdapterCommandActionSchema
>;
export type RoomAdapterFailureClass = z.infer<
  typeof RoomAdapterFailureClassSchema
>;
export type RoomAdapterCompensationSubOperation = z.infer<
  typeof RoomAdapterCompensationSubOperationSchema
>;
export type RoomAdapterCompensationPlan = z.infer<
  typeof RoomAdapterCompensationPlanSchema
>;
export type RoomAdapterPartialSuccessSubOperation = z.infer<
  typeof RoomAdapterPartialSuccessSubOperationSchema
>;
export type RoomAdapterPartialSuccessMetadata = z.infer<
  typeof RoomAdapterPartialSuccessMetadataSchema
>;
export type RoomAdapterIdentity = z.infer<typeof RoomAdapterIdentitySchema>;
export type RoomAdapterProvenance = z.infer<typeof RoomAdapterProvenanceSchema>;
export type RoomAdapterApprovalRequirement = z.infer<
  typeof RoomAdapterApprovalRequirementSchema
>;
export type RoomAdapterCommand = z.infer<typeof RoomAdapterCommandSchema>;
export type RoomAdapterDryRunPlan = z.infer<typeof RoomAdapterDryRunPlanSchema>;
export type RoomAdapterOperationResult = z.infer<
  typeof RoomAdapterOperationResultSchema
>;
export type RoomAdapterHealthStatus = z.infer<
  typeof RoomAdapterHealthStatusSchema
>;
export type RoomAdapterContractDescriptor = z.infer<
  typeof RoomAdapterContractDescriptorSchema
>;

export interface RoomAdapterExecutionContext {
  readonly mode: RoomAdapterCommandMode;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly approvalId?: string;
}

export interface RoomAdapterContract {
  readonly descriptor: RoomAdapterContractDescriptor;
  readState(input: {
    deviceId: string;
    capability: Capability;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult>;
  planCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterDryRunPlan>;
  executeCommand(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult>;
  verifyState(input: {
    command: RoomAdapterCommand;
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterOperationResult>;
  healthCheck(input: {
    context: RoomAdapterExecutionContext;
  }): Promise<RoomAdapterHealthStatus>;
}

export function createRoomAdapterContractDescriptor(
  input: Omit<
    RoomAdapterContractDescriptor,
    | "operations"
    | "supported_modes"
    | "failure_classes"
    | "real_adapter_executable_in_phase_10b3"
    | "implementation_side_effects_enabled"
  >,
): RoomAdapterContractDescriptor {
  return RoomAdapterContractDescriptorSchema.parse({
    ...input,
    operations: ROOM_ADAPTER_OPERATION_NAMES,
    supported_modes: ROOM_ADAPTER_COMMAND_MODES,
    failure_classes: ROOM_ADAPTER_FAILURE_CLASSES,
    real_adapter_executable_in_phase_10b3: false,
    implementation_side_effects_enabled: false,
  });
}

export function isMutatingCapability(capability: Capability): boolean {
  return ROOM_MUTATING_CAPABILITIES.includes(
    capability as (typeof ROOM_MUTATING_CAPABILITIES)[number],
  );
}

function expectedActionForCapability(
  capability: Capability,
): z.infer<typeof RoomAdapterCommandSchema.shape.action> {
  switch (capability) {
    case "power.switch":
      return "set_power";
    case "light.dimmer":
      return "set_brightness";
    case "light.color":
      return "set_color";
    case "light.temperature":
      return "set_temperature";
    default:
      return "read";
  }
}
