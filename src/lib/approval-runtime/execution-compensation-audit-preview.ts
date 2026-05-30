import { z } from "zod";

import {
  ApprovalExecutionCompensationEvidenceKindSchema,
  ApprovalExecutionCompensationHintKindSchema,
  ApprovalExecutionCompensationMetadataSchema,
  ApprovalExecutionCompensationStatusSchema,
  ApprovalExecutionCompensationStrategySchema,
} from "./execution-compensation";
import {
  ApprovalExecutionCompensationValidationGuardResultSchema,
  ApprovalExecutionCompensationValidationGuardSeveritySchema,
  validateApprovalExecutionCompensationPolicyMetadata,
  type ApprovalExecutionCompensationValidationGuardResult,
} from "./execution-compensation-validation";
import {
  ApprovalProposalRegistryKindSchema,
  ApprovalProposalTargetKindSchema,
} from "./proposal-registry";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalRedactionStatusSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_CONTRACT_VERSION =
  "18G.3" as const;

export const APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS = [
  "compensation_summary",
  "verification_reference",
  "execution_plan_reference",
  "strategy_summary",
  "eligibility_summary",
  "hint_summary",
  "evidence_summary",
  "validation_results",
  "disabled_compensation_status",
  "redaction_status",
  "replay_status",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_REDACTION_STATUSES =
  ["metadata_only", "redacted"] as const;

export type ApprovalExecutionCompensationAuditPreviewSection =
  (typeof APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS)[number];
export type ApprovalExecutionCompensationAuditPreviewRedactionStatus =
  (typeof APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_REDACTION_STATUSES)[number];

export const ApprovalExecutionCompensationAuditPreviewSectionSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS,
);
export const ApprovalExecutionCompensationAuditPreviewRedactionStatusSchema =
  z.enum(APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_REDACTION_STATUSES);

export const ApprovalExecutionCompensationAuditPreviewDisabledStatusSchema =
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
    real_state_read_enabled: z.literal(false),
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

