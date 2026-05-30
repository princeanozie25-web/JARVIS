import { z } from "zod";

import {
  APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
  ApprovalDecisionRecordChannelSchema,
  ApprovalDecisionRecordForbiddenChannelSchema,
  ApprovalDecisionRecordMetadataSchema,
  ApprovalDecisionRecordOutcomeSchema,
} from "./approval-decision-record";
import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import { ApprovalRedactionStatusSchema } from "./types";

export const APPROVAL_DECISION_VALIDATION_CONTRACT_VERSION = "18D.2" as const;

export const APPROVAL_DECISION_VALIDATION_GUARD_IDS = [
  "known_proposal_kind_only",
  "known_inert_decision_outcome_only",
  "allowed_decision_channel_only",
  "voice_only_channel_rejected",
  "auto_approval_channel_rejected",
  "scheduler_decision_channel_rejected",
  "background_decision_channel_rejected",
  "network_decision_channel_rejected",
  "lifecycle_advancement_disabled",
  "authority_grant_disabled",
  "token_issue_disabled",
  "execution_disabled",
  "dispatch_disabled",
  "verification_disabled",
  "compensation_disabled",
  "rollback_disabled",
  "persistence_disabled",
  "telemetry_write_disabled",
  "record_replay_safe",
  "record_redaction_safe",
  "raw_payloads_and_secrets_excluded",
] as const;

export const APPROVAL_DECISION_VALIDATION_GUARD_SEVERITIES = [
  "info",
  "warning",
  "error",
] as const;

export const APPROVAL_DECISION_VALIDATION_REASON_CODES = [
  "passed",
  "unknown_proposal_kind",
  "unknown_decision_outcome",
  "disallowed_decision_channel",
  "forbidden_voice_only_channel",
  "forbidden_auto_approval_channel",
  "forbidden_scheduler_decision_channel",
  "forbidden_background_decision_channel",
  "forbidden_network_decision_channel",
  "lifecycle_advancement_enabled",
  "authority_grant_enabled",
  "token_issue_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "verification_enabled",
  "compensation_enabled",
  "rollback_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "record_not_replay_safe",
  "record_not_redaction_safe",
  "raw_payload_or_secret_present",
  "invalid_decision_record_shape",
] as const;

export type ApprovalDecisionValidationGuardId =
  (typeof APPROVAL_DECISION_VALIDATION_GUARD_IDS)[number];
export type ApprovalDecisionValidationGuardSeverity =
  (typeof APPROVAL_DECISION_VALIDATION_GUARD_SEVERITIES)[number];
export type ApprovalDecisionValidationReasonCode =
  (typeof APPROVAL_DECISION_VALIDATION_REASON_CODES)[number];

export const ApprovalDecisionValidationGuardIdSchema = z.enum(
  APPROVAL_DECISION_VALIDATION_GUARD_IDS,
);
export const ApprovalDecisionValidationGuardSeveritySchema = z.enum(
  APPROVAL_DECISION_VALIDATION_GUARD_SEVERITIES,
);
export const ApprovalDecisionValidationReasonCodeSchema = z.enum(
  APPROVAL_DECISION_VALIDATION_REASON_CODES,
);

export const ApprovalDecisionValidationGuardDeclarationSchema = z.strictObject({
  guard_id: ApprovalDecisionValidationGuardIdSchema,
  applies_to: z.literal("approval_decision_record"),
  severity: ApprovalDecisionValidationGuardSeveritySchema,
  failure_reason_code: ApprovalDecisionValidationReasonCodeSchema,
  metadata_only: z.literal(true),
  audit_preview_safe: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  grants_authority: z.literal(false),
  advances_lifecycle_state: z.literal(false),
  handles_approval_decision: z.literal(false),
  issues_token: z.literal(false),
  executes_action: z.literal(false),
  writes_persistence: z.literal(false),
});

