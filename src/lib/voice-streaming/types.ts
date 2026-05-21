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
  voiceApprovalAttemptCategory?: VoiceApprovalAttemptCategory;
  voiceApprovalAttemptId?: string;
}

export type VoiceRuntimeBoundaryAdvisoryAction =
  | "surface_approval_required"
  | "surface_tool_running"
  | "surface_tool_completed"
  | "surface_tool_failed"
  | "request_runtime_cancel_advisory"
  | "surface_runtime_cancel_denied"
  | "surface_runtime_cancel_acknowledged"
  | "require_on_screen_confirmation"
  | "no_op";

export type VoiceRuntimeBoundaryAdvisoryState =
  | "observed"
  | "advisory_created"
  | "waiting_for_on_screen_confirmation"
  | "acknowledged_metadata_only"
  | "denied_metadata_only"
  | "completed_metadata_only"
  | "failed_metadata_only"
  | "rejected"
  | "no_op";

export type VoiceRuntimeBoundaryRejectionReason =
  | "voice_approval_rejected"
  | "stale_session_rejected";

export type VoiceRuntimeBoundaryOrderingIssue =
  | "duplicate"
  | "out_of_order"
  | "stale_session";

export type VoiceApprovalAttemptCategory =
  | "spoken_yes"
  | "spoken_confirm"
  | "spoken_approve"
  | "inferred_consent"
  | "ambiguous_voice_response"
  | "replayed_voice_response";

export type VoiceApprovalRefusalAction =
  | "rejected_voice_approval"
  | "require_on_screen_confirmation"
  | "no_op";

export interface VoiceApprovalRefusalRecord {
  id: string;
  eventId: string;
  sessionId: string;
  createdAt: number;
  category: VoiceApprovalAttemptCategory;
  action: VoiceApprovalRefusalAction;
  reason: VoiceRuntimeBoundaryRejectionReason;
  turnId?: string;
  runtimeCallId?: string;
  toolName?: string;
}

