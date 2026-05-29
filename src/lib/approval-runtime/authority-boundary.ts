import { z } from "zod";

import {
  ApprovalAuthorityGuardMetadataSchema,
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
} from "./types";

export const APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION = "18A.2" as const;

export const APPROVAL_AUTHORITY_CLASSES = [
  "proposal_metadata",
  "review_metadata",
  "approval_decision_metadata",
  "execution_authority_reserved",
  "verification_reserved",
  "compensation_reserved",
  "audit_preview_metadata",
] as const;

export const APPROVAL_METADATA_AUTHORITY_CLASSES = [
  "proposal_metadata",
  "review_metadata",
  "approval_decision_metadata",
  "audit_preview_metadata",
] as const;

export const APPROVAL_RESERVED_AUTHORITY_CLASSES = [
  "execution_authority_reserved",
  "verification_reserved",
  "compensation_reserved",
] as const;

export const APPROVAL_FORBIDDEN_CAPABILITIES = [
  "execution_authority_grants",
  "auto_approval",
  "voice_only_approval",
  "approval_inheritance",
  "cross_session_approval_persistence",
  "multi_step_execution_graphs",
  "tool_dispatch",
  "room_action_execution",
  "project_mutation",
  "obsidian_write",
  "memory_write",
  "scheduler_triggered_action",
  "network_cloud_action",
] as const;

export const APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS = {
  proposal_metadata: "describes proposal identity and review context metadata",
  review_metadata: "describes review queue and user-review metadata",
  approval_decision_metadata:
    "describes future decision records without creating decisions",
  execution_authority_reserved:
    "reserves execution authority vocabulary without execution support",
  verification_reserved:
    "reserves verification vocabulary without verification support",
  compensation_reserved:
    "reserves compensation vocabulary without compensation support",
  audit_preview_metadata:
    "describes audit preview metadata without audit writes",
} as const satisfies Record<ApprovalAuthorityClass, string>;

export const APPROVAL_AUTHORITY_BOUNDARY_VALIDATION_REASONS = [
  "valid_matrix",
  "valid_metadata_class",
  "invalid_matrix",
  "invalid_authority_class",
  "reserved_authority_class",
  "forbidden_capability",
] as const;

export type ApprovalAuthorityClass =
  (typeof APPROVAL_AUTHORITY_CLASSES)[number];
export type ApprovalMetadataAuthorityClass =
  (typeof APPROVAL_METADATA_AUTHORITY_CLASSES)[number];
export type ApprovalReservedAuthorityClass =
  (typeof APPROVAL_RESERVED_AUTHORITY_CLASSES)[number];
export type ApprovalForbiddenCapability =
  (typeof APPROVAL_FORBIDDEN_CAPABILITIES)[number];
export type ApprovalAuthorityBoundaryValidationReason =
  (typeof APPROVAL_AUTHORITY_BOUNDARY_VALIDATION_REASONS)[number];

export const ApprovalAuthorityClassSchema = z.enum(APPROVAL_AUTHORITY_CLASSES);
export const ApprovalMetadataAuthorityClassSchema = z.enum(
  APPROVAL_METADATA_AUTHORITY_CLASSES,
);
export const ApprovalReservedAuthorityClassSchema = z.enum(
  APPROVAL_RESERVED_AUTHORITY_CLASSES,
);
export const ApprovalForbiddenCapabilitySchema = z.enum(
  APPROVAL_FORBIDDEN_CAPABILITIES,
);
export const ApprovalAuthorityBoundaryValidationReasonSchema = z.enum(
  APPROVAL_AUTHORITY_BOUNDARY_VALIDATION_REASONS,
);

