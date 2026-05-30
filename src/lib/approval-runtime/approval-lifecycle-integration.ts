import { z } from "zod";

import {
  ApprovalExecutionAuthorityTokenMetadataSchema,
  type ApprovalExecutionAuthorityTokenMetadata,
} from "./execution-authority-token";
import { ApprovalExecutionCompensationAuditPreviewContractSchema } from "./execution-compensation-audit-preview";
import { ApprovalExecutionCompensationMetadataSchema } from "./execution-compensation";
import { ApprovalExecutionPlanMetadataSchema } from "./execution-plan";
import { ApprovalExecutionVerificationMetadataSchema } from "./execution-verification";
import { ApprovalDecisionRecordMetadataSchema } from "./approval-decision-record";
import {
  ApprovalProposalKindDeclarationSchema,
  ApprovalProposalRegistryKindSchema,
} from "./proposal-registry";
import { ApprovalReviewSessionSnapshotSchema } from "./review-session";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ProposalIdSchema,
} from "./types";
import { APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION } from "./phase-18a-closeout";
import { APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION } from "./phase-18b-closeout";
import { APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION } from "./phase-18c-closeout";
import { APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION } from "./phase-18d-closeout";
import { APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION } from "./phase-18e-closeout";
import { APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION } from "./phase-18f-closeout";
import { APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION } from "./phase-18g-closeout";

export const APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION = "18H.1" as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS = [
  "proposal",
  "review",
  "decision_record",
  "authority_token",
  "execution_plan",
  "verification",
  "compensation",
  "audit_preview",
] as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_STATUSES = [
  "unavailable",
  "metadata_assembled",
  "blocked",
  "invalid",
  "expired",
  "incomplete",
] as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES = [
  "active",
  "running",
  "executed",
  "verified",
  "compensated",
  "completed",
] as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASONS = [
  "valid_integrated_lifecycle_metadata",
  "invalid_integrated_lifecycle_metadata",
  "forbidden_integrated_lifecycle_status",
] as const;

export type ApprovalLifecycleIntegrationSegment =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS)[number];
export type ApprovalLifecycleIntegrationStatus =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_STATUSES)[number];
export type ApprovalLifecycleIntegrationForbiddenStatus =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES)[number];
export type ApprovalLifecycleIntegrationValidationReason =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASONS)[number];

export const ApprovalLifecycleIntegrationSegmentSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
);
export const ApprovalLifecycleIntegrationStatusSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_STATUSES,
);
export const ApprovalLifecycleIntegrationForbiddenStatusSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES,
);
export const ApprovalLifecycleIntegrationValidationReasonSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASONS,
);

export const ApprovalLifecycleIntegrationDisabledAuthorityFlagsSchema =
  z.strictObject({
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    token_issue_enabled: z.literal(false),
    usable_token_enabled: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    tool_runtime_enabled: z.literal(false),
    room_action_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    network_call_enabled: z.literal(false),
    real_state_read_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    restore_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
  });

export const ApprovalLifecycleIntegrationSegmentMetadataSchema = z.strictObject(
  {
    segment: ApprovalLifecycleIntegrationSegmentSchema,
    segment_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    source_contract_version: z.string().trim().min(1).max(24),
    present: z.literal(true),
    metadata_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    operational_behavior_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
    secret_material_included: z.literal(false),
  },
);

