import type DatabaseType from "better-sqlite3";
import {
  ProjectRootKindSchema,
  ProjectSlugSchema,
  ProjectStatusSchema,
  type ProjectRootKind,
  type ProjectStatus,
} from "../projects/types";

export interface ProjectRow {
  id: string;
  slug: string;
  display_name: string;
  root_kind: ProjectRootKind;
  root_ref: string;
  created_at: number;
  archived_at: number | null;
  status: ProjectStatus;
}

export interface InsertRegisteredProjectInput {
  id: string;
  slug: string;
  displayName: string;
  rootKind: ProjectRootKind;
  rootRef: string;
  createdAt?: number;
  archivedAt?: number | null;
  status?: ProjectStatus;
  now?: () => number;
}

export interface ListRegisteredProjectsInput {
  includeArchived?: boolean;
  limit?: number;
}

export interface UpdateProjectStatusInput {
  id: string;
  status: ProjectStatus;
  updatedAt: number;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.trunc(limit ?? 100), 1), 500);
}

export function insertRegisteredProject(
  db: DatabaseType.Database,
  input: InsertRegisteredProjectInput,
): ProjectRow {
  const row: ProjectRow = {
    id: requireTrimmed(input.id, "id"),
    slug: ProjectSlugSchema.parse(input.slug),
    display_name: requireTrimmed(input.displayName, "displayName"),
    root_kind: ProjectRootKindSchema.parse(input.rootKind),
    root_ref: requireTrimmed(input.rootRef, "rootRef"),
    created_at: input.createdAt ?? input.now?.() ?? Date.now(),
    archived_at: input.archivedAt ?? null,
    status: ProjectStatusSchema.parse(input.status ?? "active"),
  };

  db.prepare(
    `INSERT INTO projects (
       id, slug, display_name, root_kind, root_ref, created_at, archived_at, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.slug,
    row.display_name,
    row.root_kind,
    row.root_ref,
    row.created_at,
    row.archived_at,
    row.status,
  );

  return row;
}

export function listRegisteredProjects(
  db: DatabaseType.Database,
  input: ListRegisteredProjectsInput = {},
): ProjectRow[] {
  const limit = normalizeLimit(input.limit);
  if (input.includeArchived) {
    return db
      .prepare(
        `SELECT *
         FROM projects
         ORDER BY created_at DESC, display_name ASC
         LIMIT ?`,
      )
      .all(limit) as ProjectRow[];
  }

  return db
    .prepare(
      `SELECT *
       FROM projects
       WHERE status != 'archived'
       ORDER BY created_at DESC, display_name ASC
       LIMIT ?`,
    )
    .all(limit) as ProjectRow[];
}

export function getRegisteredProject(
  db: DatabaseType.Database,
  input: { id?: string; slug?: string },
): ProjectRow | undefined {
  const id = input.id?.trim();
  if (id) {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | ProjectRow
      | undefined;
  }

  const slug = input.slug ? ProjectSlugSchema.parse(input.slug) : undefined;
  if (!slug) return undefined;

  return db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as
    | ProjectRow
    | undefined;
}

export function updateProjectStatus(
  db: DatabaseType.Database,
  input: UpdateProjectStatusInput,
): ProjectRow | undefined {
  const id = requireTrimmed(input.id, "id");
  const status = ProjectStatusSchema.parse(input.status);
  const archivedAt = status === "archived" ? input.updatedAt : null;

  db.prepare(
    `UPDATE projects
     SET status = ?,
         archived_at = ?
     WHERE id = ?`,
  ).run(status, archivedAt, id);

  return getRegisteredProject(db, { id });
}
