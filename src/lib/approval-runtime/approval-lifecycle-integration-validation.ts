import { z } from "zod";

import {
  APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
  ApprovalLifecycleIntegrationForbiddenStatusSchema,
  ApprovalLifecycleIntegrationSnapshotSchema,
  ApprovalLifecycleIntegrationStatusSchema,
  type ApprovalLifecycleIntegrationSegment,
} from "./approval-lifecycle-integration";
import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import { ApprovalRedactionStatusSchema } from "./types";

export const APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION =
  "18H.2" as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS = [
  "all_required_lifecycle_segments_present",
  "known_inert_integrated_lifecycle_status_only",
  "operational_lifecycle_status_rejected",
  "known_proposal_kind_only",
  "integrated_lifecycle_replay_safe",
  "integrated_lifecycle_redaction_safe",
  "raw_payloads_forbidden",
  "secrets_forbidden",
  "raw_state_forbidden",
  "approval_creation_disabled",
  "approval_decision_handling_disabled",
  "authority_grant_disabled",
  "token_issue_disabled",
  "usable_token_disabled",
  "execution_disabled",
  "dispatch_disabled",
  "tool_runtime_disabled",
  "room_action_disabled",
  "project_mutation_disabled",
  "obsidian_write_disabled",
  "memory_write_disabled",
  "network_call_disabled",
  "real_state_read_disabled",
  "verification_disabled",
  "compensation_disabled",
  "rollback_disabled",
  "restore_disabled",
  "persistence_disabled",
  "telemetry_write_disabled",
] as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_SEVERITIES = [
  "info",
  "warning",
  "error",
] as const;

export const APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASON_CODES = [
  "passed",
  "missing_lifecycle_segment",
  "unknown_integrated_lifecycle_status",
  "operational_lifecycle_status",
  "unknown_proposal_kind",
  "integrated_lifecycle_not_replay_safe",
  "integrated_lifecycle_not_redaction_safe",
  "raw_payload_present",
  "secret_material_present",
  "raw_state_present",
  "approval_creation_enabled",
  "approval_decision_handling_enabled",
  "authority_grant_enabled",
  "token_issue_enabled",
  "usable_token_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "tool_runtime_enabled",
  "room_action_enabled",
  "project_mutation_enabled",
  "obsidian_write_enabled",
  "memory_write_enabled",
  "network_call_enabled",
  "real_state_read_enabled",
  "verification_enabled",
  "compensation_enabled",
  "rollback_enabled",
  "restore_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "invalid_integrated_lifecycle_shape",
] as const;

export type ApprovalLifecycleIntegrationValidationGuardId =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS)[number];
export type ApprovalLifecycleIntegrationValidationGuardSeverity =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_SEVERITIES)[number];
export type ApprovalLifecycleIntegrationValidationReasonCode =
  (typeof APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASON_CODES)[number];

export const ApprovalLifecycleIntegrationValidationGuardIdSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS,
);
export const ApprovalLifecycleIntegrationValidationGuardSeveritySchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_SEVERITIES,
);
export const ApprovalLifecycleIntegrationValidationReasonCodeSchema = z.enum(
  APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_REASON_CODES,
);

export const ApprovalLifecycleIntegrationValidationGuardDeclarationSchema =
  z.strictObject({
    guard_id: ApprovalLifecycleIntegrationValidationGuardIdSchema,
    applies_to: z.enum([
      "integrated_lifecycle_snapshot",
      "lifecycle_segment_metadata",
      "disabled_authority_flags",
    ]),
    severity: ApprovalLifecycleIntegrationValidationGuardSeveritySchema,
    failure_reason_code: ApprovalLifecycleIntegrationValidationReasonCodeSchema,
    metadata_only: z.literal(true),
    audit_preview_safe: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    creates_approval: z.literal(false),
    handles_approval_decision: z.literal(false),
    grants_authority: z.literal(false),
    issues_token: z.literal(false),
    issues_usable_token: z.literal(false),
    advances_lifecycle_state: z.literal(false),
    executes_action: z.literal(false),
    dispatches_tool: z.literal(false),
    reads_real_state: z.literal(false),
    performs_real_verification: z.literal(false),
    performs_real_compensation: z.literal(false),
    performs_rollback: z.literal(false),
    performs_restore: z.literal(false),
    writes_persistence: z.literal(false),
    wires_runtime: z.literal(false),
  });

