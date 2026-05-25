import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FAKE_STT_VALID_AUDIO_REQUEST,
  FasterWhisperSttProviderError,
  buildFasterWhisperArgs,
  createFasterWhisperSttProvider,
  type FasterWhisperProviderConfig,
  type FasterWhisperSpawnOptions,
  type FasterWhisperSpawnedProcess,
  type SttProvider,
} from "../../../src/lib/voice-runtime";

type DataListener = (chunk: Buffer | string) => void;
type CloseListener = (code: number | null, signal: string | null) => void;
type ErrorListener = (error: Error) => void;

class FakeFasterWhisperProcess implements FasterWhisperSpawnedProcess {
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
    modelName: "base.en",
    modelPath: "C:/models/faster-whisper/base.en",
    language: "en",
    beamSize: 5,
    vadEnabled: true,
    timeoutMs: 10_000,
    maxAudioBytes: 1_000_000,
    providerId: "local-faster-whisper",
    metadata_only: true,
    ...overrides,
  };
}

function safeJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    transcript: "Good evening. All systems are operational.",
    language: "en",
    latency_ms: 42,
    confidence_band: "high",
    degraded: false,
    ...overrides,
  });
}

function createHarness(options: { readonly autoClose?: boolean } = {}) {
  const processes: FakeFasterWhisperProcess[] = [];
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
      const process = new FakeFasterWhisperProcess();
      processes.push(process);
      spawnCalls.push({ executablePath, args, options: spawnOptions });
      if (options.autoClose ?? true) {
        queueMicrotask(() => {
          process.emitStdout(safeJson());
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

describe("Phase 14C.3 faster-whisper STT provider wrapper", () => {
  it("satisfies the SttProvider contract and health does not execute transcription", async () => {
    const harness = createHarness();
    const provider: SttProvider = harness.provider;

    expect(provider).toMatchObject({
      id: "local-faster-whisper",
      kind: "local",
      metadata_only: true,
    });
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "local-faster-whisper",
      ok: true,
      provider_kind: "local",
      degraded: false,
      metadata_only: true,
    });
    expect(harness.spawnCalls).toHaveLength(0);
  });

  it("builds safe args, disables shell, and passes request audio_ref as an argument only", async () => {
    const harness = createHarness();
    const result = await harness.provider.transcribe(
      FAKE_STT_VALID_AUDIO_REQUEST,
      { metadata_only: true },
    );

    expect(buildFasterWhisperArgs(fasterWhisperConfig(), "audio.wav")).toEqual([
      "-m",
      "faster_whisper",
      "audio.wav",
      "--model",
      "base.en",
      "--model_dir",
      "C:/models/faster-whisper/base.en",
      "--beam_size",
      "5",
      "--output_format",
      "json",
      "--language",
      "en",
      "--vad_filter",
      "true",
    ]);
    expect(harness.spawnCalls).toEqual([
      {
        executablePath: "python",
        args: [
          "-m",
          "faster_whisper",
          FAKE_STT_VALID_AUDIO_REQUEST.audio.audio_ref,
          "--model",
          "base.en",
          "--model_dir",
          "C:/models/faster-whisper/base.en",
          "--beam_size",
          "5",
          "--output_format",
          "json",
          "--language",
          "en",
          "--vad_filter",
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
      request_id: "fake-stt-request-1",
      provider_id: "local-faster-whisper",
      transcript: "Good evening. All systems are operational.",
      language: "en",
      latency_ms: 42,
      confidence_band: "high",
      degraded: false,
      metadata_only: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/,
    );
  });

  it("does not spawn for missing, oversized, or malformed request metadata", async () => {
    const harness = createHarness();

    await expect(
      harness.provider.transcribe(
        {
          ...FAKE_STT_VALID_AUDIO_REQUEST,
          audio: {
            ...FAKE_STT_VALID_AUDIO_REQUEST.audio,
            audio_ref: "",
          },
        },
        { metadata_only: true },
      ),
    ).rejects.toMatchObject({ reason: "provider_error" });
    await expect(
      harness.provider.transcribe(
        {
          ...FAKE_STT_VALID_AUDIO_REQUEST,
          audio: {
            ...FAKE_STT_VALID_AUDIO_REQUEST.audio,
            size_bytes: 1_000_001,
          },
        },
        { metadata_only: true },
      ),
    ).rejects.toMatchObject({ reason: "policy_blocked" });
    await expect(
      harness.provider.transcribe(
        {
          ...FAKE_STT_VALID_AUDIO_REQUEST,
          audio: {
            ...FAKE_STT_VALID_AUDIO_REQUEST.audio,
            duration_ms: 0,
          },
        },
        { metadata_only: true },
      ),
    ).rejects.toMatchObject({ reason: "provider_error" });

    expect(harness.spawnCalls).toHaveLength(0);
  });

  it("kills child on timeout and captures bounded diagnostics", async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ autoClose: false });
      const promise = harness.provider
        .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
          metadata_only: true,
          timeout_ms: 5,
        })
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1);
      harness.processes[0].emitStderr("x".repeat(900));
      await vi.advanceTimersByTimeAsync(5);

      await expect(promise).resolves.toMatchObject({
        reason: "timeout",
        diagnostics: {
          error_class: "timeout",
          stderr_preview: "x".repeat(512),
          signal: "SIGTERM",
          truncated: true,
          metadata_only: true,
        },
      });
      expect(harness.processes[0].killedWith).toBe("SIGTERM");
    } finally {
      vi.useRealTimers();
    }
  });

  it("kills child when AbortSignal aborts", async () => {
    const harness = createHarness({ autoClose: false });
    const abort = new AbortController();
    const promise = harness.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        abort_signal: abort.signal,
        metadata_only: true,
      })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    abort.abort();

    await expect(promise).resolves.toMatchObject({
      reason: "abort_signal",
    });
    expect(harness.processes[0].killedWith).toBe("SIGTERM");
  });

  it("cancel(reason) kills in-flight child and blocks subsequent transcription", async () => {
    const harness = createHarness({ autoClose: false });
    const promise = harness.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, { metadata_only: true })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await harness.provider.cancel("user_cancelled");
    expect(harness.processes[0].killedWith).toBe("SIGTERM");
    harness.processes[0].close(null, "SIGTERM");
    await expect(promise).resolves.toBeInstanceOf(
      FasterWhisperSttProviderError,
    );
    await expect(
      harness.provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "user_cancelled",
    });
  });

  it("fails closed on invalid JSON and missing transcript or language", async () => {
    const invalid = createHarness({ autoClose: false });
    const invalidPromise = invalid.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, { metadata_only: true })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    invalid.processes[0].emitStdout("{nope");
    invalid.processes[0].close(0);
    await expect(invalidPromise).resolves.toMatchObject({
      reason: "provider_error",
      diagnostics: {
        error_class: "provider_error",
      },
    });

    const missing = createHarness({ autoClose: false });
    const missingPromise = missing.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, { metadata_only: true })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    missing.processes[0].emitStdout(
      JSON.stringify({
        transcript: "hello",
        confidence_band: "high",
        degraded: false,
      }),
    );
    missing.processes[0].close(0);
    await expect(missingPromise).resolves.toMatchObject({
      reason: "provider_error",
      diagnostics: {
        error_class: "provider_error",
      },
    });
  });

  it("includes bounded provider_error diagnostics without raw traceback frames", async () => {
    const harness = createHarness({ autoClose: false });
    const promise = harness.provider
      .transcribe(FAKE_STT_VALID_AUDIO_REQUEST, { metadata_only: true })
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.processes[0].emitStderr(
      [
        "Traceback (most recent call last):",
        '  File "C:/secret/project/transcribe.py", line 10, in <module>',
        "ModuleNotFoundError: No module named 'faster_whisper'",
        "x".repeat(900),
      ].join("\n"),
    );
    harness.processes[0].close(1);

    await expect(promise).resolves.toMatchObject({
      reason: "provider_error",
      diagnostics: {
        error_class: "provider_error",
        stderr_preview: expect.stringContaining(
          "ModuleNotFoundError: No module named 'faster_whisper'",
        ),
        exit_code: 1,
        truncated: true,
        metadata_only: true,
      },
    });
    const error = (await promise) as FasterWhisperSttProviderError;
    const diagnostics = error.diagnostics;
    expect(diagnostics).toBeDefined();
    if (!diagnostics?.stderr_preview) {
      throw new Error("expected bounded stderr diagnostics");
    }
    expect(diagnostics.stderr_preview.length).toBeLessThanOrEqual(512);
    expect(diagnostics.stderr_preview).not.toContain(
      "Traceback (most recent call last):",
    );
    expect(diagnostics.stderr_preview).not.toContain(
      "C:/secret/project/transcribe.py",
    );
    expect(diagnostics).not.toHaveProperty("stdout_preview");
  });

  it("bounds transcript length in the result", async () => {
    const harness = createHarness({ autoClose: false });
    const promise = harness.provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
      metadata_only: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.processes[0].emitStdout(
      safeJson({
        transcript: "a".repeat(4_100),
        latency_ms: undefined,
      }),
    );
    harness.processes[0].close(0);

    await expect(promise).resolves.toMatchObject({
      transcript: "a".repeat(4_000),
      latency_ms: 50,
    });
  });

  it("does not execute on malformed config and health does not spawn", async () => {
    const runner = {
      spawn: vi.fn(() => new FakeFasterWhisperProcess()),
      now_ms: () => 10,
    };
    const provider = createFasterWhisperSttProvider({
      config: fasterWhisperConfig({ pythonCommand: undefined }),
      runner,
    });

    await expect(provider.health()).resolves.toMatchObject({
      ok: false,
      degraded: true,
      last_error_class: "provider_error",
      metadata_only: true,
    });
    await expect(
      provider.transcribe(FAKE_STT_VALID_AUDIO_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "provider_error",
    });
    expect(runner.spawn).not.toHaveBeenCalled();
  });

  it("does not introduce mic, streaming, runtime, persistence, cloud, UI, Tauri, playback, or scheduler wiring", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/voice-runtime/stt/faster-whisper-provider.ts",
      ),
      "utf8",
    );

    expect(source).toMatch(/from\s+["']node:child_process["']/);
    expect(source).not.toMatch(/shell:\s*true|exec\s*\(|execFile\s*\(/i);
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone/i,
    );
    expect(source).not.toMatch(/AsyncIterable|EventSource|partial_transcript/i);
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\(|setInterval|scheduler|cron/i,
    );
  });
});
