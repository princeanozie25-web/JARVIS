import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectBlocker,
  getProjectDecision,
  getProjectTask,
  insertProjectBlocker,
  insertProjectDecision,
  insertProjectTask,
  insertProjectThread,
  listProjectBlockers,
  listProjectDecisions,
  listProjectTasks,
  listProjectThreads,
} from "./project-artifacts";
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

describe("project derived artifact persistence", () => {
  it("creates derived artifact fixture rows with required origin refs", () => {
    const thread = insertProjectThread(db, {
      id: "pth_1",
      projectId: "proj_jarvis",
      title: "Phase 5",
      status: "open",
      firstSeenAt: 2_000,
      lastActiveAt: 2_100,
      originRef: "thread:phase-5",
    });
    const task = insertProjectTask(db, {
      id: "ptask_1",
      projectId: "proj_jarvis",
      threadId: "pth_1",
      title: "Keep indexing metadata-only",
      status: "extracted",
      confidence: 0.7,
      originRef: "thread:phase-5",
      createdAt: 2_000,
      updatedAt: 2_100,
    });
    const blocker = insertProjectBlocker(db, {
      id: "pblk_1",
      projectId: "proj_jarvis",
      taskId: "ptask_1",
      description: "Waiting for future extraction slice",
      status: "open",
      originRef: "thread:phase-5",
    });
    const decision = insertProjectDecision(db, {
      id: "pdec_1",
      projectId: "proj_jarvis",
      summary: "A6 remains schema-only",
      decidedAt: null,
      originRef: "thread:phase-5",
    });

    expect(thread.origin_ref).toBe("thread:phase-5");
    expect(task).toMatchObject({
      promoted: 0,
      confidence: 0.7,
      origin_ref: "thread:phase-5",
    });
    expect(blocker.origin_ref).toBe("thread:phase-5");
    expect(decision.origin_ref).toBe("thread:phase-5");
    expect(listProjectThreads(db, "proj_jarvis")).toHaveLength(1);
    expect(listProjectTasks(db, "proj_jarvis")).toHaveLength(1);
    expect(listProjectBlockers(db, "proj_jarvis")).toHaveLength(1);
    expect(listProjectDecisions(db, "proj_jarvis")).toHaveLength(1);
  });

  it("enforces project_id foreign keys for all artifact rows", () => {
    expect(() =>
      insertProjectThread(db, {
        id: "pth_missing",
        projectId: "proj_missing",
        title: "Missing",
        status: "open",
        firstSeenAt: 2_000,
        lastActiveAt: 2_000,
        originRef: "thread:missing",
      }),
    ).toThrow();
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_missing",
        projectId: "proj_missing",
        title: "Missing",
        status: "open",
        confidence: 1,
        originRef: "thread:missing",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow();
    expect(() =>
      insertProjectBlocker(db, {
        id: "pblk_missing",
        projectId: "proj_missing",
        description: "Missing",
        status: "open",
        originRef: "thread:missing",
      }),
    ).toThrow();
    expect(() =>
      insertProjectDecision(db, {
        id: "pdec_missing",
        projectId: "proj_missing",
        summary: "Missing",
        originRef: "thread:missing",
      }),
    ).toThrow();
  });

  it("enforces thread_id and task_id foreign key behavior", () => {
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_bad_thread",
        projectId: "proj_jarvis",
        threadId: "pth_missing",
        title: "Bad thread",
        status: "open",
        confidence: 0.5,
        originRef: "thread:phase-5",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow();

    insertProjectThread(db, {
      id: "pth_1",
      projectId: "proj_jarvis",
      title: "Phase 5",
      status: "open",
      firstSeenAt: 2_000,
      lastActiveAt: 2_000,
      originRef: "thread:phase-5",
    });
    insertProjectTask(db, {
      id: "ptask_1",
      projectId: "proj_jarvis",
      threadId: "pth_1",
      title: "Task",
      status: "open",
      confidence: 0.5,
      originRef: "thread:phase-5",
      createdAt: 2_000,
      updatedAt: 2_000,
    });
    expect(() =>
      insertProjectBlocker(db, {
        id: "pblk_bad_task",
        projectId: "proj_jarvis",
        taskId: "ptask_missing",
        description: "Bad task",
        status: "open",
        originRef: "thread:phase-5",
      }),
    ).toThrow();
    insertProjectBlocker(db, {
      id: "pblk_1",
      projectId: "proj_jarvis",
      taskId: "ptask_1",
      description: "Blocker",
      status: "open",
      originRef: "thread:phase-5",
    });

    db.prepare("DELETE FROM project_thread WHERE id = ?").run("pth_1");
    expect(getProjectTask(db, "ptask_1")?.thread_id).toBeNull();
    db.prepare("DELETE FROM project_task WHERE id = ?").run("ptask_1");
    expect(getProjectBlocker(db, "pblk_1")?.task_id).toBeNull();
  });

  it("requires origin_ref on every artifact accessor", () => {
    expect(() =>
      insertProjectThread(db, {
        id: "pth_no_origin",
        projectId: "proj_jarvis",
        title: "No origin",
        status: "open",
        firstSeenAt: 2_000,
        lastActiveAt: 2_000,
        originRef: " ",
      }),
    ).toThrow("originRef is required");
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_no_origin",
        projectId: "proj_jarvis",
        title: "No origin",
        status: "open",
        confidence: 0.5,
        originRef: " ",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow("originRef is required");
    expect(() =>
      insertProjectBlocker(db, {
        id: "pblk_no_origin",
        projectId: "proj_jarvis",
        description: "No origin",
        status: "open",
        originRef: " ",
      }),
    ).toThrow("originRef is required");
    expect(() =>
      insertProjectDecision(db, {
        id: "pdec_no_origin",
        projectId: "proj_jarvis",
        summary: "No origin",
        originRef: " ",
      }),
    ).toThrow("originRef is required");
  });

  it("validates allowed artifact statuses and rejects invalid statuses", () => {
    for (const status of ["open", "resolved", "stale"] as const) {
      insertProjectThread(db, {
        id: `pth_${status}`,
        projectId: "proj_jarvis",
        title: status,
        status,
        firstSeenAt: 2_000,
        lastActiveAt: 2_000,
        originRef: `thread:${status}`,
      });
    }
    for (const status of [
      "extracted",
      "open",
      "in_progress",
      "blocked",
      "done",
      "dismissed",
    ] as const) {
      insertProjectTask(db, {
        id: `ptask_${status}`,
        projectId: "proj_jarvis",
        title: status,
        status,
        confidence: 1,
        originRef: `thread:${status}`,
        createdAt: 2_000,
        updatedAt: 2_000,
      });
    }
    for (const status of ["open", "cleared"] as const) {
      insertProjectBlocker(db, {
        id: `pblk_${status}`,
        projectId: "proj_jarvis",
        description: status,
        status,
        originRef: `thread:${status}`,
      });
    }

    expect(() =>
      insertProjectThread(db, {
        id: "pth_bad",
        projectId: "proj_jarvis",
        title: "Bad",
        status: "active" as "open",
        firstSeenAt: 2_000,
        lastActiveAt: 2_000,
        originRef: "thread:bad",
      }),
    ).toThrow();
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_bad",
        projectId: "proj_jarvis",
        title: "Bad",
        status: "queued" as "open",
        confidence: 1,
        originRef: "thread:bad",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow();
    expect(() =>
      insertProjectBlocker(db, {
        id: "pblk_bad",
        projectId: "proj_jarvis",
        description: "Bad",
        status: "blocked" as "open",
        originRef: "thread:bad",
      }),
    ).toThrow();
  });

  it("enforces confidence bounds and keeps tasks unpromoted by default", () => {
    insertProjectTask(db, {
      id: "ptask_default",
      projectId: "proj_jarvis",
      title: "Default promotion",
      status: "extracted",
      confidence: 0,
      originRef: "thread:phase-5",
      createdAt: 2_000,
      updatedAt: 2_000,
    });

    expect(getProjectTask(db, "ptask_default")?.promoted).toBe(0);
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_low",
        projectId: "proj_jarvis",
        title: "Low",
        status: "extracted",
        confidence: -0.1,
        originRef: "thread:phase-5",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow("confidence must be between 0 and 1");
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_high",
        projectId: "proj_jarvis",
        title: "High",
        status: "extracted",
        confidence: 1.1,
        originRef: "thread:phase-5",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow("confidence must be between 0 and 1");
    expect(() =>
      insertProjectTask(db, {
        id: "ptask_promoted",
        projectId: "proj_jarvis",
        title: "Promoted",
        status: "extracted",
        confidence: 0.9,
        promoted: true,
        originRef: "thread:phase-5",
        createdAt: 2_000,
        updatedAt: 2_000,
      }),
    ).toThrow("project tasks must not be auto-promoted");
  });

  it("returns inserted decisions without requiring decided_at", () => {
    insertProjectDecision(db, {
      id: "pdec_pending",
      projectId: "proj_jarvis",
      summary: "Decision not dated yet",
      originRef: "thread:phase-5",
    });

    expect(getProjectDecision(db, "pdec_pending")).toMatchObject({
      id: "pdec_pending",
      decided_at: null,
      origin_ref: "thread:phase-5",
    });
  });
});
