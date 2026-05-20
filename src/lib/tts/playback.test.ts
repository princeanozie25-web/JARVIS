import { describe, expect, it, vi } from "vitest";
import {
  BrowserPlaybackWrapper,
  InMemoryPlaybackManager,
  type BrowserAudioElement,
} from "./playback";
import type {
  PlaybackTelemetryEvent,
  SpeechAudioResult,
  SpeechQueueItem,
} from "./types";

function audioResult(data = new Uint8Array([1, 2, 3])): SpeechAudioResult {
  return {
    id: "audio-1",
    chunkId: "chunk-1",
    mimeType: "audio/wav",
    durationMs: 150,
    sampleRate: 24_000,
    byteLength: data.byteLength,
    createdAt: 1_000,
    source: "local_tts",
    data,
  };
}

function readyQueueItem(
  text = "Assistant prose ready for speech.",
): SpeechQueueItem {
  return {
    id: "queue-1",
    chunkId: "chunk-1",
    text,
    status: "ready",
    createdAt: 1_000,
    completedAt: 1_001,
  };
}

function createManager() {
  let now = 2_000;
  const telemetry: PlaybackTelemetryEvent[] = [];
  return {
    telemetry,
    manager: new InMemoryPlaybackManager({
      newId: () => "playback-1",
      now: () => now++,
      emitTelemetry: (event) => telemetry.push(event),
    }),
  };
}

function createAudioElement(): BrowserAudioElement & {
  playMock: ReturnType<typeof vi.fn>;
  pauseMock: ReturnType<typeof vi.fn>;
  loadMock: ReturnType<typeof vi.fn>;
} {
  const playMock = vi.fn().mockResolvedValue(undefined);
  const pauseMock = vi.fn();
  const loadMock = vi.fn();
  return {
    src: "",
    onended: null,
    onerror: null,
    play: playMock,
    pause: pauseMock,
    load: loadMock,
    removeAttribute(name) {
      if (name === "src") this.src = "";
    },
    playMock,
    pauseMock,
    loadMock,
  };
}

describe("InMemoryPlaybackManager", () => {
  it("creates ready playback items without starting playback", () => {
    const { manager, telemetry } = createManager();

    expect(
      manager.createFromReadyQueueItem(audioResult(), readyQueueItem()),
    ).toEqual({
      ok: true,
      item: {
        id: "playback-1",
        audioId: "audio-1",
        chunkId: "chunk-1",
        source: "local_tts",
        status: "ready",
        createdAt: 2_000,
        mimeType: "audio/wav",
        byteLength: 3,
        durationMs: 150,
        sampleRate: 24_000,
      },
    });
    expect(manager.getActiveItem()).toMatchObject({ status: "ready" });
    expect(telemetry).toEqual([
      expect.objectContaining({
        eventType: "tts_playback_ready",
        success: true,
        status: "ready",
      }),
    ]);
  });

  it("allows one active playback item max", () => {
    const { manager } = createManager();

    expect(manager.createFromAudio(audioResult()).ok).toBe(true);
    expect(manager.createFromAudio(audioResult(new Uint8Array([4])))).toEqual({
      ok: false,
      reason: "active_playback_exists",
    });
  });

  it("updates metadata for play, stop, complete, cancel, and cleanup", () => {
    const { manager, telemetry } = createManager();
    const created = manager.createFromAudio(audioResult());
    if (!created.ok) throw new Error("Expected playback item");

    expect(manager.markPlaying(created.item.id)).toMatchObject({
      status: "playing",
      startedAt: 2_001,
    });
    expect(manager.stop(created.item.id)).toMatchObject({
      status: "completed",
      completedAt: 2_002,
    });
    manager.cleanup();
    expect(manager.getActiveItem()).toBeNull();

    const second = manager.createFromAudio(audioResult(new Uint8Array([5])));
    if (!second.ok) throw new Error("Expected second playback item");
    expect(manager.cancel(second.item.id)).toMatchObject({
      status: "cancelled",
    });
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "tts_playback_ready",
      "tts_playback_started",
      "tts_playback_stopped",
      "tts_playback_ready",
      "tts_playback_cancelled",
    ]);
  });

  it("rejects blocked content before playback item creation", () => {
    const { manager } = createManager();

    expect(
      manager.createFromReadyQueueItem(
        audioResult(),
        readyQueueItem("```ts\nconsole.log('silent')\n```"),
      ),
    ).toEqual({ ok: false, reason: "code_block_blocked" });
    expect(
      manager.createFromReadyQueueItem(audioResult(), {
        ...readyQueueItem("<personal_context>Private.</personal_context>"),
      }),
    ).toEqual({ ok: false, reason: "personal_context_blocked" });
    expect(
      manager.createFromAudio(audioResult(), {
        text: "Tool output.",
        source: "tool_output",
      }),
    ).toEqual({ ok: false, reason: "tool_output_blocked" });
    expect(manager.getActiveItem()).toBeNull();
  });

  it("keeps audio bytes and spoken text out of telemetry", () => {
    const { manager, telemetry } = createManager();
    const secretText = "Assistant prose that must not leak.";
    const created = manager.createFromReadyQueueItem(
      audioResult(new Uint8Array([9, 8, 7])),
      readyQueueItem(secretText),
    );
    if (!created.ok) throw new Error("Expected playback item");
    manager.markPlaying(created.item.id);
    manager.complete(created.item.id);

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("tts_playback_ready");
    expect(serialized).toContain("tts_playback_completed");
    expect(serialized).not.toContain(secretText);
    expect(serialized).not.toContain("9,8,7");
    expect(serialized).not.toContain("data");
  });
});

describe("BrowserPlaybackWrapper", () => {
  it("requires manual user gesture before play and never autoplays on load", async () => {
    const audio = createAudioElement();
    const wrapper = new BrowserPlaybackWrapper({
      createObjectUrl: () => "blob:tts",
      revokeObjectUrl: vi.fn(),
      createAudioElement: () => audio,
    });

    wrapper.load(audioResult());
    expect(audio.playMock).not.toHaveBeenCalled();
    await expect(wrapper.play()).rejects.toThrow(
      "User gesture is required before speech playback.",
    );
    wrapper.requireUserGesture();
    await wrapper.play();
    expect(audio.playMock).toHaveBeenCalledTimes(1);
  });

  it("revokes object URLs and clears audio element state on stop and cancel", () => {
    const revokeObjectUrl = vi.fn();
    const audio = createAudioElement();
    const wrapper = new BrowserPlaybackWrapper({
      createObjectUrl: () => "blob:tts",
      revokeObjectUrl,
      createAudioElement: () => audio,
    });

    wrapper.load(audioResult());
    expect(audio.src).toBe("blob:tts");
    wrapper.stop();

    expect(audio.pauseMock).toHaveBeenCalled();
    expect(audio.loadMock).toHaveBeenCalled();
    expect(audio.src).toBe("");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:tts");

    wrapper.load(audioResult(new Uint8Array([4])));
    wrapper.cancel();
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });
});
