import { z } from "zod";
import {
  EnvironmentLocalCommandPreflightSchema,
  type EnvironmentLocalCommandPreflight,
} from "./action-command-contract";
import {
  EnvironmentActionLifecycleProposalSchema,
  type EnvironmentActionLifecycleProposal,
} from "./action-lifecycle";
import { EnvironmentActionIntentOperationSchema } from "./action-intent";
import {
  EnvironmentCapabilityIdSchema,
  EnvironmentIdSchema,
  type EnvironmentCapabilityId,
} from "./types";

export const ENVIRONMENT_LOCAL_COMMAND_ADAPTER_KINDS = [
  "local_contract_stub",
] as const;

export const ENVIRONMENT_LOCAL_COMMAND_EXECUTION_STATUSES = [
  "local_boundary_accepted",
  "blocked_feature_disabled",
  "blocked_requires_approval",
  "blocked_policy_denied",
  "blocked_stale_or_unknown_state",
  "blocked_multi_device",
  "blocked_unsupported_capability",
  "blocked_voice_authority",
  "blocked_disabled_feature",
] as const;

export const ENVIRONMENT_LOCAL_COMMAND_VERIFICATION_STATUSES = [
  "metadata_verified",
  "skipped",
] as const;

export type EnvironmentLocalCommandAdapterKind =
  (typeof ENVIRONMENT_LOCAL_COMMAND_ADAPTER_KINDS)[number];
export type EnvironmentLocalCommandExecutionStatus =
  (typeof ENVIRONMENT_LOCAL_COMMAND_EXECUTION_STATUSES)[number];
export type EnvironmentLocalCommandVerificationStatus =
  (typeof ENVIRONMENT_LOCAL_COMMAND_VERIFICATION_STATUSES)[number];

export const EnvironmentLocalCommandAdapterKindSchema = z.enum(
  ENVIRONMENT_LOCAL_COMMAND_ADAPTER_KINDS,
);
export const EnvironmentLocalCommandExecutionStatusSchema = z.enum(
  ENVIRONMENT_LOCAL_COMMAND_EXECUTION_STATUSES,
);
export const EnvironmentLocalCommandVerificationStatusSchema = z.enum(
  ENVIRONMENT_LOCAL_COMMAND_VERIFICATION_STATUSES,
);

export const EnvironmentLocalCommandExecutionConsentSchema = z.strictObject({
  enabled: z.boolean().default(false),
  userConsented: z.boolean().default(false),
  localOnly: z.literal(true),
  realAdaptersEnabled: z.literal(false),
  physicalSideEffectsAllowed: z.literal(false),
  metadataOnly: z.literal(true),
});

export const EnvironmentLocalCommandAdapterContractSchema = z.strictObject({
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("local_contract_stub"),
  supportedDeviceId: EnvironmentIdSchema,
  supportedCapabilityId: EnvironmentCapabilityIdSchema,
  supportedOperation: EnvironmentActionIntentOperationSchema,
  localOnly: z.literal(true),
  stubOnly: z.literal(true),
  realDeviceAdapter: z.literal(false),
  supportsScenes: z.literal(false),
  supportsRoutines: z.literal(false),
  supportsMacros: z.literal(false),
  supportsDiscovery: z.literal(false),
  supportsCloudBridge: z.literal(false),
});

