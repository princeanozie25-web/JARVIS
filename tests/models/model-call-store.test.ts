import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  ModelCallStoreBridgeError,
  appendModelCallEvent,
  createModelCallEvent,
  type ModelRuntimeExecutionSummary,
} from "../../src/models";
import { initializeEventStore } from "../../src/store/event-store";
import { readTelemetryRollupsProjection } from "../../src/store/projections/telemetry-rollups";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-model-call-store-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function openRaw(path: string) {
  return new Database(path);
}

function summary(
  overrides: Partial<ModelRuntimeExecutionSummary> = {},
): ModelRuntimeExecutionSummary {
  return {
    execution_id: "execution-1",
    request_id: "request-1",
    capability: "chat",
    selected_model_id: "llama3.2:3b",
    selected_provider: "ollama",
    attempted_models: ["llama3.2:3b"],
    successful_model: "llama3.2:3b",
    failed_models: [],
    fallback_used: false,
    fallback_chain: [],
    latency_ms: 25,
    token_usage: {
      input_tokens: 3,
      output_tokens: 4,
      total_tokens: 7,
    },
    degraded: false,
    finish_reason: "stop",
    governance_flags: ["cloud_opt_in_required"],
    redaction_status: "metadata_only",
    runtime_class: "local",
    provider_kind: "ollama",
    started_at: 100,
    ended_at: 125,
    ...overrides,
  };
}

function event(overrides: Partial<ModelRuntimeExecutionSummary> = {}) {
  return createModelCallEvent(summary(overrides), {
    eventIdFactory: ({ summary: input }) => `event-${input.execution_id}`,
    now: () => 1000,
  });
}

