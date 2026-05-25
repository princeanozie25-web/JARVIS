import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FAKE_TTS_ASSISTANT_PROSE_REQUEST,
  PiperTtsProviderError,
  createPiperTtsProvider,
  type PiperProviderConfig,
  type PiperSpawnOptions,
  type PiperSpawnedProcess,
  type TtsProvider,
} from "../../../src/lib/voice-runtime";

type DataListener = (chunk: Buffer | string) => void;
type CloseListener = (code: number | null, signal: string | null) => void;
type ErrorListener = (error: Error) => void;

class FakePiperProcess implements PiperSpawnedProcess {
  stdinText = "";
  stdinEnded = false;
  killedWith: string | undefined;
  private stdoutListeners: DataListener[] = [];
  private stderrListeners: DataListener[] = [];
  private closeListeners: CloseListener[] = [];
  private errorListeners: ErrorListener[] = [];

  readonly stdin = {
    write: (chunk: string): boolean => {
      this.stdinText += chunk;
      return true;
    },
    end: () => {
      this.stdinEnded = true;
    },
  };

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

function piperConfig(
  overrides: Partial<PiperProviderConfig> = {},
): PiperProviderConfig {
  return {
    piperExecutablePath: "C:/tools/piper/piper.exe",
    voiceModelPath: "C:/voices/jarvis.onnx",
    voiceConfigPath: "C:/voices/jarvis.onnx.json",
    outputDirectory: "C:/tmp/jarvis-voice",
    maxInputChars: 500,
    timeoutMs: 10_000,
    providerId: "local-piper",
    voiceId: "fake-voice",
    metadata_only: true,
    ...overrides,
  };
}

function createHarness(options: { readonly autoClose?: boolean } = {}) {
  const processes: FakePiperProcess[] = [];
  const spawnCalls: {
    executablePath: string;
    args: readonly string[];
    options: PiperSpawnOptions;
  }[] = [];
  const runner = {
    spawn: (
      executablePath: string,
      args: readonly string[],
      spawnOptions: PiperSpawnOptions,
    ) => {
      const process = new FakePiperProcess();
      processes.push(process);
      spawnCalls.push({ executablePath, args, options: spawnOptions });
      if (options.autoClose ?? true) {
        queueMicrotask(() => {
          process.emitStdout("ok");
          process.close(0);
        });
      }
      return process;
    },
    mkdir: vi.fn(async () => undefined),
    stat: vi.fn(async () => ({ size: 1234 })),
    now_ms: vi.fn().mockReturnValueOnce(100).mockReturnValue(135),
  };

  return {
    processes,
    provider: createPiperTtsProvider({
      config: piperConfig(),
      runner,
    }),
    runner,
    spawnCalls,
  };
}

describe("Phase 14B.3 Piper TTS provider wrapper", () => {
  it("satisfies the TtsProvider contract and health does not execute Piper", async () => {
    const harness = createHarness();
    const provider: TtsProvider = harness.provider;

    expect(provider).toMatchObject({
      id: "local-piper",
      kind: "local",
      metadata_only: true,
    });
    await expect(provider.health()).resolves.toMatchObject({
      provider_id: "local-piper",
      ok: true,
      provider_kind: "local",
      degraded: false,
      metadata_only: true,
    });
    expect(harness.spawnCalls).toHaveLength(0);
  });

  it("builds safe Piper args, disables shell, and sends bounded assistant prose to stdin", async () => {
    const harness = createHarness();
    const request = {
      ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
      text: "Speak this. Do not put me in the filename.",
      session_id: "../session secret",
      turn_id: "turn/secret",
    };

    const result = await harness.provider.synthesize(request, {
      metadata_only: true,
    });

    expect(harness.spawnCalls).toHaveLength(1);
    expect(harness.spawnCalls[0]).toEqual({
      executablePath: "C:/tools/piper/piper.exe",
      args: [
        "--model",
        "C:/voices/jarvis.onnx",
        "--config",
        "C:/voices/jarvis.onnx.json",
        "--output_file",
        expect.stringMatching(
          /C:[/\\]tmp[/\\]jarvis-voice[/\\]_+session_secret-turn_secret-piper-[a-f0-9]{8}\.wav/,
        ),
      ],
      options: {
        shell: false,
        stdio: "pipe",
        windowsHide: true,
      },
    });
    expect(harness.processes[0].stdinText).toBe(request.text);
    expect(harness.processes[0].stdinEnded).toBe(true);
    expect(result).toMatchObject({
      request_id: request.request_id,
      degraded: false,
      diagnostics: {
        stdout_preview: "ok",
        truncated: false,
        metadata_only: true,
      },
      chunk: {
        provider_id: "local-piper",
        voice_id: "fake-voice",
        size_bytes: 1234,
        metadata_only: true,
      },
    });
    expect(result.chunk.output_ref).not.toContain("Speak this");
    expect(result.chunk.output_ref).not.toContain("filename");
    expect(JSON.stringify(result)).not.toContain("audio_bytes");
  });

  it("does not execute subprocess for unsafe content", async () => {
    const harness = createHarness();

    await expect(
      harness.provider.synthesize(
        {
          ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
          content_class: "tool_output",
          allow_sensitive_content: true,
        },
        { metadata_only: true },
      ),
    ).rejects.toMatchObject({
      reason: "policy_blocked",
      metadata_only: true,
    });
    expect(harness.spawnCalls).toHaveLength(0);
  });

  it("kills child on timeout and captures bounded diagnostics", async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ autoClose: false });
      const promise = harness.provider.synthesize(
        FAKE_TTS_ASSISTANT_PROSE_REQUEST,
        { metadata_only: true, timeout_ms: 5 },
      );
      const observed = promise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1);
      harness.processes[0].emitStderr("x".repeat(900));
      await vi.advanceTimersByTimeAsync(5);

