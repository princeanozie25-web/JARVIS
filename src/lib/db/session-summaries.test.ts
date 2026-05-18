import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSession } from "./sessions";
import { applyMigrations } from "./schema";
import {
  computeSessionSummaryHash,
  createSessionSummary,
  deleteSessionSummary,
  getLatestSessionSummary,
  getSessionSummary,
  listSessionSummaries,
  saveSessionSummary,
  updateSessionSummary,
} from "./session-summaries";
import { listTelemetryEvents } from "./telemetry";

let db: Database.Database;

function tableNames(): string[] {
  return db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       ORDER BY name`,
    )
    .all()
    .map((row) => (row as { name: string }).name);
}

function columnNames(tableName: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("session_summaries schema", () => {
  it("creates the session summary table", () => {
    expect(tableNames()).toContain("session_summaries");
    expect(columnNames("session_summaries")).toEqual([
      "session_id",
      "summary_text",
      "previous_summary_hash",
      "summary_hash",
      "covered_message_count",
      "created_at",
      "updated_at",
    ]);
  });
});

describe("session summary CRUD helpers", () => {
  it("creates, reads, lists, updates, and deletes a summary", () => {
    const created = createSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Initial summary.",
      coveredMessageCount: 4,
      createdAt: 2_000,
    });

    expect(getSessionSummary(db, created.summary_hash)).toEqual(created);
    expect(listSessionSummaries(db, { sessionId: "session-1" })).toEqual([
      created,
    ]);

    const updated = updateSessionSummary(db, created.summary_hash, {
      summaryText: "Updated summary.",
      coveredMessageCount: 5,
      updatedAt: 3_000,
    });

    expect(updated).toMatchObject({
      session_id: "session-1",
      summary_text: "Updated summary.",
      covered_message_count: 5,
      created_at: 2_000,
      updated_at: 3_000,
    });
    expect(updated?.summary_hash).not.toBe(created.summary_hash);
    expect(getLatestSessionSummary(db, "session-1")).toEqual(updated);

    expect(deleteSessionSummary(db, updated!.summary_hash)).toBe(true);
    expect(getLatestSessionSummary(db, "session-1")).toBeUndefined();
  });
});

describe("saveSessionSummary", () => {
  it("saves a session summary and retrieves it as latest", () => {
    const saved = saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Prince configured JARVIS memory recall.",
      coveredMessageCount: 12,
      now: () => 4_000,
    });

    expect(saved).toMatchObject({
      session_id: "session-1",
      summary_text: "Prince configured JARVIS memory recall.",
      previous_summary_hash: null,
      covered_message_count: 12,
      created_at: 4_000,
      updated_at: 4_000,
    });
    expect(getLatestSessionSummary(db, "session-1")).toEqual(saved);
  });

  it("updates the latest summary by saving a new lineage row", () => {
    const first = saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "First summary.",
      coveredMessageCount: 3,
      now: () => 2_000,
    });
    const second = saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Second summary.",
      coveredMessageCount: 8,
      now: () => 3_000,
    });

    expect(getLatestSessionSummary(db, "session-1")).toEqual(second);
    expect(second.previous_summary_hash).toBe(first.summary_hash);
    expect(listSessionSummaries(db, { sessionId: "session-1" })).toEqual([
      second,
      first,
    ]);
  });

  it("includes previous summary hash in lineage hashing", () => {
    const base = computeSessionSummaryHash({
      sessionId: "session-1",
      summaryText: "Same summary text.",
      previousSummaryHash: null,
      coveredMessageCount: 2,
    });
    const chained = computeSessionSummaryHash({
      sessionId: "session-1",
      summaryText: "Same summary text.",
      previousSummaryHash: base,
      coveredMessageCount: 2,
    });

    expect(base).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(chained).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(chained).not.toBe(base);
  });

  it("emits session_summary_saved telemetry without raw summary text", () => {
    const saved = saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Do not put this raw text in telemetry.",
      coveredMessageCount: 9,
      now: () => 5_000,
    });

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "session_summary_saved",
    );
    expect(event).toMatchObject({
      timestamp: 5_000,
      success: 1,
      session_id: "session-1",
    });
    expect(event?.notes).toContain(`summary_hash=${saved.summary_hash}`);
    expect(event?.notes).toContain("previous_summary_hash=none");
    expect(event?.notes).toContain("covered_message_count=9");
    expect(event?.notes).not.toContain("Do not put this raw text");
  });
});
