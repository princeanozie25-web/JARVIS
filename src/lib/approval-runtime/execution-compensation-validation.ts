import { z } from "zod";

import {
  ApprovalExecutionCompensationForbiddenStatusSchema,
  ApprovalExecutionCompensationMetadataSchema,
  ApprovalExecutionCompensationStatusSchema,
  ApprovalExecutionCompensationStrategySchema,
} from "./execution-compensation";
import { ApprovalRedactionStatusSchema } from "./types";

export const APPROVAL_EXECUTION_COMPENSATION_VALIDATION_CONTRACT_VERSION =
  "18G.2" as const;

export const APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_IDS = [
  "known_inert_compensation_status_only",
  "operational_status_rejected",
  "known_metadata_only_compensation_strategy_only",
  "compensation_replay_safe",
  "compensation_redaction_safe",
  "raw_payloads_forbidden",
  "secrets_forbidden",
  "hint_metadata_only",
  "hint_redacted_reference_only",
  "hint_hash_reference_only",
  "hint_no_raw_state",
  "hint_no_raw_device_payload",
  "hint_no_raw_tool_output",
  "hint_no_raw_project_content",
  "hint_no_raw_memory_content",
  "hint_no_model_output",
  "hint_no_prompts",
  "evidence_metadata_only",
  "evidence_redacted_reference_only",
  "evidence_hash_reference_only",
  "evidence_no_raw_state",
  "evidence_no_raw_device_payload",
  "evidence_no_raw_tool_output",
  "evidence_no_raw_project_content",
  "evidence_no_raw_memory_content",
  "evidence_no_model_output",
  "evidence_no_prompts",
  "compensation_disabled",
  "rollback_disabled",
  "restore_disabled",
  "execution_disabled",
  "dispatch_disabled",
  "tool_runtime_disabled",
  "room_action_disabled",
  "project_mutation_disabled",
  "obsidian_write_disabled",
  "memory_write_disabled",
  "network_call_disabled",
  "lifecycle_advancement_disabled",
  "verification_disabled",
  "persistence_disabled",
  "telemetry_write_disabled",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_SEVERITIES = [
  "info",
  "warning",
  "error",
] as const;

export const APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASON_CODES = [
  "passed",
  "unknown_compensation_status",
  "operational_compensation_status",
  "unknown_compensation_strategy",
  "compensation_not_replay_safe",
  "compensation_not_redaction_safe",
  "raw_payload_present",
  "secret_material_present",
  "hint_not_metadata_only",
  "hint_raw_reference_present",
  "hint_hash_reference_missing",
  "evidence_not_metadata_only",
  "evidence_raw_reference_present",
  "evidence_hash_reference_missing",
  "raw_state_present",
  "raw_device_payload_present",
  "raw_tool_output_present",
  "raw_project_content_present",
  "raw_memory_content_present",
  "model_output_present",
  "prompt_present",
  "compensation_enabled",
  "rollback_enabled",
  "restore_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "tool_runtime_enabled",
  "room_action_enabled",
  "project_mutation_enabled",
  "obsidian_write_enabled",
  "memory_write_enabled",
  "network_call_enabled",
  "lifecycle_advancement_enabled",
  "verification_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "invalid_compensation_metadata_shape",
] as const;

export type ApprovalExecutionCompensationValidationGuardId =
  (typeof APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_IDS)[number];
export type ApprovalExecutionCompensationValidationGuardSeverity =
  (typeof APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_SEVERITIES)[number];
export type ApprovalExecutionCompensationValidationReasonCode =
  (typeof APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASON_CODES)[number];

export const ApprovalExecutionCompensationValidationGuardIdSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_IDS,
);
export const ApprovalExecutionCompensationValidationGuardSeveritySchema =
  z.enum(APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_SEVERITIES);
export const ApprovalExecutionCompensationValidationReasonCodeSchema = z.enum(
  APPROVAL_EXECUTION_COMPENSATION_VALIDATION_REASON_CODES,
);

