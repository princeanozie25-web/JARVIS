import type {
  ChunkSchedulingDropReason,
  VoiceResponseChunkScheduler,
} from "./scheduler";
import type {
  VoicePlaybackSequencer,
  VoicePlaybackSequencingDropReason,
} from "./playback-sequencer";
import type { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  VoiceSynthesisOrchestrationQueue,
  VoiceSynthesisQueueDropReason,
} from "./synthesis-queue";
import type {
  AssistantResponseStreamMetadataEvent,
  ChunkSchedulingIntentState,
  StreamingSpeechSession,
  VoiceChunkReadinessRecord,
  VoiceChunkReadinessState,
  VoiceOrchestrationFailureClass,
  VoiceOrchestrationFailureReason,
  VoiceOrchestrationTelemetryEvent,
  VoiceOrchestrationTerminalAction,
  VoicePlaybackSequenceIntent,
  VoicePlaybackSequenceIntentState,
  VoiceSynthesisQueueItemState,
  VoiceTurnState,
} from "./types";

export interface VoiceRealtimeOrchestrationPipelineOptions {
  supervisor: VoiceOrchestrationSupervisor;
  scheduler: VoiceResponseChunkScheduler;
  synthesisQueue: VoiceSynthesisOrchestrationQueue;
  playbackSequencer: VoicePlaybackSequencer;
  now?: () => number;
  readinessTimeoutMs?: number;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export type VoiceRealtimePipelineDropStage =
  | "scheduler"
  | "synthesis_queue"
  | "playback_sequence";

export type VoiceRealtimePipelineDropReason =
  | ChunkSchedulingDropReason
  | VoiceSynthesisQueueDropReason
  | VoicePlaybackSequencingDropReason
  | "response_failed"
  | "stale_turn";

export type VoiceRealtimePipelineIngestResult =
  | { ok: true; playbackIntent?: VoicePlaybackSequenceIntent }
  | {
      ok: false;
      stage: VoiceRealtimePipelineDropStage;
      reason: VoiceRealtimePipelineDropReason;
    };

interface TerminalTransitionResult {
  state: VoiceTurnState;
  clearedIntentCount: number;
  clearedSynthesisItemCount: number;
  clearedPlaybackIntentCount: number;
}

interface TerminalTransitionInput {
  sessionId: string;
  terminalAction: VoiceOrchestrationTerminalAction;
  success: boolean;
  error?: string;
  failureClass?: VoiceOrchestrationFailureClass;
  failureReason?: VoiceOrchestrationFailureReason;
  supervisorTransition: () => Promise<StreamingSpeechSession | null>;
}

interface ReadinessUpdateInput {
  sessionId: string;
  streamId?: string;
  responseId?: string;
  assistantResponseChunkId?: string;
  orchestrationChunkId?: string;
  schedulingIntentId?: string;
  synthesisQueueItemId?: string;
  playbackIntentId?: string;
  chunkIndex: number;
  state: VoiceChunkReadinessState;
  at: number;
}

type PipelineStageTerminalState = Exclude<
  ChunkSchedulingIntentState,
  "scheduled"
> &
  Exclude<VoiceSynthesisQueueItemState, "queued"> &
  Exclude<VoicePlaybackSequenceIntentState, "sequenced">;

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoiceRealtimeOrchestrationPipeline {
  private readonly activeTerminalTransitions = new Set<string>();
  private readonly chunkReadiness = new Map<
    string,
    VoiceChunkReadinessRecord
  >();
  private readonly firstReadyBySession = new Map<
    string,
    VoiceChunkReadinessRecord
  >();
  private readonly timedOutReadinessKeys = new Set<string>();

  constructor(
    private readonly opts: VoiceRealtimeOrchestrationPipelineOptions,
  ) {}

  async ingest(
    event: AssistantResponseStreamMetadataEvent,
  ): Promise<VoiceRealtimePipelineIngestResult> {
    const stale = this.getStaleEventReason(event.sessionId);
    if (stale) {
      return this.drop(event, "scheduler", stale, true);
    }

    if (event.type === "response_started") {
      const result = await this.opts.scheduler.ingest(event);
      if (!result.ok) return this.drop(event, "scheduler", result.reason);
      await this.emit(event, "voice_realtime_pipeline_started", true);
      return { ok: true };
    }

    if (event.type === "response_completed") {
      const result = await this.opts.scheduler.ingest(event);
      if (!result.ok) return this.drop(event, "scheduler", result.reason);
      await this.transitionTerminal({
        sessionId: event.sessionId,
        terminalAction: "complete",
        success: true,
        supervisorTransition: () =>
          this.opts.supervisor.completeSession(event.sessionId),
      });
      await this.emit(event, "voice_realtime_pipeline_completed", true);
      return { ok: true };
    }

    if (event.type === "response_failed") {
      await this.opts.scheduler.ingest(event);
      await this.transitionTerminal({
        sessionId: event.sessionId,
        terminalAction: "fail",
        success: false,
        error: "pipeline_failed",
        failureClass: "metadata_stream",
        failureReason: "response_failed",
        supervisorTransition: () =>
          this.opts.supervisor.failSession(
            event.sessionId,
            "pipeline_response_failed",
          ),
      });
      await this.emit(
        event,
        "voice_realtime_pipeline_failed",
        false,
        "pipeline_failed",
        {
          failureClass: "metadata_stream",
          failureReason: "response_failed",
        },
      );
      return { ok: false, stage: "scheduler", reason: "response_failed" };
    }

    const scheduled = await this.opts.scheduler.ingest(event);
    if (!scheduled.ok) {
      return this.drop(event, "scheduler", scheduled.reason);
    }
    if (!scheduled.intent) {
      return { ok: true };
    }
    await this.blockSkippedChunkIndexes(event);
    await this.updateReadiness({
      sessionId: scheduled.intent.sessionId,
      streamId: scheduled.intent.streamId,
      responseId: scheduled.intent.responseId,
      assistantResponseChunkId: scheduled.intent.assistantResponseChunkId,
      orchestrationChunkId: scheduled.intent.orchestrationChunkId,
      schedulingIntentId: scheduled.intent.id,
      chunkIndex: scheduled.intent.chunkIndex,
      state: "scheduled",
      at: scheduled.intent.createdAt,
    });

    const queued = await this.opts.synthesisQueue.enqueue(scheduled.intent);
    if (!queued.ok) {
      return this.drop(event, "synthesis_queue", queued.reason);
    }
    await this.updateReadiness({
      sessionId: queued.item.sessionId,
      streamId: queued.item.streamId,
      responseId: queued.item.responseId,
      assistantResponseChunkId: queued.item.assistantResponseChunkId,
      orchestrationChunkId: queued.item.orchestrationChunkId,
      schedulingIntentId: queued.item.schedulingIntentId,
      synthesisQueueItemId: queued.item.id,
      chunkIndex: queued.item.chunkIndex,
      state: "queued",
      at: queued.item.createdAt,
    });

    const sequenced = await this.opts.playbackSequencer.sequence({
      type: "synthesis_ready",
      item: queued.item,
      synthesisResultId: queued.item.id,
    });
    if (!sequenced.ok) {
      return this.drop(event, "playback_sequence", sequenced.reason);
    }
    await this.updateReadiness({
      sessionId: queued.item.sessionId,
      streamId: queued.item.streamId,
      responseId: queued.item.responseId,
      assistantResponseChunkId: queued.item.assistantResponseChunkId,
      orchestrationChunkId: queued.item.orchestrationChunkId,
      schedulingIntentId: queued.item.schedulingIntentId,
      synthesisQueueItemId: queued.item.id,
      chunkIndex: queued.item.chunkIndex,
      state: "synthesized",
      at: sequenced.intent.createdAt,
    });
    await this.updateReadiness({
      sessionId: sequenced.intent.sessionId,
      streamId: sequenced.intent.streamId,
      responseId: sequenced.intent.responseId,
      assistantResponseChunkId: sequenced.intent.assistantResponseChunkId,
      orchestrationChunkId: sequenced.intent.orchestrationChunkId,
      synthesisQueueItemId: sequenced.intent.synthesisQueueItemId,
      playbackIntentId: sequenced.intent.id,
      chunkIndex: sequenced.intent.chunkIndex,
      state: "ready_to_play",
      at: sequenced.intent.updatedAt,
    });

    await this.emit(
      event,
      "voice_realtime_pipeline_playback_intent_created",
      true,
      undefined,
      {
        pipelineStage: "playback_sequence",
        playbackIntentId: sequenced.intent.id,
        queueItemId: queued.item.id,
        intentId: scheduled.intent.id,
        chunkId: scheduled.intent.orchestrationChunkId,
        chunkIndex: scheduled.intent.chunkIndex,
      },
    );

    return { ok: true, playbackIntent: sequenced.intent };
  }

  async cancelSession(sessionId: string): Promise<void> {
    const transition = await this.transitionTerminal({
      sessionId,
      terminalAction: "cancel",
      success: false,
      error: "cancelled",
      supervisorTransition: () => this.opts.supervisor.cancelSession(sessionId),
    });
    if (!transition) return;
    await this.emitSessionLifecycle(
      sessionId,
      transition.state,
      "voice_realtime_pipeline_cancelled",
    );
  }

  async interrupt(sessionId: string): Promise<void> {
    const transition = await this.transitionTerminal({
      sessionId,
      terminalAction: "interrupt",
      success: false,
      error: "interrupted",
      supervisorTransition: () => this.opts.supervisor.interrupt(sessionId),
    });
    if (!transition) return;
    await this.emitSessionLifecycle(
      sessionId,
      transition.state,
      "voice_realtime_pipeline_interrupted",
    );
  }

  async completeSession(sessionId: string): Promise<void> {
    const transition = await this.transitionTerminal({
      sessionId,
      terminalAction: "complete",
      success: true,
      supervisorTransition: () =>
        this.opts.supervisor.completeSession(sessionId),
    });
    if (!transition) return;
    await this.emitSessionLifecycle(
      sessionId,
      transition.state,
      "voice_realtime_pipeline_completed",
      true,
    );
  }

  async failSession(sessionId: string): Promise<void> {
    const transition = await this.transitionTerminal({
      sessionId,
      terminalAction: "fail",
      success: false,
      error: "pipeline_failed",
      failureClass: "terminal_lifecycle",
      failureReason: "pipeline_failed",
      supervisorTransition: () =>
        this.opts.supervisor.failSession(sessionId, "pipeline_failed"),
    });
    if (!transition) return;
    await this.emitSessionLifecycle(
      sessionId,
      transition.state,
      "voice_realtime_pipeline_failed",
      false,
      "pipeline_failed",
    );
  }

  getPlaybackIntents(sessionId?: string): VoicePlaybackSequenceIntent[] {
    return this.opts.playbackSequencer.getPendingIntents(sessionId);
  }

  getChunkReadiness(sessionId?: string): VoiceChunkReadinessRecord[] {
    return Array.from(this.chunkReadiness.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(copyReadinessRecord);
  }

  getFirstReadyChunk(sessionId: string): VoiceChunkReadinessRecord | null {
    const record = this.firstReadyBySession.get(sessionId);
    return record ? copyReadinessRecord(record) : null;
  }

  async detectReadinessTimeouts(
    sessionId?: string,
    now = this.now(),
  ): Promise<VoiceChunkReadinessRecord[]> {
    const timeoutMs = this.opts.readinessTimeoutMs;
    if (timeoutMs === undefined) return [];

    const timedOut: VoiceChunkReadinessRecord[] = [];
    for (const record of this.chunkReadiness.values()) {
      if (sessionId !== undefined && record.sessionId !== sessionId) continue;
      const key = readinessKey(record.sessionId, record.chunkIndex);
      if (record.terminal || record.state === "ready_to_play") {
        continue;
      }
      if (this.timedOutReadinessKeys.has(key)) continue;
      const ageMs = now - readinessStartedAt(record);
      if (ageMs < timeoutMs) continue;
      const updated =
        record.state === "blocked"
          ? copyReadinessRecord(record)
          : await this.updateReadiness({
              sessionId: record.sessionId,
              streamId: record.streamId,
              responseId: record.responseId,
              assistantResponseChunkId: record.assistantResponseChunkId,
              orchestrationChunkId: record.orchestrationChunkId,
              schedulingIntentId: record.schedulingIntentId,
              synthesisQueueItemId: record.synthesisQueueItemId,
              playbackIntentId: record.playbackIntentId,
              chunkIndex: record.chunkIndex,
              state: "blocked",
              at: now,
            });
      this.timedOutReadinessKeys.add(key);
      await this.emitReadinessTimeout(updated, timeoutMs, ageMs);
      timedOut.push(copyReadinessRecord(updated));
    }
    return timedOut;
  }

  private async drop(
    event: AssistantResponseStreamMetadataEvent,
    stage: VoiceRealtimePipelineDropStage,
    reason: VoiceRealtimePipelineDropReason,
    stale = false,
  ): Promise<VoiceRealtimePipelineIngestResult> {
    const failure = this.getTerminalFailureForDrop(stage, reason, stale);
    await this.emit(
      event,
      stale
        ? "voice_realtime_pipeline_stale_event_rejected"
        : "voice_realtime_pipeline_dropped",
      false,
      reason,
      {
        pipelineStage: stage,
        chunkIndex: event.type === "chunk_available" ? event.index : undefined,
        orderingIssue: stale ? "late" : undefined,
        failureClass: failure?.failureClass,
        failureReason: failure?.failureReason,
      },
    );
    if (failure) {
      await this.transitionTerminal({
        sessionId: event.sessionId,
        terminalAction: "fail",
        success: false,
        error: "pipeline_failed",
        failureClass: failure.failureClass,
        failureReason: failure.failureReason,
        supervisorTransition: () =>
          this.opts.supervisor.failSession(event.sessionId, "pipeline_failed"),
      });
    }
    return { ok: false, stage, reason };
  }

  private getStaleEventReason(
    sessionId: string,
  ): VoiceRealtimePipelineDropReason | null {
    const session = this.opts.supervisor.getSession(sessionId);
    if (!session) return "session_not_found";
    if (this.opts.supervisor.getState().activeSessionId !== sessionId) {
      return "stale_turn";
    }
    return null;
  }

  private async emitTerminalNoop(
    sessionId: string,
    terminalAction: NonNullable<
      VoiceOrchestrationTelemetryEvent["terminalAction"]
    >,
  ): Promise<boolean> {
    const session = this.opts.supervisor.getSession(sessionId);
    if (!session || !TERMINAL_STATES.has(session.state)) return false;
    await this.opts.emitTelemetry?.({
      eventType: "voice_realtime_pipeline_terminal_noop",
      sessionId,
      state: session.state,
      success: true,
      terminalAction,
    });
    if (terminalAction === "cancel" || terminalAction === "interrupt") {
      await this.emitFanoutLifecycle(
        sessionId,
        session.state,
        "voice_realtime_pipeline_fanout_noop",
        terminalAction,
        true,
      );
    }
    return true;
  }

  private async transitionTerminal(
    input: TerminalTransitionInput,
  ): Promise<TerminalTransitionResult | null> {
    if (await this.emitTerminalNoop(input.sessionId, input.terminalAction)) {
      return null;
    }

    if (this.activeTerminalTransitions.has(input.sessionId)) {
      const session = this.opts.supervisor.getSession(input.sessionId);
      await this.emitTerminalLifecycle({
        eventType: "voice_realtime_pipeline_terminal_noop",
        sessionId: input.sessionId,
        state:
          session?.state ??
          terminalFallbackStateForAction(input.terminalAction),
        terminalAction: input.terminalAction,
        success: true,
        failureClass: input.failureClass,
        failureReason: input.failureReason,
      });
      if (isFanoutAction(input.terminalAction)) {
        await this.emitFanoutLifecycle(
          input.sessionId,
          session?.state ??
            terminalFallbackStateForAction(input.terminalAction),
          "voice_realtime_pipeline_fanout_noop",
          input.terminalAction,
          true,
        );
      }
      return null;
    }

    const pending = this.getPendingCounts(input.sessionId);
    const startingSession = this.opts.supervisor.getSession(input.sessionId);
    const startingState =
      startingSession?.state ??
      terminalFallbackStateForAction(input.terminalAction);

    this.activeTerminalTransitions.add(input.sessionId);
    await this.emitTerminalLifecycle({
      eventType: "voice_realtime_pipeline_terminal_started",
      sessionId: input.sessionId,
      state: startingState,
      terminalAction: input.terminalAction,
      success: input.success,
      failureClass: input.failureClass,
      failureReason: input.failureReason,
      ...pending,
    });
    if (isFanoutAction(input.terminalAction)) {
      await this.emitFanoutLifecycle(
        input.sessionId,
        startingState,
        "voice_realtime_pipeline_fanout_started",
        input.terminalAction,
        true,
        pending,
      );
    }

    try {
      const session = await input.supervisorTransition();
      const state =
        session?.state ?? terminalFallbackStateForAction(input.terminalAction);
      const cleared = this.clearPendingForTerminal(
        input.sessionId,
        input.terminalAction,
      );
      await this.markSessionReadinessTerminal(
        input.sessionId,
        session?.completedAt ?? this.now(),
      );
      const remaining = this.getPendingCounts(input.sessionId);

      if (isFanoutAction(input.terminalAction)) {
        await this.emitFanoutLifecycle(
          input.sessionId,
          state,
          "voice_realtime_pipeline_fanout_completed",
          input.terminalAction,
          true,
          {
            ...cleared,
            ...remaining,
          },
        );
      }
      await this.emitTerminalLifecycle({
        eventType: "voice_realtime_pipeline_terminal_completed",
        sessionId: input.sessionId,
        state,
        terminalAction: input.terminalAction,
        success: input.success,
        error: input.error,
        failureClass: input.failureClass,
        failureReason: input.failureReason,
        ...cleared,
        ...remaining,
      });

      return {
        state,
        clearedIntentCount: cleared.clearedIntentCount ?? 0,
        clearedSynthesisItemCount: cleared.clearedSynthesisItemCount ?? 0,
        clearedPlaybackIntentCount: cleared.clearedPlaybackIntentCount ?? 0,
      };
    } catch {
      await this.emitTerminalLifecycle({
        eventType: "voice_realtime_pipeline_terminal_failed",
        sessionId: input.sessionId,
        state: terminalFallbackStateForAction(input.terminalAction),
        terminalAction: input.terminalAction,
        success: false,
        error: "terminal_transition_failed",
        failureClass: "terminal_lifecycle",
        failureReason: "terminal_transition_failed",
      });
      throw new Error("terminal_transition_failed");
    } finally {
      this.activeTerminalTransitions.delete(input.sessionId);
    }
  }

  private async emitFanoutLifecycle(
    sessionId: string,
    state: VoiceTurnState,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    terminalAction: NonNullable<
      VoiceOrchestrationTelemetryEvent["terminalAction"]
    >,
    success: boolean,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId,
      state,
      success,
      terminalAction,
      ...fields,
    });
  }

