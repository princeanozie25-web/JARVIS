import type DatabaseType from "better-sqlite3";
import {
  ProjectSourceKindSchema,
  type ProjectSourceKind,
} from "../projects/types";

export interface ProjectSourceRow {
  id: string;
  project_id: string;
  kind: ProjectSourceKind;
  ref: string;
  last_indexed_at: number | null;
  source_hash: string | null;
}

export interface InsertProjectSourceInput {
  id: string;
  projectId: string;
  kind: ProjectSourceKind;
  ref: string;
  lastIndexedAt?: number | null;
  sourceHash?: string | null;
}

export interface UpdateProjectSourceIndexMetadataInput {
  id: string;
  lastIndexedAt: number;
  sourceHash?: string | null;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

export function insertProjectSource(
  db: DatabaseType.Database,
  input: InsertProjectSourceInput,
): ProjectSourceRow {
  const row: ProjectSourceRow = {
    id: requireTrimmed(input.id, "id"),
    project_id: requireTrimmed(input.projectId, "projectId"),
    kind: ProjectSourceKindSchema.parse(input.kind),
    ref: requireTrimmed(input.ref, "ref"),
    last_indexed_at: input.lastIndexedAt ?? null,
    source_hash: input.sourceHash?.trim() || null,
  };

  db.prepare(
    `INSERT INTO project_source (
       id, project_id, kind, ref, last_indexed_at, source_hash
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.project_id,
    row.kind,
    row.ref,
    row.last_indexed_at,
    row.source_hash,
  );

  return row;
}

export function getProjectSource(
  db: DatabaseType.Database,
  id: string,
): ProjectSourceRow | undefined {
  return db.prepare("SELECT * FROM project_source WHERE id = ?").get(id) as
    | ProjectSourceRow
    | undefined;
}

export function listProjectSources(
  db: DatabaseType.Database,
  projectId: string,
): ProjectSourceRow[] {
  return db
    .prepare(
      `SELECT *
       FROM project_source
       WHERE project_id = ?
       ORDER BY kind ASC, ref ASC, id ASC`,
    )
    .all(projectId) as ProjectSourceRow[];
}

export function countProjectSources(
  db: DatabaseType.Database,
  projectId: string,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM project_source
       WHERE project_id = ?`,
    )
    .get(projectId) as { count: number };
  return row.count;
}

export function updateProjectSourceIndexMetadata(
  db: DatabaseType.Database,
  input: UpdateProjectSourceIndexMetadataInput,
): ProjectSourceRow | undefined {
  db.prepare(
    `UPDATE project_source
     SET last_indexed_at = ?,
         source_hash = ?
     WHERE id = ?`,
  ).run(
    input.lastIndexedAt,
    input.sourceHash?.trim() || null,
    requireTrimmed(input.id, "id"),
  );
  return getProjectSource(db, input.id);
}