export const ApprovalExecutionCompensationValidationGuardDeclarationSchema =
  z.strictObject({
    guard_id: ApprovalExecutionCompensationValidationGuardIdSchema,
    applies_to: z.enum([
      "execution_compensation",
      "compensation_hint_metadata",
      "compensation_evidence_metadata",
      "compensation_strategy_metadata",
      "disabled_authority_flags",
    ]),
    severity: ApprovalExecutionCompensationValidationGuardSeveritySchema,
    failure_reason_code:
      ApprovalExecutionCompensationValidationReasonCodeSchema,
    metadata_only: z.literal(true),
    audit_preview_safe: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    performs_real_compensation: z.literal(false),
    performs_rollback: z.literal(false),
    performs_restore: z.literal(false),
    reads_real_state: z.literal(false),
    grants_authority: z.literal(false),
    advances_lifecycle_state: z.literal(false),
    issues_token: z.literal(false),
    executes_action: z.literal(false),
    dispatches_tool: z.literal(false),
    writes_persistence: z.literal(false),
    wires_runtime: z.literal(false),
  });

export const ApprovalExecutionCompensationValidationGuardResultSchema =
  z.strictObject({
    guard_id: ApprovalExecutionCompensationValidationGuardIdSchema,
    passed: z.boolean(),
    severity: ApprovalExecutionCompensationValidationGuardSeveritySchema,
    reason_code: ApprovalExecutionCompensationValidationReasonCodeSchema,
    redaction_status: ApprovalRedactionStatusSchema,
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    checked_at_source: z.literal(
      "approval_execution_compensation_validation_matrix",
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
    real_compensation_performed: z.literal(false),
    rollback_performed: z.literal(false),
    restore_performed: z.literal(false),
    inverse_operation_executed: z.literal(false),
    real_state_read_performed: z.literal(false),
    real_evidence_collected: z.literal(false),
    approval_created: z.literal(false),
    approval_decision_handled: z.literal(false),
    authority_granted: z.literal(false),
    token_issued: z.literal(false),
    dispatch_performed: z.literal(false),
    lifecycle_state_advanced: z.literal(false),
    action_executed: z.literal(false),
    verification_performed: z.literal(false),
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

export const ApprovalExecutionCompensationValidationPolicyMatrixSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_EXECUTION_COMPENSATION_VALIDATION_CONTRACT_VERSION,
    ),
    matrix_id: z.literal("approval_execution_compensation_validation_matrix"),
    phase: z.literal(18),
    slice: z.literal("18G.2"),
    metadata_only: z.literal(true),
    guard_matrix_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    non_authoritative: z.literal(true),
    non_executing: z.literal(true),
    non_dispatching: z.literal(true),
    non_persistent: z.literal(true),
    compensation_guards: z.array(
      ApprovalExecutionCompensationValidationGuardDeclarationSchema,
    ),
    strategy_guards: z.array(
      ApprovalExecutionCompensationValidationGuardDeclarationSchema,
    ),
    hint_guards: z.array(
      ApprovalExecutionCompensationValidationGuardDeclarationSchema,
    ),
    evidence_guards: z.array(
      ApprovalExecutionCompensationValidationGuardDeclarationSchema,
    ),
    disabled_authority_guards: z.array(
      ApprovalExecutionCompensationValidationGuardDeclarationSchema,
    ),
    real_compensation_supported: z.literal(false),
    rollback_supported: z.literal(false),
    restore_supported: z.literal(false),
    inverse_operation_execution_supported: z.literal(false),
    real_state_reads_supported: z.literal(false),
    real_evidence_collection_supported: z.literal(false),
    approval_creation_supported: z.literal(false),
    approval_decision_handling_supported: z.literal(false),
    lifecycle_advancement_supported: z.literal(false),
    authority_grant_supported: z.literal(false),
    token_issue_supported: z.literal(false),
    execution_supported: z.literal(false),
    dispatch_supported: z.literal(false),
    tool_calls_supported: z.literal(false),
    verification_supported: z.literal(false),
    persistence_supported: z.literal(false),
    event_store_writes_supported: z.literal(false),
    telemetry_writes_supported: z.literal(false),
    ui_rendering_supported: z.literal(false),
    api_routes_supported: z.literal(false),
    runtime_wiring_supported: z.literal(false),
    network_calls_supported: z.literal(false),
  });

export type ApprovalExecutionCompensationValidationGuardDeclaration = z.infer<
  typeof ApprovalExecutionCompensationValidationGuardDeclarationSchema
>;
export type ApprovalExecutionCompensationValidationGuardResult = z.infer<
  typeof ApprovalExecutionCompensationValidationGuardResultSchema
>;
export type ApprovalExecutionCompensationValidationPolicyMatrix = z.infer<
  typeof ApprovalExecutionCompensationValidationPolicyMatrixSchema
>;

