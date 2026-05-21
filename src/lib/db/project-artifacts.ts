import type DatabaseType from "better-sqlite3";
import {
  ProjectBlockerStatusSchema,
  ProjectTaskStatusSchema,
  ProjectThreadStatusSchema,
  type ProjectBlockerStatus,
  type ProjectTaskStatus,
  type ProjectThreadStatus,
} from "../projects/types";

export interface ProjectThreadRow {
  id: string;
  project_id: string;
  title: string;
  status: ProjectThreadStatus;
  first_seen_at: number;
  last_active_at: number;
  origin_ref: string;
}

export interface InsertProjectThreadInput {
  id: string;
  projectId: string;
  title: string;
  status: ProjectThreadStatus;
  firstSeenAt: number;
  lastActiveAt: number;
  originRef: string;
}

export interface ProjectTaskRow {
  id: string;
  project_id: string;
  thread_id: string | null;
  title: string;
  status: ProjectTaskStatus;
  confidence: number;
  promoted: 0 | 1;
  origin_ref: string;
  created_at: number;
  updated_at: number;
}

export interface InsertProjectTaskInput {
  id: string;
  projectId: string;
  threadId?: string | null;
  title: string;
  status: ProjectTaskStatus;
  confidence: number;
  promoted?: boolean | 0 | null;
  originRef: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromoteProjectTaskInput {
  projectId: string;
  taskId: string;
  updatedAt: number;
}

export interface ProjectBlockerRow {
  id: string;
  project_id: string;
  task_id: string | null;
  description: string;
  status: ProjectBlockerStatus;
  origin_ref: string;
}

export interface InsertProjectBlockerInput {
  id: string;
  projectId: string;
  taskId?: string | null;
  description: string;
  status: ProjectBlockerStatus;
  originRef: string;
}

export interface ProjectDecisionRow {
  id: string;
  project_id: string;
  summary: string;
  decided_at: number | null;
  origin_ref: string;
}

export interface InsertProjectDecisionInput {
  id: string;
  projectId: string;
  summary: string;
  decidedAt?: number | null;
  originRef: string;
}

export interface ProjectArtifactCounts {
  extractedTasks: number;
  promotedTasks: number;
  openBlockers: number;
  clearedBlockers: number;
  decisions: number;
  threads: number;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return requireTrimmed(value, "optional reference");
}

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function requireConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  return value;
}

function requireUnpromoted(value: boolean | 0 | null | undefined): 0 {
  if (value === undefined || value === null || value === false || value === 0) {
    return 0;
  }
  throw new Error("project tasks must not be auto-promoted");
}

export function insertProjectThread(
  db: DatabaseType.Database,
  input: InsertProjectThreadInput,
): ProjectThreadRow {
  const row: ProjectThreadRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    title: requireTrimmed(input.title, "title"),
    status: ProjectThreadStatusSchema.parse(input.status),
    first_seen_at: requireNonNegativeInteger(input.firstSeenAt, "firstSeenAt"),
    last_active_at: requireNonNegativeInteger(
      input.lastActiveAt,
      "lastActiveAt",
    ),
    origin_ref: requireTrimmed(input.originRef, "originRef"),
  };

  db.prepare(
    `INSERT INTO project_thread (
       id, project_id, title, status, first_seen_at, last_active_at, origin_ref
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.project_id,
    row.title,
    row.status,
    row.first_seen_at,
    row.last_active_at,
    row.origin_ref,
  );

  return row;
}

export function getProjectThread(
  db: DatabaseType.Database,
  id: string,
): ProjectThreadRow | undefined {
  return db.prepare("SELECT * FROM project_thread WHERE id = ?").get(id) as
    | ProjectThreadRow
    | undefined;
}

export function listProjectThreads(
  db: DatabaseType.Database,
  projectId: string,
): ProjectThreadRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_thread
       WHERE project_id = ?
       ORDER BY last_active_at DESC, id ASC`,
    )
    .all(projectId) as ProjectThreadRow[];
}

export function insertProjectTask(
  db: DatabaseType.Database,
  input: InsertProjectTaskInput,
): ProjectTaskRow {
  const row: ProjectTaskRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    thread_id: optionalTrimmed(input.threadId),
    title: requireTrimmed(input.title, "title"),
    status: ProjectTaskStatusSchema.parse(input.status),
    confidence: requireConfidence(input.confidence),
    promoted: requireUnpromoted(input.promoted),
    origin_ref: requireTrimmed(input.originRef, "originRef"),
    created_at: requireNonNegativeInteger(input.createdAt, "createdAt"),
    updated_at: requireNonNegativeInteger(input.updatedAt, "updatedAt"),
  };

  db.prepare(
    `INSERT INTO project_task (
       id, project_id, thread_id, title, status, confidence, promoted,
       origin_ref, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.project_id,
    row.thread_id,
    row.title,
    row.status,
    row.confidence,
    row.promoted,
    row.origin_ref,
    row.created_at,
    row.updated_at,
  );

  return row;
}

export function getProjectTask(
  db: DatabaseType.Database,
  id: string,
): ProjectTaskRow | undefined {
  return db.prepare("SELECT * FROM project_task WHERE id = ?").get(id) as
    | ProjectTaskRow
    | undefined;
}

export function getProjectTaskByOrigin(
  db: DatabaseType.Database,
  projectId: string,
  originRef: string,
): ProjectTaskRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM project_task
       WHERE project_id = ?
         AND origin_ref = ?`,
    )
    .get(
      requireTrimmed(projectId, "projectId"),
      requireTrimmed(originRef, "originRef"),
    ) as ProjectTaskRow | undefined;
}

