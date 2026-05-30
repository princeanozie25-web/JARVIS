import { z } from "zod";

import {
  ApprovalExecutionAuthorityScopeGuardResultSchema,
  validateApprovalAuthorityTokenScopeMetadata,
} from "./execution-authority-scope";
import {
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
  ApprovalExecutionAuthorityTokenMetadataSchema,
} from "./execution-authority-token";

export const APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT_VERSION =
  "18C.3" as const;

export const APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS = 300_000 as const;
export const APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS = 300_000 as const;

export const APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS = [
  "expired_by_policy",
  "expired_by_window",
  "expired_by_session_boundary",
  "expired_by_scope_violation",
  "expired_by_review_closure",
  "invalid_expiry_metadata",
] as const;

export type ApprovalExecutionAuthorityExpiryReason =
  (typeof APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS)[number];

export const ApprovalExecutionAuthorityExpiryReasonSchema = z.enum(
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS,
);

export const ApprovalExecutionAuthorityExpiryPolicySchema = z.strictObject({
  default_expiry_ms: z.literal(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS),
  max_expiry_ms: z.literal(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS),
  cross_session_valid: z.literal(false),
  renewal_allowed: z.literal(false),
  refresh_allowed: z.literal(false),
  indefinite_authority_allowed: z.literal(false),
  background_expiry_extension_allowed: z.literal(false),
  voice_extension_allowed: z.literal(false),
  scheduler_extension_allowed: z.literal(false),
  network_extension_allowed: z.literal(false),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
});

export const ApprovalExecutionAuthorityExpiryWindowMetadataSchema =
  z.strictObject({
    token_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    issued_at_ms: z.number().int().nonnegative(),
    expires_at_ms: z.number().int().nonnegative(),
    expiry_window_ms: z
      .number()
      .int()
      .nonnegative()
      .max(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS),
    default_expiry_ms: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
    ),
    max_expiry_ms: z.literal(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS),
    cross_session_valid: z.literal(false),
    renewal_allowed: z.literal(false),
    refresh_allowed: z.literal(false),
    indefinite_authority_allowed: z.literal(false),
    background_expiry_extension_allowed: z.literal(false),
    voice_extension_allowed: z.literal(false),
    scheduler_extension_allowed: z.literal(false),
    network_extension_allowed: z.literal(false),
    timers_registered: z.literal(false),
    scheduler_registered: z.literal(false),
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

export const ApprovalExecutionAuthorityExpiryDisabledGuardOutputSchema =
  z.strictObject({
    authority_granted: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    renewal_enabled: z.literal(false),
    refresh_enabled: z.literal(false),
    extension_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    approval_decision_handling_enabled: z.literal(false),
    usable_authority_enabled: z.literal(false),
    active_token_enabled: z.literal(false),
    token_signing_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    event_store_write_enabled: z.literal(false),
    telemetry_write_enabled: z.literal(false),
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

export const ApprovalExecutionAuthorityExpiryEvaluationMetadataSchema =
  z.strictObject({
    evaluation_id: z.literal("approval_execution_authority_expiry_evaluation"),
    evaluated_at_source: z.literal("shape_only_metadata"),
    token_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/)
      .nullable(),
    scope_guard_result: ApprovalExecutionAuthorityScopeGuardResultSchema,
    expiry_reason: ApprovalExecutionAuthorityExpiryReasonSchema.nullable(),
    expired: z.boolean(),
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    authority_granted: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
  });

export const ApprovalExecutionAuthorityExpiryGuardOutputSchema = z.strictObject(
  {
    contract_version: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT_VERSION,
    ),
    guard_output_id: z.literal("approval_execution_authority_expiry_guard"),
    passed: z.boolean(),
    expiry_reason: ApprovalExecutionAuthorityExpiryReasonSchema.nullable(),
    token_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/)
      .nullable(),
    expiry_window_metadata:
      ApprovalExecutionAuthorityExpiryWindowMetadataSchema.nullable(),
    evaluation_metadata:
      ApprovalExecutionAuthorityExpiryEvaluationMetadataSchema,
    metadata_only: z.literal(true),
    shape_validation_only: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    disabled_authority:
      ApprovalExecutionAuthorityExpiryDisabledGuardOutputSchema,
    authority_granted: z.literal(false),
    execution_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    renewal_enabled: z.literal(false),
    refresh_enabled: z.literal(false),
    extension_enabled: z.literal(false),
    lifecycle_advancement_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    raw_payload_included: z.literal(false),
    raw_tool_arguments_included: z.literal(false),
    raw_prompt_included: z.literal(false),
    raw_model_output_included: z.literal(false),
    raw_device_payload_included: z.literal(false),
    raw_project_content_included: z.literal(false),
    raw_memory_content_included: z.literal(false),
    secret_material_included: z.literal(false),
  },
);

