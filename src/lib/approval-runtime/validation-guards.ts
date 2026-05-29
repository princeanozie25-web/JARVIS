import { z } from "zod";

import {
  ApprovalAuthorityClassSchema,
  ApprovalForbiddenCapabilitySchema,
  DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
} from "./authority-boundary";
import {
  ApprovalLifecycleRecordSchema,
  ApprovalStageTransitionSchema,
} from "./contracts";
import { validateApprovalStageTransitionDeclaration } from "./lifecycle";
import {
  ApprovalProposalKindDeclarationSchema,
  ApprovalProposalRegistryKindSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
} from "./proposal-registry";
import {
  ApprovalLifecycleStageSchema,
  ApprovalRedactionStatusSchema,
} from "./types";

export const APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION = "18A.4" as const;

export const APPROVAL_VALIDATION_GUARD_IDS = [
  "known_proposal_kind_only",
  "proposal_kind_exists_in_registry",
  "requires_approval_true",
  "dry_run_required_true",
  "execution_enabled_false",
  "verification_enabled_false",
  "compensation_enabled_false",
  "auto_approval_allowed_false",
  "voice_only_approval_allowed_false",
  "approval_inheritance_allowed_false",
  "cross_session_persistence_allowed_false",
  "lifecycle_stage_known",
  "lifecycle_transition_declared",
  "metadata_replay_safe",
  "metadata_redaction_safe",
  "forbidden_capability_rejected",
  "unknown_authority_class_rejected",
] as const;

export const APPROVAL_VALIDATION_GUARD_SEVERITIES = [
  "info",
  "warning",
  "error",
] as const;

export const APPROVAL_VALIDATION_GUARD_REASON_CODES = [
  "passed",
  "unknown_proposal_kind",
  "proposal_kind_missing_from_registry",
  "approval_not_required",
  "dry_run_not_required",
  "execution_enabled",
  "verification_enabled",
  "compensation_enabled",
  "auto_approval_enabled",
  "voice_only_approval_enabled",
  "approval_inheritance_enabled",
  "cross_session_persistence_enabled",
  "unknown_lifecycle_stage",
  "undeclared_lifecycle_transition",
  "metadata_not_replay_safe",
  "metadata_not_redaction_safe",
  "forbidden_capability",
  "unknown_authority_class",
  "invalid_guard_matrix",
  "invalid_metadata_shape",
] as const;

export type ApprovalValidationGuardId =
  (typeof APPROVAL_VALIDATION_GUARD_IDS)[number];
export type ApprovalValidationGuardSeverity =
  (typeof APPROVAL_VALIDATION_GUARD_SEVERITIES)[number];
export type ApprovalValidationGuardReasonCode =
  (typeof APPROVAL_VALIDATION_GUARD_REASON_CODES)[number];

export const ApprovalValidationGuardIdSchema = z.enum(
  APPROVAL_VALIDATION_GUARD_IDS,
);
export const ApprovalValidationGuardSeveritySchema = z.enum(
  APPROVAL_VALIDATION_GUARD_SEVERITIES,
);
export const ApprovalValidationGuardReasonCodeSchema = z.enum(
  APPROVAL_VALIDATION_GUARD_REASON_CODES,
);

export const ApprovalValidationGuardDeclarationSchema = z.strictObject({
  guard_id: ApprovalValidationGuardIdSchema,
  applies_to: z.enum(["proposal", "lifecycle_record", "authority_boundary"]),
  severity: ApprovalValidationGuardSeveritySchema,
  failure_reason_code: ApprovalValidationGuardReasonCodeSchema,
  metadata_only: z.literal(true),
  audit_preview_safe: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  grants_authority: z.literal(false),
  advances_lifecycle_state: z.literal(false),
  executes_action: z.literal(false),
  writes_persistence: z.literal(false),
});

