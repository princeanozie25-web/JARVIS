import { z } from "zod";

import {
  APPROVAL_FORBIDDEN_CAPABILITIES,
  DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
} from "./authority-boundary";
import {
  ApprovalLifecycleStageSchema,
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
} from "./types";
import {
  ApprovalProposalKindDeclarationSchema,
  ApprovalProposalRegistryKindSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
} from "./proposal-registry";
import {
  ApprovalValidationGuardResultSchema,
  ApprovalValidationGuardSeveritySchema,
  validateApprovalProposalMetadataGuards,
  type ApprovalValidationGuardResult,
} from "./validation-guards";

export const APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION = "18A.5" as const;

export const APPROVAL_AUDIT_PREVIEW_SECTIONS = [
  "proposal_summary",
  "authority_boundary",
  "validation_results",
  "lifecycle_state",
  "forbidden_capabilities",
  "redaction_status",
  "replay_status",
  "disabled_execution_status",
] as const;

export const APPROVAL_AUDIT_PREVIEW_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export type ApprovalAuditPreviewSection =
  (typeof APPROVAL_AUDIT_PREVIEW_SECTIONS)[number];
export type ApprovalAuditPreviewRedactionStatus =
  (typeof APPROVAL_AUDIT_PREVIEW_REDACTION_STATUSES)[number];

export const ApprovalAuditPreviewSectionSchema = z.enum(
  APPROVAL_AUDIT_PREVIEW_SECTIONS,
);
export const ApprovalAuditPreviewRedactionStatusSchema = z.enum(
  APPROVAL_AUDIT_PREVIEW_REDACTION_STATUSES,
);

export const ApprovalAuditPreviewDisabledExecutionStatusSchema = z.strictObject(
  {
    execution_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    auto_approval_enabled: z.literal(false),
    voice_only_approval_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    lifecycle_state_advancement_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    event_store_writes_enabled: z.literal(false),
    telemetry_writes_enabled: z.literal(false),
    ui_wiring_enabled: z.literal(false),
    tool_runtime_wiring_enabled: z.literal(false),
    room_adapter_wiring_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    scheduler_triggered_creation_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  },
);

export const ApprovalAuditPreviewSectionDeclarationSchema = z.strictObject({
  section: ApprovalAuditPreviewSectionSchema,
  included: z.literal(true),
  metadata_only: z.literal(true),
  ui_safe_later: z.literal(true),
  ui_wired: z.literal(false),
  audit_shaped: z.literal(true),
  audit_db_write_enabled: z.literal(false),
  raw_payload_included: z.literal(false),
});

export const ApprovalAuditPreviewProposalSummarySchema = z.strictObject({
  proposal_kind: ApprovalProposalRegistryKindSchema,
  display_name: z.string().trim().min(1).max(80),
  risk_class: ApprovalRiskClassSchema,
  source_kind: z.string().trim().min(1).max(80),
  target_kind: z.string().trim().min(1).max(80),
  requires_approval: z.literal(true),
  dry_run_required: z.literal(true),
  metadata_only: z.literal(true),
});

