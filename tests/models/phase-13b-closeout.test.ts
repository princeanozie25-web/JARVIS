import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createFakeOllamaClient,
  createMockModelProvider,
  createOllamaHttpClient,
  createOllamaModelProvider,
  loadDefaultModelRegistry,
  type OllamaClient,
  type OllamaCompleteRequest,
  type OllamaFetchImpl,
} from "../../src/models";
import type {
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "../../src/models/providers/contract";

const MODEL_SOURCE_FILES = [
  "src/models/index.ts",
  "src/models/types.ts",
  "src/models/schema.ts",
  "src/models/registry.ts",
  "src/models/providers/contract.ts",
  "src/models/providers/mock-provider.ts",
  "src/models/providers/ollama-provider.ts",
  "src/models/providers/ollama-client.ts",
  "src/models/providers/deepseek-provider.ts",
  "src/models/providers/deepseek-client.ts",
] as const;

const APPROVED_NETWORK_FILES = new Set([
  "src/models/providers/ollama-client.ts",
  "src/models/providers/deepseek-client.ts",
]);

function sourceFor(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function modelSource(): string {
  return MODEL_SOURCE_FILES.map(sourceFor).join("\n");
}

function modelSourceOutsideApprovedAdapter(): string {
  return MODEL_SOURCE_FILES.filter((path) => !APPROVED_NETWORK_FILES.has(path))
    .map(sourceFor)
    .join("\n");
}

function request(
  overrides: Partial<ModelProviderRequest> = {},
): ModelProviderRequest {
  return {
    request_id: "phase-13b-closeout-request-1",
    model_id: "llama3.2:3b",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Phase 13B closeout" }],
    },
    options: {},
    timeout_ms: 5_000,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "phase-13b-closeout-correlation-1",
      requested_at_ms: 0,
      caller: "test_harness",
    },
    ...overrides,
  };
}

