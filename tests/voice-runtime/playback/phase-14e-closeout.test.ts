import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  buildWindowsPlaybackArgs,
  createLocalPlaybackAdapter,
  createLocalPlaybackDriver,
  createPlaybackSupervisor,
  isSafeLocalAudioRef,
  type LocalPlaybackCommandRunner,
  type PlaybackDriver,
  type PlaybackDriverHealth,
  type PlaybackQueueItem,
} from "../../../src/lib/voice-runtime";

const VERIFIED_PLAYBACK_SMOKE_RESULT = {
  playback_state: "completed",
  degraded: false,
  local_playback_verified: true,
  metadata_only: true,
} as const;

function queueItem(
  overrides: Partial<PlaybackQueueItem> = {},
): PlaybackQueueItem {
  return {
    item_id: "playback-item-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    chunk_id: "tts-chunk-1",
    provider_id: "fake-local-tts",
    voice_id: "fake-voice",
    audio_ref: "C:/tmp/jarvis-output.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    content_class: "assistant_prose",
    created_at: "2026-05-26T07:00:00.000Z",
    metadata_only: true,
    ...overrides,
  };
}

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

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function playbackSource(): string {
  return [
    "src/lib/voice-runtime/playback/types.ts",
    "src/lib/voice-runtime/playback/state-machine.ts",
    "src/lib/voice-runtime/playback/queue.ts",
    "src/lib/voice-runtime/playback/adapter.ts",
    "src/lib/voice-runtime/playback/supervisor.ts",
    "src/lib/voice-runtime/playback/local-driver.ts",
    "src/lib/voice-runtime/playback/index.ts",
    "scripts/voice/playback-smoke.ts",
  ]
    .map(source)
    .join("\n");
}

function nonDriverPlaybackSource(): string {
  return [
    "src/lib/voice-runtime/playback/types.ts",
    "src/lib/voice-runtime/playback/state-machine.ts",
    "src/lib/voice-runtime/playback/queue.ts",
    "src/lib/voice-runtime/playback/adapter.ts",
    "src/lib/voice-runtime/playback/supervisor.ts",
    "src/lib/voice-runtime/playback/index.ts",
    "scripts/voice/playback-smoke.ts",
  ]
    .map(source)
    .join("\n");
}

