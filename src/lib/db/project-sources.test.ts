import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countProjectSources,
  insertProjectSource,
  listProjectSources,
} from "./project-sources";
import { insertRegisteredProject } from "./projects";
import { applyMigrations } from "./schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  insertRegisteredProject(db, {
    id: "proj_jarvis",
    slug: "jarvis",
    displayName: "JARVIS",
    rootKind: "virtual",
    rootRef: "virtual:jarvis",
    createdAt: 1_000,
  });
});

afterEach(() => {
  db.close();
});

describe("project source ledger persistence", () => {
  it("creates source pointer rows without index metadata", () => {
    const row = insertProjectSource(db, {
      id: "psrc_1",
      projectId: "proj_jarvis",
      kind: "thread",
      ref: "thread:phase-5",
    });

    expect(row).toEqual({
      id: "psrc_1",
      project_id: "proj_jarvis",
      kind: "thread",
      ref: "thread:phase-5",
      last_indexed_at: null,
      source_hash: null,
    });
    expect(countProjectSources(db, "proj_jarvis")).toBe(1);
  });

  it("requires an existing project_id", () => {
    expect(() =>
      insertProjectSource(db, {
        id: "psrc_missing",
        projectId: "proj_missing",
        kind: "thread",
        ref: "thread:missing",
      }),
    ).toThrow();
  });

  it("validates allowed source kinds", () => {
    for (const kind of [
      "file",
      "memory_slug",
      "obsidian_note",
      "thread",
    ] as const) {
      insertProjectSource(db, {
        id: `psrc_${kind}`,
        projectId: "proj_jarvis",
        kind,
        ref: `${kind}:example`,
      });
    }

    expect(
      listProjectSources(db, "proj_jarvis").map((row) => row.kind),
    ).toEqual(["file", "memory_slug", "obsidian_note", "thread"]);
  });

  it("rejects invalid source kinds before insertion", () => {
    expect(() =>
      insertProjectSource(db, {
        id: "psrc_bad",
        projectId: "proj_jarvis",
        kind: "network_url" as "file",
        ref: "https://example.test/project",
      }),
    ).toThrow();
    expect(countProjectSources(db, "proj_jarvis")).toBe(0);
  });
});
