import { z } from "zod";

import { ApprovalExecutionPlanMetadataSchema } from "./execution-plan";
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

export const APPROVAL_EXECUTION_VERIFICATION_CONTRACT_VERSION =
  "18F.1" as const;

export const APPROVAL_EXECUTION_VERIFICATION_STATUSES = [
  "unavailable",
  "pending_metadata_only",
  "blocked",
  "invalid",
  "expired",
  "not_performed",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES = [
  "verified",
  "succeeded",
  "failed",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_METHODS = [
  "state_diff_metadata",
  "dry_run_comparison_metadata",
  "audit_trace_metadata",
  "manual_review_metadata",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_EVIDENCE_KINDS = [
  "state_diff_reference_metadata",
  "dry_run_comparison_reference_metadata",
  "audit_trace_reference_metadata",
  "manual_review_reference_metadata",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_CONFIDENCE_BANDS = [
  "low_metadata",
  "medium_metadata",
  "high_metadata",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_VALIDATION_REASONS = [
  "valid_verification_metadata",
  "invalid_verification_metadata",
  "forbidden_verification_status",
] as const;

export type ApprovalExecutionVerificationStatus =
  (typeof APPROVAL_EXECUTION_VERIFICATION_STATUSES)[number];
export type ApprovalExecutionVerificationForbiddenStatus =
  (typeof APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES)[number];
export type ApprovalExecutionVerificationMethod =
  (typeof APPROVAL_EXECUTION_VERIFICATION_METHODS)[number];
export type ApprovalExecutionVerificationEvidenceKind =
  (typeof APPROVAL_EXECUTION_VERIFICATION_EVIDENCE_KINDS)[number];
export type ApprovalExecutionVerificationConfidenceBand =
  (typeof APPROVAL_EXECUTION_VERIFICATION_CONFIDENCE_BANDS)[number];
export type ApprovalExecutionVerificationValidationReason =
  (typeof APPROVAL_EXECUTION_VERIFICATION_VALIDATION_REASONS)[number];

export const ApprovalExecutionVerificationStatusSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_STATUSES,
);
export const ApprovalExecutionVerificationForbiddenStatusSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES,
);
export const ApprovalExecutionVerificationMethodSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_METHODS,
);
export const ApprovalExecutionVerificationEvidenceKindSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_EVIDENCE_KINDS,
);
export const ApprovalExecutionVerificationConfidenceBandSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_CONFIDENCE_BANDS,
);
export const ApprovalExecutionVerificationValidationReasonSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_VALIDATION_REASONS,
);

export const ApprovalExecutionVerificationDisabledAuthorityFlagsSchema =
  z.strictObject({
    verification_enabled: z.literal(false),
    real_state_read_enabled: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    tool_runtime_enabled: z.literal(false),
    room_action_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    network_call_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
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
    runtime_wiring_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  });

export const ApprovalExecutionVerificationMethodMetadataSchema = z.strictObject(
  {
    method: ApprovalExecutionVerificationMethodSchema,
    method_is_metadata_only: z.literal(true),
    real_state_read_enabled: z.literal(false),
    real_evidence_collection_enabled: z.literal(false),
    verification_logic_enabled: z.literal(false),
    execution_required: z.literal(false),
    dispatch_required: z.literal(false),
    metadata_only: z.literal(true),
  },
);

export const ApprovalExecutionVerificationFreshnessMetadataSchema =
  z.strictObject({
    freshness_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    observed_at_metadata_ms: z.number().int().nonnegative(),
    real_state_observed: z.literal(false),
    timers_registered: z.literal(false),
    scheduler_registered: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionVerificationEvidenceMetadataSchema =
  z.strictObject({
    evidence_id: z
      .string()
      .trim()
      .regex(/^verification-evidence:[a-z0-9._:-]+$/),
    evidence_kind: ApprovalExecutionVerificationEvidenceKindSchema,
    redacted_reference: z
      .string()
      .trim()
      .regex(/^redacted:[a-z0-9._:-]+$/),
    hash_reference: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    confidence_band: ApprovalExecutionVerificationConfidenceBandSchema,
    freshness_metadata: ApprovalExecutionVerificationFreshnessMetadataSchema,
    replay_safe: z.literal(true),
    redaction_status: ApprovalRedactionMetadataSchema,
  });

export const ApprovalExecutionVerificationTargetMetadataSchema = z.strictObject(
  {
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

export const ApprovalExecutionVerificationMetadataSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_VERIFICATION_CONTRACT_VERSION),
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
  status: ApprovalExecutionVerificationStatusSchema,
  status_is_operational: z.literal(false),
  status_performs_real_verification: z.literal(false),
  method_metadata: ApprovalExecutionVerificationMethodMetadataSchema,
  evidence_metadata: z.array(
    ApprovalExecutionVerificationEvidenceMetadataSchema,
  ),
  target_metadata: ApprovalExecutionVerificationTargetMetadataSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_authority_flags:
    ApprovalExecutionVerificationDisabledAuthorityFlagsSchema,
  real_verification_performed: z.literal(false),
  real_state_read_performed: z.literal(false),
  real_evidence_collected: z.literal(false),
  execution_performed: z.literal(false),
  dispatch_performed: z.literal(false),
  tool_call_performed: z.literal(false),
  lifecycle_advanced: z.literal(false),
  compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
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
  secret_material_included: z.literal(false),
});

export const ApprovalExecutionVerificationContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_EXECUTION_VERIFICATION_CONTRACT_VERSION),
  contract_id: z.literal("approval_execution_verification_contract"),
  phase: z.literal(18),
  slice: z.literal("18F.1"),
  metadata_only: z.literal(true),
  verification_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  non_dispatching: z.literal(true),
  non_persistent: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  verification_statuses: z.array(ApprovalExecutionVerificationStatusSchema),
  forbidden_statuses: z.array(
    ApprovalExecutionVerificationForbiddenStatusSchema,
  ),
  verification_methods: z.array(ApprovalExecutionVerificationMethodSchema),
  evidence_kinds: z.array(ApprovalExecutionVerificationEvidenceKindSchema),
  disabled_authority_flags:
    ApprovalExecutionVerificationDisabledAuthorityFlagsSchema,
  operational_verification_status_supported: z.literal(false),
  real_verification_supported: z.literal(false),
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
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
});

