import { z } from "zod";

import {
  ApprovalProposalInboxItemSchema,
  ApprovalProposalInboxStatusSchema,
} from "./proposal-inbox";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_REVIEW_DECISION_CONTRACT_VERSION = "18B.2" as const;

export const APPROVAL_REVIEW_DECISION_REQUESTS = [
  "approve_requested",
  "deny_requested",
  "dismiss_requested",
  "expire_requested",
  "request_changes",
] as const;

export const APPROVAL_REVIEW_CHANNELS = [
  "ui_click",
  "keyboard",
  "typed_confirmation",
] as const;

export const APPROVAL_REVIEW_FORBIDDEN_CHANNELS = ["voice_only"] as const;

export const APPROVAL_REVIEW_REASON_KINDS = [
  "user_intent_metadata",
  "needs_changes_metadata",
  "dismissal_metadata",
  "expiry_metadata",
] as const;

export const APPROVAL_REVIEW_DECISION_VALIDATION_REASONS = [
  "valid_review_decision_metadata",
  "invalid_review_decision_metadata",
  "voice_only_channel_forbidden",
] as const;

export type ApprovalReviewDecisionRequest =
  (typeof APPROVAL_REVIEW_DECISION_REQUESTS)[number];
export type ApprovalReviewChannel = (typeof APPROVAL_REVIEW_CHANNELS)[number];
export type ApprovalReviewForbiddenChannel =
  (typeof APPROVAL_REVIEW_FORBIDDEN_CHANNELS)[number];
export type ApprovalReviewReasonKind =
  (typeof APPROVAL_REVIEW_REASON_KINDS)[number];
export type ApprovalReviewDecisionValidationReason =
  (typeof APPROVAL_REVIEW_DECISION_VALIDATION_REASONS)[number];

export const ApprovalReviewDecisionRequestSchema = z.enum(
  APPROVAL_REVIEW_DECISION_REQUESTS,
);
export const ApprovalReviewChannelSchema = z.enum(APPROVAL_REVIEW_CHANNELS);
export const ApprovalReviewForbiddenChannelSchema = z.enum(
  APPROVAL_REVIEW_FORBIDDEN_CHANNELS,
);
export const ApprovalReviewReasonKindSchema = z.enum(
  APPROVAL_REVIEW_REASON_KINDS,
);
export const ApprovalReviewDecisionValidationReasonSchema = z.enum(
  APPROVAL_REVIEW_DECISION_VALIDATION_REASONS,
);

export const ApprovalReviewActorMetadataSchema = z.strictObject({
  actor_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  actor_kind: z.enum(["local_user"]),
  actor_present_required: z.literal(true),
  actor_identity_verified: z.literal(false),
  metadata_only: z.literal(true),
  raw_actor_identifier_included: z.literal(false),
});

export const ApprovalReviewChannelMetadataSchema = z.strictObject({
  channel: ApprovalReviewChannelSchema,
  voice_only_channel: z.literal(false),
  voice_only_approval_allowed: z.literal(false),
  ui_wiring_enabled: z.literal(false),
  api_route_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalReviewReasonMetadataSchema = z.strictObject({
  reason_kind: ApprovalReviewReasonKindSchema,
  reason_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  raw_reason_included: z.literal(false),
  prompt_included: z.literal(false),
  model_output_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalReviewDecisionDisabledAuthorityFlagsSchema =
  z.strictObject({
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
  });

export const ApprovalReviewDecisionMetadataSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_REVIEW_DECISION_CONTRACT_VERSION),
  review_decision_id: z
    .string()
    .trim()
    .regex(/^review:[a-z0-9._:-]+$/),
  inbox_item_id: z
    .string()
    .trim()
    .regex(/^inbox:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  inbox_status: ApprovalProposalInboxStatusSchema,
  decision_request: ApprovalReviewDecisionRequestSchema,
  request_is_intention_only: z.literal(true),
  performs_lifecycle_transition: z.literal(false),
  writes_approval_record: z.literal(false),
  actor: ApprovalReviewActorMetadataSchema,
  channel: ApprovalReviewChannelMetadataSchema,
  reason: ApprovalReviewReasonMetadataSchema,
  disabled_authority: ApprovalReviewDecisionDisabledAuthorityFlagsSchema,
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
});

export const ApprovalReviewDecisionShapeValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: ApprovalReviewDecisionValidationReasonSchema,
  metadata_only: z.literal(true),
  shape_validation_only: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  lifecycle_advanced: z.literal(false),
  authority_granted: z.literal(false),
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
});

