import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_PLAYBACK_DEFAULT_COMMAND,
  LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS,
  LocalPlaybackDriverError,
  buildWindowsPlaybackArgs,
  createLocalPlaybackDriver,
  isSafeLocalAudioRef,
  type LocalPlaybackCommandRunner,
} from "../../../src/lib/voice-runtime";

function localDriverSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/playback/local-driver.ts"),
    "utf8",
  );
}

function fakeRunner(exitCode = 0): LocalPlaybackCommandRunner & {
  readonly calls: {
    readonly commands: string[];
    readonly args: string[][];
    readonly shell: boolean[];
    stopCount: number;
  };
} {
  const calls = {
    commands: [] as string[],
    args: [] as string[][],
    shell: [] as boolean[],
    stopCount: 0,
  };
  return {
    calls,
    run: vi.fn(async (command, args, options) => {
      calls.commands.push(command);
      calls.args.push(args);
      calls.shell.push(options.shell);
      return {
        ...(exitCode === 0 ? {} : { error_class: "driver_error" as const }),
        exit_code: exitCode,
        signal: null,
        ...(exitCode === 0
          ? {}
          : {
              stderr_preview: [
                "Traceback (most recent call last):",
                '  File "C:/secret/playback.py", line 1, in <module>',
                "bounded playback failure",
                "x".repeat(900),
              ].join("\n"),
              command_metadata: {
                command,
                arg_count: args.length,
                shell: options.shell,
                timeout_ms: options.timeout_ms,
                metadata_only: true as const,
              },
            }),
        metadata_only: true as const,
      };
    }),
    stop: vi.fn(async () => {
      calls.stopCount += 1;
    }),
  };
}

