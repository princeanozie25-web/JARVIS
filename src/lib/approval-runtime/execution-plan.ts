import { z } from "zod";

import { ApprovalDecisionRecordMetadataSchema } from "./approval-decision-record";
import {
  ApprovalProposalRegistryKindSchema,
  ApprovalProposalTargetKindSchema,
} from "./proposal-registry";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION = "18E.1" as const;

export const APPROVAL_EXECUTION_PLAN_STATUSES = [
  "unavailable",
  "draft",
  "dry_run_required",
  "blocked",
  "invalid",
  "expired",
] as const;

export const APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES = [
  "executable",
  "ready",
  "running",
  "completed",
] as const;

export const APPROVAL_EXECUTION_STEP_KINDS = [
  "note_create_step",
  "project_task_create_step",
  "room_action_execute_step",
] as const;

export const APPROVAL_EXECUTION_PLAN_VALIDATION_REASONS = [
  "valid_execution_plan_metadata",
  "invalid_execution_plan_metadata",
  "forbidden_plan_status",
  "unknown_proposal_kind",
] as const;

export type ApprovalExecutionPlanStatus =
  (typeof APPROVAL_EXECUTION_PLAN_STATUSES)[number];
export type ApprovalExecutionPlanForbiddenStatus =
  (typeof APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES)[number];
export type ApprovalExecutionStepKind =
  (typeof APPROVAL_EXECUTION_STEP_KINDS)[number];
export type ApprovalExecutionPlanValidationReason =
  (typeof APPROVAL_EXECUTION_PLAN_VALIDATION_REASONS)[number];

export const ApprovalExecutionPlanStatusSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_STATUSES,
);
export const ApprovalExecutionPlanForbiddenStatusSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES,
);
export const ApprovalExecutionStepKindSchema = z.enum(
  APPROVAL_EXECUTION_STEP_KINDS,
);
export const ApprovalExecutionPlanValidationReasonSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_VALIDATION_REASONS,
);

