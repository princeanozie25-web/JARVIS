import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  PERSONAL_CONTEXT_FEATURE_IDS,
  type PersonalContextFeatureId,
  type PersonalContextGuardOptions,
} from "./access-guard";

export const RUNTIME_WRITE_ORIGINS = [
  "user_ui",
  "runtime",
  "tool",
  "system",
] as const;

export type RuntimeWriteOrigin = (typeof RUNTIME_WRITE_ORIGINS)[number];

export interface RuntimeWriteContext {
  origin: RuntimeWriteOrigin;
  feature_id: PersonalContextFeatureId;
  operation: string;
  approved_manual_flow: boolean;
}

export class RuntimeWriteBoundaryViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeWriteBoundaryViolation";
  }
}

function isPersonalContextFeature(
  featureId: string,
): featureId is PersonalContextFeatureId {
  return PERSONAL_CONTEXT_FEATURE_IDS.includes(
    featureId as PersonalContextFeatureId,
  );
}

function notes(input: {
  origin?: string;
  featureId: string;
  operation?: string;
  reason?: string;
}): string {
  return [
    input.origin ? `origin=${input.origin}` : undefined,
    `feature_id=${input.featureId}`,
    input.operation ? `operation=${input.operation}` : undefined,
    input.reason ? `reason=${input.reason}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function emitWriteTelemetry(
  db: DatabaseType.Database,
  input: PersonalContextGuardOptions & {
    eventType:
      | "runtime_write_allowed"
      | "runtime_write_denied"
      | "runtime_write_boundary_violation";
    success: boolean;
    origin?: string;
    featureId: string;
    operation?: string;
    reason?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: input.eventType,
    success: input.success,
    notes: notes(input),
  });
}

function deny(
  db: DatabaseType.Database,
  expectedFeatureId: PersonalContextFeatureId,
  writeContext: RuntimeWriteContext | undefined,
  input: PersonalContextGuardOptions & { reason: string },
): never {
  emitWriteTelemetry(db, {
    ...input,
    eventType: "runtime_write_denied",
    success: false,
    origin: writeContext?.origin,
    featureId: writeContext?.feature_id ?? expectedFeatureId,
    operation: writeContext?.operation,
    reason: input.reason,
  });
  emitWriteTelemetry(db, {
    ...input,
    eventType: "runtime_write_boundary_violation",
    success: false,
    origin: writeContext?.origin,
    featureId: writeContext?.feature_id ?? expectedFeatureId,
    operation: writeContext?.operation,
    reason: input.reason,
  });
  throw new RuntimeWriteBoundaryViolation(
    `runtime write boundary denied ${expectedFeatureId}: ${input.reason}`,
  );
}

/**
 * Runtime write boundary for user-governed personal systems.
 *
 * Preferences, goals, timeline-derived systems, reflection systems, review
 * queue state, and Keeper registry metadata must remain user-governed.
 * Runtime autonomy, tools, and background/system flows must never bypass
 * review, consent, or an audited manual UI path.
 */
export function requireRuntimeWriteAllowed(
  db: DatabaseType.Database,
  expectedFeatureId: PersonalContextFeatureId,
  writeContext: RuntimeWriteContext | undefined,
  input: PersonalContextGuardOptions = {},
): void {
  if (!writeContext) {
    deny(db, expectedFeatureId, writeContext, {
      ...input,
      reason: "write_context_required",
    });
  }
  if (!isPersonalContextFeature(writeContext.feature_id)) {
    deny(db, expectedFeatureId, writeContext, {
      ...input,
      reason: "invalid_feature",
    });
  }
  if (writeContext.feature_id !== expectedFeatureId) {
    deny(db, expectedFeatureId, writeContext, {
      ...input,
      reason: "feature_mismatch",
    });
  }
  if (
    writeContext.origin !== "user_ui" ||
    writeContext.approved_manual_flow !== true
  ) {
    deny(db, expectedFeatureId, writeContext, {
      ...input,
      reason: "non_manual_origin",
    });
  }

  emitWriteTelemetry(db, {
    ...input,
    eventType: "runtime_write_allowed",
    success: true,
    origin: writeContext.origin,
    featureId: writeContext.feature_id,
    operation: writeContext.operation,
  });
}
