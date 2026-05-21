import { z } from "zod";
import {
  ENVIRONMENT_CAPABILITY_IDS,
  EnvironmentCapabilityIdSchema,
  EnvironmentRegistrySchema,
  EnvironmentTrustClassSchema,
  type EnvironmentCapabilityId,
  type EnvironmentRegistry,
  type EnvironmentTrustClass,
} from "./types";

export const ENVIRONMENT_ACTION_KINDS = ["read", "mutate"] as const;
export const ENVIRONMENT_POLICY_DECISIONS = [
  "allowed",
  "denied",
  "requires_approval",
] as const;
export const ENVIRONMENT_POLICY_REASONS = [
  "unknown_device",
  "unknown_room",
  "capability_not_allowed",
  "trust_class_denied",
  "restricted_requires_approval",
  "quiet_hours_denied",
  "forbidden_device",
  "stale_or_missing_state",
  "allowed_safe_mutate",
  "observe_only_read_allowed",
] as const;

export type EnvironmentActionKind = (typeof ENVIRONMENT_ACTION_KINDS)[number];
export type EnvironmentPolicyDecision =
  (typeof ENVIRONMENT_POLICY_DECISIONS)[number];
export type EnvironmentPolicyReason =
  (typeof ENVIRONMENT_POLICY_REASONS)[number];

export const EnvironmentActionKindSchema = z.enum(ENVIRONMENT_ACTION_KINDS);
export const EnvironmentPolicyDecisionSchema = z.enum(
  ENVIRONMENT_POLICY_DECISIONS,
);
export const EnvironmentPolicyReasonSchema = z.enum(ENVIRONMENT_POLICY_REASONS);

export const QuietHoursSchema = z.object({
  enabled: z.boolean().default(false),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  denyMutations: z.boolean().default(true),
});

export const TrustClassActionRuleSchema = z.object({
  trustClass: EnvironmentTrustClassSchema,
  read: EnvironmentPolicyDecisionSchema.default("denied"),
  mutate: EnvironmentPolicyDecisionSchema.default("denied"),
});

export const RoomPolicySchema = z.object({
  roomId: z.string().trim().min(1).max(120),
  quietHours: QuietHoursSchema.optional(),
  safeMutateCapabilities: z.array(EnvironmentCapabilityIdSchema).default([]),
  deniedCapabilities: z.array(EnvironmentCapabilityIdSchema).default([]),
});

export const CapabilityEligibilitySchema = z.object({
  capabilityId: EnvironmentCapabilityIdSchema,
  safeMutationEligible: z.boolean().default(false),
  requiresFreshState: z.boolean().default(true),
});

export const EnvironmentPolicySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  userOwned: z.literal(true).default(true),
  defaultDecision: z.literal("denied").default("denied"),
  staleStateAfterMs: z
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1_000),
  trustClassRules: z.array(TrustClassActionRuleSchema).default([
    {
      trustClass: "observe-only",
      read: "allowed",
      mutate: "denied",
    },
    {
      trustClass: "safe-mutate",
      read: "allowed",
      mutate: "allowed",
    },
    {
      trustClass: "restricted-mutate",
      read: "allowed",
      mutate: "requires_approval",
    },
    {
      trustClass: "forbidden",
      read: "denied",
      mutate: "denied",
    },
  ]),
  capabilityEligibility: z.array(CapabilityEligibilitySchema).default(
    ENVIRONMENT_CAPABILITY_IDS.map((capabilityId) => ({
      capabilityId,
      safeMutationEligible: false,
      requiresFreshState: true,
    })),
  ),
  roomPolicies: z.array(RoomPolicySchema).default([]),
});

export const EnvironmentActionSchema = z.object({
  deviceId: z.string().trim().min(1).max(120),
  roomId: z.string().trim().min(1).max(120).optional(),
  capabilityId: z.string().trim().min(1).max(120),
  action: EnvironmentActionKindSchema,
  requestedAtMinute: z.number().int().min(0).max(1439).optional(),
  nowMs: z.number().int().nonnegative().optional(),
  stateObservedAtMs: z.number().int().nonnegative().optional(),
});

export type QuietHours = z.infer<typeof QuietHoursSchema>;
export type TrustClassActionRule = z.infer<typeof TrustClassActionRuleSchema>;
export type RoomPolicy = z.infer<typeof RoomPolicySchema>;
export type CapabilityEligibility = z.infer<typeof CapabilityEligibilitySchema>;
export type EnvironmentPolicy = z.infer<typeof EnvironmentPolicySchema>;
export type EnvironmentPolicyInput = z.input<typeof EnvironmentPolicySchema>;
export type EnvironmentAction = z.infer<typeof EnvironmentActionSchema>;

export interface EnvironmentPolicyEvaluation {
  decision: EnvironmentPolicyDecision;
  reason: EnvironmentPolicyReason;
  deviceId: string | null;
  roomId: string | null;
  capabilityId: string | null;
  trustClass: EnvironmentTrustClass | null;
  approvalRequired: boolean;
  policyOnly: true;
  physicalSideEffects: false;
  voiceBypassAllowed: false;
}

function result(input: {
  decision: EnvironmentPolicyDecision;
  reason: EnvironmentPolicyReason;
  deviceId?: string | null;
  roomId?: string | null;
  capabilityId?: string | null;
  trustClass?: EnvironmentTrustClass | null;
}): EnvironmentPolicyEvaluation {
  return {
    decision: input.decision,
    reason: input.reason,
    deviceId: input.deviceId ?? null,
    roomId: input.roomId ?? null,
    capabilityId: input.capabilityId ?? null,
    trustClass: input.trustClass ?? null,
    approvalRequired: input.decision === "requires_approval",
    policyOnly: true,
    physicalSideEffects: false,
    voiceBypassAllowed: false,
  };
}