export const ApprovalExecutionCompensationAuditPreviewSectionDeclarationSchema =
  z.strictObject({
    section: ApprovalExecutionCompensationAuditPreviewSectionSchema,
    included: z.literal(true),
    metadata_only: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewSummarySchema =
  z.strictObject({
    compensation_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    proposal_kind: ApprovalProposalRegistryKindSchema,
    status: ApprovalExecutionCompensationStatusSchema,
    status_is_operational: z.literal(false),
    status_performs_real_compensation: z.literal(false),
    hint_count: z.number().int().nonnegative(),
    evidence_count: z.number().int().nonnegative(),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    restore_enabled: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationAuditPreviewVerificationReferenceSchema =
  z.strictObject({
    verification_id: z
      .string()
      .trim()
      .regex(/^verification:[a-z0-9._:-]+$/),
    verification_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    real_state_read_enabled: z.literal(false),
    verification_logic_enabled: z.literal(false),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewPlanReferenceSchema =
  z.strictObject({
    execution_plan_id: z
      .string()
      .trim()
      .regex(/^execution-plan:[a-z0-9._:-]+$/),
    execution_plan_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    decision_record_id: z
      .string()
      .trim()
      .regex(/^decision-record:[a-z0-9._:-]+$/),
    review_session_id: z
      .string()
      .trim()
      .regex(/^review-session:[a-z0-9._:-]+$/),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewStrategySummarySchema =
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

export const ApprovalExecutionCompensationAuditPreviewEligibilitySummarySchema =
  z.strictObject({
    eligibility_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    future_compensation_hint_available: z.literal(true),
    real_eligibility_evaluated: z.literal(false),
    real_state_read_enabled: z.literal(false),
    restore_point_validated: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationAuditPreviewHintSummaryItemSchema =
  z.strictObject({
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
    eligibility_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    risk_class: ApprovalRiskClassSchema,
    replay_safe: z.literal(true),
    redaction_status: ApprovalRedactionStatusSchema,
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_tool_output_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_state_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewHintSummarySchema =
  z.strictObject({
    hint_count: z.number().int().nonnegative(),
    hints: z.array(
      ApprovalExecutionCompensationAuditPreviewHintSummaryItemSchema,
    ),
    metadata_only: z.literal(true),
    real_compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    restore_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewEvidenceSummaryItemSchema =
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
    redaction_status: ApprovalRedactionStatusSchema,
    metadata_only: z.literal(true),
    real_evidence_collected: z.literal(false),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_tool_output_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_state_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewEvidenceSummarySchema =
  z.strictObject({
    evidence_count: z.number().int().nonnegative(),
    evidence: z.array(
      ApprovalExecutionCompensationAuditPreviewEvidenceSummaryItemSchema,
    ),
    metadata_only: z.literal(true),
    real_evidence_collection_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewValidationSummarySchema =
  z.strictObject({
    result_count: z.number().int().nonnegative(),
    passed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    max_severity: ApprovalExecutionCompensationValidationGuardSeveritySchema,
    results: z.array(ApprovalExecutionCompensationValidationGuardResultSchema),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionCompensationAuditPreviewRedactionMetadataSchema =
  z.strictObject({
    redaction_status: ApprovalRedactionStatusSchema,
    redaction_safe: z.literal(true),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_tool_output_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_state_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
    pii_included: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationAuditPreviewReplayMetadataSchema =
  z.strictObject({
    replay_safe: z.literal(true),
    deterministic_replay_key_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    source_event_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionCompensationAuditPreviewContractSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_CONTRACT_VERSION,
    ),
    preview_id_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    phase: z.literal(18),
    slice: z.literal("18G.3"),
    preview_kind: z.literal("approval_execution_compensation_audit_preview"),
    metadata_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    sections: z.array(
      ApprovalExecutionCompensationAuditPreviewSectionDeclarationSchema,
    ),
    compensation_summary:
      ApprovalExecutionCompensationAuditPreviewSummarySchema,
    verification_reference:
      ApprovalExecutionCompensationAuditPreviewVerificationReferenceSchema,
    execution_plan_reference:
      ApprovalExecutionCompensationAuditPreviewPlanReferenceSchema,
    strategy_summary:
      ApprovalExecutionCompensationAuditPreviewStrategySummarySchema,
    eligibility_summary:
      ApprovalExecutionCompensationAuditPreviewEligibilitySummarySchema,
    hint_summary: ApprovalExecutionCompensationAuditPreviewHintSummarySchema,
    evidence_summary:
      ApprovalExecutionCompensationAuditPreviewEvidenceSummarySchema,
    validation_results:
      ApprovalExecutionCompensationAuditPreviewValidationSummarySchema,
    disabled_compensation_status:
      ApprovalExecutionCompensationAuditPreviewDisabledStatusSchema,
    redaction_status:
      ApprovalExecutionCompensationAuditPreviewRedactionMetadataSchema,
    replay_status:
      ApprovalExecutionCompensationAuditPreviewReplayMetadataSchema,
    replay: ApprovalReplayMetadataSchema,
    redaction: ApprovalRedactionMetadataSchema,
    proposal_id: ProposalIdSchema,
    proposal_kind: ApprovalProposalRegistryKindSchema,
    target_class: ApprovalProposalTargetKindSchema,
    risk_class: ApprovalRiskClassSchema,
  });

export type ApprovalExecutionCompensationAuditPreviewDisabledStatus = z.infer<
  typeof ApprovalExecutionCompensationAuditPreviewDisabledStatusSchema
>;
export type ApprovalExecutionCompensationAuditPreviewSectionDeclaration =
  z.infer<
    typeof ApprovalExecutionCompensationAuditPreviewSectionDeclarationSchema
  >;
export type ApprovalExecutionCompensationAuditPreviewSummary = z.infer<
  typeof ApprovalExecutionCompensationAuditPreviewSummarySchema
>;
export type ApprovalExecutionCompensationAuditPreviewHintSummary = z.infer<
  typeof ApprovalExecutionCompensationAuditPreviewHintSummarySchema
>;
export type ApprovalExecutionCompensationAuditPreviewEvidenceSummary = z.infer<
  typeof ApprovalExecutionCompensationAuditPreviewEvidenceSummarySchema
>;
export type ApprovalExecutionCompensationAuditPreviewValidationSummary =
  z.infer<
    typeof ApprovalExecutionCompensationAuditPreviewValidationSummarySchema
  >;
export type ApprovalExecutionCompensationAuditPreviewContract = z.infer<
  typeof ApprovalExecutionCompensationAuditPreviewContractSchema
>;

function sectionDeclaration(
  section: ApprovalExecutionCompensationAuditPreviewSection,
): ApprovalExecutionCompensationAuditPreviewSectionDeclaration {
  return ApprovalExecutionCompensationAuditPreviewSectionDeclarationSchema.parse(
    {
      section,
      included: true,
      metadata_only: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
      raw_payload_included: false,
    },
  );
}

function maxSeverity(
  results: readonly ApprovalExecutionCompensationValidationGuardResult[],
): "info" | "warning" | "error" {
  if (results.some((result) => result.severity === "error")) {
    return "error";
  }
  if (results.some((result) => result.severity === "warning")) {
    return "warning";
  }
  return "info";
}

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

export function buildApprovalExecutionCompensationAuditPreviewContract(input: {
  readonly preview_id_hash: `hash:${string}`;
  readonly compensation_metadata: unknown;
  readonly validation_results?: readonly ApprovalExecutionCompensationValidationGuardResult[];
}): ApprovalExecutionCompensationAuditPreviewContract {
  const compensation = ApprovalExecutionCompensationMetadataSchema.parse(
    input.compensation_metadata,
  );
  const validationResults = (
    input.validation_results ??
    validateApprovalExecutionCompensationPolicyMetadata(compensation)
  ).map((result) =>
    ApprovalExecutionCompensationValidationGuardResultSchema.parse(result),
  );
  const replay = ApprovalReplayMetadataSchema.parse(compensation.replay);
  const redaction = ApprovalRedactionMetadataSchema.parse(
    compensation.redaction_status,
  );

  return ApprovalExecutionCompensationAuditPreviewContractSchema.parse({
    contract_version:
      APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_CONTRACT_VERSION,
    preview_id_hash: input.preview_id_hash,
    phase: 18,
    slice: "18G.3",
    preview_kind: "approval_execution_compensation_audit_preview",
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    sections:
      APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS.map(
        sectionDeclaration,
      ),
    compensation_summary: {
      compensation_ref_hash: hashFromId(
        compensation.compensation_id,
        "compensation",
      ),
      proposal_kind: compensation.proposal_kind,
      status: compensation.status,
      status_is_operational: false,
      status_performs_real_compensation: false,
      hint_count: compensation.hint_metadata.length,
      evidence_count: compensation.evidence_metadata.length,
      compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      metadata_only: true,
    },
    verification_reference: {
      verification_id: compensation.verification_id,
      verification_ref_hash: hashFromId(
        compensation.verification_id,
        "verification",
      ),
      real_state_read_enabled: false,
      verification_logic_enabled: false,
      metadata_only: true,
      raw_payload_included: false,
    },
    execution_plan_reference: {
      execution_plan_id: compensation.execution_plan_id,
      execution_plan_ref_hash: hashFromId(
        compensation.execution_plan_id,
        "execution-plan",
      ),
      decision_record_id: compensation.decision_record_id,
      review_session_id: compensation.review_session_id,
      metadata_only: true,
      raw_payload_included: false,
    },
    strategy_summary: {
      strategy: compensation.strategy_metadata.strategy,
      strategy_is_metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      inverse_operation_execution_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    },
    eligibility_summary: {
      eligibility_ref_hash:
        compensation.eligibility_metadata.eligibility_ref_hash,
      future_compensation_hint_available: true,
      real_eligibility_evaluated: false,
      real_state_read_enabled: false,
      restore_point_validated: false,
      metadata_only: true,
    },
    hint_summary: {
      hint_count: compensation.hint_metadata.length,
      hints: compensation.hint_metadata.map((hint) => ({
        hint_id: hint.hint_id,
        hint_kind: hint.hint_kind,
        redacted_reference: hint.redacted_reference,
        hash_reference: hint.hash_reference,
        eligibility_ref_hash: hint.eligibility_metadata.eligibility_ref_hash,
        risk_class: hint.risk_class,
        replay_safe: true,
        redaction_status: hint.redaction_status.redaction_status,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_tool_output_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_state_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
      })),
      metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      raw_payload_included: false,
    },
    evidence_summary: {
      evidence_count: compensation.evidence_metadata.length,
      evidence: compensation.evidence_metadata.map((evidence) => ({
        evidence_id: evidence.evidence_id,
        evidence_kind: evidence.evidence_kind,
        redacted_reference: evidence.redacted_reference,
        hash_reference: evidence.hash_reference,
        replay_safe: true,
        redaction_status: evidence.redaction_status.redaction_status,
        metadata_only: true,
        real_evidence_collected: false,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_tool_output_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_state_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
      })),
      metadata_only: true,
      real_evidence_collection_enabled: false,
      raw_payload_included: false,
    },
    validation_results: {
      result_count: validationResults.length,
      passed_count: validationResults.filter((result) => result.passed).length,
      failed_count: validationResults.filter((result) => !result.passed).length,
      max_severity: maxSeverity(validationResults),
      results: validationResults,
      metadata_only: true,
      raw_payload_included: false,
    },
    disabled_compensation_status: {
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
      real_state_read_enabled: false,
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
    },
    redaction_status: {
      redaction_status: redaction.redaction_status,
      redaction_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_tool_output_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_state_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
      pii_included: false,
      metadata_only: true,
    },
    replay_status: {
      replay_safe: true,
      deterministic_replay_key_hash: replay.deterministic_replay_key_hash,
      source_event_hash: replay.source_event_hash,
      metadata_only: true,
    },
    replay,
    redaction,
    proposal_id: compensation.proposal_id,
    proposal_kind: compensation.proposal_kind,
    target_class: compensation.target_metadata.target_class,
    risk_class: compensation.target_metadata.risk_class,
  });
}
