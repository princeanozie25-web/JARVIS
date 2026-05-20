import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoicePlaybackSequencer } from "./playback-sequencer";
import { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceSynthesisOrchestrationQueue } from "./synthesis-queue";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  AssistantResponseStreamMetadataEvent,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function createHarness(
  options: {
    maxScheduledIntents?: number;
    maxSynthesisItems?: number;
    maxPlaybackIntents?: number;
  } = {},
) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: () => 1_000,
  });
  const scheduler = new VoiceResponseChunkScheduler({
    supervisor,
    newId: createIdGenerator("intent"),
    now: () => 2_000,
    maxPendingIntents: options.maxScheduledIntents,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const synthesisQueue = new VoiceSynthesisOrchestrationQueue({
    supervisor,
    newId: createIdGenerator("synthesis"),
    now: () => 3_000,
    maxPendingItems: options.maxSynthesisItems,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const playbackSequencer = new VoicePlaybackSequencer({
    supervisor,
    newId: createIdGenerator("playback"),
    now: () => 4_000,
    maxPendingIntents: options.maxPlaybackIntents,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const pipeline = new VoiceRealtimeOrchestrationPipeline({
    supervisor,
    scheduler,
    synthesisQueue,
    playbackSequencer,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  return {
    pipeline,
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

describe("VoiceRealtimeOrchestrationPipeline", () => {
  it("turns stream metadata into playback intents in order", async () => {
    const { pipeline, supervisor, telemetry, sessionId } =
      await createHarness();

    await pipeline.ingest({
      type: "response_started",
      sessionId,
      streamId: "stream-1",
      responseId: "response-1",
    });
    const second = await pipeline.ingest(chunkEvent(sessionId, 1));
    const first = await pipeline.ingest(chunkEvent(sessionId, 0));

    expect(second).toMatchObject({
      ok: true,
      playbackIntent: { id: "playback-1", chunkIndex: 1 },
    });
    expect(first).toMatchObject({
      ok: true,
      playbackIntent: { id: "playback-2", chunkIndex: 0 },
    });
    expect(
      pipeline.getPlaybackIntents(sessionId).map((intent) => intent.chunkIndex),
    ).toEqual([0, 1]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "ready_to_play",
      metadata: {
        responseChunkCount: 2,
        synthesisQueueItemIds: ["synthesis-1", "synthesis-2"],
        playbackItemId: "playback-2",
      },
    });
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_started",
        success: true,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_playback_intent_created",
        playbackIntentId: "playback-2",
        pipelineStage: "playback_sequence",
      }),
    );
  });

  it("fans cancellation out across all stages", async () => {
    const {
      pipeline,
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));
    await pipeline.ingest(chunkEvent(sessionId, 1));

    await pipeline.cancelSession(sessionId);
    const afterCancel = await pipeline.ingest(chunkEvent(sessionId, 2));

    expect(afterCancel).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "session_terminal",
    });
    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(scheduler.getClearedIntents(sessionId)).toHaveLength(2);
    expect(synthesisQueue.getClearedItems(sessionId)).toHaveLength(2);
    expect(playbackSequencer.getClearedIntents(sessionId)).toHaveLength(2);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "cancelled",
      cancellation: { aborted: true },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_cancelled",
        success: false,
      }),
    );
  });

  it("fans interruption out and clears pending work across all stages", async () => {
    const {
      pipeline,
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));
    await pipeline.ingest(chunkEvent(sessionId, 1));

    await pipeline.interrupt(sessionId);

    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(
      playbackSequencer
        .getClearedIntents(sessionId)
        .map((intent) => intent.state),
    ).toEqual(["interrupted", "interrupted"]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      cancellation: { aborted: true },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_interrupted",
        success: false,
      }),
    );
  });

  it("handles backpressure safely at scheduler, synthesis, and playback stages", async () => {
    const schedulerHarness = await createHarness({ maxScheduledIntents: 1 });
    await schedulerHarness.pipeline.ingest(
      chunkEvent(schedulerHarness.sessionId, 0),
    );
    expect(
      await schedulerHarness.pipeline.ingest(
        chunkEvent(schedulerHarness.sessionId, 1),
      ),
    ).toEqual({ ok: false, stage: "scheduler", reason: "overflow" });

    const synthesisHarness = await createHarness({ maxSynthesisItems: 0 });
    expect(
      await synthesisHarness.pipeline.ingest(
        chunkEvent(synthesisHarness.sessionId, 0),
      ),
    ).toEqual({ ok: false, stage: "synthesis_queue", reason: "overflow" });
    expect(synthesisHarness.playbackSequencer.getPendingIntents()).toEqual([]);

    const playbackHarness = await createHarness({ maxPlaybackIntents: 0 });
    expect(
      await playbackHarness.pipeline.ingest(
        chunkEvent(playbackHarness.sessionId, 0),
      ),
    ).toEqual({ ok: false, stage: "playback_sequence", reason: "overflow" });
    expect(playbackHarness.pipeline.getPlaybackIntents()).toEqual([]);

    expect(schedulerHarness.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_dropped",
        pipelineStage: "scheduler",
        error: "overflow",
      }),
    );
    expect(synthesisHarness.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_dropped",
        pipelineStage: "synthesis_queue",
        error: "overflow",
      }),
    );
    expect(playbackHarness.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_dropped",
        pipelineStage: "playback_sequence",
        error: "overflow",
      }),
    );
  });

  it("handles completed and failed terminal states without leaking new work", async () => {
    const completed = await createHarness();
    await completed.pipeline.ingest(chunkEvent(completed.sessionId, 0));
    await completed.pipeline.ingest({
      type: "response_completed",
      sessionId: completed.sessionId,
      streamId: "stream-1",
      responseId: "response-1",
      chunkCount: 1,
    });
    const afterComplete = await completed.pipeline.ingest(
      chunkEvent(completed.sessionId, 1),
    );

    expect(afterComplete).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "session_terminal",
    });
    expect(completed.supervisor.getSession(completed.sessionId)).toMatchObject({
      state: "completed",
      active: false,
    });

    const failed = await createHarness();
    const failure = await failed.pipeline.ingest({
      type: "response_failed",
      sessionId: failed.sessionId,
      streamId: "stream-1",
      responseId: "response-1",
      error: "secret assistant body failure",
    });
    const afterFailure = await failed.pipeline.ingest(
      chunkEvent(failed.sessionId, 0),
    );

    expect(failure).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "response_failed",
    });
    expect(afterFailure).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "session_terminal",
    });
    expect(failed.supervisor.getSession(failed.sessionId)).toMatchObject({
      state: "failed",
      active: false,
    });
    expect(JSON.stringify(failed.telemetry)).not.toContain(
      "secret assistant body failure",
    );
  });

  it("keeps transcript, spoken, assistant body, and audio payloads out of telemetry", async () => {
    const { pipeline, telemetry, sessionId } = await createHarness();
    const unsafeEvent = {
      ...chunkEvent(sessionId, 0),
      transcript: "secret transcript payload",
      spokenText: "secret spoken payload",
      assistantBody: "secret assistant body payload",
      audio: "secret audio payload",
    } as unknown as AssistantResponseStreamMetadataEvent;

    await pipeline.ingest(unsafeEvent);
    await pipeline.ingest({
      type: "response_failed",
      sessionId,
      streamId: "stream-1",
      responseId: "response-1",
      error: "secret spoken failure",
    });

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain(
      "voice_realtime_pipeline_playback_intent_created",
    );
    expect(serialized).toContain("voice_realtime_pipeline_failed");
    expect(serialized).not.toContain("secret transcript payload");
    expect(serialized).not.toContain("secret spoken payload");
    expect(serialized).not.toContain("secret assistant body payload");
    expect(serialized).not.toContain("secret audio payload");
    expect(serialized).not.toContain("secret spoken failure");
  });

  it("does not introduce autoplay, live chat, command, Realtime API, or cloud wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/pipeline.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /autoplay|InMemoryPlaybackManager|tts_playback/i,
    );
    expect(source).not.toMatch(/\/api\/chat|app\/page|fetch\(/);
    expect(source).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(source).not.toMatch(/runTool|toolRuntime|submitApproval/);
    expect(source).not.toMatch(/createFromReadyQueueItem|play\(/);
    expect(source).not.toMatch(/cloud/i);
  });
});
