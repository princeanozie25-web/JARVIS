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

export type AssistantResponseStreamMetadataEvent =
  | {
      type: "response_started";
      sessionId: string;
      streamId: string;
      responseId?: string;
      createdAt?: number;
    }
  | {
      type: "chunk_available";
      sessionId: string;
      streamId: string;
      responseId?: string;
      chunkId: string;
      index: number;
      createdAt?: number;
    }
  | {
      type: "response_completed";
      sessionId: string;
      streamId: string;
      responseId?: string;
      chunkCount?: number;
      createdAt?: number;
    }
  | {
      type: "response_failed";
      sessionId: string;
      streamId: string;
      responseId?: string;
      error?: string;
      createdAt?: number;
    };

export type ChunkSchedulingIntentState =
  | "scheduled"
  | "cancelled"
  | "interrupted";

export interface ChunkSchedulingIntent {
  id: string;
  sessionId: string;
  streamId: string;
  responseId?: string;
  assistantResponseChunkId: string;
  orchestrationChunkId: string;
  chunkIndex: number;
  state: ChunkSchedulingIntentState;
  createdAt: number;
  updatedAt: number;
}

export type VoiceSynthesisQueueItemState =
  | "queued"
  | "cancelled"
  | "interrupted";

export interface VoiceSynthesisQueueItem {
  id: string;
  sessionId: string;
  schedulingIntentId: string;
  streamId: string;
  responseId?: string;
  assistantResponseChunkId: string;
  orchestrationChunkId: string;
  chunkIndex: number;
  state: VoiceSynthesisQueueItemState;
  createdAt: number;
  updatedAt: number;
}

export type VoiceSynthesisQueueItemResult =
  | {
      type: "synthesis_ready";
      item: VoiceSynthesisQueueItem;
      synthesisResultId?: string;
      createdAt?: number;
    }
  | {
      type: "synthesis_failed";
      item?: VoiceSynthesisQueueItem;
      sessionId: string;
      queueItemId?: string;
      streamId?: string;
      responseId?: string;
      orchestrationChunkId?: string;
      chunkIndex?: number;
      error?: string;
      createdAt?: number;
    };

export type VoicePlaybackSequenceIntentState =
  | "sequenced"
  | "cancelled"
  | "interrupted";

export interface VoicePlaybackSequenceIntent {
  id: string;
  sessionId: string;
  synthesisQueueItemId: string;
  streamId: string;
  responseId?: string;
  assistantResponseChunkId: string;
  orchestrationChunkId: string;
  chunkIndex: number;
  synthesisResultId?: string;
  state: VoicePlaybackSequenceIntentState;
  createdAt: number;
  updatedAt: number;
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
  | "voice_orchestration_interrupted"
  | "voice_response_metadata_stream_started"
  | "voice_response_metadata_stream_completed"
  | "voice_response_metadata_stream_failed"
  | "voice_response_chunk_scheduled"
  | "voice_response_chunk_schedule_dropped"
  | "voice_response_chunk_schedule_overflow"
  | "voice_response_chunk_duplicate_dropped"
  | "voice_response_chunk_gap_detected"
  | "voice_response_chunk_out_of_order"
  | "voice_response_chunk_scheduling_cancelled"
  | "voice_response_chunk_scheduling_interrupted"
  | "voice_synthesis_queue_item_enqueued"
  | "voice_synthesis_queue_item_dropped"
  | "voice_synthesis_queue_overflow"
  | "voice_synthesis_queue_cancelled"
  | "voice_synthesis_queue_interrupted"
  | "voice_playback_sequence_intent_created"
  | "voice_playback_sequence_item_dropped"
  | "voice_playback_sequence_overflow"
  | "voice_playback_sequence_cancelled"
  | "voice_playback_sequence_interrupted"
  | "voice_realtime_pipeline_started"
  | "voice_realtime_pipeline_playback_intent_created"
  | "voice_realtime_pipeline_completed"
  | "voice_realtime_pipeline_cancelled"
  | "voice_realtime_pipeline_interrupted"
  | "voice_realtime_pipeline_failed"
  | "voice_realtime_pipeline_dropped"
  | "voice_realtime_pipeline_stale_event_rejected"
  | "voice_realtime_pipeline_terminal_noop";

export interface VoiceOrchestrationTelemetryEvent {
  eventType: VoiceOrchestrationTelemetryEventType;
  sessionId: string;
  state: VoiceTurnState;
  success: boolean;
  pipelineStage?: "scheduler" | "synthesis_queue" | "playback_sequence";
  terminalAction?: "cancel" | "interrupt" | "complete" | "fail";
  orderingIssue?: "duplicate" | "gap" | "out_of_order" | "late";
  streamId?: string;
  responseId?: string;
  chunkId?: string;
  intentId?: string;
  queueItemId?: string;
  playbackIntentId?: string;
  chunkIndex?: number;
  expectedChunkIndex?: number;
  pendingIntentCount?: number;
  clearedIntentCount?: number;
  maxPendingIntents?: number;
  pendingSynthesisItemCount?: number;
  clearedSynthesisItemCount?: number;
  maxPendingSynthesisItems?: number;
  pendingPlaybackIntentCount?: number;
  clearedPlaybackIntentCount?: number;
  maxPendingPlaybackIntents?: number;
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