const GUARD_REASON_BY_ID = {
  known_inert_compensation_status_only: "unknown_compensation_status",
  operational_status_rejected: "operational_compensation_status",
  known_metadata_only_compensation_strategy_only:
    "unknown_compensation_strategy",
  compensation_replay_safe: "compensation_not_replay_safe",
  compensation_redaction_safe: "compensation_not_redaction_safe",
  raw_payloads_forbidden: "raw_payload_present",
  secrets_forbidden: "secret_material_present",
  hint_metadata_only: "hint_not_metadata_only",
  hint_redacted_reference_only: "hint_raw_reference_present",
  hint_hash_reference_only: "hint_hash_reference_missing",
  hint_no_raw_state: "raw_state_present",
  hint_no_raw_device_payload: "raw_device_payload_present",
  hint_no_raw_tool_output: "raw_tool_output_present",
  hint_no_raw_project_content: "raw_project_content_present",
  hint_no_raw_memory_content: "raw_memory_content_present",
  hint_no_model_output: "model_output_present",
  hint_no_prompts: "prompt_present",
  evidence_metadata_only: "evidence_not_metadata_only",
  evidence_redacted_reference_only: "evidence_raw_reference_present",
  evidence_hash_reference_only: "evidence_hash_reference_missing",
  evidence_no_raw_state: "raw_state_present",
  evidence_no_raw_device_payload: "raw_device_payload_present",
  evidence_no_raw_tool_output: "raw_tool_output_present",
  evidence_no_raw_project_content: "raw_project_content_present",
  evidence_no_raw_memory_content: "raw_memory_content_present",
  evidence_no_model_output: "model_output_present",
  evidence_no_prompts: "prompt_present",
  compensation_disabled: "compensation_enabled",
  rollback_disabled: "rollback_enabled",
  restore_disabled: "restore_enabled",
  execution_disabled: "execution_enabled",
  dispatch_disabled: "dispatch_enabled",
  tool_runtime_disabled: "tool_runtime_enabled",
  room_action_disabled: "room_action_enabled",
  project_mutation_disabled: "project_mutation_enabled",
  obsidian_write_disabled: "obsidian_write_enabled",
  memory_write_disabled: "memory_write_enabled",
  network_call_disabled: "network_call_enabled",
  lifecycle_advancement_disabled: "lifecycle_advancement_enabled",
  verification_disabled: "verification_enabled",
  persistence_disabled: "persistence_enabled",
  telemetry_write_disabled: "telemetry_write_enabled",
} as const satisfies Record<
  ApprovalExecutionCompensationValidationGuardId,
  ApprovalExecutionCompensationValidationReasonCode
>;

const GUARD_APPLIES_TO = {
  known_inert_compensation_status_only: "execution_compensation",
  operational_status_rejected: "execution_compensation",
  known_metadata_only_compensation_strategy_only:
    "compensation_strategy_metadata",
  compensation_replay_safe: "execution_compensation",
  compensation_redaction_safe: "execution_compensation",
  raw_payloads_forbidden: "execution_compensation",
  secrets_forbidden: "execution_compensation",
  hint_metadata_only: "compensation_hint_metadata",
  hint_redacted_reference_only: "compensation_hint_metadata",
  hint_hash_reference_only: "compensation_hint_metadata",
  hint_no_raw_state: "compensation_hint_metadata",
  hint_no_raw_device_payload: "compensation_hint_metadata",
  hint_no_raw_tool_output: "compensation_hint_metadata",
  hint_no_raw_project_content: "compensation_hint_metadata",
  hint_no_raw_memory_content: "compensation_hint_metadata",
  hint_no_model_output: "compensation_hint_metadata",
  hint_no_prompts: "compensation_hint_metadata",
  evidence_metadata_only: "compensation_evidence_metadata",
  evidence_redacted_reference_only: "compensation_evidence_metadata",
  evidence_hash_reference_only: "compensation_evidence_metadata",
  evidence_no_raw_state: "compensation_evidence_metadata",
  evidence_no_raw_device_payload: "compensation_evidence_metadata",
  evidence_no_raw_tool_output: "compensation_evidence_metadata",
  evidence_no_raw_project_content: "compensation_evidence_metadata",
  evidence_no_raw_memory_content: "compensation_evidence_metadata",
  evidence_no_model_output: "compensation_evidence_metadata",
  evidence_no_prompts: "compensation_evidence_metadata",
  compensation_disabled: "disabled_authority_flags",
  rollback_disabled: "disabled_authority_flags",
  restore_disabled: "disabled_authority_flags",
  execution_disabled: "disabled_authority_flags",
  dispatch_disabled: "disabled_authority_flags",
  tool_runtime_disabled: "disabled_authority_flags",
  room_action_disabled: "disabled_authority_flags",
  project_mutation_disabled: "disabled_authority_flags",
  obsidian_write_disabled: "disabled_authority_flags",
  memory_write_disabled: "disabled_authority_flags",
  network_call_disabled: "disabled_authority_flags",
  lifecycle_advancement_disabled: "disabled_authority_flags",
  verification_disabled: "disabled_authority_flags",
  persistence_disabled: "disabled_authority_flags",
  telemetry_write_disabled: "disabled_authority_flags",
} as const satisfies Record<
  ApprovalExecutionCompensationValidationGuardId,
  ApprovalExecutionCompensationValidationGuardDeclaration["applies_to"]