  private async blockSkippedChunkIndexes(
    event: Extract<
      AssistantResponseStreamMetadataEvent,
      { type: "chunk_available" }
    >,
  ): Promise<void> {
    for (let index = 0; index < event.index; index += 1) {
      if (this.chunkReadiness.has(readinessKey(event.sessionId, index))) {
        continue;
      }
      await this.updateReadiness({
        sessionId: event.sessionId,
        streamId: event.streamId,
        responseId: event.responseId,
        chunkIndex: index,
        state: "blocked",
        at: event.createdAt ?? this.now(),
      });
    }
  }

  private async updateReadiness(
    input: ReadinessUpdateInput,
  ): Promise<VoiceChunkReadinessRecord> {
    const key = readinessKey(input.sessionId, input.chunkIndex);
    const existing = this.chunkReadiness.get(key);
    if (existing?.terminal && input.state !== "terminal") {
      return copyReadinessRecord(existing);
    }

    const previousState = existing?.state;
    const timestamps = updateReadinessTimestamps(
      existing?.timestamps,
      input.state,
      input.at,
    );
    const record: VoiceChunkReadinessRecord = {
      sessionId: input.sessionId,
      streamId: input.streamId ?? existing?.streamId,
      responseId: input.responseId ?? existing?.responseId,
      assistantResponseChunkId:
        input.assistantResponseChunkId ?? existing?.assistantResponseChunkId,
      orchestrationChunkId:
        input.orchestrationChunkId ?? existing?.orchestrationChunkId,
      schedulingIntentId:
        input.schedulingIntentId ?? existing?.schedulingIntentId,
      synthesisQueueItemId:
        input.synthesisQueueItemId ?? existing?.synthesisQueueItemId,
      playbackIntentId: input.playbackIntentId ?? existing?.playbackIntentId,
      chunkIndex: input.chunkIndex,
      state: input.state,
      terminal: input.state === "terminal",
      blocked: input.state === "blocked",
      firstReady: existing?.firstReady ?? false,
      timestamps,
    };
    if (record.terminal) {
      record.firstReady = false;
    }
    this.chunkReadiness.set(key, record);

    if (previousState !== input.state) {
      await this.emitReadinessChanged(record, previousState);
    }
    await this.emitStageLatency(record, input.state);

    if (input.state === "ready_to_play") {
      await this.updateFirstReadyChunk(input.sessionId);
    }
    if (input.state === "terminal") {
      this.updateFirstReadyCache(input.sessionId);
    }

    return copyReadinessRecord(record);
  }