      await expect(observed).resolves.toMatchObject({
        reason: "timeout",
        diagnostics: {
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
    const promise = harness.provider.synthesize(
      FAKE_TTS_ASSISTANT_PROSE_REQUEST,
      {
        abort_signal: abort.signal,
        metadata_only: true,
      },
    );
    const observed = promise.catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    abort.abort();

    await expect(observed).resolves.toMatchObject({
      reason: "abort_signal",
    });
    expect(harness.processes[0].killedWith).toBe("SIGTERM");
  });

  it("cancel(reason) kills in-flight child and blocks subsequent synthesis", async () => {
    const harness = createHarness({ autoClose: false });
    const promise = harness.provider.synthesize(
      FAKE_TTS_ASSISTANT_PROSE_REQUEST,
      {
        metadata_only: true,
      },
    );
    const observed = promise.catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await harness.provider.cancel("user_cancelled");
    expect(harness.processes[0].killedWith).toBe("SIGTERM");
    harness.processes[0].close(null, "SIGTERM");
    await expect(observed).resolves.toBeInstanceOf(PiperTtsProviderError);
    await expect(
      harness.provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "user_cancelled",
    });
  });

  it("fails closed on malformed config and health still does not execute Piper", async () => {
    const runner = {
      spawn: vi.fn(() => new FakePiperProcess()),
      mkdir: vi.fn(async () => undefined),
      stat: vi.fn(async () => ({ size: 0 })),
      now_ms: () => 10,
    };
    const provider = createPiperTtsProvider({
      config: piperConfig({ piperExecutablePath: "" }),
      runner,
    });

    await expect(provider.health()).resolves.toMatchObject({
      ok: false,
      degraded: true,
      last_error_class: "provider_error",
      metadata_only: true,
    });
    await expect(
      provider.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
        metadata_only: true,
      }),
    ).rejects.toMatchObject({
      reason: "provider_error",
    });
    expect(runner.spawn).not.toHaveBeenCalled();
  });

  it("does not introduce playback, runtime, persistence, cloud, or UI wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-runtime/tts/piper-provider.ts"),
      "utf8",
    );

    expect(source).toMatch(/from\s+["']node:child_process["']/);
    expect(source).not.toMatch(/shell:\s*true|exec\s*\(|execFile\s*\(/i);
    expect(source).not.toMatch(/ffmpeg|faster-whisper/i);
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
