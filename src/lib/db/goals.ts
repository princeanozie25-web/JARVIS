import { randomUUID } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { requireConsent, type ConsentGateResult } from "../consent";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
} from "../personal-context";
import { insertTelemetryEvent } from "./telemetry";

export const GOAL_STATUSES = ["active", "met", "missed", "abandoned"] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface GoalRow {
  id: string;
  title: string;
  status: GoalStatus;
  parent_id: string | null;
  created_at: number;
  last_touched: number;
  completed_at: number | null;
  source: "user";
}

export interface GoalConsentOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  accessContext?: PersonalContextAccessContext;
}

export interface CreateGoalInput extends GoalConsentOptions {
  id?: string;
  title: string;
  parentId?: string | null;
  createdAt?: number;
}

export interface ListGoalsInput extends GoalConsentOptions {
  status?: GoalStatus;
  limit?: number;
}

export interface UpdateGoalStatusInput extends GoalConsentOptions {
  status: GoalStatus;
  completedAt?: number | null;
}

export type GoalBlockedResult = Extract<ConsentGateResult, { ok: false }>;

export type GoalResult<T> = { ok: true; value: T } | GoalBlockedResult;

export type GoalMutationResult =
  | GoalResult<GoalRow>
  | { ok: false; status: "not_found"; id: string };

function requireGoalConsent(
  db: DatabaseType.Database,
  input: GoalConsentOptions = {},
): ConsentGateResult {
  return requireConsent("goals", {
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

function isCompletedStatus(status: GoalStatus): boolean {
  return status === "met" || status === "missed" || status === "abandoned";
}

function getGoalRow(
  db: DatabaseType.Database,
  id: string,
): GoalRow | undefined {
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as
    | GoalRow
    | undefined;
}

function emitGoalTelemetry(
  db: DatabaseType.Database,
  eventType:
    | "goal_created"
    | "goal_read"
    | "goal_status_changed"
    | "goal_touched",
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

export function createGoal(
  db: DatabaseType.Database,
  input: CreateGoalInput,
): GoalResult<GoalRow> {
  const gate = requireGoalConsent(db, input);
  if (!gate.ok) return gate;

  const createdAt = input.createdAt ?? input.now?.() ?? Date.now();
  const row: GoalRow = {
    id: input.id ?? randomUUID(),
    title: requireTrimmed(input.title, "title"),
    status: "active",
    parent_id: input.parentId?.trim() || null,
    created_at: createdAt,
    last_touched: createdAt,
    completed_at: null,
    source: "user",
  };

  db.prepare(
    `INSERT INTO goals (
       id, title, status, parent_id, created_at, last_touched, completed_at, source
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.title,
    row.status,
    row.parent_id,
    row.created_at,
    row.last_touched,
    row.completed_at,
    row.source,
  );

  emitGoalTelemetry(db, "goal_created", {
    timestamp: createdAt,
    success: true,
    notes: `id=${row.id}`,
  });

  return { ok: true, value: row };
}

export function listGoals(
  db: DatabaseType.Database,
  input: ListGoalsInput = {},
): GoalResult<GoalRow[]> {
  const gate = requirePersonalContextAccess(
    db,
    "goals",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;

  const limit = normalizeLimit(input.limit);
  const rows = input.status
    ? (db
        .prepare(
          `SELECT *
           FROM goals
           WHERE status = ?
           ORDER BY last_touched DESC, created_at DESC
           LIMIT ?`,
        )
        .all(input.status, limit) as GoalRow[])
    : (db
        .prepare(
          `SELECT *
           FROM goals
           ORDER BY last_touched DESC, created_at DESC
           LIMIT ?`,
        )
        .all(limit) as GoalRow[]);

  emitGoalTelemetry(db, "goal_read", {
    timestamp: input.now?.() ?? Date.now(),
    success: true,
    notes: `rows=${rows.length}`,
  });

  return { ok: true, value: rows };
}

export function getGoal(
  db: DatabaseType.Database,
  id: string,
  input: GoalConsentOptions = {},
): GoalResult<GoalRow | null> {
  const gate = requirePersonalContextAccess(
    db,
    "goals",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;

  const normalizedId = requireTrimmed(id, "id");
  const row = getGoalRow(db, normalizedId);

  emitGoalTelemetry(db, "goal_read", {
    timestamp: input.now?.() ?? Date.now(),
    success: row !== undefined,
    notes: `id=${normalizedId}`,
  });

  return { ok: true, value: row ?? null };
}

export function updateGoalStatus(
  db: DatabaseType.Database,
  id: string,
  input: UpdateGoalStatusInput,
): GoalMutationResult {
  const gate = requireGoalConsent(db, input);
  if (!gate.ok) return gate;

  const normalizedId = requireTrimmed(id, "id");
  const existing = getGoalRow(db, normalizedId);
  if (!existing) return { ok: false, status: "not_found", id: normalizedId };

  const touchedAt = input.now?.() ?? Date.now();
  const completedAt =
    input.status === "active"
      ? null
      : input.completedAt === undefined
        ? touchedAt
        : input.completedAt;

  db.prepare(
    `UPDATE goals
     SET status = ?, last_touched = ?, completed_at = ?
     WHERE id = ?`,
  ).run(input.status, touchedAt, completedAt, normalizedId);

  const row = getGoalRow(db, normalizedId);
  if (!row) return { ok: false, status: "not_found", id: normalizedId };

  emitGoalTelemetry(db, "goal_status_changed", {
    timestamp: touchedAt,
    success: true,
    notes: `id=${normalizedId};status=${input.status}`,
  });

  return { ok: true, value: row };
}

export function touchGoal(
  db: DatabaseType.Database,
  id: string,
  input: GoalConsentOptions = {},
): GoalMutationResult {
  const gate = requireGoalConsent(db, input);
  if (!gate.ok) return gate;

  const normalizedId = requireTrimmed(id, "id");
  const existing = getGoalRow(db, normalizedId);
  if (!existing) return { ok: false, status: "not_found", id: normalizedId };

  const touchedAt = input.now?.() ?? Date.now();
  db.prepare("UPDATE goals SET last_touched = ? WHERE id = ?").run(
    touchedAt,
    normalizedId,
  );

  const row = getGoalRow(db, normalizedId);
  if (!row) return { ok: false, status: "not_found", id: normalizedId };

  emitGoalTelemetry(db, "goal_touched", {
    timestamp: touchedAt,
    success: true,
    notes: `id=${normalizedId}`,
  });

  return { ok: true, value: row };
}

export function isGoalCompletedStatus(status: GoalStatus): boolean {
  return isCompletedStatus(status);
}
