import { z } from "zod";
import {
  EnvironmentActionLifecycleProposalSchema,
  type EnvironmentActionLifecycleProposal,
} from "./action-lifecycle";
import { EnvironmentIdSchema } from "./types";

export const ENVIRONMENT_ACTION_EXECUTION_ADAPTER_KINDS = [
  "fake_local",
] as const;

export const ENVIRONMENT_ACTION_EXECUTION_STATUSES = [
  "simulated_success",
  "simulated_denied",
  "simulated_failed",
  "skipped",
] as const;

export const ENVIRONMENT_ACTION_EXECUTION_REASONS = [
  "approved_fake_local_simulation",
  "adapter_disabled",
  "proposal_not_approved",
  "proposal_denied",
  "proposal_expired",
  "proposal_cancelled",
  "approval_required",
  "voice_origin_not_executable",
  "simulation_failed",
] as const;

export const ENVIRONMENT_ACTION_VERIFICATION_STATUSES = [
  "simulated_verified",
  "simulated_denied",
  "simulated_failed",
  "skipped",
] as const;

export type EnvironmentActionExecutionAdapterKind =
  (typeof ENVIRONMENT_ACTION_EXECUTION_ADAPTER_KINDS)[number];
export type EnvironmentActionExecutionStatus =
  (typeof ENVIRONMENT_ACTION_EXECUTION_STATUSES)[number];
export type EnvironmentActionExecutionReason =
  (typeof ENVIRONMENT_ACTION_EXECUTION_REASONS)[number];
export type EnvironmentActionVerificationStatus =
  (typeof ENVIRONMENT_ACTION_VERIFICATION_STATUSES)[number];

export const EnvironmentActionExecutionAdapterKindSchema = z.enum(
  ENVIRONMENT_ACTION_EXECUTION_ADAPTER_KINDS,
);
export const EnvironmentActionExecutionStatusSchema = z.enum(
  ENVIRONMENT_ACTION_EXECUTION_STATUSES,
);
export const EnvironmentActionExecutionReasonSchema = z.enum(
  ENVIRONMENT_ACTION_EXECUTION_REASONS,
);
export const EnvironmentActionVerificationStatusSchema = z.enum(
  ENVIRONMENT_ACTION_VERIFICATION_STATUSES,
);

export const EnvironmentActionExecutionAdapterSchema = z.strictObject({
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("fake_local"),
  enabled: z.boolean(),
  testOnly: z.literal(true),
  localOnly: z.literal(true),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  commandsIssued: z.literal(0),
});