export type ApprovalReviewActorMetadata = z.infer<
  typeof ApprovalReviewActorMetadataSchema
>;
export type ApprovalReviewChannelMetadata = z.infer<
  typeof ApprovalReviewChannelMetadataSchema
>;
export type ApprovalReviewReasonMetadata = z.infer<
  typeof ApprovalReviewReasonMetadataSchema
>;
export type ApprovalReviewDecisionDisabledAuthorityFlags = z.infer<
  typeof ApprovalReviewDecisionDisabledAuthorityFlagsSchema
>;
export type ApprovalReviewDecisionMetadata = z.infer<
  typeof ApprovalReviewDecisionMetadataSchema
>;
export type ApprovalReviewDecisionShapeValidation = z.infer<
  typeof ApprovalReviewDecisionShapeValidationSchema
>;

function shapeValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalReviewDecisionValidationReason;
}): ApprovalReviewDecisionShapeValidation {
  return ApprovalReviewDecisionShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
    authority_granted: false,
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
  });
}

export function buildApprovalReviewDecisionMetadata(input: {
  readonly review_decision_id: `review:${string}`;
  readonly inbox_item: unknown;
  readonly decision_request: ApprovalReviewDecisionRequest;
  readonly channel: ApprovalReviewChannel;
  readonly actor_ref_hash: `hash:${string}`;
  readonly reason_ref_hash: `hash:${string}`;
  readonly reason_kind: ApprovalReviewReasonKind;
}): ApprovalReviewDecisionMetadata {
  const inboxItem = ApprovalProposalInboxItemSchema.parse(input.inbox_item);

  return ApprovalReviewDecisionMetadataSchema.parse({
    contract_version: APPROVAL_REVIEW_DECISION_CONTRACT_VERSION,
    review_decision_id: input.review_decision_id,
    inbox_item_id: inboxItem.inbox_item_id,
    proposal_id: inboxItem.proposal_id,
    inbox_status: inboxItem.status,
    decision_request: input.decision_request,
    request_is_intention_only: true,
    performs_lifecycle_transition: false,
    writes_approval_record: false,
    actor: {
      actor_ref_hash: input.actor_ref_hash,
      actor_kind: "local_user",
      actor_present_required: true,
      actor_identity_verified: false,
      metadata_only: true,
      raw_actor_identifier_included: false,
    },
    channel: {
      channel: input.channel,
      voice_only_channel: false,
      voice_only_approval_allowed: false,
      ui_wiring_enabled: false,
      api_route_enabled: false,
      metadata_only: true,
    },
    reason: {
      reason_kind: input.reason_kind,
      reason_ref_hash: input.reason_ref_hash,
      raw_reason_included: false,
      prompt_included: false,
      model_output_included: false,
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
    replay: inboxItem.replay,
    redaction: inboxItem.redaction_status,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
  });
}

export function validateApprovalReviewDecisionMetadataShape(
  input: unknown,
): ApprovalReviewDecisionShapeValidation {
  const channelValue =
    input && typeof input === "object" && "channel" in input
      ? (input as { readonly channel?: unknown }).channel
      : null;

  if (
    channelValue === "voice_only" ||
    (channelValue &&
      typeof channelValue === "object" &&
      (channelValue as { readonly channel?: unknown }).channel === "voice_only")
  ) {
    return shapeValidation({
      valid: false,
      reason: "voice_only_channel_forbidden",
    });
  }

  const parsed = ApprovalReviewDecisionMetadataSchema.safeParse(input);
  return shapeValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_review_decision_metadata"
      : "invalid_review_decision_metadata",
  });
}
