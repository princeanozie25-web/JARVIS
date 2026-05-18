import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "./telemetry";

export interface ProjectStateRow {
  project_id: string;
  project_name: string;
  last_session_id: string | null;
  last_action_summary: string;
  open_threads_json: string;
  next_intended_step: string | null;
  updated_at: number;
}

export interface UpsertProjectStateInput {
  projectId: string;
  projectName: string;
  lastSessionId?: string | null;
  lastActionSummary: string;
  openThreads?: string[];
  openThreadsJson?: string;
  nextIntendedStep?: string | null;
  updatedAt?: number;
  now?: () => number;
}

function normalizeJsonString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("openThreadsJson must encode an array");
  }
  return JSON.stringify(
    parsed.filter((item): item is string => typeof item === "string"),
  );
}

function openThreadsJson(input: UpsertProjectStateInput): string {
  if (input.openThreadsJson !== undefined) {
    return normalizeJsonString(input.openThreadsJson) ?? "[]";
  }
  return JSON.stringify(input.openThreads ?? []);
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

export function upsertProjectState(
  db: DatabaseType.Database,
  input: UpsertProjectStateInput,
): ProjectStateRow {
  const updatedAt = input.updatedAt ?? input.now?.() ?? Date.now();
  const row: ProjectStateRow = {
    project_id: requireTrimmed(input.projectId, "projectId"),
    project_name: requireTrimmed(input.projectName, "projectName"),
    last_session_id: input.lastSessionId?.trim() || null,
    last_action_summary: requireTrimmed(
      input.lastActionSummary,
      "lastActionSummary",
    ),
    open_threads_json: openThreadsJson(input),
    next_intended_step: input.nextIntendedStep?.trim() || null,
    updated_at: updatedAt,
  };

  db.prepare(
    `INSERT INTO project_state (
       project_id, project_name, last_session_id, last_action_summary,
       open_threads_json, next_intended_step, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       project_name = excluded.project_name,
       last_session_id = excluded.last_session_id,
       last_action_summary = excluded.last_action_summary,
       open_threads_json = excluded.open_threads_json,
       next_intended_step = excluded.next_intended_step,
       updated_at = excluded.updated_at`,
  ).run(
    row.project_id,
    row.project_name,
    row.last_session_id,
    row.last_action_summary,
    row.open_threads_json,
    row.next_intended_step,
    row.updated_at,
  );

  insertTelemetryEvent(db, {
    timestamp: updatedAt,
    event_type: "project_state_saved",
    success: true,
    session_id: row.last_session_id ?? undefined,
    notes: `project_id=${row.project_id}`,
  });

  return row;
}

export function getProjectState(
  db: DatabaseType.Database,
  projectId: string,
  input: { now?: () => number } = {},
): ProjectStateRow | undefined {
  const row = db
    .prepare(
      `SELECT *
       FROM project_state
       WHERE project_id = ?`,
    )
    .get(projectId) as ProjectStateRow | undefined;

  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "project_state_read",
    success: row !== undefined,
    session_id: row?.last_session_id ?? undefined,
    notes: `project_id=${projectId}`,
  });

  return row;
}

export function listProjectStates(
  db: DatabaseType.Database,
  input: { limit?: number; now?: () => number } = {},
): ProjectStateRow[] {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 500);
  const rows = db
    .prepare(
      `SELECT *
       FROM project_state
       ORDER BY updated_at DESC, project_name ASC
       LIMIT ?`,
    )
    .all(limit) as ProjectStateRow[];

  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "project_state_read",
    success: true,
    notes: `rows=${rows.length}`,
  });

  return rows;
}