describe("Phase 13E.2 model call event store bridge", () => {
  it("appends a valid model call event to the append-only event store", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const result = appendModelCallEvent(store, event());
    store.close();

    expect(result).toEqual({
      appended: true,
      event_id: "event-execution-1",
      model_call_id: "model-call:event-execution-1",
      request_id: "request-1",
      execution_id: "execution-1",
      selected_model_id: "llama3.2:3b",
      selected_provider: "ollama",
      metadata_only: true,
      raw_payload_written: false,
      prompt_payload_retained: false,
      cloud_call: false,
      local_only: true,
    });

    const raw = openRaw(path);
    const row = raw
      .prepare(
        `
          SELECT
            e.event_id,
            e.event_type,
            e.source,
            e.aggregate_id,
            e.metadata_json,
            e.payload_json,
            e.local_only,
            mc.model_call_id,
            mc.provider_id,
            mc.model_id,
            mc.cloud_call,
            mc.prompt_payload_retained
          FROM events e
          INNER JOIN model_calls mc ON mc.event_id = e.event_id
        `,
      )
      .get() as {
      event_id: string;
      event_type: string;
      source: string;
      aggregate_id: string;
      metadata_json: string;
      payload_json: null;
      local_only: 1;
      model_call_id: string;
      provider_id: string;
      model_id: string;
      cloud_call: 0;
      prompt_payload_retained: 0;
    };
    raw.close();

    expect(row).toMatchObject({
      event_id: "event-execution-1",
      event_type: "model.call",
      source: "model_call_event_bridge",
      aggregate_id: "execution-1",
      payload_json: null,
      local_only: 1,
      model_call_id: "model-call:event-execution-1",
      provider_id: "ollama",
      model_id: "llama3.2:3b",
      cloud_call: 0,
      prompt_payload_retained: 0,
    });
    expect(JSON.parse(row.metadata_json)).toMatchObject({
      event_id: "event-execution-1",
      request_id: "request-1",
      redaction_status: "metadata_only",
      token_usage: {
        input_tokens: 3,
        output_tokens: 4,
        total_tokens: 7,
      },
    });
  });

  it("preserves exact DeepSeek V4 model ids when metadata is eligible for model_calls storage", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const modelEvent = createModelCallEvent(
      summary({
        execution_id: "deepseek-execution-1",
        request_id: "deepseek-request-1",
        selected_model_id: "deepseek-v4-flash",
        selected_provider: "deepseek",
        attempted_models: ["deepseek-v4-flash", "deepseek-v4-pro"],
        successful_model: "deepseek-v4-pro",
        fallback_chain: ["deepseek-v4-pro"],
        provider_kind: "deepseek",
      }),
      {
        eventIdFactory: () => "event-deepseek-v4",
        now: () => 1003,
      },
    );

    appendModelCallEvent(store, modelEvent);
    store.close();

    const raw = openRaw(path);
    const row = raw
      .prepare(
        `
          SELECT mc.model_id, e.metadata_json
          FROM model_calls mc
          INNER JOIN events e ON e.event_id = mc.event_id
        `,
      )
      .get() as {
      model_id: string;
      metadata_json: string;
    };
    raw.close();

    expect(row.model_id).toBe("deepseek-v4-flash");
    expect(JSON.parse(row.metadata_json)).toMatchObject({
      selected_model_id: "deepseek-v4-flash",
      attempted_models: ["deepseek-v4-flash", "deepseek-v4-pro"],
      successful_model: "deepseek-v4-pro",
    });
  });

  it("continues to reject executable cloud model call persistence", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const cloudEvent = createModelCallEvent(
      summary({
        selected_provider: "deepseek",
        provider_kind: "deepseek",
        runtime_class: "cloud",
        selected_model_id: "deepseek-v4-flash",
      }),
      {
        eventIdFactory: () => "event-deepseek-cloud",
        now: () => 1004,
      },
    );

    expect(() => appendModelCallEvent(store, cloudEvent)).toThrow(/cloud/);
    store.close();
  });

  it("fails closed on invalid event shapes without appending", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });

    expect(() =>
      appendModelCallEvent(store, { event_id: "bad-event" }),
    ).toThrow(ModelCallStoreBridgeError);
    store.close();

    const raw = openRaw(path);
    expect(raw.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({
      count: 0,
    });
    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM model_calls").get(),
    ).toEqual({ count: 0 });
    raw.close();
  });

  it("fails closed on forbidden raw payload and secret-bearing metadata", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const valid = event();

    expect(() =>
      appendModelCallEvent(store, {
        ...valid,
        raw_prompt: "forbidden",
      }),
    ).toThrow(ModelCallStoreBridgeError);
    expect(() =>
      appendModelCallEvent(
        store,
        createModelCallEvent(
          summary({
            failed_models: [
              {
                model_id: "llama3.2:3b",
                provider_id: "ollama",
                failure_class: "provider_error",
                message: "sk-secret-value",
              },
            ],
            failure_class: "provider_error",
            degraded: true,
            finish_reason: "error",
          }),
          {
            eventIdFactory: () => "event-secret",
            now: () => 1001,
          },
        ),
      ),
    ).toThrow(ModelCallStoreBridgeError);
    store.close();
  });

  it("preserves append-only invariants for events and model_calls", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendModelCallEvent(store, event());
    store.close();

    const raw = openRaw(path);
    expect(() =>
      raw
        .prepare("UPDATE events SET event_type = ? WHERE event_id = ?")
        .run("changed", "event-execution-1"),
    ).toThrow("append-only");
    expect(() =>
      raw
        .prepare("DELETE FROM model_calls WHERE model_call_id = ?")
        .run("model-call:event-execution-1"),
    ).toThrow("append-only");
    raw.close();
  });

  it("does not trigger runtime execution or provider calls", () => {
    const calls: unknown[] = [];
    const fakeStore = {
      appendModelCall: (input: unknown) => calls.push(input),
    };

    appendModelCallEvent(fakeStore, event());

    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls)).not.toContain("complete");
    expect(JSON.stringify(calls)).not.toContain("stream");
  });

  it("can be read back through the existing safe telemetry rollup projection", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendModelCallEvent(store, event());
    store.close();

    expect(
      readTelemetryRollupsProjection({ databasePath: path }),
    ).toMatchObject({
      projection_status: "ok",
      model_calls_by_provider: [{ key: "ollama", count: 1 }],
      errors: [],
      posture: {
        metadata_only: true,
        raw_payload_included: false,
      },
    });
  });

  it("fails closed when the store is missing or unavailable", () => {
    expect(() =>
      appendModelCallEvent(
        {} as unknown as Parameters<typeof appendModelCallEvent>[0],
        event(),
      ),
    ).toThrow(ModelCallStoreBridgeError);
    expect(() =>
      appendModelCallEvent(
        {
          appendModelCall: () => {
            throw new Error("store unavailable");
          },
        },
        event(),
      ),
    ).toThrow(/store unavailable/);
  });

  it("rejects cloud runtime events instead of widening persistence authority", () => {
    const store = initializeEventStore({ databasePath: databasePath() });
    const cloudEvent = createModelCallEvent(
      summary({
        selected_provider: "anthropic",
        provider_kind: "anthropic",
        runtime_class: "cloud",
        selected_model_id: "claude-haiku",
      }),
      {
        eventIdFactory: () => "event-cloud",
        now: () => 1002,
      },
    );

    expect(() => appendModelCallEvent(store, cloudEvent)).toThrow(/cloud/);
    store.close();
  });

  it("source contains no update/delete, runtime, provider, router, UI, Tauri, cloud execution, or install wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/model-call-store.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\bUPDATE\b|\bDELETE\b|truncate|exec\(|prepare\(/,
    );
    expect(source).not.toMatch(/createModelRuntime|\.complete\(|\.stream\(/);
    expect(source).not.toMatch(/createOllama|Ollama|provider\.|fetch\s*\(/);
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|document\.|window\.|React|tsx|tauri|invoke\(/i,
    );
    expect(source).not.toMatch(
      /\/api\/pull|ollama\.pull|pullModel|modelPull|auto-?install|npm\s+install/i,
    );
  });
});
