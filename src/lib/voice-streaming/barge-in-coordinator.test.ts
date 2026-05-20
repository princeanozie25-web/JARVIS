import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceBargeInCoordinator } from "./barge-in-coordinator";
import { VoicePlaybackSequencer } from "./playback-sequencer";
import { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import { VoiceSynthesisOrchestrationQueue } from "./synthesis-queue";
import type {
  AssistantResponseStreamMetadataEvent,
  VoiceBargeInIntent,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function createHarness() {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const emitTelemetry = (event: VoiceOrchestrationTelemetryEvent) => {
    telemetry.push(event);
  };
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: () => 1_000,
    emitTelemetry,
  });
  const scheduler = new VoiceResponseChunkScheduler({
    supervisor,
    newId: createIdGenerator("intent"),
    now: () => 2_000,
    emitTelemetry,
  });
  const synthesisQueue = new VoiceSynthesisOrchestrationQueue({
    supervisor,
    newId: createIdGenerator("synthesis"),
    now: () => 3_000,
    emitTelemetry,
  });
  const playbackSequencer = new VoicePlaybackSequencer({
    supervisor,
    newId: createIdGenerator("playback"),
    now: () => 4_000,
    emitTelemetry,
  });
  const pipeline = new VoiceRealtimeOrchestrationPipeline({
    supervisor,
    scheduler,
    synthesisQueue,
    playbackSequencer,
    emitTelemetry,
  });
  const coordinator = new VoiceBargeInCoordinator({
    supervisor,
    pipeline,
    newId: createIdGenerator("preemption"),
    now: () => 5_000,
    emitTelemetry,
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  return {
    coordinator,
    pipeline,
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

function intent(
  sessionId: string,
  input: Partial<VoiceBargeInIntent> = {},
): VoiceBargeInIntent {
  return {
    id: input.id ?? "barge-in-1",
    sessionId,
    category: input.category ?? "user_ptt_pressed_during_playback",
    streamId: "stream-1",
    responseId: "response-1",
    playbackIntentId: "playback-1",
    turnId: "turn-1",
    ...input,
  };
}

function expectMetadataOnlyTelemetry(
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify(telemetry);
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret audio payload");
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function createPendingPipelineHarness() {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const emitTelemetry = (event: VoiceOrchestrationTelemetryEvent) => {
    telemetry.push(event);
  };
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: () => 1_000,
    emitTelemetry,
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  const interruptStarted = createDeferred();
  const cancelStarted = createDeferred();
  const releaseTerminal = createDeferred();
  let interruptCalls = 0;
  let cancelCalls = 0;
  const pipeline = {
    cancelSession: async (sessionId: string) => {
      cancelCalls += 1;
      cancelStarted.resolve();
      await releaseTerminal.promise;
      await supervisor.cancelSession(sessionId);
    },
    interrupt: async (sessionId: string) => {
      interruptCalls += 1;
      interruptStarted.resolve();
      await releaseTerminal.promise;
      await supervisor.interrupt(sessionId);
    },
    getPlaybackIntents: () =>
      [
        {
          id: "playback-1",
          sessionId: started.session.id,
          synthesisQueueItemId: "synthesis-1",
          streamId: "stream-1",
          responseId: "response-1",
          assistantResponseChunkId: "assistant-chunk-0",
          orchestrationChunkId: "chunk-0",
          chunkIndex: 0,
          state: "sequenced",
          createdAt: 4_000,
          updatedAt: 4_000,
        },
      ] as ReturnType<VoiceRealtimeOrchestrationPipeline["getPlaybackIntents"]>,
    getChunkReadiness: () =>
      [
        {
          sessionId: started.session.id,
          streamId: "stream-1",
          responseId: "response-1",
          assistantResponseChunkId: "assistant-chunk-0",
          orchestrationChunkId: "chunk-0",
          schedulingIntentId: "intent-1",
          synthesisQueueItemId: "synthesis-1",
          playbackIntentId: "playback-1",
          chunkIndex: 0,
          state: "ready_to_play",
          terminal: false,
          blocked: false,
          firstReady: true,
          timestamps: {
            scheduledAt: 2_000,
            queuedAt: 3_000,
            synthesizedAt: 4_000,
            readyToPlayAt: 4_000,
            lastUpdatedAt: 4_000,
          },
        },
      ] as ReturnType<VoiceRealtimeOrchestrationPipeline["getChunkReadiness"]>,
  };
  const coordinator = new VoiceBargeInCoordinator({
    supervisor,
    pipeline,
    newId: createIdGenerator("preemption"),
    now: () => 5_000,
    emitTelemetry,
  });

  return {
    coordinator,
    supervisor,
    telemetry,
    sessionId: started.session.id,
    interruptStarted,
    cancelStarted,
    releaseTerminal,
    getInterruptCalls: () => interruptCalls,
    getCancelCalls: () => cancelCalls,
  };
}

function countEvents(
  telemetry: VoiceOrchestrationTelemetryEvent[],
  eventType: VoiceOrchestrationTelemetryEvent["eventType"],
): number {
  return telemetry.filter((event) => event.eventType === eventType).length;
}

describe("VoiceBargeInCoordinator", () => {
  it("maps PTT during playback to safe cancellation and new-capture prep actions", async () => {
    const { coordinator, pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));

    const result = await coordinator.handleIntent(
      intent(sessionId, {
        category: "user_ptt_pressed_during_playback",
        transcript: "secret transcript payload",
        spokenText: "secret spoken payload",
        assistantBody: "secret assistant body payload",
        audio: "secret audio payload",
      } as unknown as Partial<VoiceBargeInIntent>),
    );

    expect(result).toEqual({
      ok: true,
      intent: expect.objectContaining({
        id: "barge-in-1",
        category: "user_ptt_pressed_during_playback",
      }),
      actions: [
        "cancel_current_voice_pipeline",
        "clear_pending_audio_work",
        "mark_turn_interrupted",
        "prepare_for_new_capture",
      ],
      state: "completed",
    });
    expect(
      telemetry
        .filter(
          (event) => event.eventType === "voice_barge_in_state_transition",
        )
        .map((event) => [event.previousBargeInState, event.nextBargeInState]),
    ).toEqual([
      ["idle", "observing_playback"],
      ["observing_playback", "interrupt_requested"],
      ["interrupt_requested", "cancelling_current_turn"],
      ["cancelling_current_turn", "clearing_pending_work"],
      ["clearing_pending_work", "preparing_new_capture"],
      ["preparing_new_capture", "ready_for_capture"],
      ["ready_for_capture", "completed"],
    ]);
    expect(coordinator.getState(sessionId)).toBe("completed");
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      active: false,
    });
    expect(pipeline.getPlaybackIntents(sessionId)).toEqual([]);
    expect(coordinator.getPreemptionRecords(sessionId)).toEqual([
      {
        id: "preemption-1",
        sessionId,
        turnId: "turn-1",
        interruptedAt: 5_000,
        lastReadyChunkIndex: 0,
        lastSequencedChunkIndex: 0,
        pendingChunkCount: 1,
        reason: "user_ptt_pressed_during_playback",
      },
    ]);
    expect(coordinator.getCaptureRearmIntentRecords(sessionId)).toEqual([
      {
        id: "preemption-2",
        sessionId,
        turnId: "turn-1",
        bargeInIntentId: "barge-in-1",
        reason: "user_ptt_pressed_during_playback",
        state: "ready_for_new_capture",
        requestedAt: 5_000,
      },
    ]);
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toEqual([
      {
        id: "preemption-3",
        intentId: "preemption-2",
        sessionId,
        turnId: "turn-1",
        bargeInIntentId: "barge-in-1",
        reason: "user_ptt_pressed_during_playback",
        state: "ready_for_new_capture",
        completedAt: 5_000,
      },
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_intent_received",
        bargeInIntentCategory: "user_ptt_pressed_during_playback",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_action_selected",
        bargeInAction: "prepare_for_new_capture",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_turn_preemption_recorded",
        preemptionRecordId: "preemption-1",
        turnId: "turn-1",
        lastReadyChunkIndex: 0,
        lastSequencedChunkIndex: 0,
        pendingChunkCount: 1,
        preemptionReason: "user_ptt_pressed_during_playback",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_capture_rearm_requested",
        captureRearmIntentId: "preemption-2",
        captureRearmState: "requested",
        nextCaptureRearmState: "requested",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_capture_rearm_ready",
        captureRearmIntentId: "preemption-2",
        captureRearmResultId: "preemption-3",
        captureRearmState: "ready_for_new_capture",
      }),
    );
    expectMetadataOnlyTelemetry(telemetry);
  });

  it("allows accepted new-turn barge-in to request safe re-arm metadata", async () => {
    const { coordinator, pipeline, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));

    const result = await coordinator.handleIntent(
      intent(sessionId, { category: "user_started_new_turn" }),
    );

    expect(result).toMatchObject({
      ok: true,
      actions: expect.arrayContaining(["prepare_for_new_capture"]),
    });
    expect(coordinator.getCaptureRearmState("turn-1")).toBe(
      "ready_for_new_capture",
    );
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toEqual([
      expect.objectContaining({
        reason: "user_started_new_turn",
        state: "ready_for_new_capture",
      }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_capture_rearm_ready",
        captureRearmState: "ready_for_new_capture",
      }),
    );
  });

  it("maps stop intent to safe pipeline cancellation actions", async () => {
    const { coordinator, pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));

    const result = await coordinator.handleIntent(
      intent(sessionId, { category: "user_requested_stop" }),
    );

    expect(result).toEqual({
      ok: true,
      intent: expect.objectContaining({ category: "user_requested_stop" }),
      actions: ["cancel_current_voice_pipeline", "clear_pending_audio_work"],
      state: "completed",
    });
    expect(
      telemetry
        .filter(
          (event) => event.eventType === "voice_barge_in_state_transition",
        )
        .map((event) => event.nextBargeInState),
    ).toEqual([
      "observing_playback",
      "interrupt_requested",
      "cancelling_current_turn",
      "clearing_pending_work",
      "completed",
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "cancelled",
      active: false,
    });
    expect(pipeline.getPlaybackIntents(sessionId)).toEqual([]);
    expect(coordinator.getPreemptionRecords(sessionId)).toEqual([
      expect.objectContaining({
        reason: "user_requested_stop",
        pendingChunkCount: 1,
      }),
    ]);
    expect(coordinator.getCaptureRearmIntentRecords(sessionId)).toEqual([]);
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toEqual([]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_action_selected",
        bargeInAction: "cancel_current_voice_pipeline",
      }),
    );
  });

  it("rejects stale or non-active session intents", async () => {
    const { coordinator, pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.completeSession(sessionId);
    const next = await supervisor.startSession();
    if (!next.ok) throw new Error("Expected next session to start");

    const stale = await coordinator.handleIntent(intent(sessionId));
    const missing = await coordinator.handleIntent(intent("missing-session"));

    expect(stale).toEqual({
      ok: false,
      intent: expect.objectContaining({ sessionId }),
      reason: "stale_turn",
      actions: ["no_op"],
      state: "idle",
    });
    expect(missing).toEqual({
      ok: false,
      intent: expect.objectContaining({ sessionId: "missing-session" }),
      reason: "session_not_found",
      actions: ["no_op"],
      state: "idle",
    });
    expect(supervisor.getSession(next.session.id)).toMatchObject({
      active: true,
    });
    expect(coordinator.getPreemptionRecords(sessionId)).toEqual([]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_turn_preemption_rejected",
        bargeInRejectionReason: "stale_turn",
        preemptionReason: "user_ptt_pressed_during_playback",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_intent_rejected",
        bargeInRejectionReason: "stale_turn",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_noop",
        bargeInAction: "no_op",
      }),
    );
  });

  it("handles repeated interrupt intents idempotently", async () => {
    const { coordinator, pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));

    const first = await coordinator.handleIntent(intent(sessionId));
    const repeated = await coordinator.handleIntent(
      intent(sessionId, { id: "barge-in-2" }),
    );

    expect(first).toMatchObject({ ok: true });
    expect(repeated).toEqual({
      ok: false,
      intent: expect.objectContaining({ id: "barge-in-2" }),
      reason: "state_terminal",
      actions: ["no_op"],
      state: "completed",
    });
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      active: false,
    });
    expect(coordinator.getPreemptionRecords(sessionId)).toHaveLength(1);
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toHaveLength(1);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_turn_preemption_noop",
        preemptionRecordId: "preemption-1",
        bargeInIntentId: "barge-in-2",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_capture_rearm_noop",
        captureRearmResultId: "preemption-3",
        bargeInIntentId: "barge-in-2",
      }),
    );
    expect(
      telemetry.filter((event) => event.eventType === "voice_barge_in_noop"),
    ).toEqual([expect.objectContaining({ bargeInIntentId: "barge-in-2" })]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_terminal_noop",
        bargeInRejectionReason: "state_terminal",
      }),
    );
  });

  it("deduplicates a rapid repeated interrupt burst while terminal work is pending", async () => {
    const {
      coordinator,
      supervisor,
      telemetry,
      sessionId,
      interruptStarted,
      releaseTerminal,
      getInterruptCalls,
      getCancelCalls,
    } = await createPendingPipelineHarness();

    const burst = Array.from({ length: 12 }, (_, index) =>
      coordinator.handleIntent(
        intent(sessionId, {
          id: `barge-in-${index + 1}`,
          category: "user_ptt_pressed_during_playback",
        }),
      ),
    );
    await interruptStarted.promise;
    releaseTerminal.resolve();
    const results = await Promise.all(burst);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(11);
    expect(
      results
        .filter((result) => !result.ok)
        .map((result) => (result.ok ? "" : result.reason)),
    ).toEqual(Array(11).fill("terminal_transition_in_flight"));
    expect(getInterruptCalls()).toBe(1);
    expect(getCancelCalls()).toBe(0);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      active: false,
    });
    expect(coordinator.getPreemptionRecords(sessionId)).toHaveLength(1);
    expect(coordinator.getCaptureRearmIntentRecords(sessionId)).toHaveLength(1);
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toHaveLength(1);
    expect(countEvents(telemetry, "voice_turn_preemption_recorded")).toBe(1);
    expect(countEvents(telemetry, "voice_capture_rearm_ready")).toBe(1);
    expect(countEvents(telemetry, "voice_barge_in_action_selected")).toBe(4);
    expect(countEvents(telemetry, "voice_barge_in_noop")).toBe(11);
    expectMetadataOnlyTelemetry(telemetry);
  });

  it("rejects mixed barge-in intents during a pending pipeline interrupt without duplicate terminal calls", async () => {
    const {
      coordinator,
      telemetry,
      sessionId,
      interruptStarted,
      releaseTerminal,
      getInterruptCalls,
      getCancelCalls,
    } = await createPendingPipelineHarness();

    const accepted = coordinator.handleIntent(
      intent(sessionId, {
        id: "barge-in-accepted",
        category: "user_ptt_pressed_during_playback",
      }),
    );
    await interruptStarted.promise;

    const mixed = await Promise.all([
      coordinator.handleIntent(
        intent(sessionId, {
          id: "barge-in-stop",
          category: "user_requested_stop",
        }),
      ),
      coordinator.handleIntent(
        intent(sessionId, {
          id: "barge-in-new-turn",
          category: "user_started_new_turn",
        }),
      ),
      coordinator.handleIntent(
        intent(sessionId, {
          id: "barge-in-playback-preempted",
          category: "playback_preempted",
        }),
      ),
    ]);

    expect(mixed).toEqual([
      expect.objectContaining({
        ok: false,
        reason: "terminal_transition_in_flight",
        actions: ["no_op"],
      }),
      expect.objectContaining({
        ok: false,
        reason: "terminal_transition_in_flight",
        actions: ["no_op"],
      }),
      expect.objectContaining({
        ok: false,
        reason: "terminal_transition_in_flight",
        actions: ["no_op"],
      }),
    ]);
    expect(getInterruptCalls()).toBe(1);
    expect(getCancelCalls()).toBe(0);

    releaseTerminal.resolve();
    await expect(accepted).resolves.toMatchObject({ ok: true });

    expect(coordinator.getPreemptionRecords(sessionId)).toEqual([
      expect.objectContaining({ reason: "user_ptt_pressed_during_playback" }),
    ]);
    expect(coordinator.getPreemptionRecords(sessionId)).toHaveLength(1);
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toHaveLength(1);
    expect(countEvents(telemetry, "voice_turn_preemption_recorded")).toBe(1);
    expect(countEvents(telemetry, "voice_capture_rearm_ready")).toBe(1);
    expect(countEvents(telemetry, "voice_barge_in_noop")).toBe(3);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_intent_rejected",
        bargeInRejectionReason: "terminal_transition_in_flight",
      }),
    );
  });

  it("keeps terminal state from producing new work", async () => {
    const { coordinator, pipeline, supervisor, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));

    const first = await coordinator.handleIntent(
      intent(sessionId, { category: "user_requested_stop" }),
    );
    const invalid = await coordinator.handleIntent(
      intent(sessionId, {
        id: "barge-in-2",
        category: "user_started_new_turn",
      }),
    );

    expect(first).toMatchObject({ ok: true, state: "completed" });
    expect(invalid).toEqual({
      ok: false,
      intent: expect.objectContaining({
        id: "barge-in-2",
        category: "user_started_new_turn",
      }),
      reason: "state_terminal",
      actions: ["no_op"],
      state: "completed",
    });
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "cancelled",
      active: false,
    });
    expect(coordinator.getState(sessionId)).toBe("completed");
    expect(coordinator.getCaptureRearmResultRecords(sessionId)).toEqual([
      expect.objectContaining({
        bargeInIntentId: "barge-in-2",
        state: "blocked",
        blockedReason: "state_terminal",
      }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_terminal_noop",
        bargeInRejectionReason: "state_terminal",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_capture_rearm_blocked",
        captureRearmState: "blocked",
        captureRearmBlockedReason: "state_terminal",
      }),
    );
  });

  it("captures only metadata for half-spoken turn preemption records", async () => {
    const { coordinator, pipeline, telemetry, sessionId } =
      await createHarness();
    await pipeline.ingest(chunkEvent(sessionId, 0));
    await pipeline.ingest(chunkEvent(sessionId, 1));

    await coordinator.handleIntent(
      intent(sessionId, {
        id: "barge-in-with-unsafe-fields",
        category: "playback_preempted",
        transcript: "secret transcript payload",
        spokenText: "secret spoken payload",
        assistantBody: "secret assistant body payload",
        audioUrl: "secret audio payload",
        pcm: "secret audio payload",
      } as unknown as Partial<VoiceBargeInIntent>),
    );

    const records = coordinator.getPreemptionRecords(sessionId);
    expect(records).toEqual([
      {
        id: "preemption-1",
        sessionId,
        turnId: "turn-1",
        interruptedAt: 5_000,
        lastReadyChunkIndex: 1,
        lastSequencedChunkIndex: 1,
        pendingChunkCount: 2,
        reason: "playback_preempted",
      },
    ]);

    const serializedRecords = JSON.stringify(records);
    expect(serializedRecords).not.toContain("secret transcript payload");
    expect(serializedRecords).not.toContain("secret spoken payload");
    expect(serializedRecords).not.toContain("secret assistant body payload");
    expect(serializedRecords).not.toContain("secret audio payload");
    const serializedRearm = JSON.stringify(
      coordinator.getCaptureRearmResultRecords(sessionId),
    );
    expect(serializedRearm).not.toContain("secret transcript payload");
    expect(serializedRearm).not.toContain("secret spoken payload");
    expect(serializedRearm).not.toContain("secret assistant body payload");
    expect(serializedRearm).not.toContain("secret audio payload");
    expectMetadataOnlyTelemetry(telemetry);
  });

  it("fails invalid in-flight transitions closed without creating new work", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const supervisor = new VoiceOrchestrationSupervisor({
      newId: createIdGenerator("session"),
      now: () => 1_000,
    });
    const started = await supervisor.startSession();
    if (!started.ok) throw new Error("Expected voice session to start");
    const interruptStarted = createDeferred();
    const releaseInterrupt = createDeferred();
    const coordinator = new VoiceBargeInCoordinator({
      supervisor,
      pipeline: {
        cancelSession: async () => undefined,
        interrupt: async () => {
          interruptStarted.resolve();
          await releaseInterrupt.promise;
        },
        getPlaybackIntents: () => [],
        getChunkReadiness: () => [],
      },
      newId: createIdGenerator("preemption"),
      now: () => 5_000,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const inFlight = coordinator.handleIntent(
      intent(started.session.id, {
        category: "user_ptt_pressed_during_playback",
      }),
    );
    await interruptStarted.promise;

    const invalid = await coordinator.handleIntent(
      intent(started.session.id, {
        id: "barge-in-2",
        category: "user_started_new_turn",
      }),
    );
    releaseInterrupt.resolve();
    const completed = await inFlight;

    expect(invalid).toEqual({
      ok: false,
      intent: expect.objectContaining({
        id: "barge-in-2",
        category: "user_started_new_turn",
      }),
      reason: "terminal_transition_in_flight",
      actions: ["no_op"],
      state: "ready_for_capture",
    });
    expect(completed).toMatchObject({ ok: true, state: "completed" });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_barge_in_intent_rejected",
        bargeInRejectionReason: "terminal_transition_in_flight",
        bargeInState: "ready_for_capture",
      }),
    );
  });

  it("does not introduce voice approval, autoplay, chat, runtime, Realtime, wake word, capture device, browser, or cloud wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/barge-in-coordinator.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/voiceApproval|approval|approve/i);
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
    expect(source).not.toMatch(
      /microphone|navigator|mediaDevices|keyboard|window\.|document\./i,
    );
    expect(source).not.toMatch(/autoplay|HTMLAudioElement|\.play\(/i);
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(/runtime-commands|runTool|toolRuntime/i);
    expect(source).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(source).not.toMatch(/cloud\s*(stream|streaming)|cloudStreaming/i);
  });
});
