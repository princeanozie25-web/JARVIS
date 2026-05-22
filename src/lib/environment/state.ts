import { z } from "zod";
import {
  EnvironmentCapabilityIdSchema,
  EnvironmentIdSchema,
  EnvironmentRegistrySchema,
  type EnvironmentCapabilityId,
  type EnvironmentRegistry,
} from "./types";

export const ENVIRONMENT_STATE_LAYERS = [
  "declared_registry",
  "observed_state",
  "derived_state",
] as const;

export const ENVIRONMENT_OBSERVED_VALUE_CATEGORIES = [
  "unknown",
  "on",
  "off",
  "open",
  "closed",
  "idle",
  "active",
  "nominal",
  "unavailable",
] as const;

export const ENVIRONMENT_OBSERVED_VALUE_BANDS = [
  "unknown",
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
] as const;

export const ENVIRONMENT_PASSIVE_STATE_SOURCE_KINDS = [
  "manual_metadata",
  "imported_snapshot",
  "test_fixture",
] as const;

export const ENVIRONMENT_PASSIVE_STATE_ORIGIN_KINDS = [
  "user_declared",
  "local_fixture",
  "metadata_import",
] as const;

export const ENVIRONMENT_CURRENT_STATE_REASONS = [
  "current_observation",
  "state_absent",
  "state_stale",
  "state_expired",
  "state_conflict",
  "low_confidence",
  "freshness_unknown",
] as const;

export const ENVIRONMENT_EVALUATED_FRESHNESS_STATUSES = [
  "fresh",
  "stale",
  "expired",
  "unknown",
] as const;

export const DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG = {
  staleAfterMs: 5 * 60 * 1_000,
  expireAfterMs: 30 * 60 * 1_000,
  minConfidence: 0.5,
  conflictWindowMs: 1_000,
} as const;

export type EnvironmentStateLayer = (typeof ENVIRONMENT_STATE_LAYERS)[number];
export type EnvironmentObservedValueCategory =
  (typeof ENVIRONMENT_OBSERVED_VALUE_CATEGORIES)[number];
export type EnvironmentObservedValueBand =
  (typeof ENVIRONMENT_OBSERVED_VALUE_BANDS)[number];
export type EnvironmentPassiveStateSourceKind =
  (typeof ENVIRONMENT_PASSIVE_STATE_SOURCE_KINDS)[number];
export type EnvironmentPassiveStateOriginKind =
  (typeof ENVIRONMENT_PASSIVE_STATE_ORIGIN_KINDS)[number];
export type EnvironmentCurrentStateReason =
  (typeof ENVIRONMENT_CURRENT_STATE_REASONS)[number];
export type EnvironmentEvaluatedFreshnessStatus =
  (typeof ENVIRONMENT_EVALUATED_FRESHNESS_STATUSES)[number];

export const EnvironmentStateLayerSchema = z.enum(ENVIRONMENT_STATE_LAYERS);
export const EnvironmentObservedValueCategorySchema = z.enum(
  ENVIRONMENT_OBSERVED_VALUE_CATEGORIES,
);
export const EnvironmentObservedValueBandSchema = z.enum(
  ENVIRONMENT_OBSERVED_VALUE_BANDS,
);
export const EnvironmentPassiveStateSourceKindSchema = z.enum(
  ENVIRONMENT_PASSIVE_STATE_SOURCE_KINDS,
);
export const EnvironmentPassiveStateOriginKindSchema = z.enum(
  ENVIRONMENT_PASSIVE_STATE_ORIGIN_KINDS,
);
export const EnvironmentCurrentStateReasonSchema = z.enum(
  ENVIRONMENT_CURRENT_STATE_REASONS,
);
export const EnvironmentEvaluatedFreshnessStatusSchema = z.enum(
  ENVIRONMENT_EVALUATED_FRESHNESS_STATUSES,
);

