import { readdirSync, readFileSync } from "node:fs";
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
    now?: () => number;
    readinessTimeoutMs?: number;
    beforeTelemetry?: (
      event: VoiceOrchestrationTelemetryEvent,
    ) => void | Promise<void>;
  } = {},
) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const recordTelemetry = async (event: VoiceOrchestrationTelemetryEvent) => {
    await options.beforeTelemetry?.(event);
    telemetry.push(event);
  };
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: () => 1_000,
  });
  const scheduler = new VoiceResponseChunkScheduler({
    supervisor,
    newId: createIdGenerator("intent"),
    now: () => 2_000,
    maxPendingIntents: options.maxScheduledIntents,
    emitTelemetry: recordTelemetry,
  });
  const synthesisQueue = new VoiceSynthesisOrchestrationQueue({
    supervisor,
    newId: createIdGenerator("synthesis"),
    now: () => 3_000,
    maxPendingItems: options.maxSynthesisItems,
    emitTelemetry: recordTelemetry,
  });
  const playbackSequencer = new VoicePlaybackSequencer({
    supervisor,
    newId: createIdGenerator("playback"),
    now: () => 4_000,
    maxPendingIntents: options.maxPlaybackIntents,
    emitTelemetry: recordTelemetry,
  });
  const pipeline = new VoiceRealtimeOrchestrationPipeline({
    supervisor,
    scheduler,
    synthesisQueue,
    playbackSequencer,
    now: options.now,
    readinessTimeoutMs: options.readinessTimeoutMs,
    emitTelemetry: recordTelemetry,
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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function assertTelemetryHygiene(
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify(telemetry);
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret audio payload");
}

function readVoiceStreamingImplementationSources(): string {
  const dir = join(process.cwd(), "src/lib/voice-streaming");
  return readdirSync(dir)
    .filter(
      (fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"),
    )
    .map((fileName) => readFileSync(join(dir, fileName), "utf8"))
    .join("\n");
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

  it("tracks chunk readiness and latency metadata across pipeline stages", async () => {
    const { pipeline, supervisor, telemetry, sessionId } =
      await createHarness();

    await pipeline.ingest(chunkEvent(sessionId, 0));

    expect(pipeline.getChunkReadiness(sessionId)).toEqual([
      expect.objectContaining({
        sessionId,
        chunkIndex: 0,
        state: "ready_to_play",
        terminal: false,
        blocked: false,
        firstReady: true,
        timestamps: expect.objectContaining({
          scheduledAt: 2_000,
          queuedAt: 3_000,
          synthesizedAt: 4_000,
          readyToPlayAt: 4_000,
        }),
      }),
    ]);
    expect(pipeline.getFirstReadyChunk(sessionId)).toEqual(
      expect.objectContaining({
        chunkIndex: 0,
        state: "ready_to_play",
        firstReady: true,
      }),
    );
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    expect(
      telemetry
        .filter(
          (event) =>
            event.eventType === "voice_realtime_chunk_readiness_changed",
        )
        .map((event) => event.readinessState),
    ).toEqual(["scheduled", "queued", "synthesized", "ready_to_play"]);
    expect(
      telemetry
        .filter(
          (event) => event.eventType === "voice_realtime_stage_latency_marker",
        )
        .map((event) => [event.latencyStage, event.latencyMs]),
    ).toEqual([
      ["scheduled", 0],
      ["queued", 1_000],
      ["synthesized", 1_000],
      ["ready_to_play", 0],
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_first_chunk_ready",
        chunkIndex: 0,
        readinessState: "ready_to_play",
        firstReady: true,
      }),
    );
  });

  it("handles rapid metadata-only chunk streams deterministically", async () => {
    const { pipeline, supervisor, telemetry, sessionId } = await createHarness({
      maxScheduledIntents: 64,
      maxSynthesisItems: 64,
      maxPlaybackIntents: 64,
    });

    const results = await Promise.all(
      Array.from({ length: 32 }, (_, index) =>
        pipeline.ingest({
          ...chunkEvent(sessionId, index),
          transcript: "secret transcript payload",
          spokenText: "secret spoken payload",
          assistantBody: "secret assistant body payload",
          audio: "secret audio payload",
        } as unknown as AssistantResponseStreamMetadataEvent),
      ),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(
      pipeline.getPlaybackIntents(sessionId).map((intent) => intent.chunkIndex),
    ).toEqual(Array.from({ length: 32 }, (_, index) => index));
    expect(
      pipeline
        .getChunkReadiness(sessionId)
        .map((record) => [record.chunkIndex, record.state]),
    ).toEqual(
      Array.from({ length: 32 }, (_, index) => [index, "ready_to_play"]),
    );
    expect(pipeline.getFirstReadyChunk(sessionId)).toMatchObject({
      chunkIndex: 0,
      firstReady: true,
    });
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    assertTelemetryHygiene(telemetry);
  });

  it("tracks earliest ready chunk deterministically without autoplay", async () => {
    const { pipeline, supervisor, telemetry, sessionId } =
      await createHarness();

    await pipeline.ingest(chunkEvent(sessionId, 2));

    expect(
      pipeline
        .getChunkReadiness(sessionId)
        .map((record) => [record.chunkIndex, record.state]),
    ).toEqual([
      [0, "blocked"],
      [1, "blocked"],
      [2, "ready_to_play"],
    ]);
    expect(pipeline.getFirstReadyChunk(sessionId)).toMatchObject({
      chunkIndex: 2,
      firstReady: true,
    });

    await pipeline.ingest(chunkEvent(sessionId, 0));

    expect(
      pipeline
        .getChunkReadiness(sessionId)
        .map((record) => [record.chunkIndex, record.state, record.firstReady]),
    ).toEqual([
      [0, "ready_to_play", true],
      [1, "blocked", false],
      [2, "ready_to_play", false],
    ]);
    expect(pipeline.getFirstReadyChunk(sessionId)).toMatchObject({
      chunkIndex: 0,
      firstReady: true,
    });
    expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    expect(
      telemetry
        .filter(
          (event) => event.eventType === "voice_realtime_first_chunk_ready",
        )
        .map((event) => event.chunkIndex),
    ).toEqual([2, 0]);
  });

  it("detects readiness starvation only when manually checked", async () => {
    const now = 1_000;
    const { pipeline, telemetry, sessionId } = await createHarness({
      now: () => now,
      readinessTimeoutMs: 500,
    });

    await pipeline.ingest(chunkEvent(sessionId, 2));
    expect(await pipeline.detectReadinessTimeouts(sessionId, 1_200)).toEqual(
      [],
    );

    const timedOut = await pipeline.detectReadinessTimeouts(sessionId, 1_600);
    const repeated = await pipeline.detectReadinessTimeouts(sessionId, 1_700);

    expect(timedOut.map((record) => record.chunkIndex)).toEqual([0, 1]);
    expect(repeated).toEqual([]);
    expect(
      telemetry.filter(
        (event) => event.eventType === "voice_realtime_chunk_readiness_timeout",
      ),
    ).toEqual([
      expect.objectContaining({
        chunkIndex: 0,
        readinessState: "blocked",
        readinessTimeoutMs: 500,
        starvationAgeMs: 600,
      }),
      expect.objectContaining({
        chunkIndex: 1,
        readinessState: "blocked",
        readinessTimeoutMs: 500,
        starvationAgeMs: 600,
      }),
    ]);
    expect(JSON.stringify(telemetry)).not.toContain("transcript");
    expect(JSON.stringify(telemetry)).not.toContain("spoken");
    expect(JSON.stringify(telemetry)).not.toContain("assistant body");
    expect(JSON.stringify(telemetry)).not.toContain("audio payload");
  });

  it("rejects downstream work when terminal races happen during stage awaits", async () => {
    const cases = [
      {
        terminalAction: "cancel",
        terminalState: "cancelled",
        gateEvent: "voice_response_chunk_scheduled",
        expectedStage: "scheduler",
      },
      {
        terminalAction: "interrupt",
        terminalState: "interrupted",
        gateEvent: "voice_synthesis_queue_item_enqueued",
        expectedStage: "synthesis_queue",
      },
      {
        terminalAction: "fail",
        terminalState: "failed",
        gateEvent: "voice_synthesis_queue_item_enqueued",
        expectedStage: "synthesis_queue",
      },
      {
        terminalAction: "complete",
        terminalState: "completed",
        gateEvent: "voice_playback_sequence_intent_created",
        expectedStage: "playback_sequence",
      },
    ] as const;

    for (const testCase of cases) {
      const reachedGate = createDeferred();
      const releaseGate = createDeferred();
      let gated = false;
      const {
        pipeline,
        scheduler,
        synthesisQueue,
        playbackSequencer,
        supervisor,
        sessionId,
      } = await createHarness({
        beforeTelemetry: async (event) => {
          if (!gated && event.eventType === testCase.gateEvent) {
            gated = true;
            reachedGate.resolve();
            await releaseGate.promise;
          }
        },
      });

      const ingesting = pipeline.ingest(chunkEvent(sessionId, 0));
      await reachedGate.promise;
      if (testCase.terminalAction === "cancel") {
        await pipeline.cancelSession(sessionId);
      } else if (testCase.terminalAction === "interrupt") {
        await pipeline.interrupt(sessionId);
      } else if (testCase.terminalAction === "fail") {
        await pipeline.failSession(sessionId);
      } else {
        await pipeline.completeSession(sessionId);
      }
      releaseGate.resolve();

      await expect(ingesting).resolves.toEqual({
        ok: false,
        stage: testCase.expectedStage,
        reason: "stale_turn",
      });
      expect(supervisor.getSession(sessionId)).toMatchObject({
        state: testCase.terminalState,
        active: false,
      });
      expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
      expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
      expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
      expect(pipeline.getPlaybackIntents(sessionId)).toEqual([]);
      expect(
        pipeline
          .getChunkReadiness(sessionId)
          .every((record) => record.state === "terminal"),
      ).toBe(true);
      expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    }
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
    expect(
      telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_started",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "cancel",
        pendingIntentCount: 2,
        pendingSynthesisItemCount: 2,
        pendingPlaybackIntentCount: 2,
      }),
    ]);
    expect(
      telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_fanout_completed",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "cancel",
        clearedIntentCount: 2,
        clearedSynthesisItemCount: 2,
        clearedPlaybackIntentCount: 2,
        pendingIntentCount: 0,
        pendingSynthesisItemCount: 0,
        pendingPlaybackIntentCount: 0,
      }),
    ]);
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
    expect(
      telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_started",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "interrupt",
        pendingIntentCount: 2,
        pendingSynthesisItemCount: 2,
        pendingPlaybackIntentCount: 2,
      }),
    ]);
    expect(
      telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_fanout_completed",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "interrupt",
        clearedIntentCount: 2,
        clearedSynthesisItemCount: 2,
        clearedPlaybackIntentCount: 2,
      }),
    ]);
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

  it("fails closed and clears pending work when a stage fails", async () => {
    const cases = [
      {
        options: { maxScheduledIntents: 1 },
        expected: {
          stage: "scheduler",
          reason: "overflow",
          failureClass: "scheduler",
          failureReason: "scheduler_overflow",
          clearedIntentCount: 1,
          clearedSynthesisItemCount: 1,
          clearedPlaybackIntentCount: 1,
        },
      },
      {
        options: { maxSynthesisItems: 1 },
        expected: {
          stage: "synthesis_queue",
          reason: "overflow",
          failureClass: "synthesis_queue",
          failureReason: "synthesis_queue_overflow",
          clearedIntentCount: 2,
          clearedSynthesisItemCount: 1,
          clearedPlaybackIntentCount: 1,
        },
      },
      {
        options: { maxPlaybackIntents: 1 },
        expected: {
          stage: "playback_sequence",
          reason: "overflow",
          failureClass: "playback_sequence",
          failureReason: "playback_sequence_overflow",
          clearedIntentCount: 2,
          clearedSynthesisItemCount: 2,
          clearedPlaybackIntentCount: 1,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const {
        pipeline,
        scheduler,
        synthesisQueue,
        playbackSequencer,
        supervisor,
        telemetry,
        sessionId,
      } = await createHarness(testCase.options);
      await pipeline.ingest(chunkEvent(sessionId, 0));

      expect(await pipeline.ingest(chunkEvent(sessionId, 1))).toEqual({
        ok: false,
        stage: testCase.expected.stage,
        reason: testCase.expected.reason,
      });
      expect(supervisor.getSession(sessionId)).toMatchObject({
        state: "failed",
        active: false,
      });
      expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
      expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
      expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
      expect(
        pipeline
          .getChunkReadiness(sessionId)
          .every((record) => record.state === "terminal"),
      ).toBe(true);
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_realtime_pipeline_terminal_completed",
          terminalAction: "fail",
          failureClass: testCase.expected.failureClass,
          failureReason: testCase.expected.failureReason,
          clearedIntentCount: testCase.expected.clearedIntentCount,
          clearedSynthesisItemCount:
            testCase.expected.clearedSynthesisItemCount,
          clearedPlaybackIntentCount:
            testCase.expected.clearedPlaybackIntentCount,
        }),
      );
    }
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

  it("handles mixed duplicate, skipped, out-of-order, late, and overflow events safely", async () => {
    const {
      pipeline,
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness({
      maxScheduledIntents: 4,
      maxSynthesisItems: 8,
      maxPlaybackIntents: 8,
    });

    const skipped = await pipeline.ingest(chunkEvent(sessionId, 2));
    const outOfOrderZero = await pipeline.ingest(chunkEvent(sessionId, 0));
    const duplicate = await pipeline.ingest(chunkEvent(sessionId, 2));
    const outOfOrderOne = await pipeline.ingest(chunkEvent(sessionId, 1));
    const gap = await pipeline.ingest(chunkEvent(sessionId, 4));
    const overflow = await pipeline.ingest(chunkEvent(sessionId, 3));
    const late = await pipeline.ingest(chunkEvent(sessionId, 5));

    expect(skipped).toMatchObject({ ok: true });
    expect(outOfOrderZero).toMatchObject({ ok: true });
    expect(duplicate).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "duplicate_chunk",
    });
    expect(outOfOrderOne).toMatchObject({ ok: true });
    expect(gap).toMatchObject({ ok: true });
    expect(overflow).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "overflow",
    });
    expect(late).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "stale_turn",
    });
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "failed",
      active: false,
    });
    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(supervisor.getState().chunks).toHaveLength(4);
    expect(
      pipeline
        .getChunkReadiness(sessionId)
        .map((record) => [record.chunkIndex, record.state]),
    ).toEqual([
      [0, "terminal"],
      [1, "terminal"],
      [2, "terminal"],
      [3, "terminal"],
      [4, "terminal"],
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_duplicate_dropped",
        orderingIssue: "duplicate",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_gap_detected",
        orderingIssue: "gap",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_out_of_order",
        orderingIssue: "out_of_order",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_terminal_completed",
        terminalAction: "fail",
        failureClass: "scheduler",
        failureReason: "scheduler_overflow",
      }),
    );
    assertTelemetryHygiene(telemetry);
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

  it("rejects late stage completions after cancellation and interruption fanout", async () => {
    for (const terminalAction of ["cancel", "interrupt"] as const) {
      const {
        scheduler,
        synthesisQueue,
        playbackSequencer,
        pipeline,
        telemetry,
        sessionId,
      } = await createHarness();
      const scheduled = await scheduler.ingest(chunkEvent(sessionId, 0));
      if (!scheduled.ok || !scheduled.intent) {
        throw new Error("Expected scheduled intent");
      }
      const queued = await synthesisQueue.enqueue(scheduled.intent);
      if (!queued.ok) throw new Error("Expected synthesis item");
      const sequenced = await playbackSequencer.sequence({
        type: "synthesis_ready",
        item: queued.item,
        synthesisResultId: "initial-result",
      });
      if (!sequenced.ok) throw new Error("Expected playback intent");

      if (terminalAction === "cancel") {
        await pipeline.cancelSession(sessionId);
      } else {
        await pipeline.interrupt(sessionId);
      }

      expect(await scheduler.ingest(chunkEvent(sessionId, 1))).toEqual({
        ok: false,
        reason: "stale_turn",
      });
      expect(await synthesisQueue.enqueue(scheduled.intent)).toEqual({
        ok: false,
        reason: "stale_turn",
      });
      expect(
        await playbackSequencer.sequence({
          type: "synthesis_ready",
          item: queued.item,
          synthesisResultId: "late-result",
        }),
      ).toEqual({ ok: false, reason: "stale_turn" });
      expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
      expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
      expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
      expect(scheduler.getClearedIntents(sessionId)).toHaveLength(1);
      expect(synthesisQueue.getClearedItems(sessionId)).toHaveLength(1);
      expect(playbackSequencer.getClearedIntents(sessionId)).toHaveLength(1);
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_realtime_pipeline_fanout_completed",
          terminalAction,
          clearedIntentCount: 1,
          clearedSynthesisItemCount: 1,
          clearedPlaybackIntentCount: 1,
        }),
      );
    }
  });

  it("rejects late work after every terminal lifecycle state", async () => {
    for (const terminalAction of [
      "complete",
      "fail",
      "cancel",
      "interrupt",
    ] as const) {
      const {
        scheduler,
        synthesisQueue,
        playbackSequencer,
        pipeline,
        sessionId,
      } = await createHarness();
      const scheduled = await scheduler.ingest(chunkEvent(sessionId, 0));
      if (!scheduled.ok || !scheduled.intent) {
        throw new Error("Expected scheduled intent");
      }
      const queued = await synthesisQueue.enqueue(scheduled.intent);
      if (!queued.ok) throw new Error("Expected synthesis item");

      if (terminalAction === "complete") {
        await pipeline.completeSession(sessionId);
      } else if (terminalAction === "fail") {
        await pipeline.failSession(sessionId);
      } else if (terminalAction === "cancel") {
        await pipeline.cancelSession(sessionId);
      } else {
        await pipeline.interrupt(sessionId);
      }

      expect(await pipeline.ingest(chunkEvent(sessionId, 1))).toEqual({
        ok: false,
        stage: "scheduler",
        reason: "stale_turn",
      });
      expect(await scheduler.ingest(chunkEvent(sessionId, 2))).toEqual({
        ok: false,
        reason: "stale_turn",
      });
      expect(await synthesisQueue.enqueue(scheduled.intent)).toEqual({
        ok: false,
        reason: "stale_turn",
      });
      expect(
        await playbackSequencer.sequence({
          type: "synthesis_ready",
          item: queued.item,
          synthesisResultId: "late-result",
        }),
      ).toEqual({ ok: false, reason: "stale_turn" });
      expect(pipeline.getPlaybackIntents(sessionId)).toEqual([]);
    }
  });

  it("keeps readiness terminal and first-ready cleared across all terminal outcomes", async () => {
    for (const terminalAction of [
      "complete",
      "fail",
      "cancel",
      "interrupt",
    ] as const) {
      const { pipeline, supervisor, sessionId } = await createHarness();
      await pipeline.ingest(chunkEvent(sessionId, 0));
      await pipeline.ingest(chunkEvent(sessionId, 1));

      if (terminalAction === "complete") {
        await pipeline.completeSession(sessionId);
      } else if (terminalAction === "fail") {
        await pipeline.failSession(sessionId);
      } else if (terminalAction === "cancel") {
        await pipeline.cancelSession(sessionId);
      } else {
        await pipeline.interrupt(sessionId);
      }

      expect(
        pipeline
          .getChunkReadiness(sessionId)
          .map((record) => [
            record.chunkIndex,
            record.state,
            record.firstReady,
          ]),
      ).toEqual([
        [0, "terminal", false],
        [1, "terminal", false],
      ]);
      expect(pipeline.getFirstReadyChunk(sessionId)).toBeNull();
      expect(supervisor.getState()).toMatchObject({ canAutoplay: false });
    }
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
      cancelled.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_started",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "cancel" })]);
    expect(
      cancelled.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_fanout_completed",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "cancel" })]);
    expect(
      cancelled.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "cancel" })]);
    expect(
      interrupted.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "interrupt" })]);
    expect(
      interrupted.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_started",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "interrupt" })]);
    expect(
      interrupted.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_fanout_completed",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "interrupt" })]);
    expect(
      interrupted.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_fanout_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "interrupt" })]);
    expect(
      completed.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "complete" })]);
    expect(
      completed.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_terminal_started",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "complete" })]);
    expect(
      completed.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_terminal_completed",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "complete",
        clearedIntentCount: 1,
        clearedSynthesisItemCount: 1,
        clearedPlaybackIntentCount: 1,
      }),
    ]);
    expect(
      failed.telemetry.filter(
        (event) => event.eventType === "voice_realtime_pipeline_terminal_noop",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "fail" })]);
    expect(
      failed.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_terminal_started",
      ),
    ).toEqual([expect.objectContaining({ terminalAction: "fail" })]);
    expect(
      failed.telemetry.filter(
        (event) =>
          event.eventType === "voice_realtime_pipeline_terminal_completed",
      ),
    ).toEqual([
      expect.objectContaining({
        terminalAction: "fail",
        failureClass: "terminal_lifecycle",
        failureReason: "pipeline_failed",
        clearedIntentCount: 1,
        clearedSynthesisItemCount: 1,
        clearedPlaybackIntentCount: 1,
      }),
    ]);
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

  it("keeps all Phase 4D telemetry event shapes metadata-only", async () => {
    const scenarios = [
      async () => {
        const { pipeline, telemetry, sessionId } = await createHarness({
          readinessTimeoutMs: 500,
        });
        await pipeline.ingest({
          ...chunkEvent(sessionId, 2),
          createdAt: 1_000,
          transcript: "secret transcript payload",
          spokenText: "secret spoken payload",
          assistantBody: "secret assistant body payload",
          audio: "secret audio payload",
        } as unknown as AssistantResponseStreamMetadataEvent);
        await pipeline.ingest(chunkEvent(sessionId, 2));
        await pipeline.detectReadinessTimeouts(sessionId, 1_600);
        await pipeline.cancelSession(sessionId);
        await pipeline.cancelSession(sessionId);
        return telemetry;
      },
      async () => {
        const { pipeline, telemetry, sessionId } = await createHarness({
          maxScheduledIntents: 1,
        });
        await pipeline.ingest(chunkEvent(sessionId, 0));
        await pipeline.ingest(chunkEvent(sessionId, 1));
        return telemetry;
      },
      async () => {
        const { pipeline, telemetry, sessionId } = await createHarness();
        await pipeline.ingest({
          type: "response_failed",
          sessionId,
          streamId: "stream-1",
          responseId: "response-1",
          error: "secret assistant body payload",
        });
        return telemetry;
      },
    ];
    const telemetry = (
      await Promise.all(scenarios.map((scenario) => scenario()))
    ).flat();
    const forbiddenKeys = new Set([
      "transcript",
      "text",
      "spokenText",
      "assistantBody",
      "body",
      "audio",
      "audioData",
      "audioBytes",
      "payload",
    ]);

    expect(telemetry.length).toBeGreaterThan(0);
    for (const event of telemetry) {
      for (const key of Object.keys(event)) {
        expect(forbiddenKeys.has(key)).toBe(false);
      }
    }
    expect(telemetry.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "voice_realtime_pipeline_playback_intent_created",
        "voice_realtime_chunk_readiness_changed",
        "voice_realtime_first_chunk_ready",
        "voice_realtime_chunk_readiness_timeout",
        "voice_realtime_stage_latency_marker",
        "voice_realtime_pipeline_terminal_started",
        "voice_realtime_pipeline_terminal_completed",
        "voice_realtime_pipeline_terminal_noop",
        "voice_realtime_pipeline_fanout_started",
        "voice_realtime_pipeline_fanout_completed",
        "voice_realtime_pipeline_fanout_noop",
        "voice_realtime_pipeline_failed",
      ]),
    );
    assertTelemetryHygiene(telemetry);
  });

  it("preserves final Phase 4D lifecycle invariants in one active turn", async () => {
    const {
      pipeline,
      scheduler,
      synthesisQueue,
      playbackSequencer,
      supervisor,
      telemetry,
      sessionId,
    } = await createHarness();

    expect(await supervisor.startSession()).toEqual({
      ok: false,
      reason: "active_session_exists",
    });
    const first = await pipeline.ingest(chunkEvent(sessionId, 1));
    const second = await pipeline.ingest(chunkEvent(sessionId, 0));
    const duplicate = await pipeline.ingest(chunkEvent(sessionId, 1));

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(duplicate).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "duplicate_chunk",
    });
    expect(
      pipeline.getPlaybackIntents(sessionId).map((intent) => intent.chunkIndex),
    ).toEqual([0, 1]);

    await pipeline.completeSession(sessionId);
    await pipeline.completeSession(sessionId);
    const stale = await pipeline.ingest(chunkEvent(sessionId, 2));

    expect(stale).toEqual({
      ok: false,
      stage: "scheduler",
      reason: "stale_turn",
    });
    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(playbackSequencer.getPendingIntents(sessionId)).toEqual([]);
    expect(
      pipeline
        .getChunkReadiness(sessionId)
        .map((record) => [record.chunkIndex, record.state, record.firstReady]),
    ).toEqual([
      [0, "terminal", false],
      [1, "terminal", false],
    ]);
    expect(pipeline.getFirstReadyChunk(sessionId)).toBeNull();
    expect(supervisor.getSession(sessionId)).toMatchObject({
      active: false,
      state: "completed",
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_terminal_noop",
        terminalAction: "complete",
      }),
    );
    expect(supervisor.getState()).toMatchObject({
      activeSessionId: null,
      canAutoplay: false,
    });
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

  it("freezes Phase 4D implementation against forbidden wiring dependencies", () => {
    const sources = readVoiceStreamingImplementationSources();

    expect(sources).not.toMatch(
      /from\s+["'][^"']*(app\/page|components\/chat|chat-ui)/i,
    );
    expect(sources).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(sources).not.toMatch(/runtime-commands|runTool|toolRuntime/i);
    expect(sources).not.toMatch(/submitApproval|approveExecution|approval/i);
    expect(sources).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(sources).not.toMatch(/cloud\s*(stream|streaming)|cloudStreaming/i);
    expect(sources).not.toMatch(
      /autoplay\s*[:=]\s*true|HTMLAudioElement|\.play\(/i,
    );
  });
});
