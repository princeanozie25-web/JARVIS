import type DatabaseType from "better-sqlite3";
import {
  ProjectIndexSnapshotStatusSchema,
  type ProjectIndexSnapshotStatus,
} from "../projects/types";

export const ACTIVE_PROJECT_INDEX_SNAPSHOT_STATUSES = [
  "pending",
  "running",
] as const;

export interface ProjectIndexSnapshotRow {
  id: string;
  project_id: string;
  started_at: number;
  finished_at: number | null;
  sources_seen: number;
  artifacts_extracted: number;
  triggered_by: string;
  status: ProjectIndexSnapshotStatus;
}

export interface InsertProjectIndexSnapshotInput {
  id: string;
  projectId: string;
  startedAt: number;
  finishedAt?: number | null;
  sourcesSeen: number;
  artifactsExtracted?: number;
  triggeredBy: string;
  status: ProjectIndexSnapshotStatus;
}

export interface FinishProjectIndexSnapshotInput {
  id: string;
  finishedAt: number;
  status: Extract<
    ProjectIndexSnapshotStatus,
    "completed" | "failed" | "rejected"
  >;
  artifactsExtracted?: number;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function hasActiveProjectIndexSnapshot(
  db: DatabaseType.Database,
  projectId: string,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS active
       FROM project_index_snapshot
       WHERE project_id = ?
         AND status IN ('pending', 'running')
       LIMIT 1`,
    )
    .get(projectId) as { active: 1 } | undefined;
  return Boolean(row);
}

export function insertProjectIndexSnapshot(
  db: DatabaseType.Database,
  input: InsertProjectIndexSnapshotInput,
): ProjectIndexSnapshotRow {
  const artifactsExtracted = input.artifactsExtracted ?? 0;

  const row: ProjectIndexSnapshotRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    started_at: requireNonNegativeInteger(input.startedAt, "startedAt"),
    finished_at:
      input.finishedAt === undefined || input.finishedAt === null
        ? null
        : requireNonNegativeInteger(input.finishedAt, "finishedAt"),
    sources_seen: requireNonNegativeInteger(input.sourcesSeen, "sourcesSeen"),
    artifacts_extracted: requireNonNegativeInteger(
      artifactsExtracted,
      "artifactsExtracted",
    ),
    triggered_by: requireTrimmed(input.triggeredBy, "triggeredBy"),
    status: ProjectIndexSnapshotStatusSchema.parse(input.status),
  };

  db.prepare(
    `INSERT INTO project_index_snapshot (
       id, project_id, started_at, finished_at, sources_seen,
       artifacts_extracted, triggered_by, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.project_id,
    row.started_at,
    row.finished_at,
    row.sources_seen,
    row.artifacts_extracted,
    row.triggered_by,
    row.status,
  );

  return row;
}

export function getProjectIndexSnapshot(
  db: DatabaseType.Database,
  id: string,
): ProjectIndexSnapshotRow | undefined {
  return db
    .prepare("SELECT * FROM project_index_snapshot WHERE id = ?")
    .get(id) as ProjectIndexSnapshotRow | undefined;
}

// E-027 (R.2, 2026-09-04): newest-first with a MONOTONIC tiebreak. Two
// snapshots can share a started_at millisecond on fast hardware (observed on
// the M1 Max in the Phase 5 project.index idempotency test); the previous
// `id ASC` tiebreak over opaque ids was nondeterministic. rowid is insertion
// order, so the later insert always sorts first.
export function listProjectIndexSnapshots(
  db: DatabaseType.Database,
  projectId: string,
): ProjectIndexSnapshotRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_index_snapshot
       WHERE project_id = ?
       ORDER BY started_at DESC, rowid DESC`,
    )
    .all(projectId) as ProjectIndexSnapshotRow[];
}

export function finishProjectIndexSnapshot(
  db: DatabaseType.Database,
  input: FinishProjectIndexSnapshotInput,
): ProjectIndexSnapshotRow | undefined {
  if (input.artifactsExtracted === undefined) {
    db.prepare(
      `UPDATE project_index_snapshot
       SET finished_at = ?,
           status = ?
       WHERE id = ?`,
    ).run(
      requireNonNegativeInteger(input.finishedAt, "finishedAt"),
      ProjectIndexSnapshotStatusSchema.parse(input.status),
      requireTrimmed(input.id, "id"),
    );
  } else {
    db.prepare(
      `UPDATE project_index_snapshot
       SET finished_at = ?,
           artifacts_extracted = ?,
           status = ?
       WHERE id = ?`,
    ).run(
      requireNonNegativeInteger(input.finishedAt, "finishedAt"),
      requireNonNegativeInteger(input.artifactsExtracted, "artifactsExtracted"),
      ProjectIndexSnapshotStatusSchema.parse(input.status),
      requireTrimmed(input.id, "id"),
    );
  }
  return getProjectIndexSnapshot(db, input.id);
}
