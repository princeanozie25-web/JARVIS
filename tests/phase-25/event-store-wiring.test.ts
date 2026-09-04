import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createObservabilityApi } from "@/lib/observability/api";
import {
  DEFAULT_EVENT_STORE_PATH,
  getAppEventStore,
  recordChatModelCall,
  resetAppEventStore,
  resolveEventStorePath,
} from "@/store/app-event-store";
import { initializeEventStore } from "@/store/event-store";
import { readTelemetryRollupsProjection } from "@/store/projections/telemetry-rollups";

// E-038 — 25B-2: the Phase 11 event store is instantiated by the app and the
// chat route writes one metadata-only model-call row per turn, so the
// cockpit's COST feed is real. Kill switch + fail-closed paths asserted.

const roots: string[] = [];
function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), "jarvis-event-store-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  resetAppEventStore();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const record = {
  sessionId: "s1",
  assistantMessageId: "a1",
  providerId: "ollama",
  runtimeClass: "local" as const,
  modelId: "qwen3.5:9b-mlx",
  latencyMs: 1200,
  timeToFirstTokenMs: 300,
  inputTokens: 100,
  outputTokens: 20,
  costUsd: 0,
  intent: "CONVERSATIONAL",
  tier: "T3",
  safetyTag: "ALLOW",
  occurredAtMs: 1_000,
};

describe("E-038 event store wiring", () => {
  it("resolves the path from env with a POSIX default and a kill switch", () => {
    expect(resolveEventStorePath({})).toMatch(
      new RegExp(`${DEFAULT_EVENT_STORE_PATH.replace(".", "\\.")}$`),
    );
    expect(resolveEventStorePath({ JARVIS_EVENT_DB_PATH: "/x/y.db" })).toBe(
      "/x/y.db",
    );
    expect(
      resolveEventStorePath({ JARVIS_EVENT_STORE_ENABLED: "false" }),
    ).toBeNull();
    expect(
      getAppEventStore({ JARVIS_EVENT_STORE_ENABLED: "false" }),
    ).toBeNull();
  });

  it("creates the store with the Phase 11 schema at the configured path and reuses it", () => {
    const path = join(tmp(), "nested", "event-store.db");
    const store = getAppEventStore({ JARVIS_EVENT_DB_PATH: path });
    expect(store).not.toBeNull();
    expect(existsSync(path)).toBe(true);
    expect(store!.inspectSchema().tables).toEqual(
      expect.arrayContaining([
        "events",
        "model_calls",
        "room_events",
        "telemetry_events",
      ]),
    );
    expect(getAppEventStore({ JARVIS_EVENT_DB_PATH: path })).toBe(store);
  });

  it("records a chat turn as ONE metadata-only local model call the rollups count as local", () => {
    const path = join(tmp(), "event-store.db");
    const store = getAppEventStore({ JARVIS_EVENT_DB_PATH: path })!;
    expect(recordChatModelCall(store, record)).toEqual({
      ok: true,
      eventId: "evt_chat_a1",
    });
    const rollups = readTelemetryRollupsProjection({ databasePath: path });
    expect(rollups.projection_status).toBe("ok");
    expect(rollups.model_calls_by_provider).toEqual([
      { key: "local:ollama", count: 1 },
    ]);
    // the cockpit API sees it as live data, not withheld
    const api = createObservabilityApi({ databasePath: path });
    const response = api.queryTelemetryRollups() as {
      withheld: boolean;
      data: unknown;
    };
    expect(response.withheld).toBe(false);
    // ROOM reads honestly empty, not withheld
    const room = api.queryRoomState({ nowMs: 2_000 }) as { withheld: boolean };
    expect(room.withheld).toBe(false);
  });

  it("stores no prompt, no body, no secret — metadata only (I2)", () => {
    const path = join(tmp(), "event-store.db");
    const store = getAppEventStore({ JARVIS_EVENT_DB_PATH: path })!;
    recordChatModelCall(store, record);
    store.close();
    const db = new Database(path, { readonly: true });
    const row = db
      .prepare("SELECT metadata_json, payload_json, local_only FROM events")
      .get() as {
      metadata_json: string;
      payload_json: string | null;
      local_only: number;
    };
    db.close();
    expect(row.payload_json).toBeNull();
    expect(row.local_only).toBe(1);
    const parsedMeta = JSON.parse(row.metadata_json) as Record<string, unknown>;
    expect(
      Object.keys(parsedMeta).filter((k) =>
        /content|messages|api[_-]?key|authorization|^prompt$/i.test(k),
      ),
    ).toEqual([]);
    expect(row.metadata_json).not.toMatch(/Say: stored|sk-[A-Za-z0-9]{8}/);
    expect(parsedMeta).toMatchObject({
      redaction_status: "metadata_only",
      prompt_payload_retained: false,
    });
    resetAppEventStore();
  });

  it("KILL-DRILL: cloud calls are refused, a closed store reports append_failed, a disabled store reports store_disabled — never a throw", () => {
    const path = join(tmp(), "event-store.db");
    const store = initializeEventStore({ databasePath: path });
    expect(
      recordChatModelCall(store, {
        ...record,
        providerId: "openai",
        runtimeClass: "cloud",
      }),
    ).toEqual({ ok: false, reason: "cloud_not_stored" });
    store.close();
    expect(recordChatModelCall(store, record)).toEqual({
      ok: false,
      reason: "append_failed",
    });
    expect(recordChatModelCall(null, record)).toEqual({
      ok: false,
      reason: "store_disabled",
    });
  });

  it("the chat route records the outcome in its telemetry note and never awaits the store", () => {
    const route = readFileSync("app/api/chat/route.ts", "utf8");
    expect(route).toContain("recordChatModelCall(getAppEventStore(), {");
    expect(route).toContain(
      'event_store=${stored.ok ? "appended" : stored.reason}',
    );
    expect(route).not.toMatch(/await recordChatModelCall/);
  });
});

describe("E-038 cockpit path resolution", () => {
  it("an empty JARVIS_OBSERVABILITY_DB_PATH falls through to JARVIS_EVENT_DB_PATH", () => {
    const source = readFileSync(
      "src/lib/command-center/liquid-command-center-data.ts",
      "utf8",
    );
    expect(source).toContain(
      "process.env.JARVIS_OBSERVABILITY_DB_PATH?.trim() ||",
    );
    expect(source).toContain("process.env.JARVIS_EVENT_DB_PATH?.trim() ||");
  });
});
