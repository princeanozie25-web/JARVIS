import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  addPreference,
  createGoal,
  createSession,
  createSessionSummary,
  listTelemetryEvents,
  upsertProjectState,
} from "../db/node";
import { applyMigrations } from "../db/schema";
import { readTimelineIndex, TIMELINE_PROJECTION_NOTICE } from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function accessContext(purpose = "test_timeline") {
  return {
    caller: "timeline.test",
    feature_id: "timeline" as const,
    purpose,
    personal_context: true,
  };
}

function enable(featureId: "timeline" | "goals" | "preferences") {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId,
    enabled: true,
    now: () => 1_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-timeline-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("TimelineIndex", () => {
  it("blocks timeline reads when timeline consent is disabled", () => {
    expect(
      readTimelineIndex(db, { manifestPath, accessContext: accessContext() }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "timeline",
      reason: "consent_disabled",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("projects session summaries as non-transcript timeline entries", () => {
    enable("timeline");
    createSession(db, "session-1", 1_000);
    createSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "User asked to keep Phase 3D scoped.",
      coveredMessageCount: 10,
      createdAt: 2_000,
      updatedAt: 3_000,
    });

    const result = readTimelineIndex(db, {
      manifestPath,
      accessContext: accessContext(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("timeline read blocked");
    expect(result.entries).toEqual([
      expect.objectContaining({
        type: "session_summary",
        title: "Session summary session-1",
        summary: "User asked to keep Phase 3D scoped.",
        timestamp: 3_000,
        source_label: "Session summary projection",
        projection_notice: TIMELINE_PROJECTION_NOTICE,
      }),
    ]);
  });

  it("projects project_state and supports project filtering", () => {
    enable("timeline");
    upsertProjectState(db, {
      projectId: "jarvis",
      projectName: "JARVIS",
      lastActionSummary: "Finished goal continuity.",
      updatedAt: 4_000,
    });
    upsertProjectState(db, {
      projectId: "other",
      projectName: "Other",
      lastActionSummary: "Different project.",
      updatedAt: 5_000,
    });

    const result = readTimelineIndex(db, {
      manifestPath,
      type: "project_state",
      project: "jarvis",
      accessContext: accessContext(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("timeline read blocked");
    expect(result.entries.map((entry) => entry.source_id)).toEqual(["jarvis"]);
    expect(result.entries[0]).toMatchObject({
      type: "project_state",
      title: "JARVIS",
      summary: "Finished goal continuity.",
      source_label: "Project state projection",
    });
  });

  it("excludes goals and preferences unless their own consent is enabled", () => {
    enable("timeline");
    enable("goals");
    enable("preferences");
    createGoal(db, {
      manifestPath,
      id: "goal-1",
      title: "Keep scope narrow.",
      createdAt: 2_000,
    });
    addPreference(db, {
      manifestPath,
      id: "pref-1",
      key: "tone",
      value: "Concise.",
      category: "communication",
      createdAt: 3_000,
    });
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "goals",
      enabled: false,
      now: () => 4_000,
    });
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "preferences",
      enabled: false,
      now: () => 5_000,
    });

    const excluded = readTimelineIndex(db, {
      manifestPath,
      accessContext: accessContext(),
    });
    expect(excluded.ok).toBe(true);
    if (!excluded.ok) throw new Error("timeline read blocked");
    expect(excluded.entries.map((entry) => entry.type)).not.toContain("goal");
    expect(excluded.entries.map((entry) => entry.type)).not.toContain(
      "preference",
    );

    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "goals",
      enabled: true,
      now: () => 6_000,
    });
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "preferences",
      enabled: true,
      now: () => 7_000,
    });

    const included = readTimelineIndex(db, {
      manifestPath,
      accessContext: accessContext(),
    });
    expect(included.ok).toBe(true);
    if (!included.ok) throw new Error("timeline read blocked");
    expect(included.entries.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(["goal", "preference"]),
    );
  });

  it("orders entries by timestamp descending and bounds limit", () => {
    enable("timeline");
    createSession(db, "session-1", 1_000);
    for (let index = 0; index < 205; index += 1) {
      createSessionSummary(db, {
        sessionId: "session-1",
        summaryText: `Summary ${index}`,
        coveredMessageCount: index,
        createdAt: 2_000 + index,
        updatedAt: 2_000 + index,
      });
    }

    const result = readTimelineIndex(db, {
      manifestPath,
      limit: 500,
      accessContext: accessContext(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("timeline read blocked");
    expect(result.entries).toHaveLength(200);
    expect(result.entries[0]?.timestamp).toBeGreaterThan(
      result.entries[199]?.timestamp ?? 0,
    );
  });

  it("emits timeline telemetry", () => {
    enable("timeline");

    readTimelineIndex(db, {
      manifestPath,
      now: () => 9_000,
      accessContext: accessContext(),
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["timeline_read", "timeline_projected"]),
    );
  });
});