  private async markSessionReadinessTerminal(
    sessionId: string,
    at: number,
  ): Promise<void> {
    const records = this.getChunkReadiness(sessionId);
    for (const record of records) {
      if (record.terminal) continue;
      await this.updateReadiness({
        sessionId: record.sessionId,
        streamId: record.streamId,
        responseId: record.responseId,
        assistantResponseChunkId: record.assistantResponseChunkId,
        orchestrationChunkId: record.orchestrationChunkId,
        schedulingIntentId: record.schedulingIntentId,
        synthesisQueueItemId: record.synthesisQueueItemId,
        playbackIntentId: record.playbackIntentId,
        chunkIndex: record.chunkIndex,
        state: "terminal",
        at,
      });
    }
    this.updateFirstReadyCache(sessionId);
  }

  private async updateFirstReadyChunk(sessionId: string): Promise<void> {
    const previous = this.firstReadyBySession.get(sessionId);
    const firstReady = this.updateFirstReadyCache(sessionId);
    if (!firstReady) return;
    if (previous?.chunkIndex === firstReady.chunkIndex) return;
    await this.opts.emitTelemetry?.({
      eventType: "voice_realtime_first_chunk_ready",
      sessionId,
      state:
        this.opts.supervisor.getSession(sessionId)?.state ?? "ready_to_play",
      success: true,
      streamId: firstReady.streamId,
      responseId: firstReady.responseId,
      chunkId: firstReady.orchestrationChunkId,
      intentId: firstReady.schedulingIntentId,
      queueItemId: firstReady.synthesisQueueItemId,
      playbackIntentId: firstReady.playbackIntentId,
      chunkIndex: firstReady.chunkIndex,
      readinessState: firstReady.state,
      readyToPlayAt: firstReady.timestamps.readyToPlayAt,
      firstReady: true,
    });
  }