export const ApprovalExecutionPlanTargetMetadataSchema = z.strictObject({
  target_class: ApprovalProposalTargetKindSchema,
  target_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  raw_target_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  project_mutation_enabled: z.literal(false),
  obsidian_write_enabled: z.literal(false),
  room_action_enabled: z.literal(false),
  memory_write_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalExecutionPlanPreconditionMetadataSchema = z.strictObject({
  decision_record_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  approval_record_required_metadata: z.literal(true),
  authority_token_required_metadata: z.literal(true),
  dry_run_required: z.literal(true),
  decision_record_shape_only: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
  lifecycle_advanced: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalExecutionPlanDryRunMetadataSchema = z.strictObject({
  dry_run_required: z.literal(true),
  dry_run_completed: z.literal(false),
  dry_run_output_included: z.literal(false),
  dry_run_tool_arguments_included: z.literal(false),
  dry_run_dispatch_enabled: z.literal(false),
  dry_run_execution_enabled: z.literal(false),
  dry_run_persistence_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalExecutionStepMetadataSchema = z.strictObject({
  step_id: z
    .string()
    .trim()
    .regex(/^step:[a-z0-9._:-]+$/),
  step_kind: ApprovalExecutionStepKindSchema,
  target_class: ApprovalProposalTargetKindSchema,
  risk_class: ApprovalRiskClassSchema,
  dry_run_required: z.literal(true),
  execution_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  verification_required_metadata: z.literal(true),
  compensation_hint_metadata_available: z.literal(true),
  tool_runtime_enabled: z.literal(false),
  room_action_enabled: z.literal(false),
  project_mutation_enabled: z.literal(false),
  obsidian_write_enabled: z.literal(false),
  memory_write_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalExecutionPlanDisabledAuthorityFlagsSchema = z.strictObject(
  {
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    tool_runtime_enabled: z.literal(false),
    room_action_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    network_call_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    token_issue_enabled: z.literal(false),
    event_store_write_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  },
);

export const ApprovalExecutionPlanMetadataSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION),
  execution_plan_id: z
    .string()
    .trim()
    .regex(/^execution-plan:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  review_session_id: z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/),
  decision_record_id: z
    .string()
    .trim()
    .regex(/^decision-record:[a-z0-9._:-]+$/),
  proposal_kind: ApprovalProposalRegistryKindSchema,
  status: ApprovalExecutionPlanStatusSchema,
  status_is_operational: z.literal(false),
  status_enables_execution: z.literal(false),
  target_metadata: ApprovalExecutionPlanTargetMetadataSchema,
  precondition_metadata: ApprovalExecutionPlanPreconditionMetadataSchema,
  dry_run_metadata: ApprovalExecutionPlanDryRunMetadataSchema,
  step_metadata: z.array(ApprovalExecutionStepMetadataSchema).min(1),
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_authority_flags: ApprovalExecutionPlanDisabledAuthorityFlagsSchema,
  execution_performed: z.literal(false),
  dispatch_performed: z.literal(false),
  tool_call_performed: z.literal(false),
  lifecycle_advanced: z.literal(false),
  verification_performed: z.literal(false),
  compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_rendered: z.literal(false),
  api_route_called: z.literal(false),
  scheduler_triggered_action_registered: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ApprovalExecutionPlanContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION),
  contract_id: z.literal("approval_execution_plan_contract"),
  phase: z.literal(18),
  slice: z.literal("18E.1"),
  metadata_only: z.literal(true),
  execution_plan_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  non_persistent: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  plan_statuses: z.array(ApprovalExecutionPlanStatusSchema),
  forbidden_statuses: z.array(ApprovalExecutionPlanForbiddenStatusSchema),
  step_kinds: z.array(ApprovalExecutionStepKindSchema),
  disabled_authority_flags: ApprovalExecutionPlanDisabledAuthorityFlagsSchema,
  executable_plan_status_supported: z.literal(false),
  executable_step_handlers_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  tool_calls_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
  scheduler_triggered_action_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
});

export const ApprovalExecutionPlanShapeValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: ApprovalExecutionPlanValidationReasonSchema,
  metadata_only: z.literal(true),
  shape_validation_only: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  lifecycle_advanced: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  verification_performed: z.literal(false),
  compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_rendered: z.literal(false),
  api_route_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  secret_material_included: z.literal(false),
});

export type ApprovalExecutionPlanTargetMetadata = z.infer<
  typeof ApprovalExecutionPlanTargetMetadataSchema
>;
export type ApprovalExecutionPlanPreconditionMetadata = z.infer<
  typeof ApprovalExecutionPlanPreconditionMetadataSchema
>;
export type ApprovalExecutionPlanDryRunMetadata = z.infer<
  typeof ApprovalExecutionPlanDryRunMetadataSchema
>;
export type ApprovalExecutionStepMetadata = z.infer<
  typeof ApprovalExecutionStepMetadataSchema
>;
export type ApprovalExecutionPlanDisabledAuthorityFlags = z.infer<
  typeof ApprovalExecutionPlanDisabledAuthorityFlagsSchema
>;
export type ApprovalExecutionPlanMetadata = z.infer<
  typeof ApprovalExecutionPlanMetadataSchema
>;
export type ApprovalExecutionPlanContract = z.infer<
  typeof ApprovalExecutionPlanContractSchema
>;
export type ApprovalExecutionPlanShapeValidation = z.infer<
  typeof ApprovalExecutionPlanShapeValidationSchema
>;

const DISABLED_EXECUTION_PLAN_AUTHORITY_FLAGS =
  ApprovalExecutionPlanDisabledAuthorityFlagsSchema.parse({
    execution_enabled: false,
    dispatch_enabled: false,
    tool_runtime_enabled: false,
    room_action_enabled: false,
    project_mutation_enabled: false,
    obsidian_write_enabled: false,
    memory_write_enabled: false,
    network_call_enabled: false,
    lifecycle_advancement_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    persistence_enabled: false,
    telemetry_write_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    authority_grant_enabled: false,
    token_issue_enabled: false,
    event_store_write_enabled: false,
    ui_rendering_enabled: false,
    api_route_enabled: false,
    scheduler_triggered_action_enabled: false,
    network_cloud_calls_enabled: false,
  });

export const DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT =
  ApprovalExecutionPlanContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION,
    contract_id: "approval_execution_plan_contract",
    phase: 18,
    slice: "18E.1",
    metadata_only: true,
    execution_plan_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    non_persistent: true,
    replay_safe: true,
    redaction_safe: true,
    plan_statuses: APPROVAL_EXECUTION_PLAN_STATUSES,
    forbidden_statuses: APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES,
    step_kinds: APPROVAL_EXECUTION_STEP_KINDS,
    disabled_authority_flags: DISABLED_EXECUTION_PLAN_AUTHORITY_FLAGS,
    executable_plan_status_supported: false,
    executable_step_handlers_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    scheduler_triggered_action_supported: false,
    network_cloud_calls_supported: false,
  });

function planValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalExecutionPlanValidationReason;
}): ApprovalExecutionPlanShapeValidation {
  return ApprovalExecutionPlanShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
    authority_granted: false,
    token_issued: false,
    action_executed: false,
    dispatch_performed: false,
    verification_performed: false,
    compensation_performed: false,
    rollback_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_rendered: false,
    api_route_called: false,
    network_called: false,
    cloud_called: false,
    secret_material_included: false,
  });
}

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