export const ApprovalLifecycleIntegrationValidationGuardResultSchema =
  z.strictObject({
    guard_id: ApprovalLifecycleIntegrationValidationGuardIdSchema,
    passed: z.boolean(),
    severity: ApprovalLifecycleIntegrationValidationGuardSeveritySchema,
    reason_code: ApprovalLifecycleIntegrationValidationReasonCodeSchema,
    redaction_status: ApprovalRedactionStatusSchema,
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    checked_at_source: z.literal(
      "approval_lifecycle_integration_validation_matrix",
    ),
    metadata_only: z.literal(true),
    audit_preview_safe: z.literal(true),
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
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    authority_granted: z.literal(false),
    token_issued: z.literal(false),
    usable_token_issued: z.literal(false),
    lifecycle_state_advanced: z.literal(false),
    action_executed: z.literal(false),
    dispatch_performed: z.literal(false),
    real_state_read_performed: z.literal(false),
    real_verification_performed: z.literal(false),
    real_compensation_performed: z.literal(false),
    rollback_performed: z.literal(false),
    restore_performed: z.literal(false),
    persisted: z.literal(false),
    event_store_written: z.literal(false),
    telemetry_written: z.literal(false),
    ui_wired: z.literal(false),
    api_route_called: z.literal(false),
    runtime_wired: z.literal(false),
    tool_runtime_wired: z.literal(false),
    room_adapter_wired: z.literal(false),
    project_mutated: z.literal(false),
    obsidian_written: z.literal(false),
    memory_written: z.literal(false),
    scheduler_triggered: z.literal(false),
    network_called: z.literal(false),
    cloud_called: z.literal(false),
  });

export const ApprovalLifecycleIntegrationValidationPolicyMatrixSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION,
    ),
    matrix_id: z.literal("approval_lifecycle_integration_validation_matrix"),
    phase: z.literal(18),
    slice: z.literal("18H.2"),
    metadata_only: z.literal(true),
    guard_matrix_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    non_authoritative: z.literal(true),
    non_executing: z.literal(true),
    non_dispatching: z.literal(true),
    non_persistent: z.literal(true),
    segment_guards: z.array(
      ApprovalLifecycleIntegrationValidationGuardDeclarationSchema,
    ),
    snapshot_guards: z.array(
      ApprovalLifecycleIntegrationValidationGuardDeclarationSchema,
    ),
    disabled_authority_guards: z.array(
      ApprovalLifecycleIntegrationValidationGuardDeclarationSchema,
    ),
    approval_creation_supported: z.literal(false),
    approval_decision_handling_supported: z.literal(false),
    lifecycle_advancement_supported: z.literal(false),
    authority_grant_supported: z.literal(false),
    token_issue_supported: z.literal(false),
    usable_token_supported: z.literal(false),
    execution_supported: z.literal(false),
    dispatch_supported: z.literal(false),
    tool_calls_supported: z.literal(false),
    real_state_reads_supported: z.literal(false),
    verification_supported: z.literal(false),
    compensation_supported: z.literal(false),
    rollback_supported: z.literal(false),
    restore_supported: z.literal(false),
    persistence_supported: z.literal(false),
    event_store_writes_supported: z.literal(false),
    telemetry_writes_supported: z.literal(false),
    ui_rendering_supported: z.literal(false),
    api_routes_supported: z.literal(false),
    runtime_wiring_supported: z.literal(false),
    network_calls_supported: z.literal(false),
  });

export type ApprovalLifecycleIntegrationValidationGuardDeclaration = z.infer<
  typeof ApprovalLifecycleIntegrationValidationGuardDeclarationSchema
>;
export type ApprovalLifecycleIntegrationValidationGuardResult = z.infer<
  typeof ApprovalLifecycleIntegrationValidationGuardResultSchema
>;
export type ApprovalLifecycleIntegrationValidationPolicyMatrix = z.infer<
  typeof ApprovalLifecycleIntegrationValidationPolicyMatrixSchema
>;

