import { z } from "zod";

import {
  ApprovalAuthorityGuardMetadataSchema,
  ApprovalIdSchema,
  ApprovalProposalKindSchema,
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  CompensationIdSchema,
  ExecutionIdSchema,
  ProposalIdSchema,
  VerificationIdSchema,
} from "./types";
import {
  ApprovalStageTransitionDeclarationSchema,
  validateApprovalStageTransitionDeclaration,
} from "./lifecycle";
import { ApprovalLifecycleStageSchema } from "./types";

export const APPROVAL_RUNTIME_CONTRACT_VERSION = "18A.1" as const;

export const APPROVAL_RUNTIME_FORBIDDEN_METADATA_FIELDS = [
  "tool_args",
  "tool_arguments",
  "arguments",
  "raw_payload",
  "payload",
  "raw_body",
  "body",
  "command",
  "execution_command",
  "callback",
  "handler",
  "runtime_handler",
  "provider",
  "provider_ref",
  "device",
  "device_ref",
  "file_path",
  "network_url",
  "url",
] as const;

export const ApprovalProposalContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_RUNTIME_CONTRACT_VERSION),
  proposal_id: ProposalIdSchema,
  approval_id: ApprovalIdSchema.nullable(),
  proposal_kind: ApprovalProposalKindSchema,
  risk_class: ApprovalRiskClassSchema,
  source_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  subject_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  dry_run_preview_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .nullable(),
  created_at_ms: z.number().int().nonnegative(),
  expires_at_ms: z.number().int().nonnegative(),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
  // Additive (24C-2, per GATE-1): the FC-2 server-computed canonical-effect hash
  // + scope-snapshot ref hash. OPTIONAL, hash-shaped, metadata-only — every
  // existing Phase-18A proposal stays valid; no existing field is altered and no
  // lifecycle state is added.
  canonical_effect_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .optional(),
  scope_snapshot_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .optional(),
});

export const ApprovalStageTransitionSchema =
  ApprovalStageTransitionDeclarationSchema.extend({
    transition_ref_hash: z
      .string()
      .trim()
      .regex(/^hash:[a-z0-9._:-]+$/),
    observed_at_ms: z.number().int().nonnegative().nullable(),
    replay: ApprovalReplayMetadataSchema,
    redaction: ApprovalRedactionMetadataSchema,
  }).superRefine((transition, context) => {
    const validation = validateApprovalStageTransitionDeclaration({
      from_stage: transition.from_stage,
      to_stage: transition.to_stage,
    });

    if (!validation.valid) {
      context.addIssue({
        code: "custom",
        message: validation.reason,
        path: ["to_stage"],
      });
    }
  });

export const ApprovalLifecycleRecordSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_RUNTIME_CONTRACT_VERSION),
  lifecycle_record_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  approval_id: ApprovalIdSchema.nullable(),
  proposal_id: ProposalIdSchema,
  execution_id: ExecutionIdSchema.nullable(),
  verification_id: VerificationIdSchema.nullable(),
  compensation_id: CompensationIdSchema.nullable(),
  current_stage: ApprovalLifecycleStageSchema,
  transitions: z.array(ApprovalStageTransitionSchema),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
});

export const ApprovalLifecycleSnapshotSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_RUNTIME_CONTRACT_VERSION),
  snapshot_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  approval_id: ApprovalIdSchema.nullable(),
  proposal_id: ProposalIdSchema,
  current_stage: ApprovalLifecycleStageSchema,
  transition_count: z.number().int().nonnegative(),
  last_transition_ref_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .nullable(),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
});

export const ApprovalAuditPreviewSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_RUNTIME_CONTRACT_VERSION),
  audit_preview_id_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  approval_id: ApprovalIdSchema.nullable(),
  proposal_id: ProposalIdSchema,
  current_stage: ApprovalLifecycleStageSchema,
  preview_kind: z.literal("approval_lifecycle_audit_preview"),
  transition_count: z.number().int().nonnegative(),
  includes_execution_result: z.literal(false),
  includes_verification_result: z.literal(false),
  includes_compensation_payload: z.literal(false),
  audit_event_write_supported: z.literal(false),
  event_store_write_supported: z.literal(false),
  replay: ApprovalReplayMetadataSchema,
  redaction: ApprovalRedactionMetadataSchema,
  guard: ApprovalAuthorityGuardMetadataSchema,
});

export const ApprovalContractValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: z.enum(["valid_contract", "invalid_contract", "forbidden_field"]),
  metadata_only: z.literal(true),
  no_authority_granted: z.literal(true),
  no_action_executed: z.literal(true),
});

export type ApprovalProposalContract = z.infer<
  typeof ApprovalProposalContractSchema
>;
export type ApprovalStageTransition = z.infer<
  typeof ApprovalStageTransitionSchema
>;
export type ApprovalLifecycleRecord = z.infer<
  typeof ApprovalLifecycleRecordSchema
>;
export type ApprovalLifecycleSnapshot = z.infer<
  typeof ApprovalLifecycleSnapshotSchema
>;
export type ApprovalAuditPreview = z.infer<typeof ApprovalAuditPreviewSchema>;
export type ApprovalContractValidation = z.infer<
  typeof ApprovalContractValidationSchema
>;

function hasForbiddenMetadataField(input: unknown): boolean {
  if (Array.isArray(input)) {
    return input.some((item) => hasForbiddenMetadataField(item));
  }

  if (!input || typeof input !== "object") {
    return false;
  }

  return Object.entries(input).some(
    ([key, value]) =>
      APPROVAL_RUNTIME_FORBIDDEN_METADATA_FIELDS.includes(
        key as (typeof APPROVAL_RUNTIME_FORBIDDEN_METADATA_FIELDS)[number],
      ) || hasForbiddenMetadataField(value),
  );
}

function validation(
  valid: boolean,
  reason: ApprovalContractValidation["reason"],
) {
  return ApprovalContractValidationSchema.parse({
    valid,
    reason,
    metadata_only: true,
    no_authority_granted: true,
    no_action_executed: true,
  });
}

function validateWithSchema(
  schema: z.ZodType,
  input: unknown,
): ApprovalContractValidation {
  if (hasForbiddenMetadataField(input)) {
    return validation(false, "forbidden_field");
  }

  const parsed = schema.safeParse(input);
  return validation(
    parsed.success,
    parsed.success ? "valid_contract" : "invalid_contract",
  );
}

export function validateApprovalProposalContract(
  input: unknown,
): ApprovalContractValidation {
  return validateWithSchema(ApprovalProposalContractSchema, input);
}

export function validateApprovalLifecycleRecord(
  input: unknown,
): ApprovalContractValidation {
  return validateWithSchema(ApprovalLifecycleRecordSchema, input);
}

export function validateApprovalLifecycleSnapshot(
  input: unknown,
): ApprovalContractValidation {
  return validateWithSchema(ApprovalLifecycleSnapshotSchema, input);
}

export function validateApprovalAuditPreview(
  input: unknown,
): ApprovalContractValidation {
  return validateWithSchema(ApprovalAuditPreviewSchema, input);
}
