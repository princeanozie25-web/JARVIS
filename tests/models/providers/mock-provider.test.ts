import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "../../../src/models/providers/contract";
import {
  MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
  createMockModelProvider,
  type MockModelProviderFailureMode,
} from "../../../src/models/providers/mock-provider";

function request(
  overrides: Partial<ModelProviderRequest> = {},
): ModelProviderRequest {
  return {
    request_id: "request-1",
    model_id: "mock-local-model",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Hello mock provider" }],
    },
    options: {
      temperature: 0,
      max_output_tokens: 64,
    },
    timeout_ms: 5_000,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "correlation-1",
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

describe("Phase 13A.3 mock model provider", () => {
  it("complete returns deterministic output", async () => {
    const provider = createMockModelProvider();
    const first = await provider.complete(request());
    const second = await provider.complete(request());

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      request_id: "request-1",
      model_id: "mock-local-model",
      provider_id: "mock",
      output: {
        kind: "text",
        content: expect.stringMatching(/^mock:chat:mock-local-model:\d+$/),
      },
      latency_ms: 0,
      finish_reason: "stop",
      degraded: false,
      redaction_status: "metadata_only",
    });
  });

  it("stream emits deterministic token events followed by done", async () => {
    const provider = createMockModelProvider({ now: () => 123 });
    const events = await collect(provider.stream(request()));

    expect(events.map((event) => event.type)).toEqual([
      "token",
      "token",
      "token",
      "token",
      "done",
    ]);
    expect(
      events
        .filter((event) => event.type === "token")
        .map((event) => event.delta),
    ).toEqual(["mock", "chat", "mock-local-model", expect.any(String)]);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      created_at_ms: 123,
      response: {
        request_id: "request-1",
        redaction_status: "metadata_only",
      },
    });
  });

  it("health returns metadata-only healthy status", async () => {
    const provider = createMockModelProvider({ now: () => 456 });
    const health = await provider.health();

    expect(health).toEqual({
      provider_id: "mock",
      ok: true,
      runtime_class: "mock",
      available_models: ["mock-local-model"],
      checked_at: 456,
      degraded: false,
    });
    expect(Object.keys(health)).not.toContain("raw_response");
    expect(Object.keys(health)).not.toContain("probe_result");
  });

  it("defaults to fake-first mock capabilities and allows configuration", () => {
    const defaultProvider = createMockModelProvider();
    const configuredProvider = createMockModelProvider({
      capabilities: ["chat", "vision"],
      availableModels: ["mock-vision-model"],
    });

    expect(defaultProvider.kind).toBe("mock");
    expect(defaultProvider.runtime_class).toBe("mock");
    expect(defaultProvider.capabilities).toEqual(
      MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
    );
    expect(configuredProvider.capabilities).toEqual(["chat", "vision"]);
  });

  it.each([
    "unavailable",
    "timeout",
    "cancelled",
    "invalid_request",
    "model_missing",
    "provider_error",
  ] satisfies MockModelProviderFailureMode[])(
    "%s failure mode fails closed",
    async (failureMode) => {
      const provider = createMockModelProvider({ failureMode });

      await expect(provider.complete(request())).rejects.toMatchObject({
        provider_id: "mock",
        failure_class: failureMode,
        degraded: true,
        redaction_status: "metadata_only",
      });
    },
  );

  it("unsupported capabilities fail closed as invalid_request", async () => {
    const provider = createMockModelProvider();

    await expect(
      provider.complete(request({ capability: "vision" })),
    ).rejects.toMatchObject({
      failure_class: "invalid_request",
    });
  });

  it("missing models fail closed as model_missing", async () => {
    const provider = createMockModelProvider();

    await expect(
      provider.complete(request({ model_id: "missing-model" })),
    ).rejects.toMatchObject({
      failure_class: "model_missing",
    });
  });

  it("abort_signal cancellation is honored", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const provider = createMockModelProvider();

    await expect(
      provider.complete(request({ abort_signal: abortController.signal })),
    ).rejects.toMatchObject({
      failure_class: "cancelled",
      redaction_status: "metadata_only",
    });
  });

  it("timeout_ms failure behavior is deterministic", async () => {
    const provider = createMockModelProvider({ latencyMs: 50 });

    await expect(
      provider.complete(request({ timeout_ms: 10 })),
    ).rejects.toMatchObject({
      failure_class: "timeout",
      redaction_status: "metadata_only",
    });
  });

  it("supports test-controlled latency without real sleeps", async () => {
    const calls: number[] = [];
    const provider = createMockModelProvider({
      latencyMs: 25,
      waitForLatency: async ({ latencyMs }) => {
        calls.push(latencyMs);
      },
    });

    const response = await provider.complete(request({ timeout_ms: 100 }));

    expect(calls).toEqual([25]);
    expect(response.latency_ms).toBe(25);
  });

  it("stream failures emit fail-closed error or cancelled events", async () => {
    const unavailableEvents = await collect(
      createMockModelProvider({ failureMode: "unavailable" }).stream(request()),
    );
    const timeoutEvents = await collect(
      createMockModelProvider({ failureMode: "timeout" }).stream(request()),
    );

    expect(unavailableEvents).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          failure_class: "unavailable",
          redaction_status: "metadata_only",
        }),
      }),
    ]);
    expect(timeoutEvents).toEqual([
      expect.objectContaining({
        type: "cancelled",
        reason: "timeout",
        error_class: "timeout",
      }),
    ]);
  });

  it("token_usage is numeric metadata only", async () => {
    const provider = createMockModelProvider();
    const response = await provider.complete(request());

    expect(response.token_usage).toEqual({
      input_tokens: expect.any(Number),
      output_tokens: expect.any(Number),
      total_tokens: expect.any(Number),
    });
    expect(JSON.stringify(response.token_usage)).not.toContain(
      "Hello mock provider",
    );
  });

  it("returns defensive copies for health and generated outputs", async () => {
    const provider = createMockModelProvider();
    const firstHealth = await provider.health();
    (firstHealth.available_models as string[]).push("mutated-model");

    const firstEmbedding = await provider.complete(
      request({
        capability: "embed",
        input: { kind: "embedding", content: "embed me" },
      }),
    );
    if (firstEmbedding.output.kind !== "embedding") {
      throw new Error("Expected embedding output.");
    }
    (firstEmbedding.output.vector as number[]).push(999);

    expect((await provider.health()).available_models).toEqual([
      "mock-local-model",
    ]);
    const secondEmbedding = await provider.complete(
      request({
        capability: "embed",
        input: { kind: "embedding", content: "embed me" },
      }),
    );
    expect(secondEmbedding.output).toMatchObject({
      kind: "embedding",
      vector: expect.not.arrayContaining([999]),
    });
  });

  it("no network, SDK, filesystem, router, event-store, UI, or telemetry persistence wiring is introduced", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/mock-provider.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|ollama|node:http|node:https|node:fs|node:fs\/promises)["']/,
    );
    expect(source).not.toMatch(/fetch\(|WebSocket|EventSource|process\.env/);
    expect(source).not.toMatch(/router|event-store|eventStore/i);
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx/i);
    expect(source).not.toMatch(/install|download|probe|healthCheck/i);
  });
});
