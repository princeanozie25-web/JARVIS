import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  FAKE_TTS_ASSISTANT_PROSE_REQUEST,
  TTS_CONTENT_CLASSES,
  createFakeTtsProvider,
  createPiperTtsProvider,
  validateTtsSynthesisRequest,
  type PiperProviderConfig,
  type PiperSpawnOptions,
  type PiperSpawnedProcess,
} from "../../../src/lib/voice-runtime";
import { TTS_SMOKE_TEXT } from "../../../scripts/voice/tts-smoke";

type DataListener = (chunk: Buffer | string) => void;
type CloseListener = (code: number | null, signal: string | null) => void;
type ErrorListener = (error: Error) => void;

class AuditPiperProcess implements PiperSpawnedProcess {
  stdinText = "";
  killedWith: string | undefined;
  private readonly stdoutListeners: DataListener[] = [];
  private readonly stderrListeners: DataListener[] = [];
  private readonly closeListeners: CloseListener[] = [];
  private readonly errorListeners: ErrorListener[] = [];

  readonly stdin = {
    write: (chunk: string): boolean => {
      this.stdinText += chunk;
      return true;
    },
    end: () => undefined,
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

function piperConfig(): PiperProviderConfig {
  return {
    piperExecutablePath: "C:/tools/piper/piper.exe",
    voiceModelPath: "C:/voices/jarvis.onnx",
    voiceConfigPath: "C:/voices/jarvis.onnx.json",
    outputDirectory: "C:/tmp/jarvis-tts",
    maxInputChars: 500,
    timeoutMs: 10_000,
    providerId: "piper-local",
    voiceId: "en_GB-alan-medium",
    metadata_only: true,
  };
}

function createAuditHarness(options: { readonly autoClose?: boolean } = {}) {
  const processes: AuditPiperProcess[] = [];
  const spawnCalls: {
    readonly executablePath: string;
    readonly args: readonly string[];
    readonly options: PiperSpawnOptions;
  }[] = [];
  const runner = {
    spawn: (
      executablePath: string,
      args: readonly string[],
      spawnOptions: PiperSpawnOptions,
    ) => {
      const process = new AuditPiperProcess();
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
    stat: vi.fn(async () => ({ size: 2048 })),
    now_ms: vi.fn().mockReturnValueOnce(10).mockReturnValue(25),
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

function ttsSource(): string {
  return [
    "src/lib/voice-runtime/tts/types.ts",
    "src/lib/voice-runtime/tts/provider.ts",
    "src/lib/voice-runtime/tts/piper-contract.ts",
    "src/lib/voice-runtime/tts/fake-provider.ts",
    "src/lib/voice-runtime/tts/fixtures.ts",
    "src/lib/voice-runtime/tts/piper-provider.ts",
    "src/lib/voice-runtime/tts/local-config.ts",
    "src/lib/voice-runtime/tts/index.ts",
    "scripts/voice/tts-smoke.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

describe("Phase 14B local TTS provider closeout audit", () => {
  it("keeps Piper execution bounded with args array, shell=false, and safe output metadata", async () => {
    const harness = createAuditHarness();
    const request = {
      ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
      text: "This user text must never become a filename.",
      session_id: "../local user machine",
      turn_id: "turn/with/path",
      requested_voice_id: "en_GB-alan-medium",
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
          /C:[/\\]tmp[/\\]jarvis-tts[/\\]_+local_user_machine-turn_with_path-piper-[a-f0-9]{8}\.wav/,
        ),
      ],
      options: {
        shell: false,
        stdio: "pipe",
        windowsHide: true,
      },
    });
    expect(harness.processes[0].stdinText).toBe(request.text);
    expect(result.chunk.output_ref).not.toContain("This user text");
    expect(result.chunk.output_ref).not.toContain("filename");
    expect(Object.keys(result.chunk)).not.toContain("audio");
    expect(Object.keys(result.chunk)).not.toContain("raw_audio");
    expect(Object.keys(result.chunk)).not.toContain("audio_bytes");
    expect(JSON.stringify(result)).not.toMatch(
      /RIFF|base64|audio_bytes|raw_audio/,
    );
  });

  it("does not spawn Piper for unsafe content classes", async () => {
    const harness = createAuditHarness();

    for (const contentClass of TTS_CONTENT_CLASSES) {
      if (contentClass === "assistant_prose") continue;
      await expect(
        harness.provider.synthesize(
          {
            ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
            content_class: contentClass,
            requested_voice_id: "en_GB-alan-medium",
            allow_sensitive_content: true,
          },
          { metadata_only: true },
        ),
      ).rejects.toMatchObject({ reason: "policy_blocked" });
    }

    expect(harness.spawnCalls).toHaveLength(0);
  });

  it("bounds diagnostics and kills in-flight children on timeout, abort, and cancel", async () => {
    vi.useFakeTimers();
    try {
      const timeoutHarness = createAuditHarness({ autoClose: false });
      const timeoutPromise = timeoutHarness.provider
        .synthesize(
          {
            ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
            requested_voice_id: "en_GB-alan-medium",
          },
          { metadata_only: true, timeout_ms: 5 },
        )
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1);
      timeoutHarness.processes[0].emitStderr("x".repeat(900));
      await vi.advanceTimersByTimeAsync(5);
      await expect(timeoutPromise).resolves.toMatchObject({
        reason: "timeout",
        diagnostics: {
          stderr_preview: "x".repeat(512),
          truncated: true,
          metadata_only: true,
        },
      });
      expect(timeoutHarness.processes[0].killedWith).toBe("SIGTERM");
    } finally {
      vi.useRealTimers();
    }

    const abortHarness = createAuditHarness({ autoClose: false });
    const abort = new AbortController();
    const abortPromise = abortHarness.provider
      .synthesize(
        {
          ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
          requested_voice_id: "en_GB-alan-medium",
        },
        { abort_signal: abort.signal, metadata_only: true },
      )
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    abort.abort();
    await expect(abortPromise).resolves.toMatchObject({
      reason: "abort_signal",
    });
    expect(abortHarness.processes[0].killedWith).toBe("SIGTERM");

    const cancelHarness = createAuditHarness({ autoClose: false });
    const cancelPromise = cancelHarness.provider
      .synthesize(
        {
          ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
          requested_voice_id: "en_GB-alan-medium",
        },
        { metadata_only: true },
      )
      .catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await cancelHarness.provider.cancel("user_cancelled");
    expect(cancelHarness.processes[0].killedWith).toBe("SIGTERM");
    cancelHarness.processes[0].close(null, "SIGTERM");
    await expect(cancelPromise).resolves.toMatchObject({
      reason: "provider_error",
    });
  });

  it("keeps health non-executing and fake provider deterministic metadata-only", async () => {
    const harness = createAuditHarness();
    await expect(harness.provider.health()).resolves.toMatchObject({
      provider_id: "piper-local",
      provider_kind: "local",
      metadata_only: true,
    });
    expect(harness.spawnCalls).toHaveLength(0);

    const fake = createFakeTtsProvider();
    const first = await fake.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });
    const second = await fake.synthesize(FAKE_TTS_ASSISTANT_PROSE_REQUEST, {
      metadata_only: true,
    });
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /audio_bytes|raw_audio|RIFF|base64/,
    );
  });

  it("keeps governance defaults fail-closed for unsafe speech, persistence, cloud, and autoplay", () => {
    expect(DEFAULT_VOICE_RUNTIME_CONFIG).toMatchObject({
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG).toMatchObject({
      cloud_tts_enabled: false,
      playback_autostart_enabled: false,
      transcript_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      allow_tts_for_sensitive_content: false,
    });

    expect(
      validateTtsSynthesisRequest(
        {
          ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
          content_class: "tool_output",
          allow_sensitive_content: true,
        },
        {
          provider_id: "fake-local-tts",
          provider_kind: "local",
          voice_id: "fake-voice",
          max_input_chars: 500,
          timeout_ms: 5_000,
          metadata_only: true,
        },
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["sensitive_content_blocked"]),
    });
  });

  it("keeps smoke harness manual-only and fixture-safe", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(TTS_SMOKE_TEXT).toBe("Good evening. All systems are operational.");
    expect(packageJson.scripts["voice:tts:smoke"]).toBe(
      "tsx scripts/voice/tts-smoke.ts",
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (name === "voice:tts:smoke") continue;
      expect(command).not.toContain("scripts/voice/tts-smoke.ts");
    }
    expect(ttsSource()).not.toContain("en_GB-alan-medium.wav");
  });

  it("keeps Phase 14B source local-only and disconnected from forbidden surfaces", () => {
    const source = ttsSource();

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone/i,
    );
    expect(source).not.toMatch(
      /tauri|invoke\s*\(|global-hotkey|globalShortcut/i,
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
    expect(source).not.toMatch(/ffmpeg/i);
    expect(source).not.toMatch(/tsx|jsx|React|useEffect|useState|app\/api/i);
    expect(source).not.toMatch(
      /setInterval|scheduler|cron|while\s*\(\s*true\s*\)/i,
    );
    expect(source).not.toMatch(/shell:\s*true|exec\s*\(|execFile\s*\(/i);
  });
});
