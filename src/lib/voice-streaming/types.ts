import type { PlaybackItem, SpeechQueueItem } from "../tts";
import type { VoiceTranscriptDraft } from "../stt";

export type VoiceTurnState =
  | "idle"
  | "capturing"
  | "transcribing"
  | "drafting"
  | "waiting_for_send"
  | "awaiting_response"
  | "chunking_response"
  | "synthesizing"
  | "ready_to_play"
  | "playing"
  | "interrupted"
  | "cancelled"
  | "completed"
  | "failed";

export type StreamingSpeechChunkState =
  | "queued"
  | "synthesizing"
  | "ready_to_play"
  | "playing"
  | "completed"
  | "cancelled"
  | "failed";

export interface StreamingSpeechChunk {
  id: string;
  sessionId: string;
  index: number;
  source: "assistant_response";
  state: StreamingSpeechChunkState;
  createdAt: number;
  updatedAt: number;
  speechChunkId?: string;
  queueItemId?: string;
  playbackItemId?: string;
  error?: string;
}

export interface StreamingSpeechSession {
  id: string;
  state: VoiceTurnState;
  createdAt: number;
  updatedAt: number;
  startedAt: number;
  completedAt?: number;
  timeoutAt?: number;
  active: boolean;
  cancellation: {
    aborted: boolean;
  };
  metadata: {
    transcriptDraftId?: string;
    transcriptionJobId?: string;
    responseChunkCount: number;
    synthesisQueueItemIds: string[];
    playbackItemId?: string;
  };
}

export interface OrchestrationState {
  activeSessionId: string | null;
  sessions: StreamingSpeechSession[];
  chunks: StreamingSpeechChunk[];
  canAutoplay: false;
}

export type VoiceOrchestrationTelemetryEventType =
  | "voice_session_started"
  | "voice_session_cancelled"
  | "voice_session_completed"
  | "voice_session_failed"
  | "voice_orchestration_interrupted";

export interface VoiceOrchestrationTelemetryEvent {
  eventType: VoiceOrchestrationTelemetryEventType;
  sessionId: string;
  state: VoiceTurnState;
  success: boolean;
  durationMs?: number;
  error?: string;
}

export interface VoiceStreamingCoordinationMetadata {
  transcriptDraft?: Pick<VoiceTranscriptDraft, "id" | "sourceJobId" | "status">;
  synthesisQueueItems: Array<
    Pick<SpeechQueueItem, "id" | "chunkId" | "status">
  >;
  playbackItem?: Pick<PlaybackItem, "id" | "audioId" | "chunkId" | "status">;
}
