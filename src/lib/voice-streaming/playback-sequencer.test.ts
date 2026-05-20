import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoicePlaybackSequencer } from "./playback-sequencer";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceSynthesisOrchestrationQueue } from "./synthesis-queue";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  AssistantResponseStreamMetadataEvent,
  ChunkSchedulingIntent,
  VoiceOrchestrationTelemetryEvent,
  VoiceSynthesisQueueItem,
  VoiceSynthesisQueueItemResult,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function createHarness(options: { maxPendingIntents?: number } = {}) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: () => 1_000,
  });
  const scheduler = new VoiceResponseChunkScheduler({
    supervisor,
    newId: createIdGenerator("intent"),
    now: () => 2_000,
  });
  const synthesisQueue = new VoiceSynthesisOrchestrationQueue({
    supervisor,
    newId: createIdGenerator("synthesis"),
    now: () => 3_000,
  });
  const playbackSequencer = new VoicePlaybackSequencer({
    supervisor,
    newId: createIdGenerator("playback"),
    now: () => 4_000,
    maxPendingIntents: options.maxPendingIntents,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  return {
    scheduler,
    synthesisQueue,
    playbackSequencer,
    supervisor,
    telemetry,
    sessionId: started.session.id,
  };
}

function chunkEvent(
  sessionId: string,
  index: number,
): Extract<AssistantResponseStreamMetadataEvent, { type: "chunk_available" }> {
  return {
    type: "chunk_available",
    sessionId,
    streamId: "stream-1",
    responseId: "response-1",
    chunkId: `assistant-chunk-${index}`,
    index,
  };
}

async function scheduleIntent(
  scheduler: VoiceResponseChunkScheduler,
  sessionId: string,
  index: number,
): Promise<ChunkSchedulingIntent> {
  const result = await scheduler.ingest(chunkEvent(sessionId, index));
  if (!result.ok || !result.intent) {
    throw new Error("Expected scheduled chunk intent");
  }
  return result.intent;
}

async function enqueueSynthesisItem(
  scheduler: VoiceResponseChunkScheduler,
  synthesisQueue: VoiceSynthesisOrchestrationQueue,
  sessionId: string,
  index: number,
): Promise<VoiceSynthesisQueueItem> {
  const intent = await scheduleIntent(scheduler, sessionId, index);
  const result = await synthesisQueue.enqueue(intent);
  if (!result.ok) {
    throw new Error("Expected synthesis queue item");
  }
  return result.item;
}

describe("VoicePlaybackSequencer", () => {
  it("converts synthesis items and results into playback intents in chunk order", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    const firstItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );
    const secondItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      1,
    );

    const second = await playbackSequencer.sequence({
      type: "synthesis_ready",
      item: secondItem,
      synthesisResultId: "result-2",
    });
    const first = await playbackSequencer.sequence(firstItem);

    expect(second).toMatchObject({
      ok: true,
      intent: {
        id: "playback-1",
        synthesisQueueItemId: "synthesis-2",
        chunkIndex: 1,
        state: "sequenced",
      },
    });
    expect(first).toMatchObject({
      ok: true,
      intent: {
        id: "playback-2",
        synthesisQueueItemId: "synthesis-1",
        chunkIndex: 0,
        state: "sequenced",
      },
    });
    expect(
      playbackSequencer
        .getPendingIntents(sessionId)
        .map((intent) => intent.chunkIndex),
    ).toEqual([0, 1]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "ready_to_play",
    });
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({
        index: 0,
        state: "ready_to_play",
        playbackItemId: "playback-2",
      }),
      expect.objectContaining({
        index: 1,
        state: "ready_to_play",
        playbackItemId: "playback-1",
      }),
    ]);
    expect(
      playbackSequencer.getPendingIntents(sessionId)[0],
    ).not.toHaveProperty("text");
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "voice_playback_sequence_intent_created",
      "voice_playback_sequence_intent_created",
    ]);
  });

  it("propagates cancellation and prevents future playback sequencing", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    const firstItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );
    const secondItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      1,
    );

    await playbackSequencer.sequence(firstItem);
    await playbackSequencer.cancelSession(sessionId);
    const afterCancel = await playbackSequencer.sequence(secondItem);

    expect(afterCancel).toEqual({ ok: false, reason: "session_terminal" });
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(playbackSequencer.getClearedIntents(sessionId)).toEqual([
      expect.objectContaining({ id: "playback-1", state: "cancelled" }),
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "cancelled",
      cancellation: { aborted: true },
    });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "cancelled" }),
      expect.objectContaining({ index: 1, state: "cancelled" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_playback_sequence_cancelled",
        clearedPlaybackIntentCount: 1,
        pendingPlaybackIntentCount: 0,
      }),
    );
  });

  it("propagates interruption and clears pending playback work", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    const firstItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );
    const secondItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      1,
    );

    await playbackSequencer.sequence(firstItem);
    await playbackSequencer.sequence(secondItem);
    await playbackSequencer.interrupt(sessionId);

    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(
      playbackSequencer.getClearedIntents(sessionId).map((intent) => ({
        index: intent.chunkIndex,
        state: intent.state,
      })),
    ).toEqual([
      { index: 0, state: "interrupted" },
      { index: 1, state: "interrupted" },
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      cancellation: { aborted: true },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_playback_sequence_interrupted",
        clearedPlaybackIntentCount: 2,
        pendingPlaybackIntentCount: 0,
      }),
    );
  });

  it("handles overflow without creating extra playback intents", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness({ maxPendingIntents: 1 });
    const firstItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );
    const secondItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      1,
    );

    await playbackSequencer.sequence(firstItem);
    const overflow = await playbackSequencer.sequence(secondItem);

    expect(overflow).toEqual({ ok: false, reason: "overflow" });
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([
      expect.objectContaining({ id: "playback-1", chunkIndex: 0 }),
    ]);
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "ready_to_play" }),
      expect.objectContaining({ index: 1, state: "synthesizing" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_playback_sequence_overflow",
        success: false,
        error: "overflow",
        pendingPlaybackIntentCount: 1,
        maxPendingPlaybackIntents: 1,
      }),
    );
  });

  it("drops failed and missing synthesis results without breaking sequencing", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    const validItem = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );

    const failed = await playbackSequencer.sequence({
      type: "synthesis_failed",
      item: validItem,
      sessionId,
      error: "secret assistant body failure",
    });
    const missing = await playbackSequencer.sequence({
      type: "synthesis_failed",
      sessionId,
      queueItemId: "missing-item",
      streamId: "stream-1",
      responseId: "response-1",
      error: "secret transcript failure",
    });
    const fakeMissingChunk = await playbackSequencer.sequence({
      ...validItem,
      id: "missing-chunk-item",
      orchestrationChunkId: "missing-chunk",
    });

    expect(failed).toEqual({ ok: false, reason: "synthesis_failed" });
    expect(missing).toEqual({ ok: false, reason: "missing_synthesis_item" });
    expect(fakeMissingChunk).toEqual({
      ok: false,
      reason: "orchestration_chunk_not_found",
    });
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "synthesizing" }),
    ]);
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "voice_playback_sequence_item_dropped",
      "voice_playback_sequence_item_dropped",
      "voice_playback_sequence_item_dropped",
    ]);
  });

  it("keeps transcript, spoken, assistant body, and audio payloads out of telemetry", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      telemetry,
      sessionId,
    } = await createHarness();
    const item = await enqueueSynthesisItem(
      scheduler,
      synthesisQueue,
      sessionId,
      0,
    );
    const unsafeResult = {
      type: "synthesis_ready",
      item: {
        ...item,
        assistantResponseChunkId: "secret assistant body payload",
      },
      synthesisResultId: "safe-result-id",
      transcript: "secret transcript payload",
      spokenText: "secret spoken payload",
      assistantBody: "secret assistant body payload",
      audio: "secret audio payload",
    } as unknown as VoiceSynthesisQueueItemResult;

    await playbackSequencer.sequence(unsafeResult);
    await playbackSequencer.sequence({
      type: "synthesis_failed",
      sessionId,
      queueItemId: "missing-item",
      streamId: "stream-1",
      error: "secret spoken failure",
    });

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("voice_playback_sequence_intent_created");
    expect(serialized).toContain("voice_playback_sequence_item_dropped");
    expect(serialized).not.toContain("secret transcript payload");
    expect(serialized).not.toContain("secret spoken payload");
    expect(serialized).not.toContain("secret assistant body payload");
    expect(serialized).not.toContain("secret audio payload");
    expect(serialized).not.toContain("secret spoken failure");
  });

  it("does not introduce autoplay, live chat, command, Realtime, or cloud wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/playback-sequencer.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /autoplay|InMemoryPlaybackManager|tts_playback/i,
    );
    expect(source).not.toMatch(/\/api\/chat|app\/page|fetch\(/);
    expect(source).not.toMatch(/OpenAI|Realtime|chat\.completions/);
    expect(source).not.toMatch(/runTool|toolRuntime|submitApproval/);
    expect(source).not.toMatch(/createFromReadyQueueItem|start|play\(/);
  });
});
