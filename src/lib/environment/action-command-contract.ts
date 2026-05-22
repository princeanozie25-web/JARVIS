import { z } from "zod";
import {
  EnvironmentActionLifecycleProposalSchema,
  type EnvironmentActionLifecycleProposal,
} from "./action-lifecycle";
import { EnvironmentActionIntentOperationSchema } from "./action-intent";
import {
  EnvironmentCapabilityIdSchema,
  EnvironmentIdSchema,
  EnvironmentRegistrySchema,
  EnvironmentTrustClassSchema,
  Phase6DisabledFeatureSchema,
  type EnvironmentRegistry,
  type Phase6DisabledFeature,
} from "./types";

export const ENVIRONMENT_LOCAL_COMMAND_ACTION_KINDS = [
  "single_device",
  "scene",
  "routine",
  "macro",
] as const;

export const ENVIRONMENT_LOCAL_COMMAND_PREFLIGHT_RESULTS = [
  "eligible_for_local_adapter",
  "blocked_requires_approval",
  "blocked_policy_denied",
  "blocked_stale_or_unknown_state",
  "blocked_multi_device",
  "blocked_unsupported_capability",
  "blocked_voice_authority",
  "blocked_disabled_feature",
] as const;

export type EnvironmentLocalCommandActionKind =
  (typeof ENVIRONMENT_LOCAL_COMMAND_ACTION_KINDS)[number];
export type EnvironmentLocalCommandPreflightResult =
  (typeof ENVIRONMENT_LOCAL_COMMAND_PREFLIGHT_RESULTS)[number];

export const EnvironmentLocalCommandActionKindSchema = z.enum(
  ENVIRONMENT_LOCAL_COMMAND_ACTION_KINDS,
);
export const EnvironmentLocalCommandPreflightResultSchema = z.enum(
  ENVIRONMENT_LOCAL_COMMAND_PREFLIGHT_RESULTS,
);

export const EnvironmentLocalCommandContractSchema = z.strictObject({
  kind: z.literal("environment.local_command_contract"),
  proposalId: EnvironmentIdSchema,
  intentId: EnvironmentIdSchema,
  deviceId: EnvironmentIdSchema,
  capabilityId: EnvironmentCapabilityIdSchema,
  operation: EnvironmentActionIntentOperationSchema,
  requestedValue: z.unknown(),
  actionKind: z.literal("single_device"),
  targetDeviceCount: z.literal(1),
  localOnly: z.literal(true),
  singleDeviceOnly: z.literal(true),
  metadataOnly: z.literal(true),
  adapterInvoked: z.literal(false),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
});

