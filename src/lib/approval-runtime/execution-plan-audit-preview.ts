import { z } from "zod";

import {
  ApprovalExecutionPlanMetadataSchema,
  ApprovalExecutionPlanStatusSchema,
  ApprovalExecutionStepKindSchema,
} from "./execution-plan";
import {
  ApprovalExecutionPlanValidationGuardResultSchema,
  ApprovalExecutionPlanValidationGuardSeveritySchema,
  validateApprovalExecutionPlanPolicyMetadata,
  type ApprovalExecutionPlanValidationGuardResult,
} from "./execution-plan-validation";
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

export const APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION =
  "18E.3" as const;

export const APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS = [
  "plan_summary",
  "proposal_reference",
  "decision_reference",
  "target_summary",
  "dry_run_status",
  "step_summary",
  "validation_results",
  "disabled_execution_status",
  "redaction_status",
  "replay_status",
] as const;

export const APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export type ApprovalExecutionPlanAuditPreviewSection =
  (typeof APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS)[number];
export type ApprovalExecutionPlanAuditPreviewRedactionStatus =
  (typeof APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_REDACTION_STATUSES)[number];

export const ApprovalExecutionPlanAuditPreviewSectionSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS,
);
export const ApprovalExecutionPlanAuditPreviewRedactionStatusSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_REDACTION_STATUSES,
);

