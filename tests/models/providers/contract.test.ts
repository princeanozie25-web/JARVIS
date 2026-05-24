import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MODEL_PROVIDER_FAILURE_CLASSES,
  MODEL_PROVIDER_STREAM_EVENT_KINDS,
  type ModelProvider,
  type ModelProviderHealth,
  type ModelProviderRequest,
  type ModelProviderResponse,
  type ModelProviderStreamEvent,
} from "../../../src/models/providers/contract";

function request(): ModelProviderRequest {
  return {
    request_id: "request-1",
    model_id: "mock-local-model",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Hello" }],
    },
    options: {
      temperature: 0.2,
      max_output_tokens: 128,
    },
    timeout_ms: 5_000,
    abort_signal: new AbortController().signal,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "correlation-1",
      requested_at_ms: 0,
      caller: "test_harness",
      policy_ref: "phase-13a-contract",
    },
  };
}

function response(): ModelProviderResponse {
  return {
    request_id: "request-1",
    model_id: "mock-local-model",
    provider_id: "mock",
    output: {
      kind: "text",
      content: "Hello.",
    },
    latency_ms: 12,
    token_usage: {
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    },
    finish_reason: "stop",
    degraded: false,
    redaction_status: "metadata_only",
  };
}

describe("Phase 13A.2 model provider contract", () => {
  it("keeps the provider interface shape stable", async () => {
    const provider: ModelProvider = {
      id: "mock-provider",
      kind: "mock",
      runtime_class: "mock",
      capabilities: ["chat", "classify"],
      metadata: {
        provider_id: "mock-provider",
        display_name: "Mock Provider",
        runtime_class: "mock",
        supported_capabilities: ["chat", "classify"],
        supports_streaming: true,
        supports_abort: true,
        supports_timeout: true,
        governance_notes: "Contract-only provider shape.",
        implementation_enabled: false,
        network_access_enabled: false,
        telemetry_persistence_enabled: false,
      },
      complete: async () => response(),
      stream: async function* () {
        yield {
          type: "done",
          request_id: "request-1",
          model_id: "mock-local-model",
          provider_id: "mock",
          created_at_ms: 0,
          response: response(),
        };
      },
      health: async () => health(),
    };

    expect(await provider.complete(request())).toMatchObject({
      request_id: "request-1",
      provider_id: "mock",
      degraded: false,
    });
    expect(provider.metadata).toMatchObject({
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    });
  });

  it("stream events support token, done, error, and cancelled", () => {
    const events: ModelProviderStreamEvent[] = [
      {
        type: "token",
        request_id: "request-1",
        model_id: "mock-local-model",
        provider_id: "mock",
        created_at_ms: 0,
        delta: "Hello",
        index: 0,
        redaction_status: "metadata_only",
      },
      {
        type: "done",
        request_id: "request-1",
        model_id: "mock-local-model",
        provider_id: "mock",
        created_at_ms: 1,
        response: response(),
      },
      {
        type: "error",
        request_id: "request-1",
        model_id: "mock-local-model",
        provider_id: "mock",
        created_at_ms: 2,
        error: {
          provider_id: "mock",
          failure_class: "provider_error",
          message: "Provider failed closed.",
          retryable: false,
          degraded: true,
          redaction_status: "metadata_only",
        },
      },
      {
        type: "cancelled",
        request_id: "request-1",
        model_id: "mock-local-model",
        provider_id: "mock",
        created_at_ms: 3,
        reason: "abort_signal",
        error_class: "cancelled",
      },
    ];

    expect(events.map((event) => event.type)).toEqual(
      MODEL_PROVIDER_STREAM_EVENT_KINDS,
    );
  });

  it("keeps failure classes exhaustive and deterministic", () => {
    expect(MODEL_PROVIDER_FAILURE_CLASSES).toEqual([
      "unavailable",
      "timeout",
      "cancelled",
      "invalid_request",
      "model_missing",
      "provider_error",
      "budget_blocked",
      "policy_blocked",
      "unknown",
    ]);
  });

  it("request metadata does not require telemetry or raw prompt storage", () => {
    const providerRequest = request();
    const provenanceKeys = Object.keys(providerRequest.provenance);

    expect(providerRequest).toMatchObject({
      request_id: "request-1",
      timeout_ms: 5_000,
      abort_signal: expect.any(AbortSignal),
    });
    expect(providerRequest.provenance.metadata_only).toBe(true);
    expect(provenanceKeys).not.toContain("raw_prompt");
    expect(provenanceKeys).not.toContain("prompt_telemetry");
    expect(provenanceKeys).not.toContain("transcript");
  });

  it("health response is metadata-only", () => {
    const healthResponse = health();

    expect(healthResponse).toEqual({
      provider_id: "mock",
      ok: true,
      runtime_class: "mock",
      available_models: ["mock-local-model"],
      checked_at: 0,
      degraded: false,
    });
    expect(Object.keys(healthResponse)).not.toContain("raw_response");
  });

  it("cancellation and timeout fields are present in the request contract", () => {
    const providerRequest = request();

    expect(providerRequest.timeout_ms).toBeGreaterThan(0);
    expect(providerRequest.abort_signal).toBeInstanceOf(AbortSignal);
  });

  it("does not introduce runtime provider implementations or network imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|ollama|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(/fetch\(|WebSocket|EventSource|process\.env/);
    expect(source).not.toMatch(/\bclass\s+\w+Provider\b/);
    expect(source).not.toMatch(/new\s+(?:OpenAI|Anthropic|Ollama)\b/);
    expect(source).not.toMatch(
      /from\s+["'].*(?:event-store|telemetry)|(?:write|persist).*telemetry|router\.mutate/i,
    );
  });
});

function health(): ModelProviderHealth {
  return {
    provider_id: "mock",
    ok: true,
    runtime_class: "mock",
    available_models: ["mock-local-model"],
    checked_at: 0,
    degraded: false,
  };
}
