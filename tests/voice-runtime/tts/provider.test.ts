import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TTS_CONTENT_CLASSES,
  validateTtsSynthesisRequest,
  type TtsAudioChunkMetadata,
  type TtsProvider,
  type TtsProviderConfig,
  type TtsSynthesisRequest,
  type TtsSynthesisResult,
} from "../../../src/lib/voice-runtime";

function providerConfig(): TtsProviderConfig {
  return {
    provider_id: "local-piper",
    provider_kind: "local",
    voice_id: "jarvis-local",
    max_input_chars: 200,
    timeout_ms: 5_000,
    metadata_only: true,
  };
}

function synthesisRequest(
  overrides: Partial<TtsSynthesisRequest> = {},
): TtsSynthesisRequest {
  return {
    request_id: "tts-request-1",
    text: "A short assistant response.",
    content_class: "assistant_prose",
    turn_id: "turn-1",
    session_id: "session-1",
    requested_voice_id: "jarvis-local",
    allow_sensitive_content: false,
    metadata_only: true,
    ...overrides,
  };
}

describe("Phase 14B.1 local TTS provider scaffold", () => {
  it("keeps the provider interface shape stable without real synthesis", async () => {
    const chunk: TtsAudioChunkMetadata = {
      chunk_id: "chunk-1",
      provider_id: "local-piper",
      voice_id: "jarvis-local",
      duration_ms: 1000,
      size_bytes: 4096,
      degraded: false,
      output_ref: "metadata://voice-runtime/chunk-1",
      metadata_only: true,
    };
    const result: TtsSynthesisResult = {
      request_id: "tts-request-1",
      chunk,
      latency_ms: 12,
      degraded: false,
      metadata_only: true,
    };
    const provider: TtsProvider = {
      id: "local-piper",
      kind: "local",
      config: providerConfig(),
      metadata_only: true,
      synthesize: async () => result,
      cancel: async () => undefined,
      health: async () => ({
        provider_id: "local-piper",
        ok: true,
        provider_kind: "local",
        checked_at_ms: 1,
        degraded: false,
        metadata_only: true,
      }),
    };

    await expect(
      provider.synthesize(synthesisRequest(), { metadata_only: true }),
    ).resolves.toEqual(result);
    await expect(provider.cancel("user_cancelled")).resolves.toBeUndefined();
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "local-piper",
      provider_kind: "local",
      metadata_only: true,
    });
  });

  it("validates safe assistant prose requests", () => {
    expect(
      validateTtsSynthesisRequest(synthesisRequest(), providerConfig()),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it.each(
    TTS_CONTENT_CLASSES.filter(
      (contentClass) => contentClass !== "assistant_prose",
    ),
  )("fails closed for unsafe content class %s", (contentClass) => {
    expect(
      validateTtsSynthesisRequest(
        synthesisRequest({
          content_class: contentClass,
          allow_sensitive_content: true,
        }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["sensitive_content_blocked"]),
    });
  });

  it("fails closed for malformed, empty, too-long, or unsupported voice requests", () => {
    expect(validateTtsSynthesisRequest(null, providerConfig())).toEqual({
      ok: false,
      reasons: ["malformed_request"],
    });
    expect(
      validateTtsSynthesisRequest(
        synthesisRequest({ text: "" }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["empty_text"]),
    });
    expect(
      validateTtsSynthesisRequest(
        synthesisRequest({ text: "x".repeat(201) }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["input_too_long"]),
    });
    expect(
      validateTtsSynthesisRequest(
        synthesisRequest({ requested_voice_id: "other-voice" }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["unsupported_voice"]),
    });
  });

  it("keeps output metadata-only with no raw audio field", () => {
    const chunk: TtsAudioChunkMetadata = {
      chunk_id: "chunk-1",
      provider_id: "local-piper",
      voice_id: "jarvis-local",
      duration_ms: 1000,
      size_bytes: 4096,
      degraded: false,
      output_ref: "metadata://voice-runtime/chunk-1",
      metadata_only: true,
    };

    expect(Object.keys(chunk)).toEqual([
      "chunk_id",
      "provider_id",
      "voice_id",
      "duration_ms",
      "size_bytes",
      "degraded",
      "output_ref",
      "metadata_only",
    ]);
    expect(Object.keys(chunk)).not.toContain("audio");
    expect(Object.keys(chunk)).not.toContain("raw_audio");
    expect(Object.keys(chunk)).not.toContain("audio_bytes");
  });

  it("does not introduce execution, playback, runtime, persistence, cloud, or UI wiring", () => {
    const source = [
      "src/lib/voice-runtime/tts/types.ts",
      "src/lib/voice-runtime/tts/provider.ts",
      "src/lib/voice-runtime/tts/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(/piper\s+(?:--|["'])|ffmpeg|faster-whisper/i);
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\(/i,
    );
  });
});