function stepKindForProposal(
  proposalKind: z.infer<typeof ApprovalProposalRegistryKindSchema>,
): ApprovalExecutionStepKind {
  switch (proposalKind) {
    case "note_create":
      return "note_create_step";
    case "project_task_create":
      return "project_task_create_step";
    case "room_action_execute":
      return "room_action_execute_step";
  }
}

function proposalKindValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("proposal_kind" in input)) {
    return null;
  }

  return (input as { readonly proposal_kind?: unknown }).proposal_kind;
}

function statusValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("status" in input)) {
    return null;
  }

  return (input as { readonly status?: unknown }).status;
}

export function buildApprovalExecutionPlanMetadata(input: {
  readonly execution_plan_id: `execution-plan:${string}`;
  readonly decision_record: unknown;
  readonly target_class: z.infer<typeof ApprovalProposalTargetKindSchema>;
  readonly target_ref_hash: `hash:${string}`;
  readonly risk_class: z.infer<typeof ApprovalRiskClassSchema>;
  readonly step_id?: `step:${string}`;
  readonly status?: ApprovalExecutionPlanStatus;
}): ApprovalExecutionPlanMetadata {
  const decisionRecord = ApprovalDecisionRecordMetadataSchema.parse(
    input.decision_record,
  );
  const targetClass = ApprovalProposalTargetKindSchema.parse(
    input.target_class,
  );
  const riskClass = ApprovalRiskClassSchema.parse(input.risk_class);
  const status = ApprovalExecutionPlanStatusSchema.parse(
    input.status ?? "dry_run_required",
  );

  return ApprovalExecutionPlanMetadataSchema.parse({
    contract_version: APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION,
    execution_plan_id: input.execution_plan_id,
    proposal_id: decisionRecord.proposal_id,
    review_session_id: decisionRecord.review_session_id,
    decision_record_id: decisionRecord.decision_record_id,
    proposal_kind: decisionRecord.proposal_kind,
    status,
    status_is_operational: false,
    status_enables_execution: false,
    target_metadata: {
      target_class: targetClass,
      target_ref_hash: input.target_ref_hash,
      raw_target_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      raw_device_payload_included: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      room_action_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      metadata_only: true,
    },
    precondition_metadata: {
      decision_record_ref_hash: hashFromId(
        decisionRecord.decision_record_id,
        "decision-record",
      ),
      approval_record_required_metadata: true,
      authority_token_required_metadata: true,
      dry_run_required: true,
      decision_record_shape_only: true,
      approval_created: false,
      approval_decision_handled: false,
      authority_granted: false,
      token_issued: false,
      lifecycle_advanced: false,
      metadata_only: true,
    },
    dry_run_metadata: {
      dry_run_required: true,
      dry_run_completed: false,
      dry_run_output_included: false,
      dry_run_tool_arguments_included: false,
      dry_run_dispatch_enabled: false,
      dry_run_execution_enabled: false,
      dry_run_persistence_enabled: false,
      metadata_only: true,
    },
    step_metadata: [
      {
        step_id: input.step_id ?? "step:execution-plan-metadata-only",
        step_kind: stepKindForProposal(decisionRecord.proposal_kind),
        target_class: targetClass,
        risk_class: riskClass,
        dry_run_required: true,
        execution_enabled: false,
        dispatch_enabled: false,
        verification_required_metadata: true,
        compensation_hint_metadata_available: true,
        tool_runtime_enabled: false,
        room_action_enabled: false,
        project_mutation_enabled: false,
        obsidian_write_enabled: false,
        memory_write_enabled: false,
        network_call_enabled: false,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
        metadata_only: true,
      },
    ],
    redaction_status: decisionRecord.redaction_status,
    replay: decisionRecord.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_authority_flags: DISABLED_EXECUTION_PLAN_AUTHORITY_FLAGS,
    execution_performed: false,
    dispatch_performed: false,
    tool_call_performed: false,
    lifecycle_advanced: false,
    verification_performed: false,
    compensation_performed: false,
    rollback_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_rendered: false,
    api_route_called: false,
    scheduler_triggered_action_registered: false,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
    secret_material_included: false,
  });
}

export function validateApprovalExecutionPlanMetadataShape(
  input: unknown,
): ApprovalExecutionPlanShapeValidation {
  if (
    ApprovalExecutionPlanForbiddenStatusSchema.safeParse(statusValue(input))
      .success
  ) {
    return planValidation({
      valid: false,
      reason: "forbidden_plan_status",
    });
  }

  if (
    input &&
    typeof input === "object" &&
    "proposal_kind" in input &&
    !ApprovalProposalRegistryKindSchema.safeParse(proposalKindValue(input))
      .success
  ) {
    return planValidation({
      valid: false,
      reason: "unknown_proposal_kind",
    });
  }

  const parsed = ApprovalExecutionPlanMetadataSchema.safeParse(input);
  return planValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_execution_plan_metadata"
      : "invalid_execution_plan_metadata",
  });
}