export const EnvironmentActionExecutionResultSchema = z.strictObject({
  kind: z.literal("environment.action.execution_result"),
  proposalId: EnvironmentIdSchema,
  planIntentId: EnvironmentIdSchema,
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("fake_local"),
  status: EnvironmentActionExecutionStatusSchema,
  reason: EnvironmentActionExecutionReasonSchema,
  simulated: z.literal(true),
  testOnly: z.literal(true),
  localOnly: z.literal(true),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  commandsIssued: z.literal(0),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export const EnvironmentActionVerificationResultSchema = z.strictObject({
  kind: z.literal("environment.action.verification_result"),
  proposalId: EnvironmentIdSchema,
  executionStatus: EnvironmentActionExecutionStatusSchema,
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("fake_local"),
  status: EnvironmentActionVerificationStatusSchema,
  simulated: z.literal(true),
  testOnly: z.literal(true),
  localOnly: z.literal(true),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  commandsIssued: z.literal(0),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentActionExecutionAdapter = z.infer<
  typeof EnvironmentActionExecutionAdapterSchema
>;
export type EnvironmentActionExecutionResult = z.infer<
  typeof EnvironmentActionExecutionResultSchema
>;
export type EnvironmentActionVerificationResult = z.infer<
  typeof EnvironmentActionVerificationResultSchema
>;

export interface CreateFakeLocalEnvironmentActionAdapterInput {
  adapterId?: string;
  enabled?: boolean;
}

export interface ExecuteEnvironmentActionWithFakeLocalAdapterInput {
  proposal: EnvironmentActionLifecycleProposal;
  adapter?: EnvironmentActionExecutionAdapter;
  failSimulation?: boolean;
}

function result(input: {
  proposal: EnvironmentActionLifecycleProposal;
  adapter: EnvironmentActionExecutionAdapter;
  status: EnvironmentActionExecutionStatus;
  reason: EnvironmentActionExecutionReason;
}): EnvironmentActionExecutionResult {
  return EnvironmentActionExecutionResultSchema.parse({
    kind: "environment.action.execution_result",
    proposalId: input.proposal.id,
    planIntentId: input.proposal.plan.intentId,
    adapterId: input.adapter.adapterId,
    adapterKind: "fake_local",
    status: input.status,
    reason: input.reason,
    simulated: true,
    testOnly: true,
    localOnly: true,
    physicalSideEffects: false,
    realDeviceTouched: false,
    commandsIssued: 0,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  });
}

function denialForState(proposal: EnvironmentActionLifecycleProposal): {
  status: EnvironmentActionExecutionStatus;
  reason: EnvironmentActionExecutionReason;
} {
  if (proposal.state === "requires_approval") {
    return { status: "skipped", reason: "approval_required" };
  }
  if (proposal.state === "denied") {
    return { status: "simulated_denied", reason: "proposal_denied" };
  }
  if (proposal.state === "expired") {
    return { status: "skipped", reason: "proposal_expired" };
  }
  if (proposal.state === "cancelled") {
    return { status: "skipped", reason: "proposal_cancelled" };
  }
  return { status: "skipped", reason: "proposal_not_approved" };
}

export function createFakeLocalEnvironmentActionAdapter(
  input: CreateFakeLocalEnvironmentActionAdapterInput = {},
): EnvironmentActionExecutionAdapter {
  return EnvironmentActionExecutionAdapterSchema.parse({
    adapterId: input.adapterId ?? "adapter:fake-local-environment-action",
    adapterKind: "fake_local",
    enabled: input.enabled ?? true,
    testOnly: true,
    localOnly: true,
    physicalSideEffects: false,
    realDeviceTouched: false,
    commandsIssued: 0,
  });
}

export function executeEnvironmentActionWithFakeLocalAdapter(
  input: ExecuteEnvironmentActionWithFakeLocalAdapterInput,
): EnvironmentActionExecutionResult {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );
  const adapter =
    input.adapter ?? createFakeLocalEnvironmentActionAdapter({ enabled: true });

  if (!adapter.enabled) {
    return result({
      proposal,
      adapter,
      status: "skipped",
      reason: "adapter_disabled",
    });
  }

  if (proposal.sourceSurface === "voice") {
    return result({
      proposal,
      adapter,
      status: "simulated_denied",
      reason: "voice_origin_not_executable",
    });
  }

  if (proposal.state !== "approved") {
    const denied = denialForState(proposal);
    return result({
      proposal,
      adapter,
      status: denied.status,
      reason: denied.reason,
    });
  }

  if (input.failSimulation === true) {
    return result({
      proposal,
      adapter,
      status: "simulated_failed",
      reason: "simulation_failed",
    });
  }

  return result({
    proposal,
    adapter,
    status: "simulated_success",
    reason: "approved_fake_local_simulation",
  });
}

export function verifyFakeLocalEnvironmentActionExecution(
  execution: EnvironmentActionExecutionResult,
): EnvironmentActionVerificationResult {
  const parsed = EnvironmentActionExecutionResultSchema.parse(execution);
  const status: EnvironmentActionVerificationStatus =
    parsed.status === "simulated_success"
      ? "simulated_verified"
      : parsed.status;

  return EnvironmentActionVerificationResultSchema.parse({
    kind: "environment.action.verification_result",
    proposalId: parsed.proposalId,
    executionStatus: parsed.status,
    adapterId: parsed.adapterId,
    adapterKind: "fake_local",
    status,
    simulated: true,
    testOnly: true,
    localOnly: true,
    physicalSideEffects: false,
    realDeviceTouched: false,
    commandsIssued: 0,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  });
}
