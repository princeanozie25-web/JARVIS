import { z } from "zod";

import {
  DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
  type ApprovalForbiddenCapability,
} from "./authority-boundary";
import {
  ApprovalAuthorityGuardMetadataSchema,
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
} from "./types";

export const APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION = "18A.3" as const;

export const APPROVAL_PROPOSAL_REGISTRY_KINDS = [
  "note_create",
  "project_task_create",
  "room_action_execute",
] as const;

export const APPROVAL_PROPOSAL_TRUST_CLASSES = [
  "local_user_review_required",
  "local_project_review_required",
  "local_room_review_required",
] as const;

export const APPROVAL_PROPOSAL_SOURCE_KINDS = [
  "user_click",
  "user_typed_command",
  "suggestion_metadata",
] as const;

export const APPROVAL_PROPOSAL_TARGET_KINDS = [
  "obsidian_note",
  "project_task",
  "room_action",
] as const;

export const APPROVAL_PROPOSAL_REGISTRY_VALIDATION_REASONS = [
  "valid_registry",
  "valid_proposal_kind",
  "invalid_registry",
  "unknown_proposal_kind",
  "forbidden_capability",
] as const;

export type ApprovalProposalRegistryKind =
  (typeof APPROVAL_PROPOSAL_REGISTRY_KINDS)[number];
export type ApprovalProposalTrustClass =
  (typeof APPROVAL_PROPOSAL_TRUST_CLASSES)[number];
export type ApprovalProposalSourceKind =
  (typeof APPROVAL_PROPOSAL_SOURCE_KINDS)[number];
export type ApprovalProposalTargetKind =
  (typeof APPROVAL_PROPOSAL_TARGET_KINDS)[number];
export type ApprovalProposalRegistryValidationReason =
  (typeof APPROVAL_PROPOSAL_REGISTRY_VALIDATION_REASONS)[number];

export const ApprovalProposalRegistryKindSchema = z.enum(
  APPROVAL_PROPOSAL_REGISTRY_KINDS,
);
export const ApprovalProposalTrustClassSchema = z.enum(
  APPROVAL_PROPOSAL_TRUST_CLASSES,
);
export const ApprovalProposalSourceKindSchema = z.enum(
  APPROVAL_PROPOSAL_SOURCE_KINDS,
);
export const ApprovalProposalTargetKindSchema = z.enum(
  APPROVAL_PROPOSAL_TARGET_KINDS,
);
export const ApprovalProposalRegistryValidationReasonSchema = z.enum(
  APPROVAL_PROPOSAL_REGISTRY_VALIDATION_REASONS,
);

export const ApprovalProposalTrustMetadataSchema = z.strictObject({
  trust_class: ApprovalProposalTrustClassSchema,
  local_first: z.literal(true),
  user_review_required: z.literal(true),
  authority_boundary_required: z.literal(true),
  metadata_only: z.literal(true),
});