const GUARD_REASON_BY_ID = {
  all_required_lifecycle_segments_present: "missing_lifecycle_segment",
  known_inert_integrated_lifecycle_status_only:
    "unknown_integrated_lifecycle_status",
  operational_lifecycle_status_rejected: "operational_lifecycle_status",
  known_proposal_kind_only: "unknown_proposal_kind",
  integrated_lifecycle_replay_safe: "integrated_lifecycle_not_replay_safe",
  integrated_lifecycle_redaction_safe:
    "integrated_lifecycle_not_redaction_safe",
  raw_payloads_forbidden: "raw_payload_present",
  secrets_forbidden: "secret_material_present",
  raw_state_forbidden: "raw_state_present",
  approval_creation_disabled: "approval_creation_enabled",
  approval_decision_handling_disabled: "approval_decision_handling_enabled",
  authority_grant_disabled: "authority_grant_enabled",
  token_issue_disabled: "token_issue_enabled",
  usable_token_disabled: "usable_token_enabled",
  execution_disabled: "execution_enabled",
  dispatch_disabled: "dispatch_enabled",
  tool_runtime_disabled: "tool_runtime_enabled",
  room_action_disabled: "room_action_enabled",
  project_mutation_disabled: "project_mutation_enabled",
  obsidian_write_disabled: "obsidian_write_enabled",
  memory_write_disabled: "memory_write_enabled",
  network_call_disabled: "network_call_enabled",
  real_state_read_disabled: "real_state_read_enabled",
  verification_disabled: "verification_enabled",
  compensation_disabled: "compensation_enabled",
  rollback_disabled: "rollback_enabled",
  restore_disabled: "restore_enabled",
  persistence_disabled: "persistence_enabled",
  telemetry_write_disabled: "telemetry_write_enabled",
} as const satisfies Record<
  ApprovalLifecycleIntegrationValidationGuardId,
  ApprovalLifecycleIntegrationValidationReasonCode
>;

const GUARD_APPLIES_TO = {
  all_required_lifecycle_segments_present: "lifecycle_segment_metadata",
  known_inert_integrated_lifecycle_status_only: "integrated_lifecycle_snapshot",
  operational_lifecycle_status_rejected: "integrated_lifecycle_snapshot",
  known_proposal_kind_only: "integrated_lifecycle_snapshot",
  integrated_lifecycle_replay_safe: "integrated_lifecycle_snapshot",
  integrated_lifecycle_redaction_safe: "integrated_lifecycle_snapshot",
  raw_payloads_forbidden: "integrated_lifecycle_snapshot",
  secrets_forbidden: "integrated_lifecycle_snapshot",
  raw_state_forbidden: "integrated_lifecycle_snapshot",
  approval_creation_disabled: "disabled_authority_flags",
  approval_decision_handling_disabled: "disabled_authority_flags",
  authority_grant_disabled: "disabled_authority_flags",
  token_issue_disabled: "disabled_authority_flags",
  usable_token_disabled: "disabled_authority_flags",
  execution_disabled: "disabled_authority_flags",
  dispatch_disabled: "disabled_authority_flags",
  tool_runtime_disabled: "disabled_authority_flags",
  room_action_disabled: "disabled_authority_flags",
  project_mutation_disabled: "disabled_authority_flags",
  obsidian_write_disabled: "disabled_authority_flags",
  memory_write_disabled: "disabled_authority_flags",
  network_call_disabled: "disabled_authority_flags",
  real_state_read_disabled: "disabled_authority_flags",
  verification_disabled: "disabled_authority_flags",
  compensation_disabled: "disabled_authority_flags",
  rollback_disabled: "disabled_authority_flags",
  restore_disabled: "disabled_authority_flags",
  persistence_disabled: "disabled_authority_flags",
  telemetry_write_disabled: "disabled_authority_flags",
} as const satisfies Record<
  ApprovalLifecycleIntegrationValidationGuardId,
  ApprovalLifecycleIntegrationValidationGuardDeclaration["applies_to"]
>;

function guardDeclaration(
  guard_id: ApprovalLifecycleIntegrationValidationGuardId,
): ApprovalLifecycleIntegrationValidationGuardDeclaration {
  return ApprovalLifecycleIntegrationValidationGuardDeclarationSchema.parse({
    guard_id,
    applies_to: GUARD_APPLIES_TO[guard_id],
    severity: "error",
    failure_reason_code: GUARD_REASON_BY_ID[guard_id],
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    creates_approval: false,
    handles_approval_decision: false,
    grants_authority: false,
    issues_token: false,
    issues_usable_token: false,
    advances_lifecycle_state: false,
    executes_action: false,
    dispatches_tool: false,
    reads_real_state: false,
    performs_real_verification: false,
    performs_real_compensation: false,
    performs_rollback: false,
    performs_restore: false,
    writes_persistence: false,
    wires_runtime: false,
  });
}

