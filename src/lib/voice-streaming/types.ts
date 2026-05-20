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
  | "completed"
  | "failed"
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
  | "completed"
  | "failed"
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
  | "completed"
  | "failed"
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

export type VoiceChunkReadinessState =
  | "scheduled"
  | "queued"
  | "synthesized"
  | "ready_to_play"
  | "blocked"
  | "terminal";

export type VoiceReadinessLatencyStage =
  | "scheduled"
  | "queued"
  | "synthesized"
  | "ready_to_play"
  | "blocked"
  | "terminal";

export interface VoiceChunkReadinessTimestamps {
  scheduledAt?: number;
  queuedAt?: number;
  synthesizedAt?: number;
  readyToPlayAt?: number;
  blockedAt?: number;
  terminalAt?: number;
  lastUpdatedAt: number;
}

export interface VoiceChunkReadinessRecord {
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
  terminal: boolean;
  blocked: boolean;
  firstReady: boolean;
  timestamps: VoiceChunkReadinessTimestamps;
}

export type VoiceBargeInIntentCategory =
  | "user_ptt_pressed_during_playback"
  | "user_requested_stop"
  | "user_started_new_turn"
  | "playback_preempted";

export type VoiceBargeInAction =
  | "cancel_current_voice_pipeline"
  | "clear_pending_audio_work"
  | "mark_turn_interrupted"
  | "prepare_for_new_capture"
  | "no_op";

export type VoiceBargeInState =
  | "idle"
  | "observing_playback"
  | "interrupt_requested"
  | "cancelling_current_turn"
  | "clearing_pending_work"
  | "preparing_new_capture"
  | "ready_for_capture"
  | "completed"
  | "failed";

export interface VoiceBargeInIntent {
  id: string;
  sessionId: string;
  category: VoiceBargeInIntentCategory;
  createdAt?: number;
  streamId?: string;
  responseId?: string;
  playbackIntentId?: string;
  turnId?: string;
}

export type VoiceBargeInRejectionReason =
  | "session_not_found"
  | "stale_turn"
  | "session_terminal"
  | "state_terminal"
  | "terminal_transition_in_flight"
  | "invalid_transition"
  | "transition_failed";

export type VoiceBargeInCoordinatorResult =
  | {
      ok: true;
      intent: VoiceBargeInIntent;
      actions: VoiceBargeInAction[];
      state: VoiceBargeInState;
    }
  | {
      ok: false;
      intent: VoiceBargeInIntent;
      reason: VoiceBargeInRejectionReason;
      actions: VoiceBargeInAction[];
      state: VoiceBargeInState;
    };

export interface VoiceTurnPreemptionRecord {
  id: string;
  sessionId: string;
  turnId: string;
  interruptedAt: number;
  lastReadyChunkIndex?: number;
  lastSequencedChunkIndex?: number;
  pendingChunkCount: number;
  reason: VoiceBargeInIntentCategory;
}

export type VoiceCaptureRearmState =
  | "not_requested"
  | "requested"
  | "clearing_previous_turn"
  | "ready_for_new_capture"
  | "blocked"
  | "failed";

export type VoiceCaptureRearmBlockedReason =
  | "not_requested"
  | "state_terminal"
  | "coordinator_failed"
  | VoiceBargeInRejectionReason;

export interface VoiceCaptureRearmIntentRecord {
  id: string;
  sessionId: string;
  turnId: string;
  bargeInIntentId: string;
  reason: VoiceBargeInIntentCategory;
  state: VoiceCaptureRearmState;
  requestedAt: number;
}

export interface VoiceCaptureRearmResultRecord {
  id: string;
  intentId: string;
  sessionId: string;
  turnId: string;
  bargeInIntentId: string;
  reason: VoiceBargeInIntentCategory;
  state: VoiceCaptureRearmState;
  completedAt: number;
  blockedReason?: VoiceCaptureRearmBlockedReason;
}

export type VoiceRuntimeBoundaryEventType =
  | "runtime_pending_approval_detected"
  | "runtime_tool_started"
  | "runtime_tool_completed"
  | "runtime_tool_failed"
  | "runtime_cancel_requested"
  | "runtime_cancel_denied"
  | "runtime_cancel_acknowledged";

export interface VoiceRuntimeBoundaryEvent {
  id: string;
  type: VoiceRuntimeBoundaryEventType;
  sessionId: string;
  createdAt?: number;
  turnId?: string;
  runtimeCallId?: string;
  approvalRequestId?: string;
  toolName?: string;
  voiceTurnState?: VoiceTurnState;
  voiceApprovalAttempted?: boolean;
}

export type VoiceRuntimeBoundaryAdvisoryAction =
  | "surface_approval_required"
  | "surface_tool_running"
  | "surface_tool_completed"
  | "surface_tool_failed"
  | "request_runtime_cancel_advisory"
  | "surface_runtime_cancel_denied"
  | "surface_runtime_cancel_acknowledged"
  | "reject_voice_approval"
  | "no_op";

export type VoiceRuntimeBoundaryAdvisoryState =
  | "advisory"
  | "rejected"
  | "noop";

export type VoiceRuntimeBoundaryRejectionReason = "voice_approval_rejected";

export interface VoiceRuntimeBoundaryAdvisoryRecord {
  id: string;
  eventId: string;
  eventType: VoiceRuntimeBoundaryEventType;
  sessionId: string;
  createdAt: number;
  action: VoiceRuntimeBoundaryAdvisoryAction;
  state: VoiceRuntimeBoundaryAdvisoryState;
  turnId?: string;
  runtimeCallId?: string;
  approvalRequestId?: string;
  toolName?: string;
  reason?: VoiceRuntimeBoundaryRejectionReason;
}