export const ApprovalValidationGuardResultSchema = z.strictObject({
  guard_id: ApprovalValidationGuardIdSchema,
  passed: z.boolean(),
  severity: ApprovalValidationGuardSeveritySchema,
  reason_code: ApprovalValidationGuardReasonCodeSchema,
  redaction_status: ApprovalRedactionStatusSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  checked_at_source: z.enum([
    "proposal_validation_matrix",
    "lifecycle_record_validation_matrix",
    "authority_boundary_validation_matrix",
  ]),
  metadata_only: z.literal(true),
  audit_preview_safe: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_execution_command_included: z.literal(false),
  secret_material_included: z.literal(false),
  pii_included: z.literal(false),
  approval_created: z.literal(false),
  authority_granted: z.literal(false),
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
  tool_runtime_wired: z.literal(false),
  room_adapter_wired: z.literal(false),
  project_mutated: z.literal(false),
  obsidian_written: z.literal(false),
  memory_written: z.literal(false),
  scheduler_triggered: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const ApprovalValidationGuardMatrixSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION),
  matrix_id: z.literal("approval_validation_guard_matrix"),
  phase: z.literal(18),
  slice: z.literal("18A.4"),
  local_first: z.literal(true),
  metadata_only: z.literal(true),
  audit_preview_safe: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  proposal_guards: z.array(ApprovalValidationGuardDeclarationSchema),
  lifecycle_record_guards: z.array(ApprovalValidationGuardDeclarationSchema),
  authority_boundary_guards: z.array(ApprovalValidationGuardDeclarationSchema),
  forbidden_capability_refs: z.array(ApprovalForbiddenCapabilitySchema),
});

export type ApprovalValidationGuardDeclaration = z.infer<
  typeof ApprovalValidationGuardDeclarationSchema
>;
export type ApprovalValidationGuardResult = z.infer<
  typeof ApprovalValidationGuardResultSchema
>;
export type ApprovalValidationGuardMatrix = z.infer<
  typeof ApprovalValidationGuardMatrixSchema
>;

const GUARD_REASON_BY_ID = {
  known_proposal_kind_only: "unknown_proposal_kind",
  proposal_kind_exists_in_registry: "proposal_kind_missing_from_registry",
  requires_approval_true: "approval_not_required",
  dry_run_required_true: "dry_run_not_required",
  execution_enabled_false: "execution_enabled",
  verification_enabled_false: "verification_enabled",
  compensation_enabled_false: "compensation_enabled",
  auto_approval_allowed_false: "auto_approval_enabled",
  voice_only_approval_allowed_false: "voice_only_approval_enabled",
  approval_inheritance_allowed_false: "approval_inheritance_enabled",
  cross_session_persistence_allowed_false: "cross_session_persistence_enabled",
  lifecycle_stage_known: "unknown_lifecycle_stage",
  lifecycle_transition_declared: "undeclared_lifecycle_transition",
  metadata_replay_safe: "metadata_not_replay_safe",
  metadata_redaction_safe: "metadata_not_redaction_safe",
  forbidden_capability_rejected: "forbidden_capability",
  unknown_authority_class_rejected: "unknown_authority_class",
} as const satisfies Record<
  ApprovalValidationGuardId,
  ApprovalValidationGuardReasonCode
>;

function guardDeclaration(input: {
  readonly guard_id: ApprovalValidationGuardId;
  readonly applies_to: "proposal" | "lifecycle_record" | "authority_boundary";
}): ApprovalValidationGuardDeclaration {
  return ApprovalValidationGuardDeclarationSchema.parse({
    guard_id: input.guard_id,
    applies_to: input.applies_to,
    severity: "error",
    failure_reason_code: GUARD_REASON_BY_ID[input.guard_id],
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    grants_authority: false,
    advances_lifecycle_state: false,
    executes_action: false,
    writes_persistence: false,
  });
}

export const DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX =
  ApprovalValidationGuardMatrixSchema.parse({
    contract_version: APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION,
    matrix_id: "approval_validation_guard_matrix",
    phase: 18,
    slice: "18A.4",
    local_first: true,
    metadata_only: true,
    audit_preview_safe: true,
    replay_safe: true,
    redaction_safe: true,
    proposal_guards: (
      [
        "known_proposal_kind_only",
        "proposal_kind_exists_in_registry",
        "requires_approval_true",
        "dry_run_required_true",
        "execution_enabled_false",
        "verification_enabled_false",
        "compensation_enabled_false",
        "auto_approval_allowed_false",
        "voice_only_approval_allowed_false",
        "approval_inheritance_allowed_false",
        "cross_session_persistence_allowed_false",
        "metadata_replay_safe",
        "metadata_redaction_safe",
        "forbidden_capability_rejected",
      ] as const
    ).map((guard_id) => guardDeclaration({ guard_id, applies_to: "proposal" })),
    lifecycle_record_guards: (
      [
        "lifecycle_stage_known",
        "lifecycle_transition_declared",
        "metadata_replay_safe",
        "metadata_redaction_safe",
        "forbidden_capability_rejected",
      ] as const
    ).map((guard_id) =>
      guardDeclaration({ guard_id, applies_to: "lifecycle_record" }),
    ),
    authority_boundary_guards: (
      [
        "forbidden_capability_rejected",
        "unknown_authority_class_rejected",
      ] as const
    ).map((guard_id) =>
      guardDeclaration({ guard_id, applies_to: "authority_boundary" }),
    ),
    forbidden_capability_refs:
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.forbidden_capabilities.map(
        (entry) => entry.capability,
      ),
  });

