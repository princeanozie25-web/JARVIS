import { z } from "zod";
import {
  EnvironmentActionIntentOperationSchema,
  EnvironmentActionIntentSchema,
  EnvironmentActionIntentSourceSurfaceSchema,
  validateEnvironmentActionIntent,
  type EnvironmentActionIntent,
} from "./action-intent";
import {
  createEnvironmentPolicy,
  evaluateEnvironmentAction,
  EnvironmentPolicyDecisionSchema,
  EnvironmentPolicyReasonSchema,
  type EnvironmentPolicy,
  type EnvironmentPolicyDecision,
  type EnvironmentPolicyEvaluation,
  type EnvironmentPolicyInput,
  type EnvironmentPolicyReason,
} from "./policy";
import {
  EnvironmentEvaluatedFreshnessStatusSchema,
  resolveCurrentPassiveEnvironmentState,
  type PassiveEnvironmentStateFreshnessConfig,
  type PassiveEnvironmentStateRecord,
} from "./state";
import {
  EnvironmentCapabilityIdSchema,
  EnvironmentIdSchema,
  EnvironmentRegistrySchema,
  EnvironmentTrustClassSchema,
  type Device,
  type EnvironmentCapabilityId,
  type EnvironmentRegistry,
  type EnvironmentTrustClass,
} from "./types";

export const ENVIRONMENT_DRY_RUN_PLAN_DECISIONS = [
  "allowed",
  "requires_approval",
  "denied",
] as const;

export const ENVIRONMENT_DRY_RUN_PLAN_STATE_REASONS = [
  "current_observation",
  "state_absent",
  "state_stale",
  "state_expired",
  "state_conflict",
  "low_confidence",
  "freshness_unknown",
  "not_checked",
] as const;

export type EnvironmentDryRunPlanDecision =
  (typeof ENVIRONMENT_DRY_RUN_PLAN_DECISIONS)[number];
export type EnvironmentDryRunPlanStateReason =
  (typeof ENVIRONMENT_DRY_RUN_PLAN_STATE_REASONS)[number];

export const EnvironmentDryRunPlanDecisionSchema = z.enum(
  ENVIRONMENT_DRY_RUN_PLAN_DECISIONS,
);
export const EnvironmentDryRunPlanStateReasonSchema = z.enum(
  ENVIRONMENT_DRY_RUN_PLAN_STATE_REASONS,
);

export const EnvironmentDryRunPlanPhaseMarkersSchema = z.strictObject({
  dryRun: z.literal(true),
  planned: z.literal(true),
  approved: z.literal(false),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  voiceGrantsAuthority: z.literal(false),
});

