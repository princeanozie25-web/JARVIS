import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendModelCallEvent,
  createModelCallEvent,
  getModelCallRollup,
  getRecentModelCalls,
  type ModelCallEvent,
  type ModelRuntimeExecutionSummary,
} from "../../src/models";
import { initializeEventStore } from "../../src/store/event-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-model-call-projection-"));
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

function event(
  eventId: string,
  createdAt: number,
  overrides: Partial<ModelRuntimeExecutionSummary> = {},
): ModelCallEvent {
  return createModelCallEvent(summary(overrides), {
    eventIdFactory: () => eventId,
    now: () => createdAt,
  });
}

function appendEvents(path: string, events: readonly ModelCallEvent[]) {
  const store = initializeEventStore({ databasePath: path });
  for (const modelEvent of events) {
    appendModelCallEvent(store, modelEvent);
  }
  store.close();
}

function insertRawModelCall(
  path: string,
  input: {
    readonly eventId: string;
    readonly modelCallId: string;
    readonly metadataJson: string;
    readonly payloadJson?: string | null;
    readonly cloudCall?: 0 | 1;
    readonly promptPayloadRetained?: 0 | 1;
  },
) {
  const raw = openRaw(path);
  try {
    if (input.cloudCall === 1 || input.promptPayloadRetained === 1) {
      raw.pragma("ignore_check_constraints = ON");
    }
    raw
      .prepare(
        `
          INSERT INTO events (
            event_id,
            event_type,
            occurred_at_ms,
            source,
            aggregate_id,
            metadata_json,
            payload_json,
            local_only,
            created_at_ms
          ) VALUES (?, 'model.call', 100, 'projection-test', 'raw-aggregate', ?, ?, 1, 100)
        `,
      )
      .run(input.eventId, input.metadataJson, input.payloadJson ?? null);
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
          ) VALUES (?, ?, 'ollama', 'llama3.2:3b', ?, ?)
        `,
      )
      .run(
        input.modelCallId,
        input.eventId,
        input.cloudCall ?? 0,
        input.promptPayloadRetained ?? 0,
      );
  } finally {
    raw.close();
  }
}

describe("Phase 13E.4 model call projection adapter", () => {
  it("reads recent model calls from the safe store path", () => {
    const path = databasePath();
    appendEvents(path, [
      event("event-old", 1000),
      event("event-new", 1001, {
        execution_id: "execution-2",
        request_id: "request-2",
        selected_model_id: "qwen2.5:7b",
        attempted_models: ["llama3.2:3b", "qwen2.5:7b"],
        successful_model: "qwen2.5:7b",
        fallback_used: true,
        fallback_chain: ["qwen2.5:7b"],
        token_usage: {
          input_tokens: 5,
          output_tokens: 6,
          total_tokens: 11,
        },
        latency_ms: 40,
      }),
    ]);

    expect(getRecentModelCalls({ databasePath: path, limit: 1 })).toEqual({
      projection_status: "ok",
      calls: [
        {
          event_id: "event-new",
          model_call_id: "model-call:event-new",
          request_id: "request-2",
          execution_id: "execution-2",
          model_id: "qwen2.5:7b",
          provider_kind: "ollama",
          runtime_class: "local",
          capability: "chat",
          status: "success",
          token_usage: {
            input_tokens: 5,
            output_tokens: 6,
            total_tokens: 11,
          },
          latency_ms: 40,
          fallback_used: true,
          degraded: false,
          created_at: 1001,
          redaction_status: "metadata_only",
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

  it("aggregates rollup counts, tokens, failures, fallback, degradation, and latency", () => {
    const path = databasePath();
    appendEvents(path, [
      event("event-success", 1000),
      event("event-failed", 1001, {
        execution_id: "execution-failed",
        request_id: "request-failed",
        selected_model_id: "qwen2.5:7b",
        attempted_models: ["qwen2.5:7b"],
        successful_model: null,
        failed_models: [
          {
            model_id: "qwen2.5:7b",
            provider_id: "ollama",
            failure_class: "timeout",
            message: "Timed out safely.",
          },
        ],
        fallback_used: true,
        failure_class: "timeout",
        latency_ms: 75,
        token_usage: {
          input_tokens: 1,
          output_tokens: 0,
          total_tokens: 1,
        },
        degraded: true,
        finish_reason: "error",
      }),
    ]);

    expect(getModelCallRollup({ databasePath: path })).toEqual({
      projection_status: "ok",
      total_calls: 2,
      successful_calls: 1,
      failed_calls: 1,
      degraded_calls: 1,
      fallback_used_calls: 1,
      token_usage_totals: {
        input_tokens: 4,
        output_tokens: 4,
        total_tokens: 8,
      },
      latency_ms: {
        min_ms: 25,
        max_ms: 75,
        average_ms: 50,
      },
      calls_by_model: [
        { key: "llama3.2:3b", count: 1 },
        { key: "qwen2.5:7b", count: 1 },
      ],
      calls_by_provider_kind: [{ key: "ollama", count: 2 }],
      calls_by_runtime_class: [{ key: "local", count: 2 }],
      calls_by_capability: [{ key: "chat", count: 2 }],
      calls_by_status: [
        { key: "failed", count: 1 },
        { key: "success", count: 1 },
      ],
      failures_by_class: [{ key: "timeout", count: 1 }],
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

  it("withholds malformed rows and reports degraded projection status", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    store.close();
    insertRawModelCall(path, {
      eventId: "event-malformed",
      modelCallId: "model-malformed",
      metadataJson: "{bad-json",
    });

    expect(getRecentModelCalls({ databasePath: path })).toMatchObject({
      projection_status: "degraded",
      calls: [],
      errors: ["unsafe_model_call:model-malformed"],
    });
    expect(getModelCallRollup({ databasePath: path })).toMatchObject({
      projection_status: "degraded",
      total_calls: 0,
      errors: ["unsafe_model_call:model-malformed"],
    });
  });

  it("withholds rows containing payloads, raw fields, cloud flags, or retained prompts", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    store.close();
    const valid = event("event-unsafe", 1000);

    insertRawModelCall(path, {
      eventId: "event-payload",
      modelCallId: "model-payload",
      metadataJson: JSON.stringify(valid),
      payloadJson: "raw prompt should not render",
    });
    insertRawModelCall(path, {
      eventId: "event-raw-field",
      modelCallId: "model-raw-field",
      metadataJson: JSON.stringify({
        ...valid,
        event_id: "event-raw-field",
        raw_prompt: "secret prompt",
      }),
    });
    insertRawModelCall(path, {
      eventId: "event-cloud",
      modelCallId: "model-cloud",
      metadataJson: JSON.stringify({
        ...valid,
        event_id: "event-cloud",
      }),
      cloudCall: 1,
    });
    insertRawModelCall(path, {
      eventId: "event-retained",
      modelCallId: "model-retained",
      metadataJson: JSON.stringify({
        ...valid,
        event_id: "event-retained",
      }),
      promptPayloadRetained: 1,
    });

    const projection = getRecentModelCalls({ databasePath: path });
    const serialized = JSON.stringify(projection);

    expect(projection).toMatchObject({
      projection_status: "degraded",
      calls: [],
      errors: expect.arrayContaining([
        "unsafe_model_call:model-payload",
        "unsafe_model_call:model-raw-field",
        "unsafe_model_call:model-cloud",
        "unsafe_model_call:model-retained",
      ]),
    });
    expect(projection.errors).toHaveLength(4);
    expect(serialized).not.toContain("raw prompt should not render");
    expect(serialized).not.toContain("secret prompt");
  });

  it("returns defensive-copy safe projection outputs", () => {
    const path = databasePath();
    appendEvents(path, [event("event-copy", 1000)]);

    const first = getRecentModelCalls({ databasePath: path });
    (
      first.calls as unknown as { token_usage: { total_tokens: number } }[]
    )[0]!.token_usage.total_tokens = 999;
    (first.errors as string[]).push("mutated");

    const second = getRecentModelCalls({ databasePath: path });
    expect(second.calls[0]?.token_usage.total_tokens).toBe(7);
    expect(second.errors).toEqual([]);
  });

  it("source remains read-only with no runtime, provider, router, UI, Tauri, or write paths", async () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/model-call-projection.ts"),
      "utf8",
    );
    const exported = await import("../../src/models/model-call-projection");

    expect(Object.keys(exported).sort()).toEqual([
      "getModelCallRollup",
      "getRecentModelCalls",
    ]);
    expect(source).not.toMatch(
      /\bINSERT\b|\bUPDATE\b|\bDELETE\b|appendModelCall|appendEvent|writeEvent/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|\.complete\(|\.stream\(|createOllama|createMock|provider\./i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|document\.|window\.|React|tsx|tauri|invoke\(/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|\/api\/pull|ollama\.pull|pullModel|modelPull|install|download/i,
    );
  });
});
