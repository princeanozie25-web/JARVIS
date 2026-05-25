import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendModelCallEvent,
  createModelCallEvent,
  createModelRegistryFromYaml,
  createModelRuntime,
  createModelRuntimeObservabilityView,
  createModelRuntimeProviderKey,
  getModelCallRollup,
  getRecentModelCalls,
  type ModelCallEvent,
  type ModelProvider,
  type ModelProviderRequest,
  type ModelProviderResponse,
  type ModelProviderStreamEvent,
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
  const dir = mkdtempSync(join(tmpdir(), "jarvis-phase-13e-closeout-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function sourceFor(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
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
  overrides: Partial<ModelRuntimeExecutionSummary> = {},
): ModelCallEvent {
  return createModelCallEvent(summary(overrides), {
    eventIdFactory: ({ summary: input }) => `event-${input.execution_id}`,
    now: () => 1000,
  });
}

function registry() {
  return createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: local-primary
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat]
    context_window: 4096
    visibility: enabled
    priority: 10
    supports_streaming: true
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Local Primary
      description: Local primary metadata.
      approximate_memory_mb: 1024
      cost_class: local_free
      governance_notes: Metadata only.
`);
}

function runtimeRequest(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "phase-13e-runtime-request",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Phase 13E raw prompt" }],
    },
    resolver_options: {
      runtime_class: "local",
    },
    options: {},
    timeout_ms: 5_000,
    ...overrides,
  };
}

function provider(): {
  readonly provider: ModelProvider;
  readonly completeCalls: ModelProviderRequest[];
  readonly streamCalls: ModelProviderRequest[];
} {
  const completeCalls: ModelProviderRequest[] = [];
  const streamCalls: ModelProviderRequest[] = [];
  const modelProvider: ModelProvider = {
    id: "phase-13e-provider",
    kind: "ollama",
    runtime_class: "local",
    capabilities: ["chat"],
    metadata: {
      provider_id: "phase-13e-provider",
      display_name: "Phase 13E Provider",
      runtime_class: "local",
      supported_capabilities: ["chat"],
      supports_streaming: true,
      supports_abort: true,
      supports_timeout: true,
      governance_notes: "Closeout provider metadata only.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      completeCalls.push(
        structuredClone({ ...request, abort_signal: undefined }),
      );
      return responseFor(request);
    },
    stream: async function* (request) {
      streamCalls.push(
        structuredClone({ ...request, abort_signal: undefined }),
      );
      yield tokenFor(request, "phase", 0);
      yield doneFor(request);
    },
    health: async () => {
      throw new Error("health must not be invoked by Phase 13E closeout.");
    },
  };
  return { provider: modelProvider, completeCalls, streamCalls };
}

function responseFor(request: ModelProviderRequest): ModelProviderResponse {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: "phase-13e-provider",
    output: {
      kind: "text",
      content: "Phase 13E raw response text",
    },
    latency_ms: 5,
    token_usage: {
      input_tokens: 2,
      output_tokens: 3,
      total_tokens: 5,
    },
    finish_reason: "stop",
    degraded: false,
    redaction_status: "metadata_only",
  };
}

function tokenFor(
  request: ModelProviderRequest,
  delta: string,
  index: number,
): ModelProviderStreamEvent {
  return {
    type: "token",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: "phase-13e-provider",
    created_at_ms: index,
    delta,
    index,
    redaction_status: "metadata_only",
  };
}

function doneFor(request: ModelProviderRequest): ModelProviderStreamEvent {
  return {
    type: "done",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: "phase-13e-provider",
    created_at_ms: 1,
    response: responseFor(request),
  };
}

async function collectStream(
  events: AsyncIterable<unknown>,
): Promise<unknown[]> {
  const collected: unknown[] = [];
  for await (const item of events) collected.push(item);
  return collected;
}

function insertUnsafeModelCall(path: string) {
  const raw = new Database(path);
  try {
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
          ) VALUES (
            'event-unsafe',
            'model.call',
            100,
            'phase-13e-closeout',
            'unsafe-execution',
            ?,
            ?,
            1,
            100
          )
        `,
      )
      .run(
        JSON.stringify({
          ...event({ execution_id: "unsafe-execution" }),
          event_id: "event-unsafe",
          raw_prompt: "Phase 13E raw prompt should never render.",
        }),
        "Phase 13E raw response should never render.",
      );
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
          ) VALUES (
            'model-call-unsafe',
            'event-unsafe',
            'ollama',
            'llama3.2:3b',
            0,
            0
          )
        `,
      )
      .run();
  } finally {
    raw.close();
  }
}

describe("Phase 13E persistence and observability closeout", () => {
  it("keeps ModelCallEvent metadata-only and rejects raw or malformed summaries", () => {
    const modelEvent = event();

    expect(modelEvent).toMatchObject({
      event_id: "event-execution-1",
      redaction_status: "metadata_only",
      token_usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      },
    });
    expect(JSON.stringify(modelEvent)).not.toContain("raw_prompt");
    expect(JSON.stringify(modelEvent)).not.toContain("raw_response");
    expect(JSON.stringify(modelEvent)).not.toContain("provider_payload");

    expect(() =>
      createModelCallEvent({
        ...summary(),
        raw_prompt: "forbidden",
      }),
    ).toThrow(/forbidden metadata field/i);
    expect(() =>
      createModelCallEvent({
        ...summary(),
        token_usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: "2",
        },
      }),
    ).toThrow(/malformed/i);
  });

  it("validates appendModelCallEvent input and preserves append-only posture", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });

    expect(appendModelCallEvent(store, event())).toMatchObject({
      appended: true,
      metadata_only: true,
      raw_payload_written: false,
      prompt_payload_retained: false,
      cloud_call: false,
      local_only: true,
    });
    expect(() =>
      appendModelCallEvent(store, { event_id: "bad-event" }),
    ).toThrow(/malformed event metadata/i);
    expect(() =>
      appendModelCallEvent(
        store,
        event({
          execution_id: "secret-execution",
          failed_models: [
            {
              model_id: "llama3.2:3b",
              provider_id: "ollama",
              failure_class: "provider_error",
              message: "sk-secret-value",
            },
          ],
          successful_model: null,
          failure_class: "provider_error",
          degraded: true,
          finish_reason: "error",
        }),
      ),
    ).toThrow(/unsafe event metadata/i);
    store.close();

    const raw = new Database(path);
    try {
      expect(() =>
        raw
          .prepare(
            "UPDATE model_calls SET provider_id = ? WHERE model_call_id = ?",
          )
          .run("changed", "model-call:event-execution-1"),
      ).toThrow(/append-only/i);
      expect(() =>
        raw
          .prepare("DELETE FROM events WHERE event_id = ?")
          .run("event-execution-1"),
      ).toThrow(/append-only/i);
    } finally {
      raw.close();
    }
  });

  it("keeps runtime persistence opt-in and persistence failures metadata-safe", async () => {
    const localProvider = provider();
    const runtime = createModelRuntime({
      registry: registry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: localProvider.provider,
      },
    });

    const defaultResult = await runtime.execute(runtimeRequest());
    expect(defaultResult.metadata.persistence).toBeUndefined();
    expect(JSON.stringify(defaultResult.metadata)).not.toContain(
      "Phase 13E raw prompt",
    );
    expect(JSON.stringify(defaultResult.metadata)).not.toContain(
      "Phase 13E raw response text",
    );

    let appendCalls = 0;
    const failingRuntime = createModelRuntime({
      registry: registry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: localProvider.provider,
      },
      persistence: {
        appendEvent: () => {
          appendCalls += 1;
          throw new Error("sk-secret Phase 13E raw prompt");
        },
      },
    });
    const result = await failingRuntime.execute(runtimeRequest());

    expect(appendCalls).toBe(1);
    expect(result.metadata.persistence).toEqual({
      attempted: true,
      persisted: false,
      event_id: null,
      metadata_only: true,
      error_class: "persistence_failed",
    });
    expect(JSON.stringify(result.metadata.persistence)).not.toContain(
      "sk-secret",
    );
    expect(JSON.stringify(result.metadata.persistence)).not.toContain(
      "Phase 13E raw prompt",
    );
  });

  it("keeps streaming persistence disabled even when persistence hooks are present", async () => {
    const localProvider = provider();
    let createCalls = 0;
    let appendCalls = 0;
    const runtime = createModelRuntime({
      registry: registry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: localProvider.provider,
      },
      persistence: {
        createEvent: (input) => {
          createCalls += 1;
          return createModelCallEvent(input);
        },
        appendEvent: (modelEvent) => {
          appendCalls += 1;
          return {
            appended: true,
            event_id: modelEvent.event_id,
            model_call_id: `model-call:${modelEvent.event_id}`,
            request_id: modelEvent.request_id,
            execution_id: modelEvent.execution_id,
            selected_model_id: modelEvent.selected_model_id,
            selected_provider: modelEvent.selected_provider,
            metadata_only: true,
            raw_payload_written: false,
            prompt_payload_retained: false,
            cloud_call: false,
            local_only: true,
          };
        },
      },
    });

    const events = await collectStream(runtime.stream(runtimeRequest()));

    expect(events.at(-1)).toMatchObject({ type: "done" });
    expect(createCalls).toBe(0);
    expect(appendCalls).toBe(0);
  });

  it("keeps projections read-only and withholds unsafe or malformed rows", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    appendModelCallEvent(store, event());
    store.close();
    insertUnsafeModelCall(path);

    const recent = getRecentModelCalls({ databasePath: path });
    const rollup = getModelCallRollup({ databasePath: path });
    const serialized = JSON.stringify({ recent, rollup });

    expect(recent).toMatchObject({
      projection_status: "degraded",
      calls: [
        expect.objectContaining({
          model_id: "llama3.2:3b",
          redaction_status: "metadata_only",
          raw_payload_included: false,
        }),
      ],
      errors: ["unsafe_model_call:model-call-unsafe"],
    });
    expect(rollup).toMatchObject({
      projection_status: "degraded",
      total_calls: 1,
      errors: ["unsafe_model_call:model-call-unsafe"],
    });
    expect(serialized).not.toContain(
      "Phase 13E raw prompt should never render",
    );
    expect(serialized).not.toContain(
      "Phase 13E raw response should never render",
    );
  });

  it("keeps observability adapter projection-data-only and metadata-safe", () => {
    const safeRecent = {
      projection_status: "ok",
      calls: [
        {
          event_id: "event-1",
          model_call_id: "model-call:event-1",
          request_id: "request-1",
          execution_id: "execution-1",
          model_id: "llama3.2:3b",
          provider_kind: "ollama",
          runtime_class: "local",
          capability: "chat",
          status: "success",
          token_usage: {
            input_tokens: 3,
            output_tokens: 4,
            total_tokens: 7,
          },
          latency_ms: 25,
          fallback_used: false,
          degraded: false,
          created_at: 1000,
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      errors: [],
      posture: projectionPosture(),
    };
    const safeRollup = {
      projection_status: "ok",
      total_calls: 1,
      successful_calls: 1,
      failed_calls: 0,
      degraded_calls: 0,
      fallback_used_calls: 0,
      token_usage_totals: {
        input_tokens: 3,
        output_tokens: 4,
        total_tokens: 7,
      },
      latency_ms: {
        min_ms: 25,
        max_ms: 25,
        average_ms: 25,
      },
      calls_by_model: [{ key: "llama3.2:3b", count: 1 }],
      calls_by_provider_kind: [{ key: "ollama", count: 1 }],
      calls_by_runtime_class: [{ key: "local", count: 1 }],
      calls_by_capability: [{ key: "chat", count: 1 }],
      calls_by_status: [{ key: "success", count: 1 }],
      failures_by_class: [],
      errors: [],
      posture: projectionPosture(),
    };

    expect(
      createModelRuntimeObservabilityView({
        recentCalls: safeRecent,
        rollup: safeRollup,
      }),
    ).toMatchObject({
      status: "ok",
      classification: "metadata_only",
      authority: "read_only",
      data: {
        model_mix: [{ key: "llama3.2:3b", count: 1 }],
        success_count: 1,
        failure_count: 0,
        redaction_status: "metadata_only",
      },
      withheld: false,
    });

    const unsafe = createModelRuntimeObservabilityView({
      recentCalls: {
        ...safeRecent,
        raw_stream_tokens: ["forbidden-token"],
      },
      rollup: safeRollup,
    });

    expect(unsafe).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["unsafe_model_runtime_projection"],
      redaction: {
        unsafe_payload_withheld: true,
      },
    });
    expect(JSON.stringify(unsafe)).not.toContain("forbidden-token");
  });

  it("freezes Phase 13E source against forbidden wiring and payload persistence", () => {
    const projectionSource = sourceFor("src/models/model-call-projection.ts");
    const observabilitySource = sourceFor(
      "src/models/model-runtime-observability.ts",
    );
    const bridgeSource = sourceFor("src/models/model-call-store.ts");
    const eventSource = sourceFor("src/models/model-call-event.ts");
    const runtimeSource = sourceFor("src/models/runtime.ts");
    const smokeSource = sourceFor("scripts/model-runtime-smoke.ts");
    const combined = [
      eventSource,
      bridgeSource,
      projectionSource,
      observabilitySource,
      runtimeSource,
      smokeSource,
    ].join("\n");

    expect(projectionSource).not.toMatch(
      /\bINSERT\b|\bUPDATE\b|\bDELETE\b|appendModelCall|appendEvent|writeEvent/i,
    );
    expect(observabilitySource).not.toMatch(
      /better-sqlite3|withReadonlyDatabase|event-store|appendModelCall|getRecentModelCalls|getModelCallRollup|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
    );
    expect(bridgeSource).not.toMatch(/\bUPDATE\b|\bDELETE\b|truncate|exec\(/i);
    expect(combined).not.toMatch(
      /from\s+["'].*router|router\.|document\.|window\.|React|tsx|tauri|invoke\(/i,
    );
    expect(combined).not.toMatch(
      /writeTelemetry|persistTelemetry|telemetryStore|telemetryWriter/i,
    );
    expect(combined).not.toMatch(
      /setInterval|setTimeout|while\s*\(\s*true\s*\)|backgroundLoop|worker|queue|retryLoop/i,
    );
    expect(combined).not.toMatch(
      /\bnew\s+(?:OpenAI|Anthropic)\b|anthropic\.messages|openai\.chat|cloud.*complete|cloud.*execute/i,
    );
    expect(combined).not.toMatch(
      /\/api\/pull|ollama\.pull|pullModel|modelPull|auto-?install|downloadModel|npm\s+install/i,
    );
    expect(projectionSource + observabilitySource).not.toMatch(
      /createModelRuntime\(|\.execute\(|\.complete\(|\.stream\(|createOllama|createMock|provider\./i,
    );
  });

  it("keeps smoke scripts manual-only and non-persistent", () => {
    const packageJson = JSON.parse(sourceFor("package.json")) as {
      readonly scripts: Record<string, string>;
    };
    const smokeSource = sourceFor("scripts/model-runtime-smoke.ts");

    expect(packageJson.scripts["smoke:model-runtime"]).toBe(
      "tsx scripts/model-runtime-smoke.ts",
    );
    expect(packageJson.scripts["smoke:model-runtime:stream"]).toBe(
      "tsx scripts/model-runtime-smoke.ts --stream",
    );
    for (const lifecycle of ["dev", "build", "test", "prepare"] as const) {
      expect(packageJson.scripts[lifecycle]).not.toContain(
        "smoke:model-runtime",
      );
    }
    expect(smokeSource).toContain("isDirectCliInvocation");
    expect(smokeSource).not.toMatch(/appendModelCall|persistence:\s*\{/i);
    expect(smokeSource).not.toMatch(/allow_cloud|runtime_class:\s*["']cloud/i);
  });
});

function projectionPosture() {
  return {
    metadata_only: true,
    raw_payload_included: false,
    secrets_included: false,
    executable_payload_included: false,
    network_called: false,
    ui_rendered: false,
  };
}