export const EnvironmentLocalCommandExecutionResultSchema = z.strictObject({
  kind: z.literal("environment.local_command_execution_result"),
  proposalId: EnvironmentIdSchema,
  intentId: EnvironmentIdSchema,
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("local_contract_stub"),
  status: EnvironmentLocalCommandExecutionStatusSchema,
  capabilityId: EnvironmentCapabilityIdSchema,
  operation: EnvironmentActionIntentOperationSchema,
  preflightResult: z.string(),
  boundaryOnly: z.literal(true),
  localOnly: z.literal(true),
  stubOnly: z.literal(true),
  adapterInvoked: z.boolean(),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export const EnvironmentLocalCommandVerificationResultSchema = z.strictObject({
  kind: z.literal("environment.local_command_verification_result"),
  proposalId: EnvironmentIdSchema,
  executionStatus: EnvironmentLocalCommandExecutionStatusSchema,
  adapterId: EnvironmentIdSchema,
  adapterKind: z.literal("local_contract_stub"),
  status: EnvironmentLocalCommandVerificationStatusSchema,
  boundaryOnly: z.literal(true),
  localOnly: z.literal(true),
  stubOnly: z.literal(true),
  metadataOnly: z.literal(true),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  commandsIssued: z.literal(0),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentLocalCommandExecutionConsent = z.infer<
  typeof EnvironmentLocalCommandExecutionConsentSchema
>;
export type EnvironmentLocalCommandAdapterContract = z.infer<
  typeof EnvironmentLocalCommandAdapterContractSchema
>;
export type EnvironmentLocalCommandExecutionResult = z.infer<
  typeof EnvironmentLocalCommandExecutionResultSchema
>;
export type EnvironmentLocalCommandVerificationResult = z.infer<
  typeof EnvironmentLocalCommandVerificationResultSchema
>;

export const DEFAULT_ENVIRONMENT_LOCAL_COMMAND_EXECUTION_CONSENT =
  EnvironmentLocalCommandExecutionConsentSchema.parse({
    enabled: false,
    userConsented: false,
    localOnly: true,
    realAdaptersEnabled: false,
    physicalSideEffectsAllowed: false,
    metadataOnly: true,
  });

export interface CreateEnvironmentLocalCommandAdapterContractInput {
  adapterId?: string;
  supportedDeviceId: string;
  supportedCapabilityId?: EnvironmentCapabilityId;
  supportedOperation?: "set";
}

export interface ExecuteEnvironmentLocalCommandBoundaryInput {
  proposal: EnvironmentActionLifecycleProposal;
  preflight: EnvironmentLocalCommandPreflight;
  adapter: EnvironmentLocalCommandAdapterContract;
  consent?: Partial<EnvironmentLocalCommandExecutionConsent>;
}

function normalizeConsent(
  input?: Partial<EnvironmentLocalCommandExecutionConsent>,
): EnvironmentLocalCommandExecutionConsent {
  return EnvironmentLocalCommandExecutionConsentSchema.parse({
    ...DEFAULT_ENVIRONMENT_LOCAL_COMMAND_EXECUTION_CONSENT,
    ...input,
  });
}

function result(input: {
  proposal: EnvironmentActionLifecycleProposal;
  preflight: EnvironmentLocalCommandPreflight;
  adapter: EnvironmentLocalCommandAdapterContract;
  status: EnvironmentLocalCommandExecutionStatus;
  adapterInvoked: boolean;
}): EnvironmentLocalCommandExecutionResult {
  return EnvironmentLocalCommandExecutionResultSchema.parse({
    kind: "environment.local_command_execution_result",
    proposalId: input.proposal.id,
    intentId: input.proposal.plan.intentId,
    adapterId: input.adapter.adapterId,
    adapterKind: "local_contract_stub",
    status: input.status,
    capabilityId: input.proposal.plan.capabilityId,
    operation: input.proposal.plan.operation,
    preflightResult: input.preflight.result,
    boundaryOnly: true,
    localOnly: true,
    stubOnly: true,
    adapterInvoked: input.adapterInvoked,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
    realDeviceTouched: false,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  });
}

function statusFromPreflight(
  preflight: EnvironmentLocalCommandPreflight,
): EnvironmentLocalCommandExecutionStatus {
  if (preflight.result === "eligible_for_local_adapter") {
    return "local_boundary_accepted";
  }
  return preflight.result;
}

export function createEnvironmentLocalCommandAdapterContract(
  input: CreateEnvironmentLocalCommandAdapterContractInput,
): EnvironmentLocalCommandAdapterContract {
  return EnvironmentLocalCommandAdapterContractSchema.parse({
    adapterId: input.adapterId ?? "adapter:local-contract-stub",
    adapterKind: "local_contract_stub",
    supportedDeviceId: input.supportedDeviceId,
    supportedCapabilityId: input.supportedCapabilityId ?? "light.observe",
    supportedOperation: input.supportedOperation ?? "set",
    localOnly: true,
    stubOnly: true,
    realDeviceAdapter: false,
    supportsScenes: false,
    supportsRoutines: false,
    supportsMacros: false,
    supportsDiscovery: false,
    supportsCloudBridge: false,
  });
}

export function executeEnvironmentLocalCommandBoundary(
  input: ExecuteEnvironmentLocalCommandBoundaryInput,
): EnvironmentLocalCommandExecutionResult {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );
  const preflight = EnvironmentLocalCommandPreflightSchema.parse(
    input.preflight,
  );
  const adapter = EnvironmentLocalCommandAdapterContractSchema.parse(
    input.adapter,
  );
  const consent = normalizeConsent(input.consent);

  if (!consent.enabled || !consent.userConsented) {
    return result({
      proposal,
      preflight,
      adapter,
      status: "blocked_feature_disabled",
      adapterInvoked: false,
    });
  }

  if (proposal.sourceSurface === "voice") {
    return result({
      proposal,
      preflight,
      adapter,
      status: "blocked_voice_authority",
      adapterInvoked: false,
    });
  }

  if (
    proposal.plan.policy.reason === "stale_or_missing_state" ||
    proposal.plan.state.policySensitiveUsable === false ||
    proposal.plan.state.reason !== "current_observation"
  ) {
    return result({
      proposal,
      preflight,
      adapter,
      status: "blocked_stale_or_unknown_state",
      adapterInvoked: false,
    });
  }

  if (proposal.state !== "approved") {
    return result({
      proposal,
      preflight,
      adapter,
      status:
        proposal.state === "proposed" || proposal.state === "requires_approval"
          ? "blocked_requires_approval"
          : "blocked_policy_denied",
      adapterInvoked: false,
    });
  }

  if (preflight.result !== "eligible_for_local_adapter") {
    return result({
      proposal,
      preflight,
      adapter,
      status: statusFromPreflight(preflight),
      adapterInvoked: false,
    });
  }

  if (
    preflight.contract === null ||
    preflight.contract.deviceId !== adapter.supportedDeviceId ||
    preflight.contract.capabilityId !== adapter.supportedCapabilityId ||
    preflight.contract.operation !== adapter.supportedOperation
  ) {
    return result({
      proposal,
      preflight,
      adapter,
      status: "blocked_unsupported_capability",
      adapterInvoked: false,
    });
  }

  if (proposal.plan.policy.decision !== "allowed") {
    return result({
      proposal,
      preflight,
      adapter,
      status: "blocked_policy_denied",
      adapterInvoked: false,
    });
  }

  return result({
    proposal,
    preflight,
    adapter,
    status: "local_boundary_accepted",
    adapterInvoked: true,
  });
}

export function verifyEnvironmentLocalCommandBoundary(
  execution: EnvironmentLocalCommandExecutionResult,
): EnvironmentLocalCommandVerificationResult {
  const parsed = EnvironmentLocalCommandExecutionResultSchema.parse(execution);
  return EnvironmentLocalCommandVerificationResultSchema.parse({
    kind: "environment.local_command_verification_result",
    proposalId: parsed.proposalId,
    executionStatus: parsed.status,
    adapterId: parsed.adapterId,
    adapterKind: "local_contract_stub",
    status:
      parsed.status === "local_boundary_accepted"
        ? "metadata_verified"
        : "skipped",
    boundaryOnly: true,
    localOnly: true,
    stubOnly: true,
    metadataOnly: true,
    physicalSideEffects: false,
    realDeviceTouched: false,
    commandsIssued: 0,
    canonical: false,
    authoritative: false,
  });
}