export const ApprovalExecutionAuthorityExpiryPolicyContractSchema =
  z.strictObject({
    contract_version: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT_VERSION,
    ),
    contract_id: z.literal("approval_execution_authority_expiry_contract"),
    token_contract_version: z.literal(
      APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    ),
    phase: z.literal(18),
    slice: z.literal("18C.3"),
    metadata_only: z.literal(true),
    expiry_policy_only: z.literal(true),
    non_authoritative: z.literal(true),
    non_executing: z.literal(true),
    replay_safe: z.literal(true),
    redaction_safe: z.literal(true),
    policy: ApprovalExecutionAuthorityExpiryPolicySchema,
    expiry_reasons: z.array(ApprovalExecutionAuthorityExpiryReasonSchema),
    disabled_authority:
      ApprovalExecutionAuthorityExpiryDisabledGuardOutputSchema,
    approval_creation_supported: z.literal(false),
    approval_decision_handling_supported: z.literal(false),
    authority_grant_supported: z.literal(false),
    usable_authority_supported: z.literal(false),
    active_token_supported: z.literal(false),
    renewal_supported: z.literal(false),
    refresh_supported: z.literal(false),
    expiry_extension_supported: z.literal(false),
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

export type ApprovalExecutionAuthorityExpiryPolicy = z.infer<
  typeof ApprovalExecutionAuthorityExpiryPolicySchema
>;
export type ApprovalExecutionAuthorityExpiryWindowMetadata = z.infer<
  typeof ApprovalExecutionAuthorityExpiryWindowMetadataSchema
>;
export type ApprovalExecutionAuthorityExpiryDisabledGuardOutput = z.infer<
  typeof ApprovalExecutionAuthorityExpiryDisabledGuardOutputSchema
>;
export type ApprovalExecutionAuthorityExpiryEvaluationMetadata = z.infer<
  typeof ApprovalExecutionAuthorityExpiryEvaluationMetadataSchema
>;
export type ApprovalExecutionAuthorityExpiryGuardOutput = z.infer<
  typeof ApprovalExecutionAuthorityExpiryGuardOutputSchema
>;
export type ApprovalExecutionAuthorityExpiryPolicyContract = z.infer<
  typeof ApprovalExecutionAuthorityExpiryPolicyContractSchema
>;

const DISABLED_EXPIRY_GUARD_OUTPUT =
  ApprovalExecutionAuthorityExpiryDisabledGuardOutputSchema.parse({
    authority_granted: false,
    execution_enabled: false,
    dispatch_enabled: false,
    renewal_enabled: false,
    refresh_enabled: false,
    extension_enabled: false,
    lifecycle_advancement_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
    approval_creation_enabled: false,
    approval_decision_handling_enabled: false,
    usable_authority_enabled: false,
    active_token_enabled: false,
    token_signing_enabled: false,
    persistence_enabled: false,
    event_store_write_enabled: false,
    telemetry_write_enabled: false,
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

const DEFAULT_EXPIRY_POLICY =
  ApprovalExecutionAuthorityExpiryPolicySchema.parse({
    default_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
    max_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
    cross_session_valid: false,
    renewal_allowed: false,
    refresh_allowed: false,
    indefinite_authority_allowed: false,
    background_expiry_extension_allowed: false,
    voice_extension_allowed: false,
    scheduler_extension_allowed: false,
    network_extension_allowed: false,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
  });

export const DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT =
  ApprovalExecutionAuthorityExpiryPolicyContractSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT_VERSION,
    contract_id: "approval_execution_authority_expiry_contract",
    token_contract_version: APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT_VERSION,
    phase: 18,
    slice: "18C.3",
    metadata_only: true,
    expiry_policy_only: true,
    non_authoritative: true,
    non_executing: true,
    replay_safe: true,
    redaction_safe: true,
    policy: DEFAULT_EXPIRY_POLICY,
    expiry_reasons: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS,
    disabled_authority: DISABLED_EXPIRY_GUARD_OUTPUT,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    authority_grant_supported: false,
    usable_authority_supported: false,
    active_token_supported: false,
    renewal_supported: false,
    refresh_supported: false,
    expiry_extension_supported: false,
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

function tokenRefHash(input: unknown): `hash:${string}` | null {
  if (!input || typeof input !== "object" || !("token_ref_hash" in input)) {
    return null;
  }

  const tokenRefHashValue = (input as { readonly token_ref_hash?: unknown })
    .token_ref_hash;
  if (typeof tokenRefHashValue !== "string") {
    return null;
  }

  if (!/^hash:[a-z0-9._:-]+$/.test(tokenRefHashValue)) {
    return null;
  }

  return tokenRefHashValue as `hash:${string}`;
}

function guardOutput(input: {
  readonly passed: boolean;
  readonly expiry_reason: ApprovalExecutionAuthorityExpiryReason | null;
  readonly expiry_window_metadata?: ApprovalExecutionAuthorityExpiryWindowMetadata | null;
  readonly token_ref_hash?: `hash:${string}` | null;
}): ApprovalExecutionAuthorityExpiryGuardOutput {
  const scopeGuardResult = input.expiry_window_metadata
    ? validateApprovalAuthorityTokenScopeMetadata({
        token_id: input.expiry_window_metadata.token_ref_hash.replace(
          /^hash:authority-token-/,
          "authority-token:",
        ),
        scope_metadata: {
          proposal_kind: "note_create",
          target_class: "obsidian_note",
          risk_class: "medium",
          single_action_only: true,
          cross_session_valid: false,
          multi_step_graph_allowed: false,
          voice_grant_allowed: false,
          auto_grant_allowed: false,
        },
        expiry_metadata: {
          expires_at_ms: input.expiry_window_metadata.expires_at_ms,
          expiry_display_only: true,
          usable_after_expiry: false,
          lifecycle_expiry_decision: false,
          timers_registered: false,
          scheduler_registered: false,
          metadata_only: true,
        },
      })
    : validateApprovalAuthorityTokenScopeMetadata(null);

  return ApprovalExecutionAuthorityExpiryGuardOutputSchema.parse({
    contract_version: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT_VERSION,
    guard_output_id: "approval_execution_authority_expiry_guard",
    passed: input.passed,
    expiry_reason: input.expiry_reason,
    token_ref_hash: input.token_ref_hash ?? null,
    expiry_window_metadata: input.expiry_window_metadata ?? null,
    evaluation_metadata: {
      evaluation_id: "approval_execution_authority_expiry_evaluation",
      evaluated_at_source: "shape_only_metadata",
      token_ref_hash: input.token_ref_hash ?? null,
      scope_guard_result: scopeGuardResult,
      expiry_reason: input.expiry_reason,
      expired: input.expiry_reason !== null,
      metadata_only: true,
      shape_validation_only: true,
      replay_safe: true,
      redaction_safe: true,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      lifecycle_advancement_enabled: false,
    },
    metadata_only: true,
    shape_validation_only: true,
    replay_safe: true,
    redaction_safe: true,
    disabled_authority: DISABLED_EXPIRY_GUARD_OUTPUT,
    authority_granted: false,
    execution_enabled: false,
    dispatch_enabled: false,
    renewal_enabled: false,
    refresh_enabled: false,
    extension_enabled: false,
    lifecycle_advancement_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    rollback_enabled: false,
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

function hashFromAuthorityTokenId(tokenId: string): `hash:${string}` {
  return `hash:${tokenId.replace(/^authority-token:/, "authority-token-")}`;
}

export function buildApprovalAuthorityExpiryWindowMetadata(input: {
  readonly authority_token: unknown;
  readonly issued_at_ms: number;
}): ApprovalExecutionAuthorityExpiryWindowMetadata {
  const token = ApprovalExecutionAuthorityTokenMetadataSchema.parse(
    input.authority_token,
  );
  const expiryWindowMs =
    token.expiry_metadata.expires_at_ms - input.issued_at_ms;

  return ApprovalExecutionAuthorityExpiryWindowMetadataSchema.parse({
    token_ref_hash: hashFromAuthorityTokenId(token.token_id),
    issued_at_ms: input.issued_at_ms,
    expires_at_ms: token.expiry_metadata.expires_at_ms,
    expiry_window_ms: expiryWindowMs,
    default_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
    max_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
    cross_session_valid: false,
    renewal_allowed: false,
    refresh_allowed: false,
    indefinite_authority_allowed: false,
    background_expiry_extension_allowed: false,
    voice_extension_allowed: false,
    scheduler_extension_allowed: false,
    network_extension_allowed: false,
    timers_registered: false,
    scheduler_registered: false,
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

export function evaluateApprovalAuthorityExpiryMetadataShape(
  input: unknown,
): ApprovalExecutionAuthorityExpiryGuardOutput {
  const tokenHash = tokenRefHash(input);

  if (
    input &&
    typeof input === "object" &&
    "indefinite_authority_allowed" in input &&
    (input as { readonly indefinite_authority_allowed?: unknown })
      .indefinite_authority_allowed === true
  ) {
    return guardOutput({
      passed: false,
      expiry_reason: "invalid_expiry_metadata",
      token_ref_hash: tokenHash,
    });
  }

  if (
    input &&
    typeof input === "object" &&
    "cross_session_valid" in input &&
    (input as { readonly cross_session_valid?: unknown })
      .cross_session_valid === true
  ) {
    return guardOutput({
      passed: false,
      expiry_reason: "expired_by_session_boundary",
      token_ref_hash: tokenHash,
    });
  }

  if (
    input &&
    typeof input === "object" &&
    "expiry_window_ms" in input &&
    typeof (input as { readonly expiry_window_ms?: unknown })
      .expiry_window_ms === "number" &&
    (input as { readonly expiry_window_ms: number }).expiry_window_ms >
      APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS
  ) {
    return guardOutput({
      passed: false,
      expiry_reason: "expired_by_policy",
      token_ref_hash: tokenHash,
    });
  }

  const parsed =
    ApprovalExecutionAuthorityExpiryWindowMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return guardOutput({
      passed: false,
      expiry_reason: "invalid_expiry_metadata",
      token_ref_hash: tokenHash,
    });
  }

  return guardOutput({
    passed: true,
    expiry_reason: null,
    expiry_window_metadata: parsed.data,
    token_ref_hash: parsed.data.token_ref_hash as `hash:${string}`,
  });
}
