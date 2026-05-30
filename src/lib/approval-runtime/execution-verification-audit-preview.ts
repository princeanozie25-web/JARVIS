import { z } from "zod";

import {
  ApprovalExecutionVerificationEvidenceKindSchema,
  ApprovalExecutionVerificationMetadataSchema,
  ApprovalExecutionVerificationMethodSchema,
  ApprovalExecutionVerificationStatusSchema,
} from "./execution-verification";
import {
  ApprovalExecutionVerificationValidationGuardResultSchema,
  ApprovalExecutionVerificationValidationGuardSeveritySchema,
  validateApprovalExecutionVerificationPolicyMetadata,
  type ApprovalExecutionVerificationValidationGuardResult,
} from "./execution-verification-validation";
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

export const APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_CONTRACT_VERSION =
  "18F.3" as const;

export const APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS = [
  "verification_summary",
  "execution_plan_reference",
  "proposal_reference",
  "verification_method_summary",
  "evidence_summary",
  "validation_results",
  "disabled_verification_status",
  "redaction_status",
  "replay_status",
] as const;

export const APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_REDACTION_STATUSES =
  ["metadata_only", "redacted"] as const;

export type ApprovalExecutionVerificationAuditPreviewSection =
  (typeof APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS)[number];
export type ApprovalExecutionVerificationAuditPreviewRedactionStatus =
  (typeof APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_REDACTION_STATUSES)[number];

export const ApprovalExecutionVerificationAuditPreviewSectionSchema = z.enum(
  APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS,
);
export const ApprovalExecutionVerificationAuditPreviewRedactionStatusSchema =
  z.enum(APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_REDACTION_STATUSES);

export const ApprovalExecutionVerificationAuditPreviewDisabledStatusSchema =
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

