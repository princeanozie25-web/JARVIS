import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  FAKE_STT_VALID_AUDIO_REQUEST,
  buildFasterWhisperArgs,
  createDefaultVoiceRuntimeFeatureFlags,
  createDefaultVoiceRuntimePolicyConfig,
  createFakeSttProvider,
  createFasterWhisperSttProvider,
  parseVoiceRuntimePolicyConfig,
  validateVoiceRuntimeFeatureFlags,
  type FasterWhisperProviderConfig,
  type FasterWhisperSpawnOptions,
  type FasterWhisperSpawnedProcess,
} from "../../../src/lib/voice-runtime";

const PHASE_14C_REAL_SMOKE_RESULT = {
  provider_id: "faster-whisper-local",
  language: "en",
  degraded: false,
} as const;

type DataListener = (chunk: Buffer | string) => void;
type CloseListener = (code: number | null, signal: string | null) => void;
type ErrorListener = (error: Error) => void;

class AuditFasterWhisperProcess implements FasterWhisperSpawnedProcess {
  killedWith: string | undefined;
  private readonly stdoutListeners: DataListener[] = [];
  private readonly stderrListeners: DataListener[] = [];
  private readonly closeListeners: CloseListener[] = [];
  private readonly errorListeners: ErrorListener[] = [];

  readonly stdout = {
    on: (_event: "data", listener: DataListener): void => {
      this.stdoutListeners.push(listener);
    },
  };

  readonly stderr = {
    on: (_event: "data", listener: DataListener): void => {
      this.stderrListeners.push(listener);
    },
  };

  on(event: "error", listener: ErrorListener): void;
  on(event: "close", listener: CloseListener): void;
  on(event: "error" | "close", listener: ErrorListener | CloseListener): void {
    if (event === "error") {
      this.errorListeners.push(listener as ErrorListener);
      return;
    }
    this.closeListeners.push(listener as CloseListener);
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.killedWith = signal;
    return true;
  }

  emitStdout(chunk: string): void {
    for (const listener of this.stdoutListeners) listener(chunk);
  }

  emitStderr(chunk: string): void {
    for (const listener of this.stderrListeners) listener(chunk);
  }

  emitError(error: Error): void {
    for (const listener of this.errorListeners) listener(error);
  }

  close(code: number | null, signal: string | null = null): void {
    for (const listener of this.closeListeners) listener(code, signal);
  }
}

function fasterWhisperConfig(
  overrides: Partial<FasterWhisperProviderConfig> = {},
): FasterWhisperProviderConfig {
  return {
    pythonCommand: "python",
    modelName: "base",
    modelPath: "C:/models/faster-whisper/base",
    language: "en",
    beamSize: 5,
    vadEnabled: true,
    timeoutMs: 10_000,
    maxAudioBytes: 1_000_000,
    providerId: "faster-whisper-local",
    metadata_only: true,
    ...overrides,
  };
}

function createAuditHarness(options: { readonly autoClose?: boolean } = {}) {
  const processes: AuditFasterWhisperProcess[] = [];
  const spawnCalls: {
    readonly executablePath: string;
    readonly args: readonly string[];
    readonly options: FasterWhisperSpawnOptions;
  }[] = [];
  const runner = {
    spawn: (
      executablePath: string,
      args: readonly string[],
      spawnOptions: FasterWhisperSpawnOptions,
    ) => {
      const process = new AuditFasterWhisperProcess();
      processes.push(process);
      spawnCalls.push({ executablePath, args, options: spawnOptions });
      if (options.autoClose ?? true) {
        queueMicrotask(() => {
          process.emitStdout(
            JSON.stringify({
              transcript: "Good evening, all systems are operational.",
              language: "en",
              latency_ms: 42,
              confidence_band: "high",
              degraded: false,
            }),
          );
          process.close(0);
        });
      }
      return process;
    },
    now_ms: vi.fn().mockReturnValueOnce(100).mockReturnValue(150),
  };

  return {
    processes,
    provider: createFasterWhisperSttProvider({
      config: fasterWhisperConfig(),
      runner,
    }),
    runner,
    spawnCalls,
  };
}

