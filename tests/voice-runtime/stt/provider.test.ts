import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateSttTranscriptionRequest,
  type SttAudioMetadata,
  type SttProvider,
  type SttProviderConfig,
  type SttTranscriptionRequest,
  type SttTranscriptionResult,
} from "../../../src/lib/voice-runtime";

function providerConfig(): SttProviderConfig {
  return {
    provider_id: "local-faster-whisper",
    provider_kind: "local",
    model_id: "base.en",
    language: "en",
    max_audio_bytes: 1_000_000,
    timeout_ms: 30_000,
    metadata_only: true,
  };
}

function audioMetadata(
  overrides: Partial<SttAudioMetadata> = {},
): SttAudioMetadata {
  return {
    audio_ref: "local-audio://session-1/turn-1.wav",
    mime_type: "audio/wav",
    duration_ms: 1200,
    size_bytes: 32000,
    sample_rate_hz: 16000,
    metadata_only: true,
    ...overrides,
  };
}

function transcriptionRequest(
  overrides: Partial<SttTranscriptionRequest> = {},
): SttTranscriptionRequest {
  return {
    request_id: "stt-request-1",
    session_id: "session-1",
    turn_id: "turn-1",
    audio: audioMetadata(),
    metadata_only: true,
    ...overrides,
  };
}

describe("Phase 14C.1 local STT provider scaffold", () => {
  it("keeps the provider interface shape stable without real transcription", async () => {
    const result: SttTranscriptionResult = {
      request_id: "stt-request-1",
      provider_id: "local-faster-whisper",
      transcript: "metadata-safe transcript result",
      language: "en",
      latency_ms: 25,
      degraded: false,
      confidence_band: "high",
      metadata_only: true,
    };
    const provider: SttProvider = {
      id: "local-faster-whisper",
      kind: "local",
      config: providerConfig(),
      metadata_only: true,
      transcribe: async () => result,
      cancel: async () => undefined,
      health: async () => ({
        provider_id: "local-faster-whisper",
        ok: true,
        provider_kind: "local",
        checked_at_ms: 1,
        degraded: false,
        metadata_only: true,
      }),
    };

    await expect(
      provider.transcribe(transcriptionRequest(), { metadata_only: true }),
    ).resolves.toEqual(result);
    await expect(provider.cancel("user_cancelled")).resolves.toBeUndefined();
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "local-faster-whisper",
      provider_kind: "local",
      metadata_only: true,
    });
  });

  it("validates metadata-only audio references", () => {
    expect(
      validateSttTranscriptionRequest(transcriptionRequest(), providerConfig()),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("fails closed for malformed, missing, oversized, or invalid audio metadata", () => {
    expect(validateSttTranscriptionRequest(null, providerConfig())).toEqual({
      ok: false,
      reasons: ["malformed_request"],
    });
    expect(
      validateSttTranscriptionRequest(
        transcriptionRequest({ audio: audioMetadata({ audio_ref: "" }) }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["missing_audio_ref"]),
    });
    expect(
      validateSttTranscriptionRequest(
        transcriptionRequest({
          audio: audioMetadata({ size_bytes: 1_000_001 }),
        }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["audio_too_large"]),
    });
    expect(
      validateSttTranscriptionRequest(
        transcriptionRequest({ audio: audioMetadata({ duration_ms: 0 }) }),
        providerConfig(),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["audio_duration_invalid"]),
    });
  });

  it("keeps result shape metadata-safe and separate from telemetry persistence", () => {
    const result: SttTranscriptionResult = {
      request_id: "stt-request-1",
      provider_id: "local-faster-whisper",
      transcript: "hello world",
      language: "en",
      latency_ms: 25,
      degraded: false,
      confidence_band: "medium",
      metadata_only: true,
    };

    expect(Object.keys(result)).toEqual([
      "request_id",
      "provider_id",
      "transcript",
      "language",
      "latency_ms",
      "degraded",
      "confidence_band",
      "metadata_only",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm/,
    );
  });

  it("does not introduce execution, mic, runtime, persistence, cloud, UI, or Tauri wiring", () => {
    const source = [
      "src/lib/voice-runtime/stt/types.ts",
      "src/lib/voice-runtime/stt/provider.ts",
      "src/lib/voice-runtime/stt/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(
      /faster-whisper\s+--|python\s+-m\s+faster_whisper|from\s+["']faster_whisper/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone/i,
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
