import { z } from "zod";

import {
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
  ApprovalExecutionAuthorityTokenMetadataSchema,
} from "./execution-authority-token";
import {
  ApprovalProposalRegistryKindSchema,
  ApprovalProposalTargetKindSchema,
} from "./proposal-registry";
import { ApprovalRiskClassSchema } from "./types";

export const APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT_VERSION =
  "18C.2" as const;

export const APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_IDS = [
  "single_action_only_required",
  "cross_session_valid_forbidden",
  "multi_step_graph_forbidden",
  "voice_grant_forbidden",
  "auto_grant_forbidden",
  "approval_inheritance_forbidden",
  "reusable_token_forbidden",
  "delegated_authority_forbidden",
  "background_execution_forbidden",
  "scheduler_grant_forbidden",
  "network_grant_forbidden",
] as const;

export const APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS = [
  "single_action_only",
  "cross_session_valid",
  "multi_step_graph_allowed",
  "voice_grant_allowed",
  "auto_grant_allowed",
  "approval_inheritance_allowed",
  "reusable_token_allowed",
  "delegated_authority_allowed",
  "background_execution_allowed",
  "scheduler_grant_allowed",
  "network_grant_allowed",
] as const;

export const APPROVAL_EXECUTION_AUTHORITY_SCOPE_VALIDATION_REASONS = [
  "valid_token_scope",
  "invalid_token_metadata",
  "scope_constraint_violation",
] as const;

export type ApprovalExecutionAuthorityScopeGuardId =
  (typeof APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_IDS)[number];
export type ApprovalExecutionAuthorityScopeConstraintKey =
  (typeof APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS)[number];
export type ApprovalExecutionAuthorityScopeValidationReason =
  (typeof APPROVAL_EXECUTION_AUTHORITY_SCOPE_VALIDATION_REASONS)[number];

export const ApprovalExecutionAuthorityScopeGuardIdSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_IDS,
);
export const ApprovalExecutionAuthorityScopeConstraintKeySchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS,
);
export const ApprovalExecutionAuthorityScopeValidationReasonSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_VALIDATION_REASONS,
);

export const ApprovalExecutionAuthorityScopeConstraintDeclarationSchema =
  z.strictObject({
    guard_id: ApprovalExecutionAuthorityScopeGuardIdSchema,
    constraint_key: ApprovalExecutionAuthorityScopeConstraintKeySchema,
    expected_value: z.boolean(),
    failure_reason: z.string().trim().min(1).max(120),
    metadata_only: z.literal(true),
    authority_grant_supported: z.literal(false),
    execution_supported: z.literal(false),
  });

export const ApprovalExecutionAuthorityScopeConstraintMetadataSchema =
  z.strictObject({
    proposal_kind: ApprovalProposalRegistryKindSchema,
    target_class: ApprovalProposalTargetKindSchema,
    risk_class: ApprovalRiskClassSchema,
    single_action_only: z.literal(true),
    cross_session_valid: z.literal(false),
    multi_step_graph_allowed: z.literal(false),
    voice_grant_allowed: z.literal(false),
    auto_grant_allowed: z.literal(false),
    approval_inheritance_allowed: z.literal(false),
    reusable_token_allowed: z.literal(false),
    delegated_authority_allowed: z.literal(false),
    background_execution_allowed: z.literal(false),
    scheduler_grant_allowed: z.literal(false),
    network_grant_allowed: z.literal(false),
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
    secret_material_included: z.literal(false),
  });