  private updateFirstReadyCache(
    sessionId: string,
  ): VoiceChunkReadinessRecord | null {
    const ready = this.getChunkReadiness(sessionId).filter(
      (record) => record.state === "ready_to_play" && !record.terminal,
    );
    const firstReady = ready[0];
    for (const record of this.chunkReadiness.values()) {
      if (record.sessionId !== sessionId) continue;
      record.firstReady =
        firstReady !== undefined && record.chunkIndex === firstReady.chunkIndex;
    }
    if (!firstReady) {
      this.firstReadyBySession.delete(sessionId);
      return null;
    }
    const stored = this.chunkReadiness.get(
      readinessKey(sessionId, firstReady.chunkIndex),
    );
    if (!stored) return firstReady;
    stored.firstReady = true;
    this.firstReadyBySession.set(sessionId, copyReadinessRecord(stored));
    return copyReadinessRecord(stored);
  }

  private async emitReadinessChanged(
    record: VoiceChunkReadinessRecord,
    previousState: VoiceChunkReadinessState | undefined,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType: "voice_realtime_chunk_readiness_changed",
      sessionId: record.sessionId,
      state:
        this.opts.supervisor.getSession(record.sessionId)?.state ?? "failed",
      success: record.state !== "blocked",
      streamId: record.streamId,
      responseId: record.responseId,
      chunkId: record.orchestrationChunkId,
      intentId: record.schedulingIntentId,
      queueItemId: record.synthesisQueueItemId,
      playbackIntentId: record.playbackIntentId,
      chunkIndex: record.chunkIndex,
      readinessState: record.state,
      previousReadinessState: previousState,
      scheduledAt: record.timestamps.scheduledAt,
      queuedAt: record.timestamps.queuedAt,
      synthesizedAt: record.timestamps.synthesizedAt,
      readyToPlayAt: record.timestamps.readyToPlayAt,
      blockedAt: record.timestamps.blockedAt,
      terminalAt: record.timestamps.terminalAt,
      firstReady: record.firstReady,
    });
  }

  private async emitStageLatency(
    record: VoiceChunkReadinessRecord,
    state: VoiceChunkReadinessState,
  ): Promise<void> {
    const marker = latencyMarkerForState(record, state);
    await this.opts.emitTelemetry?.({
      eventType: "voice_realtime_stage_latency_marker",
      sessionId: record.sessionId,
      state:
        this.opts.supervisor.getSession(record.sessionId)?.state ?? "failed",
      success: state !== "blocked",
      streamId: record.streamId,
      responseId: record.responseId,
      chunkId: record.orchestrationChunkId,
      intentId: record.schedulingIntentId,
      queueItemId: record.synthesisQueueItemId,
      playbackIntentId: record.playbackIntentId,
      chunkIndex: record.chunkIndex,
      readinessState: state,
      latencyStage: state,
      stageStartedAt: marker.stageStartedAt,
      stageCompletedAt: marker.stageCompletedAt,
      latencyMs: marker.latencyMs,
    });
  }

  private async emitReadinessTimeout(
    record: VoiceChunkReadinessRecord,
    timeoutMs: number,
    ageMs: number,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType: "voice_realtime_chunk_readiness_timeout",
      sessionId: record.sessionId,
      state:
        this.opts.supervisor.getSession(record.sessionId)?.state ?? "failed",
      success: false,
      streamId: record.streamId,
      responseId: record.responseId,
      chunkId: record.orchestrationChunkId,
      intentId: record.schedulingIntentId,
      queueItemId: record.synthesisQueueItemId,
      playbackIntentId: record.playbackIntentId,
      chunkIndex: record.chunkIndex,
      readinessState: record.state,
      readinessTimeoutMs: timeoutMs,
      starvationAgeMs: ageMs,
    });
  }

  private getTerminalFailureForDrop(
    stage: VoiceRealtimePipelineDropStage,
    reason: VoiceRealtimePipelineDropReason,
    stale: boolean,
  ): {
    failureClass: VoiceOrchestrationFailureClass;
    failureReason: VoiceOrchestrationFailureReason;
  } | null {
    if (stale || !shouldFailClosed(reason)) return null;
    if (stage === "scheduler") {
      return {
        failureClass: "scheduler",
        failureReason:
          reason === "overflow"
            ? "scheduler_overflow"
            : "scheduler_stage_failed",
      };
    }
    if (stage === "synthesis_queue") {
      return {
        failureClass: "synthesis_queue",
        failureReason:
          reason === "overflow"
            ? "synthesis_queue_overflow"
            : "synthesis_queue_stage_failed",
      };
    }
    return {
      failureClass: "playback_sequence",
      failureReason:
        reason === "overflow"
          ? "playback_sequence_overflow"
          : "playback_sequence_stage_failed",
    };
  }

  private getPendingCounts(
    sessionId: string,
  ): Pick<
    VoiceOrchestrationTelemetryEvent,
    | "pendingIntentCount"
    | "pendingSynthesisItemCount"
    | "pendingPlaybackIntentCount"
  > {
    return {
      pendingIntentCount:
        this.opts.scheduler.getPendingIntents(sessionId).length,
      pendingSynthesisItemCount:
        this.opts.synthesisQueue.getPendingItems(sessionId).length,
      pendingPlaybackIntentCount:
        this.opts.playbackSequencer.getPendingIntents(sessionId).length,
    };
  }

  private clearPendingForTerminal(
    sessionId: string,
    terminalAction: VoiceOrchestrationTerminalAction,
  ): Pick<
    VoiceOrchestrationTelemetryEvent,
    | "clearedIntentCount"
    | "clearedSynthesisItemCount"
    | "clearedPlaybackIntentCount"
  > {
    const state = stageTerminalStateForAction(terminalAction);
    const clearedPlaybackIntentCount =
      this.opts.playbackSequencer.clearPendingForTerminal(sessionId, state);
    const clearedSynthesisItemCount =
      this.opts.synthesisQueue.clearPendingForTerminal(sessionId, state);
    const clearedIntentCount = this.opts.scheduler.clearPendingForTerminal(
      sessionId,
      state,
    );
    return {
      clearedIntentCount,
      clearedSynthesisItemCount,
      clearedPlaybackIntentCount,
    };
  }

  private async emitTerminalLifecycle(
    fields: VoiceOrchestrationTelemetryEvent,
  ): Promise<void> {
    await this.opts.emitTelemetry?.(fields);
  }

  private async emit(
    event: AssistantResponseStreamMetadataEvent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    error?: string,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    const session = this.opts.supervisor.getSession(event.sessionId);
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: event.sessionId,
      state: session?.state ?? terminalFallbackState(eventType),
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
    success = false,
    error?: string,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId,
      state,
      success,
      error,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }
}