export const DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX =
  ApprovalLifecycleIntegrationValidationPolicyMatrixSchema.parse({
    contract_version:
      APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION,
    matrix_id: "approval_lifecycle_integration_validation_matrix",
    phase: 18,
    slice: "18H.2",
    metadata_only: true,
    guard_matrix_only: true,
    replay_safe: true,
    redaction_safe: true,
    non_authoritative: true,
    non_executing: true,
    non_dispatching: true,
    non_persistent: true,
    segment_guards: (["all_required_lifecycle_segments_present"] as const).map(
      guardDeclaration,
    ),
    snapshot_guards: (
      [
        "known_inert_integrated_lifecycle_status_only",
        "operational_lifecycle_status_rejected",
        "known_proposal_kind_only",
        "integrated_lifecycle_replay_safe",
        "integrated_lifecycle_redaction_safe",
        "raw_payloads_forbidden",
        "secrets_forbidden",
        "raw_state_forbidden",
      ] as const
    ).map(guardDeclaration),
    disabled_authority_guards: (
      [
        "approval_creation_disabled",
        "approval_decision_handling_disabled",
        "authority_grant_disabled",
        "token_issue_disabled",
        "usable_token_disabled",
        "execution_disabled",
        "dispatch_disabled",
        "tool_runtime_disabled",
        "room_action_disabled",
        "project_mutation_disabled",
        "obsidian_write_disabled",
        "memory_write_disabled",
        "network_call_disabled",
        "real_state_read_disabled",
        "verification_disabled",
        "compensation_disabled",
        "rollback_disabled",
        "restore_disabled",
        "persistence_disabled",
        "telemetry_write_disabled",
      ] as const
    ).map(guardDeclaration),
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    usable_token_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    real_state_reads_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    restore_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    network_calls_supported: false,
  });

