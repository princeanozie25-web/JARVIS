import { InMemorySpeechQueueManager, InMemoryPlaybackManager } from "../tts";
import { emitMetadataOnlyVoiceTelemetry } from "./telemetry-hygiene";
import type {
  OrchestrationState,
  StreamingSpeechChunk,
  StreamingSpeechChunkState,
  StreamingSpeechSession,
  VoiceOrchestrationTelemetryEvent,
  VoiceStreamingCoordinationMetadata,
  VoiceTurnState,
} from "./types";

export interface VoiceOrchestrationSupervisorOptions {
  now?: () => number;
  newId?: () => string;
  timeoutMs?: number;
  speechQueueManager?: InMemorySpeechQueueManager;
  playbackManager?: InMemoryPlaybackManager;
  clearTranscriptDraft?: () => void | Promise<void>;
  cancelSynthesis?: (signal: AbortSignal) => void | Promise<void>;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export type StartVoiceSessionResult =
  | { ok: true; session: StreamingSpeechSession; signal: AbortSignal }
  | { ok: false; reason: "active_session_exists" };

export interface StartVoiceSessionOptions {
  timeoutMs?: number;
}

interface ActiveVoiceSession {
  sessionId: string;
  controller: AbortController;
  timeout?: ReturnType<typeof setTimeout>;
}

const TERMINAL_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

export class VoiceOrchestrationSupervisor {
  private readonly sessions = new Map<string, StreamingSpeechSession>();
  private readonly chunks = new Map<string, StreamingSpeechChunk>();
  private active: ActiveVoiceSession | null = null;

  constructor(
    private readonly opts: VoiceOrchestrationSupervisorOptions = {},
  ) {}

  async startSession(
    options: StartVoiceSessionOptions = {},
  ): Promise<StartVoiceSessionResult> {
    if (this.active) {
      return { ok: false, reason: "active_session_exists" };
    }

    const id = this.newId();
    const startedAt = this.now();
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs;
    const controller = new AbortController();
    const session: StreamingSpeechSession = {
      id,
      state: "idle",
      createdAt: startedAt,
      updatedAt: startedAt,
      startedAt,
      timeoutAt: timeoutMs ? startedAt + timeoutMs : undefined,
      active: true,
      cancellation: { aborted: false },
      metadata: {
        responseChunkCount: 0,
        synthesisQueueItemIds: [],
      },
    };

    this.sessions.set(id, session);
    this.active = { sessionId: id, controller };
    if (timeoutMs) {
      this.active.timeout = setTimeout(() => {
        void this.failSession(id, "session_timeout");
      }, timeoutMs);
    }

    await this.emit("voice_session_started", session, true);
    return {
      ok: true,
      session: copySession(session),
      signal: controller.signal,
    };
  }