export const ApprovalLifecycleIntegrationSnapshotSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION),
  integrated_lifecycle_id: z
    .string()
    .trim()
    .regex(/^integrated-lifecycle:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  review_session_id: z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/),
  decision_record_id: z
    .string()
    .trim()
    .regex(/^decision-record:[a-z0-9._:-]+$/),
  authority_token_id: z
    .string()
    .trim()
    .regex(/^authority-token:[a-z0-9._:-]+$/),
  execution_plan_id: z
    .string()
    .trim()
    .regex(/^execution-plan:[a-z0-9._:-]+$/),
  verification_id: z
    .string()
    .trim()
    .regex(/^verification:[a-z0-9._:-]+$/),
  compensation_id: z
    .string()
    .trim()
    .regex(/^compensation:[a-z0-9._:-]+$/),
  proposal_kind: ApprovalProposalRegistryKindSchema,
  segment_metadata: z.array(ApprovalLifecycleIntegrationSegmentMetadataSchema),
  status: ApprovalLifecycleIntegrationStatusSchema,
  status_is_operational: z.literal(false),
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_authority_flags:
    ApprovalLifecycleIntegrationDisabledAuthorityFlagsSchema,
  phase_18a_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
  ),
  phase_18b_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
  ),
  phase_18c_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
  ),
  phase_18d_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
  ),
  phase_18e_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
  ),
  phase_18f_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
  ),
  phase_18g_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
  ),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
  usable_token_issued: z.literal(false),
  lifecycle_state_advanced: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  real_verification_performed: z.literal(false),
  real_state_read_performed: z.literal(false),
  real_compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
  restore_performed: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_wired: z.literal(false),
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

export const ApprovalLifecycleIntegrationContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION),
  contract_id: z.literal("approval_lifecycle_integration_contract"),
  phase: z.literal(18),
  slice: z.literal("18H.1"),
  metadata_only: z.literal(true),
  integrated_lifecycle_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  non_dispatching: z.literal(true),
  non_persistent: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  lifecycle_segments: z.array(ApprovalLifecycleIntegrationSegmentSchema),
  lifecycle_statuses: z.array(ApprovalLifecycleIntegrationStatusSchema),
  forbidden_statuses: z.array(
    ApprovalLifecycleIntegrationForbiddenStatusSchema,
  ),
  disabled_authority_flags:
    ApprovalLifecycleIntegrationDisabledAuthorityFlagsSchema,
  phase_18a_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
  ),
  phase_18b_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
  ),
  phase_18c_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
  ),
  phase_18d_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
  ),
  phase_18e_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
  ),
  phase_18f_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
  ),
  phase_18g_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
  ),
  operational_lifecycle_status_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  usable_token_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  verification_supported: z.literal(false),
  real_state_reads_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  restore_supported: z.literal(false),
  persistence_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
});

export const ApprovalLifecycleIntegrationShapeValidationSchema = z.strictObject(
  {
    valid: z.boolean(),
    reason: ApprovalLifecycleIntegrationValidationReasonSchema,
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    authority_granted: z.literal(false),
    token_issued: z.literal(false),
    usable_token_issued: z.literal(false),
    lifecycle_state_advanced: z.literal(false),
    action_executed: z.literal(false),
    dispatch_performed: z.literal(false),
    real_verification_performed: z.literal(false),
    real_state_read_performed: z.literal(false),
    real_compensation_performed: z.literal(false),
    rollback_performed: z.literal(false),
    restore_performed: z.literal(false),
    persisted: z.literal(false),
    event_store_written: z.literal(false),
    telemetry_written: z.literal(false),
    secret_material_included: z.literal(false),
  },
);

export type ApprovalLifecycleIntegrationDisabledAuthorityFlags = z.infer<
  typeof ApprovalLifecycleIntegrationDisabledAuthorityFlagsSchema
>;
export type ApprovalLifecycleIntegrationSegmentMetadata = z.infer<
  typeof ApprovalLifecycleIntegrationSegmentMetadataSchema
>;
export type ApprovalLifecycleIntegrationSnapshot = z.infer<
  typeof ApprovalLifecycleIntegrationSnapshotSchema
>;
export type ApprovalLifecycleIntegrationContract = z.infer<
  typeof ApprovalLifecycleIntegrationContractSchema
>;
export type ApprovalLifecycleIntegrationShapeValidation = z.infer<
  typeof ApprovalLifecycleIntegrationShapeValidationSchema
>;