export const ApprovalExecutionVerificationShapeValidationSchema =
  z.strictObject({
    valid: z.boolean(),
    reason: ApprovalExecutionVerificationValidationReasonSchema,
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    real_verification_performed: z.literal(false),
    real_state_read_performed: z.literal(false),
    real_evidence_collected: z.literal(false),
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    lifecycle_advanced: z.literal(false),
    authority_granted: z.literal(false),
    token_issued: z.literal(false),
    action_executed: z.literal(false),
    dispatch_performed: z.literal(false),
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

export type ApprovalExecutionVerificationDisabledAuthorityFlags = z.infer<
  typeof ApprovalExecutionVerificationDisabledAuthorityFlagsSchema
>;
export type ApprovalExecutionVerificationMethodMetadata = z.infer<
  typeof ApprovalExecutionVerificationMethodMetadataSchema
>;
export type ApprovalExecutionVerificationFreshnessMetadata = z.infer<
  typeof ApprovalExecutionVerificationFreshnessMetadataSchema
>;
export type ApprovalExecutionVerificationEvidenceMetadata = z.infer<
  typeof ApprovalExecutionVerificationEvidenceMetadataSchema
>;
export type ApprovalExecutionVerificationTargetMetadata = z.infer<
  typeof ApprovalExecutionVerificationTargetMetadataSchema
>;
export type ApprovalExecutionVerificationMetadata = z.infer<
  typeof ApprovalExecutionVerificationMetadataSchema
>;
export type ApprovalExecutionVerificationContract = z.infer<
  typeof ApprovalExecutionVerificationContractSchema
>;
export type ApprovalExecutionVerificationShapeValidation = z.infer<
  typeof ApprovalExecutionVerificationShapeValidationSchema
>;

const DISABLED_VERIFICATION_AUTHORITY_FLAGS =
  ApprovalExecutionVerificationDisabledAuthorityFlagsSchema.parse({
    verification_enabled: false,
    real_state_read_enabled: false,
    execution_enabled: false,
    dispatch_enabled: false,
    tool_runtime_enabled: false,
    room_action_enabled: false,
    project_mutation_enabled: false,
    obsidian_write_enabled: false,
    memory_write_enabled: false,
    network_call_enabled: false,
    lifecycle_advancement_enabled: false,
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
    runtime_wiring_enabled: false,
    scheduler_triggered_action_enabled: false,
    network_cloud_calls_enabled: false,
  });

export const DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT =
  ApprovalExecutionVerificationContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_VERIFICATION_CONTRACT_VERSION,
    contract_id: "approval_execution_verification_contract",
    phase: 18,
    slice: "18F.1",
    metadata_only: true,
    verification_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    non_dispatching: true,
    non_persistent: true,
    replay_safe: true,
    redaction_safe: true,
    verification_statuses: APPROVAL_EXECUTION_VERIFICATION_STATUSES,
    forbidden_statuses: APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES,
    verification_methods: APPROVAL_EXECUTION_VERIFICATION_METHODS,
    evidence_kinds: APPROVAL_EXECUTION_VERIFICATION_EVIDENCE_KINDS,
    disabled_authority_flags: DISABLED_VERIFICATION_AUTHORITY_FLAGS,
    operational_verification_status_supported: false,
    real_verification_supported: false,
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
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    network_cloud_calls_supported: false,
  });

function verificationValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalExecutionVerificationValidationReason;
}): ApprovalExecutionVerificationShapeValidation {
  return ApprovalExecutionVerificationShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    real_verification_performed: false,
    real_state_read_performed: false,
    real_evidence_collected: false,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
    authority_granted: false,
    token_issued: false,
    action_executed: false,
    dispatch_performed: false,
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

function statusValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("status" in input)) {
    return null;
  }

  return (input as { readonly status?: unknown }).status;
}

export function buildApprovalExecutionVerificationMetadata(input: {
  readonly verification_id: `verification:${string}`;
  readonly execution_plan: unknown;
  readonly method?: ApprovalExecutionVerificationMethod;
  readonly evidence_id?: `verification-evidence:${string}`;
  readonly evidence_kind?: ApprovalExecutionVerificationEvidenceKind;
  readonly redacted_reference?: `redacted:${string}`;
  readonly hash_reference?: `hash:${string}`;
  readonly confidence_band?: ApprovalExecutionVerificationConfidenceBand;
  readonly observed_at_metadata_ms?: number;
  readonly status?: ApprovalExecutionVerificationStatus;
}): ApprovalExecutionVerificationMetadata {
  const plan = ApprovalExecutionPlanMetadataSchema.parse(input.execution_plan);
  const method = ApprovalExecutionVerificationMethodSchema.parse(
    input.method ?? "dry_run_comparison_metadata",
  );
  const evidenceKind = ApprovalExecutionVerificationEvidenceKindSchema.parse(
    input.evidence_kind ?? "dry_run_comparison_reference_metadata",
  );
  const confidenceBand =
    ApprovalExecutionVerificationConfidenceBandSchema.parse(
      input.confidence_band ?? "medium_metadata",
    );
  const status = ApprovalExecutionVerificationStatusSchema.parse(
    input.status ?? "pending_metadata_only",
  );
  const firstStep = plan.step_metadata[0];

  return ApprovalExecutionVerificationMetadataSchema.parse({
    contract_version: APPROVAL_EXECUTION_VERIFICATION_CONTRACT_VERSION,
    verification_id: input.verification_id,
    execution_plan_id: plan.execution_plan_id,
    proposal_id: plan.proposal_id,
    review_session_id: plan.review_session_id,
    decision_record_id: plan.decision_record_id,
    proposal_kind: plan.proposal_kind,
    status,
    status_is_operational: false,
    status_performs_real_verification: false,
    method_metadata: {
      method,
      method_is_metadata_only: true,
      real_state_read_enabled: false,
      real_evidence_collection_enabled: false,
      verification_logic_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    },
    evidence_metadata: [
      {
        evidence_id: input.evidence_id ?? "verification-evidence:metadata-only",
        evidence_kind: evidenceKind,
        redacted_reference:
          input.redacted_reference ?? "redacted:verification-evidence",
        hash_reference:
          input.hash_reference ??
          hashFromId(plan.execution_plan_id, "execution-plan"),
        confidence_band: confidenceBand,
        freshness_metadata: {
          freshness_ref_hash: hashFromId(
            plan.execution_plan_id,
            "execution-plan",
          ),
          observed_at_metadata_ms: input.observed_at_metadata_ms ?? 0,
          real_state_observed: false,
          timers_registered: false,
          scheduler_registered: false,
          metadata_only: true,
        },
        replay_safe: true,
        redaction_status: plan.redaction_status,
      },
    ],
    target_metadata: {
      execution_plan_ref_hash: hashFromId(
        plan.execution_plan_id,
        "execution-plan",
      ),
      proposal_kind: plan.proposal_kind,
      target_class: plan.target_metadata.target_class,
      target_ref_hash: plan.target_metadata.target_ref_hash,
      risk_class: firstStep.risk_class,
      real_state_read_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      room_action_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      metadata_only: true,
    },
    redaction_status: plan.redaction_status,
    replay: plan.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_authority_flags: DISABLED_VERIFICATION_AUTHORITY_FLAGS,
    real_verification_performed: false,
    real_state_read_performed: false,
    real_evidence_collected: false,
    execution_performed: false,
    dispatch_performed: false,
    tool_call_performed: false,
    lifecycle_advanced: false,
    compensation_performed: false,
    rollback_performed: false,
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
    secret_material_included: false,
  });
}

export function validateApprovalExecutionVerificationMetadataShape(
  input: unknown,
): ApprovalExecutionVerificationShapeValidation {
  if (
    ApprovalExecutionVerificationForbiddenStatusSchema.safeParse(
      statusValue(input),
    ).success
  ) {
    return verificationValidation({
      valid: false,
      reason: "forbidden_verification_status",
    });
  }

  const parsed = ApprovalExecutionVerificationMetadataSchema.safeParse(input);
  return verificationValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_verification_metadata"
      : "invalid_verification_metadata",
  });
}
