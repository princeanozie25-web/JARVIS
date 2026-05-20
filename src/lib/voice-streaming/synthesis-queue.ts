import type { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  ChunkSchedulingIntent,
  VoiceOrchestrationTelemetryEvent,
  VoiceSynthesisQueueItem,
  VoiceSynthesisQueueItemState,
  VoiceTurnState,
} from "./types";

export interface VoiceSynthesisOrchestrationQueueOptions {
  supervisor: VoiceOrchestrationSupervisor;
  now?: () => number;
  newId?: () => string;
  maxPendingItems?: number;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export type VoiceSynthesisQueueDropReason =
  | "session_not_found"
  | "stale_turn"
  | "session_terminal"
  | "session_cancelled"
  | "invalid_intent_state"
  | "orchestration_chunk_not_found"
  | "overflow";

export type VoiceSynthesisQueueResult =
  | { ok: true; item: VoiceSynthesisQueueItem }
  | { ok: false; reason: VoiceSynthesisQueueDropReason };

const DEFAULT_MAX_PENDING_ITEMS = 24;

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoiceSynthesisOrchestrationQueue {
  private readonly pendingItems = new Map<string, VoiceSynthesisQueueItem>();
  private readonly clearedItems: VoiceSynthesisQueueItem[] = [];
  private readonly maxPendingItems: number;

  constructor(private readonly opts: VoiceSynthesisOrchestrationQueueOptions) {
    this.maxPendingItems = opts.maxPendingItems ?? DEFAULT_MAX_PENDING_ITEMS;
  }

  async enqueue(
    intent: ChunkSchedulingIntent,
  ): Promise<VoiceSynthesisQueueResult> {
    const session = this.opts.supervisor.getSession(intent.sessionId);
    if (!session) {
      return this.drop(intent, "session_not_found");
    }
    if (this.opts.supervisor.getState().activeSessionId !== intent.sessionId) {
      return this.drop(intent, "stale_turn", session.state);
    }
    if (TERMINAL_STATES.has(session.state)) {
      return this.drop(intent, "session_terminal", session.state);
    }

    const signal = this.opts.supervisor.getCancellationSignal(intent.sessionId);
    if (session.cancellation.aborted || signal?.aborted) {
      return this.drop(intent, "session_cancelled", session.state);
    }

    if (intent.state !== "scheduled") {
      return this.drop(intent, "invalid_intent_state", session.state);
    }

    if (this.getPendingItems(intent.sessionId).length >= this.maxPendingItems) {
      return this.drop(intent, "overflow", session.state);
    }

    const itemId = this.newId();
    const updatedChunk = this.opts.supervisor.recordSynthesisQueueItem({
      sessionId: intent.sessionId,
      chunkId: intent.orchestrationChunkId,
      queueItemId: itemId,
    });
    if (!updatedChunk) {
      return this.drop(intent, "orchestration_chunk_not_found", session.state);
    }

    const now = this.now();
    const item: VoiceSynthesisQueueItem = {
      id: itemId,
      sessionId: intent.sessionId,
      schedulingIntentId: intent.id,
      streamId: intent.streamId,
      responseId: intent.responseId,
      assistantResponseChunkId: intent.assistantResponseChunkId,
      orchestrationChunkId: intent.orchestrationChunkId,
      chunkIndex: intent.chunkIndex,
      state: "queued",
      createdAt: now,
      updatedAt: now,
    };
    this.pendingItems.set(item.id, item);

    await this.emit(
      intent,
      "voice_synthesis_queue_item_enqueued",
      true,
      undefined,
      {
        queueItemId: item.id,
        intentId: intent.id,
        chunkId: intent.orchestrationChunkId,
        chunkIndex: intent.chunkIndex,
        pendingSynthesisItemCount: this.getPendingItems(intent.sessionId)
          .length,
      },
    );

    return { ok: true, item: copyItem(item) };
  }

  async cancelSession(sessionId: string): Promise<void> {
    const cleared = this.clearSessionItems(sessionId, "cancelled");
    await this.opts.supervisor.cancelSession(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "cancelled",
      "voice_synthesis_queue_cancelled",
      cleared,
    );
  }

  async interrupt(sessionId: string): Promise<void> {
    const cleared = this.clearSessionItems(sessionId, "interrupted");
    await this.opts.supervisor.interrupt(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "interrupted",
      "voice_synthesis_queue_interrupted",
      cleared,
    );
  }

  clearPendingForTerminal(
    sessionId: string,
    state: Exclude<VoiceSynthesisQueueItemState, "queued">,
  ): number {
    return this.clearSessionItems(sessionId, state);
  }

  getPendingItems(sessionId?: string): VoiceSynthesisQueueItem[] {
    return this.itemsInOrder(this.pendingItems, sessionId);
  }

  getClearedItems(sessionId?: string): VoiceSynthesisQueueItem[] {
    return this.clearedItems
      .filter((item) => sessionId === undefined || item.sessionId === sessionId)
      .map(copyItem);
  }

  private async drop(
    intent: ChunkSchedulingIntent,
    reason: VoiceSynthesisQueueDropReason,
    state?: VoiceTurnState,
  ): Promise<VoiceSynthesisQueueResult> {
    await this.emit(
      intent,
      reason === "overflow"
        ? "voice_synthesis_queue_overflow"
        : "voice_synthesis_queue_item_dropped",
      false,
      reason,
      {
        intentId: intent.id,
        chunkId: intent.orchestrationChunkId,
        chunkIndex: intent.chunkIndex,
        pendingSynthesisItemCount: this.getPendingItems(intent.sessionId)
          .length,
        maxPendingSynthesisItems: this.maxPendingItems,
      },
      state,
    );
    return { ok: false, reason };
  }

  private clearSessionItems(
    sessionId: string,
    state: Exclude<VoiceSynthesisQueueItemState, "queued">,
  ): number {
    let cleared = 0;
    for (const item of this.pendingItems.values()) {
      if (item.sessionId !== sessionId) continue;
      const updated = {
        ...item,
        state,
        updatedAt: this.now(),
      };
      this.pendingItems.delete(item.id);
      this.clearedItems.push(updated);
      cleared += 1;
    }
    return cleared;
  }

  private itemsInOrder(
    items: Map<string, VoiceSynthesisQueueItem>,
    sessionId?: string,
  ): VoiceSynthesisQueueItem[] {
    return Array.from(items.values())
      .filter((item) => sessionId === undefined || item.sessionId === sessionId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex || a.createdAt - b.createdAt)
      .map(copyItem);
  }

  private async emit(
    intent: ChunkSchedulingIntent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    error?: string,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
    fallbackState?: VoiceTurnState,
  ): Promise<void> {
    const session = this.opts.supervisor.getSession(intent.sessionId);
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: intent.sessionId,
      state: session?.state ?? fallbackState ?? "failed",
      success,
      streamId: intent.streamId,
      responseId: intent.responseId,
      error,
      ...fields,
    });
  }

  private async emitSessionLifecycle(
    sessionId: string,
    state: VoiceTurnState,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    clearedSynthesisItemCount: number,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId,
      state,
      success: false,
      clearedSynthesisItemCount,
      pendingSynthesisItemCount: this.getPendingItems(sessionId).length,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

function copyItem(item: VoiceSynthesisQueueItem): VoiceSynthesisQueueItem {
  return { ...item };
}
