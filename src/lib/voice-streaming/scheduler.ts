import type { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  AssistantResponseStreamMetadataEvent,
  ChunkSchedulingIntent,
  VoiceOrchestrationTelemetryEvent,
  VoiceTurnState,
} from "./types";

export interface VoiceResponseChunkSchedulerOptions {
  supervisor: VoiceOrchestrationSupervisor;
  now?: () => number;
  newId?: () => string;
  maxPendingIntents?: number;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export type ChunkSchedulingDropReason =
  | "session_not_found"
  | "stale_turn"
  | "session_terminal"
  | "session_cancelled"
  | "invalid_chunk_index"
  | "duplicate_chunk"
  | "overflow";

export type AssistantResponseMetadataIngestResult =
  | { ok: true; intent?: ChunkSchedulingIntent }
  | { ok: false; reason: ChunkSchedulingDropReason };

const DEFAULT_MAX_PENDING_INTENTS = 24;

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoiceResponseChunkScheduler {
  private readonly pendingIntents = new Map<string, ChunkSchedulingIntent>();
  private readonly clearedIntents: ChunkSchedulingIntent[] = [];
  private readonly seenChunkIndexes = new Map<string, Set<number>>();
  private readonly seenChunkIds = new Map<string, Set<string>>();
  private readonly nextExpectedChunkIndex = new Map<string, number>();
  private readonly highestSeenChunkIndex = new Map<string, number>();
  private readonly maxPendingIntents: number;

  constructor(private readonly opts: VoiceResponseChunkSchedulerOptions) {
    this.maxPendingIntents =
      opts.maxPendingIntents ?? DEFAULT_MAX_PENDING_INTENTS;
  }

  async ingest(
    event: AssistantResponseStreamMetadataEvent,
  ): Promise<AssistantResponseMetadataIngestResult> {
    const session = this.opts.supervisor.getSession(event.sessionId);
    if (!session) {
      return this.drop(event, "session_not_found");
    }
    if (this.opts.supervisor.getState().activeSessionId !== event.sessionId) {
      return this.drop(event, "stale_turn", session.state);
    }
    if (TERMINAL_STATES.has(session.state)) {
      return this.drop(event, "session_terminal", session.state);
    }

    const signal = this.opts.supervisor.getCancellationSignal(event.sessionId);
    if (session.cancellation.aborted || signal?.aborted) {
      return this.drop(event, "session_cancelled", session.state);
    }

    if (event.type === "response_started") {
      this.opts.supervisor.transition(event.sessionId, "awaiting_response");
      await this.emit(event, "voice_response_metadata_stream_started", true);
      return { ok: true };
    }

    if (event.type === "response_completed") {
      await this.emit(event, "voice_response_metadata_stream_completed", true);
      return { ok: true };
    }

    if (event.type === "response_failed") {
      await this.emit(
        event,
        "voice_response_metadata_stream_failed",
        false,
        sanitizeSchedulerError(event.error),
      );
      return { ok: true };
    }

    return this.scheduleChunk(event);
  }

  async cancelSession(sessionId: string): Promise<void> {
    const cleared = this.clearSessionIntents(sessionId, "cancelled");
    await this.opts.supervisor.cancelSession(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "cancelled",
      "voice_response_chunk_scheduling_cancelled",
      cleared,
    );
  }

  async interrupt(sessionId: string): Promise<void> {
    const cleared = this.clearSessionIntents(sessionId, "interrupted");
    await this.opts.supervisor.interrupt(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "interrupted",
      "voice_response_chunk_scheduling_interrupted",
      cleared,
    );
  }

  getPendingIntents(sessionId?: string): ChunkSchedulingIntent[] {
    return this.intentsInOrder(this.pendingIntents, sessionId);
  }

  getClearedIntents(sessionId?: string): ChunkSchedulingIntent[] {
    return this.clearedIntents
      .filter(
        (intent) => sessionId === undefined || intent.sessionId === sessionId,
      )
      .map(copyIntent);
  }

  private async scheduleChunk(
    event: Extract<
      AssistantResponseStreamMetadataEvent,
      { type: "chunk_available" }
    >,
  ): Promise<AssistantResponseMetadataIngestResult> {
    if (!Number.isInteger(event.index) || event.index < 0) {
      return this.drop(event, "invalid_chunk_index");
    }

    if (this.isDuplicateChunk(event)) {
      return this.drop(event, "duplicate_chunk");
    }

    if (
      this.getPendingIntents(event.sessionId).length >= this.maxPendingIntents
    ) {
      return this.drop(event, "overflow");
    }

    const chunk = this.opts.supervisor.recordResponseChunk({
      sessionId: event.sessionId,
      speechChunkId: event.chunkId,
      index: event.index,
    });
    if (!chunk) {
      return this.drop(event, "session_terminal");
    }

    await this.emitOrderingTelemetry(event);
    this.recordSeenChunk(event);

    const now = this.now();
    const intent: ChunkSchedulingIntent = {
      id: this.newId(),
      sessionId: event.sessionId,
      streamId: event.streamId,
      responseId: event.responseId,
      assistantResponseChunkId: event.chunkId,
      orchestrationChunkId: chunk.id,
      chunkIndex: event.index,
      state: "scheduled",
      createdAt: now,
      updatedAt: now,
    };
    this.pendingIntents.set(intent.id, intent);

    await this.emit(event, "voice_response_chunk_scheduled", true, undefined, {
      chunkId: event.chunkId,
      intentId: intent.id,
      chunkIndex: event.index,
      pendingIntentCount: this.getPendingIntents(event.sessionId).length,
    });

    return { ok: true, intent: copyIntent(intent) };
  }

  private async drop(
    event: AssistantResponseStreamMetadataEvent,
    reason: ChunkSchedulingDropReason,
    state?: VoiceTurnState,
  ): Promise<AssistantResponseMetadataIngestResult> {
    await this.emit(
      event,
      reason === "overflow"
        ? "voice_response_chunk_schedule_overflow"
        : reason === "duplicate_chunk"
          ? "voice_response_chunk_duplicate_dropped"
          : "voice_response_chunk_schedule_dropped",
      false,
      reason,
      {
        chunkId: event.type === "chunk_available" ? event.chunkId : undefined,
        chunkIndex: event.type === "chunk_available" ? event.index : undefined,
        expectedChunkIndex:
          event.type === "chunk_available"
            ? this.getNextExpectedChunkIndex(event.sessionId)
            : undefined,
        orderingIssue: reason === "duplicate_chunk" ? "duplicate" : undefined,
        pendingIntentCount: this.getPendingIntents(event.sessionId).length,
        maxPendingIntents: this.maxPendingIntents,
      },
      state,
    );
    return { ok: false, reason };
  }

  private isDuplicateChunk(
    event: Extract<
      AssistantResponseStreamMetadataEvent,
      { type: "chunk_available" }
    >,
  ): boolean {
    return (
      this.getSeenIndexes(event.sessionId).has(event.index) ||
      this.getSeenChunkIds(event.sessionId).has(event.chunkId)
    );
  }

  private async emitOrderingTelemetry(
    event: Extract<
      AssistantResponseStreamMetadataEvent,
      { type: "chunk_available" }
    >,
  ): Promise<void> {
    const expectedChunkIndex = this.getNextExpectedChunkIndex(event.sessionId);
    const highestSeen = this.highestSeenChunkIndex.get(event.sessionId);
    if (event.index > expectedChunkIndex) {
      await this.emit(
        event,
        "voice_response_chunk_gap_detected",
        true,
        undefined,
        {
          chunkId: event.chunkId,
          chunkIndex: event.index,
          expectedChunkIndex,
          orderingIssue: "gap",
        },
      );
    }
    if (highestSeen !== undefined && event.index < highestSeen) {
      await this.emit(
        event,
        "voice_response_chunk_out_of_order",
        true,
        undefined,
        {
          chunkId: event.chunkId,
          chunkIndex: event.index,
          expectedChunkIndex,
          orderingIssue: "out_of_order",
        },
      );
    }
  }

  private recordSeenChunk(
    event: Extract<
      AssistantResponseStreamMetadataEvent,
      { type: "chunk_available" }
    >,
  ): void {
    this.getSeenIndexes(event.sessionId).add(event.index);
    this.getSeenChunkIds(event.sessionId).add(event.chunkId);
    const highestSeen = this.highestSeenChunkIndex.get(event.sessionId);
    this.highestSeenChunkIndex.set(
      event.sessionId,
      highestSeen === undefined
        ? event.index
        : Math.max(highestSeen, event.index),
    );
    this.advanceExpectedChunkIndex(event.sessionId);
  }

  private advanceExpectedChunkIndex(sessionId: string): void {
    const seen = this.getSeenIndexes(sessionId);
    let expected = this.getNextExpectedChunkIndex(sessionId);
    while (seen.has(expected)) {
      expected += 1;
    }
    this.nextExpectedChunkIndex.set(sessionId, expected);
  }

  private getNextExpectedChunkIndex(sessionId: string): number {
    return this.nextExpectedChunkIndex.get(sessionId) ?? 0;
  }

  private getSeenIndexes(sessionId: string): Set<number> {
    let seen = this.seenChunkIndexes.get(sessionId);
    if (!seen) {
      seen = new Set<number>();
      this.seenChunkIndexes.set(sessionId, seen);
    }
    return seen;
  }

  private getSeenChunkIds(sessionId: string): Set<string> {
    let seen = this.seenChunkIds.get(sessionId);
    if (!seen) {
      seen = new Set<string>();
      this.seenChunkIds.set(sessionId, seen);
    }
    return seen;
  }

  private clearSessionIntents(
    sessionId: string,
    state: "cancelled" | "interrupted",
  ): number {
    let cleared = 0;
    for (const intent of this.pendingIntents.values()) {
      if (intent.sessionId !== sessionId) continue;
      const updated = {
        ...intent,
        state,
        updatedAt: this.now(),
      };
      this.pendingIntents.delete(intent.id);
      this.clearedIntents.push(updated);
      cleared += 1;
    }
    return cleared;
  }

  private intentsInOrder(
    intents: Map<string, ChunkSchedulingIntent>,
    sessionId?: string,
  ): ChunkSchedulingIntent[] {
    return Array.from(intents.values())
      .filter(
        (intent) => sessionId === undefined || intent.sessionId === sessionId,
      )
      .sort((a, b) => a.chunkIndex - b.chunkIndex || a.createdAt - b.createdAt)
      .map(copyIntent);
  }

  private async emit(
    event: AssistantResponseStreamMetadataEvent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    error?: string,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
    fallbackState?: VoiceTurnState,
  ): Promise<void> {
    const session = this.opts.supervisor.getSession(event.sessionId);
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: event.sessionId,
      state: session?.state ?? fallbackState ?? "failed",
      success,
      streamId: event.streamId,
      responseId: event.responseId,
      error,
      ...fields,
    });
  }

  private async emitSessionLifecycle(
    sessionId: string,
    state: VoiceTurnState,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    clearedIntentCount: number,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId,
      state,
      success: false,
      clearedIntentCount,
      pendingIntentCount: this.getPendingIntents(sessionId).length,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

function sanitizeSchedulerError(error: string | undefined): string {
  return error ? "metadata_stream_failed" : "metadata_stream_failed";
}

function copyIntent(intent: ChunkSchedulingIntent): ChunkSchedulingIntent {
  return { ...intent };
}
