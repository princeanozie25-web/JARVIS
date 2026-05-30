import { z } from "zod";

import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import { ApprovalReviewSessionSnapshotSchema } from "./review-session";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_DECISION_RECORD_CONTRACT_VERSION = "18D.1" as const;

export const APPROVAL_DECISION_RECORD_OUTCOMES = [
  "approved_recorded",
  "denied_recorded",
  "expired_recorded",
  "dismissed_recorded",
  "changes_requested_recorded",
] as const;

export const APPROVAL_DECISION_RECORD_CHANNELS = [
  "ui_click",
  "keyboard",
  "typed_confirmation",
] as const;

export const APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS = [
  "voice_only",
  "auto_approval",
  "scheduler_decision",
  "background_decision",
  "network_decision",
] as const;

export const APPROVAL_DECISION_RECORD_REASON_KINDS = [
  "user_intent_metadata",
  "needs_changes_metadata",
  "dismissal_metadata",
  "expiry_metadata",
] as const;

export const APPROVAL_DECISION_RECORD_VALIDATION_REASONS = [
  "valid_decision_record_metadata",
  "invalid_decision_record_metadata",
  "forbidden_decision_channel",
  "unknown_proposal_kind",
] as const;

export type ApprovalDecisionRecordOutcome =
  (typeof APPROVAL_DECISION_RECORD_OUTCOMES)[number];
export type ApprovalDecisionRecordChannel =
  (typeof APPROVAL_DECISION_RECORD_CHANNELS)[number];
export type ApprovalDecisionRecordForbiddenChannel =
  (typeof APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS)[number];
export type ApprovalDecisionRecordReasonKind =
  (typeof APPROVAL_DECISION_RECORD_REASON_KINDS)[number];
export type ApprovalDecisionRecordValidationReason =
  (typeof APPROVAL_DECISION_RECORD_VALIDATION_REASONS)[number];

export const ApprovalDecisionRecordOutcomeSchema = z.enum(
  APPROVAL_DECISION_RECORD_OUTCOMES,
);
export const ApprovalDecisionRecordChannelSchema = z.enum(
  APPROVAL_DECISION_RECORD_CHANNELS,
);
export const ApprovalDecisionRecordForbiddenChannelSchema = z.enum(
  APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
);
export const ApprovalDecisionRecordReasonKindSchema = z.enum(
  APPROVAL_DECISION_RECORD_REASON_KINDS,
);
export const ApprovalDecisionRecordValidationReasonSchema = z.enum(
  APPROVAL_DECISION_RECORD_VALIDATION_REASONS,
);

export const ApprovalDecisionRecordActorMetadataSchema = z.strictObject({
  actor_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  actor_kind: z.enum(["local_user_reviewer"]),
  actor_present_required: z.literal(true),
  actor_identity_verified: z.literal(false),
  voice_only_actor: z.literal(false),
  metadata_only: z.literal(true),
  raw_actor_identifier_included: z.literal(false),
});

