import type DatabaseType from "better-sqlite3";
import {
  readConsentManifest,
  type ConsentFeatureId,
  type ConsentGateResult,
} from "../consent";
import type {
  GoalRow,
  PreferenceRow,
  ProjectStateRow,
  SessionSummaryRow,
} from "../db/node";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
} from "../personal-context";
import { insertTelemetryEvent } from "../db/telemetry";

export const TIMELINE_ENTRY_TYPES = [
  "session_summary",
  "project_state",
  "goal",
  "preference",
] as const;

export type TimelineEntryType = (typeof TIMELINE_ENTRY_TYPES)[number];

export const TIMELINE_PROJECTION_NOTICE =
  "summary_or_projection_not_transcript" as const;

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  title: string;
  summary: string;
  timestamp: number;
  source_id: string;
  source_label: string;
  projection_notice: typeof TIMELINE_PROJECTION_NOTICE;
}

export interface TimelineIndexInput {
  type?: TimelineEntryType;
  project?: string;
  limit?: number;
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  accessContext?: PersonalContextAccessContext;
}

export type TimelineIndexResult =
  | { ok: true; entries: TimelineEntry[] }
  | Extract<ConsentGateResult, { ok: false }>;

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function featureEnabled(
  db: DatabaseType.Database,
  featureId: ConsentFeatureId,
  input: TimelineIndexInput,
): boolean {
  const manifest = readConsentManifest({
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
  return (
    manifest.records.find((record) => record.feature_id === featureId)
      ?.enabled ?? false
  );
}

function entryBase(input: {
  id: string;
  type: TimelineEntryType;
  title: string;
  summary: string;
  timestamp: number;
  sourceId: string;
  sourceLabel: string;
}): TimelineEntry {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    summary: input.summary,
    timestamp: input.timestamp,
    source_id: input.sourceId,
    source_label: input.sourceLabel,
    projection_notice: TIMELINE_PROJECTION_NOTICE,
  };
}

function listSummaryEntries(
  db: DatabaseType.Database,
  limit: number,
): TimelineEntry[] {
  const rows = db
    .prepare(
      `SELECT *
       FROM session_summaries
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    )
    .all(limit) as SessionSummaryRow[];

  return rows.map((row) =>
    entryBase({
      id: `session_summary:${row.summary_hash}`,
      type: "session_summary",
      title: `Session summary ${row.session_id}`,
      summary: row.summary_text,
      timestamp: row.updated_at,
      sourceId: row.summary_hash,
      sourceLabel: "Session summary projection",
    }),
  );
}

function listProjectStateEntries(
  db: DatabaseType.Database,
  input: { limit: number; project?: string },
): TimelineEntry[] {
  const project = input.project?.trim();
  const rows = project
    ? (db
        .prepare(
          `SELECT *
           FROM project_state
           WHERE project_id = ? OR project_name = ?
           ORDER BY updated_at DESC, project_name ASC
           LIMIT ?`,
        )
        .all(project, project, input.limit) as ProjectStateRow[])
    : (db
        .prepare(
          `SELECT *
           FROM project_state
           ORDER BY updated_at DESC, project_name ASC
           LIMIT ?`,
        )
        .all(input.limit) as ProjectStateRow[]);

  return rows.map((row) =>
    entryBase({
      id: `project_state:${row.project_id}`,
      type: "project_state",
      title: row.project_name,
      summary: row.last_action_summary,
      timestamp: row.updated_at,
      sourceId: row.project_id,
      sourceLabel: "Project state projection",
    }),
  );
}

function listGoalEntries(
  db: DatabaseType.Database,
  limit: number,
): TimelineEntry[] {
  const rows = db
    .prepare(
      `SELECT *
       FROM goals
       ORDER BY last_touched DESC, created_at DESC
       LIMIT ?`,
    )
    .all(limit) as GoalRow[];

  return rows.map((row) =>
    entryBase({
      id: `goal:${row.id}`,
      type: "goal",
      title: row.title,
      summary: `Goal status: ${row.status}`,
      timestamp: row.last_touched,
      sourceId: row.id,
      sourceLabel: "Goal projection",
    }),
  );
}

function listPreferenceEntries(
  db: DatabaseType.Database,
  limit: number,
): TimelineEntry[] {
  const rows = db
    .prepare(
      `SELECT *
       FROM preferences
       ORDER BY created_at DESC, effective_from DESC, key ASC
       LIMIT ?`,
    )
    .all(limit) as PreferenceRow[];

  return rows.map((row) =>
    entryBase({
      id: `preference:${row.id}`,
      type: "preference",
      title: row.key,
      summary: row.value,
      timestamp: row.created_at,
      sourceId: row.id,
      sourceLabel: "Preference projection",
    }),
  );
}

export function readTimelineIndex(
  db: DatabaseType.Database,
  input: TimelineIndexInput = {},
): TimelineIndexResult {
  const gate = requirePersonalContextAccess(
    db,
    "timeline",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;

  const limit = normalizeLimit(input.limit);
  const entries: TimelineEntry[] = [];

  if (!input.type || input.type === "session_summary") {
    entries.push(...listSummaryEntries(db, limit));
  }
  if (!input.type || input.type === "project_state") {
    entries.push(
      ...listProjectStateEntries(db, { limit, project: input.project }),
    );
  }
  if (
    (!input.type || input.type === "goal") &&
    featureEnabled(db, "goals", input)
  ) {
    const goalGate = requirePersonalContextAccess(
      db,
      "goals",
      {
        caller: "timeline",
        feature_id: "goals",
        purpose: "project_goal_timeline_entries",
        personal_context: true,
      },
      input,
    );
    if (goalGate.ok) entries.push(...listGoalEntries(db, limit));
  }
  if (
    (!input.type || input.type === "preference") &&
    featureEnabled(db, "preferences", input)
  ) {
    const preferenceGate = requirePersonalContextAccess(
      db,
      "preferences",
      {
        caller: "timeline",
        feature_id: "preferences",
        purpose: "project_preference_timeline_entries",
        personal_context: true,
      },
      input,
    );
    if (preferenceGate.ok) entries.push(...listPreferenceEntries(db, limit));
  }

  const sorted = entries
    .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id))
    .slice(0, limit);
  const at = input.now?.() ?? Date.now();

  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "timeline_projected",
    success: true,
    notes: `rows=${sorted.length}`,
  });
  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "timeline_read",
    success: true,
    notes: `rows=${sorted.length}`,
  });

  return { ok: true, entries: sorted };
}
