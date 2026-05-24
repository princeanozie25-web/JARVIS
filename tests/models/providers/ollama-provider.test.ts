import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createFakeOllamaClient,
  createOllamaClientError,
  createOllamaModelProvider,
  loadDefaultModelRegistry,
  type OllamaClient,
  type OllamaClientCallOptions,
  type OllamaCompleteRequest,
} from "../../../src/models";
import type {
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "../../../src/models/providers/contract";

function request(
  overrides: Partial<ModelProviderRequest> = {},
): ModelProviderRequest {
  return {
    request_id: "ollama-request-1",
    model_id: "llama3.2:3b",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Health scaffold only" }],
    },
    options: {},
    timeout_ms: 5_000,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "ollama-correlation-1",
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

describe("Phase 13B.1 Ollama provider health scaffold", () => {
  it("constructs a local-only Ollama provider without network or probing", () => {
    let calls = 0;
    const provider = createOllamaModelProvider({
      healthProbe: () => {
        calls += 1;
        return { ok: true, available_models: ["llama3.2:3b"] };
      },
    });

    expect(calls).toBe(0);
    expect(provider).toMatchObject({
      id: "ollama",
      kind: "ollama",
      runtime_class: "local",
      metadata: {
        provider_id: "ollama",
        runtime_class: "local",
        implementation_enabled: false,
        network_access_enabled: false,
        telemetry_persistence_enabled: false,
      },
    });
  });

  it("does not probe during registry load or module import", () => {
    let calls = 0;
    createOllamaModelProvider({
      healthProbe: () => {
        calls += 1;
        return { ok: true, available_models: ["qwen2.5:7b"] };
      },
    });

    const registry = loadDefaultModelRegistry();

    expect(calls).toBe(0);
    expect(registry.getModel("llama3.2:3b")).toMatchObject({
      provider: "ollama",
      runtime_class: "local",
    });
  });

  it("construction does not call injected client.listModels", () => {
    let listCalls = 0;
    let completeCalls = 0;
    const backingClient = createFakeOllamaClient();
    const client: OllamaClient = {
      listModels: async (options) => {
        listCalls += 1;
        return backingClient.listModels(options);
      },
      complete: async (completeRequest) => {
        completeCalls += 1;
        return backingClient.complete(completeRequest);
      },
      stream: backingClient.stream,
    };

    createOllamaModelProvider({ client });

    expect(listCalls).toBe(0);
    expect(completeCalls).toBe(0);
  });

  it("health calls injected client.listModels exactly when invoked", async () => {
    const calls: OllamaClientCallOptions[] = [];
    const backingClient = createFakeOllamaClient({ now: () => 777 });
    const client: OllamaClient = {
      listModels: async (options) => {
        calls.push(options);
        return backingClient.listModels(options);
      },
      complete: backingClient.complete,
      stream: backingClient.stream,
    };
    const provider = createOllamaModelProvider({
      client,
      healthRequestId: "health-client-request-1",
      healthTimeoutMs: 1_234,
    });

    expect(calls).toEqual([]);
    await expect(provider.health()).resolves.toMatchObject({
      ok: true,
      available_models: ["llama3.2:3b", "qwen2.5:7b"],
      checked_at: 777,
    });
    expect(calls).toEqual([
      {
        request_id: "health-client-request-1",
        timeout_ms: 1_234,
        metadata_only: true,
      },
    ]);
  });

  it("health returns ok:true and available_models from the injected client", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient({
        models: [
          { name: "llama3.2:3b" },
          { name: "qwen2.5:7b" },
          { name: "custom-local-model" },
        ],
        now: () => 888,
      }),
    });

    await expect(provider.health()).resolves.toEqual({
      provider_id: "ollama",
      ok: true,
      runtime_class: "local",
      available_models: ["llama3.2:3b", "qwen2.5:7b", "custom-local-model"],
      checked_at: 888,
      degraded: false,
    });
  });

  it.each(["unavailable", "model_missing", "provider_error"] as const)(
    "health maps %s client failures fail-closed",
    async (failureMode) => {
      const provider = createOllamaModelProvider({
        now: () => 999,
        client: createFakeOllamaClient({ failureMode }),
      });

      await expect(provider.health()).resolves.toEqual({
        provider_id: "ollama",
        ok: false,
        runtime_class: "local",
        available_models: [],
        checked_at: 999,
        degraded: true,
        error_class: failureMode,
      });
    },
  );

  it("health returns ok:true when the injected probe returns models", async () => {
    const provider = createOllamaModelProvider({
      now: () => 111,
      healthProbe: () => ({
        ok: true,
        available_models: ["llama3.2:3b", "qwen2.5:7b"],
        checked_at: 222,
      }),
    });

    await expect(provider.health()).resolves.toEqual({
      provider_id: "ollama",
      ok: true,
      runtime_class: "local",
      available_models: ["llama3.2:3b", "qwen2.5:7b"],
      checked_at: 222,
      degraded: false,
    });
  });

  it("health returns ok:false when the injected probe reports unavailable", async () => {
    const provider = createOllamaModelProvider({
      now: () => 333,
      healthProbe: () => ({
        ok: false,
        available_models: [],
        error_class: "unavailable",
      }),
    });

    await expect(provider.health()).resolves.toEqual({
      provider_id: "ollama",
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: 333,
      degraded: true,
      error_class: "unavailable",
    });
  });

  it("missing Ollama can be represented as model_missing without throwing", async () => {
    const provider = createOllamaModelProvider({
      healthProbe: () => ({
        ok: false,
        error_class: "model_missing",
      }),
    });

    await expect(provider.health()).resolves.toMatchObject({
      ok: false,
      degraded: true,
      error_class: "model_missing",
      available_models: [],
    });
  });

  it("health handles probe errors fail-closed", async () => {
    const provider = createOllamaModelProvider({
      now: () => 444,
      healthProbe: () => {
        throw new Error("probe failed");
      },
    });

    await expect(provider.health()).resolves.toEqual({
      provider_id: "ollama",
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: 444,
      degraded: true,
      error_class: "unavailable",
    });
  });

  it("health returns defensive-copy safe available models", async () => {
    const provider = createOllamaModelProvider({
      healthProbe: () => ({
        ok: true,
        available_models: ["llama3.2:3b"],
      }),
    });
    const first = await provider.health();
    (first.available_models as string[]).push("mutated-model");

    expect((await provider.health()).available_models).toEqual(["llama3.2:3b"]);
  });

  it("client-backed health returns defensive-copy safe available models", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient({
        models: [{ name: "llama3.2:3b" }],
      }),
    });
    const first = await provider.health();
    (first.available_models as string[]).push("mutated-model");

    expect((await provider.health()).available_models).toEqual(["llama3.2:3b"]);
  });

  it("complete fails closed when no injected client exists", async () => {
    const provider = createOllamaModelProvider();

    await expect(provider.complete(request())).rejects.toMatchObject({
      provider_id: "ollama",
      failure_class: "unavailable",
      degraded: true,
      redaction_status: "metadata_only",
    });
  });

  it("complete calls injected client.complete only when invoked", async () => {
    const calls: OllamaCompleteRequest[] = [];
    const backingClient = createFakeOllamaClient();
    const client: OllamaClient = {
      listModels: backingClient.listModels,
      complete: async (completeRequest) => {
        calls.push(completeRequest);
        return backingClient.complete(completeRequest);
      },
      stream: backingClient.stream,
    };
    const provider = createOllamaModelProvider({ client });

    expect(calls).toEqual([]);
    await provider.complete(
      request({
        request_id: "ollama-complete-1",
        options: {
          temperature: 0,
          top_p: 1,
          max_output_tokens: 64,
          stop_sequences: ["done"],
        },
      }),
    );

    expect(calls).toEqual([
      expect.objectContaining({
        request_id: "ollama-complete-1",
        model: "llama3.2:3b",
        input: {
          kind: "messages",
          messages: [{ role: "user", content: "Health scaffold only" }],
        },
        options: {
          temperature: 0,
          top_p: 1,
          max_output_tokens: 64,
          stop_sequences: ["done"],
        },
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ]);
  });

  it("complete returns deterministic output from the injected fake client", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient({ latencyMs: 42 }),
    });

    await expect(provider.complete(request())).resolves.toEqual({
      request_id: "ollama-request-1",
      model_id: "llama3.2:3b",
      provider_id: "ollama",
      output: {
        kind: "text",
        content: "ollama:llama3.2:3b:46579",
      },
      latency_ms: 42,
      token_usage: {
        input_tokens: 3,
        output_tokens: 1,
        total_tokens: 4,
      },
      finish_reason: "stop",
      degraded: false,
      redaction_status: "metadata_only",
    });
  });

  it("complete maps token usage numerically and keeps output in the response only", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient(),
    });
    const response = await provider.complete(request());

    expect(response.token_usage).toEqual({
      input_tokens: expect.any(Number),
      output_tokens: expect.any(Number),
      total_tokens: expect.any(Number),
    });
    expect(response.redaction_status).toBe("metadata_only");
    expect(JSON.stringify(response.token_usage)).not.toContain(
      "Health scaffold only",
    );
  });

  it.each([
    "unavailable",
    "timeout",
    "cancelled",
    "invalid_request",
    "model_missing",
    "provider_error",
  ] as const)(
    "complete maps %s client failures fail-closed",
    async (failureMode) => {
      const provider = createOllamaModelProvider({
        client: createFakeOllamaClient({ failureMode }),
      });

      await expect(provider.complete(request())).rejects.toMatchObject({
        request_id: "ollama-request-1",
        model_id: "llama3.2:3b",
        provider_id: "ollama",
        failure_class: failureMode,
        degraded: true,
        redaction_status: "metadata_only",
      });
    },
  );

  it("complete maps unknown client errors to provider_error", async () => {
    const backingClient = createFakeOllamaClient();
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: async () => {
          throw new Error("unknown client failure");
        },
        stream: backingClient.stream,
      },
    });

    await expect(provider.complete(request())).rejects.toMatchObject({
      failure_class: "provider_error",
      provider_id: "ollama",
      redaction_status: "metadata_only",
    });
  });

  it("complete honors abort_signal cancellation before calling the client", async () => {
    let calls = 0;
    const backingClient = createFakeOllamaClient();
    const abortController = new AbortController();
    abortController.abort();
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: async (completeRequest) => {
          calls += 1;
          return backingClient.complete(completeRequest);
        },
        stream: backingClient.stream,
      },
    });

    await expect(
      provider.complete(request({ abort_signal: abortController.signal })),
    ).rejects.toMatchObject({
      failure_class: "cancelled",
      redaction_status: "metadata_only",
    });
    expect(calls).toBe(0);
  });

  it("complete passes abort_signal to the injected client", async () => {
    const backingClient = createFakeOllamaClient();
    const abortController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: async (completeRequest) => {
          receivedSignal = completeRequest.abort_signal;
          return backingClient.complete(completeRequest);
        },
        stream: backingClient.stream,
      },
    });

    await provider.complete(request({ abort_signal: abortController.signal }));

    expect(receivedSignal).toBe(abortController.signal);
  });

  it("complete honors timeout_ms through the injected client", async () => {
    const provider = createOllamaModelProvider({
      client: createFakeOllamaClient({ latencyMs: 50 }),
    });

    await expect(
      provider.complete(request({ timeout_ms: 10 })),
    ).rejects.toMatchObject({
      failure_class: "timeout",
      redaction_status: "metadata_only",
    });
  });

  it("complete rejects unsupported capabilities before client execution", async () => {
    let calls = 0;
    const backingClient = createFakeOllamaClient();
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: async (completeRequest) => {
          calls += 1;
          return backingClient.complete(completeRequest);
        },
        stream: backingClient.stream,
      },
    });

    await expect(
      provider.complete(request({ capability: "vision" })),
    ).rejects.toMatchObject({
      failure_class: "invalid_request",
      redaction_status: "metadata_only",
    });
    expect(calls).toBe(0);
  });

  it("complete preserves typed client errors when mapping failures", async () => {
    const backingClient = createFakeOllamaClient();
    const provider = createOllamaModelProvider({
      client: {
        listModels: backingClient.listModels,
        complete: async () => {
          throw createOllamaClientError({
            request_id: "client-error-request",
            model: "llama3.2:3b",
            failure_class: "model_missing",
            message: "model is missing",
            retryable: false,
          });
        },
        stream: backingClient.stream,
      },
    });

    await expect(provider.complete(request())).rejects.toMatchObject({
      request_id: "ollama-request-1",
      model_id: "llama3.2:3b",
      provider_id: "ollama",
      failure_class: "model_missing",
      message: "model is missing",
      retryable: false,
      degraded: true,
      redaction_status: "metadata_only",
    });
  });

  it("stream fails closed because streaming is not implemented", async () => {
    const provider = createOllamaModelProvider({ now: () => 555 });
    const events = await collect(provider.stream(request()));

    expect(events).toEqual([
      expect.objectContaining({
        type: "error",
        request_id: "ollama-request-1",
        provider_id: "ollama",
        created_at_ms: 555,
        error: expect.objectContaining({
          failure_class: "provider_error",
          redaction_status: "metadata_only",
        }),
      }),
    ]);
  });

  it("does not introduce direct SDK, network, filesystem, router, event-store, telemetry, UI, Tauri, install, download, cloud, or fallback wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/ollama-provider.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:ollama|openai|@anthropic-ai\/sdk|node:http|node:https|node:fs|node:fs\/promises)["']/,
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|WebSocket|EventSource|process\.env/,
    );
    expect(source).not.toMatch(
      /writeFile|appendFile|createWriteStream|router\.|event-store|eventStore/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|tauri|invoke\(/i);
    expect(source).not.toMatch(/install|download|cloud|fallback/i);
  });
});