export const EnvironmentLocalCommandPreflightSchema = z.strictObject({
  kind: z.literal("environment.local_command_preflight"),
  proposalId: EnvironmentIdSchema,
  intentId: EnvironmentIdSchema,
  result: EnvironmentLocalCommandPreflightResultSchema,
  actionKind: EnvironmentLocalCommandActionKindSchema,
  requestedDisabledFeature: Phase6DisabledFeatureSchema.nullable(),
  deviceId: EnvironmentIdSchema.nullable(),
  capabilityId: EnvironmentCapabilityIdSchema,
  policyDecision: z.enum(["allowed", "denied", "requires_approval"]),
  trustClass: EnvironmentTrustClassSchema.nullable(),
  stateReason: z.string().nullable(),
  contract: EnvironmentLocalCommandContractSchema.nullable(),
  preflightOnly: z.literal(true),
  adapterInvoked: z.literal(false),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  realDeviceTouched: z.literal(false),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentLocalCommandContract = z.infer<
  typeof EnvironmentLocalCommandContractSchema
>;
export type EnvironmentLocalCommandPreflight = z.infer<
  typeof EnvironmentLocalCommandPreflightSchema
>;

export interface PreflightEnvironmentLocalCommandInput {
  proposal: EnvironmentActionLifecycleProposal;
  registry: EnvironmentRegistry;
  actionKind?: EnvironmentLocalCommandActionKind;
  targetDeviceIds?: string[];
  requestedDisabledFeature?: Phase6DisabledFeature | null;
}

function noContract(input: {
  proposal: EnvironmentActionLifecycleProposal;
  result: EnvironmentLocalCommandPreflightResult;
  actionKind: EnvironmentLocalCommandActionKind;
  requestedDisabledFeature: Phase6DisabledFeature | null;
  targetDeviceId: string | null;
  trustClass: EnvironmentLocalCommandPreflight["trustClass"];
}): EnvironmentLocalCommandPreflight {
  return EnvironmentLocalCommandPreflightSchema.parse({
    kind: "environment.local_command_preflight",
    proposalId: input.proposal.id,
    intentId: input.proposal.plan.intentId,
    result: input.result,
    actionKind: input.actionKind,
    requestedDisabledFeature: input.requestedDisabledFeature,
    deviceId: input.targetDeviceId,
    capabilityId: input.proposal.plan.capabilityId,
    policyDecision: input.proposal.plan.policy.decision,
    trustClass: input.trustClass,
    stateReason: input.proposal.plan.state.reason,
    contract: null,
    preflightOnly: true,
    adapterInvoked: false,
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

function eligibleContract(
  proposal: EnvironmentActionLifecycleProposal,
): EnvironmentLocalCommandContract {
  return EnvironmentLocalCommandContractSchema.parse({
    kind: "environment.local_command_contract",
    proposalId: proposal.id,
    intentId: proposal.plan.intentId,
    deviceId: proposal.plan.deviceId,
    capabilityId: proposal.plan.capabilityId,
    operation: proposal.plan.operation,
    requestedValue: proposal.plan.requestedValue,
    actionKind: "single_device",
    targetDeviceCount: 1,
    localOnly: true,
    singleDeviceOnly: true,
    metadataOnly: true,
    adapterInvoked: false,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
    realDeviceTouched: false,
  });
}

function eligiblePreflight(
  proposal: EnvironmentActionLifecycleProposal,
): EnvironmentLocalCommandPreflight {
  return EnvironmentLocalCommandPreflightSchema.parse({
    kind: "environment.local_command_preflight",
    proposalId: proposal.id,
    intentId: proposal.plan.intentId,
    result: "eligible_for_local_adapter",
    actionKind: "single_device",
    requestedDisabledFeature: null,
    deviceId: proposal.plan.deviceId,
    capabilityId: proposal.plan.capabilityId,
    policyDecision: proposal.plan.policy.decision,
    trustClass: proposal.plan.trustClass,
    stateReason: proposal.plan.state.reason,
    contract: eligibleContract(proposal),
    preflightOnly: true,
    adapterInvoked: false,
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

export function preflightEnvironmentLocalCommand(
  input: PreflightEnvironmentLocalCommandInput,
): EnvironmentLocalCommandPreflight {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );
  const registry = EnvironmentRegistrySchema.parse(input.registry);
  const actionKind = input.actionKind ?? "single_device";
  const requestedDisabledFeature = input.requestedDisabledFeature ?? null;
  const deviceIds =
    input.targetDeviceIds ??
    [proposal.plan.deviceId].filter((id): id is string => id !== null);
  const targetDeviceId = deviceIds[0] ?? proposal.plan.deviceId;
  const device = registry.devices.find((item) => item.id === targetDeviceId);
  const trustClass = device?.trustClass ?? proposal.plan.trustClass;

  if (requestedDisabledFeature !== null) {
    return noContract({
      proposal,
      result: "blocked_disabled_feature",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (actionKind !== "single_device") {
    return noContract({
      proposal,
      result: "blocked_disabled_feature",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (
    deviceIds.length !== 1 ||
    proposal.plan.deviceId === null ||
    targetDeviceId !== proposal.plan.deviceId
  ) {
    return noContract({
      proposal,
      result: "blocked_multi_device",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (proposal.sourceSurface === "voice") {
    return noContract({
      proposal,
      result: "blocked_voice_authority",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (
    proposal.plan.policy.reason === "stale_or_missing_state" ||
    proposal.plan.state.policySensitiveUsable === false ||
    proposal.plan.state.reason !== "current_observation"
  ) {
    return noContract({
      proposal,
      result: "blocked_stale_or_unknown_state",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (proposal.state !== "approved") {
    return noContract({
      proposal,
      result:
        proposal.state === "requires_approval" || proposal.state === "proposed"
          ? "blocked_requires_approval"
          : "blocked_policy_denied",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (!device || !device.capabilities.includes(proposal.plan.capabilityId)) {
    return noContract({
      proposal,
      result: "blocked_unsupported_capability",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  if (proposal.plan.policy.decision === "denied") {
    return noContract({
      proposal,
      result: "blocked_policy_denied",
      actionKind,
      requestedDisabledFeature,
      targetDeviceId,
      trustClass,
    });
  }

  return eligiblePreflight(proposal);
}