async function collect(
  events: AsyncIterable<ModelProviderStreamEvent>,
): Promise<ModelProviderStreamEvent[]> {
  const collected: ModelProviderStreamEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe("Phase 13B Ollama provider closeout", () => {
  it("keeps router, provider selection, fallback, orchestration, UI, Tauri, event-store, and telemetry authority absent", () => {
    const source = modelSource();

    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|mutateRouter|selectProvider|providerSelection|routeModel|routeRequest/i,
    );
    expect(source).not.toMatch(
      /fallback.*(?:execute|run|provider)|autoFallback|providerFallback/i,
    );
    expect(source).not.toMatch(
      /orchestrat|scheduler|worker|queue|setInterval|while\s*\(\s*true\s*\)|backgroundLoop/i,
    );
    expect(source).not.toMatch(
      /event-store|eventStore|writeEvent|appendEvent/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|component/i);
    expect(source).not.toMatch(/tauri|invoke\(|emit\(|listen\(/i);
  });

  it("keeps cloud SDKs, cloud inference, installation, downloads, env auto configuration, and auto polling absent", () => {
    const source = modelSource();
    const packageJson = sourceFor("package.json");

    expect(packageJson).not.toMatch(/"ollama"\s*:/i);
    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(
      /\bnew\s+(?:OpenAI|Anthropic)\b|anthropic\.messages|openai\.chat|cloud.*complete|cloud.*inference/i,
    );
    expect(source).not.toMatch(
      /\b(?:install|download|pullModel|modelPull|ollama\.pull|\/api\/pull)\b/i,
    );
    expect(source).not.toMatch(/process\.env|import\.meta\.env/i);
    expect(source).not.toMatch(/pollHealth|healthPoll|autoHealth|setInterval/i);
  });

  it("keeps fetch and network imports isolated to the approved Ollama adapter", () => {
    const outsideAdapter = modelSourceOutsideApprovedAdapter();
    const adapter =
      sourceFor("src/models/providers/ollama-client.ts") +
      sourceFor("src/models/providers/deepseek-client.ts");

    expect(outsideAdapter).not.toMatch(
      /\bfetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https)["']/,
    );
    expect(adapter).toContain("globalThis.fetch");
    expect(adapter).toContain("createOllamaHttpClient");
  });

  it("defaults the Ollama HTTP adapter to localhost-only explicit invocation", async () => {
    const calls: string[] = [];
    const fetchImpl: OllamaFetchImpl = async (input) => {
      calls.push(input);
      return {
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
        text: async () => JSON.stringify({ models: [] }),
      };
    };
    const client = createOllamaHttpClient({
      fetch_impl: fetchImpl,
      now: () => 13,
    });

    expect(calls).toEqual([]);
    await expect(
      client.listModels({
        request_id: "phase-13b-list-1",
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      request_id: "phase-13b-list-1",
      checked_at: 13,
      models: [],
    });
    expect(calls).toEqual(["http://127.0.0.1:11434/api/tags"]);
  });

  it("requires explicit override for non-localhost Ollama URLs", () => {
    expect(() =>
      createOllamaHttpClient({ base_url: "https://example.com:11434" }),
    ).toThrow(/localhost/);

    expect(() =>
      createOllamaHttpClient({
        base_url: "https://example.com:11434",
        allow_non_localhost: true,
        fetch_impl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ models: [] }),
          text: async () => JSON.stringify({ models: [] }),
        }),
      }),
    ).not.toThrow();
  });

  it("keeps Ollama provider construction side-effect free and health probing explicit", async () => {
    let listCalls = 0;
    let completeCalls = 0;
    let streamCalls = 0;
    const backingClient = createFakeOllamaClient({ now: () => 99 });
    const client: OllamaClient = {
      listModels: async (options) => {
        listCalls += 1;
        return backingClient.listModels(options);
      },
      complete: async (completeRequest: OllamaCompleteRequest) => {
        completeCalls += 1;
        return backingClient.complete(completeRequest);
      },
      stream: (completeRequest: OllamaCompleteRequest) => {
        streamCalls += 1;
        return backingClient.stream(completeRequest);
      },
    };

    const provider = createOllamaModelProvider({ client });

    expect(listCalls).toBe(0);
    expect(completeCalls).toBe(0);
    expect(streamCalls).toBe(0);

    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "ollama",
      ok: true,
      available_models: ["llama3.2:3b", "qwen2.5:7b"],
      checked_at: 99,
    });
    expect(listCalls).toBe(1);
    expect(completeCalls).toBe(0);
    expect(streamCalls).toBe(0);
  });

  it("keeps Ollama provider streaming explicit, injected, and router-free", async () => {
    let streamCalls = 0;
    const backingClient = createFakeOllamaClient({ now: () => 777 });
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: backingClient.complete,
        stream: (completeRequest) => {
          streamCalls += 1;
          return backingClient.stream(completeRequest);
        },
      },
    });

    expect(streamCalls).toBe(0);
    const events = await collect(provider.stream(request()));

    expect(streamCalls).toBe(1);
    expect(events.map((event) => event.type)).toEqual([
      "token",
      "token",
      "token",
      "token",
      "done",
    ]);
    expect(events.filter((event) => event.type !== "token")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      provider_id: "ollama",
      created_at_ms: 777,
      response: {
        redaction_status: "metadata_only",
      },
    });
    expect(modelSource()).not.toMatch(/router\.|selectProvider|routeModel/i);
  });

  it("keeps the router uninvolved while local complete requires explicit provider invocation", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient({ latencyMs: 17 }),
    });

    await expect(provider.complete(request())).resolves.toMatchObject({
      request_id: "phase-13b-closeout-request-1",
      model_id: "llama3.2:3b",
      provider_id: "ollama",
      latency_ms: 17,
      output: {
        kind: "text",
      },
      redaction_status: "metadata_only",
    });
    expect(modelSource()).not.toMatch(/router\.|selectProvider|routeModel/i);
  });

  it("keeps cloud registry entries disabled and registry authority closed", () => {
    const registry = loadDefaultModelRegistry();
    const cloudModels = registry
      .listModels()
      .filter((model) => model.runtime_class === "cloud");

    expect(cloudModels).toEqual([
      expect.objectContaining({
        id: "deepseek-v4-flash",
        provider: "deepseek",
        visibility: "disabled",
      }),
      expect.objectContaining({
        id: "deepseek-v4-pro",
        provider: "deepseek",
        visibility: "disabled",
      }),
      expect.objectContaining({
        id: "claude-haiku",
        provider: "anthropic",
        visibility: "disabled",
      }),
      expect.objectContaining({
        id: "claude-opus",
        provider: "anthropic",
        visibility: "disabled",
      }),
    ]);
    expect(registry.getAuthoritySnapshot()).toEqual({
      networkCallsEnabled: false,
      providerExecutionEnabled: false,
      runtimeStateMutationEnabled: false,
      routerMutationEnabled: false,
      telemetryPersistenceEnabled: false,
      environmentVariableMutationEnabled: false,
      modelInstallationEnabled: false,
      providerProbingEnabled: false,
    });
  });

  it("keeps provider metadata surfaces metadata-only", async () => {
    const ollamaProvider = createOllamaModelProvider({
      client: createFakeOllamaClient(),
    });
    const mockProvider = createMockModelProvider();
    const ollamaResponse = await ollamaProvider.complete(request());

    expect(ollamaProvider.metadata).toMatchObject({
      provider_id: "ollama",
      runtime_class: "local",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    });
    expect(mockProvider.metadata).toMatchObject({
      provider_id: "mock",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    });
    expect(ollamaResponse.token_usage).toEqual({
      input_tokens: expect.any(Number),
      output_tokens: expect.any(Number),
      total_tokens: expect.any(Number),
    });
    expect(JSON.stringify(ollamaResponse.token_usage)).not.toContain(
      "Phase 13B closeout",
    );
  });

  it("keeps mock provider conformance binding in place and out of production exports", () => {
    const binding = sourceFor(
      "tests/models/providers/conformance/mock-provider.conformance.test.ts",
    );
    const index = sourceFor("src/models/index.ts");

    expect(binding).toContain("describeModelProviderConformance");
    expect(binding).toContain("createMockModelProvider");
    expect(index).not.toContain("describeModelProviderConformance");
  });
});