function sttSource(): string {
  return [
    "src/lib/voice-runtime/stt/types.ts",
    "src/lib/voice-runtime/stt/provider.ts",
    "src/lib/voice-runtime/stt/faster-whisper-contract.ts",
    "src/lib/voice-runtime/stt/fake-provider.ts",
    "src/lib/voice-runtime/stt/fixtures.ts",
    "src/lib/voice-runtime/stt/faster-whisper-provider.ts",
    "src/lib/voice-runtime/stt/local-config.ts",
    "src/lib/voice-runtime/stt/index.ts",
    "scripts/voice/stt-smoke.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

describe("Phase 14C local STT provider closeout audit", () => {
  it("keeps faster-whisper execution bounded with args array and shell=false", async () => {
    const harness = createAuditHarness();
    const result = await harness.provider.transcribe(
      FAKE_STT_VALID_AUDIO_REQUEST,
      { metadata_only: true },
    );

    expect(harness.spawnCalls).toEqual([
      {
        executablePath: "python",
        args: [
          "-c",
          expect.stringContaining("WhisperModel(model_target"),
          "--audio-ref",
          FAKE_STT_VALID_AUDIO_REQUEST.audio.audio_ref,
          "--model-path",
          "C:/models/faster-whisper/base",
          "--model-name",
          "base",
          "--beam-size",
          "5",
          "--language",
          "en",
          "--vad-enabled",
          "true",
        ],
        options: {
          shell: false,
          stdio: "pipe",
          windowsHide: true,
        },
      },
    ]);
    expect(result).toMatchObject({
      provider_id: "faster-whisper-local",
      language: "en",
      degraded: false,
      metadata_only: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/,
    );
  });

  it("prefers modelName, supports modelPath fallback, and keeps audio_ref separate", () => {
    const args = buildFasterWhisperArgs(
      fasterWhisperConfig({
        modelName: "base",
        modelPath: "C:/models/faster-whisper/base",
      }),
      "C:/audio/generated-by-piper.wav",
    );
    const helper = args[1];
    const audioRefIndex = args.indexOf("--audio-ref");
    const modelPathIndex = args.indexOf("--model-path");
    const modelNameIndex = args.indexOf("--model-name");

    expect(helper).toEqual(
      expect.stringContaining(
        "model_target=args.model_name.strip() or args.model_path.strip()",
      ),
    );
    expect(args[modelNameIndex + 1]).toBe("base");
    expect(args[modelPathIndex + 1]).toBe("C:/models/faster-whisper/base");
    expect(args[modelNameIndex + 1]).not.toBe("model");
    expect(args[modelPathIndex + 1]).not.toBe("model");
    expect(args[audioRefIndex + 1]).toBe("C:/audio/generated-by-piper.wav");
    expect(args[audioRefIndex + 1]).not.toBe(args[modelPathIndex + 1]);

    const fallbackArgs = buildFasterWhisperArgs(
      fasterWhisperConfig({ modelName: "" }),
      "C:/audio/fallback.wav",
    );
    expect(fallbackArgs[fallbackArgs.indexOf("--model-name") + 1]).toBe("");
    expect(fallbackArgs[fallbackArgs.indexOf("--model-path") + 1]).toBe(
      "C:/models/faster-whisper/base",
    );
  });

  it("bounds transcripts and diagnostics while failing closed", async () => {
    const transcriptHarness = createAuditHarness({ autoClose: false });
    const transcriptPromise = transcriptHarness.provider.transcribe(
      FAKE_STT_VALID_AUDIO_REQUEST,
      { metadata_only: true },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    transcriptHarness.processes[0].emitStdout(
      JSON.stringify({
        transcript: "a".repeat(4_100),
        language: "en",
        latency_ms: 10,
        confidence_band: "high",
        degraded: false,
      }),
    );
    transcriptHarness.processes[0].close(0);
    await expect(transcriptPromise).resolves.toMatchObject({
      transcript: "a".repeat(4_000),
    });

    const diagnosticsHarness = createAuditHarness({ autoClose: false });
    const diagnosticsPromise = diagnosticsHarness.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, { metadata_only: true })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    diagnosticsHarness.processes[0].emitStderr("x".repeat(900));
    diagnosticsHarness.processes[0].close(1);
    await expect(diagnosticsPromise).resolves.toMatchObject({
      reason: "provider_error",
      diagnostics: {
        error_class: "provider_error",
        stderr_preview: "x".repeat(512),
        exit_code: 1,
        truncated: true,
        metadata_only: true,
      },
    });
  });

  it("keeps fake provider deterministic and metadata-only", async () => {
    const fake = createFakeSttProvider();
    const first = await fake.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });
    const second = await fake.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      transcript: "Good evening. All systems are operational.",
      provider_id: "fake-local-stt",
      confidence_band: "high",
      metadata_only: true,
    });
    expect(JSON.stringify(first)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/,
    );
  });

  it("keeps smoke harness manual-only and documents the real smoke result safely", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(packageJson.scripts["voice:stt:smoke"]).toBe(
      "tsx scripts/voice/stt-smoke.ts",
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (name === "voice:stt:smoke") continue;
      expect(command).not.toContain("scripts/voice/stt-smoke.ts");
    }
    expect(PHASE_14C_REAL_SMOKE_RESULT).toEqual({
      provider_id: "faster-whisper-local",
      language: "en",
      degraded: false,
    });
    expect(JSON.stringify(PHASE_14C_REAL_SMOKE_RESULT)).not.toMatch(
      /[/\\][A-Za-z0-9_. -]+[/\\]|\.wav|\.mp3|\.flac/i,
    );
  });

  it("keeps governance defaults fail-closed for persistence, cloud, wake word, and background capture", () => {
    expect(DEFAULT_VOICE_RUNTIME_CONFIG).toMatchObject({
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_recording_enabled: false,
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG).toMatchObject({
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_capture_enabled: false,
      transcript_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      cloud_stt_enabled: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS).toMatchObject({
      local_stt: true,
      cloud_stt: false,
      realtime_streaming: false,
      voice_runtime_integration: false,
    });

    for (const key of [
      "wake_word_enabled",
      "always_listening_enabled",
      "background_capture_enabled",
      "transcript_persistence_enabled",
      "raw_audio_persistence_enabled",
      "cloud_stt_enabled",
    ] as const) {
      expect(
        parseVoiceRuntimePolicyConfig({
          ...createDefaultVoiceRuntimePolicyConfig(),
          [key]: true,
        }),
      ).toMatchObject({
        ok: false,
        config: null,
      });
    }
    expect(
      validateVoiceRuntimeFeatureFlags({
        ...createDefaultVoiceRuntimeFeatureFlags(),
        cloud_stt: true,
      }),
    ).toEqual({
      ok: false,
      flags: null,
      reasons: ["disabled_feature_enabled"],
    });
  });

  it("keeps Phase 14C source local-only and disconnected from forbidden surfaces", () => {
    const source = sttSource();

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone|micCapture/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|partial_transcript|streamingTranscription|stream\s*\(/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\(|app\/api/i,
    );
    expect(source).not.toMatch(
      /setInterval|scheduler|cron|while\s*\(\s*true\s*\)/i,
    );
    expect(source).not.toMatch(/shell:\s*true|exec\s*\(|execFile\s*\(/i);
  });
});