>;

function guardDeclaration(
  guard_id: ApprovalExecutionCompensationValidationGuardId,
): ApprovalExecutionCompensationValidationGuardDeclaration {
  return ApprovalExecutionCompensationValidationGuardDeclarationSchema.parse({
    guard_id,
    applies_to: GUARD_APPLIES_TO[guard_id],
    severity: "error",
    failure_reason_code: GUARD_REASON_BY_ID[guard_id],
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    performs_real_compensation: false,
    performs_rollback: false,
    performs_restore: false,
    reads_real_state: false,
    grants_authority: false,
    advances_lifecycle_state: false,
    issues_token: false,
    executes_action: false,
    dispatches_tool: false,
    writes_persistence: false,
    wires_runtime: false,
  });
}

export const DEFAULT_APPROVAL_EXECUTION_COMPENSATION_VALIDATION_POLICY_MATRIX =
  ApprovalExecutionCompensationValidationPolicyMatrixSchema.parse({
    contract_version:
      APPROVAL_EXECUTION_COMPENSATION_VALIDATION_CONTRACT_VERSION,
    matrix_id: "approval_execution_compensation_validation_matrix",
    phase: 18,
    slice: "18G.2",
    metadata_only: true,
    guard_matrix_only: true,
    replay_safe: true,
    redaction_safe: true,
    non_authoritative: true,
    non_executing: true,
    non_dispatching: true,
    non_persistent: true,
    compensation_guards: (
      [
        "known_inert_compensation_status_only",
        "operational_status_rejected",
        "compensation_replay_safe",
        "compensation_redaction_safe",
        "raw_payloads_forbidden",
        "secrets_forbidden",
      ] as const
    ).map(guardDeclaration),
    strategy_guards: (
      ["known_metadata_only_compensation_strategy_only"] as const
    ).map(guardDeclaration),
    hint_guards: (
      [
        "hint_metadata_only",
        "hint_redacted_reference_only",
        "hint_hash_reference_only",
        "hint_no_raw_state",
        "hint_no_raw_device_payload",
        "hint_no_raw_tool_output",
        "hint_no_raw_project_content",
        "hint_no_raw_memory_content",
        "hint_no_model_output",
        "hint_no_prompts",
      ] as const
    ).map(guardDeclaration),
    evidence_guards: (
      [
        "evidence_metadata_only",
        "evidence_redacted_reference_only",
        "evidence_hash_reference_only",
        "evidence_no_raw_state",
        "evidence_no_raw_device_payload",
        "evidence_no_raw_tool_output",
        "evidence_no_raw_project_content",
        "evidence_no_raw_memory_content",
        "evidence_no_model_output",
        "evidence_no_prompts",
      ] as const
    ).map(guardDeclaration),
    disabled_authority_guards: (
      [
        "compensation_disabled",
        "rollback_disabled",
        "restore_disabled",
        "execution_disabled",
        "dispatch_disabled",
        "tool_runtime_disabled",
        "room_action_disabled",
        "project_mutation_disabled",
        "obsidian_write_disabled",
        "memory_write_disabled",
        "network_call_disabled",
        "lifecycle_advancement_disabled",
        "verification_disabled",
        "persistence_disabled",
        "telemetry_write_disabled",
      ] as const
    ).map(guardDeclaration),
    real_compensation_supported: false,
    rollback_supported: false,
    restore_supported: false,
    inverse_operation_execution_supported: false,
    real_state_reads_supported: false,
    real_evidence_collection_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    verification_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    network_calls_supported: false,
  });

