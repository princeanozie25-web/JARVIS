import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FakeDeviceEventEmitter } from "../../src/room/adapters/fake-events";
import {
  EXPECTED_EVENT_STORE_TABLES,
  initializeEventStore,
  loadDefaultEventStoreMigrations,
} from "../../src/store/event-store";
import { readRoomStateProjection } from "../../src/store/projections/room-state";
import { previewRetention } from "../../src/store/retention";
import { appendFakeRoomEventToStore } from "../../src/store/room-event-bridge";

const tempDirs: string[] = [];
const STORE_SOURCE_FILES = [
  "src/store/event-store.ts",
  "src/store/room-event-bridge.ts",
  "src/store/retention.ts",
  "src/store/projections/helpers.ts",
  "src/store/projections/room-state.ts",
  "src/store/projections/recent-traces.ts",
  "src/store/projections/telemetry-rollups.ts",
] as const;
const EVENT_TABLES = [
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
  const dir = mkdtempSync(join(tmpdir(), "jarvis-store-closeout-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function openRaw(path: string) {
  return new Database(path);
}

function sourceText() {
  return STORE_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

function fakeEvent() {
  return new FakeDeviceEventEmitter().emit({
    event_type: "state_read",
    adapter_id: "fake-room-adapter",
    room_id: "bedroom-workspace",
    profile_id: "bedroom-workspace-default",
    device_id: "desk_lamp",
    capability: "power.observe",
    result_status: "ok",
    provenance: {
      correlation_id: "closeout-correlation",
      requested_at_ms: 0,
      requested_by: "jarvis_room_os",
      source_phase: "10B.3",
      adapter_id: "fake-room-adapter",
      device_id: "desk_lamp",
      capability: "power.observe",
      mode: "read_only",
      dry_run: false,
      approval_id: null,
      metadata_only: true,
    },
  });
}

describe("Phase 11A.6 event store closeout guards", () => {
  it("store modules contain no cloud, remote DB, network, UI, provider, scheduler, approval, Hue, or hardware coupling", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|WebSocket|node:net|node:http|node:https|redis|postgres|typeorm|prisma|drizzle|sequelize|\bcloud\b|\bremote\b|\bsync\b|scheduler|setInterval|setTimeout|approval service|openai|anthropic|ollama|provider runtime|real hue|node-hue-api|hardware_io_performed:\s*true|ui_rendered:\s*true|render\(|jsx|tsx/i,
    );
  });

  it("public store and projection modules expose no raw handle or mutation helpers beyond append-only bridge methods", async () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const eventStoreExports = Object.keys(
      await import("../../src/store/event-store"),
    );
    const projectionExports = [
      ...Object.keys(await import("../../src/store/projections/room-state")),
      ...Object.keys(await import("../../src/store/projections/recent-traces")),
      ...Object.keys(
        await import("../../src/store/projections/telemetry-rollups"),
      ),
    ];
    const retentionExports = Object.keys(
      await import("../../src/store/retention"),
    );
    const bridgeExports = Object.keys(
      await import("../../src/store/room-event-bridge"),
    );

    expect(Object.keys(store)).toEqual([
      "appendEvent",
      "appendRoomEvent",
      "appendModelCall",
      "inspectMigrations",
      "inspectSchema",
      "close",
    ]);
    expect("db" in store).toBe(false);
    expect("database" in store).toBe(false);
    expect(
      [
        ...eventStoreExports,
        ...projectionExports,
        ...retentionExports,
        ...bridgeExports,
      ].some((name) =>
        /update|delete|truncate|raw|handle|exec|prepare|run/i.test(name),
      ),
    ).toBe(false);
    expect(
      projectionExports.some((name) =>
        /append|insert|write|mutate/i.test(name),
      ),
    ).toBe(false);
    expect(
      retentionExports.some((name) =>
        /delete|update|vacuum|execute|job|schedule/i.test(name),
      ),
    ).toBe(false);

    store.close();
  });

  it("append-only triggers exist for every event table and WAL mode remains enabled", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const schema = store.inspectSchema();

    expect(schema.tables).toEqual(EXPECTED_EVENT_STORE_TABLES);
    expect(schema.journalMode).toBe("wal");
    for (const table of EVENT_TABLES) {
      expect(schema.triggers).toContain(`${table}_no_update`);
      expect(schema.triggers).toContain(`${table}_no_delete`);
    }

    store.close();
  });

  it("retention policy is preview-only and cannot delete, update, or vacuum", () => {
    expect(previewRetention({ nowMs: 1_000 })).toMatchObject({
      metadata_only: true,
      raw_payload_included: false,
      retention_execution_enabled: false,
      delete_executed: false,
      update_executed: false,
      vacuum_executed: false,
    });
    expect(readFileSync("src/store/retention.ts", "utf8")).not.toMatch(
      /\bDELETE\b|\bUPDATE\b|\bVACUUM\b|Database|better-sqlite3/i,
    );
  });

  it("room-event bridge is one-way fake event to store and persists metadata only", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const event = fakeEvent();
    appendFakeRoomEventToStore({ store, event });
    store.close();

    const raw = openRaw(path);
    expect(
      raw
        .prepare(
          `
            SELECT
              e.event_type,
              e.payload_json,
              e.local_only,
              re.metadata_only,
              re.device_id,
              re.capability
            FROM events e
            INNER JOIN room_events re ON re.event_id = e.event_id
          `,
        )
        .get(),
    ).toEqual({
      event_type: "state_read",
      payload_json: null,
      local_only: 1,
      metadata_only: 1,
      device_id: "desk_lamp",
      capability: "power.observe",
    });
    raw.close();
    expect(event.persisted).toBe(false);
  });

  it("malformed or secret-bearing fake events fail closed or are redacted", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });

    expect(() =>
      appendFakeRoomEventToStore({
        store,
        event: {
          ...fakeEvent(),
          provider_called: true,
        } as unknown as ReturnType<typeof fakeEvent>,
      }),
    ).toThrow("unsafe event metadata");

    appendFakeRoomEventToStore({
      store,
      event: {
        ...fakeEvent(),
        provenance: {
          ...fakeEvent().provenance!,
          correlation_id: "sk-closeout-secret",
          approval_id: "token-closeout",
        },
      },
    });
    store.close();

    const raw = openRaw(path);
    const serialized = JSON.stringify(
      raw.prepare("SELECT metadata_json, payload_json FROM events").all(),
    );
    raw.close();
    expect(serialized).not.toContain("sk-closeout-secret");
    expect(serialized).not.toContain("token-closeout");
    expect(serialized).not.toContain('payload_json":"');
    expect(serialized).toContain("[redacted]");
  });

  it("projections can read bridged events without becoming mutating", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendFakeRoomEventToStore({ store, event: fakeEvent() });
    store.close();

    expect(
      readRoomStateProjection({
        databasePath: path,
        nowMs: 10,
        staleAfterMs: 30_000,
      }),
    ).toMatchObject({
      projection_status: "ok",
      summaries: [
        {
          latest_event_id: "room-fake-event-000001",
          device_id: "desk_lamp",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      posture: {
        metadata_only: true,
        raw_payload_included: false,
        executable_payload_included: false,
      },
    });
  });

  it("schema migrations are deterministic and inspected read-only", () => {
    const first = initializeEventStore({ databasePath: databasePath() });
    const second = initializeEventStore({ databasePath: databasePath() });
    const firstMigrations = first.inspectMigrations();
    const defaultMigrations = loadDefaultEventStoreMigrations();
    (firstMigrations[0] as { name: string }).name = "mutated";

    expect(second.inspectMigrations()).toEqual([
      {
        version: 1,
        name: "0001_init.sql",
        checksum: expect.any(String),
        applied_at_ms: 1,
      },
    ]);
    expect(defaultMigrations).toEqual([
      expect.objectContaining({
        version: 1,
        name: "0001_init.sql",
        sql: expect.stringContaining("CREATE TABLE events"),
      }),
    ]);

    first.close();
    second.close();
  });
});