function terminalFallbackState(
  eventType: VoiceOrchestrationTelemetryEvent["eventType"],
): VoiceTurnState {
  if (eventType === "voice_realtime_pipeline_completed") return "completed";
  if (eventType === "voice_realtime_pipeline_cancelled") return "cancelled";
  if (eventType === "voice_realtime_pipeline_interrupted") return "interrupted";
  if (eventType === "voice_realtime_pipeline_failed") return "failed";
  return "failed";
}

function terminalFallbackStateForAction(
  terminalAction: NonNullable<
    VoiceOrchestrationTelemetryEvent["terminalAction"]
  >,
): VoiceTurnState {
  if (terminalAction === "cancel") return "cancelled";
  if (terminalAction === "interrupt") return "interrupted";
  if (terminalAction === "complete") return "completed";
  return "failed";
}

function stageTerminalStateForAction(
  terminalAction: VoiceOrchestrationTerminalAction,
): PipelineStageTerminalState {
  if (terminalAction === "cancel") return "cancelled";
  if (terminalAction === "interrupt") return "interrupted";
  if (terminalAction === "complete") return "completed";
  return "failed";
}

function isFanoutAction(
  terminalAction: VoiceOrchestrationTerminalAction,
): terminalAction is "cancel" | "interrupt" {
  return terminalAction === "cancel" || terminalAction === "interrupt";
}

