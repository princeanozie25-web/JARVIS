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

const MODEL_SOURCE_FILES = [
  "src/models/index.ts",
  "src/models/types.ts",
  "src/models/schema.ts",
  "src/models/registry.ts",
  "src/models/resolver.ts",
  "src/models/runtime.ts",
  "src/models/providers/contract.ts",
  "src/models/providers/mock-provider.ts",
  "src/models/providers/ollama-provider.ts",
  "src/models/providers/ollama-client.ts",
  "scripts/model-runtime-smoke.ts",
] as const;

const APPROVED_NETWORK_FILE = "src/models/providers/ollama-client.ts";

function sourceFor(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function phase13cSource(): string {
  return MODEL_SOURCE_FILES.map(sourceFor).join("\n");
}

function sourceOutsideApprovedAdapter(): string {
  return MODEL_SOURCE_FILES.filter((path) => path !== APPROVED_NETWORK_FILE)
    .map(sourceFor)
    .join("\n");
}

function closeoutRegistry() {
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
    supports_streaming: false
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
    supports_streaming: false
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
    supports_streaming: false
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
    request_id: "phase-13c-closeout-request",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Phase 13C raw prompt" }],
    },
    resolver_options: {
      runtime_class: "local",
    },
    options: {},
    timeout_ms: 5_000,
    ...overrides,
  };
}

function key(id: string) {
  return createModelRuntimeProviderKey({ provider: "ollama", id });
}

function createProvider(input: {
  readonly id?: string;
  readonly kind?: ModelProvider["kind"];
  readonly runtime_class?: ModelProvider["runtime_class"];
  readonly failureClass?: ModelProviderFailureClass | null;
}) {
  const calls: ModelProviderRequest[] = [];
  const providerId = input.id ?? "phase-13c-provider";
  const provider: ModelProvider = {
    id: providerId,
    kind: input.kind ?? "ollama",
    runtime_class: input.runtime_class ?? "local",
    capabilities: ["chat"],
    metadata: {
      provider_id: providerId,
      display_name: "Phase 13C Provider",
      runtime_class: input.runtime_class ?? "local",
      supported_capabilities: ["chat"],
      supports_streaming: false,
      supports_abort: true,
      supports_timeout: true,
      governance_notes: "Closeout test provider.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      calls.push(structuredClone({ ...request, abort_signal: undefined }));
      if (input.failureClass) {
        throw providerError(providerId, request, input.failureClass);
      }
      return providerResponse(providerId, request);
    },
    stream: async function* () {
      throw new Error("stream must not be invoked by closeout runtime tests.");
    },
    health: async () => {
      throw new Error("health must not be invoked by closeout runtime tests.");
    },
  };

  return { provider, calls };
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
      content: `phase13c:${request.model_id}:raw response text`,
    },
    latency_ms: 3,
    token_usage: {
      input_tokens: 2,
      output_tokens: 2,
      total_tokens: 4,
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
    message: `Forced ${failureClass} failure.`,
    retryable: false,
    degraded: true,
    redaction_status: "metadata_only",
  };
}

