import { z } from "zod";

import {
  ApprovalExecutionPlanForbiddenStatusSchema,
  ApprovalExecutionPlanMetadataSchema,
  ApprovalExecutionPlanStatusSchema,
} from "./execution-plan";
import { ApprovalProposalRegistryKindSchema } from "./proposal-registry";
import { ApprovalRedactionStatusSchema } from "./types";

export const APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION =
  "18E.2" as const;

export const APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS = [
  "known_proposal_kind_only",
  "known_inert_plan_status_only",
  "executable_status_rejected",
  "plan_replay_safe",
  "plan_redaction_safe",
  "raw_payloads_forbidden",
  "secrets_forbidden",
  "step_dry_run_required",
  "step_execution_disabled",
  "step_dispatch_disabled",
  "step_verification_required_metadata_true",
  "step_compensation_hint_metadata_available_true",
  "target_raw_payloads_excluded",
  "dry_run_metadata_required",
  "dry_run_execution_disabled",
  "dry_run_dispatch_disabled",
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
  "compensation_disabled",
  "rollback_disabled",
  "persistence_disabled",
  "telemetry_write_disabled",
] as const;

export const APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_SEVERITIES = [
  "info",
  "warning",
  "error",
] as const;

export const APPROVAL_EXECUTION_PLAN_VALIDATION_REASON_CODES = [
  "passed",
  "unknown_proposal_kind",
  "unknown_plan_status",
  "executable_plan_status",
  "plan_not_replay_safe",
  "plan_not_redaction_safe",
  "raw_payload_present",
  "secret_material_present",
  "step_dry_run_not_required",
  "step_execution_enabled",
  "step_dispatch_enabled",
  "step_verification_metadata_missing",
  "step_compensation_hint_missing",
  "target_raw_payload_present",
  "dry_run_metadata_missing",
  "dry_run_execution_enabled",
  "dry_run_dispatch_enabled",
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
  "compensation_enabled",
  "rollback_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "invalid_execution_plan_shape",
] as const;

export type ApprovalExecutionPlanValidationGuardId =
  (typeof APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS)[number];
export type ApprovalExecutionPlanValidationGuardSeverity =
  (typeof APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_SEVERITIES)[number];
export type ApprovalExecutionPlanValidationReasonCode =
  (typeof APPROVAL_EXECUTION_PLAN_VALIDATION_REASON_CODES)[number];

export const ApprovalExecutionPlanValidationGuardIdSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS,
);
export const ApprovalExecutionPlanValidationGuardSeveritySchema = z.enum(
  APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_SEVERITIES,
);
export const ApprovalExecutionPlanValidationReasonCodeSchema = z.enum(
  APPROVAL_EXECUTION_PLAN_VALIDATION_REASON_CODES,
);

export const ApprovalExecutionPlanValidationGuardDeclarationSchema =
  z.strictObject({
    guard_id: ApprovalExecutionPlanValidationGuardIdSchema,
    applies_to: z.enum([
      "execution_plan",
      "execution_step_metadata",
      "execution_target_metadata",
      "execution_dry_run_metadata",
      "disabled_authority_flags",
    ]),
    severity: ApprovalExecutionPlanValidationGuardSeveritySchema,
    failure_reason_code: ApprovalExecutionPlanValidationReasonCodeSchema,
    metadata_only: z.literal(true),
    audit_preview_safe: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    grants_authority: z.literal(false),
    advances_lifecycle_state: z.literal(false),
    issues_token: z.literal(false),
    executes_action: z.literal(false),
    dispatches_tool: z.literal(false),
    writes_persistence: z.literal(false),
    wires_runtime: z.literal(false),
  });

