import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createLocalPlaybackAdapter,
  type PlaybackDriver,
  type PlaybackDriverHealth,
  type PlaybackQueueItem,
} from "../../../src/lib/voice-runtime";

function playbackAdapterSource(): string {
  return [
    "src/lib/voice-runtime/playback/adapter.ts",
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

describe("Phase 14E.2 local playback adapter scaffold", () => {
  it("loads a metadata-only item without starting playback", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalPlaybackAdapter({
      driver,
      now_ms: () => 1000,
    });
    const item = queueItem();

    await expect(adapter.load(item)).resolves.toMatchObject({
      ok: true,
      snapshot: {
        state: "queueing",
        item_id: item.item_id,
        audio_ref: item.audio_ref,
        metadata_only: true,
      },
    });
    expect(driver.calls.loadedRefs).toEqual([item.audio_ref]);
    expect(driver.calls.playCount).toBe(0);
    expect(adapter.snapshot()).toMatchObject({
      state: "queueing",
    });
    expect(Object.keys(adapter.snapshot())).not.toContain("started_at");
  });

  it("requires a loaded item before explicit play", async () => {
    const adapter = createLocalPlaybackAdapter({
      driver: createFakeDriver(),
    });

    await expect(adapter.play()).resolves.toMatchObject({
      ok: false,
      reasons: ["not_loaded"],
      snapshot: { state: "idle" },
    });
  });

  it("rejects unsafe content before driver load", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalPlaybackAdapter({ driver });

    await expect(
      adapter.load(queueItem({ content_class: "tool_output" })),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
    });
    expect(driver.calls.loadedRefs).toEqual([]);

    const permissive = createLocalPlaybackAdapter({
      driver,
      config: { allow_sensitive_content: true, metadata_only: true },
    });
    await expect(
      permissive.load(queueItem({ content_class: "tool_output" })),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: { state: "queueing" },
    });
  });

  it("plays only after explicit play is called", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalPlaybackAdapter({
      driver,
      now_ms: () => 2000,
    });

    await adapter.load(queueItem());
    await expect(adapter.play()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        state: "playing",
        started_at: "1970-01-01T00:00:02.000Z",
      },
    });
    expect(driver.calls.playCount).toBe(1);
  });

  it("stop releases active state and calls driver stop only while playing", async () => {
    let now = 3000;
    const driver = createFakeDriver();
    const adapter = createLocalPlaybackAdapter({
      driver,
      now_ms: () => now,
    });

    await adapter.load(queueItem());
    await adapter.play();
    now = 4500;

    await expect(adapter.stop("completed")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        state: "completed",
        stopped_at: "1970-01-01T00:00:04.500Z",
      },
    });
    expect(driver.calls.stopCount).toBe(1);
    await expect(adapter.stop("again")).resolves.toMatchObject({
      ok: false,
      reasons: ["not_loaded"],
    });
  });

  it("interrupt releases active state and records bounded metadata", async () => {
    let now = 5000;
    const driver = createFakeDriver();
    const adapter = createLocalPlaybackAdapter({
      driver,
      now_ms: () => now,
    });

    await adapter.load(queueItem());
    await adapter.play();
    now = 5100;

    await expect(
      adapter.interrupt("user_cancelled with unsafe chars <script>"),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        state: "interrupted",
        interruption_reason: "user_cancelled with unsafe chars _script_",
        stopped_at: "1970-01-01T00:00:05.100Z",
      },
    });
    expect(driver.calls.stopCount).toBe(1);
    expect(adapter.snapshot()).toMatchObject({
      state: "interrupted",
      item_id: "playback-item-1",
    });
  });

  it("fails closed on driver failures", async () => {
    const loadFail = createLocalPlaybackAdapter({
      driver: createFakeDriver({ load: true }),
    });
    await expect(loadFail.load(queueItem())).resolves.toMatchObject({
      ok: false,
      reasons: ["driver_error"],
      snapshot: { error_class: "driver_error" },
    });

    const playFail = createLocalPlaybackAdapter({
      driver: createFakeDriver({ play: true }),
      now_ms: () => 6000,
    });
    await playFail.load(queueItem());
    await expect(playFail.play()).resolves.toMatchObject({
      ok: false,
      reasons: ["driver_error"],
      snapshot: { state: "failed", error_class: "driver_error" },
    });

    const stopFail = createLocalPlaybackAdapter({
      driver: createFakeDriver({ stop: true }),
      now_ms: () => 7000,
    });
    await stopFail.load(queueItem());
    await stopFail.play();
    await expect(stopFail.stop("completed")).resolves.toMatchObject({
      ok: false,
      reasons: ["driver_error"],
      snapshot: { state: "failed", error_class: "driver_error" },
    });
  });

  it("returns metadata-only snapshots and health", async () => {
    const adapter = createLocalPlaybackAdapter({
      driver: createFakeDriver(),
    });
    await adapter.load(queueItem());

    expect(await adapter.health()).toEqual({
      ok: true,
      degraded: false,
      metadata_only: true,
      state: "queueing",
    });
    const snapshot = adapter.snapshot();
    expect(Object.keys(snapshot)).toEqual([
      "state",
      "item_id",
      "session_id",
      "turn_id",
      "chunk_id",
      "audio_ref",
      "provider_id",
      "voice_id",
      "duration_ms",
      "metadata_only",
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response|RIFF|base64/i,
    );
  });

  it("does not import speaker playback APIs, execute TTS/STT, wire runtime, persist, call cloud, or wire UI", () => {
    const source = playbackAdapterSource();

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(|from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
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
