import { z } from "zod";

import {
  ApprovalProposalRegistryKindSchema,
  ApprovalProposalTargetKindSchema,
} from "./proposal-registry";
import { ApprovalReviewSessionSnapshotSchema } from "./review-session";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION =
  "18C.1" as const;

export const APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES = [
  "unavailable",
  "reserved",
  "expired",
  "revoked",
  "invalid",
] as const;

export const APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES = [
  "usable",
  "active",
  "granted",
  "executable",
] as const;

export const APPROVAL_EXECUTION_AUTHORITY_TOKEN_VALIDATION_REASONS = [
  "valid_token_metadata",
  "invalid_token_metadata",
  "forbidden_token_status",
] as const;

export type ApprovalExecutionAuthorityTokenStatus =
  (typeof APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES)[number];
export type ApprovalExecutionAuthorityTokenForbiddenStatus =
  (typeof APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES)[number];
export type ApprovalExecutionAuthorityTokenValidationReason =
  (typeof APPROVAL_EXECUTION_AUTHORITY_TOKEN_VALIDATION_REASONS)[number];

export const ApprovalExecutionAuthorityTokenStatusSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES,
);
export const ApprovalExecutionAuthorityTokenForbiddenStatusSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES,
);
export const ApprovalExecutionAuthorityTokenValidationReasonSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_VALIDATION_REASONS,
);

export const ApprovalExecutionAuthorityTokenDisabledUseFlagsSchema =
  z.strictObject({
    authority_granted: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    tool_runtime_enabled: z.literal(false),
    room_action_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    usable_authority_enabled: z.literal(false),
    active_token_enabled: z.literal(false),
    token_signing_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    event_store_writes_enabled: z.literal(false),
    telemetry_writes_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    scheduler_triggered_action_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  });

