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
  VoiceOrchestrationTelemetryEvent,
  VoicePlaybackSequenceIntent,
  VoiceTurnState,
} from "./types";

export interface VoiceRealtimeOrchestrationPipelineOptions {
  supervisor: VoiceOrchestrationSupervisor;
  scheduler: VoiceResponseChunkScheduler;
  synthesisQueue: VoiceSynthesisOrchestrationQueue;
  playbackSequencer: VoicePlaybackSequencer;
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

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoiceRealtimeOrchestrationPipeline {
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
      await this.opts.supervisor.completeSession(event.sessionId);
      await this.emit(event, "voice_realtime_pipeline_completed", true);
      return { ok: true };
    }

    if (event.type === "response_failed") {
      await this.opts.scheduler.ingest(event);
      await this.opts.supervisor.failSession(
        event.sessionId,
        "pipeline_response_failed",
      );
      await this.emit(
        event,
        "voice_realtime_pipeline_failed",
        false,
        "pipeline_failed",
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

    const queued = await this.opts.synthesisQueue.enqueue(scheduled.intent);
    if (!queued.ok) {
      return this.drop(event, "synthesis_queue", queued.reason);
    }

    const sequenced = await this.opts.playbackSequencer.sequence({
      type: "synthesis_ready",
      item: queued.item,
      synthesisResultId: queued.item.id,
    });
    if (!sequenced.ok) {
      return this.drop(event, "playback_sequence", sequenced.reason);
    }

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
    if (await this.emitTerminalNoop(sessionId, "cancel")) return;
    await this.opts.playbackSequencer.cancelSession(sessionId);
    await this.opts.synthesisQueue.cancelSession(sessionId);
    await this.opts.scheduler.cancelSession(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "cancelled",
      "voice_realtime_pipeline_cancelled",
    );
  }

  async interrupt(sessionId: string): Promise<void> {
    if (await this.emitTerminalNoop(sessionId, "interrupt")) return;
    await this.opts.playbackSequencer.interrupt(sessionId);
    await this.opts.synthesisQueue.interrupt(sessionId);
    await this.opts.scheduler.interrupt(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "interrupted",
      "voice_realtime_pipeline_interrupted",
    );
  }

  async completeSession(sessionId: string): Promise<void> {
    if (await this.emitTerminalNoop(sessionId, "complete")) return;
    await this.opts.supervisor.completeSession(sessionId);
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "completed",
      "voice_realtime_pipeline_completed",
      true,
    );
  }

  async failSession(sessionId: string): Promise<void> {
    if (await this.emitTerminalNoop(sessionId, "fail")) return;
    await this.opts.supervisor.failSession(sessionId, "pipeline_failed");
    const session = this.opts.supervisor.getSession(sessionId);
    await this.emitSessionLifecycle(
      sessionId,
      session?.state ?? "failed",
      "voice_realtime_pipeline_failed",
      false,
      "pipeline_failed",
    );
  }

  getPlaybackIntents(sessionId?: string): VoicePlaybackSequenceIntent[] {
    return this.opts.playbackSequencer.getPendingIntents(sessionId);
  }

  private async drop(
    event: AssistantResponseStreamMetadataEvent,
    stage: VoiceRealtimePipelineDropStage,
    reason: VoiceRealtimePipelineDropReason,
    stale = false,
  ): Promise<VoiceRealtimePipelineIngestResult> {
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
      },
    );
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
    return true;
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

export function isPipelineStageResult(
  result: VoiceRealtimePipelineIngestResult,
): result is Extract<VoiceRealtimePipelineIngestResult, { ok: false }> {
  return !result.ok;
}
