import { randomUUID } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { requireConsent, type ConsentGateResult } from "../consent";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
  requireRuntimeWriteAllowed,
  type RuntimeWriteContext,
} from "../personal-context";
import { insertTelemetryEvent } from "./telemetry";

export interface PreferenceRow {
  id: string;
  key: string;
  value: string;
  category: string;
  source: "user";
  effective_from: number;
  supersedes_id: string | null;
  created_at: number;
}

export interface PreferenceConsentOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  accessContext?: PersonalContextAccessContext;
  writeContext?: RuntimeWriteContext;
}

export interface AddPreferenceInput extends PreferenceConsentOptions {
  id?: string;
  key: string;
  value: string;
  category: string;
  effectiveFrom?: number;
  createdAt?: number;
}

export interface ListPreferencesInput extends PreferenceConsentOptions {
  key?: string;
  includeSuperseded?: boolean;
  limit?: number;
}

export interface SupersedePreferenceInput extends PreferenceConsentOptions {
  id?: string;
  value: string;
  category?: string;
  effectiveFrom?: number;
  createdAt?: number;
}

export type PreferenceBlockedResult = Extract<ConsentGateResult, { ok: false }>;

export type PreferenceResult<T> =
  | { ok: true; value: T }
  | PreferenceBlockedResult;

export type SupersedePreferenceResult =
  | PreferenceResult<PreferenceRow>
  | { ok: false; status: "not_found"; id: string };

function consentBlockedResult(
  gate: PreferenceBlockedResult,
): PreferenceBlockedResult {
  return gate;
}

