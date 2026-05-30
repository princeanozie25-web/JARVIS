import { z } from "zod";

import {
  APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
  ApprovalDecisionRecordChannelSchema,
  ApprovalDecisionRecordForbiddenChannelSchema,
  ApprovalDecisionRecordOutcomeSchema,
} from "./approval-decision-record";
import {
  ApprovalDecisionValidationGuardResultSchema,
  ApprovalDecisionValidationGuardSeveritySchema,
  validateApprovalDecisionRecordPolicyMetadata,
  type ApprovalDecisionValidationGuardResult,
} from "./approval-decision-validation";
import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalRedactionStatusSchema,
  ApprovalReplayMetadataSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_DECISION_AUDIT_PREVIEW_CONTRACT_VERSION =
  "18D.3" as const;

export const APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS = [
  "decision_summary",
  "proposal_reference",
  "review_session_reference",
  "channel_policy",
  "validation_results",
  "forbidden_channels",
  "disabled_authority_status",
  "redaction_status",
  "replay_status",
] as const;

export const APPROVAL_DECISION_AUDIT_PREVIEW_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export type ApprovalDecisionAuditPreviewSection =
  (typeof APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS)[number];
export type ApprovalDecisionAuditPreviewRedactionStatus =
  (typeof APPROVAL_DECISION_AUDIT_PREVIEW_REDACTION_STATUSES)[number];

export const ApprovalDecisionAuditPreviewSectionSchema = z.enum(
  APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS,
);
export const ApprovalDecisionAuditPreviewRedactionStatusSchema = z.enum(
  APPROVAL_DECISION_AUDIT_PREVIEW_REDACTION_STATUSES,
);

export const ApprovalDecisionAuditPreviewDisabledAuthorityStatusSchema =
  z.strictObject({
    lifecycle_advancement_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    token_issue_enabled: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
    auto_approval_enabled: z.literal(false),
    voice_only_approval_enabled: z.literal(false),
    event_store_write_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    tool_runtime_wiring_enabled: z.literal(false),
    room_adapter_wiring_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  });

export const ApprovalDecisionAuditPreviewSectionDeclarationSchema =
  z.strictObject({
    section: ApprovalDecisionAuditPreviewSectionSchema,
    included: z.literal(true),
    metadata_only: z.literal(true),
    ui_safe_later: z.literal(true),
    ui_wired: z.literal(false),
    audit_shaped: z.literal(true),
    audit_db_write_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
  });