export const ApprovalExecutionPlanAuditPreviewDisabledExecutionStatusSchema =
  z.strictObject({
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
    runtime_wiring_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewSectionDeclarationSchema =
  z.strictObject({
    section: ApprovalExecutionPlanAuditPreviewSectionSchema,
    included: z.literal(true),
    metadata_only: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewPlanSummarySchema =
  z.strictObject({
    execution_plan_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    proposal_kind: ApprovalProposalRegistryKindSchema,
    status: ApprovalExecutionPlanStatusSchema,
    status_is_operational: z.literal(false),
    status_enables_execution: z.literal(false),
    dry_run_required: z.literal(true),
    step_count: z.number().int().nonnegative(),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionPlanAuditPreviewProposalReferenceSchema =
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

export const ApprovalExecutionPlanAuditPreviewDecisionReferenceSchema =
  z.strictObject({
    decision_record_id: z
      .string()
      .trim()
      .regex(/^decision-record:[a-z0-9._:-]+$/),
    decision_record_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    review_session_id: z
      .string()
      .trim()
      .regex(/^review-session:[a-z0-9._:-]+$/),
    review_session_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewTargetSummarySchema =
  z.strictObject({
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

export const ApprovalExecutionPlanAuditPreviewDryRunStatusSchema =
  z.strictObject({
    dry_run_required: z.literal(true),
    dry_run_completed: z.literal(false),
    dry_run_output_included: z.literal(false),
    dry_run_tool_arguments_included: z.literal(false),
    dry_run_dispatch_enabled: z.literal(false),
    dry_run_execution_enabled: z.literal(false),
    dry_run_persistence_enabled: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionPlanAuditPreviewStepSummaryItemSchema =
  z.strictObject({
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
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewStepSummarySchema =
  z.strictObject({
    step_count: z.number().int().nonnegative(),
    steps: z.array(ApprovalExecutionPlanAuditPreviewStepSummaryItemSchema),
    metadata_only: z.literal(true),
    executable_step_handlers_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewValidationSummarySchema =
  z.strictObject({
    result_count: z.number().int().nonnegative(),
    passed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    max_severity: ApprovalExecutionPlanValidationGuardSeveritySchema,
    results: z.array(ApprovalExecutionPlanValidationGuardResultSchema),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalExecutionPlanAuditPreviewRedactionMetadataSchema =
  z.strictObject({
    redaction_status: ApprovalRedactionStatusSchema,
    redaction_safe: z.literal(true),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
    pii_included: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionPlanAuditPreviewReplayMetadataSchema =
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

export const ApprovalExecutionPlanAuditPreviewContractSchema = z.strictObject({
  contract_version: z.literal(
    APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION,
  ),
  preview_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  phase: z.literal(18),
  slice: z.literal("18E.3"),
  preview_kind: z.literal("approval_execution_plan_audit_preview"),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  ui_safe_later: z.literal(true),
  ui_wired: z.literal(false),
  audit_shaped: z.literal(true),
  audit_db_write_enabled: z.literal(false),
  sections: z.array(ApprovalExecutionPlanAuditPreviewSectionDeclarationSchema),
  plan_summary: ApprovalExecutionPlanAuditPreviewPlanSummarySchema,
  proposal_reference: ApprovalExecutionPlanAuditPreviewProposalReferenceSchema,
  decision_reference: ApprovalExecutionPlanAuditPreviewDecisionReferenceSchema,
  target_summary: ApprovalExecutionPlanAuditPreviewTargetSummarySchema,
  dry_run_status: ApprovalExecutionPlanAuditPreviewDryRunStatusSchema,
  step_summary: ApprovalExecutionPlanAuditPreviewStepSummarySchema,
  validation_results: ApprovalExecutionPlanAuditPreviewValidationSummarySchema,
  disabled_execution_status:
    ApprovalExecutionPlanAuditPreviewDisabledExecutionStatusSchema,
  redaction_status: ApprovalExecutionPlanAuditPreviewRedactionMetadataSchema,
  replay_status: ApprovalExecutionPlanAuditPreviewReplayMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
});

export type ApprovalExecutionPlanAuditPreviewDisabledExecutionStatus = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewDisabledExecutionStatusSchema
>;
export type ApprovalExecutionPlanAuditPreviewSectionDeclaration = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewSectionDeclarationSchema
>;
export type ApprovalExecutionPlanAuditPreviewPlanSummary = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewPlanSummarySchema
>;
export type ApprovalExecutionPlanAuditPreviewStepSummary = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewStepSummarySchema
>;
export type ApprovalExecutionPlanAuditPreviewValidationSummary = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewValidationSummarySchema
>;
export type ApprovalExecutionPlanAuditPreviewContract = z.infer<
  typeof ApprovalExecutionPlanAuditPreviewContractSchema
>;

function sectionDeclaration(
  section: ApprovalExecutionPlanAuditPreviewSection,
): ApprovalExecutionPlanAuditPreviewSectionDeclaration {
  return ApprovalExecutionPlanAuditPreviewSectionDeclarationSchema.parse({
    section,
    included: true,
    metadata_only: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    raw_payload_included: false,
  });
}

function maxSeverity(
  results: readonly ApprovalExecutionPlanValidationGuardResult[],
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

export function buildApprovalExecutionPlanAuditPreviewContract(input: {
  readonly preview_id_hash: `hash:${string}`;
  readonly execution_plan: unknown;
  readonly validation_results?: readonly ApprovalExecutionPlanValidationGuardResult[];
}): ApprovalExecutionPlanAuditPreviewContract {
  const plan = ApprovalExecutionPlanMetadataSchema.parse(input.execution_plan);
  const validationResults = (
    input.validation_results ??
    validateApprovalExecutionPlanPolicyMetadata(plan)
  ).map((result) =>
    ApprovalExecutionPlanValidationGuardResultSchema.parse(result),
  );
  const replay = ApprovalReplayMetadataSchema.parse(plan.replay);
  const redaction = ApprovalRedactionMetadataSchema.parse(
    plan.redaction_status,
  );

  return ApprovalExecutionPlanAuditPreviewContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION,
    preview_id_hash: input.preview_id_hash,
    phase: 18,
    slice: "18E.3",
    preview_kind: "approval_execution_plan_audit_preview",
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    sections:
      APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS.map(sectionDeclaration),
    plan_summary: {
      execution_plan_ref_hash: hashFromId(
        plan.execution_plan_id,
        "execution-plan",
      ),
      proposal_kind: plan.proposal_kind,
      status: plan.status,
      status_is_operational: false,
      status_enables_execution: false,
      dry_run_required: true,
      step_count: plan.step_metadata.length,
      execution_enabled: false,
      dispatch_enabled: false,
      metadata_only: true,
    },
    proposal_reference: {
      proposal_id: plan.proposal_id,
      proposal_ref_hash: hashFromId(plan.proposal_id, "proposal"),
      proposal_kind: plan.proposal_kind,
      metadata_only: true,
      raw_payload_included: false,
    },
    decision_reference: {
      decision_record_id: plan.decision_record_id,
      decision_record_ref_hash: hashFromId(
        plan.decision_record_id,
        "decision-record",
      ),
      review_session_id: plan.review_session_id,
      review_session_ref_hash: hashFromId(
        plan.review_session_id,
        "review-session",
      ),
      metadata_only: true,
      raw_payload_included: false,
      approval_decision_handling_enabled: false,
    },
    target_summary: {
      target_class: plan.target_metadata.target_class,
      target_ref_hash: plan.target_metadata.target_ref_hash,
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
    dry_run_status: {
      dry_run_required: true,
      dry_run_completed: false,
      dry_run_output_included: false,
      dry_run_tool_arguments_included: false,
      dry_run_dispatch_enabled: false,
      dry_run_execution_enabled: false,
      dry_run_persistence_enabled: false,
      metadata_only: true,
    },
    step_summary: {
      step_count: plan.step_metadata.length,
      steps: plan.step_metadata.map((step) => ({
        step_id: step.step_id,
        step_kind: step.step_kind,
        target_class: step.target_class,
        risk_class: step.risk_class,
        dry_run_required: true,
        execution_enabled: false,
        dispatch_enabled: false,
        verification_required_metadata: true,
        compensation_hint_metadata_available: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
      })),
      metadata_only: true,
      executable_step_handlers_enabled: false,
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
    disabled_execution_status: {
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
      runtime_wiring_enabled: false,
      scheduler_triggered_action_enabled: false,
      network_cloud_calls_enabled: false,
    },
    redaction_status: {
      redaction_status: redaction.redaction_status,
      redaction_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
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
  });
}
