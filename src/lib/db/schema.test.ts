import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMessage, listMessages } from "./messages";
import { applyMigrations } from "./schema";
import {
  createSession,
  getSession,
  listSessions,
  touchSession,
} from "./sessions";
import { insertTelemetryEvent, listTelemetryEvents } from "./telemetry";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("sessions", () => {
  it("creates and retrieves a session", () => {
    const created = createSession(db, "s1", 1_000);
    expect(created).toEqual({ id: "s1", created_at: 1_000, updated_at: 1_000 });
    expect(getSession(db, "s1")).toEqual(created);
  });

  it("touchSession updates updated_at without touching created_at", () => {
    createSession(db, "s1", 1_000);
    touchSession(db, "s1", 5_000);
    const row = getSession(db, "s1");
    expect(row?.created_at).toBe(1_000);
    expect(row?.updated_at).toBe(5_000);
  });

  it("listSessions returns most-recently-updated first", () => {
    createSession(db, "old", 1_000);
    createSession(db, "new", 2_000);
    touchSession(db, "old", 3_000);
    expect(listSessions(db).map((s) => s.id)).toEqual(["old", "new"]);
  });
});

describe("messages", () => {
  it("appends and lists messages in insertion order", () => {
    createSession(db, "s1", 1_000);
    appendMessage(db, {
      id: "m1",
      session_id: "s1",
      role: "user",
      content: "hi",
      created_at: 1_001,
    });
    appendMessage(db, {
      id: "m2",
      session_id: "s1",
      role: "assistant",
      content: "hello",
      created_at: 1_002,
    });
    const rows = listMessages(db, "s1");
    expect(rows.map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(rows[0]?.role).toBe("user");
  });

  it("cascades delete when session is removed", () => {
    createSession(db, "s1", 1_000);
    appendMessage(db, {
      id: "m1",
      session_id: "s1",
      role: "user",
      content: "hi",
      created_at: 1_001,
    });
    db.prepare("DELETE FROM sessions WHERE id = ?").run("s1");
    expect(listMessages(db, "s1")).toEqual([]);
  });
});

describe("telemetry_events", () => {
  it("inserts and lists telemetry events newest first", () => {
    insertTelemetryEvent(db, {
      timestamp: 1_000,
      event_type: "model_call",
      success: true,
      model_id: "gpt-4o-mini",
      input_tokens: 123,
      output_tokens: 45,
      latency_ms: 250,
      time_to_first_token_ms: 80,
      cost_usd: 0.0001,
      notes: "ok",
    });
    insertTelemetryEvent(db, {
      timestamp: 2_000,
      event_type: "rate_limited",
      success: false,
      notes: "throttle",
    });
    const rows = listTelemetryEvents(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.event_type).toBe("rate_limited");
    expect(rows[0]?.success).toBe(0);
    expect(rows[1]?.event_type).toBe("model_call");
    expect(rows[1]?.success).toBe(1);
    expect(rows[1]?.input_tokens).toBe(123);
    expect(rows[1]?.output_tokens).toBe(45);
    expect(rows[1]?.cost_usd).toBeCloseTo(0.0001);
  });
});