function requirePreferenceConsent(
  db: DatabaseType.Database,
  input: PreferenceConsentOptions = {},
): ConsentGateResult {
  return requireConsent("preferences", {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

function rowById(
  db: DatabaseType.Database,
  id: string,
): PreferenceRow | undefined {
  return db.prepare("SELECT * FROM preferences WHERE id = ?").get(id) as
    | PreferenceRow
    | undefined;
}

function emitPreferenceTelemetry(
  db: DatabaseType.Database,
  eventType: "preference_saved" | "preference_read" | "preference_superseded",
  input: {
    timestamp: number;
    success: boolean;
    notes?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.timestamp,
    event_type: eventType,
    success: input.success,
    notes: input.notes,
  });
}

export function addPreference(
  db: DatabaseType.Database,
  input: AddPreferenceInput,
): PreferenceResult<PreferenceRow> {
  requireRuntimeWriteAllowed(db, "preferences", input.writeContext, input);

  const gate = requirePreferenceConsent(db, input);
  if (!gate.ok) return consentBlockedResult(gate);

  const createdAt = input.createdAt ?? input.now?.() ?? Date.now();
  const row: PreferenceRow = {
    id: input.id ?? randomUUID(),
    key: requireTrimmed(input.key, "key"),
    value: requireTrimmed(input.value, "value"),
    category: requireTrimmed(input.category, "category"),
    source: "user",
    effective_from: input.effectiveFrom ?? createdAt,
    supersedes_id: null,
    created_at: createdAt,
  };

  db.prepare(
    `INSERT INTO preferences (
       id, key, value, category, source, effective_from, supersedes_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.key,
    row.value,
    row.category,
    row.source,
    row.effective_from,
    row.supersedes_id,
    row.created_at,
  );

  emitPreferenceTelemetry(db, "preference_saved", {
    timestamp: createdAt,
    success: true,
    notes: `key=${row.key};id=${row.id}`,
  });

  return { ok: true, value: row };
}

export function listPreferences(
  db: DatabaseType.Database,
  input: ListPreferencesInput = {},
): PreferenceResult<PreferenceRow[]> {
  const gate = requirePersonalContextAccess(
    db,
    "preferences",
    input.accessContext,
    input,
  );
  if (!gate.ok) return consentBlockedResult(gate);

  const limit = normalizeLimit(input.limit);
  const key = input.key?.trim();
  const includeSuperseded = input.includeSuperseded ?? true;
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (key) {
    where.push("p.key = ?");
    params.push(key);
  }
  if (!includeSuperseded) {
    where.push(
      "NOT EXISTS (SELECT 1 FROM preferences newer WHERE newer.supersedes_id = p.id)",
    );
  }

  const rows = db
    .prepare(
      `SELECT p.*
       FROM preferences p
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY p.created_at DESC, p.effective_from DESC, p.key ASC
       LIMIT ?`,
    )
    .all(...params, limit) as PreferenceRow[];

  emitPreferenceTelemetry(db, "preference_read", {
    timestamp: input.now?.() ?? Date.now(),
    success: true,
    notes: `rows=${rows.length}`,
  });

  return { ok: true, value: rows };
}

export function getEffectivePreference(
  db: DatabaseType.Database,
  key: string,
  input: PreferenceConsentOptions = {},
): PreferenceResult<PreferenceRow | null> {
  const gate = requirePersonalContextAccess(
    db,
    "preferences",
    input.accessContext,
    input,
  );
  if (!gate.ok) return consentBlockedResult(gate);

  const normalizedKey = requireTrimmed(key, "key");
  const row = db
    .prepare(
      `SELECT p.*
       FROM preferences p
       WHERE p.key = ?
         AND NOT EXISTS (
           SELECT 1
           FROM preferences newer
           WHERE newer.supersedes_id = p.id
         )
       ORDER BY p.effective_from DESC, p.created_at DESC
       LIMIT 1`,
    )
    .get(normalizedKey) as PreferenceRow | undefined;

  emitPreferenceTelemetry(db, "preference_read", {
    timestamp: input.now?.() ?? Date.now(),
    success: row !== undefined,
    notes: `key=${normalizedKey}`,
  });

  return { ok: true, value: row ?? null };
}

export function listEffectivePreferences(
  db: DatabaseType.Database,
  input: PreferenceConsentOptions & { limit?: number } = {},
): PreferenceResult<PreferenceRow[]> {
  const gate = requirePersonalContextAccess(
    db,
    "preferences",
    input.accessContext,
    input,
  );
  if (!gate.ok) return consentBlockedResult(gate);

  const rows = db
    .prepare(
      `SELECT p.*
       FROM preferences p
       WHERE NOT EXISTS (
         SELECT 1
         FROM preferences newer
         WHERE newer.supersedes_id = p.id
       )
       AND p.id = (
         SELECT p2.id
         FROM preferences p2
         WHERE p2.key = p.key
           AND NOT EXISTS (
             SELECT 1
             FROM preferences newer2
             WHERE newer2.supersedes_id = p2.id
           )
         ORDER BY p2.effective_from DESC, p2.created_at DESC
         LIMIT 1
       )
       ORDER BY p.key ASC
       LIMIT ?`,
    )
    .all(normalizeLimit(input.limit)) as PreferenceRow[];

  emitPreferenceTelemetry(db, "preference_read", {
    timestamp: input.now?.() ?? Date.now(),
    success: true,
    notes: `effective_rows=${rows.length}`,
  });

  return { ok: true, value: rows };
}

export function supersedePreference(
  db: DatabaseType.Database,
  supersededId: string,
  input: SupersedePreferenceInput,
): SupersedePreferenceResult {
  requireRuntimeWriteAllowed(db, "preferences", input.writeContext, input);

  const gate = requirePreferenceConsent(db, input);
  if (!gate.ok) return consentBlockedResult(gate);

  const oldId = requireTrimmed(supersededId, "supersededId");
  const existing = rowById(db, oldId);
  if (!existing) {
    return { ok: false, status: "not_found", id: oldId };
  }

  const createdAt = input.createdAt ?? input.now?.() ?? Date.now();
  const row: PreferenceRow = {
    id: input.id ?? randomUUID(),
    key: existing.key,
    value: requireTrimmed(input.value, "value"),
    category: input.category
      ? requireTrimmed(input.category, "category")
      : existing.category,
    source: "user",
    effective_from: input.effectiveFrom ?? createdAt,
    supersedes_id: existing.id,
    created_at: createdAt,
  };

  db.prepare(
    `INSERT INTO preferences (
       id, key, value, category, source, effective_from, supersedes_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.key,
    row.value,
    row.category,
    row.source,
    row.effective_from,
    row.supersedes_id,
    row.created_at,
  );

  emitPreferenceTelemetry(db, "preference_superseded", {
    timestamp: createdAt,
    success: true,
    notes: `key=${row.key};supersedes_id=${existing.id};id=${row.id}`,
  });

  return { ok: true, value: row };
}