export function listProjectTasks(
  db: DatabaseType.Database,
  projectId: string,
): ProjectTaskRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_task
       WHERE project_id = ?
       ORDER BY updated_at DESC, id ASC`,
    )
    .all(projectId) as ProjectTaskRow[];
}

export function promoteProjectTask(
  db: DatabaseType.Database,
  input: PromoteProjectTaskInput,
): ProjectTaskRow | undefined {
  db.prepare(
    `UPDATE project_task
     SET promoted = 1,
         updated_at = ?
     WHERE id = ?
       AND project_id = ?
       AND promoted = 0
       AND status = 'extracted'`,
  ).run(
    requireNonNegativeInteger(input.updatedAt, "updatedAt"),
    requireTrimmed(input.taskId, "taskId"),
    requireTrimmed(input.projectId, "projectId"),
  );
  return getProjectTask(db, input.taskId);
}

export function listPromotedProjectTasks(
  db: DatabaseType.Database,
  projectId: string,
  limit: number,
): ProjectTaskRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_task
       WHERE project_id = ?
         AND promoted = 1
       ORDER BY updated_at DESC, id ASC
       LIMIT ?`,
    )
    .all(
      requireTrimmed(projectId, "projectId"),
      requireNonNegativeInteger(limit, "limit"),
    ) as ProjectTaskRow[];
}

export function insertProjectBlocker(
  db: DatabaseType.Database,
  input: InsertProjectBlockerInput,
): ProjectBlockerRow {
  const row: ProjectBlockerRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    task_id: optionalTrimmed(input.taskId),
    description: requireTrimmed(input.description, "description"),
    status: ProjectBlockerStatusSchema.parse(input.status),
    origin_ref: requireTrimmed(input.originRef, "originRef"),
  };

  db.prepare(
    `INSERT INTO project_blocker (
       id, project_id, task_id, description, status, origin_ref
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.project_id,
    row.task_id,
    row.description,
    row.status,
    row.origin_ref,
  );

  return row;
}

export function getProjectBlocker(
  db: DatabaseType.Database,
  id: string,
): ProjectBlockerRow | undefined {
  return db.prepare("SELECT * FROM project_blocker WHERE id = ?").get(id) as
    | ProjectBlockerRow
    | undefined;
}

export function getProjectBlockerByOrigin(
  db: DatabaseType.Database,
  projectId: string,
  originRef: string,
): ProjectBlockerRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM project_blocker
       WHERE project_id = ?
         AND origin_ref = ?`,
    )
    .get(
      requireTrimmed(projectId, "projectId"),
      requireTrimmed(originRef, "originRef"),
    ) as ProjectBlockerRow | undefined;
}

export function listProjectBlockers(
  db: DatabaseType.Database,
  projectId: string,
): ProjectBlockerRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_blocker
       WHERE project_id = ?
       ORDER BY id ASC`,
    )
    .all(projectId) as ProjectBlockerRow[];
}

export function listOpenProjectBlockers(
  db: DatabaseType.Database,
  projectId: string,
  limit: number,
): ProjectBlockerRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_blocker
       WHERE project_id = ?
         AND status = 'open'
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(
      requireTrimmed(projectId, "projectId"),
      requireNonNegativeInteger(limit, "limit"),
    ) as ProjectBlockerRow[];
}

export function insertProjectDecision(
  db: DatabaseType.Database,
  input: InsertProjectDecisionInput,
): ProjectDecisionRow {
  const row: ProjectDecisionRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    summary: requireTrimmed(input.summary, "summary"),
    decided_at:
      input.decidedAt === undefined || input.decidedAt === null
        ? null
        : requireNonNegativeInteger(input.decidedAt, "decidedAt"),
    origin_ref: requireTrimmed(input.originRef, "originRef"),
  };

  db.prepare(
    `INSERT INTO project_decision (
       id, project_id, summary, decided_at, origin_ref
     ) VALUES (?, ?, ?, ?, ?)`,
  ).run(row.id, row.project_id, row.summary, row.decided_at, row.origin_ref);

  return row;
}

export function getProjectDecision(
  db: DatabaseType.Database,
  id: string,
): ProjectDecisionRow | undefined {
  return db.prepare("SELECT * FROM project_decision WHERE id = ?").get(id) as
    | ProjectDecisionRow
    | undefined;
}

export function listProjectDecisions(
  db: DatabaseType.Database,
  projectId: string,
): ProjectDecisionRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_decision
       WHERE project_id = ?
       ORDER BY decided_at DESC, id ASC`,
    )
    .all(projectId) as ProjectDecisionRow[];
}

export function getProjectArtifactCounts(
  db: DatabaseType.Database,
  projectId: string,
): ProjectArtifactCounts {
  const id = requireTrimmed(projectId, "projectId");
  const row = db
    .prepare(
      `SELECT
         (
           SELECT COUNT(*)
           FROM project_task
           WHERE project_id = ?
             AND status = 'extracted'
             AND promoted = 0
         ) AS extractedTasks,
         (
           SELECT COUNT(*)
           FROM project_task
           WHERE project_id = ?
             AND promoted = 1
         ) AS promotedTasks,
         (
           SELECT COUNT(*)
           FROM project_blocker
           WHERE project_id = ?
             AND status = 'open'
         ) AS openBlockers,
         (
           SELECT COUNT(*)
           FROM project_blocker
           WHERE project_id = ?
             AND status = 'cleared'
         ) AS clearedBlockers,
         (
           SELECT COUNT(*)
           FROM project_decision
           WHERE project_id = ?
         ) AS decisions,
         (
           SELECT COUNT(*)
           FROM project_thread
           WHERE project_id = ?
         ) AS threads`,
    )
    .get(id, id, id, id, id, id) as ProjectArtifactCounts;
  return row;
}
