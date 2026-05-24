import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_STORE_SCHEMA_VERSION,
  EXPECTED_EVENT_STORE_TABLES,
  initializeEventStore,
  loadDefaultEventStoreMigrations,
  migrationChecksum,
  type EventStoreMigration,
} from "../../src/store/event-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath(name = "jarvis-events.sqlite") {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-event-store-"));
  tempDirs.push(dir);
  return join(dir, name);
}

function openRaw(path: string) {
  return new Database(path);
}

describe("Phase 11A.1 SQLite event store migrations", () => {
  it("runs migrations successfully on a clean local database", () => {
    const store = initializeEventStore({ databasePath: databasePath() });

    expect(store.inspectMigrations()).toEqual([
      {
        version: 1,
        name: "0001_init.sql",
        checksum: migrationChecksum(
          readFileSync("db/migrations/0001_init.sql", "utf8"),
        ),
        applied_at_ms: 1,
      },
    ]);

    store.close();
  });

  it("schema introspection matches expected append-only tables", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const schema = store.inspectSchema();

    expect(schema.tables).toEqual(EXPECTED_EVENT_STORE_TABLES);
    expect(schema.userVersion).toBe(EVENT_STORE_SCHEMA_VERSION);
    expect(schema.triggers).toEqual(
      expect.arrayContaining([
        "events_no_delete",
        "events_no_update",
        "room_events_no_delete",
        "room_events_no_update",
        "model_calls_no_delete",
        "model_calls_no_update",
      ]),
    );

    store.close();
  });

  it("enables WAL mode for local embedded SQLite", () => {
    const store = initializeEventStore({ databasePath: databasePath() });

    expect(store.inspectSchema().journalMode).toBe("wal");

    store.close();
  });

  it("applies migrations deterministically across clean databases", () => {
    const first = initializeEventStore({ databasePath: databasePath("a.db") });
    const second = initializeEventStore({ databasePath: databasePath("b.db") });

    expect(first.inspectMigrations()).toEqual(second.inspectMigrations());
    expect(first.inspectSchema()).toEqual(second.inspectSchema());

    first.close();
    second.close();
  });

  it("enforces migration ordering before opening authority surface", () => {
    const migrations: EventStoreMigration[] = [
      {
        version: 2,
        name: "0002_bad.sql",
        sql: "CREATE TABLE bad_two(id TEXT);",
      },
      {
        version: 1,
        name: "0001_bad.sql",
        sql: "CREATE TABLE bad_one(id TEXT);",
      },
    ];

    expect(() =>
      initializeEventStore({
        databasePath: databasePath(),
        migrations,
      }),
    ).toThrow("contiguous and ordered");
  });

  it("fails closed on corrupted migration metadata", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    store.close();

    const raw = openRaw(path);
    raw
      .prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1")
      .run("corrupted");
    raw.close();

    expect(() => initializeEventStore({ databasePath: path })).toThrow(
      "metadata mismatch",
    );
  });

  it("fails closed when migration metadata is missing from a populated DB", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    store.close();

    const raw = openRaw(path);
    raw.prepare("DROP TABLE schema_migrations").run();
    raw.close();

    expect(() => initializeEventStore({ databasePath: path })).toThrow(
      "metadata is missing",
    );
  });

  it("append helper inserts scaffold events without enabling update/delete helpers", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });

    store.appendEvent({
      eventId: "event-1",
      eventType: "phase_11_scaffold",
      occurredAtMs: 1,
      source: "test",
      aggregateId: "aggregate-1",
      metadataJson: '{"metadata_only":true}',
    });

    store.close();

    const raw = openRaw(path);
    const row = raw
      .prepare("SELECT event_id, payload_json, local_only FROM events")
      .get() as { event_id: string; payload_json: null; local_only: 1 };

    expect(row).toEqual({
      event_id: "event-1",
      payload_json: null,
      local_only: 1,
    });
    expect(() =>
      raw
        .prepare("UPDATE events SET event_type = ? WHERE event_id = ?")
        .run("changed", "event-1"),
    ).toThrow("append-only");
    expect(() =>
      raw.prepare("DELETE FROM events WHERE event_id = ?").run("event-1"),
    ).toThrow("append-only");

    raw.close();
  });

  it("does not expose update/delete mutation helpers or network/cloud paths", async () => {
    const moduleExports = Object.keys(
      await import("../../src/store/event-store"),
    );
    const source = readFileSync("src/store/event-store.ts", "utf8");

    expect(
      moduleExports.some((name) =>
        /update|delete|sync|cloud|remote|postgres|orm/i.test(name),
      ),
    ).toBe(false);
    expect(source).not.toMatch(
      /fetch\(|WebSocket|node:net|node:http|node:https|postgres|typeorm|prisma|drizzle/i,
    );
  });

  it("loads the checked-in migration file as version 1", () => {
    expect(loadDefaultEventStoreMigrations()).toEqual([
      expect.objectContaining({
        version: 1,
        name: "0001_init.sql",
        sql: expect.stringContaining("CREATE TABLE events"),
      }),
    ]);
  });
});