export const EnvironmentDryRunPlanStateSummarySchema = z.strictObject({
  checked: z.boolean(),
  freshnessStatus: EnvironmentEvaluatedFreshnessStatusSchema.nullable(),
  reason: EnvironmentDryRunPlanStateReasonSchema,
  policySensitiveUsable: z.boolean(),
  currentTruth: z.literal(false),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export const EnvironmentDryRunPlanPolicySummarySchema = z.strictObject({
  decision: EnvironmentPolicyDecisionSchema,
  reason: EnvironmentPolicyReasonSchema,
  approvalRequired: z.boolean(),
  policyOnly: z.literal(true),
  physicalSideEffects: z.literal(false),
  voiceBypassAllowed: z.literal(false),
});

export const EnvironmentDryRunActionPlanSchema = z.strictObject({
  kind: z.literal("environment.action.dry_run_plan"),
  dryRun: z.literal(true),
  planned: z.literal(true),
  approved: z.literal(false),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  intentId: EnvironmentIdSchema,
  sourceSurface: EnvironmentActionIntentSourceSurfaceSchema,
  targetKind: z.enum(["room", "device"]),
  targetId: EnvironmentIdSchema,
  roomId: EnvironmentIdSchema.nullable(),
  deviceId: EnvironmentIdSchema.nullable(),
  capabilityId: EnvironmentCapabilityIdSchema,
  operation: EnvironmentActionIntentOperationSchema,
  requestedValue: z.unknown(),
  trustClass: EnvironmentTrustClassSchema.nullable(),
  planDecision: EnvironmentDryRunPlanDecisionSchema,
  approvalRequired: z.boolean(),
  executionDenied: z.boolean(),
  policy: EnvironmentDryRunPlanPolicySummarySchema,
  state: EnvironmentDryRunPlanStateSummarySchema,
  phase: EnvironmentDryRunPlanPhaseMarkersSchema,
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentDryRunPlanPhaseMarkers = z.infer<
  typeof EnvironmentDryRunPlanPhaseMarkersSchema
>;
export type EnvironmentDryRunPlanStateSummary = z.infer<
  typeof EnvironmentDryRunPlanStateSummarySchema
>;
export type EnvironmentDryRunPlanPolicySummary = z.infer<
  typeof EnvironmentDryRunPlanPolicySummarySchema
>;
export type EnvironmentDryRunActionPlan = z.infer<
  typeof EnvironmentDryRunActionPlanSchema
>;

export type EnvironmentDryRunPlannerResult =
  | {
      ok: true;
      plan: EnvironmentDryRunActionPlan;
    }
  | {
      ok: false;
      reason: "invalid_intent";
      dryRun: true;
      planned: false;
      approved: false;
      executed: false;
      verified: false;
      commandsIssued: 0;
      physicalSideEffects: false;
      metadataOnly: true;
    };

export interface CreateDryRunEnvironmentActionPlanInput {
  registry: EnvironmentRegistry;
  policy?: EnvironmentPolicy | EnvironmentPolicyInput;
  intent: EnvironmentActionIntent | unknown;
  passiveStateRecords?: PassiveEnvironmentStateRecord[];
  nowMs: number;
  requestedAtMinute?: number;
  freshnessConfig?: Partial<PassiveEnvironmentStateFreshnessConfig>;
}

interface ResolvedTarget {
  deviceId: string | null;
  roomId: string | null;
  trustClass: EnvironmentTrustClass | null;
  policyReason?: EnvironmentPolicyReason;
}

function phaseMarkers(): EnvironmentDryRunPlanPhaseMarkers {
  return {
    dryRun: true,
    planned: true,
    approved: false,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
    voiceGrantsAuthority: false,
  };
}

function toPlanDecision(
  decision: EnvironmentPolicyDecision,
): EnvironmentDryRunPlanDecision {
  return decision;
}

function policySummary(
  evaluation: EnvironmentPolicyEvaluation,
): EnvironmentDryRunPlanPolicySummary {
  return {
    decision: evaluation.decision,
    reason: evaluation.reason,
    approvalRequired: evaluation.approvalRequired,
    policyOnly: true,
    physicalSideEffects: false,
    voiceBypassAllowed: false,
  };
}

function deniedPolicy(input: {
  reason: EnvironmentPolicyReason;
  deviceId: string | null;
  roomId: string | null;
  capabilityId: EnvironmentCapabilityId;
  trustClass: EnvironmentTrustClass | null;
}): EnvironmentPolicyEvaluation {
  return {
    decision: "denied",
    reason: input.reason,
    deviceId: input.deviceId,
    roomId: input.roomId,
    capabilityId: input.capabilityId,
    trustClass: input.trustClass,
    approvalRequired: false,
    policyOnly: true,
    physicalSideEffects: false,
    voiceBypassAllowed: false,
  };
}

function resolveTarget(
  registry: EnvironmentRegistry,
  intent: EnvironmentActionIntent,
): ResolvedTarget {
  if (intent.targetKind === "device") {
    const device = registry.devices.find((item) => item.id === intent.targetId);
    if (!device) {
      return {
        deviceId: intent.targetId,
        roomId: intent.roomId ?? null,
        trustClass: null,
        policyReason: "unknown_device",
      };
    }

    const roomId = intent.roomId ?? device.roomId;
    const room = registry.rooms.find((item) => item.id === roomId);
    if (!room || room.id !== device.roomId) {
      return {
        deviceId: device.id,
        roomId,
        trustClass: device.trustClass,
        policyReason: "unknown_room",
      };
    }

    return {
      deviceId: device.id,
      roomId,
      trustClass: device.trustClass,
    };
  }

  const room = registry.rooms.find((item) => item.id === intent.targetId);
  if (!room) {
    return {
      deviceId: null,
      roomId: intent.targetId,
      trustClass: null,
      policyReason: "unknown_room",
    };
  }

  const device = registry.devices
    .filter(
      (item): item is Device =>
        item.roomId === room.id &&
        item.capabilities.includes(intent.capabilityId),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];

  if (!device) {
    return {
      deviceId: null,
      roomId: room.id,
      trustClass: null,
      policyReason: "unknown_device",
    };
  }

  return {
    deviceId: device.id,
    roomId: room.id,
    trustClass: device.trustClass,
  };
}

function resolvePlanState(input: {
  records: PassiveEnvironmentStateRecord[];
  deviceId: string | null;
  capabilityId: EnvironmentCapabilityId;
  nowMs: number;
  freshnessConfig?: Partial<PassiveEnvironmentStateFreshnessConfig>;
}): {
  summary: EnvironmentDryRunPlanStateSummary;
  stateObservedAtMs?: number;
} {
  if (!input.deviceId) {
    return {
      summary: {
        checked: false,
        freshnessStatus: null,
        reason: "not_checked",
        policySensitiveUsable: false,
        currentTruth: false,
        metadataOnly: true,
        canonical: false,
        authoritative: false,
      },
    };
  }

  const resolution = resolveCurrentPassiveEnvironmentState({
    records: input.records,
    deviceId: input.deviceId,
    capabilityId: input.capabilityId,
    nowMs: input.nowMs,
    config: input.freshnessConfig,
    policySensitive: true,
  });

  if (resolution.found) {
    return {
      summary: {
        checked: true,
        freshnessStatus: resolution.freshness.status,
        reason: resolution.reason,
        policySensitiveUsable: resolution.policySensitiveUsable,
        currentTruth: false,
        metadataOnly: true,
        canonical: false,
        authoritative: false,
      },
      stateObservedAtMs: resolution.current.observedAt,
    };
  }

  return {
    summary: {
      checked: true,
      freshnessStatus: resolution.freshness?.status ?? "unknown",
      reason: resolution.unknown.reason,
      policySensitiveUsable: false,
      currentTruth: false,
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    },
  };
}

export function createDryRunEnvironmentActionPlan(
  input: CreateDryRunEnvironmentActionPlanInput,
): EnvironmentDryRunPlannerResult {
  const intentResult = validateEnvironmentActionIntent(input.intent);
  if (!intentResult.ok) {
    return {
      ok: false,
      reason: "invalid_intent",
      dryRun: true,
      planned: false,
      approved: false,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      metadataOnly: true,
    };
  }

  const registry = EnvironmentRegistrySchema.parse(input.registry);
  const policy = createEnvironmentPolicy(input.policy);
  const intent = EnvironmentActionIntentSchema.parse(intentResult.intent);
  const resolved = resolveTarget(registry, intent);
  const stateResolution = resolvePlanState({
    records: input.passiveStateRecords ?? [],
    deviceId: resolved.deviceId,
    capabilityId: intent.capabilityId,
    nowMs: input.nowMs,
    freshnessConfig: input.freshnessConfig,
  });
  const state = stateResolution.summary;

  const evaluation = resolved.policyReason
    ? deniedPolicy({
        reason: resolved.policyReason,
        deviceId: resolved.deviceId,
        roomId: resolved.roomId,
        capabilityId: intent.capabilityId,
        trustClass: resolved.trustClass,
      })
    : evaluateEnvironmentAction({
        registry,
        policy,
        action: {
          deviceId: resolved.deviceId ?? intent.targetId,
          roomId: resolved.roomId ?? undefined,
          capabilityId: intent.capabilityId,
          action: "mutate",
          requestedAtMinute: input.requestedAtMinute,
          nowMs: input.nowMs,
          stateObservedAtMs: state.policySensitiveUsable
            ? stateResolution.stateObservedAtMs
            : undefined,
        },
      });

  const planDecision = toPlanDecision(evaluation.decision);
  const plan = EnvironmentDryRunActionPlanSchema.parse({
    kind: "environment.action.dry_run_plan",
    dryRun: true,
    planned: true,
    approved: false,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
    intentId: intent.id,
    sourceSurface: intent.sourceSurface,
    targetKind: intent.targetKind,
    targetId: intent.targetId,
    roomId: evaluation.roomId ?? resolved.roomId,
    deviceId: evaluation.deviceId ?? resolved.deviceId,
    capabilityId: intent.capabilityId,
    operation: intent.operation,
    requestedValue: intent.requestedValue,
    trustClass: evaluation.trustClass ?? resolved.trustClass,
    planDecision,
    approvalRequired: evaluation.approvalRequired,
    executionDenied: evaluation.decision === "denied",
    policy: policySummary(evaluation),
    state,
    phase: phaseMarkers(),
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  });

  return { ok: true, plan };
}
