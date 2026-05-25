import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createModelRegistryFromYaml,
  createModelRuntime,
  createModelRuntimeProviderKey,
  type ModelProvider,
  type ModelProviderError,
  type ModelProviderFailureClass,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "../../src/models";

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
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Local Primary
      description: Local primary model metadata.
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
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Local Fallback
      description: Local fallback model metadata.
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
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Disabled Local
      description: Disabled local model metadata.
      approximate_memory_mb: 2048
      cost_class: local_free
      governance_notes: Metadata only.
  - id: cloud-fallback
    provider: anthropic
    tier: T3
    runtime_class: cloud
    capabilities: [chat]
    context_window: 200000
    visibility: disabled
    priority: 40
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Cloud Fallback
      description: Cloud model metadata retained disabled.
      approximate_memory_mb: null
      cost_class: cloud_metered
      governance_notes: Disabled by default.
`);
}

function runtimeRequest(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "runtime-request-1",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Runtime check" }],
    },
    resolver_options: {
      runtime_class: "local",
    },
    options: {
      temperature: 0,
    },
    timeout_ms: 5_000,
    ...overrides,
  };
}

function key(id: string) {
  return createModelRuntimeProviderKey({ provider: "ollama", id });
}

interface RecordingProviderOptions {
  readonly providerId?: string;
  readonly failureClass?: ModelProviderFailureClass | null;
  readonly responseLatencyMs?: number;
}

function createRecordingProvider(options: RecordingProviderOptions = {}) {
  const calls: ModelProviderRequest[] = [];
  const providerId = options.providerId ?? "ollama-test-provider";
  const provider: ModelProvider = {
    id: providerId,
    kind: "ollama",
    runtime_class: "local",
    capabilities: ["chat"],
    metadata: {
      provider_id: providerId,
      display_name: "Recording Local Provider",
      runtime_class: "local",
      supported_capabilities: ["chat"],
      supports_streaming: false,
      supports_abort: true,
      supports_timeout: true,
      governance_notes: "Test provider only.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      calls.push(structuredClone({ ...request, abort_signal: undefined }));
      if (options.failureClass) {
        throw createProviderError(providerId, request, options.failureClass);
      }
      return createProviderResponse(
        providerId,
        request,
        options.responseLatencyMs ?? 0,
      );
    },
    stream: async function* () {
      throw new Error("stream must not be invoked by the runtime.");
    },
    health: async () => {
      throw new Error("health must not be invoked by the runtime.");
    },
  };

  return { provider, calls };
}

function createProviderResponse(
  providerId: string,
  request: ModelProviderRequest,
  latencyMs: number,
): ModelProviderResponse {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    output: {
      kind: "text",
      content: `runtime:${request.model_id}`,
    },
    latency_ms: latencyMs,
    token_usage: {
      input_tokens: 2,
      output_tokens: 1,
      total_tokens: 3,
    },
    finish_reason: "stop",
    degraded: false,
    redaction_status: "metadata_only",
  };
}

function createProviderError(
  providerId: string,
  request: ModelProviderRequest,
  failureClass: ModelProviderFailureClass,
): ModelProviderError {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: providerId,
    failure_class: failureClass,
    message: `Forced ${failureClass} failure.`,
    retryable: failureClass === "timeout" || failureClass === "unavailable",
    degraded: true,
    redaction_status: "metadata_only",
  };
}

describe("Phase 13C.3 local model runtime", () => {
  it("executes a selected local provider explicitly", async () => {
    const primary = createRecordingProvider({ responseLatencyMs: 11 });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
      },
      now: createClock(100, 125),
    });

    await expect(runtime.execute(runtimeRequest())).resolves.toMatchObject({
      request_id: "runtime-request-1",
      ok: true,
      response: {
        model_id: "local-primary",
        output: {
          kind: "text",
          content: "runtime:local-primary",
        },
      },
      metadata: {
        selected_model_id: "local-primary",
        attempted_models: ["local-primary"],
        successful_model: "local-primary",
        failed_models: [],
        fallback_used: false,
        latency_ms: 25,
        degraded: false,
      },
    });
    expect(primary.calls).toHaveLength(1);
    expect(primary.calls[0]).toMatchObject({
      request_id: "runtime-request-1",
      model_id: "local-primary",
      capability: "chat",
      timeout_ms: 5_000,
      options: { temperature: 0 },
      provenance: {
        request_origin: "model_runtime",
        metadata_only: true,
        correlation_id: "runtime-request-1",
        requested_at_ms: 100,
      },
    });
  });

  it("returns a normalized successful execution summary without raw payloads", async () => {
    const primary = createRecordingProvider({ responseLatencyMs: 11 });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
      },
      now: createClock(100, 125),
    });

    const result = await runtime.execute(runtimeRequest());

    expect(result.metadata.execution_summary).toEqual({
      execution_id: "runtime-request-1",
      request_id: "runtime-request-1",
      capability: "chat",
      selected_model_id: "local-primary",
      selected_provider: "ollama-test-provider",
      attempted_models: ["local-primary"],
      successful_model: "local-primary",
      failed_models: [],
      fallback_used: false,
      fallback_chain: ["local-fallback"],
      latency_ms: 25,
      token_usage: {
        input_tokens: 2,
        output_tokens: 1,
        total_tokens: 3,
      },
      degraded: false,
      finish_reason: "stop",
      governance_flags: [
        "cloud_opt_in_required",
        "disabled_model_opt_in_required",
      ],
      redaction_status: "metadata_only",
      runtime_class: "local",
      provider_kind: "ollama",
      started_at: 100,
      ended_at: 125,
    });
    expect(JSON.stringify(result.metadata)).not.toContain("Runtime check");
    expect(JSON.stringify(result.metadata)).not.toContain(
      "runtime:local-primary",
    );
  });

  it("fails closed when the selected provider is missing", async () => {
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {},
    });

    await expect(runtime.execute(runtimeRequest())).resolves.toMatchObject({
      ok: false,
      response: null,
      metadata: {
        selected_model_id: "local-primary",
        attempted_models: ["local-primary", "local-fallback"],
        successful_model: null,
        fallback_used: false,
        failed_models: [
          {
            model_id: "local-primary",
            failure_class: "unavailable",
          },
          {
            model_id: "local-fallback",
            failure_class: "unavailable",
          },
        ],
        failure_class: "unavailable",
        degraded: true,
        execution_summary: {
          execution_id: "runtime-request-1",
          selected_model_id: "local-primary",
          selected_provider: null,
          attempted_models: ["local-primary", "local-fallback"],
          successful_model: null,
          fallback_used: false,
          fallback_chain: ["local-fallback"],
          failure_class: "unavailable",
          token_usage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
          finish_reason: "error",
          redaction_status: "metadata_only",
          runtime_class: "local",
          provider_kind: "ollama",
        },
      },
    });
  });

  it("fails closed when no eligible model exists", async () => {
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {},
    });

    await expect(
      runtime.execute(runtimeRequest({ capability: "embed" })),
    ).resolves.toMatchObject({
      ok: false,
      response: null,
      metadata: {
        selected_model_id: null,
        attempted_models: [],
        successful_model: null,
        fallback_used: false,
        failure_class: "model_missing",
        degraded: true,
        governance_flags: ["no_eligible_models", "capability_unavailable"],
        execution_summary: {
          execution_id: "runtime-request-1",
          capability: "embed",
          selected_model_id: null,
          attempted_models: [],
          failed_models: [],
          failure_class: "model_missing",
          token_usage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
          runtime_class: null,
          provider_kind: null,
          redaction_status: "metadata_only",
        },
      },
    });
  });

  it("falls back within governance-equivalent local enabled models", async () => {
    const primary = createRecordingProvider({ failureClass: "provider_error" });
    const fallback = createRecordingProvider({
      providerId: "fallback-provider",
    });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
        [key("local-fallback")]: fallback.provider,
      },
    });

    await expect(runtime.execute(runtimeRequest())).resolves.toMatchObject({
      ok: true,
      response: {
        model_id: "local-fallback",
        provider_id: "fallback-provider",
      },
      metadata: {
        selected_model_id: "local-primary",
        attempted_models: ["local-primary", "local-fallback"],
        successful_model: "local-fallback",
        failed_models: [
          {
            model_id: "local-primary",
            failure_class: "provider_error",
          },
        ],
        fallback_used: true,
        degraded: true,
        execution_summary: {
          selected_model_id: "local-primary",
          selected_provider: "fallback-provider",
          attempted_models: ["local-primary", "local-fallback"],
          successful_model: "local-fallback",
          fallback_used: true,
          fallback_chain: ["local-fallback"],
          failed_models: [
            {
              model_id: "local-primary",
              provider_id: "ollama-test-provider",
              failure_class: "provider_error",
            },
          ],
          degraded: true,
          runtime_class: "local",
          provider_kind: "ollama",
        },
      },
    });
    expect(primary.calls).toHaveLength(1);
    expect(fallback.calls).toHaveLength(1);
  });

  it("does not implicitly escalate local failures to cloud or disabled models", async () => {
    const primary = createRecordingProvider({ failureClass: "provider_error" });
    const fallback = createRecordingProvider({
      failureClass: "provider_error",
    });
    const disabled = createRecordingProvider({
      providerId: "disabled-provider",
    });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
        [key("local-fallback")]: fallback.provider,
        [key("disabled-local")]: disabled.provider,
      },
    });

    const result = await runtime.execute(runtimeRequest());

    expect(result.ok).toBe(false);
    expect(result.metadata.attempted_models).toEqual([
      "local-primary",
      "local-fallback",
    ]);
    expect(disabled.calls).toEqual([]);
    expect(result.metadata.governance_flags).toContain("cloud_opt_in_required");
    expect(result.metadata.governance_flags).toContain(
      "disabled_model_opt_in_required",
    );
  });

  it("does not execute cloud providers even when cloud planning is explicitly requested", async () => {
    const cloudCalls: ModelProviderRequest[] = [];
    const cloudProvider: ModelProvider = {
      ...createRecordingProvider({ providerId: "cloud-provider" }).provider,
      id: "cloud-provider",
      kind: "anthropic",
      runtime_class: "cloud",
      complete: async (request) => {
        cloudCalls.push(request);
        return createProviderResponse("cloud-provider", request, 0);
      },
    };
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        "anthropic:cloud-fallback": cloudProvider,
      },
    });

    const result = await runtime.execute(
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

    expect(result.ok).toBe(false);
    expect(result.metadata.attempted_models).toEqual(["cloud-fallback"]);
    expect(result.metadata.failure_class).toBe("policy_blocked");
    expect(cloudCalls).toEqual([]);
  });

  it("fails closed on malformed execution requests", async () => {
    const provider = createRecordingProvider();
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: provider.provider,
      },
    });

    await expect(
      runtime.execute({
        request_id: "bad-runtime-request",
        capability: "bogus",
        input: { kind: "text", content: "bad" },
        timeout_ms: 5_000,
      }),
    ).resolves.toMatchObject({
      request_id: "bad-runtime-request",
      ok: false,
      metadata: {
        failure_class: "invalid_request",
        attempted_models: [],
        degraded: true,
      },
    });
    expect(provider.calls).toEqual([]);
  });

  it("propagates provider failure classes when no fallback succeeds", async () => {
    const provider = createRecordingProvider({
      failureClass: "provider_error",
    });
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: provider.provider,
      },
    });

    await expect(
      runtime.execute(
        runtimeRequest({ resolver_options: { max_priority: 15 } }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      metadata: {
        attempted_models: ["local-primary"],
        failed_models: [
          {
            model_id: "local-primary",
            provider_id: "ollama-test-provider",
            failure_class: "provider_error",
            message: "Forced provider_error failure.",
          },
        ],
        failure_class: "provider_error",
      },
    });
  });

  it("propagates timeout and cancellation to provider.complete", async () => {
    const timeoutProvider = createRecordingProvider({
      failureClass: "timeout",
    });
    const cancelProvider = createRecordingProvider({
      failureClass: "cancelled",
    });
    const abortController = new AbortController();
    const timeoutRuntime = createModelRuntime({
      registry: localRegistry(),
      providers: { [key("local-primary")]: timeoutProvider.provider },
    });
    const cancelRuntime = createModelRuntime({
      registry: localRegistry(),
      providers: { [key("local-primary")]: cancelProvider.provider },
    });

    await expect(
      timeoutRuntime.execute(
        runtimeRequest({
          timeout_ms: 17,
          resolver_options: { max_priority: 15 },
        }),
      ),
    ).resolves.toMatchObject({
      metadata: {
        failure_class: "timeout",
        execution_summary: {
          failure_class: "timeout",
          finish_reason: "error",
          redaction_status: "metadata_only",
        },
      },
    });
    await expect(
      cancelRuntime.execute(
        runtimeRequest({
          abort_signal: abortController.signal,
          resolver_options: { max_priority: 15 },
        }),
      ),
    ).resolves.toMatchObject({
      metadata: {
        failure_class: "cancelled",
        execution_summary: {
          failure_class: "cancelled",
          finish_reason: "error",
          redaction_status: "metadata_only",
        },
      },
    });
    expect(timeoutProvider.calls[0].timeout_ms).toBe(17);
    expect(cancelProvider.calls[0].request_id).toBe("runtime-request-1");
  });

  it("keeps attempted model ordering deterministic and marks fallback_used only on successful fallback", async () => {
    const first = createRecordingProvider({ failureClass: "unavailable" });
    const second = createRecordingProvider();
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: first.provider,
        [key("local-fallback")]: second.provider,
      },
    });

    const firstRun = await runtime.execute(runtimeRequest());
    const secondRun = await runtime.execute(runtimeRequest());

    expect(firstRun.metadata.attempted_models).toEqual([
      "local-primary",
      "local-fallback",
    ]);
    expect(secondRun.metadata.attempted_models).toEqual(
      firstRun.metadata.attempted_models,
    );
    expect(firstRun.metadata.fallback_used).toBe(true);
  });

  it("returns defensive-copy safe execution metadata", async () => {
    const primary = createRecordingProvider({ failureClass: "unavailable" });
    const fallback = createRecordingProvider();
    const runtime = createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
        [key("local-fallback")]: fallback.provider,
      },
    });

    const first = await runtime.execute(runtimeRequest());
    (first.metadata.execution_summary.attempted_models as string[]).push(
      "mutated-model",
    );
    (first.metadata.execution_summary.failed_models as unknown[]).push({
      model_id: "mutated-model",
      provider_id: "mutated-provider",
      failure_class: "provider_error",
      message: "mutated",
    });

    const second = await runtime.execute(runtimeRequest());
    expect(second.metadata.execution_summary.attempted_models).toEqual([
      "local-primary",
      "local-fallback",
    ]);
    expect(second.metadata.execution_summary.failed_models).toEqual([
      expect.objectContaining({
        model_id: "local-primary",
        failure_class: "unavailable",
      }),
    ]);
  });

  it("does not call provider.complete during runtime construction", () => {
    const provider = createRecordingProvider();

    createModelRuntime({
      registry: localRegistry(),
      providers: {
        [key("local-primary")]: provider.provider,
      },
    });

    expect(provider.calls).toEqual([]);
  });

  it("keeps runtime source free of provider construction, streaming orchestration, health polling, network, SDK, router, telemetry, event-store, UI, and Tauri wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/runtime.ts"),
      "utf8",
    );
    const modelSourceOutsideAdapter = [
      "src/models/index.ts",
      "src/models/types.ts",
      "src/models/schema.ts",
      "src/models/registry.ts",
      "src/models/resolver.ts",
      "src/models/runtime.ts",
      "src/models/providers/contract.ts",
      "src/models/providers/mock-provider.ts",
      "src/models/providers/ollama-provider.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/createOllama|createMock|new\s+Provider/i);
    expect(source).not.toMatch(/\.stream\(|\.health\(|pollHealth|setInterval/i);
    expect(modelSourceOutsideAdapter).not.toMatch(
      /\bfetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk|ollama)["']/,
    );
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|event-store|eventStore|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|tauri|invoke\(/i);
    expect(source).not.toMatch(
      /fallback(?:Execution|Executor|Execute|Run\b|Runner|Invoke)|autoFallback|orchestrat|install|download|\/api\/pull/i,
    );
  });
});

function createClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
