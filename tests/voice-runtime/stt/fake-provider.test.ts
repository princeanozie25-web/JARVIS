import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FAKE_STT_DEGRADED_PROVIDER_HEALTH,
  FAKE_STT_OVERSIZED_AUDIO_REQUEST,
  FAKE_STT_PROVIDER_CONFIG,
  FAKE_STT_TIMEOUT_CANCELLATION_REASON,
  FAKE_STT_TRANSCRIPT,
  FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH,
  FAKE_STT_VALID_AUDIO_REQUEST,
  FakeSttProviderError,
  createFakeSttProvider,
  type SttProvider,
} from "../../../src/lib/voice-runtime";

describe("Phase 14C.2 fake STT provider", () => {
  it("satisfies the SttProvider contract", async () => {
    const provider: SttProvider = createFakeSttProvider();

    expect(provider).toMatchObject({
      id: FAKE_STT_PROVIDER_CONFIG.provider_id,
      kind: "local",
      config: FAKE_STT_PROVIDER_CONFIG,
      metadata_only: true,
    });
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: FAKE_STT_PROVIDER_CONFIG.provider_id,
      provider_kind: "local",
      ok: true,
      degraded: false,
      metadata_only: true,
    });
  });

  it("returns deterministic metadata for valid audio refs", async () => {
    const provider = createFakeSttProvider();
    const result = await provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });

    expect(result).toEqual({
      request_id: "fake-stt-request-1",
      provider_id: "fake-local-stt",
      transcript: FAKE_STT_TRANSCRIPT,
      language: "en",
      latency_ms: 14,
      degraded: false,
      confidence_band: "high",
      metadata_only: true,
    });
  });

  it("repeats identical transcription metadata for identical input", async () => {
    const provider = createFakeSttProvider();
    const first = await provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });
    const second = await provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });

    expect(second).toEqual(first);
  });

  it("never returns raw audio bytes or reads audio files", async () => {
    const provider = createFakeSttProvider();
    const result = await provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/,
    );
    expect(Object.keys(result)).not.toContain("audio");
    expect(Object.keys(result)).not.toContain("audio_ref");
  });

  it("fails closed for oversized and malformed requests", async () => {
    const provider = createFakeSttProvider();

    await expect(
      provider.transcribe(FAKE_STT_OVERSIZED_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      name: "FakeSttProviderError",
      reason: "policy_blocked",
      metadata_only: true,
    });
    await expect(
      provider.transcribe(
        {
          ...FAKE_STT_VALID_AUDIO_REQUEST,
          audio: {
            ...FAKE_STT_VALID_AUDIO_REQUEST.audio,
            audio_ref: "",
          },
        },
        { metadata_only: true },
      ),
    ).rejects.toMatchObject({
      reason: "provider_error",
    });
  });

  it("honors abort and cancel paths", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const provider = createFakeSttProvider();

    await expect(
      provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        abort_signal: aborted.signal,
        metadata_only: true,
      }),
    ).rejects.toBeInstanceOf(FakeSttProviderError);
    await expect(provider.cancel("user_cancelled")).resolves.toBeUndefined();
    await expect(
      provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "user_cancelled",
    });
  });

  it("represents deterministic degraded, unavailable, and timeout-like fixtures", async () => {
    const degraded = createFakeSttProvider({
      mode: "degraded",
      now_ms: () => 123,
    });
    await expect(degraded.health()).resolves.toEqual({
      ...FAKE_STT_DEGRADED_PROVIDER_HEALTH,
      checked_at_ms: 123,
    });
    await expect(
      degraded.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      degraded: true,
      confidence_band: "medium",
    });

    const unavailable = createFakeSttProvider({
      mode: "unavailable",
      now_ms: () => 456,
    });
    await expect(unavailable.health()).resolves.toEqual({
      ...FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH,
      checked_at_ms: 456,
    });
    await expect(
      unavailable.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "provider_unavailable",
    });

    const timeout = createFakeSttProvider();
    await timeout.cancel(FAKE_STT_TIMEOUT_CANCELLATION_REASON);
    await expect(timeout.health()).resolves.toMatchObject({
      ok: false,
      last_error_class: "timeout",
    });
  });

  it("does not introduce subprocess, faster-whisper execution, mic, streaming, runtime, persistence, cloud, UI, or Tauri wiring", () => {
    const source = [
      "src/lib/voice-runtime/stt/fake-provider.ts",
      "src/lib/voice-runtime/stt/fixtures.ts",
      "src/lib/voice-runtime/stt/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /from\s+["']node:(?:fs|child_process)["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|readFile/i,
    );
    expect(source).not.toMatch(
      /faster-whisper\s+--|python\s+-m\s+faster_whisper|from\s+["']faster_whisper/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone/i,
    );
    expect(source).not.toMatch(/AsyncIterable|streaming|partial/i);
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
