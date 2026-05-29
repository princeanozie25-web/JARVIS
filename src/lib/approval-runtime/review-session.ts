import { z } from "zod";

import { ApprovalAuditPreviewContractSchema } from "./audit-preview";
import {
  ApprovalProposalInboxItemSchema,
  ApprovalProposalInboxValidationSummarySchema,
} from "./proposal-inbox";
import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import {
  ApprovalReviewChannelSchema,
  ApprovalReviewDecisionMetadataSchema,
  ApprovalReviewDecisionRequestSchema,
  validateApprovalReviewDecisionMetadataShape,
  type ApprovalReviewDecisionMetadata,
} from "./review-decision";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_REVIEW_SESSION_CONTRACT_VERSION = "18B.3" as const;

export const APPROVAL_REVIEW_SESSION_STATUSES = [
  "opened",
  "awaiting_review",
  "decision_requested",
  "changes_requested",
  "closed",
  "expired",
] as const;

export const APPROVAL_REVIEW_SESSION_PARTICIPANT_KINDS = [
  "local_user_reviewer",
] as const;

export const APPROVAL_REVIEW_SESSION_EVIDENCE_STATUS_SUMMARIES = [
  "validation_passed",
  "validation_failed",
  "review_required",
] as const;

export type ApprovalReviewSessionStatus =
  (typeof APPROVAL_REVIEW_SESSION_STATUSES)[number];
export type ApprovalReviewSessionParticipantKind =
  (typeof APPROVAL_REVIEW_SESSION_PARTICIPANT_KINDS)[number];
export type ApprovalReviewSessionEvidenceStatusSummary =
  (typeof APPROVAL_REVIEW_SESSION_EVIDENCE_STATUS_SUMMARIES)[number];

export const ApprovalReviewSessionStatusSchema = z.enum(
  APPROVAL_REVIEW_SESSION_STATUSES,
);
export const ApprovalReviewSessionParticipantKindSchema = z.enum(
  APPROVAL_REVIEW_SESSION_PARTICIPANT_KINDS,
);
export const ApprovalReviewSessionEvidenceStatusSummarySchema = z.enum(
  APPROVAL_REVIEW_SESSION_EVIDENCE_STATUS_SUMMARIES,
);

export const ApprovalReviewSessionDisabledAuthorityFlagsSchema = z.strictObject(
  {
    lifecycle_advancement_enabled: z.literal(false),
    approval_record_write_enabled: z.literal(false),
    execution_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    auto_approval_enabled: z.literal(false),
    voice_only_approval_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    event_store_writes_enabled: z.literal(false),
    telemetry_writes_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    tool_runtime_wiring_enabled: z.literal(false),
    room_adapter_wiring_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  },
);

export const ApprovalReviewSessionParticipantMetadataSchema = z.strictObject({
  participant_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  participant_kind: ApprovalReviewSessionParticipantKindSchema,
  actor_present_required: z.literal(true),
  voice_only_participant: z.literal(false),
  metadata_only: z.literal(true),
  raw_participant_identifier_included: z.literal(false),
});

export const ApprovalReviewSessionEvidenceMetadataSchema = z.strictObject({
  audit_preview_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  proposal_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  validation_result_refs: z.array(
    z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
  ),
  redacted_reference_hashes: z.array(
    z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
  ),
  status_summary: ApprovalReviewSessionEvidenceStatusSummarySchema,
  risk_label: ApprovalRiskClassSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
});

export const ApprovalReviewSessionDecisionRequestMetadataSchema =
  z.strictObject({
    decision_request_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/)
      .nullable(),
    decision_request_present: z.boolean(),
    decision_request: ApprovalReviewDecisionRequestSchema.nullable(),
    channel: ApprovalReviewChannelSchema.nullable(),
    voice_only_attached: z.literal(false),
    metadata_only: z.literal(true),
    request_is_intention_only: z.literal(true),
    approval_decision_handled: z.literal(false),
    lifecycle_state_advanced: z.literal(false),
    approval_record_written: z.literal(false),
  });

