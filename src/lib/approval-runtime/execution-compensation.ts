import { z } from "zod";

import { ApprovalExecutionVerificationMetadataSchema } from "./execution-verification";
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

export const APPROVAL_EXECUTION_COMPENSATION_CONTRACT_VERSION =
  "18G.1" as const;

export const APPROVAL_EXECUTION_COMPENSATION_STATUSES = [
  "unavailable",
  "hint_only",
  "blocked",
  "invalid",
  "expired",
  "not_performed",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES = [
  "compensated",
  "rolled_back",
  "restored",
  "succeeded",
  "failed",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_STRATEGIES = [
  "inverse_operation_hint_metadata",
  "manual_repair_hint_metadata",
  "restore_snapshot_hint_metadata",
  "no_compensation_available_metadata",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_HINT_KINDS = [
  "inverse_operation_hint_metadata",
  "manual_repair_hint_metadata",
  "restore_snapshot_hint_metadata",
  "no_compensation_available_metadata",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_EVIDENCE_KINDS = [
  "verification_reference_metadata",
  "audit_trace_reference_metadata",
  "manual_repair_reference_metadata",
  "snapshot_reference_metadata",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASONS = [
  "valid_compensation_metadata",
  "invalid_compensation_metadata",
  "forbidden_compensation_status",
] as const;

export type ApprovalExecutionCompensationStatus =
  (typeof APPROVAL_EXECUTION_COMPENSATION_STATUSES)[number];
export type ApprovalExecutionCompensationForbiddenStatus =
  (typeof APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES)[number];
export type ApprovalExecutionCompensationStrategy =
  (typeof APPROVAL_EXECUTION_COMPENSATION_STRATEGIES)[number];
export type ApprovalExecutionCompensationHintKind =
  (typeof APPROVAL_EXECUTION_COMPENSATION_HINT_KINDS)[number];
export type ApprovalExecutionCompensationEvidenceKind =
  (typeof APPROVAL_EXECUTION_COMPENSATION_EVIDENCE_KINDS)[number];
export type ApprovalExecutionCompensationValidationReason =
  (typeof APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASONS)[number];

export const ApprovalExecutionCompensationStatusSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_STATUSES,
);
export const ApprovalExecutionCompensationForbiddenStatusSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES,
);
export const ApprovalExecutionCompensationStrategySchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_STRATEGIES,
);
export const ApprovalExecutionCompensationHintKindSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_HINT_KINDS,
);
export const ApprovalExecutionCompensationEvidenceKindSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_EVIDENCE_KINDS,
);
export const ApprovalExecutionCompensationValidationReasonSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASONS,
);

export const ApprovalExecutionCompensationDisabledAuthorityFlagsSchema =
  z.strictObject({
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    restore_enabled: z.literal(false),
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
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    token_issue_enabled: z.literal(false),
    real_state_read_enabled: z.literal(false),
    event_store_write_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    runtime_wiring_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  });