export const ApprovalDecisionRecordChannelMetadataSchema = z.strictObject({
  channel: ApprovalDecisionRecordChannelSchema,
  voice_only_channel: z.literal(false),
  auto_approval_channel: z.literal(false),
  scheduler_decision_channel: z.literal(false),
  background_decision_channel: z.literal(false),
  network_decision_channel: z.literal(false),
  ui_wiring_enabled: z.literal(false),
  api_route_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalDecisionRecordReasonMetadataSchema = z.strictObject({
  reason_kind: ApprovalDecisionRecordReasonKindSchema,
  reason_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  raw_reason_included: z.literal(false),
  prompt_included: z.literal(false),
  model_output_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalDecisionRecordProvenanceMetadataSchema = z.strictObject({
  proposal_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  review_session_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  review_decision_request_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .nullable(),
  audit_preview_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  source_contracts: z.array(z.string().trim().min(1).max(24)),
  record_shape_only: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  lifecycle_state_advanced: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalDecisionRecordDisabledAuthorityFlagsSchema =
  z.strictObject({
    lifecycle_advancement_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    token_issue_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    approve_deny_handler_enabled: z.literal(false),
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
    voice_only_approval_enabled: z.literal(false),
    auto_approval_enabled: z.literal(false),
  });

export const ApprovalDecisionRecordMetadataSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_DECISION_RECORD_CONTRACT_VERSION),
  decision_record_id: z
    .string()
    .trim()
    .regex(/^decision-record:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  review_session_id: z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/),
  proposal_kind: ApprovalProposalRegistryKindSchema,
  outcome: ApprovalDecisionRecordOutcomeSchema,
  outcome_is_record_metadata_only: z.literal(true),
  performs_lifecycle_transition: z.literal(false),
  creates_approval: z.literal(false),
  handles_approval_decision: z.literal(false),
  actor_metadata: ApprovalDecisionRecordActorMetadataSchema,
  channel_metadata: ApprovalDecisionRecordChannelMetadataSchema,
  reason_metadata: ApprovalDecisionRecordReasonMetadataSchema,
  provenance_metadata: ApprovalDecisionRecordProvenanceMetadataSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_authority_flags: ApprovalDecisionRecordDisabledAuthorityFlagsSchema,
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_rendered: z.literal(false),
  api_route_called: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ApprovalDecisionRecordContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_DECISION_RECORD_CONTRACT_VERSION),
  contract_id: z.literal("approval_decision_record_contract"),
  phase: z.literal(18),
  slice: z.literal("18D.1"),
  metadata_only: z.literal(true),
  record_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  outcomes: z.array(ApprovalDecisionRecordOutcomeSchema),
  allowed_channels: z.array(ApprovalDecisionRecordChannelSchema),
  forbidden_channels: z.array(ApprovalDecisionRecordForbiddenChannelSchema),
  disabled_authority_flags: ApprovalDecisionRecordDisabledAuthorityFlagsSchema,
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  approve_deny_handlers_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
  voice_only_approval_supported: z.literal(false),
  auto_approval_supported: z.literal(false),
});

export const ApprovalDecisionRecordShapeValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: ApprovalDecisionRecordValidationReasonSchema,
  metadata_only: z.literal(true),
  shape_validation_only: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  lifecycle_advanced: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
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

export type ApprovalDecisionRecordActorMetadata = z.infer<
  typeof ApprovalDecisionRecordActorMetadataSchema
>;
export type ApprovalDecisionRecordChannelMetadata = z.infer<
  typeof ApprovalDecisionRecordChannelMetadataSchema
>;
export type ApprovalDecisionRecordReasonMetadata = z.infer<
  typeof ApprovalDecisionRecordReasonMetadataSchema
>;
export type ApprovalDecisionRecordProvenanceMetadata = z.infer<
  typeof ApprovalDecisionRecordProvenanceMetadataSchema
>;
export type ApprovalDecisionRecordDisabledAuthorityFlags = z.infer<
  typeof ApprovalDecisionRecordDisabledAuthorityFlagsSchema
>;
export type ApprovalDecisionRecordMetadata = z.infer<
  typeof ApprovalDecisionRecordMetadataSchema
>;
export type ApprovalDecisionRecordContract = z.infer<
  typeof ApprovalDecisionRecordContractSchema
>;
export type ApprovalDecisionRecordShapeValidation = z.infer<
  typeof ApprovalDecisionRecordShapeValidationSchema
>;

const DISABLED_DECISION_RECORD_AUTHORITY_FLAGS =
  ApprovalDecisionRecordDisabledAuthorityFlagsSchema.parse({
    lifecycle_advancement_enabled: false,
    authority_grant_enabled: false,
    execution_enabled: false,
    dispatch_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    token_issue_enabled: false,
    persistence_enabled: false,
    telemetry_write_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    approve_deny_handler_enabled: false,
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
    voice_only_approval_enabled: false,
    auto_approval_enabled: false,
  });

export const DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT =
  ApprovalDecisionRecordContractSchema.parse({
    contract_version: APPROVAL_DECISION_RECORD_CONTRACT_VERSION,
    contract_id: "approval_decision_record_contract",
    phase: 18,
    slice: "18D.1",
    metadata_only: true,
    record_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    replay_safe: true,
    redaction_safe: true,
    outcomes: APPROVAL_DECISION_RECORD_OUTCOMES,
    allowed_channels: APPROVAL_DECISION_RECORD_CHANNELS,
    forbidden_channels: APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
    disabled_authority_flags: DISABLED_DECISION_RECORD_AUTHORITY_FLAGS,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    approve_deny_handlers_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    network_cloud_calls_supported: false,
    voice_only_approval_supported: false,
    auto_approval_supported: false,
  });

function decisionValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalDecisionRecordValidationReason;
}): ApprovalDecisionRecordShapeValidation {
  return ApprovalDecisionRecordShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
    authority_granted: false,
    token_issued: false,
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

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

function channelValue(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return null;
  }

  if ("channel" in input) {
    return (input as { readonly channel?: unknown }).channel;
  }

  if ("channel_metadata" in input) {
    const metadata = (input as { readonly channel_metadata?: unknown })
      .channel_metadata;
    if (metadata && typeof metadata === "object" && "channel" in metadata) {
      return (metadata as { readonly channel?: unknown }).channel;
    }
  }

  return null;
}