export const EnvironmentObservedValueSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("category"),
      category: EnvironmentObservedValueCategorySchema,
    }),
    z.strictObject({
      kind: z.literal("band"),
      band: EnvironmentObservedValueBandSchema,
    }),
  ])
  .describe(
    "Bounded observed value metadata only; raw streams are not allowed.",
  );

export const EnvironmentStateFreshnessSchema = z.strictObject({
  status: z.enum(["fresh", "stale", "unknown"]),
  observedAgeMs: z.number().int().nonnegative().nullable(),
  staleAfterMs: z.number().int().positive().nullable(),
});

export const EnvironmentStateProvenanceSchema = z.strictObject({
  sourceKind: EnvironmentPassiveStateSourceKindSchema,
  originKind: EnvironmentPassiveStateOriginKindSchema,
  originRef: z.string().trim().min(1).max(200),
  collectedBy: z.literal("user_or_local_metadata"),
});

export const PassiveEnvironmentStateRecordSchema = z.strictObject({
  id: EnvironmentIdSchema,
  deviceId: EnvironmentIdSchema,
  roomId: EnvironmentIdSchema,
  capabilityId: EnvironmentCapabilityIdSchema,
  stateLayer: z.literal("observed_state"),
  observedValue: EnvironmentObservedValueSchema,
  observedAt: z.number().int().nonnegative(),
  freshness: EnvironmentStateFreshnessSchema,
  confidence: z.number().min(0).max(1).default(1),
  provenance: EnvironmentStateProvenanceSchema,
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
  physicalSideEffects: z.literal(false),
});

export const EnvironmentStateUnknownSchema = z.strictObject({
  deviceId: EnvironmentIdSchema,
  capabilityId: EnvironmentCapabilityIdSchema,
  stateLayer: z.literal("observed_state"),
  status: z.literal("unknown"),
  reason: EnvironmentCurrentStateReasonSchema.exclude(["current_observation"]),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
  physicalSideEffects: z.literal(false),
});

export const PassiveEnvironmentStateFreshnessConfigSchema = z
  .strictObject({
    staleAfterMs: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.staleAfterMs),
    expireAfterMs: z
      .number()
      .int()
      .positive()
      .default(
        DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.expireAfterMs,
      ),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .default(
        DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.minConfidence,
      ),
    conflictWindowMs: z
      .number()
      .int()
      .nonnegative()
      .default(
        DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.conflictWindowMs,
      ),
  })
  .refine((config) => config.expireAfterMs >= config.staleAfterMs, {
    message: "expireAfterMs must be greater than or equal to staleAfterMs",
    path: ["expireAfterMs"],
  });

