import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createPlaybackQueue,
  createVoiceRuntimeBridge,
  type SttProvider,
  type SttProviderHealth,
  type SttTranscriptionResult,
  type TtsProvider,
  type TtsProviderHealth,
  type TtsSynthesisResult,
  type VoicePlaybackRequestInput,
  type VoiceRuntimeBridgeCapturedAudioMetadata,
} from "../../src/lib/voice-runtime";

const SAFE_TRANSCRIPT = "Good evening. All systems are operational.";
const SAFE_ASSISTANT_TEXT = "Acknowledged. Local voice bridge is standing by.";

function runtimeBridgeSource(): string {
  return [
    "src/lib/voice-runtime/runtime-bridge.ts",
    "src/lib/voice-runtime/index.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

function capturedAudio(
  overrides: Partial<VoiceRuntimeBridgeCapturedAudioMetadata> = {},
): VoiceRuntimeBridgeCapturedAudioMetadata {
  return {
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    audio_ref: "C:/tmp/jarvis-capture.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    sample_rate_hz: 16000,
    channel_count: 1,
    degraded: false,
    started_at: "2026-05-27T07:00:00.000Z",
    stopped_at: "2026-05-27T07:00:01.200Z",
    metadata_only: true,
    ...overrides,
  };
}

function playbackInput(
  overrides: Partial<VoicePlaybackRequestInput> = {},
): VoicePlaybackRequestInput {
  return {
    request_id: "voice-playback-request-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    text: SAFE_ASSISTANT_TEXT,
    content_class: "assistant_prose",
    requested_voice_id: "fake-voice",
    metadata_only: true,
    ...overrides,
  };
}

function sttResult(transcript = SAFE_TRANSCRIPT): SttTranscriptionResult {
  return {
    request_id: "voice-runtime-voice-session-1-voice-turn-1",
    provider_id: "fake-local-stt",
    transcript,
    language: "en",
    latency_ms: 12,
    degraded: false,
    confidence_band: "high",
    metadata_only: true,
  };
}

function ttsResult(): TtsSynthesisResult {
  return {
    request_id: "voice-playback-request-1",
    chunk: {
      chunk_id: "tts-chunk-1",
      provider_id: "fake-local-tts",
      voice_id: "fake-voice",
      duration_ms: 1100,
      size_bytes: 24000,
      degraded: false,
      output_ref: "C:/tmp/jarvis-tts.wav",
      metadata_only: true,
    },
    latency_ms: 5,
    degraded: false,
    metadata_only: true,
  };
}

function fakeSttProvider(
  options: {
    readonly ok?: boolean;
    readonly transcribeFails?: boolean;
  } = {},
): SttProvider {
  const health: SttProviderHealth = {
    provider_id: "fake-local-stt",
    ok: options.ok ?? true,
    provider_kind: "local",
    checked_at_ms: 0,
    degraded: false,
    metadata_only: true,
  };
  return {
    id: "fake-local-stt",
    kind: "local",
    config: {
      provider_id: "fake-local-stt",
      provider_kind: "local",
      model_id: "fake-stt",
      max_audio_bytes: 1_000_000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    transcribe: vi.fn(async () => {
      if (options.transcribeFails) throw new Error("stt failed");
      return sttResult();
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function fakeTtsProvider(
  options: {
    readonly ok?: boolean;
    readonly synthesizeFails?: boolean;
  } = {},
): TtsProvider {
  const health: TtsProviderHealth = {
    provider_id: "fake-local-tts",
    ok: options.ok ?? true,
    provider_kind: "local",
    checked_at_ms: 0,
    degraded: false,
    metadata_only: true,
  };
  return {
    id: "fake-local-tts",
    kind: "local",
    config: {
      provider_id: "fake-local-tts",
      provider_kind: "local",
      voice_id: "fake-voice",
      max_input_chars: 1000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    synthesize: vi.fn(async () => {
      if (options.synthesizeFails) throw new Error("tts failed");
      return ttsResult();
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function createHarness(
  options: {
    readonly stt?: SttProvider;
    readonly tts?: TtsProvider;
    readonly queueDepth?: number;
  } = {},
) {
  const playbackQueue = createPlaybackQueue({
    max_queue_depth: options.queueDepth ?? 4,
    allow_sensitive_content: false,
    metadata_only: true,
  });
  const stt = options.stt ?? fakeSttProvider();
  const tts = options.tts ?? fakeTtsProvider();
  const bridge = createVoiceRuntimeBridge({
    stt_provider: stt,
    tts_provider: tts,
    playback_queue: playbackQueue,
    now_ms: () => 1000,
  });
  return { bridge, playbackQueue, stt, tts };
}

describe("Phase 14F.1 voice runtime bridge scaffold", () => {
  it("creates metadata-safe runtime requests from captured audio", async () => {
    const { bridge, stt } = createHarness();

    await expect(bridge.ingestCapturedAudio(capturedAudio())).resolves.toEqual({
      ok: true,
      value: {
        request_id: "voice-runtime-voice-session-1-voice-turn-1",
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        capability: "chat",
        input_kind: "voice_text",
        input_length: SAFE_TRANSCRIPT.length,
        language: "en",
        confidence_band: "high",
        stt_provider_id: "fake-local-stt",
        degraded: false,
        metadata_only: true,
      },
      snapshot: {
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        stt_status: "ready_for_runtime",
        tts_status: "idle",
        playback_queue_depth: 0,
        degraded: false,
        started_at: "1970-01-01T00:00:01.000Z",
        updated_at: "1970-01-01T00:00:01.000Z",
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
    expect(stt.transcribe).toHaveBeenCalledOnce();
    expect(JSON.stringify(bridge.snapshot())).not.toContain(SAFE_TRANSCRIPT);
    expect(JSON.stringify(bridge.createVoiceRuntimeRequest())).not.toContain(
      SAFE_TRANSCRIPT,
    );
  });

  it("creates metadata-safe playback requests without autoplay", async () => {
    const { bridge, playbackQueue, tts } = createHarness();

    await expect(
      bridge.createVoicePlaybackRequest(playbackInput()),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        request_id: "voice-playback-request-1",
        item_id: "voice-playback-tts-chunk-1",
        chunk_id: "tts-chunk-1",
        provider_id: "fake-local-tts",
        voice_id: "fake-voice",
        duration_ms: 1100,
        size_bytes: 24000,
        playback_queue_depth: 1,
        metadata_only: true,
      },
      snapshot: {
        tts_status: "queued_for_playback",
        playback_queue_depth: 1,
      },
    });

    expect(tts.synthesize).toHaveBeenCalledOnce();
    expect(playbackQueue.snapshot()).toMatchObject({
      depth: 1,
      items: [
        {
          item_id: "voice-playback-tts-chunk-1",
          content_class: "assistant_prose",
        },
      ],
    });
    expect(JSON.stringify(bridge.snapshot())).not.toContain(
      SAFE_ASSISTANT_TEXT,
    );
  });

  it("fails closed for autoplay requests and unsafe content", async () => {
    const { bridge, tts } = createHarness();

    await expect(
      bridge.createVoicePlaybackRequest(
        playbackInput({ allow_autoplay: true }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["autoplay_blocked"],
    });
    await expect(
      bridge.createVoicePlaybackRequest(
        playbackInput({ content_class: "tool_output" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
    });
    expect(tts.synthesize).not.toHaveBeenCalled();
  });

  it("fails closed for missing capture metadata, unavailable providers, and active sessions", async () => {
    await expect(
      createHarness().bridge.ingestCapturedAudio(null),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["malformed_capture"],
    });

    await expect(
      createHarness({
        stt: fakeSttProvider({ ok: false }),
      }).bridge.ingestCapturedAudio(capturedAudio()),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["stt_unavailable"],
      snapshot: { stt_status: "failed" },
    });

    const active = createHarness();
    await active.bridge.ingestCapturedAudio(capturedAudio());
    await expect(
      active.bridge.ingestCapturedAudio(
        capturedAudio({ turn_id: "voice-turn-2" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["session_active"],
    });

    await expect(
      createHarness({
        tts: fakeTtsProvider({ ok: false }),
      }).bridge.createVoicePlaybackRequest(playbackInput()),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["tts_unavailable"],
      snapshot: { tts_status: "failed" },
    });
  });

  it("reset clears bridge state and playback queue metadata", async () => {
    const { bridge, playbackQueue } = createHarness();

    await bridge.ingestCapturedAudio(capturedAudio());
    await bridge.createVoicePlaybackRequest(playbackInput());
    expect(playbackQueue.snapshot().depth).toBe(1);

    expect(bridge.reset()).toEqual({
      ok: true,
      value: null,
      snapshot: {
        session_id: null,
        turn_id: null,
        stt_status: "idle",
        tts_status: "idle",
        playback_queue_depth: 0,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
    expect(playbackQueue.snapshot().depth).toBe(0);
  });

  it("exposes metadata-only snapshots without raw audio, transcripts, prompts, responses, or tool results", async () => {
    const { bridge } = createHarness();
    await bridge.ingestCapturedAudio(capturedAudio());
    const snapshot = bridge.snapshot();

    expect(Object.keys(snapshot)).toEqual([
      "session_id",
      "turn_id",
      "stt_status",
      "tts_status",
      "playback_queue_depth",
      "degraded",
      "metadata_only",
      "started_at",
      "updated_at",
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response|model_output|tool_output|Good evening/i,
    );
  });

  it("does not introduce runtime/router/model execution, tools, persistence, cloud, UI, wake word, always-listening, or streaming", () => {
    const source = runtimeBridgeSource();

    expect(source).not.toMatch(
      /createModelRuntime|execute\s*\(|stream\s*\(|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
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
      /wake_word|wakeword|always_listening|always-listening|MediaStream|AsyncIterable|partial/i,
    );
    expect(source).not.toMatch(
      /playback_autostart|beginPlayback\s*\(|playLoaded\s*\(|loadNext\s*\(/i,
    );
  });
});