function guardResult(input: {
  readonly guard_id: ApprovalValidationGuardId;
  readonly passed: boolean;
  readonly reason_code?: ApprovalValidationGuardReasonCode;
  readonly checked_at_source:
    | "proposal_validation_matrix"
    | "lifecycle_record_validation_matrix"
    | "authority_boundary_validation_matrix";
}): ApprovalValidationGuardResult {
  return ApprovalValidationGuardResultSchema.parse({
    guard_id: input.guard_id,
    passed: input.passed,
    severity: input.passed ? "info" : "error",
    reason_code:
      input.reason_code ??
      (input.passed ? "passed" : GUARD_REASON_BY_ID[input.guard_id]),
    redaction_status: "metadata_only",
    replay_safe: true,
    redaction_safe: true,
    checked_at_source: input.checked_at_source,
    metadata_only: true,
    audit_preview_safe: true,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_execution_command_included: false,
    secret_material_included: false,
    pii_included: false,
    approval_created: false,
    authority_granted: false,
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

function hasReplaySafeMetadata(input: unknown): boolean {
  if (!input || typeof input !== "object" || !("replay" in input)) {
    return false;
  }

  const replay = (input as { readonly replay?: unknown }).replay;
  return (
    !!replay &&
    typeof replay === "object" &&
    (replay as { readonly replay_safe?: unknown }).replay_safe === true
  );
}

function hasRedactionSafeMetadata(input: unknown): boolean {
  if (!input || typeof input !== "object" || !("redaction" in input)) {
    return false;
  }

  const redaction = (input as { readonly redaction?: unknown }).redaction;
  return (
    !!redaction &&
    typeof redaction === "object" &&
    (redaction as { readonly redaction_safe?: unknown }).redaction_safe ===
      true &&
    (redaction as { readonly metadata_only?: unknown }).metadata_only === true
  );
}

function proposalField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  return (input as Record<string, unknown>)[field];
}

export function validateApprovalValidationGuardMatrix(
  input: unknown,
): ApprovalValidationGuardResult {
  const parsed = ApprovalValidationGuardMatrixSchema.safeParse(input);
  const declaredGuards = parsed.success
    ? new Set(
        [
          ...parsed.data.proposal_guards,
          ...parsed.data.lifecycle_record_guards,
          ...parsed.data.authority_boundary_guards,
        ].map((guard) => guard.guard_id),
      )
    : new Set<string>();
  const allGuardsDeclared = APPROVAL_VALIDATION_GUARD_IDS.every((guardId) =>
    declaredGuards.has(guardId),
  );

  return guardResult({
    guard_id: "metadata_replay_safe",
    passed: parsed.success && allGuardsDeclared,
    reason_code:
      parsed.success && allGuardsDeclared ? "passed" : "invalid_guard_matrix",
    checked_at_source: "authority_boundary_validation_matrix",
  });
}

export function validateApprovalProposalMetadataGuards(
  input: unknown,
): readonly ApprovalValidationGuardResult[] {
  const proposalKind = proposalField(input, "proposal_kind");
  const knownKind = ApprovalProposalRegistryKindSchema.safeParse(proposalKind);
  const registryContainsKind =
    knownKind.success &&
    DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds.some(
      (entry) => entry.proposal_kind === knownKind.data,
    );

  const results: ApprovalValidationGuardResult[] = [
    guardResult({
      guard_id: "known_proposal_kind_only",
      passed: knownKind.success,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "proposal_kind_exists_in_registry",
      passed: registryContainsKind,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "requires_approval_true",
      passed: proposalField(input, "requiresApproval") === true,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "dry_run_required_true",
      passed: proposalField(input, "dryRunRequired") === true,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "execution_enabled_false",
      passed: proposalField(input, "executionEnabled") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "verification_enabled_false",
      passed: proposalField(input, "verificationEnabled") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "compensation_enabled_false",
      passed: proposalField(input, "compensationEnabled") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "auto_approval_allowed_false",
      passed: proposalField(input, "autoApprovalAllowed") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "voice_only_approval_allowed_false",
      passed: proposalField(input, "voiceOnlyApprovalAllowed") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "approval_inheritance_allowed_false",
      passed: proposalField(input, "approvalInheritanceAllowed") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "cross_session_persistence_allowed_false",
      passed: proposalField(input, "crossSessionPersistenceAllowed") === false,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "metadata_replay_safe",
      passed:
        hasReplaySafeMetadata(input) ||
        proposalField(input, "replay_safe") === true,
      checked_at_source: "proposal_validation_matrix",
    }),
    guardResult({
      guard_id: "metadata_redaction_safe",
      passed:
        hasRedactionSafeMetadata(input) ||
        (proposalField(input, "redaction_safe") === true &&
          proposalField(input, "metadata_only") === true),
      checked_at_source: "proposal_validation_matrix",
    }),
  ];

  if (ApprovalProposalKindDeclarationSchema.safeParse(input).success) {
    return results;
  }

  return results;
}

export function validateApprovalLifecycleRecordMetadataGuards(
  input: unknown,
): readonly ApprovalValidationGuardResult[] {
  const currentStage = proposalField(input, "current_stage");
  const knownStage = ApprovalLifecycleStageSchema.safeParse(currentStage);
  const transitions = Array.isArray(proposalField(input, "transitions"))
    ? (proposalField(input, "transitions") as readonly unknown[])
    : [];
  const declaredTransitions =
    transitions.length > 0 &&
    transitions.every((transition) => {
      if (!transition || typeof transition !== "object") {
        return false;
      }

      const from_stage = (transition as { readonly from_stage?: unknown })
        .from_stage;
      const to_stage = (transition as { readonly to_stage?: unknown }).to_stage;

      return (
        ApprovalStageTransitionSchema.safeParse(transition).success ||
        validateApprovalStageTransitionDeclaration({
          from_stage,
          to_stage,
        }).valid
      );
    });

  return [
    guardResult({
      guard_id: "lifecycle_stage_known",
      passed: knownStage.success,
      checked_at_source: "lifecycle_record_validation_matrix",
    }),
    guardResult({
      guard_id: "lifecycle_transition_declared",
      passed: declaredTransitions,
      checked_at_source: "lifecycle_record_validation_matrix",
    }),
    guardResult({
      guard_id: "metadata_replay_safe",
      passed: hasReplaySafeMetadata(input),
      checked_at_source: "lifecycle_record_validation_matrix",
    }),
    guardResult({
      guard_id: "metadata_redaction_safe",
      passed: hasRedactionSafeMetadata(input),
      checked_at_source: "lifecycle_record_validation_matrix",
    }),
  ];
}

export function validateApprovalForbiddenCapabilityGuard(
  input: unknown,
): ApprovalValidationGuardResult {
  const parsed = ApprovalForbiddenCapabilitySchema.safeParse(input);
  return guardResult({
    guard_id: "forbidden_capability_rejected",
    passed: !parsed.success,
    checked_at_source: "authority_boundary_validation_matrix",
  });
}

export function validateApprovalAuthorityClassGuard(
  input: unknown,
): ApprovalValidationGuardResult {
  const parsed = ApprovalAuthorityClassSchema.safeParse(input);
  return guardResult({
    guard_id: "unknown_authority_class_rejected",
    passed: parsed.success,
    checked_at_source: "authority_boundary_validation_matrix",
  });
}

export function isApprovalProposalMetadataValid(input: unknown): boolean {
  return validateApprovalProposalMetadataGuards(input).every(
    (result) => result.passed,
  );
}

export function isApprovalLifecycleRecordMetadataValid(
  input: unknown,
): boolean {
  return (
    ApprovalLifecycleRecordSchema.safeParse(input).success &&
    validateApprovalLifecycleRecordMetadataGuards(input).every(
      (result) => result.passed,
    )
  );
}
