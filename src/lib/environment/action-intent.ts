import { z } from "zod";
import {
  EnvironmentObservedValueSchema,
  type EnvironmentObservedValue,
} from "./state";
import {
  EnvironmentCapabilityIdSchema,
  EnvironmentIdSchema,
  type EnvironmentCapabilityId,
} from "./types";

export const ENVIRONMENT_ACTION_INTENT_TARGET_KINDS = [
  "room",
  "device",
] as const;

export const ENVIRONMENT_ACTION_INTENT_OPERATIONS = [
  "set",
  "increase",
  "decrease",
  "toggle",
] as const;

export const ENVIRONMENT_ACTION_INTENT_SOURCE_SURFACES = [
  "chat",
  "voice",
  "api",
  "test",
] as const;

export const ENVIRONMENT_ACTION_INTENT_ACTOR_KINDS = [
  "user",
  "system",
  "test",
] as const;

export const ENVIRONMENT_ACTION_INTENT_APPROVAL_EXPECTATIONS = [
  "unknown",
  "not_requested",
  "requires_approval",
] as const;

export type EnvironmentActionIntentTargetKind =
  (typeof ENVIRONMENT_ACTION_INTENT_TARGET_KINDS)[number];
export type EnvironmentActionIntentOperation =
  (typeof ENVIRONMENT_ACTION_INTENT_OPERATIONS)[number];
export type EnvironmentActionIntentSourceSurface =
  (typeof ENVIRONMENT_ACTION_INTENT_SOURCE_SURFACES)[number];
export type EnvironmentActionIntentActorKind =
  (typeof ENVIRONMENT_ACTION_INTENT_ACTOR_KINDS)[number];
export type EnvironmentActionIntentApprovalExpectation =
  (typeof ENVIRONMENT_ACTION_INTENT_APPROVAL_EXPECTATIONS)[number];

export const EnvironmentActionIntentTargetKindSchema = z.enum(
  ENVIRONMENT_ACTION_INTENT_TARGET_KINDS,
);
export const EnvironmentActionIntentOperationSchema = z.enum(
  ENVIRONMENT_ACTION_INTENT_OPERATIONS,
);
export const EnvironmentActionIntentSourceSurfaceSchema = z.enum(
  ENVIRONMENT_ACTION_INTENT_SOURCE_SURFACES,
);
export const EnvironmentActionIntentActorKindSchema = z.enum(
  ENVIRONMENT_ACTION_INTENT_ACTOR_KINDS,
);
export const EnvironmentActionIntentApprovalExpectationSchema = z.enum(
  ENVIRONMENT_ACTION_INTENT_APPROVAL_EXPECTATIONS,
);

export const EnvironmentActionIntentActorSchema = z.strictObject({
  actorKind: EnvironmentActionIntentActorKindSchema,
  actorId: EnvironmentIdSchema.optional(),
});

export const EnvironmentActionIntentPhaseMarkersSchema = z.strictObject({
  intent: z.literal(true),
  planned: z.literal(false),
  approved: z.literal(false),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  voiceGrantsAuthority: z.literal(false),
});

export const EnvironmentActionIntentSchema = z
  .strictObject({
    id: EnvironmentIdSchema,
    targetKind: EnvironmentActionIntentTargetKindSchema,
    targetId: EnvironmentIdSchema,
    roomId: EnvironmentIdSchema.optional(),
    capabilityId: EnvironmentCapabilityIdSchema,
    operation: EnvironmentActionIntentOperationSchema,
    requestedValue: EnvironmentObservedValueSchema,
    sourceSurface: EnvironmentActionIntentSourceSurfaceSchema,
    requestedAt: z.number().int().nonnegative(),
    actor: EnvironmentActionIntentActorSchema.optional(),
    approvalExpectation:
      EnvironmentActionIntentApprovalExpectationSchema.default("unknown"),
    phase: EnvironmentActionIntentPhaseMarkersSchema.default({
      intent: true,
      planned: false,
      approved: false,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      voiceGrantsAuthority: false,
    }),
    metadataOnly: z.literal(true),
  })
  .superRefine((intent, ctx) => {
    if (
      intent.sourceSurface === "voice" &&
      intent.approvalExpectation !== "unknown"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["approvalExpectation"],
        message: "Voice requests cannot imply approval expectation.",
      });
    }
  });

export type EnvironmentActionIntentActor = z.infer<
  typeof EnvironmentActionIntentActorSchema
>;
export type EnvironmentActionIntentPhaseMarkers = z.infer<
  typeof EnvironmentActionIntentPhaseMarkersSchema
>;
export type EnvironmentActionIntent = z.infer<
  typeof EnvironmentActionIntentSchema
>;

export type EnvironmentActionIntentValidationResult =
  | {
      ok: true;
      intent: EnvironmentActionIntent;
      markers: EnvironmentActionIntentPhaseMarkers;
    }
  | {
      ok: false;
      reason:
        | "invalid_intent"
        | "invalid_capability"
        | "invalid_operation"
        | "unsafe_value"
        | "voice_approval_not_allowed";
      planned: false;
      approved: false;
      executed: false;
      commandsIssued: 0;
      physicalSideEffects: false;
    };

function failure(
  reason: Exclude<
    EnvironmentActionIntentValidationResult,
    { ok: true }
  >["reason"],
): EnvironmentActionIntentValidationResult {
  return {
    ok: false,
    reason,
    planned: false,
    approved: false,
    executed: false,
    commandsIssued: 0,
    physicalSideEffects: false,
  };
}

function classifyIntentFailure(
  input: unknown,
): Exclude<EnvironmentActionIntentValidationResult, { ok: true }>["reason"] {
  if (typeof input !== "object" || input === null) return "invalid_intent";
  const record = input as Record<string, unknown>;
  if (!EnvironmentCapabilityIdSchema.safeParse(record.capabilityId).success) {
    return "invalid_capability";
  }
  if (
    !EnvironmentActionIntentOperationSchema.safeParse(record.operation).success
  ) {
    return "invalid_operation";
  }
  if (
    !EnvironmentObservedValueSchema.safeParse(record.requestedValue).success
  ) {
    return "unsafe_value";
  }
  if (
    record.sourceSurface === "voice" &&
    record.approvalExpectation !== undefined &&
    record.approvalExpectation !== "unknown"
  ) {
    return "voice_approval_not_allowed";
  }
  return "invalid_intent";
}

export function validateEnvironmentActionIntent(
  input: unknown,
): EnvironmentActionIntentValidationResult {
  const parsed = EnvironmentActionIntentSchema.safeParse(input);
  if (!parsed.success) return failure(classifyIntentFailure(input));

  return {
    ok: true,
    intent: parsed.data,
    markers: parsed.data.phase,
  };
}

export function createEnvironmentActionIntent(input: {
  id: string;
  targetKind: EnvironmentActionIntentTargetKind;
  targetId: string;
  roomId?: string;
  capabilityId: EnvironmentCapabilityId;
  operation: EnvironmentActionIntentOperation;
  requestedValue: EnvironmentObservedValue;
  sourceSurface: EnvironmentActionIntentSourceSurface;
  requestedAt: number;
  actor?: EnvironmentActionIntentActor;
  approvalExpectation?: EnvironmentActionIntentApprovalExpectation;
}): EnvironmentActionIntent {
  return EnvironmentActionIntentSchema.parse({
    ...input,
    metadataOnly: true,
  });
}
