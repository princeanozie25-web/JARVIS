import type DatabaseType from "better-sqlite3";
import type { ConsentFeatureId } from "./types";
import { insertTelemetryEvent } from "../db/telemetry";

export const REVOCATION_MANAGED_FEATURE_IDS = [
  "preferences",
  "goals",
  "timeline",
  "memory_weighting",
  "conversation_curator",
  "reflection_prompts",
  "keeper_interface",
  "human_review_queue",
] as const satisfies readonly ConsentFeatureId[];

export type RevocationManagedFeatureId =
  (typeof REVOCATION_MANAGED_FEATURE_IDS)[number];

const revocationVersions = new Map<RevocationManagedFeatureId, number>();
const invalidators = new Map<RevocationManagedFeatureId, Set<() => void>>();

function isRevocationManagedFeature(
  featureId: ConsentFeatureId,
): featureId is RevocationManagedFeatureId {
  return REVOCATION_MANAGED_FEATURE_IDS.includes(
    featureId as RevocationManagedFeatureId,
  );
}

function notes(input: {
  featureId: ConsentFeatureId;
  reason?: string;
  target?: string;
}): string {
  return [
    `feature_id=${input.featureId}`,
    input.target ? `target=${input.target}` : undefined,
    input.reason ? `reason=${input.reason}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

export function processConsentRevocation(
  db: DatabaseType.Database | undefined,
  featureId: ConsentFeatureId,
  input: { now?: () => number } = {},
): void {
  if (!db || !isRevocationManagedFeature(featureId)) return;
  const current = revocationVersions.get(featureId) ?? 0;
  revocationVersions.set(featureId, current + 1);
  for (const invalidate of invalidators.get(featureId) ?? []) {
    invalidate();
  }
  const timestamp = input.now?.() ?? Date.now();

  insertTelemetryEvent(db, {
    timestamp,
    event_type: "consent_revocation_processed",
    success: true,
    notes: notes({ featureId }),
  });
  insertTelemetryEvent(db, {
    timestamp,
    event_type: "consent_revocation_cache_invalidated",
    success: true,
    notes: notes({
      featureId,
      target: "personal_context_projection_state",
    }),
  });
}

export function recordConsentRevocationBlockedProjection(
  db: DatabaseType.Database | undefined,
  featureId: ConsentFeatureId,
  input: { now?: () => number; target?: string; reason?: string } = {},
): void {
  if (!db || !isRevocationManagedFeature(featureId)) return;
  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "consent_revocation_blocked_projection",
    success: false,
    notes: notes({
      featureId,
      target: input.target,
      reason: input.reason ?? "consent_disabled",
    }),
  });
}

export function getConsentRevocationVersion(
  featureId: RevocationManagedFeatureId,
): number {
  return revocationVersions.get(featureId) ?? 0;
}

export function registerConsentRevocationInvalidator(
  featureId: RevocationManagedFeatureId,
  invalidate: () => void,
): () => void {
  const existing = invalidators.get(featureId) ?? new Set<() => void>();
  existing.add(invalidate);
  invalidators.set(featureId, existing);
  return () => {
    existing.delete(invalidate);
  };
}
