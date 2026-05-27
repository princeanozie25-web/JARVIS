import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
  FakeVoiceRuntimeAdapterError,
  createFakeVoiceRuntimeAdapter,
  isVoiceRuntimeAdapterRequest,
  type VoiceRuntimeAdapterRequest,
} from "../../src/lib/voice-runtime";

function runtimeAdapterSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/runtime-adapter.ts"),
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
    transcript: "Good evening. All systems are operational.",
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

describe("Phase 14F.2 voice runtime adapter seam", () => {
  it("validates metadata-safe voice runtime requests", () => {
    expect(isVoiceRuntimeAdapterRequest(runtimeRequest())).toBe(true);
    expect(
      isVoiceRuntimeAdapterRequest({
        ...runtimeRequest(),
        tool_output: "secret tool result",
      }),
    ).toBe(false);
    expect(
      isVoiceRuntimeAdapterRequest({
        ...runtimeRequest(),
        safety_context: {
          approval_required: true,
          tool_execution_allowed: true,
          persistence_allowed: false,
          metadata_only: true,
        },
      }),
    ).toBe(false);
  });

  it("returns deterministic fake assistant prose", async () => {
    const adapter = createFakeVoiceRuntimeAdapter({
      now_ms: () => 1000,
    });

    await expect(
      adapter.executeVoiceRequest(runtimeRequest()),
    ).resolves.toEqual({
      response_id: "fake-runtime-response-e1ffcce3",
      assistant_text: FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
      latency_ms: 48,
      degraded: false,
      provider_id: "fake-voice-runtime",
      finish_reason: "stop",
      metadata_only: true,
    });
    await expect(adapter.health()).resolves.toEqual({
      ok: true,
      degraded: false,
      provider_id: "fake-voice-runtime",
      metadata_only: true,
    });
  });

  it("supports degraded, unavailable, failure, and cancellation modes", async () => {
    await expect(
      createFakeVoiceRuntimeAdapter({ mode: "degraded" }).executeVoiceRequest(
        runtimeRequest(),
      ),
    ).resolves.toMatchObject({
      degraded: true,
      assistant_text: FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
    });

    await expect(
      createFakeVoiceRuntimeAdapter({ mode: "unavailable" }).health(),
    ).resolves.toEqual({
      ok: false,
      degraded: false,
      provider_id: "fake-voice-runtime",
      error_class: "unavailable",
      metadata_only: true,
    });
    await expect(
      createFakeVoiceRuntimeAdapter({
        mode: "unavailable",
      }).executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({
      reason: "unavailable",
      metadata_only: true,
    });

    await expect(
      createFakeVoiceRuntimeAdapter({ mode: "fail" }).executeVoiceRequest(
        runtimeRequest(),
      ),
    ).rejects.toBeInstanceOf(FakeVoiceRuntimeAdapterError);

    const cancelled = createFakeVoiceRuntimeAdapter();
    await cancelled.cancel("cancelled");
    await expect(
      cancelled.executeVoiceRequest(runtimeRequest()),
    ).rejects.toMatchObject({
      reason: "cancelled",
    });
  });

  it("honors abort signals and rejects malformed requests", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = createFakeVoiceRuntimeAdapter();

    await expect(
      adapter.executeVoiceRequest(runtimeRequest(), {
        abort_signal: controller.signal,
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "cancelled",
    });
    await expect(
      adapter.executeVoiceRequest({
        ...runtimeRequest(),
        transcript: "",
      }),
    ).rejects.toMatchObject({
      reason: "invalid_request",
    });
  });

  it("does not import real runtime/router/model providers, tools, persistence, network, UI, streaming, wake word, or autoplay paths", () => {
    const source = runtimeAdapterSource();

    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /tool_call|executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
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
      /wake_word|wakeword|always_listening|always-listening|AsyncIterable|partial/i,
    );
    expect(source).not.toMatch(/autoplay|auto.?play/i);
  });
});
