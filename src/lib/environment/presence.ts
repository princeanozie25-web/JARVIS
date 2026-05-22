import { z } from "zod";
import {
  resolveCurrentPassiveEnvironmentState,
  type PassiveEnvironmentStateFreshnessConfig,
  type PassiveEnvironmentStateRecord,
} from "./state";
import { EnvironmentIdSchema } from "./types";

export const ENVIRONMENT_PRESENCE_STATUSES = [
  "present",
  "absent",
  "unknown",
] as const;

export const ENVIRONMENT_PRESENCE_TARGET_KINDS = [
  "room",
  "device",
  "user",
] as const;

export const ENVIRONMENT_PRESENCE_REASONS = [
  "bounded_active_signal",
  "bounded_idle_signal",
  "missing_signal",
  "stale_signal",
  "expired_signal",
  "conflicting_signal",
  "low_confidence",
  "unsupported_signal",
  "freshness_unknown",
] as const;

export type EnvironmentPresenceStatus =
  (typeof ENVIRONMENT_PRESENCE_STATUSES)[number];
export type EnvironmentPresenceTargetKind =
  (typeof ENVIRONMENT_PRESENCE_TARGET_KINDS)[number];
export type EnvironmentPresenceReason =
  (typeof ENVIRONMENT_PRESENCE_REASONS)[number];

export const EnvironmentPresenceStatusSchema = z.enum(
  ENVIRONMENT_PRESENCE_STATUSES,
);
export const EnvironmentPresenceTargetKindSchema = z.enum(
  ENVIRONMENT_PRESENCE_TARGET_KINDS,
);
export const EnvironmentPresenceReasonSchema = z.enum(
  ENVIRONMENT_PRESENCE_REASONS,
);

export const EnvironmentPresenceSignalSchema = z.strictObject({
  targetKind: EnvironmentPresenceTargetKindSchema,
  targetId: EnvironmentIdSchema,
  status: EnvironmentPresenceStatusSchema,
  reason: EnvironmentPresenceReasonSchema,
  derived: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
  physicalSideEffects: z.literal(false),
  cannotTriggerActions: z.literal(true),
  sourceRecordId: z.string().trim().min(1).max(120).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  observedAt: z.number().int().nonnegative().nullable(),
});

export type EnvironmentPresenceSignal = z.infer<
  typeof EnvironmentPresenceSignalSchema
>;

export interface DeriveEnvironmentPresenceInput {
  records: PassiveEnvironmentStateRecord[];
  targetKind: EnvironmentPresenceTargetKind;
  targetId: string;
  nowMs: number;
  config?: Partial<PassiveEnvironmentStateFreshnessConfig>;
}

function presenceSignal(
  input: Omit<
    EnvironmentPresenceSignal,
    | "derived"
    | "canonical"
    | "authoritative"
    | "physicalSideEffects"
    | "cannotTriggerActions"
  >,
): EnvironmentPresenceSignal {
  return EnvironmentPresenceSignalSchema.parse({
    ...input,
    derived: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
    cannotTriggerActions: true,
  });
}

function targetRecords(
  input: DeriveEnvironmentPresenceInput,
): PassiveEnvironmentStateRecord[] {
  if (input.targetKind === "room") {
    return input.records.filter((record) => record.roomId === input.targetId);
  }

  if (input.targetKind === "device") {
    return input.records.filter((record) => record.deviceId === input.targetId);
  }

  return [];
}

function unknown(input: {
  targetKind: EnvironmentPresenceTargetKind;
  targetId: string;
  reason: Exclude<
    EnvironmentPresenceReason,
    "bounded_active_signal" | "bounded_idle_signal"
  >;
  sourceRecord?: PassiveEnvironmentStateRecord | null;
}): EnvironmentPresenceSignal {
  return presenceSignal({
    targetKind: input.targetKind,
    targetId: input.targetId,
    status: "unknown",
    reason: input.reason,
    sourceRecordId: input.sourceRecord?.id ?? null,
    confidence: input.sourceRecord?.confidence ?? null,
    observedAt: input.sourceRecord?.observedAt ?? null,
  });
}

function mapUnknownReason(reason: string): EnvironmentPresenceReason {
  if (reason === "state_stale") return "stale_signal";
  if (reason === "state_expired") return "expired_signal";
  if (reason === "state_conflict") return "conflicting_signal";
  if (reason === "low_confidence") return "low_confidence";
  if (reason === "freshness_unknown") return "freshness_unknown";
  return "missing_signal";
}

export function deriveEnvironmentPresence(
  input: DeriveEnvironmentPresenceInput,
): EnvironmentPresenceSignal {
  const records = targetRecords(input).filter(
    (record) => record.capabilityId === "environment.observe",
  );
  const state = resolveCurrentPassiveEnvironmentState({
    records,
    deviceId: records[0]?.deviceId ?? "device:unknown",
    capabilityId: "environment.observe",
    nowMs: input.nowMs,
    config: input.config,
    policySensitive: true,
  });

  if (!state.found) {
    return unknown({
      targetKind: input.targetKind,
      targetId: input.targetId,
      reason: mapUnknownReason(state.unknown.reason) as Exclude<
        EnvironmentPresenceReason,
        "bounded_active_signal" | "bounded_idle_signal"
      >,
      sourceRecord: state.lastKnown,
    });
  }

  const value = state.current.observedValue;
  if (value.kind !== "category") {
    return unknown({
      targetKind: input.targetKind,
      targetId: input.targetId,
      reason: "unsupported_signal",
      sourceRecord: state.current,
    });
  }

  if (value.category === "active") {
    return presenceSignal({
      targetKind: input.targetKind,
      targetId: input.targetId,
      status: "present",
      reason: "bounded_active_signal",
      sourceRecordId: state.current.id,
      confidence: state.current.confidence,
      observedAt: state.current.observedAt,
    });
  }

  if (value.category === "idle") {
    return presenceSignal({
      targetKind: input.targetKind,
      targetId: input.targetId,
      status: "absent",
      reason: "bounded_idle_signal",
      sourceRecordId: state.current.id,
      confidence: state.current.confidence,
      observedAt: state.current.observedAt,
    });
  }

  return unknown({
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: "unsupported_signal",
    sourceRecord: state.current,
  });
}