export const ApprovalExecutionAuthorityTokenScopeMetadataSchema =
  z.strictObject({
    proposal_kind: ApprovalProposalRegistryKindSchema,
    target_class: ApprovalProposalTargetKindSchema,
    risk_class: ApprovalRiskClassSchema,
    single_action_only: z.literal(true),
    cross_session_valid: z.literal(false),
    multi_step_graph_allowed: z.literal(false),
    voice_grant_allowed: z.literal(false),
    auto_grant_allowed: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionAuthorityTokenExpiryMetadataSchema =
  z.strictObject({
    expires_at_ms: z.number().int().nonnegative(),
    expiry_display_only: z.literal(true),
    usable_after_expiry: z.literal(false),
    lifecycle_expiry_decision: z.literal(false),
    timers_registered: z.literal(false),
    scheduler_registered: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionAuthorityTokenProvenanceMetadataSchema =
  z.strictObject({
    proposal_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    review_session_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    audit_preview_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    decision_request_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/)
      .nullable(),
    source_contracts: z.array(z.string().trim().min(1).max(24)),
    token_signed: z.literal(false),
    secret_material_included: z.literal(false),
    metadata_only: z.literal(true),
  });

export const ApprovalExecutionAuthorityTokenMetadataSchema = z.strictObject({
  contract_version: z.literal(
    APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
  ),
  token_id: z
    .string()
    .trim()
    .regex(/^authority-token:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  review_session_id: z
    .string()
    .trim()
    .regex(/^review-session:[a-z0-9._:-]+$/),
  proposal_kind: ApprovalProposalRegistryKindSchema,
  status: ApprovalExecutionAuthorityTokenStatusSchema,
  status_is_usable: z.literal(false),
  status_is_authority_grant: z.literal(false),
  scope_metadata: ApprovalExecutionAuthorityTokenScopeMetadataSchema,
  expiry_metadata: ApprovalExecutionAuthorityTokenExpiryMetadataSchema,
  provenance_metadata: ApprovalExecutionAuthorityTokenProvenanceMetadataSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  disabled_use_flags: ApprovalExecutionAuthorityTokenDisabledUseFlagsSchema,
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ApprovalExecutionAuthorityTokenContractSchema = z.strictObject({
  contract_version: z.literal(
    APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
  ),
  contract_id: z.literal("approval_execution_authority_token_contract"),
  phase: z.literal(18),
  slice: z.literal("18C.1"),
  metadata_only: z.literal(true),
  authority_token_shape_only: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  token_statuses: z.array(ApprovalExecutionAuthorityTokenStatusSchema),
  forbidden_statuses: z.array(
    ApprovalExecutionAuthorityTokenForbiddenStatusSchema,
  ),
  disabled_use_flags: ApprovalExecutionAuthorityTokenDisabledUseFlagsSchema,
  usable_authority_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  token_signing_supported: z.literal(false),
  secret_material_supported: z.literal(false),
});

export const ApprovalExecutionAuthorityTokenShapeValidationSchema =
  z.strictObject({
    valid: z.boolean(),
    reason: ApprovalExecutionAuthorityTokenValidationReasonSchema,
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    authority_granted: z.literal(false),
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    lifecycle_advanced: z.literal(false),
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
    token_signed: z.literal(false),
    secret_material_included: z.literal(false),
  });

export type ApprovalExecutionAuthorityTokenDisabledUseFlags = z.infer<
  typeof ApprovalExecutionAuthorityTokenDisabledUseFlagsSchema
>;
export type ApprovalExecutionAuthorityTokenScopeMetadata = z.infer<
  typeof ApprovalExecutionAuthorityTokenScopeMetadataSchema
>;
export type ApprovalExecutionAuthorityTokenExpiryMetadata = z.infer<
  typeof ApprovalExecutionAuthorityTokenExpiryMetadataSchema
>;
export type ApprovalExecutionAuthorityTokenProvenanceMetadata = z.infer<
  typeof ApprovalExecutionAuthorityTokenProvenanceMetadataSchema
>;
export type ApprovalExecutionAuthorityTokenMetadata = z.infer<
  typeof ApprovalExecutionAuthorityTokenMetadataSchema
>;
export type ApprovalExecutionAuthorityTokenContract = z.infer<
  typeof ApprovalExecutionAuthorityTokenContractSchema
>;
export type ApprovalExecutionAuthorityTokenShapeValidation = z.infer<
  typeof ApprovalExecutionAuthorityTokenShapeValidationSchema
>;

const DISABLED_USE_FLAGS: ApprovalExecutionAuthorityTokenDisabledUseFlags =
  ApprovalExecutionAuthorityTokenDisabledUseFlagsSchema.parse({
    authority_granted: false,
    execution_enabled: false,
    dispatch_enabled: false,
    tool_runtime_enabled: false,
    room_action_enabled: false,
    project_mutation_enabled: false,
    obsidian_write_enabled: false,
    memory_write_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    lifecycle_advancement_enabled: false,
    usable_authority_enabled: false,
    active_token_enabled: false,
    token_signing_enabled: false,
    persistence_enabled: false,
    event_store_writes_enabled: false,
    telemetry_writes_enabled: false,
    ui_rendering_enabled: false,
    api_route_enabled: false,
    scheduler_triggered_action_enabled: false,
    network_cloud_calls_enabled: false,
  });

export const DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT =
  ApprovalExecutionAuthorityTokenContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    contract_id: "approval_execution_authority_token_contract",
    phase: 18,
    slice: "18C.1",
    metadata_only: true,
    authority_token_shape_only: true,
    non_authoritative: true,
    non_executing: true,
    replay_safe: true,
    redaction_safe: true,
    token_statuses: APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES,
    forbidden_statuses: APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES,
    disabled_use_flags: DISABLED_USE_FLAGS,
    usable_authority_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    token_signing_supported: false,
    secret_material_supported: false,
  });

function tokenValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalExecutionAuthorityTokenValidationReason;
}): ApprovalExecutionAuthorityTokenShapeValidation {
  return ApprovalExecutionAuthorityTokenShapeValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    shape_validation_only: true,
    authority_granted: false,
    approval_created: false,
    approval_decision_handled: false,
    lifecycle_advanced: false,
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
    token_signed: false,
    secret_material_included: false,
  });
}

