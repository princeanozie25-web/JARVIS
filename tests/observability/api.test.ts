import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createObservabilityApi } from "../../src/lib/observability/api";
import { initializeEventStore } from "../../src/store/event-store";

const tempDirs: string[] = [];
const OBSERVABILITY_SOURCE_FILES = [
  "src/lib/observability/api.ts",
  "src/lib/observability/contracts.ts",
] as const;

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-observability-"));
  tempDirs.push(dir);
  const path = join(dir, "events.sqlite");
  const store = initializeEventStore({ databasePath: path });
  store.close();
  return path;
}

function sourceText() {
  return OBSERVABILITY_SOURCE_FILES.map((file) =>
    readFileSync(file, "utf8"),
  ).join("\n");
}

describe("Phase 12D.1 read-only Observability API scaffold", () => {
  it("exposes only read-only query methods", () => {
    const api = createObservabilityApi({ databasePath: databasePath() });
    const exportedMethods = Object.keys(api);

    expect(exportedMethods).toEqual([
      "queryRoomState",
      "queryRecentTraces",
      "queryTelemetryRollups",
      "queryAuditPanelMetadata",
      "queryOrbStateMetadata",
      "queryWorkingPanelMetadata",
    ]);
    expect(
      exportedMethods.some((name) =>
        /insert|update|delete|append|truncate|mutate|execute|approve|run|retry|replay|graph|raw|sql|db|handle/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("returns deterministic metadata-only read-only responses", () => {
    const api = createObservabilityApi({ databasePath: databasePath() });

    expect(api.queryRoomState({ nowMs: 1_000 })).toMatchObject({
      status: "ok",
      classification: "metadata_only",
      authority: "read_only",
      replay_safe: false,
      withheld: false,
      redaction: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
      },
      data: {
        projection_status: "ok",
        summaries: [],
      },
    });
    expect(api.queryTelemetryRollups()).toMatchObject({
      classification: "metadata_only",
      authority: "read_only",
      replay_safe: false,
      data: {
        projection_status: "ok",
      },
    });
  });

  it("preserves replay-safe metadata where appropriate", () => {
    const api = createObservabilityApi({ databasePath: databasePath() });

    expect(api.queryRecentTraces()).toMatchObject({
      classification: "metadata_only",
      authority: "read_only",
      replay_safe: true,
      data: {
        projection_status: "ok",
        traces: [],
      },
    });
    expect(api.queryAuditPanelMetadata()).toMatchObject({
      replay_safe: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          panel_id: "replay_timeline",
          data_classification: "metadata_only",
          authority: "read_only",
        }),
      ]),
    });
  });

  it("returns defensive copies for projections and panel metadata", () => {
    const api = createObservabilityApi({ databasePath: databasePath() });
    const firstRoom = api.queryRoomState();
    const firstPanels = api.queryWorkingPanelMetadata();

    (firstRoom.data as { projection_status: string }).projection_status =
      "degraded";
    (firstPanels.data as unknown as Array<{ title: string }>)[0]!.title =
      "mutated";

    expect(api.queryRoomState()).toMatchObject({
      data: { projection_status: "ok" },
    });
    expect(api.queryWorkingPanelMetadata().data?.[0]).toMatchObject({
      title: "System status",
    });
  });

  it("fails closed on malformed projection data", () => {
    const api = createObservabilityApi({
      databasePath: databasePath(),
      projectionReaders: {
        roomState: () => ({ not_a_projection: true }),
      },
    });

    expect(api.queryRoomState()).toEqual({
      status: "withheld",
      classification: "metadata_only",
      authority: "read_only",
      replay_safe: false,
      data: null,
      errors: ["malformed_projection_payload"],
      withheld: true,
      redaction: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
        unsafe_payload_withheld: true,
      },
    });
  });

  it("withholds unsafe payloads and secret-looking projection data", () => {
    const api = createObservabilityApi({
      databasePath: databasePath(),
      projectionReaders: {
        recentTraces: () => ({
          projection_status: "ok",
          payload_json: "sk-secret-value",
          traces: [],
          errors: [],
        }),
      },
    });
    const response = api.queryRecentTraces();
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      status: "withheld",
      replay_safe: true,
      data: null,
      errors: ["unsafe_projection_payload"],
      withheld: true,
      redaction: {
        unsafe_payload_withheld: true,
        raw_payload_included: false,
      },
    });
    expect(serialized).not.toContain("sk-secret-value");
  });

  it("withholds unsafe metadata from panels and orb state", () => {
    const api = createObservabilityApi({
      databasePath: databasePath(),
      auditPanels: () =>
        [
          {
            panel_id: "trace_viewer",
            payload_json: "secret raw payload",
          },
        ] as never,
      orbState: () =>
        ({
          mode: "idle",
          label: "sk-hidden",
        }) as never,
    });

    expect(api.queryAuditPanelMetadata()).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["unsafe_metadata_payload"],
    });
    expect(api.queryOrbStateMetadata()).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["unsafe_metadata_payload"],
    });
  });

  it("exposes no raw DB handle, raw SQL, or mutation helper surface", async () => {
    const apiModule = await import("../../src/lib/observability/api");
    const contractModule =
      await import("../../src/lib/observability/contracts");
    const exportedNames = [
      ...Object.keys(apiModule),
      ...Object.keys(contractModule),
      ...Object.keys(createObservabilityApi({ databasePath: databasePath() })),
    ];

    expect(
      exportedNames.some((name) =>
        /insert|update|delete|append|truncate|exec|prepare|run|raw|sql|db|handle/i.test(
          name,
        ),
      ),
    ).toBe(false);
    expect(sourceText()).not.toMatch(
      /SELECT|INSERT|UPDATE|DELETE|better-sqlite3/i,
    );
  });

  it("does not import network, socket, server, provider, model, room execution, or IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|node:net|node:http|node:https|listen\(|createServer|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|openai|anthropic|ollama|provider runtime|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom|approval service|replay_execute|graph_execute/i,
    );
  });
});
