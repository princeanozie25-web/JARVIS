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

export type EnvironmentStateLayer = (typeof ENVIRONMENT_STATE_LAYERS)[number];
export type EnvironmentObservedValueCategory =
  (typeof ENVIRONMENT_OBSERVED_VALUE_CATEGORIES)[number];
export type EnvironmentObservedValueBand =
  (typeof ENVIRONMENT_OBSERVED_VALUE_BANDS)[number];
export type EnvironmentPassiveStateSourceKind =
  (typeof ENVIRONMENT_PASSIVE_STATE_SOURCE_KINDS)[number];
export type EnvironmentPassiveStateOriginKind =
  (typeof ENVIRONMENT_PASSIVE_STATE_ORIGIN_KINDS)[number];

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
  reason: z.literal("state_absent"),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
  physicalSideEffects: z.literal(false),
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

export type PassiveEnvironmentStateResolution =
  | { found: true; record: PassiveEnvironmentStateRecord }
  | { found: false; unknown: EnvironmentStateUnknown };

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
