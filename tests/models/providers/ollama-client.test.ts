import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createFakeOllamaClient,
  createOllamaClientError,
  createOllamaHttpClient,
  type OllamaFetchImpl,
  type OllamaClientCallOptions,
  type OllamaCompleteRequest,
  type OllamaStreamEvent,
} from "../../../src/models";

function callOptions(
  overrides: Partial<OllamaClientCallOptions> = {},
): OllamaClientCallOptions {
  return {
    request_id: "ollama-client-list-1",
    timeout_ms: 5_000,
    metadata_only: true,
    ...overrides,
  };
}

function completeRequest(
  overrides: Partial<OllamaCompleteRequest> = {},
): OllamaCompleteRequest {
  return {
    request_id: "ollama-client-complete-1",
    model: "llama3.2:3b",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Hello Ollama client" }],
    },
    options: {
      temperature: 0,
      max_output_tokens: 64,
    },
    timeout_ms: 5_000,
    metadata_only: true,
    ...overrides,
  };
}

async function collect(
  events: AsyncIterable<OllamaStreamEvent>,
): Promise<OllamaStreamEvent[]> {
  const collected: OllamaStreamEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe("Phase 13B.2 Ollama client adapter contract", () => {
  it("HTTP client construction performs no fetch", () => {
    const calls: string[] = [];
    const client = createOllamaHttpClient({
      fetch_impl: async (input) => {
        calls.push(input);
        return jsonResponse({ models: [] });
      },
    });

    expect(client).toMatchObject({
      listModels: expect.any(Function),
      complete: expect.any(Function),
      stream: expect.any(Function),
    });
    expect(calls).toEqual([]);
  });

  it("HTTP listModels calls /api/tags only when invoked and normalizes returned models", async () => {
    const calls: Array<{ input: string; method?: string }> = [];
    const fetchImpl: OllamaFetchImpl = async (input, init) => {
      calls.push({ input, method: init?.method });
      return jsonResponse({
        models: [
          {
            name: "llama3.2:3b",
            modified_at: "2026-01-01T00:00:00.000Z",
            size: 123,
            digest: "sha256:abc",
          },
        ],
      });
    };
    const client = createOllamaHttpClient({
      fetch_impl: fetchImpl,
      now: () => 321,
    });

    expect(calls).toEqual([]);
    await expect(client.listModels(callOptions())).resolves.toEqual({
      request_id: "ollama-client-list-1",
      models: [
        {
          name: "llama3.2:3b",
          modified_at: "2026-01-01T00:00:00.000Z",
          size_bytes: 123,
          digest: "sha256:abc",
        },
      ],
      checked_at: 321,
      degraded: false,
    });
    expect(calls).toEqual([
      { input: "http://127.0.0.1:11434/api/tags", method: "GET" },
    ]);
  });

  it("HTTP complete posts to /api/generate with stream false", async () => {
    const calls: Array<{ input: string; body: unknown; method?: string }> = [];
    const client = createOllamaHttpClient({
      fetch_impl: async (input, init) => {
        calls.push({
          input,
          method: init?.method,
          body: init?.body ? JSON.parse(init.body) : null,
        });
        return jsonResponse({
          response: "HTTP completion",
          done: true,
          prompt_eval_count: 3,
          eval_count: 2,
          total_duration: 6_000_000,
        });
      },
    });

    await expect(client.complete(completeRequest())).resolves.toMatchObject({
      request_id: "ollama-client-complete-1",
      model: "llama3.2:3b",
      output: "HTTP completion",
      latency_ms: 6,
      token_usage: {
        input_tokens: 3,
        output_tokens: 2,
        total_tokens: 5,
      },
    });
    expect(calls).toEqual([
      {
        input: "http://127.0.0.1:11434/api/generate",
        method: "POST",
        body: {
          model: "llama3.2:3b",
          prompt: "user: Hello Ollama client",
          stream: false,
          options: {
            temperature: 0,
            top_p: undefined,
            num_predict: 64,
            stop: undefined,
          },
        },
      },
    ]);
  });

  it("HTTP stream posts to /api/generate with stream true and parses deterministic NDJSON events", async () => {
    const calls: Array<{ input: string; body: unknown; method?: string }> = [];
    const client = createOllamaHttpClient({
      now: () => 654,
      fetch_impl: async (input, init) => {
        calls.push({
          input,
          method: init?.method,
          body: init?.body ? JSON.parse(init.body) : null,
        });
        return textResponse(
          [
            JSON.stringify({ response: "hello ", done: false }),
            JSON.stringify({
              response: "world",
              done: true,
              prompt_eval_count: 4,
              eval_count: 2,
              total_duration: 9_000_000,
            }),
          ].join("\n"),
        );
      },
    });

    await expect(collect(client.stream(completeRequest()))).resolves.toEqual([
      expect.objectContaining({
        type: "token",
        delta: "hello ",
        index: 0,
        created_at_ms: 654,
      }),
      expect.objectContaining({
        type: "token",
        delta: "world",
        index: 1,
        created_at_ms: 654,
      }),
      expect.objectContaining({
        type: "done",
        result: expect.objectContaining({
          output: "world",
          latency_ms: 9,
          token_usage: {
            input_tokens: 4,
            output_tokens: 2,
            total_tokens: 6,
          },
        }),
      }),
    ]);
    expect(calls).toEqual([
      expect.objectContaining({
        input: "http://127.0.0.1:11434/api/generate",
        method: "POST",
        body: expect.objectContaining({
          model: "llama3.2:3b",
          stream: true,
        }),
      }),
    ]);
  });

  it("rejects non-localhost URLs unless explicitly allowed", () => {
    expect(() =>
      createOllamaHttpClient({ base_url: "https://example.com" }),
    ).toThrow("localhost");
    expect(() =>
      createOllamaHttpClient({
        base_url: "https://example.com",
        allow_non_localhost: true,
        fetch_impl: async () => jsonResponse({ models: [] }),
      }),
    ).not.toThrow();
  });

  it("HTTP adapter maps abort, malformed JSON, unavailable, and missing-model failures", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const client = createOllamaHttpClient({
      fetch_impl: async () => jsonResponse({ models: [] }),
    });
    await expect(
      client.listModels(callOptions({ abort_signal: abortController.signal })),
    ).rejects.toMatchObject({ failure_class: "cancelled" });

    await expect(
      createOllamaHttpClient({
        fetch_impl: async () => textResponse("{bad json"),
      }).listModels(callOptions()),
    ).rejects.toMatchObject({ failure_class: "provider_error" });

    await expect(
      createOllamaHttpClient({
        fetch_impl: async () => {
          throw new Error("connection refused");
        },
      }).listModels(callOptions()),
    ).rejects.toMatchObject({ failure_class: "unavailable" });

    await expect(
      createOllamaHttpClient({
        fetch_impl: async () => textResponse("model not found", 404),
      }).complete(completeRequest()),
    ).rejects.toMatchObject({ failure_class: "model_missing" });
  });

  it("HTTP stream maps malformed NDJSON into a typed error event", async () => {
    const client = createOllamaHttpClient({
      fetch_impl: async () => textResponse("{bad json"),
    });

    await expect(collect(client.stream(completeRequest()))).resolves.toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          failure_class: "provider_error",
          redaction_status: "metadata_only",
        }),
      }),
    ]);
  });

  it("fake client listModels returns deterministic models", async () => {
    const client = createFakeOllamaClient({ now: () => 123 });
    const first = await client.listModels(callOptions());
    const second = await client.listModels(callOptions());

    expect(first).toEqual(second);
    expect(first).toEqual({
      request_id: "ollama-client-list-1",
      models: [
        {
          name: "llama3.2:3b",
          modified_at: "2026-01-01T00:00:00.000Z",
          size_bytes: 3_000_000_000,
          digest: "sha256:mock-llama32-3b",
        },
        {
          name: "qwen2.5:7b",
          modified_at: "2026-01-01T00:00:00.000Z",
          size_bytes: 7_000_000_000,
          digest: "sha256:mock-qwen25-7b",
        },
      ],
      checked_at: 123,
      degraded: false,
    });
  });

  it("fake client complete returns deterministic result", async () => {
    const client = createFakeOllamaClient();
    const first = await client.complete(completeRequest());
    const second = await client.complete(completeRequest());

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      request_id: "ollama-client-complete-1",
      model: "llama3.2:3b",
      output: expect.stringMatching(/^ollama:llama3\.2:3b:\d+$/),
      latency_ms: 0,
      token_usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      },
      done: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(first.token_usage)).not.toContain(
      "Hello Ollama client",
    );
  });

  it("fake client stream emits deterministic events", async () => {
    const client = createFakeOllamaClient({ now: () => 456 });
    const events = await collect(client.stream(completeRequest()));

    expect(events.map((event) => event.type)).toEqual([
      "token",
      "token",
      "token",
      "token",
      "done",
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      created_at_ms: 456,
      result: {
        request_id: "ollama-client-complete-1",
        redaction_status: "metadata_only",
      },
    });
    expect(await collect(client.stream(completeRequest()))).toEqual(events);
  });

  it("client error mapping is typed", () => {
    expect(
      createOllamaClientError({
        request_id: "error-request-1",
        model: "llama3.2:3b",
        failure_class: "timeout",
        message: "Timed out.",
      }),
    ).toEqual({
      request_id: "error-request-1",
      model: "llama3.2:3b",
      failure_class: "timeout",
      message: "Timed out.",
      retryable: true,
      redaction_status: "metadata_only",
    });
  });

  it("importing and constructing the client causes no network or adapter calls", () => {
    const calls: number[] = [];
    const client = createFakeOllamaClient({
      latencyMs: 10,
      waitForLatency: async ({ latencyMs }) => {
        calls.push(latencyMs);
      },
    });

    expect(client).toMatchObject({
      listModels: expect.any(Function),
      complete: expect.any(Function),
      stream: expect.any(Function),
    });
    expect(calls).toEqual([]);
  });

  it("timeout and abort support are represented and honored", async () => {
    const timeoutClient = createFakeOllamaClient({ latencyMs: 50 });
    await expect(
      timeoutClient.complete(completeRequest({ timeout_ms: 10 })),
    ).rejects.toMatchObject({
      failure_class: "timeout",
      redaction_status: "metadata_only",
    });

    const abortController = new AbortController();
    abortController.abort();
    await expect(
      createFakeOllamaClient().listModels(
        callOptions({ abort_signal: abortController.signal }),
      ),
    ).rejects.toMatchObject({
      failure_class: "cancelled",
      redaction_status: "metadata_only",
    });
  });

  it("stream maps timeout and model_missing failures into typed events", async () => {
    const timeoutEvents = await collect(
      createFakeOllamaClient({ latencyMs: 50 }).stream(
        completeRequest({ timeout_ms: 10 }),
      ),
    );
    const missingEvents = await collect(
      createFakeOllamaClient().stream(
        completeRequest({ model: "missing-model" }),
      ),
    );

    expect(timeoutEvents).toEqual([
      expect.objectContaining({
        type: "cancelled",
        reason: "timeout",
        error_class: "timeout",
      }),
    ]);
    expect(missingEvents).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          failure_class: "model_missing",
          redaction_status: "metadata_only",
        }),
      }),
    ]);
  });

  it("does not mutate outputs returned from the fake client", async () => {
    const client = createFakeOllamaClient();
    const first = await client.listModels(callOptions());
    (first.models as { name: string }[]).push({ name: "mutated-model" });

    expect((await client.listModels(callOptions())).models).not.toContainEqual({
      name: "mutated-model",
    });
  });

  it("does not introduce router, event-store, telemetry, UI, Tauri, install, download, probing, cloud, fallback, or runtime orchestration wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/ollama-client.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:ollama|openai|@anthropic-ai\/sdk|node:http|node:https|node:fs|node:fs\/promises)["']/,
    );
    expect(source).toMatch(/globalThis\.fetch/);
    expect(source).not.toMatch(/WebSocket|EventSource|process\.env/);
    expect(source).not.toMatch(
      /writeFile|appendFile|createWriteStream|router\.|event-store|eventStore/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|tauri|invoke\(/i);
    expect(source).not.toMatch(
      /install|download|probe|cloud|fallback|orchestrat/i,
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return textResponse(JSON.stringify(body), status);
}

function textResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    json: async () => JSON.parse(body) as unknown,
    text: async () => body,
  };
}