export interface VoiceRuntimeBoundaryAdvisoryRecord {
  id: string;
  eventId: string;
  eventType: VoiceRuntimeBoundaryEventType;
  sessionId: string;
  createdAt: number;
  action: VoiceRuntimeBoundaryAdvisoryAction;
  state: VoiceRuntimeBoundaryAdvisoryState;
  operationId: string;
  turnId?: string;
  runtimeCallId?: string;
  approvalRequestId?: string;
  toolName?: string;
  reason?: VoiceRuntimeBoundaryRejectionReason;
  orderingIssue?: VoiceRuntimeBoundaryOrderingIssue;
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

export type VoiceRestrictedContentClassification =
  | "assistant_prose_metadata"
  | "tool_output"
  | "file_content"
  | "code_block"
  | "personal_context"
  | "audit_log"
  | "runtime_output"
  | "transcript"
  | "unknown_restricted";

export type VoiceRestrictedContentDecision =
  | "allowed_for_speech_metadata"
  | "blocked_from_speech"
  | "no_op";

export interface VoiceRestrictedContentDescriptor {
  id: string;
  sessionId: string;
  classification: VoiceRestrictedContentClassification;
  createdAt?: number;
  turnId?: string;
  contentRefId?: string;
  sourceId?: string;
  terminal?: boolean;
  voiceTurnState?: VoiceTurnState;
}

export interface VoiceRestrictedContentDecisionRecord {
  id: string;
  descriptorId: string;
  sessionId: string;
  classification: VoiceRestrictedContentClassification;
  decision: VoiceRestrictedContentDecision;
  createdAt: number;
  turnId?: string;
  contentRefId?: string;
  sourceId?: string;
}

export interface VoiceRestrictedContentBoundaryResult {
  descriptor: VoiceRestrictedContentDescriptor;
  record: VoiceRestrictedContentDecisionRecord;
}

export type VoiceCloudProviderId =
  | "disabled"
  | "openai_realtime"
  | "cloud_stt"
  | "cloud_tts";

export type VoiceCloudRoutingPolicyState =
  | "disabled"
  | "consent_required"
  | "cost_disclosure_required"
  | "budget_required"
  | "eligible_metadata_only"
  | "denied";

export type VoiceCloudRoutingCapability =
  | "realtime_voice"
  | "speech_to_text"
  | "text_to_speech";

export type VoiceCloudRoutingDecision =
  | "allow_metadata_only"
  | "deny_metadata_only";

export type VoiceCloudRoutingDenialReason =
  | "policy_disabled"
  | "provider_disabled"
  | "consent_required"
  | "cost_disclosure_required"
  | "budget_required"
  | "capability_not_supported";

export interface VoiceCloudRoutingPolicyRequest {
  id: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  consentGranted: boolean;
  costDisclosureAccepted: boolean;
  budgetAvailable: boolean;
  localFallbackAvailable: boolean;
  createdAt?: number;
  voiceTurnState?: VoiceTurnState;
}

export interface VoiceCloudRoutingPolicyRecord {
  id: string;
  requestId: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  state: VoiceCloudRoutingPolicyState;
  decision: VoiceCloudRoutingDecision;
  allowed: boolean;
  consentGranted: boolean;
  costDisclosureAccepted: boolean;
  budgetAvailable: boolean;
  localFallbackAvailable: boolean;
  createdAt: number;
  denialReason?: VoiceCloudRoutingDenialReason;
}

export interface VoiceCloudRoutingPolicyResult {
  request: VoiceCloudRoutingPolicyRequest;
  record: VoiceCloudRoutingPolicyRecord;
}

export type VoiceCloudBudgetWindow = "per_session" | "daily" | "monthly";

export type VoiceCloudBudgetDimension =
  | "estimated_minutes"
  | "estimated_cost_units"
  | "request_count";

export type VoiceCloudBudgetDecision =
  | "allowed_metadata_only"
  | "denied_budget_missing"
  | "denied_budget_exceeded"
  | "denied_invalid_estimate"
  | "denied_provider_disabled";

export interface VoiceCloudBudgetLimit {
  window: VoiceCloudBudgetWindow;
  dimension: VoiceCloudBudgetDimension;
  limit: number;
  providerId?: VoiceCloudProviderId;
  requestedCapability?: VoiceCloudRoutingCapability;
}

export interface VoiceCloudBudgetUsage {
  estimatedMinutes: number;
  estimatedCostUnits: number;
  requestCount: number;
}

export interface VoiceCloudBudgetGuardRequest {
  id: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  estimatedMinutes: number;
  estimatedCostUnits: number;
  currentSessionUsage: VoiceCloudBudgetUsage;
  currentDailyUsage: VoiceCloudBudgetUsage;
  currentMonthlyUsage: VoiceCloudBudgetUsage;
  configuredLimits: VoiceCloudBudgetLimit[];
  createdAt?: number;
  voiceTurnState?: VoiceTurnState;
}

export interface VoiceCloudBudgetGuardRecord {
  id: string;
  requestId: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  decision: VoiceCloudBudgetDecision;
  allowed: boolean;
  estimatedMinutes: number;
  estimatedCostUnits: number;
  requestCount: number;
  currentSessionUsage: VoiceCloudBudgetUsage;
  currentDailyUsage: VoiceCloudBudgetUsage;
  currentMonthlyUsage: VoiceCloudBudgetUsage;
  configuredLimitCount: number;
  createdAt: number;
  exceededWindow?: VoiceCloudBudgetWindow;
  exceededDimension?: VoiceCloudBudgetDimension;
  exceededLimit?: number;
  projectedUsage?: number;
}

export interface VoiceCloudBudgetGuardResult {
  request: VoiceCloudBudgetGuardRequest;
  record: VoiceCloudBudgetGuardRecord;
}

export type VoiceCloudConsentState =
  | "disabled"
  | "consent_missing"
  | "consent_granted_metadata_only"
  | "provider_disabled";

export type VoiceCloudDisclosureState =
  | "not_evaluated"
  | "cost_disclosure_missing"
  | "provider_retention_disclosure_missing"
  | "audio_leaves_device_disclosure_missing"
  | "transcript_leaves_device_disclosure_missing"
  | "disclosures_complete_metadata_only"
  | "provider_disabled";

export type VoiceCloudConsentDecision =
  | "allowed_metadata_only"
  | "denied_consent_missing"
  | "denied_provider_disabled";

export type VoiceCloudDisclosureDecision =
  | "allowed_metadata_only"
  | "denied_cost_disclosure_missing"
  | "denied_retention_disclosure_missing"
  | "denied_audio_disclosure_missing"
  | "denied_transcript_disclosure_missing"
  | "denied_provider_disabled";

export type VoiceCloudConsentPolicyDecision =
  | VoiceCloudConsentDecision
  | VoiceCloudDisclosureDecision;

export interface VoiceCloudConsentPolicyRequest {
  id: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  consentGranted: boolean;
  costDisclosureAccepted: boolean;
  providerRetentionDisclosureAccepted: boolean;
  audioLeavesDeviceDisclosureAccepted: boolean;
  transcriptLeavesDeviceDisclosureAccepted: boolean;
  createdAt?: number;
  voiceTurnState?: VoiceTurnState;
}

export interface VoiceCloudConsentPolicyRecord {
  id: string;
  requestId: string;
  sessionId: string;
  providerId: VoiceCloudProviderId;
  requestedCapability: VoiceCloudRoutingCapability;
  consentState: VoiceCloudConsentState;
  disclosureState: VoiceCloudDisclosureState;
  decision: VoiceCloudConsentPolicyDecision;
  allowed: boolean;
  consentGranted: boolean;
  costDisclosureAccepted: boolean;
  providerRetentionDisclosureAccepted: boolean;
  audioLeavesDeviceDisclosureAccepted: boolean;
  transcriptLeavesDeviceDisclosureAccepted: boolean;
  createdAt: number;
}

export interface VoiceCloudConsentPolicyResult {
  request: VoiceCloudConsentPolicyRequest;
  record: VoiceCloudConsentPolicyRecord;
}

export type VoicePrivacyPolicyClassification =
  | "raw_audio"
  | "transcript_text"
  | "assistant_speech_text"
  | "synthesized_audio"
  | "audio_url"
  | "cloud_voice_request"
  | "local_voice_metadata"
  | "unknown_payload";

export type VoicePrivacyPolicyDecision =
  | "allowed_metadata_only"
  | "denied_raw_audio_retention"
  | "denied_audio_upload"
  | "denied_transcript_upload"
  | "denied_speech_text_retention"
  | "denied_cloud_request"
  | "denied_unknown_payload";

export interface VoicePrivacyPolicyDescriptor {
  id: string;
  sessionId: string;
  classification: VoicePrivacyPolicyClassification;
  createdAt?: number;
  turnId?: string;
  sourceId?: string;
  voiceTurnState?: VoiceTurnState;
}

export interface VoicePrivacyPolicyRecord {
  id: string;
  descriptorId: string;
  sessionId: string;
  classification: VoicePrivacyPolicyClassification;
  decision: VoicePrivacyPolicyDecision;
  allowed: boolean;
  createdAt: number;
  turnId?: string;
  sourceId?: string;
}

export interface VoicePrivacyPolicyResult {
  descriptor: VoicePrivacyPolicyDescriptor;
  record: VoicePrivacyPolicyRecord;
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
  | "voice_runtime_boundary_noop"
  | "voice_runtime_boundary_voice_approval_attempt_received"
  | "voice_runtime_boundary_on_screen_confirmation_required"
  | "voice_runtime_boundary_voice_approval_noop"
  | "voice_runtime_boundary_lifecycle_state_changed"
  | "voice_runtime_boundary_duplicate_noop"
  | "voice_runtime_boundary_stale_rejected"
  | "voice_runtime_boundary_out_of_order_observed"
  | "voice_restricted_content_descriptor_received"
  | "voice_restricted_content_allowed"
  | "voice_restricted_content_blocked"
  | "voice_restricted_content_noop"
  | "voice_cloud_routing_policy_evaluated"
  | "voice_cloud_routing_policy_allowed"
  | "voice_cloud_routing_policy_denied"
  | "voice_cloud_routing_policy_consent_required"
  | "voice_cloud_routing_policy_cost_disclosure_required"
  | "voice_cloud_routing_policy_budget_required"
  | "voice_cloud_budget_evaluated"
  | "voice_cloud_budget_allowed"
  | "voice_cloud_budget_denied"
  | "voice_cloud_budget_exceeded"
  | "voice_cloud_budget_invalid_estimate"
  | "voice_cloud_consent_evaluated"
  | "voice_cloud_consent_allowed"
  | "voice_cloud_consent_denied"
  | "voice_cloud_consent_disclosure_missing"
  | "voice_privacy_policy_evaluated"
  | "voice_privacy_policy_allowed"
  | "voice_privacy_policy_denied"
  | "voice_privacy_policy_unknown_payload";

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
  previousRuntimeBoundaryState?: VoiceRuntimeBoundaryAdvisoryState;
  nextRuntimeBoundaryState?: VoiceRuntimeBoundaryAdvisoryState;
  runtimeBoundaryReason?: VoiceRuntimeBoundaryRejectionReason;
  runtimeBoundaryOperationId?: string;
  runtimeBoundaryOrderingIssue?: VoiceRuntimeBoundaryOrderingIssue;
  voiceApprovalAttemptCategory?: VoiceApprovalAttemptCategory;
  voiceApprovalRefusalId?: string;
  voiceApprovalRefusalAction?: VoiceApprovalRefusalAction;
  runtimeCallId?: string;
  toolName?: string;
  restrictedContentDescriptorId?: string;
  restrictedContentDecisionRecordId?: string;
  restrictedContentClassification?: VoiceRestrictedContentClassification;
  restrictedContentDecision?: VoiceRestrictedContentDecision;
  contentRefId?: string;
  restrictedContentSourceId?: string;
  cloudRoutingRequestId?: string;
  cloudRoutingPolicyRecordId?: string;
  cloudProviderId?: VoiceCloudProviderId;
  cloudRequestedCapability?: VoiceCloudRoutingCapability;
  cloudRoutingPolicyState?: VoiceCloudRoutingPolicyState;
  cloudRoutingDecision?: VoiceCloudRoutingDecision;
  cloudRoutingDenialReason?: VoiceCloudRoutingDenialReason;
  cloudRoutingAllowed?: boolean;
  cloudConsentGranted?: boolean;
  cloudCostDisclosureAccepted?: boolean;
  cloudBudgetAvailable?: boolean;
  cloudLocalFallbackAvailable?: boolean;
  cloudBudgetRequestId?: string;
  cloudBudgetRecordId?: string;
  cloudBudgetDecision?: VoiceCloudBudgetDecision;
  cloudBudgetAllowed?: boolean;
  cloudEstimatedMinutes?: number;
  cloudEstimatedCostUnits?: number;
  cloudRequestCount?: number;
  cloudConfiguredLimitCount?: number;
  cloudBudgetWindow?: VoiceCloudBudgetWindow;
  cloudBudgetDimension?: VoiceCloudBudgetDimension;
  cloudBudgetLimit?: number;
  cloudProjectedUsage?: number;
  cloudConsentPolicyRequestId?: string;
  cloudConsentPolicyRecordId?: string;
  cloudConsentState?: VoiceCloudConsentState;
  cloudDisclosureState?: VoiceCloudDisclosureState;
  cloudConsentDecision?: VoiceCloudConsentPolicyDecision;
  cloudConsentAllowed?: boolean;
  cloudProviderRetentionDisclosureAccepted?: boolean;
  cloudAudioLeavesDeviceDisclosureAccepted?: boolean;
  cloudTranscriptLeavesDeviceDisclosureAccepted?: boolean;
  voicePrivacyDescriptorId?: string;
  voicePrivacyRecordId?: string;
  voicePrivacyClassification?: VoicePrivacyPolicyClassification;
  voicePrivacyDecision?: VoicePrivacyPolicyDecision;
  voicePrivacyAllowed?: boolean;
  voicePrivacySourceId?: string;
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
