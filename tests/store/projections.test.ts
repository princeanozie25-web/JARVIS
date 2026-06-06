import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { readRecentTracesProjection } from "../../src/store/projections/recent-traces";
import { readRoomStateProjection } from "../../src/store/projections/room-state";
import { readTelemetryRollupsProjection } from "../../src/store/projections/telemetry-rollups";
import { initializeEventStore } from "../../src/store/event-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-projections-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function initializedPath() {
  const path = databasePath();
  const store = initializeEventStore({ databasePath: path });
  store.close();
  return path;
}

function openRaw(path: string) {
  return new Database(path);
}

function insertEvent(
  db: Database.Database,
  input: {
    readonly eventId: string;
    readonly eventType: string;
    readonly occurredAtMs: number;
    readonly metadataJson?: string;
    readonly payloadJson?: string | null;
  },
) {
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
      ) VALUES (?, ?, ?, 'projection-test', ?, ?, 1, ?)
    `,
  ).run(
    input.eventId,
    input.eventType,
    input.occurredAtMs,
    input.metadataJson ?? "{}",
    input.payloadJson ?? null,
    input.occurredAtMs,
  );
}

describe("Phase 11A.3 read-only projections", () => {
  it("projections tolerate an empty event store", () => {
    const path = initializedPath();

    expect(readRoomStateProjection({ databasePath: path })).toMatchObject({
      projection_status: "ok",
      room_status: "unknown",
      stale: true,
      summaries: [],
      posture: { metadata_only: true, raw_payload_included: false },
    });
    expect(readRecentTracesProjection({ databasePath: path })).toMatchObject({
      projection_status: "ok",
      traces: [],
      posture: { metadata_only: true, raw_payload_included: false },
    });
    expect(
      readTelemetryRollupsProjection({ databasePath: path }),
    ).toMatchObject({
      projection_status: "ok",
      telemetry_by_scope: [],
      telemetry_by_severity: [],
      runtime_by_status: [],
      model_calls_by_provider: [],
      model_calls_by_aux_task: [],
    });
  });

  it("projection outputs are defensive copies", () => {
    const path = initializedPath();
    const first = readRoomStateProjection({ databasePath: path });
    (first as { projection_status: string }).projection_status = "degraded";

    expect(readRoomStateProjection({ databasePath: path })).toMatchObject({
      projection_status: "ok",
    });
  });

  it("room-state projection reads room_events safely", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-room-1",
      eventType: "state_read",
      occurredAtMs: 100,
    });
    raw
      .prepare(
        `
          INSERT INTO room_events (
            room_event_id,
            event_id,
            room_id,
            profile_id,
            adapter_id,
            device_id,
            capability,
            metadata_only
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `,
      )
      .run(
        "room-row-1",
        "event-room-1",
        "bedroom-workspace",
        "bedroom-workspace-default",
        "fake-room-adapter",
        "desk_lamp",
        "power.observe",
      );
    raw.close();

    expect(
      readRoomStateProjection({
        databasePath: path,
        nowMs: 110,
        staleAfterMs: 30_000,
      }),
    ).toEqual({
      projection_status: "ok",
      room_status: "known",
      stale: false,
      summaries: [
        {
          room_id: "bedroom-workspace",
          profile_id: "bedroom-workspace-default",
          adapter_id: "fake-room-adapter",
          device_id: "desk_lamp",
          sensor_id: null,
          capability: "power.observe",
          latest_event_id: "event-room-1",
          latest_seen_at_ms: 100,
          status: "known",
          stale: false,
          failure_class: null,
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      errors: [],
      posture: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
        network_called: false,
        ui_rendered: false,
      },
    });
  });

  it("absent and stale room data is not guessed as canonical truth", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-room-stale",
      eventType: "state_read",
      occurredAtMs: 1,
    });
    raw
      .prepare(
        `
          INSERT INTO room_events (
            room_event_id,
            event_id,
            room_id,
            device_id,
            capability,
            metadata_only
          ) VALUES ('room-stale', 'event-room-stale', 'bedroom-workspace', 'desk_lamp', 'power.observe', 1)
        `,
      )
      .run();
    raw.close();

    expect(
      readRoomStateProjection({
        databasePath: path,
        nowMs: 100_000,
        staleAfterMs: 30_000,
      }),
    ).toMatchObject({
      room_status: "known",
      stale: true,
      summaries: [
        {
          device_id: "desk_lamp",
          status: "stale",
          stale: true,
        },
      ],
    });
  });

  it("recent-traces projection returns metadata-only replay trace summaries", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-replay-1",
      eventType: "replay_trace",
      occurredAtMs: 200,
    });
    raw
      .prepare(
        `
          INSERT INTO replay_traces (
            replay_trace_id,
            event_id,
            trace_kind,
            replay_metadata_json,
            raw_payload_retained
          ) VALUES ('trace-1', 'event-replay-1', 'room-command', '{"metadata_only":true}', 0)
        `,
      )
      .run();
    raw.close();

    expect(readRecentTracesProjection({ databasePath: path })).toEqual({
      projection_status: "ok",
      traces: [
        {
          replay_trace_id: "trace-1",
          event_id: "event-replay-1",
          trace_kind: "room-command",
          occurred_at_ms: 200,
          metadata_only: true,
          raw_payload_included: false,
          executable_payload_included: false,
          run_affordance: false,
          retry_affordance: false,
        },
      ],
      errors: [],
      posture: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
        network_called: false,
        ui_rendered: false,
      },
    });
  });

  it("telemetry-rollups projection bins and counts metadata only", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-telemetry-1",
      eventType: "telemetry",
      occurredAtMs: 1,
    });
    insertEvent(raw, {
      eventId: "event-runtime-1",
      eventType: "runtime",
      occurredAtMs: 2,
    });
    insertEvent(raw, {
      eventId: "event-model-1",
      eventType: "model",
      occurredAtMs: 3,
    });
    raw
      .prepare(
        `
          INSERT INTO telemetry_events (
            telemetry_event_id,
            event_id,
            telemetry_scope,
            severity,
            metadata_only
          ) VALUES ('telemetry-1', 'event-telemetry-1', 'room', 'info', 1)
        `,
      )
      .run();
    raw
      .prepare(
        `
          INSERT INTO runtime_executions (
            runtime_execution_id,
            event_id,
            runtime_kind,
            status
          ) VALUES ('runtime-1', 'event-runtime-1', 'fake-runtime', 'completed')
        `,
      )
      .run();
    raw
      .prepare(
        `
          INSERT INTO model_calls (
            model_call_id,
            event_id,
            provider_id,
            model_id,
            cloud_call,
            prompt_payload_retained
          ) VALUES ('model-1', 'event-model-1', 'local-fake', 'fake-model', 0, 0)
        `,
      )
      .run();
    raw.close();

    expect(readTelemetryRollupsProjection({ databasePath: path })).toEqual({
      projection_status: "ok",
      telemetry_by_scope: [{ key: "room", count: 1 }],
      telemetry_by_severity: [{ key: "info", count: 1 }],
      runtime_by_status: [{ key: "completed", count: 1 }],
      model_calls_by_provider: [{ key: "local-fake", count: 1 }],
      model_calls_by_aux_task: [],
      errors: [],
      posture: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
        network_called: false,
        ui_rendered: false,
      },
    });
  });

  it("malformed payloads fail closed", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-room-bad",
      eventType: "state_read",
      occurredAtMs: 1,
      metadataJson: "{bad-json",
      payloadJson: "secret raw payload",
    });
    raw
      .prepare(
        `
          INSERT INTO room_events (
            room_event_id,
            event_id,
            room_id,
            device_id,
            capability,
            metadata_only
          ) VALUES ('bad-room', 'event-room-bad', 'bedroom-workspace', 'desk_lamp', 'power.observe', 1)
        `,
      )
      .run();
    raw.close();

    expect(readRoomStateProjection({ databasePath: path })).toMatchObject({
      projection_status: "degraded",
      summaries: [
        {
          latest_event_id: null,
          latest_seen_at_ms: null,
          status: "unknown",
          stale: true,
          raw_payload_included: false,
        },
      ],
      errors: ["unsafe_room_event:event-room-bad"],
    });
  });

  it("projection modules expose no mutation methods", async () => {
    const modules = await Promise.all([
      import("../../src/store/projections/room-state"),
      import("../../src/store/projections/recent-traces"),
      import("../../src/store/projections/telemetry-rollups"),
    ]);
    const exportedNames = modules.flatMap((module) => Object.keys(module));

    expect(
      exportedNames.some((name) =>
        /insert|update|delete|append|truncate|exec|run|raw|db|handle/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("no raw payloads or secrets are returned", () => {
    const path = initializedPath();
    const raw = openRaw(path);
    insertEvent(raw, {
      eventId: "event-trace-secret",
      eventType: "replay_trace",
      occurredAtMs: 1,
      metadataJson: '{"metadata_only":true}',
    });
    raw
      .prepare(
        `
          INSERT INTO replay_traces (
            replay_trace_id,
            event_id,
            trace_kind,
            replay_metadata_json,
            raw_payload_retained
          ) VALUES ('trace-secret', 'event-trace-secret', 'secret-sk-value', '{"apiKey":"sk-not-returned"}', 0)
        `,
      )
      .run();
    raw.close();

    const serialized = JSON.stringify(
      readRecentTracesProjection({ databasePath: path }),
    );
    expect(serialized).not.toContain("sk-not-returned");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("secret-sk-value");
    expect(serialized).toContain("[redacted]");
  });

  it("projection source has no network, cloud, or UI path", async () => {
    const roomModule = await import("../../src/store/projections/room-state");
    const traceModule =
      await import("../../src/store/projections/recent-traces");
    const telemetryModule =
      await import("../../src/store/projections/telemetry-rollups");
    const exportedNames = [
      ...Object.keys(roomModule),
      ...Object.keys(traceModule),
      ...Object.keys(telemetryModule),
    ];

    expect(
      exportedNames.some((name) =>
        /network|cloud|sync|remote|render|ui|component|fetch|websocket/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });
});