const DISABLED_INTEGRATED_LIFECYCLE_FLAGS =
  ApprovalLifecycleIntegrationDisabledAuthorityFlagsSchema.parse({
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    authority_grant_enabled: false,
    token_issue_enabled: false,
    usable_token_enabled: false,
    execution_enabled: false,
    dispatch_enabled: false,
    tool_runtime_enabled: false,
    room_action_enabled: false,
    project_mutation_enabled: false,
    obsidian_write_enabled: false,
    memory_write_enabled: false,
    network_call_enabled: false,
    real_state_read_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    restore_enabled: false,
    persistence_enabled: false,
    telemetry_write_enabled: false,
  });

export const DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT =
  ApprovalLifecycleIntegrationContractSchema.parse({
    contract_version: APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION,
    contract_id: "approval_lifecycle_integration_contract",
    phase: 18,
    slice: "18H.1",
    metadata_only: true,
    integrated_lifecycle_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    non_dispatching: true,
    non_persistent: true,
    replay_safe: true,
    redaction_safe: true,
    lifecycle_segments: APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
    lifecycle_statuses: APPROVAL_LIFECYCLE_INTEGRATION_STATUSES,
    forbidden_statuses: APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES,
    disabled_authority_flags: DISABLED_INTEGRATED_LIFECYCLE_FLAGS,
    phase_18a_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    phase_18b_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
    phase_18c_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
    phase_18d_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
    phase_18e_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
    phase_18f_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
    phase_18g_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
    operational_lifecycle_status_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    usable_token_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    verification_supported: false,
    real_state_reads_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    restore_supported: false,
    persistence_supported: false,
    telemetry_writes_supported: false,
    runtime_wiring_supported: false,
  });

function shapeValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalLifecycleIntegrationValidationReason;
}): ApprovalLifecycleIntegrationShapeValidation {
  return ApprovalLifecycleIntegrationShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    approval_created: false,
    approval_decision_handled: false,
    authority_granted: false,
    token_issued: false,
    usable_token_issued: false,
    lifecycle_state_advanced: false,
    action_executed: false,
    dispatch_performed: false,
    real_verification_performed: false,
    real_state_read_performed: false,
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    secret_material_included: false,
  });
}

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

function segmentMetadata(input: {
  readonly segment: ApprovalLifecycleIntegrationSegment;
  readonly segment_ref_hash: `hash:${string}`;
  readonly source_contract_version: string;
}): ApprovalLifecycleIntegrationSegmentMetadata {
  return ApprovalLifecycleIntegrationSegmentMetadataSchema.parse({
    segment: input.segment,
    segment_ref_hash: input.segment_ref_hash,
    source_contract_version: input.source_contract_version,
    present: true,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    operational_behavior_enabled: false,
    lifecycle_advancement_enabled: false,
    raw_payload_included: false,
    secret_material_included: false,
  });
}

function statusValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("status" in input)) {
    return null;
  }

  return (input as { readonly status?: unknown }).status;
}

