import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PLAYBACK_SMOKE_AUDIO_REF_ENV,
  PLAYBACK_SMOKE_DURATION_MS_ENV,
  runPlaybackSmoke,
  type PlaybackSmokeReport,
} from "../../../scripts/voice/playback-smoke";
import type {
  LocalPlaybackCommandResult,
  PlaybackDriver,
  PlaybackDriverHealth,
} from "../../../src/lib/voice-runtime";

function fakeDriver(): PlaybackDriver & {
  readonly calls: {
    readonly loadedRefs: string[];
    playCount: number;
    stopCount: number;
  };
} {
  const calls = {
    loadedRefs: [] as string[],
    playCount: 0,
    stopCount: 0,
  };
  const health: PlaybackDriverHealth = {
    ok: true,
    degraded: false,
    metadata_only: true,
  };
  return {
    calls,
    loadAudioRef: vi.fn(async (audioRef) => {
      calls.loadedRefs.push(audioRef);
    }),
    playLoaded: vi.fn(async () => {
      calls.playCount += 1;
    }),
    stop: vi.fn(async () => {
      calls.stopCount += 1;
    }),
    health: vi.fn(async () => health),
  };
}

function failingDriver(
  diagnostics: LocalPlaybackCommandResult,
): PlaybackDriver {
  return {
    loadAudioRef: vi.fn(async () => undefined),
    playLoaded: vi.fn(async () => {
      throw {
        reason: "playback_failed",
        diagnostics,
        metadata_only: true,
      };
    }),
    stop: vi.fn(async () => undefined),
    health: vi.fn(
      async () =>
        ({
          ok: false,
          degraded: true,
          error_class: "driver_error",
          metadata_only: true,
        }) as const,
    ),
  };
}

describe("Phase 14E.4 manual playback smoke harness", () => {
  it("requires explicit audio_ref and prints metadata-only output", async () => {
    const lines: string[] = [];
    const driver = fakeDriver();

    const report = await runPlaybackSmoke({
      env: {
        [PLAYBACK_SMOKE_AUDIO_REF_ENV]: "C:/tmp/jarvis-output.wav",
        [PLAYBACK_SMOKE_DURATION_MS_ENV]: "1225",
      },
      statAudio: vi.fn(async () => ({ size: 32768 })),
      createDriver: () => driver,
      writeLine: (line) => lines.push(line),
    });

    expect(driver.calls.loadedRefs).toEqual(["C:/tmp/jarvis-output.wav"]);
    expect(driver.calls.playCount).toBe(1);
    expect(driver.calls.stopCount).toBe(1);
    expect(report).toEqual({
      status: "ok",
      audio_ref: "C:/tmp/jarvis-output.wav",
      provider_id: "manual-playback-smoke",
      voice_id: "local-wav",
      duration_ms: 1225,
      size_bytes: 32768,
      playback_state: "completed",
      metadata_only: true,
    } satisfies PlaybackSmokeReport);
    expect(lines).toEqual([
      "JARVIS local playback smoke",
      "status: ok",
      "audio_ref: C:/tmp/jarvis-output.wav",
      "provider_id: manual-playback-smoke",
      "voice_id: local-wav",
      "duration_ms: 1225",
      "size_bytes: 32768",
      "playback_state: completed",
    ]);
    expect(lines.join("\n")).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64|transcript|prompt|response/i,
    );
  });

  it("fails closed when audio_ref is missing before driver construction", async () => {
    const createDriver = vi.fn();
    await expect(
      runPlaybackSmoke({
        env: {},
        statAudio: vi.fn(),
        createDriver,
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "PlaybackSmokeError",
      message: expect.stringContaining("JARVIS_PLAYBACK_SMOKE_AUDIO_REF"),
    });
    expect(createDriver).not.toHaveBeenCalled();
  });

  it("fails closed on invalid stat metadata", async () => {
    await expect(
      runPlaybackSmoke({
        env: {
          [PLAYBACK_SMOKE_AUDIO_REF_ENV]: "C:/tmp/jarvis-output.wav",
        },
        statAudio: vi.fn(async () => ({ size: 0 })),
        createDriver: vi.fn(),
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "PlaybackSmokeError",
      message: expect.stringContaining("metadata failed closed"),
    });
  });

  it("prints bounded driver diagnostics on playback failure", async () => {
    const lines: string[] = [];
    const diagnostics: LocalPlaybackCommandResult = {
      error_class: "driver_error",
      exit_code: 1,
      signal: null,
      stderr_preview: [
        "Traceback (most recent call last):",
        '  File "C:/secret/playback.py", line 1, in <module>',
        "The wave header is invalid.",
        "x".repeat(900),
      ].join("\n"),
      command_metadata: {
        command: "powershell.exe",
        arg_count: 7,
        shell: false,
        timeout_ms: 120000,
        metadata_only: true,
      },
      metadata_only: true,
    };

    await expect(
      runPlaybackSmoke({
        env: {
          [PLAYBACK_SMOKE_AUDIO_REF_ENV]: "C:/tmp/jarvis-output.wav",
        },
        statAudio: vi.fn(async () => ({ size: 32768 })),
        createDriver: () => failingDriver(diagnostics),
        writeLine: (line) => lines.push(line),
      }),
    ).rejects.toMatchObject({
      name: "PlaybackSmokeError",
      error_class: "driver_error",
      exit_code: 1,
      stderr_preview: expect.stringContaining("The wave header is invalid."),
      command_metadata: {
        command: "powershell.exe",
        arg_count: 7,
        shell: false,
        timeout_ms: 120000,
        metadata_only: true,
      },
    });

    const output = lines.join("\n");
    expect(output).toContain("status: failed");
    expect(output).toContain("provider_id: manual-playback-smoke");
    expect(output).toContain("playback_state: failed");
    expect(output).toContain("error_class: driver_error");
    expect(output).toContain("exit_code: 1");
    expect(output).toContain("stderr_preview: The wave header is invalid.");
    expect(output).toContain("command: powershell.exe");
    expect(output).toContain("arg_count: 7");
    expect(output).toContain("shell: false");
    expect(output).not.toContain("Traceback (most recent call last):");
    expect(output).not.toContain("C:/secret/playback.py");
    expect(output).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|RIFF|base64|transcript|prompt|response/i,
    );
    const stderrLine = lines.find((line) => line.startsWith("stderr_preview:"));
    expect(stderrLine?.length ?? 0).toBeLessThanOrEqual(
      "stderr_preview: ".length + 512,
    );
  });

  it("does not execute on import or wire lifecycle scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(packageJson.scripts["voice:playback:smoke"]).toBe(
      "tsx scripts/voice/playback-smoke.ts",
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (name === "voice:playback:smoke") continue;
      expect(command).not.toContain("scripts/voice/playback-smoke.ts");
    }
  });

  it("does not introduce TTS/STT execution, runtime, persistence, cloud, UI, or autoplay", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/voice/playback-smoke.ts"),
      "utf8",
    );

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
  });
});