export const ApprovalDecisionValidationGuardResultSchema = z.strictObject({
  guard_id: ApprovalDecisionValidationGuardIdSchema,
  passed: z.boolean(),
  severity: ApprovalDecisionValidationGuardSeveritySchema,
  reason_code: ApprovalDecisionValidationReasonCodeSchema,
  redaction_status: ApprovalRedactionStatusSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  checked_at_source: z.literal("approval_decision_validation_matrix"),
  metadata_only: z.literal(true),
  audit_preview_safe: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
  approval_created: z.literal(false),
  approval_decision_handled: z.literal(false),
  authority_granted: z.literal(false),
  token_issued: z.literal(false),
  dispatch_performed: z.literal(false),
  lifecycle_state_advanced: z.literal(false),
  action_executed: z.literal(false),
  verification_performed: z.literal(false),
  compensation_performed: z.literal(false),
  rollback_performed: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  ui_wired: z.literal(false),
  api_route_called: z.literal(false),
  tool_runtime_wired: z.literal(false),
  room_adapter_wired: z.literal(false),
  project_mutated: z.literal(false),
  obsidian_written: z.literal(false),
  memory_written: z.literal(false),
  scheduler_triggered: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const ApprovalDecisionValidationPolicyMatrixSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_DECISION_VALIDATION_CONTRACT_VERSION),
  matrix_id: z.literal("approval_decision_validation_matrix"),
  phase: z.literal(18),
  slice: z.literal("18D.2"),
  metadata_only: z.literal(true),
  guard_matrix_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  non_authoritative: z.literal(true),
  non_executing: z.literal(true),
  decision_guards: z.array(ApprovalDecisionValidationGuardDeclarationSchema),
  forbidden_channel_refs: z.array(ApprovalDecisionRecordForbiddenChannelSchema),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
});

export type ApprovalDecisionValidationGuardDeclaration = z.infer<
  typeof ApprovalDecisionValidationGuardDeclarationSchema
>;
export type ApprovalDecisionValidationGuardResult = z.infer<
  typeof ApprovalDecisionValidationGuardResultSchema
>;
export type ApprovalDecisionValidationPolicyMatrix = z.infer<
  typeof ApprovalDecisionValidationPolicyMatrixSchema
>;

const GUARD_REASON_BY_ID = {
  known_proposal_kind_only: "unknown_proposal_kind",
  known_inert_decision_outcome_only: "unknown_decision_outcome",
  allowed_decision_channel_only: "disallowed_decision_channel",
  voice_only_channel_rejected: "forbidden_voice_only_channel",
  auto_approval_channel_rejected: "forbidden_auto_approval_channel",
  scheduler_decision_channel_rejected: "forbidden_scheduler_decision_channel",
  background_decision_channel_rejected: "forbidden_background_decision_channel",
  network_decision_channel_rejected: "forbidden_network_decision_channel",
  lifecycle_advancement_disabled: "lifecycle_advancement_enabled",
  authority_grant_disabled: "authority_grant_enabled",
  token_issue_disabled: "token_issue_enabled",
  execution_disabled: "execution_enabled",
  dispatch_disabled: "dispatch_enabled",
  verification_disabled: "verification_enabled",
  compensation_disabled: "compensation_enabled",
  rollback_disabled: "rollback_enabled",
  persistence_disabled: "persistence_enabled",
  telemetry_write_disabled: "telemetry_write_enabled",
  record_replay_safe: "record_not_replay_safe",
  record_redaction_safe: "record_not_redaction_safe",
  raw_payloads_and_secrets_excluded: "raw_payload_or_secret_present",
} as const satisfies Record<
  ApprovalDecisionValidationGuardId,
  ApprovalDecisionValidationReasonCode
>;

function guardDeclaration(
  guard_id: ApprovalDecisionValidationGuardId,
): ApprovalDecisionValidationGuardDeclaration {
  return ApprovalDecisionValidationGuardDeclarationSchema.parse({
    guard_id,
    applies_to: "approval_decision_record",
    severity: "error",
    failure_reason_code: GUARD_REASON_BY_ID[guard_id],
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    grants_authority: false,
    advances_lifecycle_state: false,
    handles_approval_decision: false,
    issues_token: false,
    executes_action: false,
    writes_persistence: false,
  });
}

