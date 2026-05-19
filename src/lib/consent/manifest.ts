import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  PHASE_3D_FEATURE_IDS,
  PHASE_3D_FEATURE_SCOPES,
  type ConsentFeatureId,
  type ConsentGateResult,
  type ConsentManifest,
  type ConsentRecord,
} from "./types";
import {
  processConsentRevocation,
  recordConsentRevocationBlockedProjection,
} from "./revocation";

export interface ConsentManifestOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  db?: DatabaseType.Database;
  now?: () => number;
}

export interface SetConsentInput extends ConsentManifestOptions {
  featureId: ConsentFeatureId;
  enabled: boolean;
  scope?: string;
}

export function consentManifestPathFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.JARVIS_CONSENT_MANIFEST_PATH?.trim() ||
    join(homedir(), "jarvis", "consent.json")
  );
}

function isoNow(now?: () => number): string {
  return new Date(now?.() ?? Date.now()).toISOString();
}

function manifestPath(input: ConsentManifestOptions = {}): string {
  return input.manifestPath ?? consentManifestPathFromEnv(input.env);
}

function defaultRecord(featureId: ConsentFeatureId): ConsentRecord {
  return {
    feature_id: featureId,
    enabled: false,
    scope: PHASE_3D_FEATURE_SCOPES[featureId],
    granted_at: null,
    granted_by: "user",
    revocable: true,
  };
}

export function createDefaultConsentManifest(
  input: { now?: () => number } = {},
): ConsentManifest {
  return {
    version: 1,
    records: PHASE_3D_FEATURE_IDS.map(defaultRecord),
    updated_at: isoNow(input.now),
  };
}

function normalizeManifest(
  manifest: ConsentManifest,
  input: { now?: () => number } = {},
): ConsentManifest {
  const byId = new Map(
    manifest.records.map((record) => [record.feature_id, record]),
  );
  return {
    version: 1,
    records: PHASE_3D_FEATURE_IDS.map((featureId) => {
      const existing = byId.get(featureId);
      return existing
        ? {
            ...defaultRecord(featureId),
            ...existing,
            granted_by: "user",
            revocable: true,
          }
        : defaultRecord(featureId);
    }),
    updated_at: manifest.updated_at || isoNow(input.now),
  };
}

function persistManifest(path: string, manifest: ConsentManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function emitConsentTelemetry(
  input: ConsentManifestOptions & {
    eventType:
      | "consent_read"
      | "consent_granted"
      | "consent_revoked"
      | "consent_denied";
    success: boolean;
    featureId?: ConsentFeatureId;
    notes?: string;
  },
): void {
  if (!input.db) return;
  insertTelemetryEvent(input.db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: input.eventType,
    success: input.success,
    notes: [
      input.featureId ? `feature_id=${input.featureId}` : undefined,
      input.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export function readConsentManifest(
  input: ConsentManifestOptions = {},
): ConsentManifest {
  const path = manifestPath(input);
  let manifest: ConsentManifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8")) as ConsentManifest;
  } catch (error) {
    const missing =
      error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!missing) throw error;
    manifest = createDefaultConsentManifest({ now: input.now });
    persistManifest(path, manifest);
  }

  const normalized = normalizeManifest(manifest, { now: input.now });
  if (JSON.stringify(normalized) !== JSON.stringify(manifest)) {
    persistManifest(path, normalized);
  }

  emitConsentTelemetry({
    ...input,
    eventType: "consent_read",
    success: true,
    notes: `path=${path}`,
  });
  return normalized;
}

export function setConsentFromUserAction(
  input: SetConsentInput,
): ConsentRecord {
  const path = manifestPath(input);
  const manifest = readConsentManifest(input);
  const updatedAt = isoNow(input.now);
  const records = manifest.records.map((record) =>
    record.feature_id === input.featureId
      ? {
          ...record,
          enabled: input.enabled,
          scope: input.scope?.trim() || record.scope,
          granted_at: input.enabled ? updatedAt : null,
          granted_by: "user" as const,
          revocable: true as const,
        }
      : record,
  );
  const updated: ConsentManifest = {
    version: 1,
    records,
    updated_at: updatedAt,
  };
  persistManifest(path, updated);

  const record = records.find((item) => item.feature_id === input.featureId)!;
  emitConsentTelemetry({
    ...input,
    eventType: input.enabled ? "consent_granted" : "consent_revoked",
    success: true,
    featureId: input.featureId,
  });
  if (!input.enabled) {
    processConsentRevocation(input.db, input.featureId, { now: input.now });
  }
  return record;
}

export function requireConsent(
  featureId: ConsentFeatureId,
  input: ConsentManifestOptions = {},
): ConsentGateResult {
  const manifest = readConsentManifest(input);
  const record = manifest.records.find((item) => item.feature_id === featureId);
  if (!record?.enabled) {
    emitConsentTelemetry({
      ...input,
      eventType: "consent_denied",
      success: false,
      featureId,
      notes: "reason=consent_disabled",
    });
    recordConsentRevocationBlockedProjection(input.db, featureId, {
      now: input.now,
      target: "require_consent",
      reason: "consent_disabled",
    });
    return {
      ok: false,
      status: "blocked",
      featureId,
      reason: "consent_disabled",
    };
  }
  return { ok: true, record };
}
