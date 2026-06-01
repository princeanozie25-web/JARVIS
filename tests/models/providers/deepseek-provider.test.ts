import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createDeepSeekClientError,
  createDeepSeekModelProvider,
  type DeepSeekClient,
  type DeepSeekCompleteRequest,
} from "../../../src/models";
import type {
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "../../../src/models/providers/contract";

function request(
  overrides: Partial<ModelProviderRequest> = {},
): ModelProviderRequest {
  return {
    request_id: "deepseek-provider-request-1",
    model_id: "deepseek-v4-pro",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Do not persist raw prompt" }],
    },
    options: {
      temperature: 0,
      max_output_tokens: 16,
    },
    timeout_ms: 5_000,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "deepseek-correlation-1",
      requested_at_ms: 0,
      caller: "test_harness",
    },
    ...overrides,
  };
}

function client(
  complete: (request: DeepSeekCompleteRequest) => Promise<unknown>,
): DeepSeekClient {
  return {
    complete: async (completeRequest) =>
      (await complete(completeRequest)) as Awaited<
        ReturnType<DeepSeekClient["complete"]>
      >,
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

describe("DeepSeek model provider", () => {
  it("constructs a cloud provider without env, network, or probing side effects", () => {
    let calls = 0;
    const provider = createDeepSeekModelProvider({
      client: client(async (completeRequest) => {
        calls += 1;
        return completeResult(completeRequest);
      }),
    });

    expect(provider).toMatchObject({
      id: "deepseek",
      kind: "deepseek",
      runtime_class: "cloud",
      metadata: {
        provider_id: "deepseek",
        implementation_enabled: false,
        network_access_enabled: false,
        telemetry_persistence_enabled: false,
      },
    });
    expect(calls).toBe(0);
  });

  it("complete uses the configured request model id exactly", async () => {
    const calls: DeepSeekCompleteRequest[] = [];
    const provider = createDeepSeekModelProvider({
      client: client(async (completeRequest) => {
        calls.push(completeRequest);
        return completeResult(completeRequest);
      }),
    });

    await expect(provider.complete(request())).resolves.toMatchObject({
      request_id: "deepseek-provider-request-1",
      model_id: "deepseek-v4-pro",
      provider_id: "deepseek",
      token_usage: {
        input_tokens: 2,
        output_tokens: 1,
        total_tokens: 3,
      },
      redaction_status: "metadata_only",
    });
    expect(calls).toEqual([
      expect.objectContaining({
        request_id: "deepseek-provider-request-1",
        model: "deepseek-v4-pro",
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ]);
  });

  it("fails closed when the client is missing or rejects", async () => {
    await expect(
      createDeepSeekModelProvider().complete(request()),
    ).rejects.toMatchObject({
      failure_class: "unavailable",
      provider_id: "deepseek",
      redaction_status: "metadata_only",
    });

    await expect(
      createDeepSeekModelProvider({
        client: client(async () => {
          throw createDeepSeekClientError({
            request_id: "client-failure",
            model: "deepseek-v4-pro",
            failure_class: "timeout",
            message: "Timed out.",
          });
        }),
      }).complete(request()),
    ).rejects.toMatchObject({
      failure_class: "timeout",
      provider_id: "deepseek",
      model_id: "deepseek-v4-pro",
      redaction_status: "metadata_only",
    });
  });

  it("rejects unsupported inputs before client execution", async () => {
    let calls = 0;
    const provider = createDeepSeekModelProvider({
      client: client(async (completeRequest) => {
        calls += 1;
        return completeResult(completeRequest);
      }),
    });

    await expect(
      provider.complete(
        request({
          input: {
            kind: "embedding",
            content: "no embeddings",
          },
        }),
      ),
    ).rejects.toMatchObject({ failure_class: "invalid_request" });
    expect(calls).toBe(0);
  });

  it("streaming fails closed without raw telemetry output", async () => {
    const events = await collect(
      createDeepSeekModelProvider({ now: () => 123 }).stream(request()),
    );

    expect(events).toEqual([
      expect.objectContaining({
        type: "error",
        request_id: "deepseek-provider-request-1",
        model_id: "deepseek-v4-pro",
        provider_id: "deepseek",
        created_at_ms: 123,
        error: expect.objectContaining({
          failure_class: "provider_error",
          redaction_status: "metadata_only",
        }),
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("Do not persist raw prompt");
  });

  it("does not introduce SDK, fetch, env, router, telemetry, or persistence wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/deepseek-provider.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(/\bfetch\s*\(|globalThis\.fetch|process\.env/);
    expect(source).not.toMatch(/router\.|event-store|eventStore/i);
    expect(source).not.toMatch(
      /writeTelemetry|persistTelemetry|telemetryStore/i,
    );
  });
});

function completeResult(request: DeepSeekCompleteRequest) {
  return {
    request_id: request.request_id,
    model: request.model,
    output: "OK",
    latency_ms: 7,
    token_usage: {
      input_tokens: 2,
      output_tokens: 1,
      total_tokens: 3,
    },
    done: true,
    redaction_status: "metadata_only" as const,
  };
}