export const DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX =
  ApprovalDecisionValidationPolicyMatrixSchema.parse({
    contract_version: APPROVAL_DECISION_VALIDATION_CONTRACT_VERSION,
    matrix_id: "approval_decision_validation_matrix",
    phase: 18,
    slice: "18D.2",
    metadata_only: true,
    guard_matrix_only: true,
    replay_safe: true,
    redaction_safe: true,
    non_authoritative: true,
    non_executing: true,
    decision_guards:
      APPROVAL_DECISION_VALIDATION_GUARD_IDS.map(guardDeclaration),
    forbidden_channel_refs: APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    telemetry_writes_supported: false,
  });

function guardResult(input: {
  readonly guard_id: ApprovalDecisionValidationGuardId;
  readonly passed: boolean;
  readonly reason_code?: ApprovalDecisionValidationReasonCode;
}): ApprovalDecisionValidationGuardResult {
  return ApprovalDecisionValidationGuardResultSchema.parse({
    guard_id: input.guard_id,
    passed: input.passed,
    severity: input.passed ? "info" : "error",
    reason_code:
      input.reason_code ??
      (input.passed ? "passed" : GUARD_REASON_BY_ID[input.guard_id]),
    redaction_status: "metadata_only",
    replay_safe: true,
    redaction_safe: true,
    checked_at_source: "approval_decision_validation_matrix",
    metadata_only: true,
    audit_preview_safe: true,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
    secret_material_included: false,
    approval_created: false,
    approval_decision_handled: false,
    authority_granted: false,
    token_issued: false,
    dispatch_performed: false,
    lifecycle_state_advanced: false,
    action_executed: false,
    verification_performed: false,
    compensation_performed: false,
    rollback_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_wired: false,
    api_route_called: false,
    tool_runtime_wired: false,
    room_adapter_wired: false,
    project_mutated: false,
    obsidian_written: false,
    memory_written: false,
    scheduler_triggered: false,
    network_called: false,
    cloud_called: false,
  });
}

function recordField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  return (input as Record<string, unknown>)[field];
}

function channelValue(input: unknown): unknown {
  const direct = recordField(input, "channel");
  if (direct !== undefined) {
    return direct;
  }

  const channelMetadata = recordField(input, "channel_metadata");
  if (
    channelMetadata &&
    typeof channelMetadata === "object" &&
    "channel" in channelMetadata
  ) {
    return (channelMetadata as { readonly channel?: unknown }).channel;
  }

  return undefined;
}

function disabledFlag(input: unknown, flag: string): unknown {
  const disabledFlags = recordField(input, "disabled_authority_flags");
  if (
    disabledFlags &&
    typeof disabledFlags === "object" &&
    flag in disabledFlags
  ) {
    return (disabledFlags as Record<string, unknown>)[flag];
  }

  return undefined;
}

function hasReplaySafeMetadata(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  const replay = recordField(input, "replay");
  return (
    recordField(input, "replay_safe") === true &&
    !!replay &&
    typeof replay === "object" &&
    (replay as { readonly replay_safe?: unknown }).replay_safe === true
  );
}

function hasRedactionSafeMetadata(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  const redaction = recordField(input, "redaction_status");
  return (
    recordField(input, "redaction_safe") === true &&
    !!redaction &&
    typeof redaction === "object" &&
    (redaction as { readonly redaction_safe?: unknown }).redaction_safe ===
      true &&
    (redaction as { readonly metadata_only?: unknown }).metadata_only === true
  );
}

const FORBIDDEN_RAW_KEYS = new Set([
  "raw_payload",
  "payload",
  "raw_body",
  "body",
  "tool_args",
  "tool_arguments",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
  "secret",
  "secrets",
]);

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

function excludesRawPayloadsAndSecrets(input: unknown): boolean {
  const keys = collectKeys(input);
  if (keys.some((key) => FORBIDDEN_RAW_KEYS.has(key))) {
    return false;
  }

  return (
    recordField(input, "raw_payload_included") === false &&
    recordField(input, "raw_tool_arguments_included") === false &&
    recordField(input, "raw_prompt_included") === false &&
    recordField(input, "raw_model_output_included") === false &&
    recordField(input, "raw_device_payload_included") === false &&
    recordField(input, "raw_project_content_included") === false &&
    recordField(input, "raw_memory_content_included") === false &&
    recordField(input, "secret_material_included") === false
  );
}