export function buildApprovalLifecycleIntegrationSnapshot(input: {
  readonly integrated_lifecycle_id: `integrated-lifecycle:${string}`;
  readonly proposal: unknown;
  readonly review_session: unknown;
  readonly decision_record: unknown;
  readonly authority_token: unknown;
  readonly execution_plan: unknown;
  readonly verification_metadata: unknown;
  readonly compensation_metadata: unknown;
  readonly audit_preview_metadata: unknown;
  readonly status?: ApprovalLifecycleIntegrationStatus;
}): ApprovalLifecycleIntegrationSnapshot {
  const proposal = ApprovalProposalKindDeclarationSchema.parse(input.proposal);
  const reviewSession = ApprovalReviewSessionSnapshotSchema.parse(
    input.review_session,
  );
  const decisionRecord = ApprovalDecisionRecordMetadataSchema.parse(
    input.decision_record,
  );
  const token = ApprovalExecutionAuthorityTokenMetadataSchema.parse(
    input.authority_token,
  ) as ApprovalExecutionAuthorityTokenMetadata;
  const plan = ApprovalExecutionPlanMetadataSchema.parse(input.execution_plan);
  const verification = ApprovalExecutionVerificationMetadataSchema.parse(
    input.verification_metadata,
  );
  const compensation = ApprovalExecutionCompensationMetadataSchema.parse(
    input.compensation_metadata,
  );
  const auditPreview =
    ApprovalExecutionCompensationAuditPreviewContractSchema.parse(
      input.audit_preview_metadata,
    );
  const status = ApprovalLifecycleIntegrationStatusSchema.parse(
    input.status ?? "metadata_assembled",
  );

  return ApprovalLifecycleIntegrationSnapshotSchema.parse({
    contract_version: APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION,
    integrated_lifecycle_id: input.integrated_lifecycle_id,
    proposal_id: reviewSession.proposal_id,
    review_session_id: reviewSession.review_session_id,
    decision_record_id: decisionRecord.decision_record_id,
    authority_token_id: token.token_id,
    execution_plan_id: plan.execution_plan_id,
    verification_id: verification.verification_id,
    compensation_id: compensation.compensation_id,
    proposal_kind: proposal.proposal_kind,
    segment_metadata: [
      segmentMetadata({
        segment: "proposal",
        segment_ref_hash: hashFromId(reviewSession.proposal_id, "proposal"),
        source_contract_version: proposal.metadata_only ? "18A.3" : "invalid",
      }),
      segmentMetadata({
        segment: "review",
        segment_ref_hash: hashFromId(
          reviewSession.review_session_id,
          "review-session",
        ),
        source_contract_version: reviewSession.contract_version,
      }),
      segmentMetadata({
        segment: "decision_record",
        segment_ref_hash: hashFromId(
          decisionRecord.decision_record_id,
          "decision-record",
        ),
        source_contract_version: decisionRecord.contract_version,
      }),
      segmentMetadata({
        segment: "authority_token",
        segment_ref_hash: hashFromId(token.token_id, "authority-token"),
        source_contract_version: token.contract_version,
      }),
      segmentMetadata({
        segment: "execution_plan",
        segment_ref_hash: hashFromId(plan.execution_plan_id, "execution-plan"),
        source_contract_version: plan.contract_version,
      }),
      segmentMetadata({
        segment: "verification",
        segment_ref_hash: hashFromId(
          verification.verification_id,
          "verification",
        ),
        source_contract_version: verification.contract_version,
      }),
      segmentMetadata({
        segment: "compensation",
        segment_ref_hash: hashFromId(
          compensation.compensation_id,
          "compensation",
        ),
        source_contract_version: compensation.contract_version,
      }),
      segmentMetadata({
        segment: "audit_preview",
        segment_ref_hash: auditPreview.preview_id_hash as `hash:${string}`,
        source_contract_version: auditPreview.contract_version,
      }),
    ],
    status,
    status_is_operational: false,
    redaction_status: compensation.redaction_status,
    replay: compensation.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_authority_flags: DISABLED_INTEGRATED_LIFECYCLE_FLAGS,
    phase_18a_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    phase_18b_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
    phase_18c_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
    phase_18d_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
    phase_18e_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
    phase_18f_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
    phase_18g_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
    approval_created: false,
    approval_decision_handled: false,
    authority_granted: false,
    token_issued: false,
    usable_token_issued: false,
    lifecycle_state_advanced: false,
    action_executed: false,
    dispatch_performed: false,
    real_verification_performed: false,
    real_state_read_performed: false,
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_wired: false,
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

export function validateApprovalLifecycleIntegrationSnapshotShape(
  input: unknown,
): ApprovalLifecycleIntegrationShapeValidation {
  if (
    ApprovalLifecycleIntegrationForbiddenStatusSchema.safeParse(
      statusValue(input),
    ).success
  ) {
    return shapeValidation({
      valid: false,
      reason: "forbidden_integrated_lifecycle_status",
    });
  }

  const parsed = ApprovalLifecycleIntegrationSnapshotSchema.safeParse(input);
  return shapeValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_integrated_lifecycle_metadata"
      : "invalid_integrated_lifecycle_metadata",
  });
}
