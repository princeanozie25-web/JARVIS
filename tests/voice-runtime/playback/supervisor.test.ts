import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createLocalPlaybackAdapter,
  createPlaybackSupervisor,
  type PlaybackDriver,
  type PlaybackDriverHealth,
  type PlaybackQueueItem,
} from "../../../src/lib/voice-runtime";

function playbackSupervisorSource(): string {
  return [
    "src/lib/voice-runtime/playback/supervisor.ts",
    "src/lib/voice-runtime/playback/index.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

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
    audio_ref: "tts-output://voice-session-1/voice-turn-1/chunk-1.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    content_class: "assistant_prose",
    created_at: "2026-05-26T07:00:00.000Z",
    metadata_only: true,
    ...overrides,
  };
}

function createFakeDriver(
  failures: Partial<Record<"load" | "play" | "stop", boolean>> = {},
): PlaybackDriver & {
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
    loadAudioRef: async (audioRef) => {
      if (failures.load) throw new Error("load failed");
      calls.loadedRefs.push(audioRef);
    },
    playLoaded: async () => {
      if (failures.play) throw new Error("play failed");
      calls.playCount += 1;
    },
    stop: async () => {
      if (failures.stop) throw new Error("stop failed");
      calls.stopCount += 1;
    },
    health: async () => health,
  };
}

function createHarness() {
  const driver = createFakeDriver();
  let now = 1000;
  const adapter = createLocalPlaybackAdapter({
    driver,
    now_ms: () => now,
  });
  const supervisor = createPlaybackSupervisor({
    adapter,
    now_ms: () => now,
    queue_config: {
      max_queue_depth: 2,
      allow_sensitive_content: false,
      metadata_only: true,
    },
  });
  return {
    driver,
    supervisor,
    setNow: (value: number) => {
      now = value;
    },
  };
}

describe("Phase 14E.3 playback supervisor", () => {
  it("enforces queue limits and single active playback invariant", async () => {
    const { supervisor } = createHarness();

    expect(supervisor.enqueue(queueItem())).toMatchObject({
      ok: true,
      snapshot: { queue_depth: 1, playback_state: "idle" },
    });
    expect(
      supervisor.enqueue(queueItem({ item_id: "playback-item-2" })),
    ).toMatchObject({
      ok: true,
      snapshot: { queue_depth: 2 },
    });
    expect(
      supervisor.enqueue(queueItem({ item_id: "playback-item-3" })),
    ).toMatchObject({
      ok: false,
      reasons: ["queue_full"],
      snapshot: { queue_depth: 2 },
    });

    await expect(supervisor.loadNext()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "queueing",
        active_item_id: "playback-item-1",
        queue_depth: 1,
      },
    });
    await expect(supervisor.loadNext()).resolves.toMatchObject({
      ok: false,
      reasons: ["active_playback_exists"],
    });
  });

  it("requires a queued item for loadNext", async () => {
    const { supervisor } = createHarness();

    await expect(supervisor.loadNext()).resolves.toMatchObject({
      ok: false,
      reasons: ["no_queued_item"],
      snapshot: { playback_state: "idle", queue_depth: 0 },
    });
  });

  it("loads without autoplay and requires explicit beginPlayback", async () => {
    const { driver, supervisor, setNow } = createHarness();

    supervisor.enqueue(queueItem());
    await supervisor.loadNext();
    expect(driver.calls.loadedRefs).toEqual([
      "tts-output://voice-session-1/voice-turn-1/chunk-1.wav",
    ]);
    expect(driver.calls.playCount).toBe(0);

    setNow(2000);
    await expect(supervisor.beginPlayback()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "playing",
        active_item_id: "playback-item-1",
        started_at: "1970-01-01T00:00:02.000Z",
      },
    });
    expect(driver.calls.playCount).toBe(1);
  });

  it("fails closed when beginPlayback is called without a loaded item", async () => {
    const { supervisor } = createHarness();

    await expect(supervisor.beginPlayback()).resolves.toMatchObject({
      ok: false,
      reasons: ["no_loaded_item"],
      snapshot: { playback_state: "idle" },
    });
  });

  it("completes active playback and allows reset only from terminal state", async () => {
    const { driver, supervisor, setNow } = createHarness();

    expect(supervisor.reset()).toMatchObject({
      ok: false,
      reasons: ["invalid_state"],
    });

    supervisor.enqueue(queueItem());
    await supervisor.loadNext();
    await supervisor.beginPlayback();
    setNow(2500);

    await expect(supervisor.complete()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "completed",
        active_item_id: "playback-item-1",
        stopped_at: "1970-01-01T00:00:02.500Z",
      },
    });
    expect(driver.calls.stopCount).toBe(1);
    expect(supervisor.reset()).toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "idle",
        active_item_id: null,
      },
    });
  });

  it("interrupt releases playback state and does not autoplay the next queued item", async () => {
    const { driver, supervisor, setNow } = createHarness();

    supervisor.enqueue(queueItem());
    supervisor.enqueue(
      queueItem({
        item_id: "playback-item-2",
        chunk_id: "tts-chunk-2",
        audio_ref: "tts-output://voice-session-1/voice-turn-1/chunk-2.wav",
      }),
    );
    await supervisor.loadNext();
    await supervisor.beginPlayback();
    setNow(3000);

    await expect(supervisor.interrupt("user <stop>")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "interrupted",
        active_item_id: "playback-item-1",
        queue_depth: 1,
        interruption_reason: "user _stop_",
      },
    });
    expect(driver.calls.stopCount).toBe(1);
    expect(driver.calls.playCount).toBe(1);
    expect(supervisor.snapshot()).toMatchObject({
      playback_state: "interrupted",
      queue_depth: 1,
    });
  });

  it("clear empties the queue and stops active playback", async () => {
    const { driver, supervisor, setNow } = createHarness();

    supervisor.enqueue(queueItem());
    supervisor.enqueue(queueItem({ item_id: "playback-item-2" }));
    await supervisor.loadNext();
    await supervisor.beginPlayback();
    setNow(4000);

    await expect(supervisor.clear("user_cancelled")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        playback_state: "completed",
        active_item_id: null,
        queue_depth: 0,
        stopped_at: "1970-01-01T00:00:04.000Z",
      },
    });
    expect(driver.calls.stopCount).toBe(1);
  });

  it("rejects unsafe content through queue coordination", () => {
    const { supervisor } = createHarness();

    expect(
      supervisor.enqueue(queueItem({ content_class: "tool_output" })),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
      snapshot: { queue_depth: 0 },
    });
  });

  it("fails closed on adapter failures", async () => {
    const driver = createFakeDriver({ play: true });
    const adapter = createLocalPlaybackAdapter({ driver });
    const supervisor = createPlaybackSupervisor({ adapter });

    supervisor.enqueue(queueItem());
    await supervisor.loadNext();
    await expect(supervisor.beginPlayback()).resolves.toMatchObject({
      ok: false,
      reasons: ["driver_error"],
      snapshot: {
        playback_state: "failed",
        error_class: "driver_error",
      },
    });
  });

  it("returns metadata-only snapshots with no raw audio bytes", async () => {
    const { supervisor } = createHarness();

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

  it("does not import speaker/audio APIs, execute TTS/STT, wire runtime, persist, call cloud, wire UI, or autoplay", () => {
    const source = playbackSupervisorSource();

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
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
