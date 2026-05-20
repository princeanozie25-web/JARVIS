import { describe, expect, it, vi, afterEach } from "vitest";
import {
  InMemoryPlaybackManager,
  InMemorySpeechQueueManager,
  type SpeechAudioResult,
  type SpeechChunk,
} from "../tts";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import type { VoiceOrchestrationTelemetryEvent } from "./types";

function createIdGenerator() {
  let next = 1;
  return () => `id-${next++}`;
}

function speechChunk(id = "chunk-1"): SpeechChunk {
  return {
    id,
    text: "Safe assistant prose for orchestration.",
    index: 0,
    createdAt: 1_000,
    source: "assistant_prose",
  };
}

function audioResult(): SpeechAudioResult {
  return {
    id: "audio-1",
    chunkId: "chunk-1",
    mimeType: "audio/wav",
    durationMs: 200,
    sampleRate: 24_000,
    byteLength: 3,
    createdAt: 1_000,
    source: "local_tts",
    data: new Uint8Array([1, 2, 3]),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("VoiceOrchestrationSupervisor", () => {
  it("enforces a single active voice session", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 1_000,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const first = await supervisor.startSession();
    const second = await supervisor.startSession();

    expect(first).toMatchObject({
      ok: true,
      session: { id: "id-1", state: "idle", active: true },
    });
    expect(second).toEqual({ ok: false, reason: "active_session_exists" });
    expect(supervisor.getState()).toMatchObject({
      activeSessionId: "id-1",
      canAutoplay: false,
    });
    expect(telemetry).toEqual([
      expect.objectContaining({
        eventType: "voice_session_started",
        sessionId: "id-1",
        success: true,
      }),
    ]);
  });

  it("propagates cancellation and cleans queued chunks, synthesis queue, playback, and draft metadata", async () => {
    const speechQueueManager = new InMemorySpeechQueueManager({
      newId: createIdGenerator(),
      now: () => 2_000,
    });
    const playbackManager = new InMemoryPlaybackManager({
      newId: () => "playback-1",
      now: () => 2_000,
    });
    const cancelSynthesis = vi.fn();
    const clearTranscriptDraft = vi.fn();
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 2_000,
      speechQueueManager,
      playbackManager,
      cancelSynthesis,
      clearTranscriptDraft,
    });

    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");
    const signal = started.signal;
    supervisor.recordTranscriptDraft({
      sessionId: started.session.id,
      draftId: "draft-1",
      transcriptionJobId: "job-1",
    });
    const chunk = supervisor.recordResponseChunk({
      sessionId: started.session.id,
      speechChunkId: "chunk-1",
      index: 0,
    });
    if (!chunk) throw new Error("Expected chunk metadata");
    const first = speechQueueManager.enqueue(speechChunk("chunk-1"));
    const second = speechQueueManager.enqueue(speechChunk("chunk-2"));
    if (!first.ok || !second.ok) throw new Error("Expected queue items");
    speechQueueManager.startNext();
    supervisor.recordSynthesisQueueItem({
      sessionId: started.session.id,
      chunkId: chunk.id,
      queueItemId: first.item.id,
    });
    speechQueueManager.markReady(first.item.id);
    playbackManager.createFromReadyQueueItem(audioResult(), {
      ...first.item,
      status: "ready",
      completedAt: 2_000,
    });

    const cancelled = await supervisor.cancelSession(started.session.id);

    expect(cancelled).toMatchObject({
      state: "cancelled",
      active: false,
      cancellation: { aborted: true },
    });
    expect(signal.aborted).toBe(true);
    expect(cancelSynthesis).toHaveBeenCalledWith(signal);
    expect(clearTranscriptDraft).toHaveBeenCalledTimes(1);
    expect(speechQueueManager.listItems().map((item) => item.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(playbackManager.getActiveItem()).toBeNull();
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ id: chunk.id, state: "cancelled" }),
    ]);
    expect(supervisor.getState().activeSessionId).toBeNull();
  });

  it("cleans up on timeout and records a failed session", async () => {
    vi.useFakeTimers();
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const cancelSynthesis = vi.fn();
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 5_000,
      timeoutMs: 25,
      cancelSynthesis,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");

    await vi.advanceTimersByTimeAsync(25);

    expect(started.signal.aborted).toBe(true);
    expect(cancelSynthesis).toHaveBeenCalledWith(started.signal);
    expect(supervisor.getSession(started.session.id)).toMatchObject({
      state: "failed",
      active: false,
      cancellation: { aborted: true },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_session_failed",
        sessionId: started.session.id,
        error: "session_timeout",
        success: false,
      }),
    );
  });

  it("still terminates the session when cleanup callbacks fail", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 6_000,
      cancelSynthesis: vi.fn().mockRejectedValue(new Error("secret audio")),
      clearTranscriptDraft: vi
        .fn()
        .mockRejectedValue(new Error("secret transcript")),
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });
    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");

    await expect(
      supervisor.cancelSession(started.session.id),
    ).resolves.toMatchObject({
      state: "cancelled",
      active: false,
      cancellation: { aborted: true },
    });

    expect(supervisor.getState().activeSessionId).toBeNull();
    expect(JSON.stringify(telemetry)).not.toContain("secret audio");
    expect(JSON.stringify(telemetry)).not.toContain("secret transcript");
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_session_cancelled",
        error: "cancelled",
      }),
    );
  });

  it("supports interruption state transitions without autoplay", async () => {
    const speechQueueManager = new InMemorySpeechQueueManager({
      newId: createIdGenerator(),
      now: () => 3_000,
    });
    const playbackManager = new InMemoryPlaybackManager({
      newId: () => "playback-1",
      now: () => 3_000,
    });
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 3_000,
      speechQueueManager,
      playbackManager,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");
    const chunk = supervisor.recordResponseChunk({
      sessionId: started.session.id,
      speechChunkId: "chunk-1",
      index: 0,
    });
    if (!chunk) throw new Error("Expected chunk metadata");
    const enqueued = speechQueueManager.enqueue(speechChunk());
    if (!enqueued.ok) throw new Error("Expected enqueue");
    supervisor.recordSynthesisQueueItem({
      sessionId: started.session.id,
      chunkId: chunk.id,
      queueItemId: enqueued.item.id,
    });
    speechQueueManager.startNext();
    const readyItem = speechQueueManager.markReady(enqueued.item.id);
    if (!readyItem) throw new Error("Expected ready queue item");
    const playback = playbackManager.createFromReadyQueueItem(
      audioResult(),
      readyItem,
    );
    if (!playback.ok) throw new Error("Expected playback item");
    supervisor.markChunkReady({
      sessionId: started.session.id,
      chunkId: chunk.id,
      playbackItemId: playback.item.id,
    });

    expect(playbackManager.getActiveItem()).toMatchObject({ status: "ready" });
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });

    const interrupted = await supervisor.interrupt(started.session.id);

    expect(interrupted).toMatchObject({
      state: "interrupted",
      active: false,
      cancellation: { aborted: true },
    });
    expect(playbackManager.getActiveItem()).toBeNull();
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_orchestration_interrupted",
        error: "interrupted",
      }),
    );
  });

  it("records metadata-only coordination state and never starts playback automatically", async () => {
    const speechQueueManager = new InMemorySpeechQueueManager({
      newId: createIdGenerator(),
      now: () => 4_000,
    });
    const playbackManager = new InMemoryPlaybackManager({
      newId: () => "playback-1",
      now: () => 4_000,
    });
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 4_000,
      speechQueueManager,
      playbackManager,
    });
    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");
    const chunk = supervisor.recordResponseChunk({
      sessionId: started.session.id,
      speechChunkId: "chunk-1",
      index: 0,
    });
    if (!chunk) throw new Error("Expected chunk metadata");
    const enqueued = speechQueueManager.enqueue(speechChunk());
    if (!enqueued.ok) throw new Error("Expected enqueue");
    const readyItem = speechQueueManager.markReady(enqueued.item.id);
    if (!readyItem) throw new Error("Expected ready item");
    const playback = playbackManager.createFromReadyQueueItem(
      audioResult(),
      readyItem,
    );
    if (!playback.ok) throw new Error("Expected playback item");

    supervisor.recordTranscriptDraft({
      sessionId: started.session.id,
      draftId: "draft-1",
      transcriptionJobId: "job-1",
    });
    supervisor.recordSynthesisQueueItem({
      sessionId: started.session.id,
      chunkId: chunk.id,
      queueItemId: enqueued.item.id,
    });
    supervisor.markChunkReady({
      sessionId: started.session.id,
      chunkId: chunk.id,
      playbackItemId: playback.item.id,
    });

    expect(supervisor.getCoordinationMetadata(started.session.id)).toEqual({
      transcriptDraft: {
        id: "draft-1",
        sourceJobId: "job-1",
        status: "draft",
      },
      synthesisQueueItems: [
        { id: enqueued.item.id, chunkId: "chunk-1", status: "ready" },
      ],
      playbackItem: {
        id: "playback-1",
        audioId: "audio-1",
        chunkId: "chunk-1",
        status: "ready",
      },
    });
    expect(playbackManager.getActiveItem()).toMatchObject({ status: "ready" });
    expect(supervisor.getState().canAutoplay).toBe(false);
  });

  it("keeps transcript text, spoken text, and audio bytes out of orchestration telemetry", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator(),
      now: () => 7_000,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });
    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected session to start");

    supervisor.recordTranscriptDraft({
      sessionId: started.session.id,
      draftId: "secret transcript text",
      transcriptionJobId: "job-1",
    });
    supervisor.recordResponseChunk({
      sessionId: started.session.id,
      speechChunkId: "secret spoken text 1,2,3",
      index: 0,
    });
    await supervisor.cancelSession(started.session.id);

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("voice_session_started");
    expect(serialized).toContain("voice_session_cancelled");
    expect(serialized).not.toContain("secret transcript text");
    expect(serialized).not.toContain("secret spoken text");
    expect(serialized).not.toContain("1,2,3");
  });
});
