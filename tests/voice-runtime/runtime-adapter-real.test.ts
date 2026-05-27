import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  RealVoiceRuntimeAdapterError,
  createRealVoiceRuntimeAdapter,
  type VoiceRuntimeAdapterRequest,
} from "../../src/lib/voice-runtime";
import type {
  ModelProviderFailureClass,
  ModelProviderFinishReason,
  ModelProviderOutput,
  ModelRuntime,
  ModelRuntimeExecuteResult,
} from "../../src/models";

const SAFE_TRANSCRIPT = "Good evening. All systems are operational.";
const SAFE_ASSISTANT_TEXT = "Acknowledged. Governed local runtime is online.";

function runtimeAdapterRealSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/runtime-adapter-real.ts"),
    "utf8",
  );
}

function runtimeRequest(
  overrides: Partial<VoiceRuntimeAdapterRequest> = {},
): VoiceRuntimeAdapterRequest {
  return {
    request_id: "voice-runtime-request-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    source: "voice",
    transcript: SAFE_TRANSCRIPT,
    created_at: "2026-05-27T07:00:00.000Z",
    safety_context: {
      approval_required: true,
      tool_execution_allowed: false,
      persistence_allowed: false,
      metadata_only: true,
    },
    metadata_only: true,
    ...overrides,
  };
}

function createRuntime(
  result: ModelRuntimeExecuteResult,
): ModelRuntime & { readonly execute: ReturnType<typeof vi.fn> } {
  return {
    execute: vi.fn(async () => result),
    stream: async function* () {
      return;
    },
  };
}

function runtimeResult(
  overrides: {
    readonly ok?: boolean;
    readonly output?: ModelProviderOutput;
    readonly finishReason?: ModelProviderFinishReason;
    readonly failureClass?: ModelProviderFailureClass;
  } = {},
): ModelRuntimeExecuteResult {
  const ok = overrides.ok ?? true;
  const finishReason = overrides.finishReason ?? "stop";
  const output = overrides.output ?? {
    kind: "text",
    content: SAFE_ASSISTANT_TEXT,
  };
  return {
    request_id: "voice-runtime-request-1",
    ok,
    response: ok
      ? {
          request_id: "voice-runtime-request-1",
          model_id: "local-primary",
          provider_id: "governed-provider",
          output,
          latency_ms: 13,
          token_usage: {
            input_tokens: 5,
            output_tokens: 4,
            total_tokens: 9,
          },
          finish_reason: finishReason,
          degraded: false,
          redaction_status: "metadata_only",
        }
      : null,
    metadata: {
      selected_model_id: "local-primary",
      attempted_models: ["local-primary"],
      successful_model: ok ? "local-primary" : null,
      failed_models: ok
        ? []
        : [
            {
              model_id: "local-primary",
              provider_id: "governed-provider",
              failure_class: overrides.failureClass ?? "provider_error",
              message: "Runtime failed closed.",
            },
          ],
      fallback_used: false,
      governance_flags: [],
      latency_ms: 21,
      degraded: !ok,
      ...(ok
        ? {}
        : { failure_class: overrides.failureClass ?? "provider_error" }),
      execution_summary: {
        execution_id: "voice-runtime-request-1",
        request_id: "voice-runtime-request-1",
        capability: "chat",
        selected_model_id: "local-primary",
        selected_provider: "governed-provider",
        attempted_models: ["local-primary"],
        successful_model: ok ? "local-primary" : null,
        failed_models: ok
          ? []
          : [
              {
                model_id: "local-primary",
                provider_id: "governed-provider",
                failure_class: overrides.failureClass ?? "provider_error",
                message: "Runtime failed closed.",
              },
            ],
        fallback_used: false,
        fallback_chain: [],
        ...(ok
          ? {}
          : { failure_class: overrides.failureClass ?? "provider_error" }),
        latency_ms: 21,
        token_usage: ok
          ? {
              input_tokens: 5,
              output_tokens: 4,
              total_tokens: 9,
            }
          : {
              input_tokens: 0,
              output_tokens: 0,
              total_tokens: 0,
            },
        degraded: !ok,
        finish_reason: ok ? finishReason : "error",
        governance_flags: [],
        redaction_status: "metadata_only",
        runtime_class: "local",
        provider_kind: "ollama",
      },
    },
  };
}

