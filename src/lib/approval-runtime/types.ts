import { z } from "zod";

export const APPROVAL_LIFECYCLE_STAGES = [
  "PROPOSED",
  "REVIEW_PENDING",
  "APPROVED",
  "DENIED",
  "EXPIRED",
  "EXECUTION_PENDING",
  "EXECUTED",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "FAILED",
  "COMPENSATION_AVAILABLE",
] as const;

export const APPROVAL_PROPOSAL_KINDS = [
  "tool_write",
  "project_mutation",
  "room_action",
  "obsidian_write",
  "runtime_command",
] as const;

export const APPROVAL_RISK_CLASSES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const APPROVAL_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const APPROVAL_REPLAY_SCHEMA_VERSION = "approval-runtime.v18a1" as const;

export type ApprovalLifecycleStage = (typeof APPROVAL_LIFECYCLE_STAGES)[number];
export type ApprovalProposalKind = (typeof APPROVAL_PROPOSAL_KINDS)[number];
export type ApprovalRiskClass = (typeof APPROVAL_RISK_CLASSES)[number];
export type ApprovalRedactionStatus =
  (typeof APPROVAL_REDACTION_STATUSES)[number];

export type ApprovalId = `approval:${string}`;
export type ProposalId = `proposal:${string}`;
export type ExecutionId = `execution:${string}`;
export type VerificationId = `verification:${string}`;
export type CompensationId = `compensation:${string}`;

const LifecycleIdSuffixSchema = z
  .string()
  .trim()
  .min(8)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

function lifecycleIdSchema<const Prefix extends string>(
  prefix: Prefix,
): z.ZodPipe<z.ZodString, z.ZodTransform<`${Prefix}:${string}`, string>> {
  return z
    .string()
    .trim()
    .regex(new RegExp(`^${prefix}:[a-z0-9]+(?:[._:-][a-z0-9]+)*$`))
    .transform((value) => value as `${Prefix}:${string}`);
}

export const ApprovalIdSchema = lifecycleIdSchema("approval");
export const ProposalIdSchema = lifecycleIdSchema("proposal");
export const ExecutionIdSchema = lifecycleIdSchema("execution");
export const VerificationIdSchema = lifecycleIdSchema("verification");
export const CompensationIdSchema = lifecycleIdSchema("compensation");
export const LifecycleIdSuffixOnlySchema = LifecycleIdSuffixSchema;

export const ApprovalLifecycleStageSchema = z.enum(APPROVAL_LIFECYCLE_STAGES);
export const ApprovalProposalKindSchema = z.enum(APPROVAL_PROPOSAL_KINDS);
export const ApprovalRiskClassSchema = z.enum(APPROVAL_RISK_CLASSES);
export const ApprovalRedactionStatusSchema = z.enum(
  APPROVAL_REDACTION_STATUSES,
);

export const ApprovalReplayMetadataSchema = z.strictObject({
  schema_version: z.literal(APPROVAL_REPLAY_SCHEMA_VERSION),
  replay_safe: z.literal(true),
  local_first: z.literal(true),
  deterministic_replay_key_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  source_event_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  originating_session_hash: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/)
    .nullable(),
  sequence_index: z.number().int().nonnegative(),
});

export const ApprovalRedactionMetadataSchema = z.strictObject({
  redaction_status: ApprovalRedactionStatusSchema,
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_execution_command_included: z.literal(false),
  secret_material_included: z.literal(false),
  pii_included: z.literal(false),
});

export const ApprovalAuthorityGuardMetadataSchema = z.strictObject({
  contract_only: z.literal(true),
  metadata_only: z.literal(true),
  lifecycle_processor_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_supported: z.literal(false),
  execution_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_execution_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_integration_supported: z.literal(false),
  ui_integration_supported: z.literal(false),
  tool_runtime_integration_supported: z.literal(false),
  adapter_integration_supported: z.literal(false),
  scheduler_supported: z.literal(false),
  network_allowed: z.literal(false),
  cloud_allowed: z.literal(false),
});

export type ApprovalReplayMetadata = z.infer<
  typeof ApprovalReplayMetadataSchema
>;
export type ApprovalRedactionMetadata = z.infer<
  typeof ApprovalRedactionMetadataSchema
>;
export type ApprovalAuthorityGuardMetadata = z.infer<
  typeof ApprovalAuthorityGuardMetadataSchema
>;