function shouldFailClosed(reason: VoiceRealtimePipelineDropReason): boolean {
  return (
    reason !== "session_not_found" &&
    reason !== "stale_turn" &&
    reason !== "session_terminal" &&
    reason !== "session_cancelled" &&
    reason !== "duplicate_chunk" &&
    reason !== "invalid_chunk_index"
  );
}

function readinessKey(sessionId: string, chunkIndex: number): string {
  return `${sessionId}:${chunkIndex}`;
}

function updateReadinessTimestamps(
  current: VoiceChunkReadinessRecord["timestamps"] | undefined,
  state: VoiceChunkReadinessState,
  at: number,
): VoiceChunkReadinessRecord["timestamps"] {
  const timestamps: VoiceChunkReadinessRecord["timestamps"] = {
    ...current,
    lastUpdatedAt: at,
  };
  if (state === "scheduled") timestamps.scheduledAt = at;
  if (state === "queued") timestamps.queuedAt = at;
  if (state === "synthesized") timestamps.synthesizedAt = at;
  if (state === "ready_to_play") timestamps.readyToPlayAt = at;
  if (state === "blocked") timestamps.blockedAt = at;
  if (state === "terminal") timestamps.terminalAt = at;
  return timestamps;
}

function readinessStartedAt(record: VoiceChunkReadinessRecord): number {
  return (
    record.timestamps.scheduledAt ??
    record.timestamps.queuedAt ??
    record.timestamps.synthesizedAt ??
    record.timestamps.readyToPlayAt ??
    record.timestamps.blockedAt ??
    record.timestamps.terminalAt ??
    record.timestamps.lastUpdatedAt
  );
}

function latencyMarkerForState(
  record: VoiceChunkReadinessRecord,
  state: VoiceChunkReadinessState,
): {
  stageStartedAt: number;
  stageCompletedAt: number;
  latencyMs: number;
} {
  const completedAt = record.timestamps.lastUpdatedAt;
  const startedAt =
    state === "queued"
      ? (record.timestamps.scheduledAt ?? completedAt)
      : state === "synthesized"
        ? (record.timestamps.queuedAt ?? completedAt)
        : state === "ready_to_play"
          ? (record.timestamps.synthesizedAt ?? completedAt)
          : state === "blocked" || state === "terminal"
            ? readinessStartedAt(record)
            : completedAt;
  return {
    stageStartedAt: startedAt,
    stageCompletedAt: completedAt,
    latencyMs: Math.max(0, completedAt - startedAt),
  };
}

function copyReadinessRecord(
  record: VoiceChunkReadinessRecord,
): VoiceChunkReadinessRecord {
  return {
    ...record,
    timestamps: { ...record.timestamps },
  };
}

export function isPipelineStageResult(
  result: VoiceRealtimePipelineIngestResult,
): result is Extract<VoiceRealtimePipelineIngestResult, { ok: false }> {
  return !result.ok;
}