export const ApprovalExecutionAuthorityScopeDisabledGuardOutputSchema =
  z.strictObject({
    authority_granted: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    usable_authority_enabled: z.literal(false),
    active_token_enabled: z.literal(false),
    token_signing_enabled: z.literal(false),
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

export const ApprovalExecutionAuthorityScopeGuardResultSchema = z.strictObject({
  contract_version: z.literal(
    APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT_VERSION,
  ),
  guard_result_id: z.literal("approval_execution_authority_scope_guard"),
  passed: z.boolean(),
  reason: ApprovalExecutionAuthorityScopeValidationReasonSchema,
  violated_constraint:
    ApprovalExecutionAuthorityScopeConstraintKeySchema.nullable(),
  token_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .nullable(),
  metadata_only: z.literal(true),
  shape_validation_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  disabled_authority: ApprovalExecutionAuthorityScopeDisabledGuardOutputSchema,
  authority_granted: z.literal(false),
  execution_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  lifecycle_advancement_enabled: z.literal(false),
  verification_enabled: z.literal(false),
  compensation_enabled: z.literal(false),
  rollback_enabled: z.literal(false),
  persistence_enabled: z.literal(false),
  telemetry_write_enabled: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ApprovalExecutionAuthorityScopeGuardContractSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT_VERSION,
    ),
    contract_id: z.literal("approval_execution_authority_scope_guard_contract"),
    token_contract_version: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    ),
    phase: z.literal(18),
    slice: z.literal("18C.2"),
    metadata_only: z.literal(true),
    scope_guard_only: z.literal(true),
    non_authoritative: z.literal(true),
    non_executing: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    constraints: z.array(
      ApprovalExecutionAuthorityScopeConstraintDeclarationSchema,
    ),
    disabled_authority:
      ApprovalExecutionAuthorityScopeDisabledGuardOutputSchema,
    approval_creation_supported: z.literal(false),
    approval_decision_handling_supported: z.literal(false),
    authority_grant_supported: z.literal(false),
    usable_authority_supported: z.literal(false),
    active_token_supported: z.literal(false),
    token_signing_supported: z.literal(false),
    execution_supported: z.literal(false),
    dispatch_supported: z.literal(false),
    lifecycle_advancement_supported: z.literal(false),
    verification_supported: z.literal(false),
    compensation_supported: z.literal(false),
    rollback_supported: z.literal(false),
    persistence_supported: z.literal(false),
    telemetry_writes_supported: z.literal(false),
    network_cloud_calls_supported: z.literal(false),
  });

export type ApprovalExecutionAuthorityScopeConstraintDeclaration = z.infer<
  typeof ApprovalExecutionAuthorityScopeConstraintDeclarationSchema
>;
export type ApprovalExecutionAuthorityScopeConstraintMetadata = z.infer<
  typeof ApprovalExecutionAuthorityScopeConstraintMetadataSchema
>;
export type ApprovalExecutionAuthorityScopeDisabledGuardOutput = z.infer<
  typeof ApprovalExecutionAuthorityScopeDisabledGuardOutputSchema
>;
export type ApprovalExecutionAuthorityScopeGuardResult = z.infer<
  typeof ApprovalExecutionAuthorityScopeGuardResultSchema
>;
export type ApprovalExecutionAuthorityScopeGuardContract = z.infer<
  typeof ApprovalExecutionAuthorityScopeGuardContractSchema
>;

const DISABLED_SCOPE_GUARD_OUTPUT =
  ApprovalExecutionAuthorityScopeDisabledGuardOutputSchema.parse({
    authority_granted: false,
    execution_enabled: false,
    dispatch_enabled: false,
    lifecycle_advancement_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    persistence_enabled: false,
    telemetry_write_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    usable_authority_enabled: false,
    active_token_enabled: false,
    token_signing_enabled: false,
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
  });

const SCOPE_CONSTRAINTS = [
  {
    guard_id: "single_action_only_required",
    constraint_key: "single_action_only",
    expected_value: true,
    failure_reason: "authority token scope must remain single-action only",
  },
  {
    guard_id: "cross_session_valid_forbidden",
    constraint_key: "cross_session_valid",
    expected_value: false,
    failure_reason: "authority token scope must not cross sessions",
  },
  {
    guard_id: "multi_step_graph_forbidden",
    constraint_key: "multi_step_graph_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow multi-step graphs",
  },
  {
    guard_id: "voice_grant_forbidden",
    constraint_key: "voice_grant_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow voice grants",
  },
  {
    guard_id: "auto_grant_forbidden",
    constraint_key: "auto_grant_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow automatic grants",
  },
  {
    guard_id: "approval_inheritance_forbidden",
    constraint_key: "approval_inheritance_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not inherit approval",
  },
  {
    guard_id: "reusable_token_forbidden",
    constraint_key: "reusable_token_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not be reusable",
  },
  {
    guard_id: "delegated_authority_forbidden",
    constraint_key: "delegated_authority_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not delegate authority",
  },
  {
    guard_id: "background_execution_forbidden",
    constraint_key: "background_execution_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow background work",
  },
  {
    guard_id: "scheduler_grant_forbidden",
    constraint_key: "scheduler_grant_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow scheduler grants",
  },
  {
    guard_id: "network_grant_forbidden",
    constraint_key: "network_grant_allowed",
    expected_value: false,
    failure_reason: "authority token scope must not allow network grants",
  },
] as const satisfies readonly {
  readonly guard_id: ApprovalExecutionAuthorityScopeGuardId;
  readonly constraint_key: ApprovalExecutionAuthorityScopeConstraintKey;
  readonly expected_value: boolean;
  readonly failure_reason: string;
}[];