describe("Phase 14F.4 real voice runtime adapter binding", () => {
  it("invokes the governed runtime path only when explicitly executed", async () => {
    const runtime = createRuntime(runtimeResult());
    const adapter = createRealVoiceRuntimeAdapter({ runtime });

    expect(runtime.execute).not.toHaveBeenCalled();
    await expect(adapter.health()).resolves.toEqual({
      ok: true,
      degraded: false,
      provider_id: "governed-model-runtime",
      metadata_only: true,
    });
    expect(runtime.execute).not.toHaveBeenCalled();

    await expect(
      adapter.executeVoiceRequest(runtimeRequest(), {
        timeout_ms: 1234,
        metadata_only: true,
      }),
    ).resolves.toEqual({
      response_id: "voice-runtime-request-1",
      assistant_text: SAFE_ASSISTANT_TEXT,
      latency_ms: 21,
      degraded: false,
      provider_id: "governed-provider",
      finish_reason: "stop",
      metadata_only: true,
    });
    expect(runtime.execute).toHaveBeenCalledOnce();
  });

  it("creates a local-only metadata-safe runtime request with tool execution disabled", async () => {
    const controller = new AbortController();
    const runtime = createRuntime(runtimeResult());
    const adapter = createRealVoiceRuntimeAdapter({ runtime });

    await adapter.executeVoiceRequest(runtimeRequest(), {
      timeout_ms: 2222,
      abort_signal: controller.signal,
      metadata_only: true,
    });

    expect(runtime.execute).toHaveBeenCalledWith({
      request_id: "voice-runtime-request-1",
      capability: "chat",
      input: {
        kind: "messages",
        messages: [
          {
            role: "user",
            content: SAFE_TRANSCRIPT,
          },
        ],
      },
      resolver_options: {
        runtime_class: "local",
        allow_cloud: false,
        allow_disabled: false,
        required_tools: false,
        required_vision: false,
      },
      options: {
        tool_choice: "none",
      },
      timeout_ms: 2222,
      abort_signal: controller.signal,
    });
  });

  it("fails closed for tool calls, approval-like output, unsafe classes, and malformed runtime responses", async () => {
    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({
            output: {
              kind: "tool_calls",
              calls: [
                {
                  id: "tool-1",
                  name: "dangerous_tool",
                  arguments_json: "{}",
                },
              ],
            },
            finishReason: "tool_calls",
          }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "policy_blocked" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({
            output: {
              kind: "text",
              content: "APPROVAL_REQUIRED: approve this action",
            },
          }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "policy_blocked" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({
            output: {
              kind: "text",
              content: "Tool result",
              content_class: "tool_output",
            } as unknown as ModelProviderOutput,
          }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "policy_blocked" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime({
          ...runtimeResult(),
          response: null,
        } as unknown as ModelRuntimeExecuteResult),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toBeInstanceOf(RealVoiceRuntimeAdapterError);
  });

  it("maps governed runtime failures into fail-closed voice adapter errors", async () => {
    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({ ok: false, failureClass: "policy_blocked" }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "policy_blocked" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({ ok: false, failureClass: "model_missing" }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "unavailable" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(
          runtimeResult({ ok: false, failureClass: "timeout" }),
        ),
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "cancelled" });
  });

  it("honors already-aborted signals without invoking runtime", async () => {
    const controller = new AbortController();
    controller.abort();
    const runtime = createRuntime(runtimeResult());

    await expect(
      createRealVoiceRuntimeAdapter({ runtime }).executeVoiceRequest(
        runtimeRequest(),
        {
          abort_signal: controller.signal,
          metadata_only: true,
        },
      ),
    ).rejects.toMatchObject({ reason: "cancelled" });
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it("rejects malformed voice runtime requests and unavailable runtime seams", async () => {
    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: createRuntime(runtimeResult()),
      }).executeVoiceRequest({
        ...runtimeRequest(),
        transcript: "",
      }),
    ).rejects.toMatchObject({ reason: "invalid_request" });

    await expect(
      createRealVoiceRuntimeAdapter({
        runtime: null as unknown as ModelRuntime,
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("does not add persistence, cloud/network, UI/Tauri, wake word, always-listening, streaming, autoplay, or runtime construction", () => {
    const source = runtimeAdapterRealSource();

    expect(source).toContain("runtime.execute");
    expect(source).not.toMatch(/createModelRuntime|new\s+ModelRuntime/i);
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(
      /wake_word|wakeword|always_listening|always-listening|AsyncIterable|partial_token|partial_transcript|stream\s*\(/i,
    );
    expect(source).not.toMatch(/autoplay|auto.?play|beginPlayback|playLoaded/i);
    expect(source).not.toMatch(
      /executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
  });
});