export const ApprovalProposalSourceMetadataSchema = z.strictObject({
  source_kind: ApprovalProposalSourceKindSchema,
  source_ref_hash_required: z.literal(true),
  scheduler_triggered_creation_allowed: z.literal(false),
  voice_only_creation_allowed: z.literal(false),
  background_creation_allowed: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalTargetMetadataSchema = z.strictObject({
  target_kind: ApprovalProposalTargetKindSchema,
  target_ref_hash_required: z.literal(true),
  raw_target_payload_allowed: z.literal(false),
  project_mutation_allowed: z.literal(false),
  obsidian_write_allowed: z.literal(false),
  room_adapter_wiring_allowed: z.literal(false),
  memory_write_allowed: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalRiskMetadataSchema = z.strictObject({
  risk_class: ApprovalRiskClassSchema,
  risk_ref_hash_required: z.literal(true),
  raw_risk_payload_allowed: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalExpiryMetadataSchema = z.strictObject({
  expires_after_ms: z.literal(300_000),
  expiry_required: z.literal(true),
  reproposal_required_after_expiry: z.literal(true),
  cross_session_persistence_allowed: z.literal(false),
  timers_registered: z.literal(false),
  scheduler_registered: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalKindDeclarationSchema = z.strictObject({
  proposal_kind: ApprovalProposalRegistryKindSchema,
  display_name: z.string().trim().min(1).max(80),
  trust: ApprovalProposalTrustMetadataSchema,
  source: ApprovalProposalSourceMetadataSchema,
  target: ApprovalProposalTargetMetadataSchema,
  risk: ApprovalProposalRiskMetadataSchema,
  expiry: ApprovalProposalExpiryMetadataSchema,
  requiresApproval: z.literal(true),
  dryRunRequired: z.literal(true),
  executionEnabled: z.literal(false),
  verificationEnabled: z.literal(false),
  compensationEnabled: z.literal(false),
  autoApprovalAllowed: z.literal(false),
  voiceOnlyApprovalAllowed: z.literal(false),
  approvalInheritanceAllowed: z.literal(false),
  crossSessionPersistenceAllowed: z.literal(false),
  approvalCreationEnabled: z.literal(false),
  authorityGrantEnabled: z.literal(false),
  dispatchEnabled: z.literal(false),
  uiWiringEnabled: z.literal(false),
  dbEventStoreWiringEnabled: z.literal(false),
  telemetryWritesEnabled: z.literal(false),
  toolRuntimeWiringEnabled: z.literal(false),
  roomAdapterWiringEnabled: z.literal(false),
  projectMutationEnabled: z.literal(false),
  obsidianWriteEnabled: z.literal(false),
  memoryWriteEnabled: z.literal(false),
  schedulerTriggeredProposalCreationEnabled: z.literal(false),
  networkCloudCallsEnabled: z.literal(false),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
});

export const ApprovalProposalRegistrySchema = z.strictObject({
  contract_version: z.literal(APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION),
  registry_id: z.literal("approval_proposal_metadata_registry"),
  phase: z.literal(18),
  slice: z.literal("18A.3"),
  local_first: z.literal(true),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  authority_boundary_matrix_ref: z.literal(
    "approval_authority_boundary_matrix",
  ),
  forbidden_capability_refs: z.array(z.string()),
  proposal_kinds: z.array(ApprovalProposalKindDeclarationSchema),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
});

export const ApprovalProposalRegistryValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: ApprovalProposalRegistryValidationReasonSchema,
  proposal_kind: ApprovalProposalRegistryKindSchema.nullable(),
  forbidden_capability: z.string().nullable(),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  proposal_created: z.literal(false),
  approval_created: z.literal(false),
  authority_granted: z.literal(false),
  dispatch_performed: z.literal(false),
  action_executed: z.literal(false),
  verification_performed: z.literal(false),
  compensation_performed: z.literal(false),
  state_mutated: z.literal(false),
  persisted: z.literal(false),
  telemetry_written: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type ApprovalProposalTrustMetadata = z.infer<
  typeof ApprovalProposalTrustMetadataSchema
>;
export type ApprovalProposalSourceMetadata = z.infer<
  typeof ApprovalProposalSourceMetadataSchema
>;
export type ApprovalProposalTargetMetadata = z.infer<
  typeof ApprovalProposalTargetMetadataSchema
>;
export type ApprovalProposalRiskMetadata = z.infer<
  typeof ApprovalProposalRiskMetadataSchema
>;
export type ApprovalProposalExpiryMetadata = z.infer<
  typeof ApprovalProposalExpiryMetadataSchema
>;
export type ApprovalProposalKindDeclaration = z.infer<
  typeof ApprovalProposalKindDeclarationSchema
>;
export type ApprovalProposalRegistry = z.infer<
  typeof ApprovalProposalRegistrySchema
>;
export type ApprovalProposalRegistryValidation = z.infer<
  typeof ApprovalProposalRegistryValidationSchema
>;

const PROPOSAL_KIND_METADATA = {
  note_create: {
    display_name: "Note create",
    trust_class: "local_user_review_required",
    source_kind: "user_typed_command",
    target_kind: "obsidian_note",
    risk_class: "medium",
  },
  project_task_create: {
    display_name: "Project task create",
    trust_class: "local_project_review_required",
    source_kind: "suggestion_metadata",
    target_kind: "project_task",
    risk_class: "medium",
  },
  room_action_execute: {
    display_name: "Room action execute",
    trust_class: "local_room_review_required",
    source_kind: "user_click",
    target_kind: "room_action",
    risk_class: "high",
  },
} as const satisfies Record<
  ApprovalProposalRegistryKind,
  {
    readonly display_name: string;
    readonly trust_class: ApprovalProposalTrustClass;
    readonly source_kind: ApprovalProposalSourceKind;
    readonly target_kind: ApprovalProposalTargetKind;
    readonly risk_class: "low" | "medium" | "high" | "critical";
  }
>;

function proposalKindDeclaration(
  proposal_kind: ApprovalProposalRegistryKind,
): ApprovalProposalKindDeclaration {
  const metadata = PROPOSAL_KIND_METADATA[proposal_kind];

  return ApprovalProposalKindDeclarationSchema.parse({
    proposal_kind,
    display_name: metadata.display_name,
    trust: {
      trust_class: metadata.trust_class,
      local_first: true,
      user_review_required: true,
      authority_boundary_required: true,
      metadata_only: true,
    },
    source: {
      source_kind: metadata.source_kind,
      source_ref_hash_required: true,
      scheduler_triggered_creation_allowed: false,
      voice_only_creation_allowed: false,
      background_creation_allowed: false,
      metadata_only: true,
    },
    target: {
      target_kind: metadata.target_kind,
      target_ref_hash_required: true,
      raw_target_payload_allowed: false,
      project_mutation_allowed: false,
      obsidian_write_allowed: false,
      room_adapter_wiring_allowed: false,
      memory_write_allowed: false,
      metadata_only: true,
    },
    risk: {
      risk_class: metadata.risk_class,
      risk_ref_hash_required: true,
      raw_risk_payload_allowed: false,
      metadata_only: true,
    },
    expiry: {
      expires_after_ms: 300_000,
      expiry_required: true,
      reproposal_required_after_expiry: true,
      cross_session_persistence_allowed: false,
      timers_registered: false,
      scheduler_registered: false,
      metadata_only: true,
    },
    requiresApproval: true,
    dryRunRequired: true,
    executionEnabled: false,
    verificationEnabled: false,
    compensationEnabled: false,
    autoApprovalAllowed: false,
    voiceOnlyApprovalAllowed: false,
    approvalInheritanceAllowed: false,
    crossSessionPersistenceAllowed: false,
    approvalCreationEnabled: false,
    authorityGrantEnabled: false,
    dispatchEnabled: false,
    uiWiringEnabled: false,
    dbEventStoreWiringEnabled: false,
    telemetryWritesEnabled: false,
    toolRuntimeWiringEnabled: false,
    roomAdapterWiringEnabled: false,
    projectMutationEnabled: false,
    obsidianWriteEnabled: false,
    memoryWriteEnabled: false,
    schedulerTriggeredProposalCreationEnabled: false,
    networkCloudCallsEnabled: false,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
  });
}

export const DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY =
  ApprovalProposalRegistrySchema.parse({
    contract_version: APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION,
    registry_id: "approval_proposal_metadata_registry",
    phase: 18,
    slice: "18A.3",
    local_first: true,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    authority_boundary_matrix_ref:
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.matrix_id,
    forbidden_capability_refs:
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.forbidden_capabilities.map(
        (entry) => entry.capability satisfies ApprovalForbiddenCapability,
      ),
    proposal_kinds: APPROVAL_PROPOSAL_REGISTRY_KINDS.map(
      proposalKindDeclaration,
    ),
    replay: {
      schema_version: "approval-runtime.v18a1",
      replay_safe: true,
      local_first: true,
      deterministic_replay_key_hash: "hash:approval-proposal-registry",
      source_event_hash: "hash:approval-proposal-registry-source",
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

function registryValidation(input: {
  readonly valid: boolean;
  readonly reason: ApprovalProposalRegistryValidationReason;
  readonly proposal_kind?: ApprovalProposalRegistryKind | null;
  readonly forbidden_capability?: string | null;
}): ApprovalProposalRegistryValidation {
  return ApprovalProposalRegistryValidationSchema.parse({
    valid: input.valid,
    reason: input.reason,
    proposal_kind: input.proposal_kind ?? null,
    forbidden_capability: input.forbidden_capability ?? null,
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    proposal_created: false,
    approval_created: false,
    authority_granted: false,
    dispatch_performed: false,
    action_executed: false,
    verification_performed: false,
    compensation_performed: false,
    state_mutated: false,
    persisted: false,
    telemetry_written: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateApprovalProposalRegistry(
  input: unknown,
): ApprovalProposalRegistryValidation {
  const parsed = ApprovalProposalRegistrySchema.safeParse(input);
  if (!parsed.success) {
    return registryValidation({
      valid: false,
      reason: "invalid_registry",
    });
  }

  const declaredKinds = new Set(
    parsed.data.proposal_kinds.map((entry) => entry.proposal_kind),
  );
  const allKindsDeclared = APPROVAL_PROPOSAL_REGISTRY_KINDS.every(
    (proposalKind) => declaredKinds.has(proposalKind),
  );

  return registryValidation({
    valid: allKindsDeclared,
    reason: allKindsDeclared ? "valid_registry" : "invalid_registry",
  });
}

export function validateApprovalProposalKindMetadata(
  input: unknown,
): ApprovalProposalRegistryValidation {
  const parsed = ApprovalProposalRegistryKindSchema.safeParse(input);
  if (!parsed.success) {
    return registryValidation({
      valid: false,
      reason: "unknown_proposal_kind",
    });
  }

  return registryValidation({
    valid: true,
    reason: "valid_proposal_kind",
    proposal_kind: parsed.data,
  });
}

export function validateApprovalProposalForbiddenCapability(
  input: unknown,
): ApprovalProposalRegistryValidation {
  const parsed = z.string().safeParse(input);
  if (
    !parsed.success ||
    !DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.forbidden_capability_refs.includes(
      parsed.data,
    )
  ) {
    return registryValidation({
      valid: false,
      reason: "invalid_registry",
    });
  }

  return registryValidation({
    valid: false,
    reason: "forbidden_capability",
    forbidden_capability: parsed.data,
  });
}