export const ApprovalExecutionPlanValidationGuardResultSchema = z.strictObject({
  guard_id: ApprovalExecutionPlanValidationGuardIdSchema,
  passed: z.boolean(),
  severity: ApprovalExecutionPlanValidationGuardSeveritySchema,
  reason_code: ApprovalExecutionPlanValidationReasonCodeSchema,
  redaction_status: ApprovalRedactionStatusSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  checked_at_source: z.literal("approval_execution_plan_validation_matrix"),
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

export const ApprovalExecutionPlanValidationPolicyMatrixSchema = z.strictObject(
  {
    contract_version: z.literal(
      APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION,
    ),
    matrix_id: z.literal("approval_execution_plan_validation_matrix"),
    phase: z.literal(18),
    slice: z.literal("18E.2"),
    metadata_only: z.literal(true),
    guard_matrix_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    non_authoritative: z.literal(true),
    non_executing: z.literal(true),
    non_persistent: z.literal(true),
    plan_guards: z.array(ApprovalExecutionPlanValidationGuardDeclarationSchema),
    step_guards: z.array(ApprovalExecutionPlanValidationGuardDeclarationSchema),
    target_guards: z.array(
      ApprovalExecutionPlanValidationGuardDeclarationSchema,
    ),
    dry_run_guards: z.array(
      ApprovalExecutionPlanValidationGuardDeclarationSchema,
    ),
    disabled_authority_guards: z.array(
      ApprovalExecutionPlanValidationGuardDeclarationSchema,
    ),
    approval_creation_supported: z.literal(false),
    approval_decision_handling_supported: z.literal(false),
    lifecycle_advancement_supported: z.literal(false),
    authority_grant_supported: z.literal(false),
    token_issue_supported: z.literal(false),
    execution_supported: z.literal(false),
    dispatch_supported: z.literal(false),
    tool_calls_supported: z.literal(false),
    verification_supported: z.literal(false),
    compensation_supported: z.literal(false),
    rollback_supported: z.literal(false),
    persistence_supported: z.literal(false),
    event_store_writes_supported: z.literal(false),
    telemetry_writes_supported: z.literal(false),
    ui_rendering_supported: z.literal(false),
    api_routes_supported: z.literal(false),
    runtime_wiring_supported: z.literal(false),
    network_calls_supported: z.literal(false),
  },
);

export type ApprovalExecutionPlanValidationGuardDeclaration = z.infer<
  typeof ApprovalExecutionPlanValidationGuardDeclarationSchema
>;
export type ApprovalExecutionPlanValidationGuardResult = z.infer<
  typeof ApprovalExecutionPlanValidationGuardResultSchema
>;
export type ApprovalExecutionPlanValidationPolicyMatrix = z.infer<
  typeof ApprovalExecutionPlanValidationPolicyMatrixSchema
>;

const GUARD_REASON_BY_ID = {
  known_proposal_kind_only: "unknown_proposal_kind",
  known_inert_plan_status_only: "unknown_plan_status",
  executable_status_rejected: "executable_plan_status",
  plan_replay_safe: "plan_not_replay_safe",
  plan_redaction_safe: "plan_not_redaction_safe",
  raw_payloads_forbidden: "raw_payload_present",
  secrets_forbidden: "secret_material_present",
  step_dry_run_required: "step_dry_run_not_required",
  step_execution_disabled: "step_execution_enabled",
  step_dispatch_disabled: "step_dispatch_enabled",
  step_verification_required_metadata_true:
    "step_verification_metadata_missing",
  step_compensation_hint_metadata_available_true:
    "step_compensation_hint_missing",
  target_raw_payloads_excluded: "target_raw_payload_present",
  dry_run_metadata_required: "dry_run_metadata_missing",
  dry_run_execution_disabled: "dry_run_execution_enabled",
  dry_run_dispatch_disabled: "dry_run_dispatch_enabled",
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
  compensation_disabled: "compensation_enabled",
  rollback_disabled: "rollback_enabled",
  persistence_disabled: "persistence_enabled",
  telemetry_write_disabled: "telemetry_write_enabled",
} as const satisfies Record<
  ApprovalExecutionPlanValidationGuardId,
  ApprovalExecutionPlanValidationReasonCode
>;

const GUARD_APPLIES_TO = {
  known_proposal_kind_only: "execution_plan",
  known_inert_plan_status_only: "execution_plan",
  executable_status_rejected: "execution_plan",
  plan_replay_safe: "execution_plan",
  plan_redaction_safe: "execution_plan",
  raw_payloads_forbidden: "execution_plan",
  secrets_forbidden: "execution_plan",
  step_dry_run_required: "execution_step_metadata",
  step_execution_disabled: "execution_step_metadata",
  step_dispatch_disabled: "execution_step_metadata",
  step_verification_required_metadata_true: "execution_step_metadata",
  step_compensation_hint_metadata_available_true: "execution_step_metadata",
  target_raw_payloads_excluded: "execution_target_metadata",
  dry_run_metadata_required: "execution_dry_run_metadata",
  dry_run_execution_disabled: "execution_dry_run_metadata",
  dry_run_dispatch_disabled: "execution_dry_run_metadata",
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
  compensation_disabled: "disabled_authority_flags",
  rollback_disabled: "disabled_authority_flags",
  persistence_disabled: "disabled_authority_flags",
  telemetry_write_disabled: "disabled_authority_flags",
} as const satisfies Record<
  ApprovalExecutionPlanValidationGuardId,
  ApprovalExecutionPlanValidationGuardDeclaration["applies_to"]
>;

function guardDeclaration(
  guard_id: ApprovalExecutionPlanValidationGuardId,
): ApprovalExecutionPlanValidationGuardDeclaration {
  return ApprovalExecutionPlanValidationGuardDeclarationSchema.parse({
    guard_id,
    applies_to: GUARD_APPLIES_TO[guard_id],
    severity: "error",
    failure_reason_code: GUARD_REASON_BY_ID[guard_id],
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    grants_authority: false,
    advances_lifecycle_state: false,
    issues_token: false,
    executes_action: false,
    dispatches_tool: false,
    writes_persistence: false,
    wires_runtime: false,
  });
}

export const DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX =
  ApprovalExecutionPlanValidationPolicyMatrixSchema.parse({
    contract_version: APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION,
    matrix_id: "approval_execution_plan_validation_matrix",
    phase: 18,
    slice: "18E.2",
    metadata_only: true,
    guard_matrix_only: true,
    replay_safe: true,
    redaction_safe: true,
    non_authoritative: true,
    non_executing: true,
    non_persistent: true,
    plan_guards: (
      [
        "known_proposal_kind_only",
        "known_inert_plan_status_only",
        "executable_status_rejected",
        "plan_replay_safe",
        "plan_redaction_safe",
        "raw_payloads_forbidden",
        "secrets_forbidden",
      ] as const
    ).map(guardDeclaration),
    step_guards: (
      [
        "step_dry_run_required",
        "step_execution_disabled",
        "step_dispatch_disabled",
        "step_verification_required_metadata_true",
        "step_compensation_hint_metadata_available_true",
      ] as const
    ).map(guardDeclaration),
    target_guards: (["target_raw_payloads_excluded"] as const).map(
      guardDeclaration,
    ),
    dry_run_guards: (
      [
        "dry_run_metadata_required",
        "dry_run_execution_disabled",
        "dry_run_dispatch_disabled",
      ] as const
    ).map(guardDeclaration),
    disabled_authority_guards: (
      [
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
        "compensation_disabled",
        "rollback_disabled",
        "persistence_disabled",
        "telemetry_write_disabled",
      ] as const
    ).map(guardDeclaration),
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    runtime_wiring_supported: false,
    network_calls_supported: false,
  });

function guardResult(input: {
  readonly guard_id: ApprovalExecutionPlanValidationGuardId;
  readonly passed: boolean;
  readonly reason_code?: ApprovalExecutionPlanValidationReasonCode;
}): ApprovalExecutionPlanValidationGuardResult {
  return ApprovalExecutionPlanValidationGuardResultSchema.parse({
    guard_id: input.guard_id,
    passed: input.passed,
    severity: input.passed ? "info" : "error",
    reason_code:
      input.reason_code ??
      (input.passed ? "passed" : GUARD_REASON_BY_ID[input.guard_id]),
    redaction_status: "metadata_only",
    replay_safe: true,
    redaction_safe: true,
    checked_at_source: "approval_execution_plan_validation_matrix",
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

function dryRunField(input: unknown, field: string): unknown {
  const dryRunMetadata = recordField(input, "dry_run_metadata");
  if (
    dryRunMetadata &&
    typeof dryRunMetadata === "object" &&
    field in dryRunMetadata
  ) {
    return (dryRunMetadata as Record<string, unknown>)[field];
  }

  return undefined;
}

function targetField(input: unknown, field: string): unknown {
  const targetMetadata = recordField(input, "target_metadata");
  if (
    targetMetadata &&
    typeof targetMetadata === "object" &&
    field in targetMetadata
  ) {
    return (targetMetadata as Record<string, unknown>)[field];
  }

  return undefined;
}

function stepMetadata(input: unknown): readonly Record<string, unknown>[] {
  const steps = recordField(input, "step_metadata");
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.filter(
    (step): step is Record<string, unknown> =>
      !!step && typeof step === "object",
  );
}

function everyStepField(
  input: unknown,
  field: string,
  value: unknown,
): boolean {
  const steps = stepMetadata(input);
  return steps.length > 0 && steps.every((step) => step[field] === value);
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

function excludesRawPayloads(input: unknown): boolean {
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
    recordField(input, "raw_memory_content_included") === false
  );
}

function excludesSecrets(input: unknown): boolean {
  const keys = collectKeys(input);
  if (keys.some((key) => FORBIDDEN_SECRET_KEYS.has(key))) {
    return false;
  }

  return recordField(input, "secret_material_included") === false;
}

function targetExcludesRawPayloads(input: unknown): boolean {
  return (
    targetField(input, "raw_target_payload_included") === false &&
    targetField(input, "raw_project_content_included") === false &&
    targetField(input, "raw_memory_content_included") === false &&
    targetField(input, "raw_device_payload_included") === false
  );
}

export function validateApprovalExecutionPlanPolicyMetadata(
  input: unknown,
): readonly ApprovalExecutionPlanValidationGuardResult[] {
  const proposalKind = recordField(input, "proposal_kind");
  const status = recordField(input, "status");
  const parsed = ApprovalExecutionPlanMetadataSchema.safeParse(input);

  return [
    guardResult({
      guard_id: "known_proposal_kind_only",
      passed:
        ApprovalProposalRegistryKindSchema.safeParse(proposalKind).success,
    }),
    guardResult({
      guard_id: "known_inert_plan_status_only",
      passed:
        ApprovalExecutionPlanStatusSchema.safeParse(status).success &&
        !ApprovalExecutionPlanForbiddenStatusSchema.safeParse(status).success,
    }),
    guardResult({
      guard_id: "executable_status_rejected",
      passed:
        !ApprovalExecutionPlanForbiddenStatusSchema.safeParse(status).success,
    }),
    guardResult({
      guard_id: "plan_replay_safe",
      passed: hasReplaySafeMetadata(input),
    }),
    guardResult({
      guard_id: "plan_redaction_safe",
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
      guard_id: "step_dry_run_required",
      passed: everyStepField(input, "dry_run_required", true),
    }),
    guardResult({
      guard_id: "step_execution_disabled",
      passed: everyStepField(input, "execution_enabled", false),
    }),
    guardResult({
      guard_id: "step_dispatch_disabled",
      passed: everyStepField(input, "dispatch_enabled", false),
    }),
    guardResult({
      guard_id: "step_verification_required_metadata_true",
      passed: everyStepField(input, "verification_required_metadata", true),
    }),
    guardResult({
      guard_id: "step_compensation_hint_metadata_available_true",
      passed: everyStepField(
        input,
        "compensation_hint_metadata_available",
        true,
      ),
    }),
    guardResult({
      guard_id: "target_raw_payloads_excluded",
      passed: targetExcludesRawPayloads(input),
    }),
    guardResult({
      guard_id: "dry_run_metadata_required",
      passed: dryRunField(input, "dry_run_required") === true,
    }),
    guardResult({
      guard_id: "dry_run_execution_disabled",
      passed: dryRunField(input, "dry_run_execution_enabled") === false,
    }),
    guardResult({
      guard_id: "dry_run_dispatch_disabled",
      passed: dryRunField(input, "dry_run_dispatch_enabled") === false,
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
      guard_id: "compensation_disabled",
      passed:
        disabledFlag(input, "compensation_enabled") === false &&
        recordField(input, "compensation_performed") === false,
    }),
    guardResult({
      guard_id: "rollback_disabled",
      passed:
        disabledFlag(input, "rollback_enabled") === false &&
        recordField(input, "rollback_performed") === false,
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
