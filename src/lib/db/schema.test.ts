import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consumeApproval,
  getActiveApproval,
  recordApproval,
} from "./approvals";
import { appendMessage, listMessages } from "./messages";
import { listRollbacks, recordRollback } from "./rollbacks";
import { applyMigrations, listSchemaMigrations } from "./schema";
import {
  createSession,
  getSession,
  listSessions,
  touchSession,
} from "./sessions";
import { insertTelemetryEvent, listTelemetryEvents } from "./telemetry";
import { createToolCall, listToolCalls, updateToolCall } from "./tool-calls";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

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

describe("schema", () => {
  it("creates Phase 2 tool audit tables and telemetry execution ids", () => {
    expect(tableNames()).toEqual(
      expect.arrayContaining([
        "approvals",
        "_schema_migrations",
        "long_term_memory",
        "long_term_memory_fts",
        "memory_embeddings",
        "memory_candidates",
        "project_state",
        "preferences",
        "reflective_memory",
        "rollbacks",
        "semantic_memory",
        "session_summaries",
        "telemetry_events",
        "tool_calls",
      ]),
    );
    expect(columnNames("telemetry_events")).toContain("execution_id");
    expect(columnNames("long_term_memory")).toEqual([
      "id",
      "category",
      "content",
      "source",
      "source_id",
      "project",
      "tags_json",
      "sensitivity",
      "created_at",
      "updated_at",
      "obsidian_path",
      "hash",
      "status",
    ]);
    expect(columnNames("project_state")).toEqual([
      "project_id",
      "project_name",
      "last_session_id",
      "last_action_summary",
      "open_threads_json",
      "next_intended_step",
      "updated_at",
    ]);
    expect(columnNames("memory_candidates")).toEqual([
      "id",
      "session_id",
      "source_message_ids_json",
      "proposed_category",
      "proposed_content",
      "proposed_tags_json",
      "proposed_sensitivity",
      "rationale",
      "status",
      "created_at",
      "reviewed_at",
    ]);
    expect(columnNames("preferences")).toEqual([
      "id",
      "key",
      "value",
      "category",
      "source",
      "effective_from",
      "supersedes_id",
      "created_at",
    ]);
  });

  it("tracks applied schema migrations", () => {
    expect(listSchemaMigrations(db).map((row) => row.id)).toEqual([
      "001_initial_schema",
      "002_telemetry_execution_id",
      "003_approval_lifecycle",
      "004_memory_foundation",
      "005_memory_fts",
      "006_session_summaries",
      "007_project_state",
      "008_memory_candidates",
      "009_preferences",
    ]);
  });
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
      execution_id: "exec-1",
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
    expect(rows[1]?.execution_id).toBe("exec-1");
  });
});

describe("tool_calls", () => {
  it("creates, updates, and lists tool calls newest first", () => {
    createToolCall(db, {
      execution_id: "exec-old",
      session_id: "s1",
      tool_id: "mock.status",
      tool_name: "Mock Status",
      status: "PENDING",
      safety_tag: "ALLOW",
      required_safety_tag: "ALLOW",
      scope_hash: "scope",
      input_json: '{"echo":"old"}',
      proposed_at: 1_000,
      timeout_ms: 1_000,
    });
    createToolCall(db, {
      execution_id: "exec-new",
      session_id: "s1",
      tool_id: "mock.status",
      tool_name: "Mock Status",
      status: "PENDING",
      safety_tag: "ALLOW",
      required_safety_tag: "ALLOW",
      scope_hash: "scope",
      input_json: '{"echo":"new"}',
      proposed_at: 2_000,
      timeout_ms: 1_000,
    });

    updateToolCall(db, "exec-new", {
      status: "COMPLETED",
      output_json: '{"ok":true}',
      completed_at: 2_050,
    });

    const rows = listToolCalls(db, { sessionId: "s1" });
    expect(rows.map((row) => row.execution_id)).toEqual([
      "exec-new",
      "exec-old",
    ]);
    expect(rows[0]?.status).toBe("COMPLETED");
    expect(rows[0]?.output_json).toBe('{"ok":true}');
    expect(rows[0]?.completed_at).toBe(2_050);
  });
});

describe("approvals", () => {
  it("records, looks up, and consumes approvals", () => {
    recordApproval(db, {
      id: "approval-1",
      execution_id: "exec-1",
      session_id: "s1",
      tool_id: "mock.status",
      scope_hash: "scope",
      decision: "APPROVED_ONCE",
      decided_at: 1_000,
      expires_at: 2_000,
    });

    const active = getActiveApproval(db, {
      sessionId: "s1",
      toolId: "mock.status",
      scopeHash: "scope",
      at: 1_500,
    });
    expect(active?.id).toBe("approval-1");
    expect(active?.execution_id).toBe("exec-1");

    consumeApproval(db, "approval-1", 1_600);
    expect(
      getActiveApproval(db, {
        sessionId: "s1",
        toolId: "mock.status",
        scopeHash: "scope",
        at: 1_700,
      }),
    ).toBeUndefined();
  });
});

describe("rollbacks", () => {
  it("records and lists rollbacks newest first", () => {
    recordRollback(db, {
      id: "rollback-old",
      execution_id: "exec-old",
      session_id: "s1",
      kind: "fs_unlink_created",
      payload_json: '{"path":"a.txt"}',
      created_at: 1_000,
    });
    recordRollback(db, {
      id: "rollback-new",
      execution_id: "exec-new",
      session_id: "s1",
      kind: "fs_restore_content",
      payload_json: '{"path":"b.txt"}',
      created_at: 2_000,
    });

    const rows = listRollbacks(db, { sessionId: "s1" });
    expect(rows.map((row) => row.id)).toEqual(["rollback-new", "rollback-old"]);
    expect(rows[0]?.kind).toBe("fs_restore_content");
  });
});