export const ApprovalExecutionCompensationStrategyMetadataSchema =
  z.strictObject({
    strategy: ApprovalExecutionCompensationStrategySchema,
    strategy_is_metadata_only: z.literal(true),
    real_compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    restore_enabled: z.literal(false),
    inverse_operation_execution_enabled: z.literal(false),
    execution_required: z.literal(false),
    dispatch_required: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationEligibilityMetadataSchema =
  z.strictObject({
    eligibility_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    eligibility_is_metadata_only: z.literal(true),
    future_compensation_hint_available: z.literal(true),
    real_eligibility_evaluated: z.literal(false),
    real_state_read_enabled: z.literal(false),
    restore_point_validated: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationHintMetadataSchema = z.strictObject({
  hint_id: z
    .string()
    .trim()
    .regex(/^compensation-hint:[a-z0-9._:-]+$/),
  hint_kind: ApprovalExecutionCompensationHintKindSchema,
  redacted_reference: z
    .string()
    .trim()
    .regex(/^redacted:[a-z0-9._:-]+$/),
  hash_reference: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  eligibility_metadata: ApprovalExecutionCompensationEligibilityMetadataSchema,
  risk_class: ApprovalRiskClassSchema,
  replay_safe: z.literal(true),
  redaction_status: ApprovalRedactionMetadataSchema,
});

export const ApprovalExecutionCompensationEvidenceMetadataSchema =
  z.strictObject({
    evidence_id: z
      .string()
      .trim()
      .regex(/^compensation-evidence:[a-z0-9._:-]+$/),
    evidence_kind: ApprovalExecutionCompensationEvidenceKindSchema,
    redacted_reference: z
      .string()
      .trim()
      .regex(/^redacted:[a-z0-9._:-]+$/),
    hash_reference: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    replay_safe: z.literal(true),
    redaction_status: ApprovalRedactionMetadataSchema,
    real_evidence_collected: z.literal(false),
    raw_payload_included: z.literal(false),
    raw_state_included: z.literal(false),
    secret_material_included: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationTargetMetadataSchema = z.strictObject(
  {
    verification_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    execution_plan_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    proposal_kind: ApprovalProposalRegistryKindSchema,
    target_class: ApprovalProposalTargetKindSchema,
    target_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    risk_class: ApprovalRiskClassSchema,
    real_state_read_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    room_action_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    network_call_enabled: z.literal(false),
    metadata_only: z.literal(true),
  },
);

export const ApprovalExecutionCompensationMetadataSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_COMPENSATION_CONTRACT_VERSION),
  compensation_id: z
    .string()
    .trim()
    .regex(/^compensation:[a-z0-9._:-]+$/),
  verification_id: z
    .string()
    .trim()
    .regex(/^verification:[a-z0-9._:-]+$/),
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
  status: ApprovalExecutionCompensationStatusSchema,
  status_is_operational: z.literal(false),
  status_performs_real_compensation: z.literal(false),
  strategy_metadata: ApprovalExecutionCompensationStrategyMetadataSchema,
  eligibility_metadata: ApprovalExecutionCompensationEligibilityMetadataSchema,
  hint_metadata: z.array(ApprovalExecutionCompensationHintMetadataSchema),
  evidence_metadata: z.array(
    ApprovalExecutionCompensationEvidenceMetadataSchema,
  ),
  target_metadata: ApprovalExecutionCompensationTargetMetadataSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_authority_flags:
    ApprovalExecutionCompensationDisabledAuthorityFlagsSchema,
  real_compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
  restore_performed: z.literal(false),
  inverse_operation_executed: z.literal(false),
  execution_performed: z.literal(false),
  dispatch_performed: z.literal(false),
  tool_call_performed: z.literal(false),
  real_state_read_performed: z.literal(false),
  real_evidence_collected: z.literal(false),
  verification_performed: z.literal(false),
  lifecycle_advanced: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_rendered: z.literal(false),
  api_route_called: z.literal(false),
  runtime_wired: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  raw_state_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ApprovalExecutionCompensationContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_COMPENSATION_CONTRACT_VERSION),
  contract_id: z.literal("approval_execution_compensation_contract"),
  phase: z.literal(18),
  slice: z.literal("18G.1"),
  metadata_only: z.literal(true),
  compensation_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  non_dispatching: z.literal(true),
  non_persistent: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  compensation_statuses: z.array(ApprovalExecutionCompensationStatusSchema),
  forbidden_statuses: z.array(
    ApprovalExecutionCompensationForbiddenStatusSchema,
  ),
  compensation_strategies: z.array(ApprovalExecutionCompensationStrategySchema),
  hint_kinds: z.array(ApprovalExecutionCompensationHintKindSchema),
  evidence_kinds: z.array(ApprovalExecutionCompensationEvidenceKindSchema),
  disabled_authority_flags:
    ApprovalExecutionCompensationDisabledAuthorityFlagsSchema,
  operational_compensation_status_supported: z.literal(false),
  real_compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  restore_supported: z.literal(false),
  inverse_operation_execution_supported: z.literal(false),
  real_state_reads_supported: z.literal(false),
  real_evidence_collection_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  tool_calls_supported: z.literal(false),
  verification_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
});

export const ApprovalExecutionCompensationShapeValidationSchema =
  z.strictObject({
    valid: z.boolean(),
    reason: ApprovalExecutionCompensationValidationReasonSchema,
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    real_compensation_performed: z.literal(false),
    rollback_performed: z.literal(false),
    restore_performed: z.literal(false),
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    lifecycle_advanced: z.literal(false),
    authority_granted: z.literal(false),
    token_issued: z.literal(false),
    action_executed: z.literal(false),
    dispatch_performed: z.literal(false),
    verification_performed: z.literal(false),
    persisted: z.literal(false),
    event_store_written: z.literal(false),
    telemetry_written: z.literal(false),
    ui_rendered: z.literal(false),
    api_route_called: z.literal(false),
    network_called: z.literal(false),
    cloud_called: z.literal(false),
    secret_material_included: z.literal(false),
  });

export type ApprovalExecutionCompensationDisabledAuthorityFlags = z.infer<
  typeof ApprovalExecutionCompensationDisabledAuthorityFlagsSchema
>;
export type ApprovalExecutionCompensationStrategyMetadata = z.infer<
  typeof ApprovalExecutionCompensationStrategyMetadataSchema
>;
export type ApprovalExecutionCompensationEligibilityMetadata = z.infer<
  typeof ApprovalExecutionCompensationEligibilityMetadataSchema
>;
export type ApprovalExecutionCompensationHintMetadata = z.infer<
  typeof ApprovalExecutionCompensationHintMetadataSchema
>;
export type ApprovalExecutionCompensationEvidenceMetadata = z.infer<
  typeof ApprovalExecutionCompensationEvidenceMetadataSchema
>;
export type ApprovalExecutionCompensationTargetMetadata = z.infer<
  typeof ApprovalExecutionCompensationTargetMetadataSchema
>;
export type ApprovalExecutionCompensationMetadata = z.infer<
  typeof ApprovalExecutionCompensationMetadataSchema
>;
export type ApprovalExecutionCompensationContract = z.infer<
  typeof ApprovalExecutionCompensationContractSchema
>;
export type ApprovalExecutionCompensationShapeValidation = z.infer<
  typeof ApprovalExecutionCompensationShapeValidationSchema
>;

const DISABLED_COMPENSATION_AUTHORITY_FLAGS =
  ApprovalExecutionCompensationDisabledAuthorityFlagsSchema.parse({
    compensation_enabled: false,
    rollback_enabled: false,
    restore_enabled: false,
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
    persistence_enabled: false,
    telemetry_write_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    authority_grant_enabled: false,
    token_issue_enabled: false,
    real_state_read_enabled: false,
    event_store_write_enabled: false,
    ui_rendering_enabled: false,
    api_route_enabled: false,
    runtime_wiring_enabled: false,
    scheduler_triggered_action_enabled: false,
    network_cloud_calls_enabled: false,
  });

export const DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT =
  ApprovalExecutionCompensationContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_COMPENSATION_CONTRACT_VERSION,
    contract_id: "approval_execution_compensation_contract",
    phase: 18,
    slice: "18G.1",
    metadata_only: true,
    compensation_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    non_dispatching: true,
    non_persistent: true,
    replay_safe: true,
    redaction_safe: true,
    compensation_statuses: APPROVAL_EXECUTION_COMPENSATION_STATUSES,
    forbidden_statuses: APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES,
    compensation_strategies: APPROVAL_EXECUTION_COMPENSATION_STRATEGIES,
    hint_kinds: APPROVAL_EXECUTION_COMPENSATION_HINT_KINDS,
    evidence_kinds: APPROVAL_EXECUTION_COMPENSATION_EVIDENCE_KINDS,
    disabled_authority_flags: DISABLED_COMPENSATION_AUTHORITY_FLAGS,
    operational_compensation_status_supported: false,
    real_compensation_supported: false,
    rollback_supported: false,
    restore_supported: false,
    inverse_operation_execution_supported: false,
    real_state_reads_supported: false,
    real_evidence_collection_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    verification_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    network_cloud_calls_supported: false,
  });

function compensationValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalExecutionCompensationValidationReason;
}): ApprovalExecutionCompensationShapeValidation {
  return ApprovalExecutionCompensationShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
    authority_granted: false,
    token_issued: false,
    action_executed: false,
    dispatch_performed: false,
    verification_performed: false,
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

function statusValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("status" in input)) {
    return null;
  }

  return (input as { readonly status?: unknown }).status;
}

export function buildApprovalExecutionCompensationMetadata(input: {
  readonly compensation_id: `compensation:${string}`;
  readonly verification_metadata: unknown;
  readonly strategy?: ApprovalExecutionCompensationStrategy;
  readonly hint_id?: `compensation-hint:${string}`;
  readonly hint_kind?: ApprovalExecutionCompensationHintKind;
  readonly evidence_id?: `compensation-evidence:${string}`;
  readonly evidence_kind?: ApprovalExecutionCompensationEvidenceKind;
  readonly redacted_reference?: `redacted:${string}`;
  readonly hash_reference?: `hash:${string}`;
  readonly status?: ApprovalExecutionCompensationStatus;
}): ApprovalExecutionCompensationMetadata {
  const verification = ApprovalExecutionVerificationMetadataSchema.parse(
    input.verification_metadata,
  );
  const strategy = ApprovalExecutionCompensationStrategySchema.parse(
    input.strategy ?? "manual_repair_hint_metadata",
  );
  const hintKind = ApprovalExecutionCompensationHintKindSchema.parse(
    input.hint_kind ?? strategy,
  );
  const evidenceKind = ApprovalExecutionCompensationEvidenceKindSchema.parse(
    input.evidence_kind ?? "verification_reference_metadata",
  );
  const status = ApprovalExecutionCompensationStatusSchema.parse(
    input.status ?? "hint_only",
  );
  const eligibilityMetadata =
    ApprovalExecutionCompensationEligibilityMetadataSchema.parse({
      eligibility_ref_hash: hashFromId(
        verification.verification_id,
        "verification",
      ),
      eligibility_is_metadata_only: true,
      future_compensation_hint_available: true,
      real_eligibility_evaluated: false,
      real_state_read_enabled: false,
      restore_point_validated: false,
      metadata_only: true,
    });

  return ApprovalExecutionCompensationMetadataSchema.parse({
    contract_version: APPROVAL_EXECUTION_COMPENSATION_CONTRACT_VERSION,
    compensation_id: input.compensation_id,
    verification_id: verification.verification_id,
    execution_plan_id: verification.execution_plan_id,
    proposal_id: verification.proposal_id,
    review_session_id: verification.review_session_id,
    decision_record_id: verification.decision_record_id,
    proposal_kind: verification.proposal_kind,
    status,
    status_is_operational: false,
    status_performs_real_compensation: false,
    strategy_metadata: {
      strategy,
      strategy_is_metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      inverse_operation_execution_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    },
    eligibility_metadata: eligibilityMetadata,
    hint_metadata: [
      {
        hint_id: input.hint_id ?? "compensation-hint:metadata-only",
        hint_kind: hintKind,
        redacted_reference:
          input.redacted_reference ?? "redacted:compensation-hint",
        hash_reference:
          input.hash_reference ??
          hashFromId(verification.verification_id, "verification"),
        eligibility_metadata: eligibilityMetadata,
        risk_class: verification.target_metadata.risk_class,
        replay_safe: true,
        redaction_status: verification.redaction_status,
      },
    ],
    evidence_metadata: [
      {
        evidence_id: input.evidence_id ?? "compensation-evidence:metadata-only",
        evidence_kind: evidenceKind,
        redacted_reference:
          input.redacted_reference ?? "redacted:compensation-evidence",
        hash_reference:
          input.hash_reference ??
          hashFromId(verification.verification_id, "verification"),
        replay_safe: true,
        redaction_status: verification.redaction_status,
        real_evidence_collected: false,
        raw_payload_included: false,
        raw_state_included: false,
        secret_material_included: false,
        metadata_only: true,
      },
    ],
    target_metadata: {
      verification_ref_hash: hashFromId(
        verification.verification_id,
        "verification",
      ),
      execution_plan_ref_hash: hashFromId(
        verification.execution_plan_id,
        "execution-plan",
      ),
      proposal_kind: verification.proposal_kind,
      target_class: verification.target_metadata.target_class,
      target_ref_hash: verification.target_metadata.target_ref_hash,
      risk_class: verification.target_metadata.risk_class,
      real_state_read_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      room_action_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      metadata_only: true,
    },
    redaction_status: verification.redaction_status,
    replay: verification.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_authority_flags: DISABLED_COMPENSATION_AUTHORITY_FLAGS,
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    inverse_operation_executed: false,
    execution_performed: false,
    dispatch_performed: false,
    tool_call_performed: false,
    real_state_read_performed: false,
    real_evidence_collected: false,
    verification_performed: false,
    lifecycle_advanced: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_rendered: false,
    api_route_called: false,
    runtime_wired: false,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
    raw_state_included: false,
    secret_material_included: false,
  });
}

export function validateApprovalExecutionCompensationMetadataShape(
  input: unknown,
): ApprovalExecutionCompensationShapeValidation {
  if (
    ApprovalExecutionCompensationForbiddenStatusSchema.safeParse(
      statusValue(input),
    ).success
  ) {
    return compensationValidation({
      valid: false,
      reason: "forbidden_compensation_status",
    });
  }

  const parsed = ApprovalExecutionCompensationMetadataSchema.safeParse(input);
  return compensationValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_compensation_metadata"
      : "invalid_compensation_metadata",
  });
}
