import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRegisteredProject,
  insertRegisteredProject,
  listRegisteredProjects,
  updateProjectStatus,
} from "./projects";
import { applyMigrations } from "./schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("project registry persistence", () => {
  it("creates valid registered project rows", () => {
    const row = insertRegisteredProject(db, {
      id: "proj_opaque-id",
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "fs",
      rootRef: "workspace-ref",
      createdAt: 1_000,
    });

    expect(row).toEqual({
      id: "proj_opaque-id",
      slug: "jarvis",
      display_name: "JARVIS",
      root_kind: "fs",
      root_ref: "workspace-ref",
      created_at: 1_000,
      archived_at: null,
      status: "active",
    });
    expect(row.id).not.toBe(row.root_ref);
  });

  it("enforces unique slugs", () => {
    insertRegisteredProject(db, {
      id: "proj_1",
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "virtual",
      rootRef: "jarvis",
      createdAt: 1_000,
    });

    expect(() =>
      insertRegisteredProject(db, {
        id: "proj_2",
        slug: "jarvis",
        displayName: "Duplicate",
        rootKind: "virtual",
        rootRef: "duplicate",
        createdAt: 2_000,
      }),
    ).toThrow();
  });

  it("validates allowed root kinds and statuses before insertion", () => {
    expect(() =>
      insertRegisteredProject(db, {
        id: "proj_invalid-root",
        slug: "bad-root",
        displayName: "Bad Root",
        rootKind: "network" as "fs",
        rootRef: "remote",
      }),
    ).toThrow();

    expect(() =>
      insertRegisteredProject(db, {
        id: "proj_invalid-status",
        slug: "bad-status",
        displayName: "Bad Status",
        rootKind: "virtual",
        rootRef: "status",
        status: "running" as "active",
      }),
    ).toThrow();
  });

  it("lists registered projects and omits archived rows by default", () => {
    insertRegisteredProject(db, {
      id: "proj_active",
      slug: "active",
      displayName: "Active",
      rootKind: "memory",
      rootRef: "memory:active",
      createdAt: 1_000,
    });
    insertRegisteredProject(db, {
      id: "proj_archived",
      slug: "archived",
      displayName: "Archived",
      rootKind: "virtual",
      rootRef: "virtual:archived",
      createdAt: 2_000,
      archivedAt: 3_000,
      status: "archived",
    });

    expect(listRegisteredProjects(db).map((row) => row.id)).toEqual([
      "proj_active",
    ]);
    expect(
      listRegisteredProjects(db, { includeArchived: true }).map(
        (row) => row.id,
      ),
    ).toEqual(["proj_archived", "proj_active"]);
  });

  it("gets one registered project by id or slug", () => {
    insertRegisteredProject(db, {
      id: "proj_lookup",
      slug: "lookup",
      displayName: "Lookup",
      rootKind: "obsidian",
      rootRef: "20-projects/lookup",
      createdAt: 1_000,
      status: "paused",
    });

    expect(getRegisteredProject(db, { id: "proj_lookup" })?.slug).toBe(
      "lookup",
    );
    expect(getRegisteredProject(db, { slug: "lookup" })?.id).toBe(
      "proj_lookup",
    );
    expect(getRegisteredProject(db, { slug: "missing" })).toBeUndefined();
  });

  it("updates only status and archived_at", () => {
    insertRegisteredProject(db, {
      id: "proj_status",
      slug: "status",
      displayName: "Status",
      rootKind: "virtual",
      rootRef: "virtual:status",
      createdAt: 1_000,
    });

    const archived = updateProjectStatus(db, {
      id: "proj_status",
      status: "archived",
      updatedAt: 2_000,
    });

    expect(archived).toEqual({
      id: "proj_status",
      slug: "status",
      display_name: "Status",
      root_kind: "virtual",
      root_ref: "virtual:status",
      created_at: 1_000,
      archived_at: 2_000,
      status: "archived",
    });

    const paused = updateProjectStatus(db, {
      id: "proj_status",
      status: "paused",
      updatedAt: 3_000,
    });

    expect(paused).toMatchObject({
      id: "proj_status",
      status: "paused",
      archived_at: null,
    });
  });

  it("rejects invalid project status updates", () => {
    insertRegisteredProject(db, {
      id: "proj_status",
      slug: "status",
      displayName: "Status",
      rootKind: "virtual",
      rootRef: "virtual:status",
      createdAt: 1_000,
    });

    expect(() =>
      updateProjectStatus(db, {
        id: "proj_status",
        status: "running" as "active",
        updatedAt: 2_000,
      }),
    ).toThrow();
  });
});