export const ApprovalAuditPreviewAuthorityBoundarySchema = z.strictObject({
  matrix_ref: z.literal("approval_authority_boundary_matrix"),
  authority_boundary_present: z.literal(true),
  execution_authority_reserved: z.literal(true),
  authority_grant_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalAuditPreviewValidationSummarySchema = z.strictObject({
  result_count: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  max_severity: ApprovalValidationGuardSeveritySchema,
  results: z.array(ApprovalValidationGuardResultSchema),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const ApprovalAuditPreviewLifecycleStateSchema = z.strictObject({
  current_stage: ApprovalLifecycleStageSchema,
  transition_count: z.number().int().nonnegative(),
  lifecycle_state_advancement_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalAuditPreviewForbiddenCapabilitiesSchema = z.strictObject({
  capabilities: z.array(z.enum(APPROVAL_FORBIDDEN_CAPABILITIES)),
  rejected: z.literal(true),
  metadata_only: z.literal(true),
});

export const ApprovalAuditPreviewRedactionMetadataSchema = z.strictObject({
  redaction_status: ApprovalAuditPreviewRedactionStatusSchema,
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

export const ApprovalAuditPreviewReplayMetadataSchema = z.strictObject({
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

export const ApprovalAuditPreviewContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION),
  preview_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  phase: z.literal(18),
  slice: z.literal("18A.5"),
  preview_kind: z.literal("approval_audit_preview"),
  local_first: z.literal(true),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  ui_safe_later: z.literal(true),
  ui_wired: z.literal(false),
  audit_shaped: z.literal(true),
  audit_db_write_enabled: z.literal(false),
  sections: z.array(ApprovalAuditPreviewSectionDeclarationSchema),
  proposal_summary: ApprovalAuditPreviewProposalSummarySchema,
  authority_boundary: ApprovalAuditPreviewAuthorityBoundarySchema,
  validation_results: ApprovalAuditPreviewValidationSummarySchema,
  lifecycle_state: ApprovalAuditPreviewLifecycleStateSchema,
  forbidden_capabilities: ApprovalAuditPreviewForbiddenCapabilitiesSchema,
  redaction_status: ApprovalAuditPreviewRedactionMetadataSchema,
  replay_status: ApprovalAuditPreviewReplayMetadataSchema,
  disabled_execution_status: ApprovalAuditPreviewDisabledExecutionStatusSchema,
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
});

export type ApprovalAuditPreviewDisabledExecutionStatus = z.infer<
  typeof ApprovalAuditPreviewDisabledExecutionStatusSchema
>;
export type ApprovalAuditPreviewSectionDeclaration = z.infer<
  typeof ApprovalAuditPreviewSectionDeclarationSchema
>;
export type ApprovalAuditPreviewProposalSummary = z.infer<
  typeof ApprovalAuditPreviewProposalSummarySchema
>;
export type ApprovalAuditPreviewValidationSummary = z.infer<
  typeof ApprovalAuditPreviewValidationSummarySchema
>;
export type ApprovalAuditPreviewContract = z.infer<
  typeof ApprovalAuditPreviewContractSchema
>;

function sectionDeclaration(
  section: ApprovalAuditPreviewSection,
): ApprovalAuditPreviewSectionDeclaration {
  return ApprovalAuditPreviewSectionDeclarationSchema.parse({
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
  results: readonly ApprovalValidationGuardResult[],
): "info" | "warning" | "error" {
  if (results.some((result) => result.severity === "error")) {
    return "error";
  }
  if (results.some((result) => result.severity === "warning")) {
    return "warning";
  }
  return "info";
}

export function buildApprovalAuditPreviewContract(input: {
  readonly preview_id_hash: `hash:${string}`;
  readonly proposal: unknown;
  readonly validation_results?: readonly ApprovalValidationGuardResult[];
  readonly current_stage?: unknown;
  readonly transition_count?: number;
  readonly replay?: unknown;
  readonly redaction?: unknown;
}): ApprovalAuditPreviewContract {
  const proposal = ApprovalProposalKindDeclarationSchema.parse(input.proposal);
  const validationResults = (
    input.validation_results ?? validateApprovalProposalMetadataGuards(proposal)
  ).map((result) => ApprovalValidationGuardResultSchema.parse(result));
  const replay = ApprovalReplayMetadataSchema.parse(
    input.replay ?? {
      schema_version: "approval-runtime.v18a1",
      replay_safe: true,
      local_first: true,
      deterministic_replay_key_hash: "hash:approval-audit-preview",
      source_event_hash: "hash:approval-audit-preview-source",
      originating_session_hash: null,
      sequence_index: 0,
    },
  );
  const redaction = ApprovalRedactionMetadataSchema.parse(
    input.redaction ?? {
      redaction_status: "metadata_only",
      redaction_safe: true,
      metadata_only: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_execution_command_included: false,
      secret_material_included: false,
      pii_included: false,
    },
  );

  return ApprovalAuditPreviewContractSchema.parse({
    contract_version: APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION,
    preview_id_hash: input.preview_id_hash,
    phase: 18,
    slice: "18A.5",
    preview_kind: "approval_audit_preview",
    local_first: true,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    sections: APPROVAL_AUDIT_PREVIEW_SECTIONS.map(sectionDeclaration),
    proposal_summary: {
      proposal_kind: proposal.proposal_kind,
      display_name: proposal.display_name,
      risk_class: proposal.risk.risk_class,
      source_kind: proposal.source.source_kind,
      target_kind: proposal.target.target_kind,
      requires_approval: true,
      dry_run_required: true,
      metadata_only: true,
    },
    authority_boundary: {
      matrix_ref: DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.matrix_id,
      authority_boundary_present: true,
      execution_authority_reserved: true,
      authority_grant_enabled: false,
      dispatch_enabled: false,
      metadata_only: true,
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
    lifecycle_state: {
      current_stage: ApprovalLifecycleStageSchema.parse(
        input.current_stage ?? "PROPOSED",
      ),
      transition_count: input.transition_count ?? 0,
      lifecycle_state_advancement_enabled: false,
      metadata_only: true,
    },
    forbidden_capabilities: {
      capabilities:
        DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.forbidden_capability_refs,
      rejected: true,
      metadata_only: true,
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
    disabled_execution_status: {
      execution_enabled: false,
      approval_creation_enabled: false,
      authority_grant_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      dispatch_enabled: false,
      lifecycle_state_advancement_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      event_store_writes_enabled: false,
      telemetry_writes_enabled: false,
      ui_wiring_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      scheduler_triggered_creation_enabled: false,
      network_cloud_calls_enabled: false,
    },
    replay,
    redaction,
  });
}