export const ApprovalExecutionVerificationAuditPreviewSectionDeclarationSchema =
  z.strictObject({
    section: ApprovalExecutionVerificationAuditPreviewSectionSchema,
    included: z.literal(true),
    metadata_only: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionVerificationAuditPreviewSummarySchema =
  z.strictObject({
    verification_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    proposal_kind: ApprovalProposalRegistryKindSchema,
    status: ApprovalExecutionVerificationStatusSchema,
    status_is_operational: z.literal(false),
    status_performs_real_verification: z.literal(false),
    evidence_count: z.number().int().nonnegative(),
    verification_enabled: z.literal(false),
    real_state_read_enabled: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionVerificationAuditPreviewPlanReferenceSchema =
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

export const ApprovalExecutionVerificationAuditPreviewProposalReferenceSchema =
  z.strictObject({
    proposal_id: ProposalIdSchema,
    proposal_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    proposal_kind: ApprovalProposalRegistryKindSchema,
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionVerificationAuditPreviewMethodSummarySchema =
  z.strictObject({
    method: ApprovalExecutionVerificationMethodSchema,
    method_is_metadata_only: z.literal(true),
    real_state_read_enabled: z.literal(false),
    real_evidence_collection_enabled: z.literal(false),
    verification_logic_enabled: z.literal(false),
    execution_required: z.literal(false),
    dispatch_required: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionVerificationAuditPreviewEvidenceSummaryItemSchema =
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
    confidence_band: z.enum([
      "low_metadata",
      "medium_metadata",
      "high_metadata",
    ]),
    freshness_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
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

export const ApprovalExecutionVerificationAuditPreviewEvidenceSummarySchema =
  z.strictObject({
    evidence_count: z.number().int().nonnegative(),
    evidence: z.array(
      ApprovalExecutionVerificationAuditPreviewEvidenceSummaryItemSchema,
    ),
    metadata_only: z.literal(true),
    real_evidence_collection_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionVerificationAuditPreviewValidationSummarySchema =
  z.strictObject({
    result_count: z.number().int().nonnegative(),
    passed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    max_severity: ApprovalExecutionVerificationValidationGuardSeveritySchema,
    results: z.array(ApprovalExecutionVerificationValidationGuardResultSchema),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionVerificationAuditPreviewRedactionMetadataSchema =
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

export const ApprovalExecutionVerificationAuditPreviewReplayMetadataSchema =
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

export const ApprovalExecutionVerificationAuditPreviewContractSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_CONTRACT_VERSION,
    ),
    preview_id_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    phase: z.literal(18),
    slice: z.literal("18F.3"),
    preview_kind: z.literal("approval_execution_verification_audit_preview"),
    metadata_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    sections: z.array(
      ApprovalExecutionVerificationAuditPreviewSectionDeclarationSchema,
    ),
    verification_summary:
      ApprovalExecutionVerificationAuditPreviewSummarySchema,
    execution_plan_reference:
      ApprovalExecutionVerificationAuditPreviewPlanReferenceSchema,
    proposal_reference:
      ApprovalExecutionVerificationAuditPreviewProposalReferenceSchema,
    verification_method_summary:
      ApprovalExecutionVerificationAuditPreviewMethodSummarySchema,
    evidence_summary:
      ApprovalExecutionVerificationAuditPreviewEvidenceSummarySchema,
    validation_results:
      ApprovalExecutionVerificationAuditPreviewValidationSummarySchema,
    disabled_verification_status:
      ApprovalExecutionVerificationAuditPreviewDisabledStatusSchema,
    redaction_status:
      ApprovalExecutionVerificationAuditPreviewRedactionMetadataSchema,
    replay_status:
      ApprovalExecutionVerificationAuditPreviewReplayMetadataSchema,
    replay: ApprovalReplayMetadataSchema,
    redaction: ApprovalRedactionMetadataSchema,
    target_class: ApprovalProposalTargetKindSchema,
    risk_class: ApprovalRiskClassSchema,
  });

export type ApprovalExecutionVerificationAuditPreviewDisabledStatus = z.infer<
  typeof ApprovalExecutionVerificationAuditPreviewDisabledStatusSchema
>;
export type ApprovalExecutionVerificationAuditPreviewSectionDeclaration =
  z.infer<
    typeof ApprovalExecutionVerificationAuditPreviewSectionDeclarationSchema
  >;
export type ApprovalExecutionVerificationAuditPreviewSummary = z.infer<
  typeof ApprovalExecutionVerificationAuditPreviewSummarySchema
>;
export type ApprovalExecutionVerificationAuditPreviewEvidenceSummary = z.infer<
  typeof ApprovalExecutionVerificationAuditPreviewEvidenceSummarySchema
>;
export type ApprovalExecutionVerificationAuditPreviewValidationSummary =
  z.infer<
    typeof ApprovalExecutionVerificationAuditPreviewValidationSummarySchema
  >;
export type ApprovalExecutionVerificationAuditPreviewContract = z.infer<
  typeof ApprovalExecutionVerificationAuditPreviewContractSchema
>;

function sectionDeclaration(
  section: ApprovalExecutionVerificationAuditPreviewSection,
): ApprovalExecutionVerificationAuditPreviewSectionDeclaration {
  return ApprovalExecutionVerificationAuditPreviewSectionDeclarationSchema.parse(
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
  results: readonly ApprovalExecutionVerificationValidationGuardResult[],
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

export function buildApprovalExecutionVerificationAuditPreviewContract(input: {
  readonly preview_id_hash: `hash:${string}`;
  readonly verification_metadata: unknown;
  readonly validation_results?: readonly ApprovalExecutionVerificationValidationGuardResult[];
}): ApprovalExecutionVerificationAuditPreviewContract {
  const verification = ApprovalExecutionVerificationMetadataSchema.parse(
    input.verification_metadata,
  );
  const validationResults = (
    input.validation_results ??
    validateApprovalExecutionVerificationPolicyMetadata(verification)
  ).map((result) =>
    ApprovalExecutionVerificationValidationGuardResultSchema.parse(result),
  );
  const replay = ApprovalReplayMetadataSchema.parse(verification.replay);
  const redaction = ApprovalRedactionMetadataSchema.parse(
    verification.redaction_status,
  );

  return ApprovalExecutionVerificationAuditPreviewContractSchema.parse({
    contract_version:
      APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_CONTRACT_VERSION,
    preview_id_hash: input.preview_id_hash,
    phase: 18,
    slice: "18F.3",
    preview_kind: "approval_execution_verification_audit_preview",
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    sections:
      APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS.map(
        sectionDeclaration,
      ),
    verification_summary: {
      verification_ref_hash: hashFromId(
        verification.verification_id,
        "verification",
      ),
      proposal_kind: verification.proposal_kind,
      status: verification.status,
      status_is_operational: false,
      status_performs_real_verification: false,
      evidence_count: verification.evidence_metadata.length,
      verification_enabled: false,
      real_state_read_enabled: false,
      metadata_only: true,
    },
    execution_plan_reference: {
      execution_plan_id: verification.execution_plan_id,
      execution_plan_ref_hash: hashFromId(
        verification.execution_plan_id,
        "execution-plan",
      ),
      decision_record_id: verification.decision_record_id,
      review_session_id: verification.review_session_id,
      metadata_only: true,
      raw_payload_included: false,
    },
    proposal_reference: {
      proposal_id: verification.proposal_id,
      proposal_ref_hash: hashFromId(verification.proposal_id, "proposal"),
      proposal_kind: verification.proposal_kind,
      metadata_only: true,
      raw_payload_included: false,
    },
    verification_method_summary: {
      method: verification.method_metadata.method,
      method_is_metadata_only: true,
      real_state_read_enabled: false,
      real_evidence_collection_enabled: false,
      verification_logic_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    },
    evidence_summary: {
      evidence_count: verification.evidence_metadata.length,
      evidence: verification.evidence_metadata.map((evidence) => ({
        evidence_id: evidence.evidence_id,
        evidence_kind: evidence.evidence_kind,
        redacted_reference: evidence.redacted_reference,
        hash_reference: evidence.hash_reference,
        confidence_band: evidence.confidence_band,
        freshness_ref_hash: evidence.freshness_metadata.freshness_ref_hash,
        replay_safe: true,
        redaction_status: evidence.redaction_status.redaction_status,
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
    disabled_verification_status: {
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
    target_class: verification.target_metadata.target_class,
    risk_class: verification.target_metadata.risk_class,
  });
}
