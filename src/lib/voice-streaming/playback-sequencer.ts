import type { VoiceOrchestrationSupervisor } from "./supervisor";
import { emitMetadataOnlyVoiceTelemetry } from "./telemetry-hygiene";
import type {
  VoiceOrchestrationTelemetryEvent,
  VoicePlaybackSequenceIntent,
  VoicePlaybackSequenceIntentState,
  VoiceSynthesisQueueItem,
  VoiceSynthesisQueueItemResult,
  VoiceTurnState,
} from "./types";

export interface VoicePlaybackSequencerOptions {
  supervisor: VoiceOrchestrationSupervisor;
  now?: () => number;
  newId?: () => string;
  maxPendingIntents?: number;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export type VoicePlaybackSequencingDropReason =
  | "session_not_found"
  | "stale_turn"
  | "session_terminal"
  | "session_cancelled"
  | "invalid_synthesis_item_state"
  | "missing_synthesis_item"
  | "synthesis_failed"
  | "orchestration_chunk_not_found"
  | "overflow";

export type VoicePlaybackSequencingInput =
  | VoiceSynthesisQueueItem
  | VoiceSynthesisQueueItemResult;

export type VoicePlaybackSequencingResult =
  | { ok: true; intent: VoicePlaybackSequenceIntent }
  | { ok: false; reason: VoicePlaybackSequencingDropReason };

const DEFAULT_MAX_PENDING_INTENTS = 24;

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoicePlaybackSequencer {
  private readonly pendingIntents = new Map<
    string,
    VoicePlaybackSequenceIntent
  >();
  private readonly clearedIntents: VoicePlaybackSequenceIntent[] = [];
  private readonly maxPendingIntents: number;

  constructor(private readonly opts: VoicePlaybackSequencerOptions) {
    this.maxPendingIntents =
      opts.maxPendingIntents ?? DEFAULT_MAX_PENDING_INTENTS;
  }

  async sequence(
    input: VoicePlaybackSequencingInput,
  ): Promise<VoicePlaybackSequencingResult> {
    const normalized = normalizeInput(input);
    if (!normalized.item) {
      return this.drop(normalized, "missing_synthesis_item");
    }
    if (normalized.failed) {
      return this.drop(normalized, "synthesis_failed");
    }

    const item = normalized.item;
    const session = this.opts.supervisor.getSession(item.sessionId);
    if (!session) {
      return this.drop(normalized, "session_not_found");
    }
    if (this.opts.supervisor.getState().activeSessionId !== item.sessionId) {
      return this.drop(normalized, "stale_turn", session.state);
    }
    if (TERMINAL_STATES.has(session.state)) {
      return this.drop(normalized, "session_terminal", session.state);
    }

    const signal = this.opts.supervisor.getCancellationSignal(item.sessionId);
    if (session.cancellation.aborted || signal?.aborted) {
      return this.drop(normalized, "session_cancelled", session.state);
    }

    if (item.state !== "queued") {
      return this.drop(
        normalized,
        "invalid_synthesis_item_state",
        session.state,
      );
    }

    if (
      this.getPendingIntents(item.sessionId).length >= this.maxPendingIntents
    ) {
      return this.drop(normalized, "overflow", session.state);
    }

    const intentId = this.newId();
    const updatedChunk = this.opts.supervisor.markChunkReady({
      sessionId: item.sessionId,
      chunkId: item.orchestrationChunkId,
      playbackItemId: intentId,
    });
    if (!updatedChunk) {
      return this.drop(
        normalized,
        "orchestration_chunk_not_found",
        session.state,
      );
    }

    const now = this.now();
    const intent: VoicePlaybackSequenceIntent = {
      id: intentId,
      sessionId: item.sessionId,
      synthesisQueueItemId: item.id,
      streamId: item.streamId,
      responseId: item.responseId,
      assistantResponseChunkId: item.assistantResponseChunkId,
      orchestrationChunkId: item.orchestrationChunkId,
      chunkIndex: item.chunkIndex,
      synthesisResultId: normalized.synthesisResultId,
      state: "sequenced",
      createdAt: now,
      updatedAt: now,
    };
    this.pendingIntents.set(intent.id, intent);

    await this.emit(
      normalized,
      "voice_playback_sequence_intent_created",
      true,
      undefined,
      {
        playbackIntentId: intent.id,
        queueItemId: item.id,
        chunkId: item.orchestrationChunkId,
        chunkIndex: item.chunkIndex,
        pendingPlaybackIntentCount: this.getPendingIntents(item.sessionId)
          .length,
      },
    );

    return { ok: true, intent: copyIntent(intent) };
  }

  async cancelSession(sessionId: string): Promise<void> {
    const cleared = this.clearSessionIntents(sessionId, "cancelled");
    await this.opts.supervisor.cancelSession(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "cancelled",
      "voice_playback_sequence_cancelled",
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
      "voice_playback_sequence_interrupted",
      cleared,
    );
  }

  clearPendingForTerminal(
    sessionId: string,
    state: Exclude<VoicePlaybackSequenceIntentState, "sequenced">,
  ): number {
    return this.clearSessionIntents(sessionId, state);
  }

  getPendingIntents(sessionId?: string): VoicePlaybackSequenceIntent[] {
    return this.intentsInOrder(this.pendingIntents, sessionId);
  }

  getClearedIntents(sessionId?: string): VoicePlaybackSequenceIntent[] {
    return this.clearedIntents
      .filter(
        (intent) => sessionId === undefined || intent.sessionId === sessionId,
      )
      .map(copyIntent);
  }

  private async drop(
    input: NormalizedPlaybackSequencingInput,
    reason: VoicePlaybackSequencingDropReason,
    state?: VoiceTurnState,
  ): Promise<VoicePlaybackSequencingResult> {
    await this.emit(
      input,
      reason === "overflow"
        ? "voice_playback_sequence_overflow"
        : "voice_playback_sequence_item_dropped",
      false,
      reason,
      {
        queueItemId: input.queueItemId,
        chunkId: input.orchestrationChunkId,
        chunkIndex: input.chunkIndex,
        pendingPlaybackIntentCount: this.getPendingIntents(input.sessionId)
          .length,
        maxPendingPlaybackIntents: this.maxPendingIntents,
      },
      state,
    );
    return { ok: false, reason };
  }

  private clearSessionIntents(
    sessionId: string,
    state: Exclude<VoicePlaybackSequenceIntentState, "sequenced">,
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
    intents: Map<string, VoicePlaybackSequenceIntent>,
    sessionId?: string,
  ): VoicePlaybackSequenceIntent[] {
    return Array.from(intents.values())
      .filter(
        (intent) => sessionId === undefined || intent.sessionId === sessionId,
      )
      .sort((a, b) => a.chunkIndex - b.chunkIndex || a.createdAt - b.createdAt)
      .map(copyIntent);
  }

  private async emit(
    input: NormalizedPlaybackSequencingInput,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    error?: string,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
    fallbackState?: VoiceTurnState,
  ): Promise<void> {
    const session = this.opts.supervisor.getSession(input.sessionId);
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId: input.sessionId,
      state: session?.state ?? fallbackState ?? "failed",
      success,
      streamId: input.streamId,
      responseId: input.responseId,
      error,
      ...fields,
    });
  }

  private async emitSessionLifecycle(
    sessionId: string,
    state: VoiceTurnState,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    clearedPlaybackIntentCount: number,
  ): Promise<void> {
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId,
      state,
      success: false,
      clearedPlaybackIntentCount,
      pendingPlaybackIntentCount: this.getPendingIntents(sessionId).length,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

interface NormalizedPlaybackSequencingInput {
  item?: VoiceSynthesisQueueItem;
  failed: boolean;
  sessionId: string;
  queueItemId?: string;
  streamId?: string;
  responseId?: string;
  orchestrationChunkId?: string;
  chunkIndex?: number;
  synthesisResultId?: string;
}

function normalizeInput(
  input: VoicePlaybackSequencingInput,
): NormalizedPlaybackSequencingInput {
  if ("type" in input) {
    if (input.type === "synthesis_ready") {
      return {
        item: input.item,
        failed: false,
        sessionId: input.item.sessionId,
        queueItemId: input.item.id,
        streamId: input.item.streamId,
        responseId: input.item.responseId,
        orchestrationChunkId: input.item.orchestrationChunkId,
        chunkIndex: input.item.chunkIndex,
        synthesisResultId: input.synthesisResultId,
      };
    }

    return {
      item: input.item,
      failed: true,
      sessionId: input.item?.sessionId ?? input.sessionId,
      queueItemId: input.item?.id ?? input.queueItemId,
      streamId: input.item?.streamId ?? input.streamId,
      responseId: input.item?.responseId ?? input.responseId,
      orchestrationChunkId:
        input.item?.orchestrationChunkId ?? input.orchestrationChunkId,
      chunkIndex: input.item?.chunkIndex ?? input.chunkIndex,
    };
  }

  return {
    item: input,
    failed: false,
    sessionId: input.sessionId,
    queueItemId: input.id,
    streamId: input.streamId,
    responseId: input.responseId,
    orchestrationChunkId: input.orchestrationChunkId,
    chunkIndex: input.chunkIndex,
  };
}

function copyIntent(
  intent: VoicePlaybackSequenceIntent,
): VoicePlaybackSequenceIntent {
  return { ...intent };
}
