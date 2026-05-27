import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  runFullVoiceLoopSmoke,
  FULL_LOOP_AUDIO_REF_ENV,
  FULL_LOOP_PREVIEW_LIMIT,
  type FullVoiceLoopSmokeDependencies,
} from "../../scripts/voice/full-voice-loop-smoke";
import type {
  PlaybackDriver,
  SttProvider,
  SttProviderHealth,
  SttTranscriptionResult,
  TtsProvider,
  TtsProviderHealth,
  TtsSynthesisResult,
  VoiceRuntimeAdapter,
  VoiceRuntimeAdapterHealth,
  VoiceRuntimeAdapterResponse,
} from "../../src/lib/voice-runtime";

const LONG_TRANSCRIPT =
  "Good evening. All systems are operational. This deliberately long transcript preview must remain bounded.";
const LONG_ASSISTANT =
  "Good evening. The governed full voice loop is operational, explicit, metadata-safe, and bounded.";

function smokeSource(): string {
  return readFileSync(
    join(process.cwd(), "scripts/voice/full-voice-loop-smoke.ts"),
    "utf8",
  );
}

function packageJson(): { readonly scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
}

function sttProvider(): SttProvider {
  const health: SttProviderHealth = {
    provider_id: "fake-local-stt",
    ok: true,
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
    transcribe: vi.fn(
      async (): Promise<SttTranscriptionResult> => ({
        request_id: "voice-runtime-full-loop-session-full-loop-turn",
        provider_id: "fake-local-stt",
        transcript: LONG_TRANSCRIPT,
        language: "en",
        latency_ms: 11,
        degraded: false,
        confidence_band: "high",
        metadata_only: true,
      }),
    ),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function ttsProvider(): TtsProvider {
  const health: TtsProviderHealth = {
    provider_id: "fake-local-tts",
    ok: true,
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
    synthesize: vi.fn(
      async (): Promise<TtsSynthesisResult> => ({
        request_id: "runtime-full-loop-turn",
        chunk: {
          chunk_id: "full-loop-chunk",
          provider_id: "fake-local-tts",
          voice_id: "fake-voice",
          duration_ms: 1000,
          size_bytes: 24000,
          degraded: false,
          output_ref: "C:/tmp/full-loop-output.wav",
          metadata_only: true,
        },
        latency_ms: 13,
        degraded: false,
        metadata_only: true,
      }),
    ),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function runtimeAdapter(): VoiceRuntimeAdapter {
  const health: VoiceRuntimeAdapterHealth = {
    ok: true,
    degraded: false,
    provider_id: "fake-runtime",
    metadata_only: true,
  };
  return {
    id: "fake-runtime",
    metadata_only: true,
    health: vi.fn(async () => health),
    executeVoiceRequest: vi.fn(
      async (): Promise<VoiceRuntimeAdapterResponse> => ({
        response_id: "runtime-full-loop-turn",
        assistant_text: LONG_ASSISTANT,
        latency_ms: 17,
        degraded: false,
        provider_id: "fake-runtime",
        finish_reason: "stop",
        metadata_only: true,
      }),
    ),
    cancel: vi.fn(async () => undefined),
  };
}

function playbackDriver(): PlaybackDriver {
  return {
    loadAudioRef: vi.fn(async () => undefined),
    playLoaded: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    health: vi.fn(async () => ({
      ok: true,
      degraded: false,
      metadata_only: true as const,
    })),
  };
}

function dependencies(lines: string[] = []): FullVoiceLoopSmokeDependencies {
  const modelEntry = {
    id: "llama3.2:3b",
    provider: "ollama",
  };
  return {
    env: {
      [FULL_LOOP_AUDIO_REF_ENV]: "C:/tmp/input.wav",
    },
    statAudio: vi.fn(async () => ({ size: 32000 })),
    loadSttConfig: vi.fn(
      () =>
        ({
          ok: true,
          config: {
            pythonCommand: "python",
            modelName: "base",
            modelPath: "base",
            beamSize: 5,
            vadEnabled: true,
            timeoutMs: 30000,
            maxAudioBytes: 25_000_000,
            providerId: "fake-local-stt",
            metadata_only: true,
          },
          reasons: [],
        }) as const,
    ),
    loadTtsConfig: vi.fn(
      () =>
        ({
          ok: true,
          config: {
            piperExecutablePath: "piper",
            voiceModelPath: "voice.onnx",
            voiceConfigPath: "voice.json",
            outputDirectory: "C:/tmp",
            providerId: "fake-local-tts",
            voiceId: "fake-voice",
            timeoutMs: 30000,
            maxInputChars: 500,
            metadata_only: true,
          },
          reasons: [],
        }) as const,
    ),
    createSttProvider: vi.fn(() => sttProvider()),
    createTtsProvider: vi.fn(() => ttsProvider()),
    loadRegistry: vi.fn(
      () =>
        ({
          getModel: (id: string) => (id === "llama3.2:3b" ? modelEntry : null),
          listModels: () => [modelEntry],
        }) as never,
    ),
    createClient: vi.fn(() => ({}) as never),
    createModelProvider: vi.fn(() => ({}) as never),
    createRuntime: vi.fn(() => ({ execute: vi.fn() }) as never),
    createRuntimeAdapter: vi.fn(() => runtimeAdapter()),
    createDriver: vi.fn(() => playbackDriver()),
    writeLine: vi.fn((line: string) => lines.push(line)),
    now: vi.fn(() => 2000),
  };
}

describe("Phase 14H.1 full voice loop smoke harness", () => {
  it("requires an explicit WAV env var and fails closed before execution", async () => {
    const deps = dependencies();

    await expect(
      runFullVoiceLoopSmoke({
        ...deps,
        env: {},
      }),
    ).rejects.toThrow(/JARVIS_FULL_LOOP_AUDIO_REF/);
    expect(deps.statAudio).not.toHaveBeenCalled();
    expect(deps.createSttProvider).not.toHaveBeenCalled();
    expect(deps.createTtsProvider).not.toHaveBeenCalled();
  });

  it("runs the full mocked voice loop and prints metadata-only bounded output", async () => {
    const lines: string[] = [];
    const deps = dependencies(lines);

    const report = await runFullVoiceLoopSmoke(deps);

    expect(report).toMatchObject({
      status: "ok",
      session_id: "full-voice-loop-smoke-session",
      turn_id: "full-voice-loop-smoke-turn",
      stt_status: "complete",
      runtime_status: "complete",
      tts_status: "complete",
      playback_status: "completed",
      provider_ids: {
        stt: "fake-local-stt",
        runtime: "fake-runtime",
        tts: "fake-local-tts",
      },
      latency_ms: {
        stt: 11,
        runtime: 17,
        tts: 13,
      },
      degraded: false,
      metadata_only: true,
    });
    expect(report.transcript_preview.length).toBeLessThanOrEqual(
      FULL_LOOP_PREVIEW_LIMIT,
    );
    expect(report.assistant_preview.length).toBeLessThanOrEqual(
      FULL_LOOP_PREVIEW_LIMIT,
    );
    expect(lines.join("\n")).toContain("status: ok");
    expect(lines.join("\n")).toContain("playback_status: completed");
    expect(lines.join("\n")).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|prompt|tool_output|approval|raw model|event-store|persist/i,
    );
  });

  it("does not execute on import and exposes a manual-only package script", () => {
    const source = smokeSource();
    const scripts = packageJson().scripts ?? {};

    expect(source).toContain("isDirectCliInvocation()");
    expect(source).toContain("void runFullVoiceLoopSmokeCli()");
    expect(scripts["voice:full-loop:smoke"]).toBe(
      "tsx scripts/voice/full-voice-loop-smoke.ts",
    );
    expect(scripts.dev).not.toContain("voice:full-loop:smoke");
    expect(scripts.start).not.toContain("voice:full-loop:smoke");
    expect(scripts.build).not.toContain("voice:full-loop:smoke");
    expect(scripts.test).not.toContain("voice:full-loop:smoke");
  });

  it("keeps the smoke harness free of persistence, cloud SDKs, UI/Tauri, wake word, always-listening, and realtime streaming", () => {
    const source = smokeSource();

    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']|fetch\s*\(|WebSocket|EventSource|XMLHttpRequest/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(
      /wake_word|wakeword|always_listening|always-listening|getUserMedia|MediaStream/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|partial_token|partial_transcript|token-stream|tokenStream|realtime/i,
    );
    expect(source).not.toMatch(
      /conversation_loop|setInterval|while\s*\(true\)|autonomous/i,
    );
  });
});
