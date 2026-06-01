import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendModelCallEvent,
  createFakeOllamaClient,
  createModelCallEvent,
  createModelRegistryFromYaml,
  createModelRuntime,
  createModelRuntimeObservabilityView,
  createModelRuntimeProviderKey,
  createOllamaHttpClient,
  createOllamaModelProvider,
  getModelCallRollup,
  getRecentModelCalls,
  loadDefaultModelRegistry,
  resolveModel,
  type ModelCallEvent,
  type ModelProvider,
  type ModelProviderError,
  type ModelProviderFailureClass,
  type ModelProviderRequest,
  type ModelProviderResponse,
  type ModelProviderStreamEvent,
  type ModelRuntimeExecutionSummary,
  type OllamaFetchImpl,
} from "../../src/models";
import { initializeEventStore } from "../../src/store/event-store";

const tempDirs: string[] = [];

const PHASE_13_SOURCE_FILES = [
  "src/models/types.ts",
  "src/models/schema.ts",
  "src/models/registry.ts",
  "src/models/providers/contract.ts",
  "src/models/providers/mock-provider.ts",
  "src/models/providers/ollama-client.ts",
  "src/models/providers/ollama-provider.ts",
  "src/models/providers/deepseek-client.ts",
  "src/models/providers/deepseek-provider.ts",
  "src/models/resolver.ts",
  "src/models/runtime.ts",
  "src/models/model-call-event.ts",
  "src/models/model-call-store.ts",
  "src/models/model-call-projection.ts",
  "src/models/model-runtime-observability.ts",
  "scripts/model-runtime-smoke.ts",
] as const;

const PHASE_13_APPROVED_NETWORK_FILES = new Set([
  "src/models/providers/ollama-client.ts",
  "src/models/providers/deepseek-client.ts",
]);

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function databasePath() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-phase-13-closeout-"));
  tempDirs.push(dir);
  return join(dir, "events.sqlite");
}