export const ApprovalAuthorityClassEntrySchema = z.strictObject({
  authority_class: ApprovalAuthorityClassSchema,
  description: z.enum([
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.proposal_metadata,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.review_metadata,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.approval_decision_metadata,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.execution_authority_reserved,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.verification_reserved,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.compensation_reserved,
    APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS.audit_preview_metadata,
  ]),
  class_kind: z.enum(["metadata", "reserved"]),
  describe_allowed: z.literal(true),
  perform_allowed: z.literal(false),
  authority_grant_allowed: z.literal(false),
  approval_creation_allowed: z.literal(false),
  dispatch_allowed: z.literal(false),
  tool_dispatch_allowed: z.literal(false),
  room_action_allowed: z.literal(false),
  project_mutation_allowed: z.literal(false),
  obsidian_write_allowed: z.literal(false),
  memory_write_allowed: z.literal(false),
  scheduler_action_allowed: z.literal(false),
  network_cloud_allowed: z.literal(false),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
});

export const ApprovalForbiddenCapabilityDeclarationSchema = z.strictObject({
  capability: ApprovalForbiddenCapabilitySchema,
  forbidden: z.literal(true),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  authority_grant_allowed: z.literal(false),
  action_allowed: z.literal(false),
});

export const ApprovalAuthorityBoundaryMatrixSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION),
  matrix_id: z.literal("approval_authority_boundary_matrix"),
  phase: z.literal(18),
  slice: z.literal("18A.2"),
  local_first: z.literal(true),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  authority_classes: z.array(ApprovalAuthorityClassEntrySchema),
  forbidden_capabilities: z.array(ApprovalForbiddenCapabilityDeclarationSchema),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
});

export const ApprovalAuthorityBoundaryValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: ApprovalAuthorityBoundaryValidationReasonSchema,
  authority_class: ApprovalAuthorityClassSchema.nullable(),
  forbidden_capability: ApprovalForbiddenCapabilitySchema.nullable(),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  authority_granted: z.literal(false),
  approval_created: z.literal(false),
  approval_decision_recorded: z.literal(false),
  dispatch_performed: z.literal(false),
  tool_dispatched: z.literal(false),
  action_executed: z.literal(false),
  verification_performed: z.literal(false),
  compensation_performed: z.literal(false),
  state_mutated: z.literal(false),
  persisted: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type ApprovalAuthorityClassEntry = z.infer<
  typeof ApprovalAuthorityClassEntrySchema
>;
export type ApprovalForbiddenCapabilityDeclaration = z.infer<
  typeof ApprovalForbiddenCapabilityDeclarationSchema
>;
export type ApprovalAuthorityBoundaryMatrix = z.infer<
  typeof ApprovalAuthorityBoundaryMatrixSchema
>;
export type ApprovalAuthorityBoundaryValidation = z.infer<
  typeof ApprovalAuthorityBoundaryValidationSchema
>;

function authorityClassEntry(
  authority_class: ApprovalAuthorityClass,
): ApprovalAuthorityClassEntry {
  const reserved = APPROVAL_RESERVED_AUTHORITY_CLASSES.includes(
    authority_class as ApprovalReservedAuthorityClass,
  );

  return ApprovalAuthorityClassEntrySchema.parse({
    authority_class,
    description: APPROVAL_AUTHORITY_CLASS_DESCRIPTIONS[authority_class],
    class_kind: reserved ? "reserved" : "metadata",
    describe_allowed: true,
    perform_allowed: false,
    authority_grant_allowed: false,
    approval_creation_allowed: false,
    dispatch_allowed: false,
    tool_dispatch_allowed: false,
    room_action_allowed: false,
    project_mutation_allowed: false,
    obsidian_write_allowed: false,
    memory_write_allowed: false,
    scheduler_action_allowed: false,
    network_cloud_allowed: false,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
  });
}

function forbiddenCapabilityDeclaration(
  capability: ApprovalForbiddenCapability,
): ApprovalForbiddenCapabilityDeclaration {
  return ApprovalForbiddenCapabilityDeclarationSchema.parse({
    capability,
    forbidden: true,
    metadata_only: true,
    replay_safe: true,
    authority_grant_allowed: false,
    action_allowed: false,
  });
}

