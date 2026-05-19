import type DatabaseType from "better-sqlite3";
import {
  requireConsent,
  type ConsentFeatureId,
  type ConsentGateResult,
} from "../consent";
import { insertTelemetryEvent } from "../db/telemetry";

export const PERSONAL_CONTEXT_FEATURE_IDS = [
  "preferences",
  "goals",
  "timeline",
  "reflection_prompts",
  "human_review_queue",
  "keeper_interface",
] as const satisfies readonly ConsentFeatureId[];

export type PersonalContextFeatureId =
  (typeof PERSONAL_CONTEXT_FEATURE_IDS)[number];

export interface PersonalContextAccessContext {
  caller: string;
  feature_id: PersonalContextFeatureId;
  purpose: string;
  personal_context: boolean;
}

export interface PersonalContextGuardOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
}

export type PersonalContextAccessResult =
  | { ok: true }
  | Extract<ConsentGateResult, { ok: false }>;

function isPersonalContextFeature(
  featureId: string,
): featureId is PersonalContextFeatureId {
  return PERSONAL_CONTEXT_FEATURE_IDS.includes(
    featureId as PersonalContextFeatureId,
  );
}

function notes(input: {
  caller?: string;
  featureId: string;
  purpose?: string;
  reason?: string;
}): string {
  return [
    input.caller ? `caller=${input.caller}` : undefined,
    `feature_id=${input.featureId}`,
    input.purpose ? `purpose=${input.purpose}` : undefined,
    input.reason ? `reason=${input.reason}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function emitAccessTelemetry(
  db: DatabaseType.Database,
  input: PersonalContextGuardOptions & {
    eventType:
      | "personal_context_access_granted"
      | "personal_context_access_denied";
    success: boolean;
    caller?: string;
    featureId: string;
    purpose?: string;
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

/**
 * Runtime boundary for personal-context systems.
 *
 * Personal systems must never be read directly. Preferences, goals, timeline,
 * reflection prompts, review queue, and Keeper registry metadata all route
 * through this guard with an explicit caller/purpose and `personal_context:
 * true`. Missing or mismatched access context throws; disabled consent or a
 * false flag denies before any DB read.
 */
export function requirePersonalContextAccess(
  db: DatabaseType.Database,
  expectedFeatureId: PersonalContextFeatureId,
  accessContext: PersonalContextAccessContext | undefined,
  input: PersonalContextGuardOptions = {},
): PersonalContextAccessResult {
  if (!accessContext) {
    throw new Error("personal context access context is required");
  }
  if (!isPersonalContextFeature(accessContext.feature_id)) {
    throw new Error(
      `invalid personal context feature: ${accessContext.feature_id}`,
    );
  }
  if (accessContext.feature_id !== expectedFeatureId) {
    throw new Error(
      `personal context feature mismatch: expected ${expectedFeatureId}, received ${accessContext.feature_id}`,
    );
  }

  if (accessContext.personal_context !== true) {
    emitAccessTelemetry(db, {
      ...input,
      eventType: "personal_context_access_denied",
      success: false,
      caller: accessContext.caller,
      featureId: accessContext.feature_id,
      purpose: accessContext.purpose,
      reason: "personal_context_flag_missing",
    });
    return {
      ok: false,
      status: "blocked",
      featureId: expectedFeatureId,
      reason: "consent_disabled",
    };
  }

  const gate = requireConsent(expectedFeatureId, {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
  if (!gate.ok) {
    emitAccessTelemetry(db, {
      ...input,
      eventType: "personal_context_access_denied",
      success: false,
      caller: accessContext.caller,
      featureId: accessContext.feature_id,
      purpose: accessContext.purpose,
      reason: gate.reason,
    });
    return gate;
  }

  emitAccessTelemetry(db, {
    ...input,
    eventType: "personal_context_access_granted",
    success: true,
    caller: accessContext.caller,
    featureId: accessContext.feature_id,
    purpose: accessContext.purpose,
  });
  return { ok: true };
}
