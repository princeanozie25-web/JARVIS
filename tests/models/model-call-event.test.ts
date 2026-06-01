import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ModelCallEventError,
  createModelCallEvent,
  type ModelRuntimeExecutionSummary,
} from "../../src/models";

function successfulSummary(
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
    fallback_chain: ["qwen2.5:7b"],
    latency_ms: 25,
    token_usage: {
      input_tokens: 7,
      output_tokens: 4,
      total_tokens: 11,
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
    ...overrides,
  };
}

function failedSummary(): ModelRuntimeExecutionSummary {
  return successfulSummary({
    execution_id: "failed-execution-1",
    request_id: "failed-request-1",
    selected_provider: null,
    attempted_models: ["llama3.2:3b", "qwen2.5:7b"],
    successful_model: null,
    failed_models: [
      {
        model_id: "llama3.2:3b",
        provider_id: "ollama",
        failure_class: "unavailable",
        message: "Provider unavailable.",
      },
      {
        model_id: "qwen2.5:7b",
        provider_id: "ollama",
        failure_class: "timeout",
        message: "Provider timed out.",
      },
    ],
    fallback_used: false,
    failure_class: "timeout",
    latency_ms: 30,
    token_usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
    degraded: true,
    finish_reason: "error",
  });
}

describe("Phase 13E.1 model call event contract", () => {
  it("converts a successful runtime summary into a metadata-only event", () => {
    const event = createModelCallEvent(successfulSummary(), {
      eventIdFactory: () => "event-1",
      now: () => 1000,
    });

    expect(event).toEqual({
      event_id: "event-1",
      request_id: "request-1",
      execution_id: "execution-1",
      capability: "chat",
      selected_model_id: "llama3.2:3b",
      selected_provider: "ollama",
      provider_kind: "ollama",
      runtime_class: "local",
      attempted_models: ["llama3.2:3b"],
      successful_model: "llama3.2:3b",
      failed_models: [],
      fallback_used: false,
      fallback_chain: ["qwen2.5:7b"],
      latency_ms: 25,
      token_usage: {
        input_tokens: 7,
        output_tokens: 4,
        total_tokens: 11,
      },
      degraded: false,
      finish_reason: "stop",
      governance_flags: [
        "cloud_opt_in_required",
        "disabled_model_opt_in_required",
      ],
      redaction_status: "metadata_only",
      started_at: 100,
      ended_at: 125,
      created_at: 1000,
    });
    expect(JSON.stringify(event)).not.toContain("raw");
  });

  it("preserves failed execution summaries safely", () => {
    const event = createModelCallEvent(failedSummary(), {
      eventIdFactory: () => "failed-event-1",
      now: () => 2000,
    });

    expect(event).toMatchObject({
      event_id: "failed-event-1",
      request_id: "failed-request-1",
      execution_id: "failed-execution-1",
      selected_model_id: "llama3.2:3b",
      selected_provider: null,
      attempted_models: ["llama3.2:3b", "qwen2.5:7b"],
      successful_model: null,
      failed_models: [
        {
          model_id: "llama3.2:3b",
          provider_id: "ollama",
          failure_class: "unavailable",
          message: "Provider unavailable.",
        },
        {
          model_id: "qwen2.5:7b",
          provider_id: "ollama",
          failure_class: "timeout",
          message: "Provider timed out.",
        },
      ],
      failure_class: "timeout",
      degraded: true,
      finish_reason: "error",
      redaction_status: "metadata_only",
      created_at: 2000,
    });
  });

  it("converts a streaming summary without raw stream tokens", () => {
    const event = createModelCallEvent(
      successfulSummary({
        execution_id: "stream-execution-1",
        request_id: "stream-request-1",
        token_usage: {
          input_tokens: 5,
          output_tokens: 12,
          total_tokens: 17,
        },
      }),
      {
        eventIdFactory: () => "stream-event-1",
        now: () => 3000,
      },
    );

    expect(event).toMatchObject({
      event_id: "stream-event-1",
      execution_id: "stream-execution-1",
      request_id: "stream-request-1",
      token_usage: {
        input_tokens: 5,
        output_tokens: 12,
        total_tokens: 17,
      },
      redaction_status: "metadata_only",
    });
    expect(Object.keys(event)).not.toContain("raw_stream_tokens");
    expect(JSON.stringify(event)).not.toContain("stream-token-secret");
    expect(JSON.stringify(event)).not.toContain("delta");
  });

  it("preserves exact DeepSeek V4 model ids in metadata-only call events", () => {
    const event = createModelCallEvent(
      successfulSummary({
        execution_id: "deepseek-execution-1",
        request_id: "deepseek-request-1",
        selected_model_id: "deepseek-v4-flash",
        selected_provider: "deepseek",
        attempted_models: ["deepseek-v4-flash", "deepseek-v4-pro"],
        successful_model: "deepseek-v4-pro",
        fallback_chain: ["deepseek-v4-pro"],
        runtime_class: "cloud",
        provider_kind: "deepseek",
      }),
      {
        eventIdFactory: () => "deepseek-event-1",
        now: () => 6000,
      },
    );

    expect(event).toMatchObject({
      event_id: "deepseek-event-1",
      selected_model_id: "deepseek-v4-flash",
      selected_provider: "deepseek",
      attempted_models: ["deepseek-v4-flash", "deepseek-v4-pro"],
      successful_model: "deepseek-v4-pro",
      fallback_chain: ["deepseek-v4-pro"],
      runtime_class: "cloud",
      provider_kind: "deepseek",
    });
    expect(JSON.stringify(event)).not.toContain("deepseek-chat");
    expect(JSON.stringify(event)).not.toContain("deepseek-reasoner");
  });

  it("fails closed on missing or invalid summaries", () => {
    expect(() => createModelCallEvent(null)).toThrow(ModelCallEventError);
    expect(() => createModelCallEvent({})).toThrow(ModelCallEventError);
    expect(() =>
      createModelCallEvent(
        successfulSummary({
          capability: "bogus" as ModelRuntimeExecutionSummary["capability"],
        }),
      ),
    ).toThrow(ModelCallEventError);
  });

  it("rejects raw prompt, raw response, provider payload, and secret fields", () => {
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        raw_prompt: "Say exactly: forbidden raw prompt.",
      }),
    ).toThrow(/forbidden metadata field: raw_prompt/);
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        raw_response: "forbidden raw response",
      }),
    ).toThrow(/forbidden metadata field: raw_response/);
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        failed_models: [
          {
            model_id: "llama3.2:3b",
            failure_class: "provider_error",
            message: "failed",
            provider_payload: { body: "forbidden" },
          },
        ],
      }),
    ).toThrow(/forbidden metadata field: provider_payload/);
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        api_key: "sk-forbidden",
      }),
    ).toThrow(/forbidden metadata field: api_key/);
  });

  it("rejects unknown fields and non-numeric token usage", () => {
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        unexpected_field: true,
      }),
    ).toThrow(ModelCallEventError);
    expect(() =>
      createModelCallEvent({
        ...successfulSummary(),
        token_usage: {
          input_tokens: "7",
          output_tokens: 4,
          total_tokens: 11,
        },
      }),
    ).toThrow(ModelCallEventError);
  });

  it("returns defensive-copy safe events", () => {
    const summary = successfulSummary();
    const first = createModelCallEvent(summary, {
      eventIdFactory: () => "defensive-event-1",
      now: () => 4000,
    });
    (first.attempted_models as string[]).push("mutated-model");
    (first.failed_models as unknown[]).push({
      model_id: "mutated-model",
      failure_class: "provider_error",
      message: "mutated",
    });
    (summary.attempted_models as string[]).push("summary-mutated-model");

    const second = createModelCallEvent(successfulSummary(), {
      eventIdFactory: () => "defensive-event-2",
      now: () => 4001,
    });

    expect(first.attempted_models).toContain("mutated-model");
    expect(second.attempted_models).toEqual(["llama3.2:3b"]);
    expect(second.failed_models).toEqual([]);
  });

  it("uses deterministic injected event ids and clocks", () => {
    const event = createModelCallEvent(successfulSummary(), {
      eventIdFactory: ({ summary, created_at }) =>
        `deterministic:${summary.execution_id}:${created_at}`,
      now: () => 5000,
    });

    expect(event.event_id).toBe("deterministic:execution-1:5000");
    expect(event.created_at).toBe(5000);
  });

  it("does not introduce event-store, telemetry writer, UI, Tauri, router, cloud execution, or provider execution wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/model-call-event.ts"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/models/index.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /event-store|eventStore|writeEvent|appendEvent/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore|telemetryWriter/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|tauri|invoke\(/i);
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|routeModel|routeRequest/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|createOllama|createMock|\.complete\(|\.stream\(|fetch\s*\(|globalThis\.fetch|openai|anthropic/i,
    );
    expect(source).not.toMatch(/process\.env|import\.meta\.env/i);
    expect(index).toContain("createModelCallEvent");
  });
});
