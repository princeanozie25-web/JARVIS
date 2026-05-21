import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasActiveProjectIndexSnapshot,
  insertProjectIndexSnapshot,
  listProjectIndexSnapshots,
} from "./project-index-snapshots";
import { insertProjectSource } from "./project-sources";
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

describe("project index snapshot persistence", () => {
  it("creates metadata-only snapshot rows", () => {
    const row = insertProjectIndexSnapshot(db, {
      id: "pidx_1",
      projectId: "proj_jarvis",
      startedAt: 2_000,
      finishedAt: 2_000,
      sourcesSeen: 0,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "completed",
    });

    expect(row).toEqual({
      id: "pidx_1",
      project_id: "proj_jarvis",
      started_at: 2_000,
      finished_at: 2_000,
      sources_seen: 0,
      artifacts_extracted: 0,
      triggered_by: "manual",
      status: "completed",
    });
  });

  it("requires an existing project_id", () => {
    expect(() =>
      insertProjectIndexSnapshot(db, {
        id: "pidx_missing",
        projectId: "proj_missing",
        startedAt: 2_000,
        sourcesSeen: 0,
        artifactsExtracted: 0,
        triggeredBy: "manual",
        status: "pending",
      }),
    ).toThrow();
  });

  it("validates allowed statuses", () => {
    for (const status of [
      "pending",
      "running",
      "completed",
      "failed",
      "rejected",
    ] as const) {
      insertProjectIndexSnapshot(db, {
        id: `pidx_${status}`,
        projectId: "proj_jarvis",
        startedAt: 2_000,
        finishedAt: status === "pending" || status === "running" ? null : 2_000,
        sourcesSeen: 0,
        artifactsExtracted: 0,
        triggeredBy: "manual",
        status,
      });
      if (status === "pending" || status === "running") {
        db.prepare(
          "UPDATE project_index_snapshot SET status = 'rejected', finished_at = ? WHERE id = ?",
        ).run(2_001, `pidx_${status}`);
      }
    }

    expect(listProjectIndexSnapshots(db, "proj_jarvis")).toHaveLength(5);
  });

  it("rejects invalid status and nonzero artifacts", () => {
    expect(() =>
      insertProjectIndexSnapshot(db, {
        id: "pidx_bad_status",
        projectId: "proj_jarvis",
        startedAt: 2_000,
        sourcesSeen: 0,
        artifactsExtracted: 0,
        triggeredBy: "manual",
        status: "queued" as "pending",
      }),
    ).toThrow();

    expect(() =>
      insertProjectIndexSnapshot(db, {
        id: "pidx_bad_artifacts",
        projectId: "proj_jarvis",
        startedAt: 2_000,
        sourcesSeen: 0,
        artifactsExtracted: 1 as 0,
        triggeredBy: "manual",
        status: "completed",
      }),
    ).toThrow("artifactsExtracted must remain 0");
  });

  it("supports active snapshot lock detection and database enforcement", () => {
    insertProjectIndexSnapshot(db, {
      id: "pidx_running",
      projectId: "proj_jarvis",
      startedAt: 2_000,
      sourcesSeen: 0,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "running",
    });

    expect(hasActiveProjectIndexSnapshot(db, "proj_jarvis")).toBe(true);
    expect(() =>
      insertProjectIndexSnapshot(db, {
        id: "pidx_pending",
        projectId: "proj_jarvis",
        startedAt: 2_001,
        sourcesSeen: 0,
        artifactsExtracted: 0,
        triggeredBy: "manual",
        status: "pending",
      }),
    ).toThrow();
  });

  it("sources_seen can be based on known source rows without content fields", () => {
    insertProjectSource(db, {
      id: "psrc_1",
      projectId: "proj_jarvis",
      kind: "thread",
      ref: "thread:phase-5-a4",
    });

    const sourceCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM project_source WHERE project_id = ?",
      )
      .get("proj_jarvis") as { count: number };
    const row = insertProjectIndexSnapshot(db, {
      id: "pidx_count",
      projectId: "proj_jarvis",
      startedAt: 2_000,
      finishedAt: 2_000,
      sourcesSeen: sourceCount.count,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "completed",
    });

    expect(row.sources_seen).toBe(1);
    expect(row.artifacts_extracted).toBe(0);
  });
});