export const ApprovalReviewSessionOpenedAtMetadataSchema = z.strictObject({
  opened_at_ms: z.number().int().nonnegative(),
  source_clock_trusted: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalReviewSessionExpiresAtMetadataSchema = z.strictObject({
  expires_at_ms: z.number().int().nonnegative(),
  expiry_display_only: z.literal(true),
  lifecycle_expiry_decision: z.literal(false),
  timers_registered: z.literal(false),
  scheduler_registered: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalReviewSessionSnapshotSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_REVIEW_SESSION_CONTRACT_VERSION),
  review_session_id: z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/),
  inbox_item_id: z
    .string()
    .trim()
    .regex(/^inbox:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  proposal_kind: ApprovalProposalRegistryKindSchema,
  audit_preview_id: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  validation_summary: ApprovalProposalInboxValidationSummarySchema,
  participant_metadata: z.array(ApprovalReviewSessionParticipantMetadataSchema),
  evidence_metadata: ApprovalReviewSessionEvidenceMetadataSchema,
  decision_request_metadata: ApprovalReviewSessionDecisionRequestMetadataSchema,
  status: ApprovalReviewSessionStatusSchema,
  status_display_only: z.literal(true),
  status_is_lifecycle_stage: z.literal(false),
  opened_at_metadata: ApprovalReviewSessionOpenedAtMetadataSchema,
  expires_at_metadata: ApprovalReviewSessionExpiresAtMetadataSchema,
  disabled_authority: ApprovalReviewSessionDisabledAuthorityFlagsSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  ui_rendered: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
});

export type ApprovalReviewSessionDisabledAuthorityFlags = z.infer<
  typeof ApprovalReviewSessionDisabledAuthorityFlagsSchema
>;
export type ApprovalReviewSessionParticipantMetadata = z.infer<
  typeof ApprovalReviewSessionParticipantMetadataSchema
>;
export type ApprovalReviewSessionEvidenceMetadata = z.infer<
  typeof ApprovalReviewSessionEvidenceMetadataSchema
>;
export type ApprovalReviewSessionDecisionRequestMetadata = z.infer<
  typeof ApprovalReviewSessionDecisionRequestMetadataSchema
>;
export type ApprovalReviewSessionOpenedAtMetadata = z.infer<
  typeof ApprovalReviewSessionOpenedAtMetadataSchema
>;
export type ApprovalReviewSessionExpiresAtMetadata = z.infer<
  typeof ApprovalReviewSessionExpiresAtMetadataSchema
>;
export type ApprovalReviewSessionSnapshot = z.infer<
  typeof ApprovalReviewSessionSnapshotSchema
>;

function decisionRequestMetadata(
  decisionMetadata: ApprovalReviewDecisionMetadata | null,
): ApprovalReviewSessionDecisionRequestMetadata {
  if (!decisionMetadata) {
    return ApprovalReviewSessionDecisionRequestMetadataSchema.parse({
      decision_request_ref_hash: null,
      decision_request_present: false,
      decision_request: null,
      channel: null,
      voice_only_attached: false,
      metadata_only: true,
      request_is_intention_only: true,
      approval_decision_handled: false,
      lifecycle_state_advanced: false,
      approval_record_written: false,
    });
  }

  return ApprovalReviewSessionDecisionRequestMetadataSchema.parse({
    decision_request_ref_hash: `hash:${decisionMetadata.review_decision_id.replace(
      /^review:/,
      "review-",
    )}`,
    decision_request_present: true,
    decision_request: decisionMetadata.decision_request,
    channel: decisionMetadata.channel.channel,
    voice_only_attached: false,
    metadata_only: true,
    request_is_intention_only: true,
    approval_decision_handled: false,
    lifecycle_state_advanced: false,
    approval_record_written: false,
  });
}

export function buildApprovalReviewSessionSnapshot(input: {
  readonly review_session_id: `review-session:${string}`;
  readonly inbox_item: unknown;
  readonly audit_preview: unknown;
  readonly decision_request_metadata?: unknown;
  readonly participant_ref_hash: `hash:${string}`;
  readonly opened_at_ms: number;
  readonly status?: ApprovalReviewSessionStatus;
}): ApprovalReviewSessionSnapshot {
  const inboxItem = ApprovalProposalInboxItemSchema.parse(input.inbox_item);
  const auditPreview = ApprovalAuditPreviewContractSchema.parse(
    input.audit_preview,
  );
  const decisionMetadata = input.decision_request_metadata
    ? ApprovalReviewDecisionMetadataSchema.parse(
        input.decision_request_metadata,
      )
    : null;

  if (
    input.decision_request_metadata &&
    !validateApprovalReviewDecisionMetadataShape(
      input.decision_request_metadata,
    ).valid
  ) {
    throw new Error("invalid_review_decision_metadata");
  }

  const status = ApprovalReviewSessionStatusSchema.parse(
    input.status ??
      (decisionMetadata ? "decision_requested" : "awaiting_review"),
  );

  return ApprovalReviewSessionSnapshotSchema.parse({
    contract_version: APPROVAL_REVIEW_SESSION_CONTRACT_VERSION,
    review_session_id: input.review_session_id,
    inbox_item_id: inboxItem.inbox_item_id,
    proposal_id: inboxItem.proposal_id,
    proposal_kind: inboxItem.proposal_kind,
    audit_preview_id: auditPreview.preview_id_hash,
    validation_summary: inboxItem.validation_summary,
    participant_metadata: [
      {
        participant_ref_hash: input.participant_ref_hash,
        participant_kind: "local_user_reviewer",
        actor_present_required: true,
        voice_only_participant: false,
        metadata_only: true,
        raw_participant_identifier_included: false,
      },
    ],
    evidence_metadata: {
      audit_preview_ref_hash: auditPreview.preview_id_hash,
      proposal_ref_hash: `hash:${inboxItem.proposal_id.replace(
        /^proposal:/,
        "proposal-",
      )}`,
      validation_result_refs: auditPreview.validation_results.results.map(
        (result, index) => `hash:${result.guard_id}-${index}`,
      ),
      redacted_reference_hashes: [
        auditPreview.replay_status.deterministic_replay_key_hash,
        auditPreview.replay_status.source_event_hash,
      ],
      status_summary:
        auditPreview.validation_results.failed_count > 0
          ? "validation_failed"
          : "validation_passed",
      risk_label: inboxItem.risk_class,
      metadata_only: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
    },
    decision_request_metadata: decisionRequestMetadata(decisionMetadata),
    status,
    status_display_only: true,
    status_is_lifecycle_stage: false,
    opened_at_metadata: {
      opened_at_ms: input.opened_at_ms,
      source_clock_trusted: false,
      metadata_only: true,
    },
    expires_at_metadata: {
      expires_at_ms: input.opened_at_ms + 300_000,
      expiry_display_only: true,
      lifecycle_expiry_decision: false,
      timers_registered: false,
      scheduler_registered: false,
      metadata_only: true,
    },
    disabled_authority: {
      lifecycle_advancement_enabled: false,
      approval_record_write_enabled: false,
      execution_enabled: false,
      authority_grant_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      dispatch_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      event_store_writes_enabled: false,
      telemetry_writes_enabled: false,
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
    redaction_status: inboxItem.redaction_status,
    replay: inboxItem.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    ui_rendered: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
  });
}
