import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectState,
  listProjectStates,
  upsertProjectState,
} from "./project-state";
import { applyMigrations } from "./schema";
import { createSession } from "./sessions";
import { listTelemetryEvents } from "./telemetry";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("project_state persistence", () => {
  it("upserts and reads project state", () => {
    const created = upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastSessionId: "session-1",
      lastActionSummary: "Finished Phase 3C.4 working memory scaffold.",
      openThreads: ["Phase 3C.5"],
      nextIntendedStep: "Add project state persistence.",
      now: () => 2_000,
    });

    expect(created).toMatchObject({
      project_id: "jarvis",
      project_name: "JARVIS",
      last_session_id: "session-1",
      last_action_summary: "Finished Phase 3C.4 working memory scaffold.",
      next_intended_step: "Add project state persistence.",
      updated_at: 2_000,
    });
    expect(JSON.parse(created.open_threads_json)).toEqual(["Phase 3C.5"]);

    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "Updated state manually.",
      openThreadsJson: JSON.stringify(["UI panel"]),
      now: () => 3_000,
    });

    const row = getProjectState(db, "jarvis", { now: () => 4_000 });
    expect(row?.last_action_summary).toBe("Updated state manually.");
    expect(row?.last_session_id).toBeNull();
    expect(row?.updated_at).toBe(3_000);
    expect(JSON.parse(row?.open_threads_json ?? "[]")).toEqual(["UI panel"]);
  });

  it("lists project states by most recent update", () => {
    upsertProjectState(db, {
      projectId: "older",
      projectName: "Older",
      lastActionSummary: "Older state",
      now: () => 2_000,
    });
    upsertProjectState(db, {
      projectId: "newer",
      projectName: "Newer",
      lastActionSummary: "Newer state",
      now: () => 3_000,
    });

    expect(
      listProjectStates(db, { now: () => 4_000 }).map((row) => row.project_id),
    ).toEqual(["newer", "older"]);
  });

  it("emits save and read telemetry", () => {
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastSessionId: "session-1",
      lastActionSummary: "Saved state.",
      now: () => 2_000,
    });
    getProjectState(db, "jarvis", { now: () => 3_000 });
    listProjectStates(db, { now: () => 4_000 });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual([
      "project_state_read",
      "project_state_read",
      "project_state_saved",
    ]);
  });
});
