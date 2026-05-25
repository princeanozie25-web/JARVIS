import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { initializeEventStore } from "../../src/store/event-store";

const tempDirs: string[] = [];

const APPEND_ONLY_TABLES = [
  "events",
  "room_events",
  "telemetry_events",
  "replay_traces",
  "runtime_executions",
  "approval_lifecycle",
  "routine_suggestions",
  "model_calls",
] as const;

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-append-only-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function openRaw(path: string) {
  return new Database(path);
}

function initializedPath() {
  const path = databasePath();
  const store = initializeEventStore({ databasePath: path });
  store.close();
  return path;
}

function seedAllEventTables(db: Database.Database) {
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 1, 'append-only-test', '{}', NULL, 1, 1)
    `,
  ).run("event-room", "room");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 2, 'append-only-test', '{}', NULL, 1, 2)
    `,
  ).run("event-telemetry", "telemetry");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 3, 'append-only-test', '{}', NULL, 1, 3)
    `,
  ).run("event-replay", "replay");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 4, 'append-only-test', '{}', NULL, 1, 4)
    `,
  ).run("event-runtime", "runtime");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 5, 'append-only-test', '{}', NULL, 1, 5)
    `,
  ).run("event-approval", "approval");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 6, 'append-only-test', '{}', NULL, 1, 6)
    `,
  ).run("event-routine", "routine");
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, 7, 'append-only-test', '{}', NULL, 1, 7)
    `,
  ).run("event-model", "model");

  db.prepare(
    `
      INSERT INTO room_events (
        room_event_id,
        event_id,
        room_id,
        metadata_only
      ) VALUES ('room-row', 'event-room', 'bedroom-workspace', 1)
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO telemetry_events (
        telemetry_event_id,
        event_id,
        telemetry_scope,
        severity,
        metadata_only
      ) VALUES ('telemetry-row', 'event-telemetry', 'runtime', 'info', 1)
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO replay_traces (
        replay_trace_id,
        event_id,
        trace_kind,
        replay_metadata_json,
        raw_payload_retained
      ) VALUES ('replay-row', 'event-replay', 'metadata', '{}', 0)
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO runtime_executions (
        runtime_execution_id,
        event_id,
        runtime_kind,
        status,
        authority_surface
      ) VALUES ('runtime-row', 'event-runtime', 'fake', 'planned', 'local')
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO approval_lifecycle (
        approval_event_id,
        event_id,
        approval_id,
        lifecycle_state,
        auto_approval
      ) VALUES ('approval-row', 'event-approval', 'approval-1', 'requested', 0)
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO routine_suggestions (
        routine_suggestion_id,
        event_id,
        suggestion_status,
        executes_action
      ) VALUES ('routine-row', 'event-routine', 'suggested', 0)
    `,
  ).run();
  db.prepare(
    `
      INSERT INTO model_calls (
        model_call_id,
        event_id,
        provider_id,
        model_id,
        cloud_call,
        prompt_payload_retained
      ) VALUES ('model-row', 'event-model', 'fake', 'fake-model', 0, 0)
    `,
  ).run();
}

describe("Phase 11A.2 append-only invariant", () => {
  it.each(APPEND_ONLY_TABLES)("%s rejects UPDATE", (table) => {
    const path = initializedPath();
    const raw = openRaw(path);
    seedAllEventTables(raw);

    expect(() =>
      raw.prepare(`UPDATE ${table} SET rowid = rowid WHERE rowid = 1`).run(),
    ).toThrow("append-only");

    raw.close();
  });

  it.each(APPEND_ONLY_TABLES)("%s rejects DELETE", (table) => {
    const path = initializedPath();
    const raw = openRaw(path);
    seedAllEventTables(raw);

    expect(() =>
      raw.prepare(`DELETE FROM ${table} WHERE rowid = 1`).run(),
    ).toThrow("append-only");

    raw.close();
  });

  it("append helper only inserts scaffold events", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });

    store.appendEvent({
      eventId: "event-append-only",
      eventType: "scaffold",
      occurredAtMs: 1,
      source: "test",
    });
    store.close();

    const raw = openRaw(path);
    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM events").get(),
    ).toMatchObject({ count: 1 });
    expect(
      raw
        .prepare("SELECT event_id, payload_json, local_only FROM events")
        .get(),
    ).toEqual({
      event_id: "event-append-only",
      payload_json: null,
      local_only: 1,
    });
    raw.close();
  });

  it("public event store API exposes no raw update/delete/truncate/exec helpers", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const keys = Object.keys(store);

    expect(keys).toEqual([
      "appendEvent",
      "appendRoomEvent",
      "appendModelCall",
      "inspectMigrations",
      "inspectSchema",
      "close",
    ]);
    expect(
      keys.some((key) =>
        /update|delete|truncate|exec|run|prepare|raw|db/i.test(key),
      ),
    ).toBe(false);
    expect("db" in store).toBe(false);
    expect("database" in store).toBe(false);

    store.close();
  });

  it("migration metadata inspection is read-only and defensive", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const first = store.inspectMigrations();
    (first[0] as { name: string }).name = "mutated-from-test";

    expect(store.inspectMigrations()[0]).toMatchObject({
      version: 1,
      name: "0001_init.sql",
      applied_at_ms: 1,
    });

    store.close();
  });

  it("event IDs are immutable after append", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    store.appendEvent({
      eventId: "event-immutable",
      eventType: "scaffold",
      occurredAtMs: 1,
      source: "test",
    });
    store.close();

    const raw = openRaw(path);
    expect(() =>
      raw
        .prepare("UPDATE events SET event_id = ? WHERE event_id = ?")
        .run("event-mutated", "event-immutable"),
    ).toThrow("append-only");
    expect(raw.prepare("SELECT event_id FROM events").get()).toMatchObject({
      event_id: "event-immutable",
    });
    raw.close();
  });

  it("schema_migrations cannot be modified through public event store APIs", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const keys = Object.keys(store);

    expect(keys).not.toContain("appendMigration");
    expect(keys).not.toContain("updateMigration");
    expect(keys).not.toContain("deleteMigration");
    expect(keys).not.toContain("run");
    expect(store.inspectMigrations()).toHaveLength(1);

    store.close();
  });
});
