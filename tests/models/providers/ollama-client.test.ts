import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createFakeOllamaClient,
  createOllamaClientError,
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
    expect(source).not.toMatch(
      /install|download|probe|cloud|fallback|orchestrat/i,
    );
  });
});
