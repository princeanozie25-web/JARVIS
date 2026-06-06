import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createModelRuntimeObservabilityView,
  type ModelCallRollupProjection,
  type RecentModelCallsProjection,
} from "../../src/models";

const POSTURE = {
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  network_called: false,
  ui_rendered: false,
} as const;

function recentProjection(
  overrides: Partial<RecentModelCallsProjection> = {},
): RecentModelCallsProjection {
  return {
    projection_status: "ok",
    calls: [
      {
        event_id: "event-1",
        model_call_id: "model-call:event-1",
        request_id: "request-1",
        execution_id: "execution-1",
        model_id: "llama3.2:3b",
        provider_kind: "ollama",
        runtime_class: "local",
        capability: "chat",
        status: "success",
        token_usage: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
        },
        latency_ms: 25,
        fallback_used: false,
        degraded: false,
        created_at: 1000,
        redaction_status: "metadata_only",
        metadata_only: true,
        raw_payload_included: false,
      },
    ],
    errors: [],
    posture: POSTURE,
    ...overrides,
  };
}

function rollupProjection(
  overrides: Partial<ModelCallRollupProjection> = {},
): ModelCallRollupProjection {
  return {
    projection_status: "ok",
    total_calls: 2,
    successful_calls: 1,
    failed_calls: 1,
    degraded_calls: 1,
    fallback_used_calls: 1,
    token_usage_totals: {
      input_tokens: 8,
      output_tokens: 4,
      total_tokens: 12,
    },
    latency_ms: {
      min_ms: 25,
      max_ms: 75,
      average_ms: 50,
    },
    calls_by_model: [
      { key: "llama3.2:3b", count: 1 },
      { key: "qwen2.5:7b", count: 1 },
    ],
    calls_by_provider_kind: [{ key: "ollama", count: 2 }],
    calls_by_runtime_class: [{ key: "local", count: 2 }],
    calls_by_capability: [{ key: "chat", count: 2 }],
    calls_by_aux_task_kind: [],
    calls_by_status: [
      { key: "failed", count: 1 },
      { key: "success", count: 1 },
    ],
    failures_by_class: [{ key: "timeout", count: 1 }],
    errors: [],
    posture: POSTURE,
    ...overrides,
  };
}