export const DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT =
  ApprovalExecutionAuthorityScopeGuardContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT_VERSION,
    contract_id: "approval_execution_authority_scope_guard_contract",
    token_contract_version: APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    phase: 18,
    slice: "18C.2",
    metadata_only: true,
    scope_guard_only: true,
    non_authoritative: true,
    non_executing: true,
    replay_safe: true,
    redaction_safe: true,
    constraints: SCOPE_CONSTRAINTS.map((constraint) => ({
      ...constraint,
      metadata_only: true,
      authority_grant_supported: false,
      execution_supported: false,
    })),
    disabled_authority: DISABLED_SCOPE_GUARD_OUTPUT,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    authority_grant_supported: false,
    usable_authority_supported: false,
    active_token_supported: false,
    token_signing_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    lifecycle_advancement_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    telemetry_writes_supported: false,
    network_cloud_calls_supported: false,
  });

function guardResult(input: {
  readonly passed: boolean;
  readonly reason: ApprovalExecutionAuthorityScopeValidationReason;
  readonly violated_constraint?: ApprovalExecutionAuthorityScopeConstraintKey | null;
  readonly token_ref_hash?: `hash:${string}` | null;
}): ApprovalExecutionAuthorityScopeGuardResult {
  return ApprovalExecutionAuthorityScopeGuardResultSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT_VERSION,
    guard_result_id: "approval_execution_authority_scope_guard",
    passed: input.passed,
    reason: input.reason,
    violated_constraint: input.violated_constraint ?? null,
    token_ref_hash: input.token_ref_hash ?? null,
    metadata_only: true,
    shape_validation_only: true,
    replay_safe: true,
    redaction_safe: true,
    disabled_authority: DISABLED_SCOPE_GUARD_OUTPUT,
    authority_granted: false,
    execution_enabled: false,
    dispatch_enabled: false,
    lifecycle_advancement_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    persistence_enabled: false,
    telemetry_write_enabled: false,
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

function tokenRefHash(input: unknown): `hash:${string}` | null {
  if (!input || typeof input !== "object" || !("token_id" in input)) {
    return null;
  }

  const tokenId = (input as { readonly token_id?: unknown }).token_id;
  if (typeof tokenId !== "string") {
    return null;
  }

  return `hash:${tokenId.replace(/^authority-token:/, "authority-token-")}`;
}

function scopeMetadata(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || !("scope_metadata" in input)) {
    return null;
  }

  const scope = (input as { readonly scope_metadata?: unknown }).scope_metadata;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }

  return scope as Record<string, unknown>;
}

export function buildApprovalAuthorityScopeConstraints(input: {
  readonly authority_token: unknown;
}): ApprovalExecutionAuthorityScopeConstraintMetadata {
  const token = ApprovalExecutionAuthorityTokenMetadataSchema.parse(
    input.authority_token,
  );

  return ApprovalExecutionAuthorityScopeConstraintMetadataSchema.parse({
    ...token.scope_metadata,
    approval_inheritance_allowed: false,
    reusable_token_allowed: false,
    delegated_authority_allowed: false,
    background_execution_allowed: false,
    scheduler_grant_allowed: false,
    network_grant_allowed: false,
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
    secret_material_included: false,
  });
}

export function validateApprovalAuthorityTokenScopeMetadata(
  input: unknown,
): ApprovalExecutionAuthorityScopeGuardResult {
  const scope = scopeMetadata(input);
  const tokenHash = tokenRefHash(input);

  if (!scope) {
    return guardResult({
      passed: false,
      reason: "invalid_token_metadata",
      token_ref_hash: tokenHash,
    });
  }

  for (const constraint of SCOPE_CONSTRAINTS) {
    const actualValue =
      constraint.constraint_key in scope
        ? scope[constraint.constraint_key]
        : constraint.expected_value;

    if (actualValue !== constraint.expected_value) {
      return guardResult({
        passed: false,
        reason: "scope_constraint_violation",
        violated_constraint: constraint.constraint_key,
        token_ref_hash: tokenHash,
      });
    }
  }

  const parsed = ApprovalExecutionAuthorityTokenMetadataSchema.safeParse(input);
  return guardResult({
    passed: parsed.success,
    reason: parsed.success ? "valid_token_scope" : "invalid_token_metadata",
    token_ref_hash: tokenHash,
  });
}