function forbiddenChannelPassed(
  input: unknown,
  forbiddenChannel: string,
): boolean {
  return channelValue(input) !== forbiddenChannel;
}

export function validateApprovalDecisionRecordPolicyMetadata(
  input: unknown,
): readonly ApprovalDecisionValidationGuardResult[] {
  const proposalKind = recordField(input, "proposal_kind");
  const outcome = recordField(input, "outcome");
  const channel = channelValue(input);
  const parsed = ApprovalDecisionRecordMetadataSchema.safeParse(input);

  return [
    guardResult({
      guard_id: "known_proposal_kind_only",
      passed:
        ApprovalProposalRegistryKindSchema.safeParse(proposalKind).success,
    }),
    guardResult({
      guard_id: "known_inert_decision_outcome_only",
      passed: ApprovalDecisionRecordOutcomeSchema.safeParse(outcome).success,
    }),
    guardResult({
      guard_id: "allowed_decision_channel_only",
      passed:
        ApprovalDecisionRecordChannelSchema.safeParse(channel).success &&
        !ApprovalDecisionRecordForbiddenChannelSchema.safeParse(channel)
          .success,
    }),
    guardResult({
      guard_id: "voice_only_channel_rejected",
      passed: forbiddenChannelPassed(input, "voice_only"),
    }),
    guardResult({
      guard_id: "auto_approval_channel_rejected",
      passed: forbiddenChannelPassed(input, "auto_approval"),
    }),
    guardResult({
      guard_id: "scheduler_decision_channel_rejected",
      passed: forbiddenChannelPassed(input, "scheduler_decision"),
    }),
    guardResult({
      guard_id: "background_decision_channel_rejected",
      passed: forbiddenChannelPassed(input, "background_decision"),
    }),
    guardResult({
      guard_id: "network_decision_channel_rejected",
      passed: forbiddenChannelPassed(input, "network_decision"),
    }),
    guardResult({
      guard_id: "lifecycle_advancement_disabled",
      passed: disabledFlag(input, "lifecycle_advancement_enabled") === false,
    }),
    guardResult({
      guard_id: "authority_grant_disabled",
      passed: disabledFlag(input, "authority_grant_enabled") === false,
    }),
    guardResult({
      guard_id: "token_issue_disabled",
      passed: disabledFlag(input, "token_issue_enabled") === false,
    }),
    guardResult({
      guard_id: "execution_disabled",
      passed: disabledFlag(input, "execution_enabled") === false,
    }),
    guardResult({
      guard_id: "dispatch_disabled",
      passed: disabledFlag(input, "dispatch_enabled") === false,
    }),
    guardResult({
      guard_id: "verification_disabled",
      passed: disabledFlag(input, "verification_enabled") === false,
    }),
    guardResult({
      guard_id: "compensation_disabled",
      passed: disabledFlag(input, "compensation_enabled") === false,
    }),
    guardResult({
      guard_id: "rollback_disabled",
      passed: disabledFlag(input, "rollback_enabled") === false,
    }),
    guardResult({
      guard_id: "persistence_disabled",
      passed:
        disabledFlag(input, "persistence_enabled") === false &&
        recordField(input, "persisted") === false,
    }),
    guardResult({
      guard_id: "telemetry_write_disabled",
      passed:
        disabledFlag(input, "telemetry_write_enabled") === false &&
        recordField(input, "telemetry_written") === false,
    }),
    guardResult({
      guard_id: "record_replay_safe",
      passed: hasReplaySafeMetadata(input),
    }),
    guardResult({
      guard_id: "record_redaction_safe",
      passed: hasRedactionSafeMetadata(input),
    }),
    guardResult({
      guard_id: "raw_payloads_and_secrets_excluded",
      passed: parsed.success && excludesRawPayloadsAndSecrets(input),
    }),
  ];
}