function guardResult(input: {
  readonly guard_id: ApprovalExecutionCompensationValidationGuardId;
  readonly passed: boolean;
  readonly reason_code?: ApprovalExecutionCompensationValidationReasonCode;
}): ApprovalExecutionCompensationValidationGuardResult {
  return ApprovalExecutionCompensationValidationGuardResultSchema.parse({
    guard_id: input.guard_id,
    passed: input.passed,
    severity: input.passed ? "info" : "error",
    reason_code:
      input.reason_code ??
      (input.passed ? "passed" : GUARD_REASON_BY_ID[input.guard_id]),
    redaction_status: "metadata_only",
    replay_safe: true,
    redaction_safe: true,
    checked_at_source: "approval_execution_compensation_validation_matrix",
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
    real_compensation_performed: false,
    rollback_performed: false,
    restore_performed: false,
    inverse_operation_executed: false,
    real_state_read_performed: false,
    real_evidence_collected: false,
    approval_created: false,
    approval_decision_handled: false,
    authority_granted: false,
    token_issued: false,
    dispatch_performed: false,
    lifecycle_state_advanced: false,
    action_executed: false,
    verification_performed: false,
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

function strategyValue(input: unknown): unknown {
  const strategyMetadata = recordField(input, "strategy_metadata");
  if (
    strategyMetadata &&
    typeof strategyMetadata === "object" &&
    "strategy" in strategyMetadata
  ) {
    return (strategyMetadata as { readonly strategy?: unknown }).strategy;
  }

  return undefined;
}

function metadataItems(
  input: unknown,
  field: "hint_metadata" | "evidence_metadata",
): readonly Record<string, unknown>[] {
  const value = recordField(input, field);
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object",
  );
}

function everyMetadataItemField(
  input: unknown,
  listField: "hint_metadata" | "evidence_metadata",
  itemField: string,
  predicate: (value: unknown) => boolean,
): boolean {
  const items = metadataItems(input, listField);
  return items.length > 0 && items.every((item) => predicate(item[itemField]));
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
  "raw_state",
  "state",
  "device_payload",
  "project_contents",
  "memory_contents",
]);

const FORBIDDEN_SECRET_KEYS = new Set(["secret", "secrets"]);

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

function metadataItemsHaveForbiddenKey(
  input: unknown,
  listField: "hint_metadata" | "evidence_metadata",
  keys: ReadonlySet<string>,
): boolean {
  return metadataItems(input, listField).some((item) =>
    hasForbiddenKey(item, keys),
  );
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
    recordField(input, "raw_memory_content_included") === false &&
    recordField(input, "raw_state_included") === false
  );
}

function excludesSecrets(input: unknown): boolean {
  if (hasForbiddenKey(input, FORBIDDEN_SECRET_KEYS)) {
    return false;
  }

  return recordField(input, "secret_material_included") === false;
}

function metadataItemsAreMetadataOnly(
  input: unknown,
  listField: "hint_metadata" | "evidence_metadata",
): boolean {
  return everyMetadataItemField(
    input,
    listField,
    "redaction_status",
    (value) =>
      !!value &&
      typeof value === "object" &&
      (value as { readonly metadata_only?: unknown }).metadata_only === true,
  );
}

function itemNoForbiddenKeys(
  input: unknown,
  listField: "hint_metadata" | "evidence_metadata",
  keys: readonly string[],
): boolean {
  return !metadataItemsHaveForbiddenKey(input, listField, new Set(keys));
}

