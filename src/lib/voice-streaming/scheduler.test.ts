import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  AssistantResponseStreamMetadataEvent,
  VoiceOrchestrationTelemetryEvent,
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
    maxPendingIntents: options.maxPendingIntents,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("Expected voice session to start");

  return {
    scheduler,
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

describe("VoiceResponseChunkScheduler", () => {
  it("ingests metadata-only response events and schedules chunks in order", async () => {
    const { scheduler, supervisor, telemetry, sessionId } =
      await createHarness();

    await scheduler.ingest({
      type: "response_started",
      sessionId,
      streamId: "stream-1",
      responseId: "response-1",
    });
    const first = await scheduler.ingest(chunkEvent(sessionId, 0));
    const second = await scheduler.ingest(chunkEvent(sessionId, 1));
    await scheduler.ingest({
      type: "response_completed",
      sessionId,
      streamId: "stream-1",
      responseId: "response-1",
      chunkCount: 2,
    });

    expect(first).toMatchObject({
      ok: true,
      intent: { id: "intent-1", chunkIndex: 0, state: "scheduled" },
    });
    expect(second).toMatchObject({
      ok: true,
      intent: { id: "intent-2", chunkIndex: 1, state: "scheduled" },
    });
    expect(
      scheduler.getPendingIntents(sessionId).map((intent) => intent.chunkIndex),
    ).toEqual([0, 1]);
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({
        index: 0,
        speechChunkId: "assistant-chunk-0",
        state: "queued",
      }),
      expect.objectContaining({
        index: 1,
        speechChunkId: "assistant-chunk-1",
        state: "queued",
      }),
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "chunking_response",
      metadata: { responseChunkCount: 2 },
    });
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "voice_response_metadata_stream_started",
      "voice_response_chunk_scheduled",
      "voice_response_chunk_scheduled",
      "voice_response_metadata_stream_completed",
    ]);
  });

  it("propagates cancellation and stops later scheduling", async () => {
    const { scheduler, supervisor, telemetry, sessionId } =
      await createHarness();

    await scheduler.ingest(chunkEvent(sessionId, 0));
    await scheduler.cancelSession(sessionId);
    const afterCancel = await scheduler.ingest(chunkEvent(sessionId, 1));

    expect(afterCancel).toEqual({ ok: false, reason: "session_terminal" });
    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(scheduler.getClearedIntents(sessionId)).toEqual([
      expect.objectContaining({ chunkIndex: 0, state: "cancelled" }),
    ]);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      state: "cancelled",
      cancellation: { aborted: true },
    });
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "cancelled" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_scheduling_cancelled",
        clearedIntentCount: 1,
        pendingIntentCount: 0,
      }),
    );
  });

  it("propagates interruption and clears pending scheduled work", async () => {
    const { scheduler, supervisor, telemetry, sessionId } =
      await createHarness();

    await scheduler.ingest(chunkEvent(sessionId, 0));
    await scheduler.ingest(chunkEvent(sessionId, 1));
    await scheduler.interrupt(sessionId);

    expect(scheduler.getPendingIntents(sessionId)).toEqual([]);
    expect(
      scheduler.getClearedIntents(sessionId).map((intent) => ({
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
    expect(supervisor.getState().chunks).toEqual([
      expect.objectContaining({ index: 0, state: "cancelled" }),
      expect.objectContaining({ index: 1, state: "cancelled" }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_scheduling_interrupted",
        clearedIntentCount: 2,
        pendingIntentCount: 0,
      }),
    );
  });

  it("handles overflow without recording extra orchestration chunks", async () => {
    const { scheduler, supervisor, telemetry, sessionId } = await createHarness(
      { maxPendingIntents: 1 },
    );

    await scheduler.ingest(chunkEvent(sessionId, 0));
    const overflow = await scheduler.ingest(chunkEvent(sessionId, 1));

    expect(overflow).toEqual({ ok: false, reason: "overflow" });
    expect(scheduler.getPendingIntents(sessionId)).toEqual([
      expect.objectContaining({ chunkIndex: 0 }),
    ]);
    expect(supervisor.getState().chunks).toHaveLength(1);
    expect(supervisor.getSession(sessionId)).toMatchObject({
      metadata: { responseChunkCount: 1 },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_response_chunk_schedule_overflow",
        success: false,
        error: "overflow",
        pendingIntentCount: 1,
        maxPendingIntents: 1,
      }),
    );
  });

  it("keeps transcript, spoken, audio, and assistant body payloads out of telemetry", async () => {
    const { scheduler, telemetry, sessionId } = await createHarness();
    const unsafeEvent = {
      ...chunkEvent(sessionId, 0),
      transcript: "secret transcript payload",
      spokenText: "secret spoken payload",
      audio: "secret audio payload",
      assistantBody: "secret assistant body payload",
    } as unknown as AssistantResponseStreamMetadataEvent;

    await scheduler.ingest(unsafeEvent);
    await scheduler.ingest({
      type: "response_failed",
      sessionId,
      streamId: "stream-1",
      responseId: "response-1",
      error: "secret assistant body failure",
    });

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("voice_response_chunk_scheduled");
    expect(serialized).toContain("voice_response_metadata_stream_failed");
    expect(serialized).not.toContain("secret transcript payload");
    expect(serialized).not.toContain("secret spoken payload");
    expect(serialized).not.toContain("secret audio payload");
    expect(serialized).not.toContain("secret assistant body payload");
    expect(serialized).not.toContain("secret assistant body failure");
  });

  it("does not introduce live chat, command, autoplay, Realtime, or cloud wiring", () => {
    const schedulerSource = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/scheduler.ts"),
      "utf8",
    );

    expect(schedulerSource).not.toMatch(/\/api\/chat|app\/page|fetch\(/);
    expect(schedulerSource).not.toMatch(/OpenAI|Realtime|chat\.completions/);
    expect(schedulerSource).not.toMatch(/runTool|toolRuntime|submitApproval/);
    expect(schedulerSource).not.toMatch(/autoplay|playback|audio/i);
  });
});