export type VoiceRuntimeBoundaryCoordinatorResult =
  | {
      ok: true;
      event: VoiceRuntimeBoundaryEvent;
      advisory: VoiceRuntimeBoundaryAdvisoryRecord;
    }
  | {
      ok: false;
      event: VoiceRuntimeBoundaryEvent;
      advisory: VoiceRuntimeBoundaryAdvisoryRecord;
      reason: VoiceRuntimeBoundaryRejectionReason;
    };

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
  | "voice_realtime_pipeline_fanout_started"
  | "voice_realtime_pipeline_fanout_completed"
  | "voice_realtime_pipeline_fanout_noop"
  | "voice_realtime_pipeline_terminal_started"
  | "voice_realtime_pipeline_terminal_completed"
  | "voice_realtime_pipeline_terminal_failed"
  | "voice_realtime_pipeline_terminal_noop"
  | "voice_realtime_chunk_readiness_changed"
  | "voice_realtime_first_chunk_ready"
  | "voice_realtime_chunk_readiness_timeout"
  | "voice_realtime_stage_latency_marker"
  | "voice_barge_in_intent_received"
  | "voice_barge_in_action_selected"
  | "voice_barge_in_noop"
  | "voice_barge_in_intent_rejected"
  | "voice_barge_in_state_transition"
  | "voice_barge_in_invalid_transition"
  | "voice_barge_in_terminal_noop"
  | "voice_barge_in_transition_failed"
  | "voice_turn_preemption_recorded"
  | "voice_turn_preemption_noop"
  | "voice_turn_preemption_rejected"
  | "voice_capture_rearm_requested"
  | "voice_capture_rearm_ready"
  | "voice_capture_rearm_blocked"
  | "voice_capture_rearm_failed"
  | "voice_capture_rearm_noop"
  | "voice_runtime_boundary_event_received"
  | "voice_runtime_boundary_advisory_selected"
  | "voice_runtime_boundary_voice_approval_rejected"
  | "voice_runtime_boundary_noop";

export type VoiceOrchestrationTerminalAction =
  | "cancel"
  | "interrupt"
  | "complete"
  | "fail";

export type VoiceOrchestrationFailureClass =
  | "metadata_stream"
  | "scheduler"
  | "synthesis_queue"
  | "playback_sequence"
  | "terminal_lifecycle";

export type VoiceOrchestrationFailureReason =
  | "response_failed"
  | "pipeline_failed"
  | "scheduler_overflow"
  | "synthesis_queue_overflow"
  | "playback_sequence_overflow"
  | "scheduler_stage_failed"
  | "synthesis_queue_stage_failed"
  | "playback_sequence_stage_failed"
  | "terminal_transition_failed";

export interface VoiceOrchestrationTelemetryEvent {
  eventType: VoiceOrchestrationTelemetryEventType;
  sessionId: string;
  state: VoiceTurnState;
  success: boolean;
  pipelineStage?: "scheduler" | "synthesis_queue" | "playback_sequence";
  terminalAction?: VoiceOrchestrationTerminalAction;
  failureClass?: VoiceOrchestrationFailureClass;
  failureReason?: VoiceOrchestrationFailureReason;
  readinessState?: VoiceChunkReadinessState;
  previousReadinessState?: VoiceChunkReadinessState;
  latencyStage?: VoiceReadinessLatencyStage;
  bargeInIntentId?: string;
  bargeInIntentCategory?: VoiceBargeInIntentCategory;
  bargeInAction?: VoiceBargeInAction;
  bargeInRejectionReason?: VoiceBargeInRejectionReason;
  bargeInState?: VoiceBargeInState;
  previousBargeInState?: VoiceBargeInState;
  nextBargeInState?: VoiceBargeInState;
  preemptionRecordId?: string;
  turnId?: string;
  interruptedAt?: number;
  lastReadyChunkIndex?: number;
  lastSequencedChunkIndex?: number;
  pendingChunkCount?: number;
  preemptionReason?: VoiceBargeInIntentCategory;
  captureRearmIntentId?: string;
  captureRearmResultId?: string;
  captureRearmState?: VoiceCaptureRearmState;
  previousCaptureRearmState?: VoiceCaptureRearmState;
  nextCaptureRearmState?: VoiceCaptureRearmState;
  captureRearmBlockedReason?: VoiceCaptureRearmBlockedReason;
  runtimeBoundaryEventId?: string;
  runtimeBoundaryEventType?: VoiceRuntimeBoundaryEventType;
  runtimeBoundaryAdvisoryId?: string;
  runtimeBoundaryAction?: VoiceRuntimeBoundaryAdvisoryAction;
  runtimeBoundaryState?: VoiceRuntimeBoundaryAdvisoryState;
  runtimeBoundaryReason?: VoiceRuntimeBoundaryRejectionReason;
  runtimeCallId?: string;
  approvalRequestId?: string;
  toolName?: string;
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
  scheduledAt?: number;
  queuedAt?: number;
  synthesizedAt?: number;
  readyToPlayAt?: number;
  blockedAt?: number;
  terminalAt?: number;
  stageStartedAt?: number;
  stageCompletedAt?: number;
  latencyMs?: number;
  readinessTimeoutMs?: number;
  starvationAgeMs?: number;
  firstReady?: boolean;
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