function isQuietMinute(quietHours: QuietHours, minute: number): boolean {
  if (!quietHours.enabled) return false;
  if (quietHours.startMinute === quietHours.endMinute) return false;
  if (quietHours.startMinute < quietHours.endMinute) {
    return minute >= quietHours.startMinute && minute < quietHours.endMinute;
  }
  return minute >= quietHours.startMinute || minute < quietHours.endMinute;
}

function findTrustRule(
  policy: EnvironmentPolicy,
  trustClass: EnvironmentTrustClass,
): TrustClassActionRule | undefined {
  return policy.trustClassRules.find((rule) => rule.trustClass === trustClass);
}

function findCapabilityEligibility(
  policy: EnvironmentPolicy,
  capabilityId: EnvironmentCapabilityId,
): CapabilityEligibility | undefined {
  return policy.capabilityEligibility.find(
    (eligibility) => eligibility.capabilityId === capabilityId,
  );
}

function hasFreshState(
  action: EnvironmentAction,
  staleStateAfterMs: number,
): boolean {
  if (action.nowMs === undefined || action.stateObservedAtMs === undefined) {
    return false;
  }
  return action.nowMs - action.stateObservedAtMs <= staleStateAfterMs;
}

export function createEnvironmentPolicy(
  input: EnvironmentPolicyInput = {},
): EnvironmentPolicy {
  return EnvironmentPolicySchema.parse(input);
}

export function evaluateEnvironmentAction(input: {
  registry: EnvironmentRegistry;
  policy: EnvironmentPolicy;
  action: EnvironmentAction;
}): EnvironmentPolicyEvaluation {
  const registry = EnvironmentRegistrySchema.parse(input.registry);
  const policy = EnvironmentPolicySchema.parse(input.policy);
  const action = EnvironmentActionSchema.parse(input.action);
  const capability = EnvironmentCapabilityIdSchema.safeParse(
    action.capabilityId,
  );

  if (!capability.success) {
    return result({
      decision: "denied",
      reason: "capability_not_allowed",
      deviceId: action.deviceId,
      roomId: action.roomId ?? null,
      capabilityId: action.capabilityId,
    });
  }

  const capabilityId = capability.data;
  const device = registry.devices.find((item) => item.id === action.deviceId);
  if (!device) {
    return result({
      decision: "denied",
      reason: "unknown_device",
      deviceId: action.deviceId,
      roomId: action.roomId ?? null,
      capabilityId,
    });
  }

  const roomId = action.roomId ?? device.roomId;
  const room = registry.rooms.find((item) => item.id === roomId);
  if (!room || room.id !== device.roomId) {
    return result({
      decision: "denied",
      reason: "unknown_room",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (device.trustClass === "forbidden") {
    return result({
      decision: "denied",
      reason: "forbidden_device",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (!device.capabilities.includes(capabilityId)) {
    return result({
      decision: "denied",
      reason: "capability_not_allowed",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  const roomPolicy = policy.roomPolicies.find((item) => item.roomId === roomId);
  if (roomPolicy?.deniedCapabilities.includes(capabilityId)) {
    return result({
      decision: "denied",
      reason: "capability_not_allowed",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (
    action.action === "mutate" &&
    roomPolicy?.quietHours &&
    roomPolicy.quietHours.denyMutations &&
    action.requestedAtMinute !== undefined &&
    isQuietMinute(roomPolicy.quietHours, action.requestedAtMinute)
  ) {
    return result({
      decision: "denied",
      reason: "quiet_hours_denied",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  const rule = findTrustRule(policy, device.trustClass);
  if (!rule) {
    return result({
      decision: "denied",
      reason: "trust_class_denied",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (action.action === "read") {
    if (rule.read === "allowed") {
      return result({
        decision: "allowed",
        reason: "observe_only_read_allowed",
        deviceId: device.id,
        roomId,
        capabilityId,
        trustClass: device.trustClass,
      });
    }
    return result({
      decision: "denied",
      reason: "trust_class_denied",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (rule.mutate === "denied") {
    return result({
      decision: "denied",
      reason: "trust_class_denied",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  const eligibility = findCapabilityEligibility(policy, capabilityId);
  if (!eligibility?.safeMutationEligible) {
    return result({
      decision: "denied",
      reason: "capability_not_allowed",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  const roomAllowsSafeMutation =
    roomPolicy?.safeMutateCapabilities.includes(capabilityId) ?? false;
  if (device.trustClass === "safe-mutate" && !roomAllowsSafeMutation) {
    return result({
      decision: "denied",
      reason: "capability_not_allowed",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (
    eligibility.requiresFreshState &&
    !hasFreshState(action, policy.staleStateAfterMs)
  ) {
    return result({
      decision: "denied",
      reason: "stale_or_missing_state",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  if (rule.mutate === "requires_approval") {
    return result({
      decision: "requires_approval",
      reason: "restricted_requires_approval",
      deviceId: device.id,
      roomId,
      capabilityId,
      trustClass: device.trustClass,
    });
  }

  return result({
    decision: "allowed",
    reason: "allowed_safe_mutate",
    deviceId: device.id,
    roomId,
    capabilityId,
    trustClass: device.trustClass,
  });
}