function proposalKindValue(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("proposal_kind" in input)) {
    return null;
  }

  return (input as { readonly proposal_kind?: unknown }).proposal_kind;
}

export function buildApprovalDecisionRecordMetadata(input: {
  readonly decision_record_id: `decision-record:${string}`;
  readonly review_session: unknown;
  readonly outcome: ApprovalDecisionRecordOutcome;
  readonly channel: ApprovalDecisionRecordChannel;
  readonly actor_ref_hash: `hash:${string}`;
  readonly reason_ref_hash: `hash:${string}`;
  readonly reason_kind: ApprovalDecisionRecordReasonKind;
}): ApprovalDecisionRecordMetadata {
  const reviewSession = ApprovalReviewSessionSnapshotSchema.parse(
    input.review_session,
  );
  const outcome = ApprovalDecisionRecordOutcomeSchema.parse(input.outcome);
  const channel = ApprovalDecisionRecordChannelSchema.parse(input.channel);

  return ApprovalDecisionRecordMetadataSchema.parse({
    contract_version: APPROVAL_DECISION_RECORD_CONTRACT_VERSION,
    decision_record_id: input.decision_record_id,
    proposal_id: reviewSession.proposal_id,
    review_session_id: reviewSession.review_session_id,
    proposal_kind: reviewSession.proposal_kind,
    outcome,
    outcome_is_record_metadata_only: true,
    performs_lifecycle_transition: false,
    creates_approval: false,
    handles_approval_decision: false,
    actor_metadata: {
      actor_ref_hash: input.actor_ref_hash,
      actor_kind: "local_user_reviewer",
      actor_present_required: true,
      actor_identity_verified: false,
      voice_only_actor: false,
      metadata_only: true,
      raw_actor_identifier_included: false,
    },
    channel_metadata: {
      channel,
      voice_only_channel: false,
      auto_approval_channel: false,
      scheduler_decision_channel: false,
      background_decision_channel: false,
      network_decision_channel: false,
      ui_wiring_enabled: false,
      api_route_enabled: false,
      metadata_only: true,
    },
    reason_metadata: {
      reason_kind: input.reason_kind,
      reason_ref_hash: input.reason_ref_hash,
      raw_reason_included: false,
      prompt_included: false,
      model_output_included: false,
      metadata_only: true,
    },
    provenance_metadata: {
      proposal_ref_hash: hashFromId(reviewSession.proposal_id, "proposal"),
      review_session_ref_hash: hashFromId(
        reviewSession.review_session_id,
        "review-session",
      ),
      review_decision_request_ref_hash:
        reviewSession.decision_request_metadata.decision_request_ref_hash,
      audit_preview_ref_hash: reviewSession.audit_preview_id,
      source_contracts: [
        "18A.1",
        "18B.1",
        "18B.2",
        "18B.3",
        "18C.1",
        "18C.2",
        "18C.3",
        "18C.4",
      ],
      record_shape_only: true,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_state_advanced: false,
      authority_granted: false,
      token_issued: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      metadata_only: true,
    },
    redaction_status: reviewSession.redaction_status,
    replay: reviewSession.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_authority_flags: DISABLED_DECISION_RECORD_AUTHORITY_FLAGS,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_rendered: false,
    api_route_called: false,
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

export function validateApprovalDecisionRecordMetadataShape(
  input: unknown,
): ApprovalDecisionRecordShapeValidation {
  const channel = channelValue(input);
  if (ApprovalDecisionRecordForbiddenChannelSchema.safeParse(channel).success) {
    return decisionValidation({
      valid: false,
      reason: "forbidden_decision_channel",
    });
  }

  const proposalKind = proposalKindValue(input);
  if (
    proposalKind !== null &&
    !ApprovalProposalRegistryKindSchema.safeParse(proposalKind).success
  ) {
    return decisionValidation({
      valid: false,
      reason: "unknown_proposal_kind",
    });
  }

  const parsed = ApprovalDecisionRecordMetadataSchema.safeParse(input);
  return decisionValidation({
    valid: parsed.success,
    reason: parsed.success
      ? "valid_decision_record_metadata"
      : "invalid_decision_record_metadata",
  });
}