function sourceFor(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function phase13Source(): string {
  return PHASE_13_SOURCE_FILES.map(sourceFor).join("\n");
}

function localRegistry() {
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
  - id: local-fallback
    provider: ollama
    tier: T2
    runtime_class: local
    capabilities: [chat]
    context_window: 4096
    visibility: enabled
    priority: 20
    supports_streaming: true
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Local Fallback
      description: Local fallback metadata.
      approximate_memory_mb: 2048
      cost_class: local_free
      governance_notes: Metadata only.
  - id: disabled-local
    provider: ollama
    tier: T2
    runtime_class: local
    capabilities: [chat]
    context_window: 4096
    visibility: disabled
    priority: 30
    supports_streaming: true
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Disabled Local
      description: Disabled local metadata.
      approximate_memory_mb: 2048
      cost_class: local_free
      governance_notes: Disabled metadata only.
  - id: cloud-candidate
    provider: anthropic
    tier: T3
    runtime_class: cloud
    capabilities: [chat]
    context_window: 200000
    visibility: disabled
    priority: 40
    supports_streaming: true
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Cloud Candidate
      description: Cloud metadata retained disabled.
      approximate_memory_mb: null
      cost_class: cloud_metered
      governance_notes: Disabled by default.
`);
}

function runtimeRequest(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "phase-13-closeout-request",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Phase 13 raw prompt" }],
    },
    resolver_options: {
      runtime_class: "local",
    },
    options: {},
    timeout_ms: 5_000,
    ...overrides,
  };
}

function provider(input: {
  readonly id?: string;
  readonly failureClass?: ModelProviderFailureClass | null;
  readonly streamFailureAfterToken?: boolean;
}) {
  const providerId = input.id ?? "phase-13-provider";
  const completeCalls: ModelProviderRequest[] = [];
  const streamCalls: ModelProviderRequest[] = [];
  const modelProvider: ModelProvider = {
    id: providerId,
    kind: "ollama",
    runtime_class: "local",
    capabilities: ["chat"],
    metadata: {
      provider_id: providerId,
      display_name: "Phase 13 Provider",
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
      if (input.failureClass)
        throw providerError(providerId, request, input.failureClass);
      return providerResponse(providerId, request);
    },
    stream: async function* (request) {
      streamCalls.push(
        structuredClone({ ...request, abort_signal: undefined }),
      );
      yield token(providerId, request, "phase", 0);
      if (input.streamFailureAfterToken) {
        yield streamError(providerId, request, "provider_error");
        return;
      }
      yield token(providerId, request, "13", 1);
      yield done(providerId, request);
    },
    health: async () => {
      throw new Error("health must not be invoked by final Phase 13 closeout.");
    },
  };
  return { provider: modelProvider, completeCalls, streamCalls };
}

function providerResponse(
  providerId: string,
  request: ModelProviderRequest,
): ModelProviderResponse {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    output: {
      kind: "text",
      content: `Phase 13 raw response for ${request.model_id}`,
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

function providerError(
  providerId: string,
  request: ModelProviderRequest,
  failureClass: ModelProviderFailureClass,
): ModelProviderError {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    failure_class: failureClass,
    message: `Forced ${failureClass}.`,
    retryable: false,
    degraded: true,
    redaction_status: "metadata_only",
  };
}

function token(
  providerId: string,
  request: ModelProviderRequest,
  delta: string,
  index: number,
): ModelProviderStreamEvent {
  return {
    type: "token",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    created_at_ms: index,
    delta,
    index,
    redaction_status: "metadata_only",
  };
}

function streamError(
  providerId: string,
  request: ModelProviderRequest,
  failureClass: ModelProviderFailureClass,
): ModelProviderStreamEvent {
  return {
    type: "error",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    created_at_ms: 2,
    error: providerError(providerId, request, failureClass),
  };
}

function done(
  providerId: string,
  request: ModelProviderRequest,
): ModelProviderStreamEvent {
  return {
    type: "done",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    created_at_ms: 2,
    response: providerResponse(providerId, request),
  };
}

async function collectStream(
  events: AsyncIterable<unknown>,
): Promise<unknown[]> {
  const collected: unknown[] = [];
  for await (const event of events) collected.push(event);
  return collected;
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

function posture() {
  return {
    metadata_only: true,
    raw_payload_included: false,
    secrets_included: false,
    executable_payload_included: false,
    network_called: false,
    ui_rendered: false,
  };
}

describe("Final Phase 13 closeout audit", () => {
  it("keeps registry/schema strict, deterministic, and cloud-disabled by default", () => {
    const registry = loadDefaultModelRegistry();
    const first = registry.listModels().map((model) => model.id);
    const second = loadDefaultModelRegistry()
      .listModels()
      .map((model) => model.id);
    const cloudModels = registry
      .listModels()
      .filter((model) => model.runtime_class === "cloud");

    expect(first).toEqual(second);
    expect(cloudModels.length).toBeGreaterThan(0);
    expect(cloudModels.every((model) => model.visibility === "disabled")).toBe(
      true,
    );
    expect(() =>
      createModelRegistryFromYaml(`
schema_version: 1
models: []
unknown_field: true
`),
    ).toThrow();
  });

  it("keeps Ollama/local provider surfaces explicit and side-effect free", async () => {
    let fetchCalls = 0;
    let listCalls = 0;
    let completeCalls = 0;
    let streamCalls = 0;
    const fetchImpl: OllamaFetchImpl = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
        text: async () => JSON.stringify({ models: [] }),
      };
    };
    const client = createOllamaHttpClient({ fetch_impl: fetchImpl });
    const backingClient = createFakeOllamaClient();
    const ollamaProvider = createOllamaModelProvider({
      client: {
        listModels: async (options) => {
          listCalls += 1;
          return backingClient.listModels(options);
        },
        complete: async (request) => {
          completeCalls += 1;
          return backingClient.complete(request);
        },
        stream: (request) => {
          streamCalls += 1;
          return backingClient.stream(request);
        },
      },
    });

    expect(fetchCalls).toBe(0);
    expect(listCalls).toBe(0);
    expect(completeCalls).toBe(0);
    expect(streamCalls).toBe(0);
    expect(() =>
      createOllamaHttpClient({ base_url: "https://example.com:11434" }),
    ).toThrow(/localhost/);

    await ollamaProvider.health();
    expect(listCalls).toBe(1);
    expect(completeCalls).toBe(0);
    expect(streamCalls).toBe(0);
    await client.listModels({
      request_id: "closeout-list",
      timeout_ms: 5_000,
      metadata_only: true,
    });
    expect(fetchCalls).toBe(1);
  });

  it("blocks cloud execution and allows fallback only across governance-equivalent models", async () => {
    const primary = provider({ failureClass: "provider_error" });
    const fallback = provider({ id: "fallback-provider" });
    const disabled = provider({ id: "disabled-provider" });
    const cloud = provider({ id: "cloud-provider" });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: primary.provider,
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-fallback",
        })]: fallback.provider,
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "disabled-local",
        })]: disabled.provider,
        "anthropic:cloud-candidate": cloud.provider,
      },
    });

    const fallbackResult = await runtime.execute(runtimeRequest());
    expect(fallbackResult.ok).toBe(true);
    expect(fallbackResult.metadata.attempted_models).toEqual([
      "local-primary",
      "local-fallback",
    ]);
    expect(fallbackResult.metadata.successful_model).toBe("local-fallback");
    expect(disabled.completeCalls).toEqual([]);
    expect(cloud.completeCalls).toEqual([]);

    const cloudResult = await runtime.execute(
      runtimeRequest({
        resolver_options: {
          allow_cloud: true,
          allow_disabled: true,
          excluded_model_ids: [
            "local-primary",
            "local-fallback",
            "disabled-local",
          ],
        },
      }),
    );
    expect(cloudResult.ok).toBe(false);
    expect(cloudResult.metadata.failure_class).toBe("policy_blocked");
    expect(cloud.completeCalls).toEqual([]);
  });

  it("keeps resolver planning selection-only with no implicit cloud escalation", () => {
    const registry = localRegistry();
    const defaultResolution = resolveModel(registry, { capability: "chat" });
    const cloudResolution = resolveModel(registry, {
      capability: "chat",
      allow_cloud: true,
      allow_disabled: true,
      excluded_model_ids: ["local-primary", "local-fallback", "disabled-local"],
    });

    expect(defaultResolution.selected?.id).toBe("local-primary");
    expect(
      defaultResolution.candidates
        .filter((candidate) => !candidate.eligible)
        .map((candidate) => ({
          model_id: candidate.entry.id,
          reasons: candidate.rejection_reasons,
        })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model_id: "cloud-candidate",
          reasons: expect.arrayContaining(["disabled", "cloud_not_allowed"]),
        }),
      ]),
    );
    expect(cloudResolution.selected?.id).toBe("cloud-candidate");
  });

  it("keeps runtime streaming safe, terminal once, and without silent fallback after tokens", async () => {
    const primary = provider({ streamFailureAfterToken: true });
    const fallback = provider({ id: "fallback-provider" });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: primary.provider,
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-fallback",
        })]: fallback.provider,
      },
    });

    const events = await collectStream(runtime.stream(runtimeRequest()));
    const terminalEvents = events.filter((event) => {
      const candidate = event as { readonly type?: unknown };
      return (
        candidate.type === "done" ||
        candidate.type === "error" ||
        candidate.type === "cancelled"
      );
    });

    expect(events.map((event) => (event as { type: string }).type)).toEqual([
      "start",
      "token",
      "error",
    ]);
    expect(terminalEvents).toHaveLength(1);
    expect(fallback.streamCalls).toEqual([]);
    expect(JSON.stringify(events)).not.toContain("Phase 13 raw prompt");
    expect(JSON.stringify(events)).not.toContain("Phase 13 raw response");
  });

  it("keeps runtime persistence opt-in and streaming persistence disabled", async () => {
    const localProvider = provider({});
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: localProvider.provider,
      },
    });
    const defaultResult = await runtime.execute(runtimeRequest());
    expect(defaultResult.metadata.persistence).toBeUndefined();

    let appendCalls = 0;
    let streamCreateCalls = 0;
    const persistentRuntime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [createModelRuntimeProviderKey({
          provider: "ollama",
          id: "local-primary",
        })]: localProvider.provider,
      },
      persistence: {
        createEvent: (input) => {
          streamCreateCalls += 1;
          return createModelCallEvent(input);
        },
        appendEvent: () => {
          appendCalls += 1;
          throw new Error("sk-secret Phase 13 raw prompt");
        },
      },
    });

    const persisted = await persistentRuntime.execute(runtimeRequest());
    expect(appendCalls).toBe(1);
    expect(persisted.metadata.persistence).toMatchObject({
      attempted: true,
      persisted: false,
      metadata_only: true,
      error_class: "persistence_failed",
    });
    expect(JSON.stringify(persisted.metadata.persistence)).not.toContain(
      "sk-secret",
    );

    streamCreateCalls = 0;
    appendCalls = 0;
    await collectStream(persistentRuntime.stream(runtimeRequest()));
    expect(streamCreateCalls).toBe(0);
    expect(appendCalls).toBe(0);
  });

  it("keeps persisted model calls metadata-only, append-only, and projection-safe", () => {
    const path = databasePath();
    const store = initializeEventStore({ databasePath: path });
    const modelEvent = event();

    appendModelCallEvent(store, modelEvent);
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
      const row = raw
        .prepare(
          `
            SELECT e.metadata_json, e.payload_json, mc.cloud_call, mc.prompt_payload_retained
            FROM events e
            INNER JOIN model_calls mc ON mc.event_id = e.event_id
          `,
        )
        .get() as {
        readonly metadata_json: string;
        readonly payload_json: null;
        readonly cloud_call: 0;
        readonly prompt_payload_retained: 0;
      };
      expect(row.payload_json).toBeNull();
      expect(row.cloud_call).toBe(0);
      expect(row.prompt_payload_retained).toBe(0);
      expect(JSON.parse(row.metadata_json)).toMatchObject({
        redaction_status: "metadata_only",
        token_usage: {
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        },
      });
      expect(() =>
        raw
          .prepare("UPDATE events SET event_type = ? WHERE event_id = ?")
          .run("changed", "event-execution-1"),
      ).toThrow(/append-only/i);
    } finally {
      raw.close();
    }

    expect(getRecentModelCalls({ databasePath: path })).toMatchObject({
      projection_status: "ok",
      calls: [
        expect.objectContaining({
          model_id: "llama3.2:3b",
          redaction_status: "metadata_only",
          raw_payload_included: false,
        }),
      ],
    });
    expect(getModelCallRollup({ databasePath: path })).toMatchObject({
      projection_status: "ok",
      total_calls: 1,
      token_usage_totals: {
        input_tokens: 3,
        output_tokens: 4,
        total_tokens: 7,
      },
    });
  });

  it("keeps observability adapter read-only, projection-data-only, and metadata-only", () => {
    const response = createModelRuntimeObservabilityView({
      recentCalls: {
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
        posture: posture(),
      },
      rollup: {
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
        posture: posture(),
      },
    });

    expect(response).toMatchObject({
      status: "ok",
      classification: "metadata_only",
      authority: "read_only",
      withheld: false,
      data: {
        model_mix: [{ key: "llama3.2:3b", count: 1 }],
        success_count: 1,
        redaction_status: "metadata_only",
      },
    });
    expect(
      createModelRuntimeObservabilityView({
        recentCalls: {
          projection_status: "ok",
          calls: [],
          errors: [],
          posture: posture(),
          raw_response: "forbidden",
        },
        rollup: {},
      }),
    ).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["unsafe_model_runtime_projection"],
    });
  });

  it("keeps smoke harnesses manual-only and out of lifecycle scripts", () => {
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
  });

  it("freezes Phase 13 source against disabled features and authority widening", () => {
    const source = phase13Source();
    const sourceOutsideApprovedClients = PHASE_13_SOURCE_FILES.filter(
      (path) => !PHASE_13_APPROVED_NETWORK_FILES.has(path),
    )
      .map(sourceFor)
      .join("\n");
    const projectionAndObservability =
      sourceFor("src/models/model-call-projection.ts") +
      sourceFor("src/models/model-runtime-observability.ts");

    expect(sourceOutsideApprovedClients).not.toMatch(
      /\bfetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk|ollama)["']/,
    );
    expect(source).not.toMatch(
      /\bnew\s+(?:OpenAI|Anthropic)\b|anthropic\.messages|openai\.chat|cloud.*complete|cloud.*execute/i,
    );
    expect(source).not.toMatch(/process\.env|import\.meta\.env/i);
    expect(source).not.toMatch(
      /\/api\/pull|ollama\.pull|pullModel|modelPull|auto-?install|downloadModel|npm\s+install/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|document\.|window\.|React|tsx|tauri|invoke\(/i,
    );
    expect(source).not.toMatch(
      /voice|tts|textToSpeech|speechSynthesis|speak\(|audioOutput/i,
    );
    expect(source).not.toMatch(
      /setInterval|while\s*\(\s*true\s*\)|backgroundLoop|healthPoll|pollHealth|retryLoop/i,
    );
    expect(projectionAndObservability).not.toMatch(
      /\bINSERT\b|\bUPDATE\b|\bDELETE\b|appendModelCall|appendEvent|writeEvent|createModelRuntime\(|\.execute\(|\.complete\(|\.stream\(/i,
    );
    expect(sourceFor("src/models/model-call-store.ts")).not.toMatch(
      /\bUPDATE\b|\bDELETE\b|truncate|exec\(/i,
    );
    expect(source).not.toMatch(
      /raw[_-]?prompt.*persist|raw[_-]?response.*persist|stream[_-]?tokens.*persist|provider[_-]?payload.*persist|http[_-]?(?:request|response)[_-]?body.*persist/i,
    );
  });
});
