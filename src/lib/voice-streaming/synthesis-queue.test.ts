import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceSynthesisOrchestrationQueue } from "./synthesis-queue";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  AssistantResponseStreamMetadataEvent,
  ChunkSchedulingIntent,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function createHarness(options: { maxPendingItems?: number } = {}) {
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
    maxPendingItems: options.maxPendingItems,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  return {
    scheduler,
    synthesisQueue,
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

describe("VoiceSynthesisOrchestrationQueue", () => {
  it("converts scheduled intents into synthesis queue items in order", async () => {
    const { scheduler, synthesisQueue, supervisor, telemetry, sessionId } =
      await createHarness();

    const firstIntent = await scheduleIntent(scheduler, sessionId, 0);
    const secondIntent = await scheduleIntent(scheduler, sessionId, 1);

    const first = await synthesisQueue.enqueue(firstIntent);
    const second = await synthesisQueue.enqueue(secondIntent);

    expect(first).toMatchObject({
      ok: true,
      item: {
        id: "synthesis-1",
        schedulingIntentId: "intent-1",
        chunkIndex: 0,
        state: "queued",
      },
    });
    expect(second).toMatchObject({
      ok: true,
      item: {
        id: "synthesis-2",
        schedulingIntentId: "intent-2",
        chunkIndex: 1,
        state: "queued",
      },
    });
    expect(
      synthesisQueue
        .getPendingItems(sessionId)
        .map((item) => [item.id, item.chunkIndex]),
    ).toEqual([
      ["synthesis-1", 0],
      ["synthesis-2", 1],
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "synthesizing",
      metadata: {
        synthesisQueueItemIds: ["synthesis-1", "synthesis-2"],
      },
    });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({
        index: 0,
        state: "synthesizing",
        queueItemId: "synthesis-1",
      }),
      expect.objectContaining({
        index: 1,
        state: "synthesizing",
        queueItemId: "synthesis-2",
      }),
    ]);
    expect(synthesisQueue.getPendingItems(sessionId)[0]).not.toHaveProperty(
      "text",
    );
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "voice_synthesis_queue_item_enqueued",
      "voice_synthesis_queue_item_enqueued",
    ]);
  });

  it("propagates cancellation and stops future synthesis queueing", async () => {
    const { scheduler, synthesisQueue, supervisor, telemetry, sessionId } =
      await createHarness();
    const firstIntent = await scheduleIntent(scheduler, sessionId, 0);
    const secondIntent = await scheduleIntent(scheduler, sessionId, 1);

    await synthesisQueue.enqueue(firstIntent);
    await synthesisQueue.cancelSession(sessionId);
    const afterCancel = await synthesisQueue.enqueue(secondIntent);

    expect(afterCancel).toEqual({ ok: false, reason: "session_terminal" });
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(synthesisQueue.getClearedItems(sessionId)).toEqual([
      expect.objectContaining({ id: "synthesis-1", state: "cancelled" }),
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
        eventType: "voice_synthesis_queue_cancelled",
        clearedSynthesisItemCount: 1,
        pendingSynthesisItemCount: 0,
      }),
    );
  });

  it("propagates interruption and clears pending synthesis work", async () => {
    const { scheduler, synthesisQueue, supervisor, telemetry, sessionId } =
      await createHarness();
    const firstIntent = await scheduleIntent(scheduler, sessionId, 0);
    const secondIntent = await scheduleIntent(scheduler, sessionId, 1);

    await synthesisQueue.enqueue(firstIntent);
    await synthesisQueue.enqueue(secondIntent);
    await synthesisQueue.interrupt(sessionId);

    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([]);
    expect(
      synthesisQueue.getClearedItems(sessionId).map((item) => ({
        index: item.chunkIndex,
        state: item.state,
      })),
    ).toEqual([
      { index: 0, state: "interrupted" },
      { index: 1, state: "interrupted" },
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "interrupted",
      cancellation: { aborted: true },
    });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "cancelled" }),
      expect.objectContaining({ index: 1, state: "cancelled" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_synthesis_queue_interrupted",
        clearedSynthesisItemCount: 2,
        pendingSynthesisItemCount: 0,
      }),
    );
  });

  it("handles overflow without queueing extra synthesis work", async () => {
    const { scheduler, synthesisQueue, supervisor, telemetry, sessionId } =
      await createHarness({ maxPendingItems: 1 });
    const firstIntent = await scheduleIntent(scheduler, sessionId, 0);
    const secondIntent = await scheduleIntent(scheduler, sessionId, 1);

    await synthesisQueue.enqueue(firstIntent);
    const overflow = await synthesisQueue.enqueue(secondIntent);

    expect(overflow).toEqual({ ok: false, reason: "overflow" });
    expect(synthesisQueue.getPendingItems(sessionId)).toEqual([
      expect.objectContaining({ id: "synthesis-1", chunkIndex: 0 }),
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      metadata: { synthesisQueueItemIds: ["synthesis-1"] },
    });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "synthesizing" }),
      expect.objectContaining({ index: 1, state: "queued" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_synthesis_queue_overflow",
        success: false,
        error: "overflow",
        pendingSynthesisItemCount: 1,
        maxPendingSynthesisItems: 1,
      }),
    );
  });

  it("keeps transcript, spoken, audio, and assistant body payloads out of telemetry", async () => {
    const { scheduler, synthesisQueue, telemetry, sessionId } =
      await createHarness();
    const intent = await scheduleIntent(scheduler, sessionId, 0);
    const unsafeIntent = {
      ...intent,
      assistantResponseChunkId: "secret assistant body payload",
      transcript: "secret transcript payload",
      spokenText: "secret spoken payload",
      audio: "secret audio payload",
      assistantBody: "secret assistant body payload",
    } as unknown as ChunkSchedulingIntent;

    await synthesisQueue.enqueue(unsafeIntent);

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("voice_synthesis_queue_item_enqueued");
    expect(serialized).not.toContain("secret transcript payload");
    expect(serialized).not.toContain("secret spoken payload");
    expect(serialized).not.toContain("secret audio payload");
    expect(serialized).not.toContain("secret assistant body payload");
  });

  it("does not introduce autoplay, live chat, command, Realtime, or cloud wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/synthesis-queue.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\/api\/chat|app\/page|fetch\(/);
    expect(source).not.toMatch(/OpenAI|Realtime|chat\.completions/);
    expect(source).not.toMatch(/runTool|toolRuntime|submitApproval/);
    expect(source).not.toMatch(/autoplay|playback|audio/i);
  });
});
