import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FAKE_TTS_ASSISTANT_PROSE_REQUEST,
  FAKE_TTS_DEGRADED_PROVIDER_HEALTH,
  FAKE_TTS_PROVIDER_CONFIG,
  FAKE_TTS_TIMEOUT_CANCELLATION_REASON,
  FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH,
  FAKE_TTS_UNSAFE_CONTENT_REQUEST,
  FakeTtsProviderError,
  createFakeTtsProvider,
  type TtsProvider,
} from "../../../src/lib/voice-runtime";

describe("Phase 14B.2 fake TTS provider", () => {
  it("satisfies the TtsProvider contract", async () => {
    const provider: TtsProvider = createFakeTtsProvider();

    expect(provider).toMatchObject({
      id: FAKE_TTS_PROVIDER_CONFIG.provider_id,
      kind: "local",
      config: FAKE_TTS_PROVIDER_CONFIG,
      metadata_only: true,
    });
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: FAKE_TTS_PROVIDER_CONFIG.provider_id,
      provider_kind: "local",
      ok: true,
      degraded: false,
      metadata_only: true,
    });
  });

  it("returns deterministic metadata for valid assistant prose", async () => {
    const provider = createFakeTtsProvider();
    const result = await provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });

    expect(result).toEqual({
      request_id: "fake-tts-request-1",
      chunk: {
        chunk_id: "fake-17d24b9f",
        provider_id: "fake-local-tts",
        voice_id: "fake-voice",
        duration_ms: 1225,
        size_bytes: 29960,
        degraded: false,
        output_ref: "fake-tts://metadata/fake-local-tts/fake-17d24b9f",
        metadata_only: true,
      },
      latency_ms: 5,
      degraded: false,
      metadata_only: true,
    });
  });

  it("repeats identical output metadata for identical input", async () => {
    const provider = createFakeTtsProvider();
    const first = await provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });
    const second = await provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });

    expect(second).toEqual(first);
  });

  it("never returns raw audio bytes", async () => {
    const provider = createFakeTtsProvider();
    const result = await provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });
    const serialized = JSON.stringify(result);

    expect(Object.keys(result.chunk)).not.toContain("audio");
    expect(Object.keys(result.chunk)).not.toContain("raw_audio");
    expect(Object.keys(result.chunk)).not.toContain("audio_bytes");
    expect(serialized).not.toContain("RIFF");
    expect(serialized).not.toContain("base64");
  });

  it("fails closed for unsafe content classes", async () => {
    const provider = createFakeTtsProvider();

    await expect(
      provider.synthesize(FAKE_TTS_UNSAFE_CONTENT_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      name: "FakeTtsProviderError",
      reason: "policy_blocked",
      metadata_only: true,
    });
  });

  it("honors abort and cancel paths", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const provider = createFakeTtsProvider();

    await expect(
      provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        abort_signal: aborted.signal,
        metadata_only: true,
      }),
    ).rejects.toBeInstanceOf(FakeTtsProviderError);
    await expect(provider.cancel("user_cancelled")).resolves.toBeUndefined();
    await expect(
      provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "user_cancelled",
    });
  });

  it("represents deterministic degraded, unavailable, and timeout-like fixtures", async () => {
    const degraded = createFakeTtsProvider({
      mode: "degraded",
      now_ms: () => 123,
    });
    await expect(degraded.health()).resolves.toEqual({
      ...FAKE_TTS_DEGRADED_PROVIDER_HEALTH,
      checked_at_ms: 123,
    });
    await expect(
      degraded.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      degraded: true,
      chunk: {
        degraded: true,
      },
    });

    const unavailable = createFakeTtsProvider({
      mode: "unavailable",
      now_ms: () => 456,
    });
    await expect(unavailable.health()).resolves.toEqual({
      ...FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH,
      checked_at_ms: 456,
    });
    await expect(
      unavailable.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "provider_unavailable",
    });

    const timeout = createFakeTtsProvider();
    await timeout.cancel(FAKE_TTS_TIMEOUT_CANCELLATION_REASON);
    await expect(timeout.health()).resolves.toMatchObject({
      ok: false,
      last_error_class: "timeout",
    });
  });

  it("does not introduce subprocess, Piper execution, playback, runtime, persistence, cloud, or UI wiring", () => {
    const source = [
      "src/lib/voice-runtime/tts/fake-provider.ts",
      "src/lib/voice-runtime/tts/fixtures.ts",
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