function guardResult(input: {
  readonly guard_id: ApprovalLifecycleIntegrationValidationGuardId;
  readonly passed: boolean;
  readonly reason_code?: ApprovalLifecycleIntegrationValidationReasonCode;
}): ApprovalLifecycleIntegrationValidationGuardResult {
  return ApprovalLifecycleIntegrationValidationGuardResultSchema.parse({
    guard_id: input.guard_id,
    passed: input.passed,
    severity: input.passed ? "info" : "error",
    reason_code:
      input.reason_code ??
      (input.passed ? "passed" : GUARD_REASON_BY_ID[input.guard_id]),
    redaction_status: "metadata_only",
    replay_safe: true,
    redaction_safe: true,
    checked_at_source: "approval_lifecycle_integration_validation_matrix",
    metadata_only: true,
    audit_preview_safe: true,
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
    approval_created: false,
    approval_decision_handled: false,
    authority_granted: false,
    token_issued: false,
    usable_token_issued: false,
    lifecycle_state_advanced: false,
    action_executed: false,
    dispatch_performed: false,
    real_state_read_performed: false,
    real_verification_performed: false,
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    ui_wired: false,
    api_route_called: false,
    runtime_wired: false,
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

function segmentNames(input: unknown): readonly unknown[] {
  const segments = recordField(input, "segment_metadata");
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .filter((segment) => !!segment && typeof segment === "object")
    .map((segment) => (segment as { readonly segment?: unknown }).segment);
}

function hasAllRequiredSegments(input: unknown): boolean {
  const present = new Set(segmentNames(input));
  return APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS.every(
    (segment: ApprovalLifecycleIntegrationSegment) => present.has(segment),
  );
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
  "tool_output",
  "tool_outputs",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
]);

const FORBIDDEN_SECRET_KEYS = new Set(["secret", "secrets"]);
const FORBIDDEN_RAW_STATE_KEYS = new Set(["raw_state", "state"]);

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

function hasForbiddenKey(input: unknown, keys: ReadonlySet<string>): boolean {
  return collectKeys(input).some((key) => keys.has(key));
}

function excludesRawPayloads(input: unknown): boolean {
  if (hasForbiddenKey(input, FORBIDDEN_RAW_KEYS)) {
    return false;
  }

  return (
    recordField(input, "raw_payload_included") === false &&
    recordField(input, "raw_tool_arguments_included") === false &&
    recordField(input, "raw_prompt_included") === false &&
    recordField(input, "raw_model_output_included") === false &&
    recordField(input, "raw_device_payload_included") === false &&
    recordField(input, "raw_project_content_included") === false &&
    recordField(input, "raw_memory_content_included") === false
  );
}

function excludesSecrets(input: unknown): boolean {
  if (hasForbiddenKey(input, FORBIDDEN_SECRET_KEYS)) {
    return false;
  }

  return recordField(input, "secret_material_included") === false;
}

function excludesRawState(input: unknown): boolean {
  if (hasForbiddenKey(input, FORBIDDEN_RAW_STATE_KEYS)) {
    return false;
  }

  return recordField(input, "raw_state_included") === false;
}

export function validateApprovalLifecycleIntegrationPolicyMetadata(
  input: unknown,
): readonly ApprovalLifecycleIntegrationValidationGuardResult[] {
  const status = recordField(input, "status");
  const proposalKind = recordField(input, "proposal_kind");
  const parsed = ApprovalLifecycleIntegrationSnapshotSchema.safeParse(input);

  return [
    guardResult({
      guard_id: "all_required_lifecycle_segments_present",
      passed: hasAllRequiredSegments(input),
    }),
    guardResult({
      guard_id: "known_inert_integrated_lifecycle_status_only",
      passed:
        ApprovalLifecycleIntegrationStatusSchema.safeParse(status).success &&
        !ApprovalLifecycleIntegrationForbiddenStatusSchema.safeParse(status)
          .success,
    }),
    guardResult({
      guard_id: "operational_lifecycle_status_rejected",
      passed:
        !ApprovalLifecycleIntegrationForbiddenStatusSchema.safeParse(status)
          .success,
    }),
    guardResult({
      guard_id: "known_proposal_kind_only",
      passed:
        ApprovalProposalRegistryKindSchema.safeParse(proposalKind).success,
    }),
    guardResult({
      guard_id: "integrated_lifecycle_replay_safe",
      passed: hasReplaySafeMetadata(input),
    }),
    guardResult({
      guard_id: "integrated_lifecycle_redaction_safe",
      passed: hasRedactionSafeMetadata(input),
    }),
    guardResult({
      guard_id: "raw_payloads_forbidden",
      passed: parsed.success && excludesRawPayloads(input),
    }),
    guardResult({
      guard_id: "secrets_forbidden",
      passed: parsed.success && excludesSecrets(input),
    }),
    guardResult({
      guard_id: "raw_state_forbidden",
      passed: parsed.success && excludesRawState(input),
    }),
    guardResult({
      guard_id: "approval_creation_disabled",
      passed:
        disabledFlag(input, "approval_creation_enabled") === false &&
        recordField(input, "approval_created") === false,
    }),
    guardResult({
      guard_id: "approval_decision_handling_disabled",
      passed:
        disabledFlag(input, "approval_decision_handling_enabled") === false &&
        recordField(input, "approval_decision_handled") === false,
    }),
    guardResult({
      guard_id: "authority_grant_disabled",
      passed:
        disabledFlag(input, "authority_grant_enabled") === false &&
        recordField(input, "authority_granted") === false,
    }),
    guardResult({
      guard_id: "token_issue_disabled",
      passed:
        disabledFlag(input, "token_issue_enabled") === false &&
        recordField(input, "token_issued") === false,
    }),
    guardResult({
      guard_id: "usable_token_disabled",
      passed:
        disabledFlag(input, "usable_token_enabled") === false &&
        recordField(input, "usable_token_issued") === false,
    }),
    guardResult({
      guard_id: "execution_disabled",
      passed:
        disabledFlag(input, "execution_enabled") === false &&
        recordField(input, "action_executed") === false,
    }),
    guardResult({
      guard_id: "dispatch_disabled",
      passed:
        disabledFlag(input, "dispatch_enabled") === false &&
        recordField(input, "dispatch_performed") === false,
    }),
    guardResult({
      guard_id: "tool_runtime_disabled",
      passed: disabledFlag(input, "tool_runtime_enabled") === false,
    }),
    guardResult({
      guard_id: "room_action_disabled",
      passed: disabledFlag(input, "room_action_enabled") === false,
    }),
    guardResult({
      guard_id: "project_mutation_disabled",
      passed: disabledFlag(input, "project_mutation_enabled") === false,
    }),
    guardResult({
      guard_id: "obsidian_write_disabled",
      passed: disabledFlag(input, "obsidian_write_enabled") === false,
    }),
    guardResult({
      guard_id: "memory_write_disabled",
      passed: disabledFlag(input, "memory_write_enabled") === false,
    }),
    guardResult({
      guard_id: "network_call_disabled",
      passed: disabledFlag(input, "network_call_enabled") === false,
    }),
    guardResult({
      guard_id: "real_state_read_disabled",
      passed:
        disabledFlag(input, "real_state_read_enabled") === false &&
        recordField(input, "real_state_read_performed") === false,
    }),
    guardResult({
      guard_id: "verification_disabled",
      passed:
        disabledFlag(input, "verification_enabled") === false &&
        recordField(input, "real_verification_performed") === false,
    }),
    guardResult({
      guard_id: "compensation_disabled",
      passed:
        disabledFlag(input, "compensation_enabled") === false &&
        recordField(input, "real_compensation_performed") === false,
    }),
    guardResult({
      guard_id: "rollback_disabled",
      passed:
        disabledFlag(input, "rollback_enabled") === false &&
        recordField(input, "rollback_performed") === false,
    }),
    guardResult({
      guard_id: "restore_disabled",
      passed:
        disabledFlag(input, "restore_enabled") === false &&
        recordField(input, "restore_performed") === false,
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
  ];
}