describe("Phase 14E playback closeout audit", () => {
  it("requires explicit beginPlayback and never autostarts from enqueue or load", async () => {
    const driver = fakeDriver();
    const adapter = createLocalPlaybackAdapter({ driver });
    const supervisor = createPlaybackSupervisor({
      adapter,
      queue_config: {
        max_queue_depth: 2,
        allow_sensitive_content: false,
        metadata_only: true,
      },
    });

    expect(supervisor.enqueue(queueItem())).toMatchObject({
      ok: true,
      snapshot: { playback_state: "idle", queue_depth: 1 },
    });
    expect(driver.calls.playCount).toBe(0);

    await expect(supervisor.loadNext()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "queueing",
        active_item_id: "playback-item-1",
      },
    });
    expect(driver.calls.loadedRefs).toEqual(["C:/tmp/jarvis-output.wav"]);
    expect(driver.calls.playCount).toBe(0);

    await expect(supervisor.beginPlayback()).resolves.toMatchObject({
      ok: true,
      snapshot: { playback_state: "playing" },
    });
    expect(driver.calls.playCount).toBe(1);
  });

  it("blocks unsafe content and allows only assistant_prose by default", () => {
    const supervisor = createPlaybackSupervisor({
      adapter: createLocalPlaybackAdapter({ driver: fakeDriver() }),
    });

    expect(
      supervisor.enqueue(queueItem({ content_class: "tool_output" })),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
      snapshot: { queue_depth: 0 },
    });
    expect(
      supervisor.enqueue(queueItem({ content_class: "assistant_prose" })),
    ).toMatchObject({
      ok: true,
      snapshot: { queue_depth: 1 },
    });
  });

  it("interrupt, stop, and clear release active playback state without autoplay", async () => {
    const interruptDriver = fakeDriver();
    const interruptSupervisor = createPlaybackSupervisor({
      adapter: createLocalPlaybackAdapter({ driver: interruptDriver }),
      queue_config: {
        max_queue_depth: 3,
        allow_sensitive_content: false,
        metadata_only: true,
      },
    });

    interruptSupervisor.enqueue(queueItem());
    interruptSupervisor.enqueue(
      queueItem({
        item_id: "playback-item-2",
        chunk_id: "tts-chunk-2",
        audio_ref: "C:/tmp/jarvis-output-2.wav",
      }),
    );
    await interruptSupervisor.loadNext();
    await interruptSupervisor.beginPlayback();
    await expect(
      interruptSupervisor.interrupt("user stop"),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "interrupted",
        queue_depth: 1,
        interruption_reason: "user stop",
      },
    });
    expect(interruptDriver.calls.stopCount).toBe(1);
    expect(interruptDriver.calls.playCount).toBe(1);
    await expect(interruptSupervisor.beginPlayback()).resolves.toMatchObject({
      ok: false,
      reasons: ["no_loaded_item"],
    });

    const completeDriver = fakeDriver();
    const completeSupervisor = createPlaybackSupervisor({
      adapter: createLocalPlaybackAdapter({ driver: completeDriver }),
    });
    completeSupervisor.enqueue(queueItem());
    await completeSupervisor.loadNext();
    await completeSupervisor.beginPlayback();
    await expect(completeSupervisor.complete()).resolves.toMatchObject({
      ok: true,
      snapshot: { playback_state: "completed" },
    });
    expect(completeDriver.calls.stopCount).toBe(1);
    await expect(completeSupervisor.complete()).resolves.toMatchObject({
      ok: false,
      reasons: ["no_loaded_item"],
    });

    const clearSupervisor = createPlaybackSupervisor({
      adapter: createLocalPlaybackAdapter({ driver: fakeDriver() }),
      queue_config: {
        max_queue_depth: 3,
        allow_sensitive_content: false,
        metadata_only: true,
      },
    });
    clearSupervisor.enqueue(queueItem({ item_id: "playback-item-3" }));
    clearSupervisor.enqueue(queueItem({ item_id: "playback-item-4" }));
    await expect(clearSupervisor.clear("closeout")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "completed",
        active_item_id: null,
        queue_depth: 0,
      },
    });
  });

  it("keeps playback snapshots metadata-only with no raw audio or transcript exposure", async () => {
    const supervisor = createPlaybackSupervisor({
      adapter: createLocalPlaybackAdapter({ driver: fakeDriver() }),
    });
    supervisor.enqueue(queueItem());
    await supervisor.loadNext();
    const snapshot = supervisor.snapshot();

    expect(Object.keys(snapshot)).toEqual([
      "playback_state",
      "active_item_id",
      "session_id",
      "turn_id",
      "chunk_id",
      "provider_id",
      "voice_id",
      "queue_depth",
      "metadata_only",
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response|RIFF|base64|audio_ref/i,
    );
  });

  it("keeps local driver shell=false, args array, validated WAV paths, and escaped single quotes", async () => {
    const calls: {
      readonly commands: string[];
      readonly args: string[][];
      readonly shell: boolean[];
    } = {
      commands: [],
      args: [] as string[][],
      shell: [],
    };
    const runner: LocalPlaybackCommandRunner = {
      run: vi.fn(async (command, args, options) => {
        calls.commands.push(command);
        calls.args.push(args);
        calls.shell.push(options.shell);
        return {
          exit_code: 0,
          signal: null,
          command_metadata: {
            command,
            arg_count: args.length,
            shell: options.shell,
            timeout_ms: options.timeout_ms,
            metadata_only: true as const,
          },
          metadata_only: true as const,
        };
      }),
      stop: vi.fn(async () => undefined),
    };
    // E-025 (fixture only; assertions unchanged): an ABSOLUTE local WAV for the
    // running platform — "C:/..." is relative on POSIX. The Windows driver is
    // pinned with platform: "win32" so its argv contract is asserted anywhere.
    const audioRef =
      process.platform === "win32"
        ? "C:/tmp/jarvis's output.wav"
        : "/tmp/jarvis's output.wav";
    const mp3Ref =
      process.platform === "win32" ? "C:/tmp/jarvis.mp3" : "/tmp/jarvis.mp3";
    const args = buildWindowsPlaybackArgs(audioRef);

    expect(isSafeLocalAudioRef(audioRef)).toBe(true);
    expect(isSafeLocalAudioRef("https://example.com/jarvis.wav")).toBe(false);
    expect(isSafeLocalAudioRef(mp3Ref)).toBe(false);
    expect(Array.isArray(args)).toBe(true);
    expect(args).toHaveLength(6);
    expect(args[4]).toBe("-Command");
    expect(args[5]).toContain("jarvis''s output.wav");
    expect(args[5]).not.toContain("jarvis's output.wav");
    expect(args[5]).not.toMatch(/\$args|\$\(|`/);

    const driver = createLocalPlaybackDriver({ runner, platform: "win32" });
    await driver.loadAudioRef(audioRef);
    await driver.playLoaded();
    expect(calls.commands).toEqual(["powershell.exe"]);
    expect(calls.shell).toEqual([false]);
    expect(calls.args[0]).toEqual(args);
  });

  it("preserves bounded metadata-only diagnostics", async () => {
    const runner: LocalPlaybackCommandRunner = {
      run: vi.fn(async (command, args, options) => ({
        error_class: "driver_error" as const,
        exit_code: 1,
        signal: null,
        stderr_preview: [
          "Traceback (most recent call last):",
          '  File "C:/secret/playback.py", line 1, in <module>',
          "The wave header is invalid.",
          "x".repeat(900),
        ].join("\n"),
        command_metadata: {
          command,
          arg_count: args.length,
          shell: options.shell,
          timeout_ms: options.timeout_ms,
          metadata_only: true as const,
        },
        metadata_only: true as const,
      })),
      stop: vi.fn(async () => undefined),
    };
    // E-025 (fixture only): absolute WAV for the running platform; Windows driver pinned.
    const driver = createLocalPlaybackDriver({ runner, platform: "win32" });
    await driver.loadAudioRef(
      process.platform === "win32"
        ? "C:/tmp/jarvis-output.wav"
        : "/tmp/jarvis-output.wav",
    );

    await expect(driver.playLoaded()).rejects.toMatchObject({
      reason: "playback_failed",
      diagnostics: {
        error_class: "driver_error",
        exit_code: 1,
        command_metadata: {
          command: "powershell.exe",
          arg_count: 6,
          shell: false,
          metadata_only: true,
        },
        metadata_only: true,
      },
    });

    try {
      await driver.playLoaded();
      throw new Error("expected playback failure");
    } catch (error) {
      const diagnostics = (error as { diagnostics?: unknown }).diagnostics;
      const serialized = JSON.stringify(diagnostics);
      expect(serialized).toContain("The wave header is invalid.");
      expect(serialized).not.toContain("Traceback (most recent call last):");
      expect(serialized).not.toContain("C:/secret/playback.py");
      expect(serialized).not.toMatch(
        /raw_audio|audio_bytes|waveform|pcm|RIFF|base64|transcript/i,
      );
      const preview = (diagnostics as { stderr_preview?: string })
        .stderr_preview;
      expect(preview?.length ?? 0).toBeLessThanOrEqual(512);
    }
  });

  it("keeps playback governance defaults disabled and documents real smoke safely", () => {
    expect(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG).toMatchObject({
      raw_audio_persistence_enabled: false,
      transcript_persistence_enabled: false,
      cloud_tts_enabled: false,
      playback_autostart_enabled: false,
      allow_tts_for_sensitive_content: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS).toMatchObject({
      playback: false,
      cloud_tts: false,
      realtime_streaming: false,
      voice_runtime_integration: false,
    });
    expect(VERIFIED_PLAYBACK_SMOKE_RESULT).toEqual({
      playback_state: "completed",
      degraded: false,
      local_playback_verified: true,
      metadata_only: true,
    });
  });

  it("keeps direct speaker/audio command access isolated to the driver seam", () => {
    const nonDriver = nonDriverPlaybackSource();
    const driver = source("src/lib/voice-runtime/playback/local-driver.ts");

    expect(nonDriver).not.toMatch(
      /System\.Media\.SoundPlayer|from\s+["']node:child_process["']|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(driver).toMatch(/from\s+["']node:child_process["']/);
    expect(driver).toContain("shell: options.shell");
    expect(driver).not.toMatch(
      /from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
    );
  });

  it("keeps playback disconnected from runtime, router, TTS/STT execution, persistence, cloud, UI, scheduler, and autoplay paths", () => {
    const combined = playbackSource();

    expect(combined).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(combined).not.toMatch(
      /createPiperTtsProvider|synthesize\s*\(|piper\s+(?:--|["'])/i,
    );
    expect(combined).not.toMatch(
      /createFasterWhisperSttProvider|transcribe\s*\(|faster_whisper|faster-whisper/i,
    );
    expect(combined).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(combined).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(combined).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(combined).not.toMatch(/scheduler|cron|setInterval/i);
    expect(combined).not.toMatch(/autoplay|auto.?play/i);
  });
});