export const ApprovalDecisionAuditPreviewSummarySchema = z.strictObject({
  decision_record_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  proposal_kind: ApprovalProposalRegistryKindSchema,
  outcome: ApprovalDecisionRecordOutcomeSchema,
  outcome_is_record_metadata_only: z.literal(true),
  performs_lifecycle_transition: z.literal(false),
  creates_approval: z.literal(false),
  handles_approval_decision: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalDecisionAuditPreviewProposalReferenceSchema =
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

export const ApprovalDecisionAuditPreviewReviewSessionReferenceSchema =
  z.strictObject({
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
  });

export const ApprovalDecisionAuditPreviewChannelPolicySchema = z.strictObject({
  observed_channel: z.string().trim().min(1).max(80),
  channel_allowed: z.boolean(),
  forbidden_channel_detected:
    ApprovalDecisionRecordForbiddenChannelSchema.nullable(),
  allowed_channels: z.array(ApprovalDecisionRecordChannelSchema),
  voice_only_approval_enabled: z.literal(false),
  auto_approval_enabled: z.literal(false),
  scheduler_decision_enabled: z.literal(false),
  background_decision_enabled: z.literal(false),
  network_decision_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalDecisionAuditPreviewValidationSummarySchema =
  z.strictObject({
    result_count: z.number().int().nonnegative(),
    passed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    max_severity: ApprovalDecisionValidationGuardSeveritySchema,
    results: z.array(ApprovalDecisionValidationGuardResultSchema),
    metadata_only: z.literal(true),
    raw_payload_included: z.literal(false),
  });

export const ApprovalDecisionAuditPreviewForbiddenChannelsSchema =
  z.strictObject({
    channels: z.array(ApprovalDecisionRecordForbiddenChannelSchema),
    rejected: z.literal(true),
    detected_forbidden_channel:
      ApprovalDecisionRecordForbiddenChannelSchema.nullable(),
    metadata_only: z.literal(true),
  });

export const ApprovalDecisionAuditPreviewRedactionMetadataSchema =
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

export const ApprovalDecisionAuditPreviewReplayMetadataSchema = z.strictObject({
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

export const ApprovalDecisionAuditPreviewContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_DECISION_AUDIT_PREVIEW_CONTRACT_VERSION),
  preview_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  phase: z.literal(18),
  slice: z.literal("18D.3"),
  preview_kind: z.literal("approval_decision_audit_preview"),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  ui_safe_later: z.literal(true),
  ui_wired: z.literal(false),
  audit_shaped: z.literal(true),
  audit_db_write_enabled: z.literal(false),
  sections: z.array(ApprovalDecisionAuditPreviewSectionDeclarationSchema),
  decision_summary: ApprovalDecisionAuditPreviewSummarySchema,
  proposal_reference: ApprovalDecisionAuditPreviewProposalReferenceSchema,
  review_session_reference:
    ApprovalDecisionAuditPreviewReviewSessionReferenceSchema,
  channel_policy: ApprovalDecisionAuditPreviewChannelPolicySchema,
  validation_results: ApprovalDecisionAuditPreviewValidationSummarySchema,
  forbidden_channels: ApprovalDecisionAuditPreviewForbiddenChannelsSchema,
  disabled_authority_status:
    ApprovalDecisionAuditPreviewDisabledAuthorityStatusSchema,
  redaction_status: ApprovalDecisionAuditPreviewRedactionMetadataSchema,
  replay_status: ApprovalDecisionAuditPreviewReplayMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
});

export type ApprovalDecisionAuditPreviewDisabledAuthorityStatus = z.infer<
  typeof ApprovalDecisionAuditPreviewDisabledAuthorityStatusSchema
>;
export type ApprovalDecisionAuditPreviewSectionDeclaration = z.infer<
  typeof ApprovalDecisionAuditPreviewSectionDeclarationSchema
>;
export type ApprovalDecisionAuditPreviewSummary = z.infer<
  typeof ApprovalDecisionAuditPreviewSummarySchema
>;
export type ApprovalDecisionAuditPreviewValidationSummary = z.infer<
  typeof ApprovalDecisionAuditPreviewValidationSummarySchema
>;
export type ApprovalDecisionAuditPreviewContract = z.infer<
  typeof ApprovalDecisionAuditPreviewContractSchema
>;

function sectionDeclaration(
  section: ApprovalDecisionAuditPreviewSection,
): ApprovalDecisionAuditPreviewSectionDeclaration {
  return ApprovalDecisionAuditPreviewSectionDeclarationSchema.parse({
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
  results: readonly ApprovalDecisionValidationGuardResult[],
): "info" | "warning" | "error" {
  if (results.some((result) => result.severity === "error")) {
    return "error";
  }
  if (results.some((result) => result.severity === "warning")) {
    return "warning";
  }
  return "info";
}

function recordField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  return (input as Record<string, unknown>)[field];
}

function channelValue(input: unknown): string {
  const channelMetadata = recordField(input, "channel_metadata");
  if (
    channelMetadata &&
    typeof channelMetadata === "object" &&
    "channel" in channelMetadata
  ) {
    const channel = (channelMetadata as { readonly channel?: unknown }).channel;
    if (typeof channel === "string") {
      return channel;
    }
  }

  return "unknown";
}

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

function replayMetadata(input: unknown) {
  return ApprovalReplayMetadataSchema.parse(recordField(input, "replay"));
}

function redactionMetadata(input: unknown) {
  return ApprovalRedactionMetadataSchema.parse(
    recordField(input, "redaction_status"),
  );
}

export function buildApprovalDecisionAuditPreviewContract(input: {
  readonly preview_id_hash: `hash:${string}`;
  readonly decision_record: unknown;
  readonly validation_results?: readonly ApprovalDecisionValidationGuardResult[];
}): ApprovalDecisionAuditPreviewContract {
  const record = input.decision_record;
  const validationResults = (
    input.validation_results ??
    validateApprovalDecisionRecordPolicyMetadata(record)
  ).map((result) => ApprovalDecisionValidationGuardResultSchema.parse(result));
  const replay = replayMetadata(record);
  const redaction = redactionMetadata(record);
  const observedChannel = channelValue(record);
  const forbiddenChannel =
    ApprovalDecisionRecordForbiddenChannelSchema.safeParse(observedChannel);
  const allowedChannel =
    ApprovalDecisionRecordChannelSchema.safeParse(observedChannel);
  const proposalId = ProposalIdSchema.parse(recordField(record, "proposal_id"));
  const reviewSessionId = z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/)
    .parse(recordField(record, "review_session_id"));
  const proposalKind = ApprovalProposalRegistryKindSchema.parse(
    recordField(record, "proposal_kind"),
  );
  const outcome = ApprovalDecisionRecordOutcomeSchema.parse(
    recordField(record, "outcome"),
  );
  const decisionRecordId = z
    .string()
    .trim()
    .regex(/^decision-record:[a-z0-9._:-]+$/)
    .parse(recordField(record, "decision_record_id"));

  return ApprovalDecisionAuditPreviewContractSchema.parse({
    contract_version: APPROVAL_DECISION_AUDIT_PREVIEW_CONTRACT_VERSION,
    preview_id_hash: input.preview_id_hash,
    phase: 18,
    slice: "18D.3",
    preview_kind: "approval_decision_audit_preview",
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    ui_safe_later: true,
    ui_wired: false,
    audit_shaped: true,
    audit_db_write_enabled: false,
    sections: APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS.map(sectionDeclaration),
    decision_summary: {
      decision_record_ref_hash: hashFromId(decisionRecordId, "decision-record"),
      proposal_kind: proposalKind,
      outcome,
      outcome_is_record_metadata_only: true,
      performs_lifecycle_transition: false,
      creates_approval: false,
      handles_approval_decision: false,
      metadata_only: true,
    },
    proposal_reference: {
      proposal_id: proposalId,
      proposal_ref_hash: hashFromId(proposalId, "proposal"),
      proposal_kind: proposalKind,
      metadata_only: true,
      raw_payload_included: false,
    },
    review_session_reference: {
      review_session_id: reviewSessionId,
      review_session_ref_hash: hashFromId(reviewSessionId, "review-session"),
      metadata_only: true,
      raw_payload_included: false,
    },
    channel_policy: {
      observed_channel: observedChannel,
      channel_allowed: allowedChannel.success && !forbiddenChannel.success,
      forbidden_channel_detected: forbiddenChannel.success
        ? forbiddenChannel.data
        : null,
      allowed_channels: ["ui_click", "keyboard", "typed_confirmation"],
      voice_only_approval_enabled: false,
      auto_approval_enabled: false,
      scheduler_decision_enabled: false,
      background_decision_enabled: false,
      network_decision_enabled: false,
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
    forbidden_channels: {
      channels: APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
      rejected: true,
      detected_forbidden_channel: forbiddenChannel.success
        ? forbiddenChannel.data
        : null,
      metadata_only: true,
    },
    disabled_authority_status: {
      lifecycle_advancement_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      event_store_write_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
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
