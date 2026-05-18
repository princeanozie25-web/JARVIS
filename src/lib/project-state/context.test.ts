import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import { upsertProjectState } from "../db/project-state";
import { detectProjectContext } from "./context";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("detectProjectContext", () => {
  it("uses an explicit project field first", () => {
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "State exists.",
      now: () => 1_000,
    });

    expect(
      detectProjectContext(db, {
        explicitProject: "JARVIS",
        text: "This text does not matter.",
        now: () => 2_000,
      }),
    ).toEqual({
      projectId: "jarvis",
      projectName: "JARVIS",
      source: "explicit",
    });
  });

  it("falls back to project name keyword matching", () => {
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "State exists.",
      now: () => 1_000,
    });

    expect(
      detectProjectContext(db, {
        text: "Continue the JARVIS project_state foundation.",
        now: () => 2_000,
      }),
    ).toEqual({
      projectId: "jarvis",
      projectName: "JARVIS",
      source: "keyword",
    });
  });

  it("returns null when there is no explicit or keyword match", () => {
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "State exists.",
      now: () => 1_000,
    });

    expect(
      detectProjectContext(db, {
        text: "Talk about something unrelated.",
        now: () => 2_000,
      }),
    ).toBeNull();
  });

  it("emits project context telemetry when detected", () => {
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "State exists.",
      now: () => 1_000,
    });

    detectProjectContext(db, {
      text: "JARVIS should be detected.",
      now: () => 2_000,
    });

    expect(
      listTelemetryEvents(db).some(
        (event) => event.event_type === "project_context_detected",
      ),
    ).toBe(true);
  });
});