export const DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX =
  ApprovalAuthorityBoundaryMatrixSchema.parse({
    contract_version: APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION,
    matrix_id: "approval_authority_boundary_matrix",
    phase: 18,
    slice: "18A.2",
    local_first: true,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    authority_classes: APPROVAL_AUTHORITY_CLASSES.map(authorityClassEntry),
    forbidden_capabilities: APPROVAL_FORBIDDEN_CAPABILITIES.map(
      forbiddenCapabilityDeclaration,
    ),
    replay: {
      schema_version: "approval-runtime.v18a1",
      replay_safe: true,
      local_first: true,
      deterministic_replay_key_hash: "hash:approval-authority-boundary",
      source_event_hash: "hash:approval-authority-boundary-source",
      originating_session_hash: null,
      sequence_index: 0,
    },
    redaction: {
      redaction_status: "metadata_only",
      redaction_safe: true,
      metadata_only: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_execution_command_included: false,
      secret_material_included: false,
      pii_included: false,
    },
    guard: {
      contract_only: true,
      metadata_only: true,
      lifecycle_processor_supported: false,
      approval_creation_supported: false,
      approval_decision_supported: false,
      execution_supported: false,
      verification_supported: false,
      compensation_execution_supported: false,
      persistence_supported: false,
      event_store_integration_supported: false,
      ui_integration_supported: false,
      tool_runtime_integration_supported: false,
      adapter_integration_supported: false,
      scheduler_supported: false,
      network_allowed: false,
      cloud_allowed: false,
    },
  });

function boundaryValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalAuthorityBoundaryValidationReason;
  readonly authority_class?: ApprovalAuthorityClass | null;
  readonly forbidden_capability?: ApprovalForbiddenCapability | null;
}): ApprovalAuthorityBoundaryValidation {
  return ApprovalAuthorityBoundaryValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    authority_class: input.authority_class ?? null,
    forbidden_capability: input.forbidden_capability ?? null,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    authority_granted: false,
    approval_created: false,
    approval_decision_recorded: false,
    dispatch_performed: false,
    tool_dispatched: false,
    action_executed: false,
    verification_performed: false,
    compensation_performed: false,
    state_mutated: false,
    persisted: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateApprovalAuthorityBoundaryMatrix(
  input: unknown,
): ApprovalAuthorityBoundaryValidation {
  const parsed = ApprovalAuthorityBoundaryMatrixSchema.safeParse(input);
  if (!parsed.success) {
    return boundaryValidation({
      valid: false,
      reason: "invalid_matrix",
    });
  }

  const declaredClasses = new Set(
    parsed.data.authority_classes.map((entry) => entry.authority_class),
  );
  const declaredCapabilities = new Set(
    parsed.data.forbidden_capabilities.map((entry) => entry.capability),
  );
  const allClassesDeclared = APPROVAL_AUTHORITY_CLASSES.every(
    (authorityClass) => declaredClasses.has(authorityClass),
  );
  const allCapabilitiesDeclared = APPROVAL_FORBIDDEN_CAPABILITIES.every(
    (capability) => declaredCapabilities.has(capability),
  );

  return boundaryValidation({
    valid: allClassesDeclared && allCapabilitiesDeclared,
    reason:
      allClassesDeclared && allCapabilitiesDeclared
        ? "valid_matrix"
        : "invalid_matrix",
  });
}

export function validateApprovalAuthorityClassMetadata(
  input: unknown,
): ApprovalAuthorityBoundaryValidation {
  const parsed = ApprovalAuthorityClassSchema.safeParse(input);
  if (!parsed.success) {
    return boundaryValidation({
      valid: false,
      reason: "invalid_authority_class",
    });
  }

  const reserved = APPROVAL_RESERVED_AUTHORITY_CLASSES.includes(
    parsed.data as ApprovalReservedAuthorityClass,
  );

  return boundaryValidation({
    valid: !reserved,
    reason: reserved ? "reserved_authority_class" : "valid_metadata_class",
    authority_class: parsed.data,
  });
}

export function validateApprovalForbiddenCapabilityMetadata(
  input: unknown,
): ApprovalAuthorityBoundaryValidation {
  const parsed = ApprovalForbiddenCapabilitySchema.safeParse(input);
  if (!parsed.success) {
    return boundaryValidation({
      valid: false,
      reason: "invalid_matrix",
    });
  }

  return boundaryValidation({
    valid: false,
    reason: "forbidden_capability",
    forbidden_capability: parsed.data,
  });
}