describe("Phase 14E.4 local playback driver", () => {
  it("builds a bounded Windows playback command with args array and shell=false", async () => {
    const runner = fakeRunner();
    const driver = createLocalPlaybackDriver({
      runner,
      command: "powershell.exe",
      timeout_ms: 5000,
    });

    await driver.loadAudioRef("C:/tmp/jarvis-output.wav");
    await driver.playLoaded();

    expect(runner.calls.commands).toEqual(["powershell.exe"]);
    expect(runner.calls.shell).toEqual([false]);
    expect(runner.calls.args[0]).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      expect.stringContaining("System.Media.SoundPlayer"),
    ]);
    expect(runner.calls.args[0]?.[5]).toContain("'C:/tmp/jarvis-output.wav'");
    expect(runner.calls.args[0]?.length).toBe(6);
    expect(runner.calls.args[0]).not.toContain("C:/tmp/jarvis-output.wav");
    expect(runner.run).toHaveBeenCalledWith(
      LOCAL_PLAYBACK_DEFAULT_COMMAND,
      buildWindowsPlaybackArgs("C:/tmp/jarvis-output.wav"),
      {
        shell: false,
        timeout_ms: 5000,
        metadata_only: true,
      },
    );
  });

  it("embeds the WAV path inside the -Command script as a single-quoted literal and avoids $args concatenation", () => {
    const args = buildWindowsPlaybackArgs("C:\\AI\\piper\\test.wav");

    expect(args).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      expect.stringContaining("System.Media.SoundPlayer"),
    ]);
    expect(args.length).toBe(6);
    const script = args[5] ?? "";
    expect(script).toContain("'C:\\AI\\piper\\test.wav'");
    expect(script).toContain("$player.Load()");
    expect(script).toContain("$player.PlaySync()");
    // The trailing-argv $args trap from `powershell.exe -Command` must be gone.
    expect(script).not.toContain("$args");
    expect(script).not.toContain("$args[0]");
    // The WAV path must not appear as an additional argv element either.
    expect(args.slice(0, 5)).not.toContain("C:\\AI\\piper\\test.wav");
    expect(args.filter((a) => a === "C:\\AI\\piper\\test.wav")).toHaveLength(0);
  });

  it("escapes embedded single quotes so the path cannot break out of the PowerShell string literal", () => {
    const args = buildWindowsPlaybackArgs("C:\\tmp\\o'malley.wav");
    const script = args[5] ?? "";

    expect(script).toContain("'C:\\tmp\\o''malley.wav'");
    expect(script).not.toContain("'C:\\tmp\\o'malley.wav'");
  });

  it("accepts only explicit local WAV refs", async () => {
    expect(isSafeLocalAudioRef("C:/tmp/jarvis-output.wav")).toBe(true);
    expect(isSafeLocalAudioRef("https://example.com/audio.wav")).toBe(false);
    expect(isSafeLocalAudioRef("C:/tmp/jarvis-output.mp3")).toBe(false);
    expect(isSafeLocalAudioRef("relative-output.wav")).toBe(false);

    const driver = createLocalPlaybackDriver({ runner: fakeRunner() });
    await expect(
      driver.loadAudioRef("https://example.com/audio.wav"),
    ).rejects.toMatchObject({
      name: "LocalPlaybackDriverError",
      reason: "invalid_audio_ref",
      metadata_only: true,
    });
  });

  it("fails closed on unloaded playback and command failure", async () => {
    const unloaded = createLocalPlaybackDriver({ runner: fakeRunner() });
    await expect(unloaded.playLoaded()).rejects.toBeInstanceOf(
      LocalPlaybackDriverError,
    );

    const failing = createLocalPlaybackDriver({
      runner: fakeRunner(1),
    });
    await failing.loadAudioRef("C:/tmp/jarvis-output.wav");
    await expect(failing.playLoaded()).rejects.toMatchObject({
      reason: "playback_failed",
      diagnostics: {
        error_class: "driver_error",
        exit_code: 1,
        stderr_preview: expect.stringContaining("bounded playback failure"),
        command_metadata: {
          command: "powershell.exe",
          arg_count: 6,
          shell: false,
          timeout_ms: 120000,
          metadata_only: true,
        },
        metadata_only: true,
      },
    });
    await expect(failing.health()).resolves.toEqual({
      ok: false,
      degraded: true,
      error_class: "driver_error",
      metadata_only: true,
    });
  });

  it("bounds diagnostics and strips raw traceback frames", async () => {
    const failing = createLocalPlaybackDriver({
      runner: fakeRunner(1),
    });
    await failing.loadAudioRef("C:/tmp/jarvis-output.wav");

    try {
      await failing.playLoaded();
      throw new Error("expected playback failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LocalPlaybackDriverError);
      const diagnostics = (error as LocalPlaybackDriverError).diagnostics;
      expect(diagnostics?.stderr_preview).toContain("bounded playback failure");
      expect(diagnostics?.stderr_preview).not.toContain(
        "Traceback (most recent call last):",
      );
      expect(diagnostics?.stderr_preview).not.toContain(
        "C:/secret/playback.py",
      );
      expect(diagnostics?.stderr_preview?.length ?? 0).toBeLessThanOrEqual(512);
      expect(JSON.stringify(diagnostics)).not.toMatch(
        /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/i,
      );
    }
  });

  it("stops through the injected runner and returns no raw audio", async () => {
    const runner = fakeRunner();
    const driver = createLocalPlaybackDriver({ runner });

    await driver.stop();
    expect(runner.calls.stopCount).toBe(1);
    expect(await driver.health()).toEqual({
      ok: true,
      degraded: false,
      metadata_only: true,
    });
    expect(JSON.stringify(await driver.health())).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64/i,
    );
  });

  it("does not introduce TTS/STT execution, runtime, persistence, cloud, UI, or autoplay", () => {
    const source = localDriverSource();

    expect(source).not.toMatch(
      /createPiperTtsProvider|synthesize\s*\(|createFasterWhisperSttProvider|transcribe\s*\(|faster_whisper|piper/i,
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
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(/autoplay|auto.?play/i);
    expect(source).not.toMatch(
      /from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
    );
    expect(source).toContain("shell: options.shell");
  });

  it("keeps default command metadata deterministic", () => {
    expect(LOCAL_PLAYBACK_DEFAULT_COMMAND).toBe("powershell.exe");
    expect(LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS).toBe(120000);
  });
});