function hashFromId(id: string, prefix: string): `hash:${string}` {
  return `hash:${id.replace(new RegExp(`^${prefix}:`), `${prefix}-`)}`;
}

export function buildApprovalAuthorityTokenMetadata(input: {
  readonly token_id: `authority-token:${string}`;
  readonly review_session: unknown;
  readonly target_class: z.infer<typeof ApprovalProposalTargetKindSchema>;
  readonly expires_at_ms?: number;
  readonly status?: ApprovalExecutionAuthorityTokenStatus;
}): ApprovalExecutionAuthorityTokenMetadata {
  const reviewSession = ApprovalReviewSessionSnapshotSchema.parse(
    input.review_session,
  );
  const targetClass = ApprovalProposalTargetKindSchema.parse(
    input.target_class,
  );
  const status = ApprovalExecutionAuthorityTokenStatusSchema.parse(
    input.status ?? "reserved",
  );

  return ApprovalExecutionAuthorityTokenMetadataSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    token_id: input.token_id,
    proposal_id: reviewSession.proposal_id,
    review_session_id: reviewSession.review_session_id,
    proposal_kind: reviewSession.proposal_kind,
    status,
    status_is_usable: false,
    status_is_authority_grant: false,
    scope_metadata: {
      proposal_kind: reviewSession.proposal_kind,
      target_class: targetClass,
      risk_class: reviewSession.evidence_metadata.risk_label,
      single_action_only: true,
      cross_session_valid: false,
      multi_step_graph_allowed: false,
      voice_grant_allowed: false,
      auto_grant_allowed: false,
      metadata_only: true,
    },
    expiry_metadata: {
      expires_at_ms:
        input.expires_at_ms ?? reviewSession.expires_at_metadata.expires_at_ms,
      expiry_display_only: true,
      usable_after_expiry: false,
      lifecycle_expiry_decision: false,
      timers_registered: false,
      scheduler_registered: false,
      metadata_only: true,
    },
    provenance_metadata: {
      proposal_ref_hash: hashFromId(reviewSession.proposal_id, "proposal"),
      review_session_ref_hash: hashFromId(
        reviewSession.review_session_id,
        "review-session",
      ),
      audit_preview_ref_hash: reviewSession.audit_preview_id,
      decision_request_ref_hash:
        reviewSession.decision_request_metadata.decision_request_ref_hash,
      source_contracts: [
        "18A.1",
        "18A.2",
        "18A.3",
        "18A.4",
        "18A.5",
        "18B.1",
        "18B.2",
        "18B.3",
        "18B.4",
      ],
      token_signed: false,
      secret_material_included: false,
      metadata_only: true,
    },
    redaction_status: reviewSession.redaction_status,
    replay: reviewSession.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    disabled_use_flags: DISABLED_USE_FLAGS,
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

export function validateApprovalAuthorityTokenMetadataShape(
  input: unknown,
): ApprovalExecutionAuthorityTokenShapeValidation {
  const statusValue =
    input && typeof input === "object" && "status" in input
      ? (input as { readonly status?: unknown }).status
      : null;

  if (
    ApprovalExecutionAuthorityTokenForbiddenStatusSchema.safeParse(statusValue)
      .success
  ) {
    return tokenValidation({
      valid: false,
      reason: "forbidden_token_status",
    });
  }

  const parsed = ApprovalExecutionAuthorityTokenMetadataSchema.safeParse(input);
  return tokenValidation({
    valid: parsed.success,
    reason: parsed.success ? "valid_token_metadata" : "invalid_token_metadata",
  });
}