  transition(
    sessionId: string,
    state: VoiceTurnState,
  ): StreamingSpeechSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || TERMINAL_STATES.has(session.state)) {
      return session ? copySession(session) : null;
    }
    session.state = state;
    session.updatedAt = this.now();
    return copySession(session);
  }

  recordTranscriptDraft(input: {
    sessionId: string;
    draftId: string;
    transcriptionJobId?: string;
  }): StreamingSpeechSession | null {
    const session = this.sessions.get(input.sessionId);
    if (!session || TERMINAL_STATES.has(session.state)) {
      return session ? copySession(session) : null;
    }
    session.metadata.transcriptDraftId = input.draftId;
    session.metadata.transcriptionJobId = input.transcriptionJobId;
    session.state = "drafting";
    session.updatedAt = this.now();
    return copySession(session);
  }

  recordResponseChunk(input: {
    sessionId: string;
    speechChunkId: string;
    index: number;
  }): StreamingSpeechChunk | null {
    const session = this.sessions.get(input.sessionId);
    if (!session || TERMINAL_STATES.has(session.state)) return null;

    const now = this.now();
    const chunk: StreamingSpeechChunk = {
      id: this.newId(),
      sessionId: input.sessionId,
      index: input.index,
      source: "assistant_response",
      state: "queued",
      createdAt: now,
      updatedAt: now,
      speechChunkId: input.speechChunkId,
    };
    this.chunks.set(chunk.id, chunk);
    session.state = "chunking_response";
    session.updatedAt = now;
    session.metadata.responseChunkCount += 1;
    return copyChunk(chunk);
  }

  recordSynthesisQueueItem(input: {
    sessionId: string;
    chunkId: string;
    queueItemId: string;
  }): StreamingSpeechChunk | null {
    const updated = this.updateChunk(input.sessionId, input.chunkId, {
      state: "synthesizing",
      queueItemId: input.queueItemId,
    });
    const session = this.sessions.get(input.sessionId);
    if (session && !TERMINAL_STATES.has(session.state)) {
      session.state = "synthesizing";
      session.updatedAt = this.now();
      if (!session.metadata.synthesisQueueItemIds.includes(input.queueItemId)) {
        session.metadata.synthesisQueueItemIds.push(input.queueItemId);
      }
    }
    return updated;
  }

  markChunkReady(input: {
    sessionId: string;
    chunkId: string;
    playbackItemId?: string;
  }): StreamingSpeechChunk | null {
    const updated = this.updateChunk(input.sessionId, input.chunkId, {
      state: "ready_to_play",
      playbackItemId: input.playbackItemId,
    });
    const session = this.sessions.get(input.sessionId);
    if (session && !TERMINAL_STATES.has(session.state)) {
      session.state = "ready_to_play";
      session.updatedAt = this.now();
      if (input.playbackItemId) {
        session.metadata.playbackItemId = input.playbackItemId;
      }
    }
    return updated;
  }

  markManualPlaybackStarted(input: {
    sessionId: string;
    chunkId: string;
    playbackItemId: string;
  }): StreamingSpeechChunk | null {
    const updated = this.updateChunk(input.sessionId, input.chunkId, {
      state: "playing",
      playbackItemId: input.playbackItemId,
    });
    const session = this.sessions.get(input.sessionId);
    if (session && !TERMINAL_STATES.has(session.state)) {
      session.state = "playing";
      session.updatedAt = this.now();
      session.metadata.playbackItemId = input.playbackItemId;
    }
    return updated;
  }

  async interrupt(sessionId: string): Promise<StreamingSpeechSession | null> {
    const session = await this.finishSession({
      sessionId,
      state: "interrupted",
      eventType: "voice_orchestration_interrupted",
      success: false,
      error: "interrupted",
      abort: true,
      cleanup: true,
    });
    return session;
  }

  async cancelSession(
    sessionId: string,
  ): Promise<StreamingSpeechSession | null> {
    return this.finishSession({
      sessionId,
      state: "cancelled",
      eventType: "voice_session_cancelled",
      success: false,
      error: "cancelled",
      abort: true,
      cleanup: true,
    });
  }

  async completeSession(
    sessionId: string,
  ): Promise<StreamingSpeechSession | null> {
    return this.finishSession({
      sessionId,
      state: "completed",
      eventType: "voice_session_completed",
      success: true,
      cleanup: false,
    });
  }

  async failSession(
    sessionId: string,
    error = "session_failed",
  ): Promise<StreamingSpeechSession | null> {
    return this.finishSession({
      sessionId,
      state: "failed",
      eventType: "voice_session_failed",
      success: false,
      error: sanitizeOrchestrationError(error),
      abort: true,
      cleanup: true,
    });
  }

  getCancellationSignal(sessionId: string): AbortSignal | null {
    return this.active?.sessionId === sessionId
      ? this.active.controller.signal
      : null;
  }

  getCoordinationMetadata(
    sessionId: string,
  ): VoiceStreamingCoordinationMetadata | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const queueItems =
      this.opts.speechQueueManager?.listItems().map((item) => ({
        id: item.id,
        chunkId: item.chunkId,
        status: item.status,
      })) ?? [];
    const playback = this.opts.playbackManager?.getActiveItem();
    return {
      transcriptDraft:
        session.metadata.transcriptDraftId !== undefined
          ? {
              id: session.metadata.transcriptDraftId,
              sourceJobId: session.metadata.transcriptionJobId ?? "",
              status: "draft",
            }
          : undefined,
      synthesisQueueItems: queueItems,
      playbackItem: playback
        ? {
            id: playback.id,
            audioId: playback.audioId,
            chunkId: playback.chunkId,
            status: playback.status,
          }
        : undefined,
    };
  }

  getState(): OrchestrationState {
    return {
      activeSessionId: this.active?.sessionId ?? null,
      sessions: Array.from(this.sessions.values(), copySession),
      chunks: Array.from(this.chunks.values(), copyChunk),
      canAutoplay: false,
    };
  }

  getSession(sessionId: string): StreamingSpeechSession | null {
    const session = this.sessions.get(sessionId);
    return session ? copySession(session) : null;
  }

  private updateChunk(
    sessionId: string,
    chunkId: string,
    update: {
      state: StreamingSpeechChunkState;
      queueItemId?: string;
      playbackItemId?: string;
      error?: string;
    },
  ): StreamingSpeechChunk | null {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.sessionId !== sessionId) return null;
    chunk.state = update.state;
    chunk.updatedAt = this.now();
    chunk.queueItemId = update.queueItemId ?? chunk.queueItemId;
    chunk.playbackItemId = update.playbackItemId ?? chunk.playbackItemId;
    chunk.error = update.error ?? chunk.error;
    return copyChunk(chunk);
  }

  private async finishSession(input: {
    sessionId: string;
    state: Extract<
      VoiceTurnState,
      "interrupted" | "cancelled" | "completed" | "failed"
    >;
    eventType: VoiceOrchestrationTelemetryEvent["eventType"];
    success: boolean;
    error?: string;
    abort?: boolean;
    cleanup?: boolean;
  }): Promise<StreamingSpeechSession | null> {
    const session = this.sessions.get(input.sessionId);
    if (!session) return null;
    if (TERMINAL_STATES.has(session.state)) return copySession(session);

    const completedAt = this.now();
    session.state = input.state;
    session.updatedAt = completedAt;
    session.completedAt = completedAt;
    session.active = false;

    const active =
      this.active?.sessionId === input.sessionId ? this.active : null;
    if (active?.timeout) clearTimeout(active.timeout);
    if (input.abort && active && !active.controller.signal.aborted) {
      active.controller.abort();
    }
    session.cancellation.aborted = Boolean(active?.controller.signal.aborted);

    if (input.cleanup) {
      await this.cleanupSessionResources(
        input.sessionId,
        active?.controller.signal,
      );
    }
    if (active) {
      this.active = null;
    }

    await this.emit(input.eventType, session, input.success, input.error);
    return copySession(session);
  }

  private async cleanupSessionResources(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.markSessionChunks(sessionId, "cancelled");
    this.opts.speechQueueManager?.cancelAll();
    this.opts.playbackManager?.cancel();
    this.opts.playbackManager?.cleanup();
    if (signal) {
      await ignoreCleanupFailure(this.opts.cancelSynthesis?.(signal));
    }
    await ignoreCleanupFailure(this.opts.clearTranscriptDraft?.());
  }

  private markSessionChunks(
    sessionId: string,
    state: StreamingSpeechChunkState,
  ): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.sessionId !== sessionId) continue;
      if (
        chunk.state === "completed" ||
        chunk.state === "cancelled" ||
        chunk.state === "failed"
      ) {
        continue;
      }
      chunk.state = state;
      chunk.updatedAt = this.now();
    }
  }

  private async emit(
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    session: StreamingSpeechSession,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId: session.id,
      state: session.state,
      success,
      durationMs:
        session.completedAt !== undefined
          ? Math.max(0, session.completedAt - session.startedAt)
          : undefined,
      error,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

function sanitizeOrchestrationError(error: string): string {
  if (error === "session_timeout") return "session_timeout";
  if (error === "cancelled") return "cancelled";
  if (error === "interrupted") return "interrupted";
  return "voice_session_failed";
}

async function ignoreCleanupFailure(
  result: void | Promise<void>,
): Promise<void> {
  try {
    await result;
  } catch {
    // Cleanup is best-effort so terminal state and telemetry are still recorded.
  }
}

function copySession(session: StreamingSpeechSession): StreamingSpeechSession {
  return {
    ...session,
    cancellation: { ...session.cancellation },
    metadata: {
      ...session.metadata,
      synthesisQueueItemIds: [...session.metadata.synthesisQueueItemIds],
    },
  };
}

function copyChunk(chunk: StreamingSpeechChunk): StreamingSpeechChunk {
  return { ...chunk };
}