export function validateApprovalExecutionCompensationPolicyMetadata(
  input: unknown,
): readonly ApprovalExecutionCompensationValidationGuardResult[] {
  const status = recordField(input, "status");
  const strategy = strategyValue(input);
  const parsed = ApprovalExecutionCompensationMetadataSchema.safeParse(input);

  return [
    guardResult({
      guard_id: "known_inert_compensation_status_only",
      passed:
        ApprovalExecutionCompensationStatusSchema.safeParse(status).success &&
        !ApprovalExecutionCompensationForbiddenStatusSchema.safeParse(status)
          .success,
    }),
    guardResult({
      guard_id: "operational_status_rejected",
      passed:
        !ApprovalExecutionCompensationForbiddenStatusSchema.safeParse(status)
          .success,
    }),
    guardResult({
      guard_id: "known_metadata_only_compensation_strategy_only",
      passed:
        ApprovalExecutionCompensationStrategySchema.safeParse(strategy).success,
    }),
    guardResult({
      guard_id: "compensation_replay_safe",
      passed: hasReplaySafeMetadata(input),
    }),
    guardResult({
      guard_id: "compensation_redaction_safe",
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
      guard_id: "hint_metadata_only",
      passed: metadataItemsAreMetadataOnly(input, "hint_metadata"),
    }),
    guardResult({
      guard_id: "hint_redacted_reference_only",
      passed:
        everyMetadataItemField(
          input,
          "hint_metadata",
          "redacted_reference",
          (value) => typeof value === "string" && value.startsWith("redacted:"),
        ) && itemNoForbiddenKeys(input, "hint_metadata", ["raw_reference"]),
    }),
    guardResult({
      guard_id: "hint_hash_reference_only",
      passed: everyMetadataItemField(
        input,
        "hint_metadata",
        "hash_reference",
        (value) => typeof value === "string" && value.startsWith("hash:"),
      ),
    }),
    guardResult({
      guard_id: "hint_no_raw_state",
      passed: itemNoForbiddenKeys(input, "hint_metadata", [
        "raw_state",
        "state",
      ]),
    }),
    guardResult({
      guard_id: "hint_no_raw_device_payload",
      passed: itemNoForbiddenKeys(input, "hint_metadata", ["device_payload"]),
    }),
    guardResult({
      guard_id: "hint_no_raw_tool_output",
      passed: itemNoForbiddenKeys(input, "hint_metadata", [
        "tool_output",
        "tool_outputs",
      ]),
    }),
    guardResult({
      guard_id: "hint_no_raw_project_content",
      passed: itemNoForbiddenKeys(input, "hint_metadata", ["project_contents"]),
    }),
    guardResult({
      guard_id: "hint_no_raw_memory_content",
      passed: itemNoForbiddenKeys(input, "hint_metadata", ["memory_contents"]),
    }),
    guardResult({
      guard_id: "hint_no_model_output",
      passed: itemNoForbiddenKeys(input, "hint_metadata", [
        "model_output",
        "model_outputs",
      ]),
    }),
    guardResult({
      guard_id: "hint_no_prompts",
      passed: itemNoForbiddenKeys(input, "hint_metadata", [
        "prompt",
        "prompts",
      ]),
    }),
    guardResult({
      guard_id: "evidence_metadata_only",
      passed: metadataItemsAreMetadataOnly(input, "evidence_metadata"),
    }),
    guardResult({
      guard_id: "evidence_redacted_reference_only",
      passed:
        everyMetadataItemField(
          input,
          "evidence_metadata",
          "redacted_reference",
          (value) => typeof value === "string" && value.startsWith("redacted:"),
        ) && itemNoForbiddenKeys(input, "evidence_metadata", ["raw_reference"]),
    }),
    guardResult({
      guard_id: "evidence_hash_reference_only",
      passed: everyMetadataItemField(
        input,
        "evidence_metadata",
        "hash_reference",
        (value) => typeof value === "string" && value.startsWith("hash:"),
      ),
    }),
    guardResult({
      guard_id: "evidence_no_raw_state",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "raw_state",
        "state",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_raw_device_payload",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "device_payload",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_raw_tool_output",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "tool_output",
        "tool_outputs",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_raw_project_content",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "project_contents",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_raw_memory_content",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "memory_contents",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_model_output",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "model_output",
        "model_outputs",
      ]),
    }),
    guardResult({
      guard_id: "evidence_no_prompts",
      passed: itemNoForbiddenKeys(input, "evidence_metadata", [
        "prompt",
        "prompts",
      ]),
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
      guard_id: "execution_disabled",
      passed:
        disabledFlag(input, "execution_enabled") === false &&
        recordField(input, "execution_performed") === false,
    }),
    guardResult({
      guard_id: "dispatch_disabled",
      passed:
        disabledFlag(input, "dispatch_enabled") === false &&
        recordField(input, "dispatch_performed") === false,
    }),
    guardResult({
      guard_id: "tool_runtime_disabled",
      passed:
        disabledFlag(input, "tool_runtime_enabled") === false &&
        recordField(input, "tool_call_performed") === false,
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
      guard_id: "lifecycle_advancement_disabled",
      passed:
        disabledFlag(input, "lifecycle_advancement_enabled") === false &&
        recordField(input, "lifecycle_advanced") === false,
    }),
    guardResult({
      guard_id: "verification_disabled",
      passed:
        disabledFlag(input, "verification_enabled") === false &&
        recordField(input, "verification_performed") === false,
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
