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
      reason: "stale_turn",
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

  it("drops duplicate chunks before they create duplicate downstream work", async () => {
    const {
      pipeline,
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();

    const first = await pipeline.ingest(chunkEvent(sessionId, 0));
    const duplicate = await pipeline.ingest(chunkEvent(sessionId, 0));

    expect(first).toMatchObject({
      ok: true,
      playbackIntent: { chunkIndex: 0 },
    });
    expect(duplicate).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "duplicate_chunk",
    });
    expect(supervisor.getState().chunks).toHaveLength(1);
    expect(scheduler.getPendingIntents(sessionId)).toHaveLength(1);
    expect(synthesisQueue.getPendingItems(sessionId)).toHaveLength(1);
    expect(playbackSequencer.getPendingIntents(sessionId)).toHaveLength(1);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_duplicate_dropped",
        error: "duplicate_chunk",
        orderingIssue: "duplicate",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_dropped",
        pipelineStage: "scheduler",
        error: "duplicate_chunk",
      }),
    );
  });

  it("handles skipped and out-of-order chunk indexes deterministically without deadlock", async () => {
    const { pipeline, supervisor, telemetry, sessionId } =
      await createHarness();

    const skipped = await pipeline.ingest(chunkEvent(sessionId, 2));
    const outOfOrder = await pipeline.ingest(chunkEvent(sessionId, 0));
    const stillMissingOne = await pipeline.ingest(chunkEvent(sessionId, 3));

    expect(skipped).toMatchObject({
      ok: true,
      playbackIntent: { chunkIndex: 2 },
    });
    expect(outOfOrder).toMatchObject({
      ok: true,
      playbackIntent: { chunkIndex: 0 },
    });
    expect(stillMissingOne).toMatchObject({
      ok: true,
      playbackIntent: { chunkIndex: 3 },
    });
    expect(
      pipeline.getPlaybackIntents(sessionId).map((intent) => intent.chunkIndex),
    ).toEqual([0, 2, 3]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      metadata: { responseChunkCount: 3 },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_gap_detected",
        chunkIndex: 2,
        expectedChunkIndex: 0,
        orderingIssue: "gap",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_out_of_order",
        chunkIndex: 0,
        expectedChunkIndex: 0,
        orderingIssue: "out_of_order",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_gap_detected",
        chunkIndex: 3,
        expectedChunkIndex: 1,
        orderingIssue: "gap",
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
      reason: "stale_turn",
    });
    expect(completed.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_stale_event_rejected",
        orderingIssue: "late",
      }),
    );
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
      reason: "stale_turn",
    });
    expect(failed.supervisor.getSession(failed.sessionId)).toMatchObject({
      state: "failed",
      active: false,
    });
    expect(JSON.stringify(failed.telemetry)).not.toContain(
      "secret assistant body failure",
    );
  });

  it("rejects stale stream events while allowing only the active session to produce downstream intents", async () => {
    const { pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.completeSession(sessionId);
    const next = await supervisor.startSession();
    if (!next.ok) throw new Error("Expected next session to start");

    const stale = await pipeline.ingest({
      ...chunkEvent(sessionId, 0),
      assistantBody: "secret stale assistant body",
    } as unknown as AssistantResponseStreamMetadataEvent);
    const active = await pipeline.ingest(chunkEvent(next.session.id, 0));

    expect(stale).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "stale_turn",
    });
    expect(active).toMatchObject({
      ok: true,
      playbackIntent: { sessionId: next.session.id, chunkIndex: 0 },
    });
    expect(pipeline.getPlaybackIntents(sessionId)).toEqual([]);
    expect(pipeline.getPlaybackIntents(next.session.id)).toEqual([
      expect.objectContaining({ sessionId: next.session.id, chunkIndex: 0 }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_stale_event_rejected",
        sessionId,
        error: "stale_turn",
      }),
    );
    expect(JSON.stringify(telemetry)).not.toContain(
      "secret stale assistant body",
    );
  });

  it("rejects stale synthesis and playback sequencing inputs", async () => {
    const {
      scheduler,
      synthesisQueue,
      playbackSequencer,
      pipeline,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();
    const scheduled = await scheduler.ingest(chunkEvent(sessionId, 0));
    if (!scheduled.ok || !scheduled.intent) {
      throw new Error("Expected scheduled intent");
    }
    const queued = await synthesisQueue.enqueue(scheduled.intent);
    if (!queued.ok) throw new Error("Expected synthesis item");

    await pipeline.completeSession(sessionId);
    const next = await supervisor.startSession();
    if (!next.ok) throw new Error("Expected next session to start");

    expect(await synthesisQueue.enqueue(scheduled.intent)).toEqual({
      ok: false,
      reason: "stale_turn",
    });
    expect(
      await playbackSequencer.sequence({
        type: "synthesis_ready",
        item: queued.item,
        synthesisResultId: "stale-result",
      }),
    ).toEqual({ ok: false, reason: "stale_turn" });
    expect(await pipeline.ingest(chunkEvent(next.session.id, 0))).toMatchObject(
      {
        ok: true,
        playbackIntent: { sessionId: next.session.id },
      },
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_synthesis_queue_item_dropped",
        error: "stale_turn",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_playback_sequence_item_dropped",
        error: "stale_turn",
      }),
    );
  });

  it("treats repeated terminal calls as idempotent no-ops", async () => {
    const cancelled = await createHarness();
    await cancelled.pipeline.ingest(chunkEvent(cancelled.sessionId, 0));
    await cancelled.pipeline.cancelSession(cancelled.sessionId);
    await cancelled.pipeline.cancelSession(cancelled.sessionId);

    const interrupted = await createHarness();
    await interrupted.pipeline.ingest(chunkEvent(interrupted.sessionId, 0));
    await interrupted.pipeline.interrupt(interrupted.sessionId);
    await interrupted.pipeline.interrupt(interrupted.sessionId);

    const completed = await createHarness();
    await completed.pipeline.ingest(chunkEvent(completed.sessionId, 0));
    await completed.pipeline.completeSession(completed.sessionId);
    await completed.pipeline.completeSession(completed.sessionId);

    const failed = await createHarness();
    await failed.pipeline.ingest(chunkEvent(failed.sessionId, 0));
    await failed.pipeline.failSession(failed.sessionId);
    await failed.pipeline.failSession(failed.sessionId);

    expect(cancelled.supervisor.getSession(cancelled.sessionId)).toMatchObject({
      state: "cancelled",
    });
    expect(
      interrupted.supervisor.getSession(interrupted.sessionId),
    ).toMatchObject({
      state: "interrupted",
    });
    expect(completed.supervisor.getSession(completed.sessionId)).toMatchObject({
      state: "completed",
    });
    expect(failed.supervisor.getSession(failed.sessionId)).toMatchObject({
      state: "failed",
    });
    expect(
      cancelled.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "cancel" })]);
    expect(
      interrupted.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "interrupt" })]);
    expect(
      completed.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "complete" })]);
    expect(
      failed.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "fail" })]);
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
