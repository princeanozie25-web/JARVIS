import { z } from "zod";

export const VISION_RUNTIME_BLOCKED_AUTHORITY_CLASSES = [
  "approve_action",
  "execute_action",
  "mutate_memory",
  "mutate_project",
  "mutate_environment",
  "change_policy",
  "register_device",
  "start_background_job",
  "trigger_routine",
  "cloud_export",
] as const;

export const VISION_RUNTIME_ALLOWED_OPERATION_CLASSES = [
  "summarize_observation",
  "assemble_context",
  "create_replay_record",
  "evaluate_fallback_policy",
  "developer_diagnostic",
] as const;

export const VISION_RUNTIME_BOUNDARY_DECISIONS = [
  "allowed",
  "blocked",
  "requires_external_approval",
] as const;

export const VISION_RUNTIME_BOUNDARY_REASONS = [
  "advisory_read_allowed",
  "authority_surface_blocked",
  "mutation_blocked",
  "runtime_action_blocked",
  "approval_grant_blocked",
  "cloud_export_blocked",
  "background_job_blocked",
  "external_approval_required",
  "unknown_operation_blocked",
] as const;

export const VISION_RUNTIME_BOUNDARY_TELEMETRY_EVENT_TYPES = [
  "vision_boundary_evaluated",
] as const;

export const VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES = [
  "runtime_tool_calls",
  "approval_granting",
  "environment_mutation",
  "project_mutation",
  "memory_mutation",
  "policy_mutation",
  "device_registration",
  "autonomous_routines",
  "cloud_export",
  "capture_execution",
  "provider_execution",
  "background_jobs",
  "chat_router_wiring",
  "api_routes",
] as const;

export type VisionRuntimeBlockedAuthorityClass =
  (typeof VISION_RUNTIME_BLOCKED_AUTHORITY_CLASSES)[number];
export type VisionRuntimeAllowedOperationClass =
  (typeof VISION_RUNTIME_ALLOWED_OPERATION_CLASSES)[number];
export type VisionRuntimeOperationClass =
  | VisionRuntimeBlockedAuthorityClass
  | VisionRuntimeAllowedOperationClass
  | "unknown";
export type VisionRuntimeBoundaryDecision =
  (typeof VISION_RUNTIME_BOUNDARY_DECISIONS)[number];
export type VisionRuntimeBoundaryReason =
  (typeof VISION_RUNTIME_BOUNDARY_REASONS)[number];
export type VisionRuntimeBoundaryTelemetryEventType =
  (typeof VISION_RUNTIME_BOUNDARY_TELEMETRY_EVENT_TYPES)[number];
export type VisionRuntimeBoundaryDisabledFeature =
  (typeof VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES)[number];

export const VisionRuntimeBlockedAuthorityClassSchema = z.enum(
  VISION_RUNTIME_BLOCKED_AUTHORITY_CLASSES,
);
export const VisionRuntimeAllowedOperationClassSchema = z.enum(
  VISION_RUNTIME_ALLOWED_OPERATION_CLASSES,
);
export const VisionRuntimeOperationClassSchema = z.union([
  VisionRuntimeBlockedAuthorityClassSchema,
  VisionRuntimeAllowedOperationClassSchema,
  z.literal("unknown"),
]);
export const VisionRuntimeBoundaryDecisionSchema = z.enum(
  VISION_RUNTIME_BOUNDARY_DECISIONS,
);
export const VisionRuntimeBoundaryReasonSchema = z.enum(
  VISION_RUNTIME_BOUNDARY_REASONS,
);
export const VisionRuntimeBoundaryTelemetryEventTypeSchema = z.enum(
  VISION_RUNTIME_BOUNDARY_TELEMETRY_EVENT_TYPES,
);
export const VisionRuntimeBoundaryDisabledFeatureSchema = z.enum(
  VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES,
);

export const VisionRuntimeBoundaryFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionRuntimeBoundaryDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_RUNTIME_BOUNDARY_FEATURE_FLAGS = Object.fromEntries(
  VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionRuntimeBoundaryFeatureFlagsSchema>;

export const VisionRuntimeBoundaryDecisionRecordSchema = z.strictObject({
  kind: z.literal("vision.runtime_boundary_decision"),
  operation_class: VisionRuntimeOperationClassSchema,
  decision: VisionRuntimeBoundaryDecisionSchema,
  reason: VisionRuntimeBoundaryReasonSchema,
  requires_external_approval_path: z.boolean(),
  authority_surface: z.literal(false),
  advisory_only: z.literal(true),
  metadata_only: z.literal(true),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_mutated: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  policy_changed: z.literal(false),
  device_registered: z.literal(false),
  background_job_started: z.literal(false),
  routine_triggered: z.literal(false),
  cloud_exported: z.literal(false),
  capture_started: z.literal(false),
  provider_executed: z.literal(false),
});

export const VisionRuntimeBoundaryTelemetryEventSchema = z.strictObject({
  event_type: VisionRuntimeBoundaryTelemetryEventTypeSchema,
  operation_class: VisionRuntimeOperationClassSchema,
  decision: VisionRuntimeBoundaryDecisionSchema,
  reason: VisionRuntimeBoundaryReasonSchema,
  metadata_only: z.literal(true),
  class_reason_decision_only: z.literal(true),
  authority_surface: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  mutation_performed: z.literal(false),
  cloud_exported: z.literal(false),
  background_job_started: z.literal(false),
});

export const VisionRuntimeBoundaryReplayStepSchema = z.strictObject({
  operation_class: VisionRuntimeOperationClassSchema,
  decision: VisionRuntimeBoundaryDecisionSchema,
  reason: VisionRuntimeBoundaryReasonSchema,
  requires_external_approval_path: z.boolean(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  authority_surface: z.literal(false),
  advisory_only: z.literal(true),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  mutation_performed: z.literal(false),
  cloud_exported: z.literal(false),
  background_job_started: z.literal(false),
});

export type VisionRuntimeBoundaryFeatureFlags = z.infer<
  typeof VisionRuntimeBoundaryFeatureFlagsSchema
>;
export type VisionRuntimeBoundaryDecisionRecord = z.infer<
  typeof VisionRuntimeBoundaryDecisionRecordSchema
>;
export type VisionRuntimeBoundaryTelemetryEvent = z.infer<
  typeof VisionRuntimeBoundaryTelemetryEventSchema
>;
export type VisionRuntimeBoundaryReplayStep = z.infer<
  typeof VisionRuntimeBoundaryReplayStepSchema
>;

export interface EvaluateVisionRuntimeBoundaryInput {
  operation_class: VisionRuntimeOperationClass;
  external_approval_available?: boolean;
}

function isAllowedOperation(
  operationClass: VisionRuntimeOperationClass,
): operationClass is VisionRuntimeAllowedOperationClass {
  return VISION_RUNTIME_ALLOWED_OPERATION_CLASSES.includes(
    operationClass as VisionRuntimeAllowedOperationClass,
  );
}

function reasonForBlockedOperation(
  operationClass: VisionRuntimeOperationClass,
): VisionRuntimeBoundaryReason {
  switch (operationClass) {
    case "approve_action":
      return "approval_grant_blocked";
    case "execute_action":
    case "trigger_routine":
      return "runtime_action_blocked";
    case "mutate_memory":
    case "mutate_project":
    case "mutate_environment":
    case "change_policy":
    case "register_device":
      return "mutation_blocked";
    case "start_background_job":
      return "background_job_blocked";
    case "cloud_export":
      return "cloud_export_blocked";
    default:
      return "unknown_operation_blocked";
  }
}

export function evaluateVisionRuntimeBoundary(
  input: EvaluateVisionRuntimeBoundaryInput,
): VisionRuntimeBoundaryDecisionRecord {
  const operationClass = VisionRuntimeOperationClassSchema.parse(
    input.operation_class,
  );
  const decision = isAllowedOperation(operationClass)
    ? "allowed"
    : input.external_approval_available === true &&
        operationClass !== "approve_action"
      ? "requires_external_approval"
      : "blocked";
  const reason: VisionRuntimeBoundaryReason =
    decision === "allowed"
      ? "advisory_read_allowed"
      : decision === "requires_external_approval"
        ? "external_approval_required"
        : reasonForBlockedOperation(operationClass);

  return VisionRuntimeBoundaryDecisionRecordSchema.parse({
    kind: "vision.runtime_boundary_decision",
    operation_class: operationClass,
    decision,
    reason,
    requires_external_approval_path: decision === "requires_external_approval",
    authority_surface: false,
    advisory_only: true,
    metadata_only: true,
    action_executed: false,
    approval_granted: false,
    memory_mutated: false,
    project_mutated: false,
    environment_mutated: false,
    policy_changed: false,
    device_registered: false,
    background_job_started: false,
    routine_triggered: false,
    cloud_exported: false,
    capture_started: false,
    provider_executed: false,
  });
}

export function assertVisionRuntimeBoundary(
  input: EvaluateVisionRuntimeBoundaryInput,
): VisionRuntimeBoundaryDecisionRecord {
  return evaluateVisionRuntimeBoundary(input);
}

export function createVisionRuntimeBoundaryTelemetryEvent(
  decisionInput: VisionRuntimeBoundaryDecisionRecord,
): VisionRuntimeBoundaryTelemetryEvent {
  const decision =
    VisionRuntimeBoundaryDecisionRecordSchema.parse(decisionInput);
  return VisionRuntimeBoundaryTelemetryEventSchema.parse({
    event_type: "vision_boundary_evaluated",
    operation_class: decision.operation_class,
    decision: decision.decision,
    reason: decision.reason,
    metadata_only: true,
    class_reason_decision_only: true,
    authority_surface: false,
    action_executed: false,
    approval_granted: false,
    mutation_performed: false,
    cloud_exported: false,
    background_job_started: false,
  });
}

export function createVisionRuntimeBoundaryReplayStep(
  decisionInput: VisionRuntimeBoundaryDecisionRecord,
): VisionRuntimeBoundaryReplayStep {
  const decision =
    VisionRuntimeBoundaryDecisionRecordSchema.parse(decisionInput);
  return VisionRuntimeBoundaryReplayStepSchema.parse({
    operation_class: decision.operation_class,
    decision: decision.decision,
    reason: decision.reason,
    requires_external_approval_path: decision.requires_external_approval_path,
    metadata_only: true,
    raw_payload_included: false,
    authority_surface: false,
    advisory_only: true,
    action_executed: false,
    approval_granted: false,
    mutation_performed: false,
    cloud_exported: false,
    background_job_started: false,
  });
}