export const EvaluatedPassiveEnvironmentStateFreshnessSchema = z.strictObject({
  status: EnvironmentEvaluatedFreshnessStatusSchema,
  observedAgeMs: z.number().int().nonnegative().nullable(),
  staleAfterMs: z.number().int().positive(),
  expireAfterMs: z.number().int().positive(),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentObservedValue = z.infer<
  typeof EnvironmentObservedValueSchema
>;
export type EnvironmentStateFreshness = z.infer<
  typeof EnvironmentStateFreshnessSchema
>;
export type EnvironmentStateProvenance = z.infer<
  typeof EnvironmentStateProvenanceSchema
>;
export type PassiveEnvironmentStateRecord = z.infer<
  typeof PassiveEnvironmentStateRecordSchema
>;
export type EnvironmentStateUnknown = z.infer<
  typeof EnvironmentStateUnknownSchema
>;
export type PassiveEnvironmentStateFreshnessConfig = z.infer<
  typeof PassiveEnvironmentStateFreshnessConfigSchema
>;
export type EvaluatedPassiveEnvironmentStateFreshness = z.infer<
  typeof EvaluatedPassiveEnvironmentStateFreshnessSchema
>;

export type PassiveEnvironmentStateResolution =
  | { found: true; record: PassiveEnvironmentStateRecord }
  | { found: false; unknown: EnvironmentStateUnknown };

export type CurrentPassiveEnvironmentStateResolution =
  | {
      found: true;
      current: PassiveEnvironmentStateRecord;
      freshness: EvaluatedPassiveEnvironmentStateFreshness;
      currentTruth: false;
      policySensitiveUsable: boolean;
      reason: "current_observation";
      metadataOnly: true;
      canonical: false;
      authoritative: false;
      physicalSideEffects: false;
    }
  | {
      found: false;
      unknown: EnvironmentStateUnknown;
      lastKnown: PassiveEnvironmentStateRecord | null;
      freshness: EvaluatedPassiveEnvironmentStateFreshness | null;
      currentTruth: false;
      policySensitiveUsable: false;
      metadataOnly: true;
      canonical: false;
      authoritative: false;
      physicalSideEffects: false;
    };

export interface PassiveEnvironmentStateValidationResult {
  ok: boolean;
  record?: PassiveEnvironmentStateRecord;
  reason?:
    | "invalid_shape"
    | "unknown_device"
    | "unknown_room"
    | "capability_not_allowed";
}

export function validatePassiveEnvironmentStateRecord(
  registryInput: EnvironmentRegistry,
  recordInput: unknown,
): PassiveEnvironmentStateValidationResult {
  const registry = EnvironmentRegistrySchema.parse(registryInput);
  const parsed = PassiveEnvironmentStateRecordSchema.safeParse(recordInput);
  if (!parsed.success) return { ok: false, reason: "invalid_shape" };

  const record = parsed.data;
  const room = registry.rooms.find((item) => item.id === record.roomId);
  if (!room) return { ok: false, reason: "unknown_room" };

  const device = registry.devices.find((item) => item.id === record.deviceId);
  if (!device) return { ok: false, reason: "unknown_device" };
  if (device.roomId !== record.roomId) {
    return { ok: false, reason: "unknown_room" };
  }
  if (!device.capabilities.includes(record.capabilityId)) {
    return { ok: false, reason: "capability_not_allowed" };
  }

  return { ok: true, record };
}

export function resolvePassiveEnvironmentState(input: {
  records: PassiveEnvironmentStateRecord[];
  deviceId: string;
  capabilityId: EnvironmentCapabilityId;
}): PassiveEnvironmentStateResolution {
  const record = input.records
    .filter(
      (item) =>
        item.deviceId === input.deviceId &&
        item.capabilityId === input.capabilityId,
    )
    .sort((a, b) => b.observedAt - a.observedAt)[0];

  if (record) return { found: true, record };

  return {
    found: false,
    unknown: {
      deviceId: EnvironmentIdSchema.parse(input.deviceId),
      capabilityId: EnvironmentCapabilityIdSchema.parse(input.capabilityId),
      stateLayer: "observed_state",
      status: "unknown",
      reason: "state_absent",
      metadataOnly: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
    },
  };
}

function normalizeFreshnessConfig(
  config: Partial<PassiveEnvironmentStateFreshnessConfig> | undefined,
): PassiveEnvironmentStateFreshnessConfig {
  return PassiveEnvironmentStateFreshnessConfigSchema.parse(config ?? {});
}

function unknownState(input: {
  deviceId: string;
  capabilityId: EnvironmentCapabilityId;
  reason: Exclude<EnvironmentCurrentStateReason, "current_observation">;
}): EnvironmentStateUnknown {
  return {
    deviceId: EnvironmentIdSchema.parse(input.deviceId),
    capabilityId: EnvironmentCapabilityIdSchema.parse(input.capabilityId),
    stateLayer: "observed_state",
    status: "unknown",
    reason: input.reason,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
  };
}

export function evaluatePassiveEnvironmentStateFreshness(input: {
  record?: PassiveEnvironmentStateRecord | null;
  nowMs: number;
  config?: Partial<PassiveEnvironmentStateFreshnessConfig>;
}): EvaluatedPassiveEnvironmentStateFreshness {
  const config = normalizeFreshnessConfig(input.config);
  if (!input.record) {
    return {
      status: "unknown",
      observedAgeMs: null,
      staleAfterMs: config.staleAfterMs,
      expireAfterMs: config.expireAfterMs,
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    };
  }

  const record = PassiveEnvironmentStateRecordSchema.parse(input.record);
  const observedAgeMs = Math.max(0, input.nowMs - record.observedAt);
  let status: EnvironmentEvaluatedFreshnessStatus = "fresh";
  if (record.freshness.status === "unknown") status = "unknown";
  else if (observedAgeMs >= config.expireAfterMs) status = "expired";
  else if (
    record.freshness.status === "stale" ||
    observedAgeMs >= config.staleAfterMs
  ) {
    status = "stale";
  }

  return {
    status,
    observedAgeMs,
    staleAfterMs: config.staleAfterMs,
    expireAfterMs: config.expireAfterMs,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  };
}

function observedValuesEqual(
  left: PassiveEnvironmentStateRecord,
  right: PassiveEnvironmentStateRecord,
): boolean {
  return (
    JSON.stringify(left.observedValue) === JSON.stringify(right.observedValue)
  );
}

function findConflict(input: {
  newest: PassiveEnvironmentStateRecord;
  records: PassiveEnvironmentStateRecord[];
  conflictWindowMs: number;
}): PassiveEnvironmentStateRecord | undefined {
  return input.records.find(
    (record) =>
      record.id !== input.newest.id &&
      Math.abs(input.newest.observedAt - record.observedAt) <=
        input.conflictWindowMs &&
      !observedValuesEqual(input.newest, record),
  );
}

export function resolveCurrentPassiveEnvironmentState(input: {
  records: PassiveEnvironmentStateRecord[];
  deviceId: string;
  capabilityId: EnvironmentCapabilityId;
  nowMs: number;
  config?: Partial<PassiveEnvironmentStateFreshnessConfig>;
  policySensitive?: boolean;
}): CurrentPassiveEnvironmentStateResolution {
  const config = normalizeFreshnessConfig(input.config);
  const matching = input.records
    .map((record) => PassiveEnvironmentStateRecordSchema.parse(record))
    .filter(
      (record) =>
        record.deviceId === input.deviceId &&
        record.capabilityId === input.capabilityId,
    )
    .sort((a, b) => b.observedAt - a.observedAt || a.id.localeCompare(b.id));

  const newest = matching[0] ?? null;
  const freshness = evaluatePassiveEnvironmentStateFreshness({
    record: newest,
    nowMs: input.nowMs,
    config,
  });

  const fail = (
    reason: Exclude<EnvironmentCurrentStateReason, "current_observation">,
  ): CurrentPassiveEnvironmentStateResolution => ({
    found: false,
    unknown: unknownState({
      deviceId: input.deviceId,
      capabilityId: input.capabilityId,
      reason,
    }),
    lastKnown: newest,
    freshness,
    currentTruth: false,
    policySensitiveUsable: false,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
  });

  if (!newest) return fail("state_absent");
  if (newest.confidence < config.minConfidence) return fail("low_confidence");

  const conflict = findConflict({
    newest,
    records: matching,
    conflictWindowMs: config.conflictWindowMs,
  });
  if (conflict) return fail("state_conflict");

  if (freshness.status === "unknown") return fail("freshness_unknown");
  if (freshness.status === "expired") return fail("state_expired");
  if (freshness.status === "stale") return fail("state_stale");

  return {
    found: true,
    current: newest,
    freshness,
    currentTruth: false,
    policySensitiveUsable: input.policySensitive === true,
    reason: "current_observation",
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
  };
}

export function classifyEnvironmentStateLayer(layer: EnvironmentStateLayer): {
  layer: EnvironmentStateLayer;
  metadataOnly: true;
  canonical: boolean;
  authoritative: boolean;
} {
  return {
    layer,
    metadataOnly: true,
    canonical: layer === "declared_registry",
    authoritative: false,
  };
}