describe("Phase 13C runtime closeout", () => {
  it("keeps router, event-store, telemetry writer, UI, Tauri, SDK execution, and cloud execution wiring absent", () => {
    const source = phase13cSource();

    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|mutateRouter|routeModel|routeRequest/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*(?:event-store|eventStore)|event-store|eventStore|writeEvent/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore|telemetryWriter/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx component/i);
    expect(source).not.toMatch(/tauri|invoke\(|listen\(/i);
    expect(source).not.toMatch(
      /\bnew\s+(?:OpenAI|Anthropic)\b|anthropic\.messages|openai\.chat|cloud.*complete|cloud.*execute/i,
    );
  });

  it("keeps network calls isolated, localhost-defaulted, and free of provider install/download paths", () => {
    const outsideAdapter = sourceOutsideApprovedAdapter();
    const adapter = sourceFor(APPROVED_NETWORK_FILE);
    const packageJson = sourceFor("package.json");

    expect(packageJson).not.toMatch(/"ollama"\s*:/i);
    expect(outsideAdapter).not.toMatch(
      /\bfetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk|ollama)["']/,
    );
    expect(adapter).toContain("http://127.0.0.1:11434");
    expect(adapter).not.toMatch(/process\.env|import\.meta\.env/i);
    expect(phase13cSource()).not.toMatch(
      /\/api\/pull|ollama\.pull|pullModel|modelPull|auto-?install|npm\s+install|downloadModel/i,
    );
  });

  it("keeps runtime construction side-effect free with no provider construction, probing, or execution on import", () => {
    const source = sourceFor("src/models/runtime.ts");
    const provider = createProvider({});

    createModelRuntime({
      registry: closeoutRegistry(),
      providers: { [key("local-primary")]: provider.provider },
    });

    expect(provider.calls).toEqual([]);
    expect(source).not.toMatch(/createOllama|createMock|new\s+Provider/i);
    expect(source).not.toMatch(/\.health\(|pollHealth|healthPoll/i);
    expect(source).not.toMatch(
      /setInterval|while\s*\(\s*true\s*\)|worker|queue/i,
    );
    expect(source).toContain("provider.stream");
  });

  it("requires explicit runtime invocation for execution", async () => {
    const provider = createProvider({});
    const runtime = createModelRuntime({
      registry: closeoutRegistry(),
      providers: { [key("local-primary")]: provider.provider },
    });

    expect(provider.calls).toEqual([]);
    await runtime.execute(runtimeRequest());
    expect(provider.calls).toHaveLength(1);
  });

  it("blocks cloud execution even when resolver planning can see cloud candidates", async () => {
    const cloud = createProvider({
      id: "cloud-provider",
      kind: "anthropic",
      runtime_class: "cloud",
    });
    const runtime = createModelRuntime({
      registry: closeoutRegistry(),
      providers: { "anthropic:cloud-candidate": cloud.provider },
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
    expect(result.metadata.attempted_models).toEqual(["cloud-candidate"]);
    expect(result.metadata.failure_class).toBe("policy_blocked");
    expect(result.metadata.execution_summary).toMatchObject({
      selected_model_id: "cloud-candidate",
      runtime_class: "cloud",
      provider_kind: "anthropic",
      failure_class: "policy_blocked",
      redaction_status: "metadata_only",
    });
    expect(cloud.calls).toEqual([]);
  });

  it("executes fallback only across governance-equivalent candidates", async () => {
    const primary = createProvider({ failureClass: "provider_error" });
    const fallback = createProvider({ id: "fallback-provider" });
    const disabled = createProvider({ id: "disabled-provider" });
    const runtime = createModelRuntime({
      registry: closeoutRegistry(),
      providers: {
        [key("local-primary")]: primary.provider,
        [key("local-fallback")]: fallback.provider,
        [key("disabled-local")]: disabled.provider,
      },
    });

    const result = await runtime.execute(runtimeRequest());

    expect(result.ok).toBe(true);
    expect(result.metadata.attempted_models).toEqual([
      "local-primary",
      "local-fallback",
    ]);
    expect(result.metadata.successful_model).toBe("local-fallback");
    expect(result.metadata.fallback_used).toBe(true);
    expect(result.metadata.execution_summary.fallback_chain).toEqual([
      "local-fallback",
    ]);
    expect(disabled.calls).toEqual([]);
  });

  it("keeps execution summaries metadata-only and numeric-only for token usage", async () => {
    const provider = createProvider({});
    const runtime = createModelRuntime({
      registry: closeoutRegistry(),
      providers: { [key("local-primary")]: provider.provider },
      now: createClock(1000, 1030),
    });

    const result = await runtime.execute(runtimeRequest());
    const summary = result.metadata.execution_summary;

    expect(summary).toMatchObject({
      execution_id: "phase-13c-closeout-request",
      request_id: "phase-13c-closeout-request",
      capability: "chat",
      selected_model_id: "local-primary",
      selected_provider: "phase-13c-provider",
      successful_model: "local-primary",
      fallback_used: false,
      fallback_chain: ["local-fallback"],
      latency_ms: 30,
      token_usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      },
      finish_reason: "stop",
      redaction_status: "metadata_only",
      runtime_class: "local",
      provider_kind: "ollama",
      started_at: 1000,
      ended_at: 1030,
    });
    expect(JSON.stringify(summary)).not.toContain("Phase 13C raw prompt");
    expect(JSON.stringify(summary)).not.toContain("raw response text");
  });

  it("keeps failed execution summaries safe and fail-closed", async () => {
    const provider = createProvider({ failureClass: "timeout" });
    const runtime = createModelRuntime({
      registry: closeoutRegistry(),
      providers: { [key("local-primary")]: provider.provider },
    });

    const result = await runtime.execute(
      runtimeRequest({ resolver_options: { max_priority: 15 } }),
    );

    expect(result.ok).toBe(false);
    expect(result.metadata.execution_summary).toMatchObject({
      selected_model_id: "local-primary",
      attempted_models: ["local-primary"],
      successful_model: null,
      fallback_used: false,
      failure_class: "timeout",
      token_usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      finish_reason: "error",
      redaction_status: "metadata_only",
      degraded: true,
    });
    expect(JSON.stringify(result.metadata.execution_summary)).not.toContain(
      "Phase 13C raw prompt",
    );
  });

  it("keeps the smoke harness manual-only and out of lifecycle scripts", () => {
    const packageJson = JSON.parse(sourceFor("package.json")) as {
      readonly scripts: Record<string, string>;
    };
    const smokeSource = sourceFor("scripts/model-runtime-smoke.ts");

    expect(packageJson.scripts["smoke:model-runtime"]).toBe(
      "tsx scripts/model-runtime-smoke.ts",
    );
    expect(packageJson.scripts.prepare).toBe("husky");
    expect(packageJson.scripts.prepare).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.dev).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.build).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.test).not.toContain("smoke:model-runtime");
    expect(smokeSource).toContain("isDirectCliInvocation");
    expect(smokeSource).not.toMatch(/setInterval|pollHealth|healthPoll/i);
  });
});

function createClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