describe("Phase 13E.5 model runtime observability adapter", () => {
  it("maps recent model calls into a safe observability view", () => {
    const response = createModelRuntimeObservabilityView({
      recentCalls: recentProjection(),
      rollup: rollupProjection(),
    });

    expect(response).toMatchObject({
      status: "degraded",
      classification: "metadata_only",
      authority: "read_only",
      replay_safe: false,
      withheld: false,
      redaction: {
        metadata_only: true,
        raw_payload_included: false,
        secrets_included: false,
        executable_payload_included: false,
        unsafe_payload_withheld: false,
      },
      data: {
        projection_status: "degraded",
        metadata_only: true,
        degraded: true,
        redaction_status: "metadata_only",
        recent_calls: [
          {
            model_id: "llama3.2:3b",
            provider_kind: "ollama",
            runtime_class: "local",
            capability: "chat",
            status: "success",
            token_usage: {
              input_tokens: 3,
              output_tokens: 4,
              total_tokens: 7,
            },
            latency_ms: 25,
            fallback_used: false,
            degraded: false,
            created_at: 1000,
            redaction_status: "metadata_only",
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain("prompt");
    expect(JSON.stringify(response)).not.toContain("response body");
  });

  it("maps rollup projections into observability summary fields", () => {
    const response = createModelRuntimeObservabilityView({
      recentCalls: recentProjection(),
      rollup: rollupProjection(),
    });

    expect(response.data).toMatchObject({
      model_mix: [
        { key: "llama3.2:3b", count: 1 },
        { key: "qwen2.5:7b", count: 1 },
      ],
      provider_mix: [{ key: "ollama", count: 2 }],
      runtime_class_mix: [{ key: "local", count: 2 }],
      capability_mix: [{ key: "chat", count: 2 }],
      success_count: 1,
      failure_count: 1,
      fallback_usage_count: 1,
      degraded_count: 1,
      token_usage_totals: {
        input_tokens: 8,
        output_tokens: 4,
        total_tokens: 12,
      },
      latency_summary: {
        min_ms: 25,
        max_ms: 75,
        average_ms: 50,
      },
      errors: [],
    });
  });

  it("preserves exact DeepSeek V4 model ids in the observability view", () => {
    const response = createModelRuntimeObservabilityView({
      recentCalls: recentProjection({
        calls: [
          {
            ...recentProjection().calls[0]!,
            model_id: "deepseek-v4-flash",
            provider_kind: "deepseek",
          },
        ],
      }),
      rollup: rollupProjection({
        calls_by_model: [
          { key: "deepseek-v4-flash", count: 1 },
          { key: "deepseek-v4-pro", count: 1 },
        ],
        calls_by_provider_kind: [{ key: "deepseek", count: 2 }],
      }),
    });

    expect(response.data).toMatchObject({
      recent_calls: [
        {
          model_id: "deepseek-v4-flash",
          provider_kind: "deepseek",
        },
      ],
      model_mix: [
        { key: "deepseek-v4-flash", count: 1 },
        { key: "deepseek-v4-pro", count: 1 },
      ],
      provider_mix: [{ key: "deepseek", count: 2 }],
    });
  });

  it("preserves degraded projection state and withheld-row metadata safely", () => {
    const response = createModelRuntimeObservabilityView({
      recentCalls: recentProjection({
        projection_status: "degraded",
        errors: ["unsafe_model_call:model-raw-field"],
      }),
      rollup: rollupProjection({
        projection_status: "ok",
        degraded_calls: 0,
      }),
    });

    expect(response).toMatchObject({
      status: "degraded",
      withheld: false,
      errors: ["unsafe_model_call:model-raw-field"],
      redaction: {
        unsafe_payload_withheld: true,
      },
      data: {
        projection_status: "degraded",
        degraded: true,
        errors: ["unsafe_model_call:model-raw-field"],
      },
    });
  });

  it("withholds malformed, withheld, or raw-payload projection inputs", () => {
    expect(
      createModelRuntimeObservabilityView({
        recentCalls: { projection_status: "withheld" },
        rollup: rollupProjection(),
      }),
    ).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["withheld_model_runtime_projection"],
    });

    const unsafe = createModelRuntimeObservabilityView({
      recentCalls: {
        ...recentProjection(),
        raw_prompt: "Say this secret prompt.",
      },
      rollup: rollupProjection(),
    });

    expect(unsafe).toMatchObject({
      status: "withheld",
      data: null,
      errors: ["unsafe_model_runtime_projection"],
      redaction: {
        unsafe_payload_withheld: true,
      },
    });
    expect(JSON.stringify(unsafe)).not.toContain("Say this secret prompt.");

    expect(
      createModelRuntimeObservabilityView({
        recentCalls: recentProjection({
          calls: [
            {
              ...recentProjection().calls[0]!,
              raw_payload_included: true,
            },
          ],
        } as unknown as RecentModelCallsProjection),
        rollup: rollupProjection(),
      }),
    ).toMatchObject({
      status: "withheld",
      data: null,
    });
  });

  it("returns defensive-copy safe observability outputs", () => {
    const input = {
      recentCalls: recentProjection(),
      rollup: rollupProjection(),
    };
    const first = createModelRuntimeObservabilityView(input);
    (
      first.data!.recent_calls as unknown as {
        token_usage: { total_tokens: number };
      }[]
    )[0]!.token_usage.total_tokens = 999;
    (first.data!.model_mix as { key: string; count: number }[]).push({
      key: "mutated",
      count: 99,
    });

    const second = createModelRuntimeObservabilityView(input);
    expect(second.data!.recent_calls[0]?.token_usage.total_tokens).toBe(7);
    expect(second.data!.model_mix).toEqual([
      { key: "llama3.2:3b", count: 1 },
      { key: "qwen2.5:7b", count: 1 },
    ]);
  });

  it("source remains adapter-only with no DB, store, runtime, provider, router, UI, Tauri, or write paths", async () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/model-runtime-observability.ts"),
      "utf8",
    );
    const exported =
      await import("../../src/models/model-runtime-observability");

    expect(Object.keys(exported)).toEqual([
      "createModelRuntimeObservabilityView",
    ]);
    expect(source).not.toMatch(
      /better-sqlite3|databasePath|withReadonlyDatabase|event-store|initializeEventStore|appendModelCall|getRecentModelCalls|getModelCallRollup/i,
    );
    expect(source).not.toMatch(
      /\bINSERT\b|\bUPDATE\b|\bDELETE\b|writeEvent|appendEvent|telemetryStore|writeTelemetry|persistTelemetry/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime\(|\.execute\(|\.complete\(|\.stream\(|createOllama|createMock|provider\./i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|document\.|window\.|React|tsx|tauri|invoke\(/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|\/api\/pull|ollama\.pull|pullModel|modelPull|install|download/i,
    );
  });
});
