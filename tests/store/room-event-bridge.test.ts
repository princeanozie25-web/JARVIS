import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { FakeDeviceEventEmitter } from "../../src/room/adapters/fake-events";
import { initializeEventStore } from "../../src/store/event-store";
import { readRoomStateProjection } from "../../src/store/projections/room-state";
import { appendFakeRoomEventToStore } from "../../src/store/room-event-bridge";
import type { FakeDeviceEventType } from "../../src/room/adapters/fake-events";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-room-bridge-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function openRaw(path: string) {
  return new Database(path);
}

function fakeEvent(type: FakeDeviceEventType = "state_read") {
  return new FakeDeviceEventEmitter().emit({
    event_type: type,
    adapter_id: "fake-room-adapter",
    room_id: "bedroom-workspace",
    profile_id: "bedroom-workspace-default",
    device_id: type === "health_checked" ? null : "desk_lamp",
    capability: type === "health_checked" ? null : "power.observe",
    command_id:
      type === "command_planned" ||
      type === "command_executed" ||
      type === "command_rejected" ||
      type === "verification_read"
        ? "command-1"
        : null,
    plan_id: type === "command_planned" ? "plan-command-1" : null,
    result_status:
      type === "command_planned"
        ? "planned"
        : type === "command_rejected" || type === "failure_simulated"
          ? "failed"
          : type === "health_checked"
            ? "checked"
            : "ok",
    failure_class:
      type === "command_rejected" || type === "failure_simulated"
        ? "adapter_unavailable"
        : null,
    provenance: {
      correlation_id: "bridge-correlation-1",
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

describe("Phase 11A.5 fake room event store bridge", () => {
  it("valid fake state_read event appends to events and room_events", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const result = appendFakeRoomEventToStore({
      store,
      event: fakeEvent("state_read"),
    });
    store.close();

    const raw = openRaw(path);
    expect(
      raw
        .prepare(
          `
            SELECT
              e.event_id,
              e.event_type,
              e.source,
              e.payload_json,
              e.local_only,
              re.room_event_id,
              re.room_id,
              re.profile_id,
              re.adapter_id,
              re.device_id,
              re.capability,
              re.metadata_only
            FROM events e
            INNER JOIN room_events re ON re.event_id = e.event_id
          `,
        )
        .get(),
    ).toEqual({
      event_id: "room-fake-event-000001",
      event_type: "state_read",
      source: "fake_room_event_bridge",
      payload_json: null,
      local_only: 1,
      room_event_id: "room-event-fake-event-000001",
      room_id: "bedroom-workspace",
      profile_id: "bedroom-workspace-default",
      adapter_id: "fake-room-adapter",
      device_id: "desk_lamp",
      capability: "power.observe",
      metadata_only: 1,
    });
    raw.close();
    expect(result).toMatchObject({
      appended: true,
      event_id: "room-fake-event-000001",
      source_event_id: "fake-event-000001",
      metadata_only: true,
      raw_payload_included: false,
      fake_only: true,
      local_only: true,
      mutation_authority_added: false,
    });
  });

  it("command and health event types append safely", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const types: FakeDeviceEventType[] = [
      "command_planned",
      "command_executed",
      "verification_read",
      "command_rejected",
      "failure_simulated",
      "health_checked",
    ];

    for (const type of types) {
      const event = fakeEvent(type);
      appendFakeRoomEventToStore({
        store,
        event: {
          ...event,
          event_id: `${event.event_id}-${type}`,
        },
      });
    }
    store.close();

    const raw = openRaw(path);
    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM events").get(),
    ).toMatchObject({ count: 6 });
    expect(
      raw
        .prepare(
          "SELECT COUNT(*) AS count FROM room_events WHERE metadata_only = 1",
        )
        .get(),
    ).toMatchObject({ count: 6 });
    expect(
      raw
        .prepare(
          "SELECT failure_class FROM room_events WHERE failure_class IS NOT NULL ORDER BY failure_class",
        )
        .all(),
    ).toEqual([
      { failure_class: "adapter_unavailable" },
      { failure_class: "adapter_unavailable" },
    ]);
    raw.close();
  });

  it("malformed event fails closed", () => {
    const store = initializeEventStore({ databasePath: databasePath() });

    expect(() =>
      appendFakeRoomEventToStore({
        store,
        event: {
          ...fakeEvent("state_read"),
          raw_payload_included: true,
        } as unknown as ReturnType<typeof fakeEvent>,
      }),
    ).toThrow("unsafe event metadata");
    expect(() =>
      appendFakeRoomEventToStore({
        store,
        event: {
          ...fakeEvent("state_read"),
          timestamp: -1,
        } as ReturnType<typeof fakeEvent>,
      }),
    ).toThrow("malformed event time");

    store.close();
  });

  it("raw payload and secret-looking fields are stripped or redacted", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const event = fakeEvent("state_read");

    appendFakeRoomEventToStore({
      store,
      event: {
        ...event,
        provenance: {
          ...event.provenance!,
          correlation_id: "sk-secret-value",
          approval_id: "token-should-redact",
        },
      },
    });
    store.close();

    const raw = openRaw(path);
    const row = raw
      .prepare("SELECT metadata_json, payload_json FROM events")
      .get() as {
      metadata_json: string;
      payload_json: null;
    };
    raw.close();

    expect(row.payload_json).toBeNull();
    expect(row.metadata_json).not.toContain("sk-secret-value");
    expect(row.metadata_json).not.toContain("token-should-redact");
    expect(row.metadata_json).toContain("[redacted]");
  });

  it("bridge output is append-only and preserves linkage", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendFakeRoomEventToStore({ store, event: fakeEvent("state_read") });
    store.close();

    const raw = openRaw(path);
    expect(() =>
      raw
        .prepare("UPDATE events SET event_type = ? WHERE event_id = ?")
        .run("changed", "room-fake-event-000001"),
    ).toThrow("append-only");
    expect(
      JSON.parse(
        (
          raw
            .prepare("SELECT metadata_json FROM events WHERE event_id = ?")
            .get("room-fake-event-000001") as { metadata_json: string }
        ).metadata_json,
      ),
    ).toMatchObject({
      source_event_id: "fake-event-000001",
      fake_only: true,
      local_only: true,
      metadata_only: true,
    });
    raw.close();
  });

  it("projections can read bridged room metadata", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendFakeRoomEventToStore({ store, event: fakeEvent("state_read") });
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
          room_id: "bedroom-workspace",
          profile_id: "bedroom-workspace-default",
          adapter_id: "fake-room-adapter",
          device_id: "desk_lamp",
          capability: "power.observe",
          raw_payload_included: false,
        },
      ],
    });
  });

  it("does not mutate fake adapter event state", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const event = fakeEvent("state_read");
    const before = structuredClone(event);

    appendFakeRoomEventToStore({ store, event });

    expect(event).toEqual(before);
    store.close();
  });

  it("exposes no update/delete/raw DB handle/network/UI/provider path", async () => {
    const moduleExports = Object.keys(
      await import("../../src/store/room-event-bridge"),
    );
    const store = initializeEventStore({ databasePath: databasePath() });

    expect(
      moduleExports.some((name) =>
        /update|delete|raw|db|handle|network|cloud|sync|render|ui|provider|hardware|hue/i.test(
          name,
        ),
      ),
    ).toBe(false);
    expect(Object.keys(store)).toEqual([
      "appendEvent",
      "appendRoomEvent",
      "inspectMigrations",
      "inspectSchema",
      "close",
    ]);

    store.close();
  });
});
