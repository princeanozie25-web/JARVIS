export const VOICE_CAPTURE_STATES = [
  "idle",
  "arming",
  "capturing",
  "endpoint_detected",
  "transcribing",
  "cancelled",
  "failed",
] as const;

export const VOICE_PLAYBACK_STATES = [
  "idle",
  "queueing",
  "synthesizing",
  "playing",
  "interrupted",
  "completed",
  "failed",
] as const;

export const VOICE_PROVIDER_KINDS = ["stt", "tts", "mock"] as const;

export const VOICE_CANCELLATION_REASONS = [
  "user_cancelled",
  "abort_signal",
  "timeout",
  "barge_in",
  "governance_blocked",
  "provider_unavailable",
  "unknown",
] as const;

export type VoiceCaptureState = (typeof VOICE_CAPTURE_STATES)[number];
export type VoicePlaybackState = (typeof VOICE_PLAYBACK_STATES)[number];
export type VoiceProviderKind = (typeof VOICE_PROVIDER_KINDS)[number];
export type VoiceCancellationReason =
  (typeof VOICE_CANCELLATION_REASONS)[number];

export interface VoiceRuntimeConfig {
  readonly push_to_talk_only: true;
  readonly wake_word_enabled: false;
  readonly always_listening_enabled: false;
  readonly background_recording_enabled: false;
  readonly hidden_mic_activation_enabled: false;
  readonly voice_approval_authority: false;
  readonly transcript_telemetry_persistence_enabled: false;
  readonly raw_audio_persistence_enabled: false;
  readonly bypass_approval_layers: false;
  readonly bypass_runtime_router: false;
  readonly bypass_safety_layers: false;
}

export interface VoiceCancellationToken {
  readonly cancellation_id: string;
  readonly session_id: string;
  readonly reason: VoiceCancellationReason;
  readonly requested_at_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface VoiceTurn {
  readonly turn_id: string;
  readonly session_id: string;
  readonly started_at_ms: number;
  readonly ended_at_ms?: number;
  readonly capture_state: VoiceCaptureState;
  readonly playback_state: VoicePlaybackState;
  readonly cancellation?: VoiceCancellationToken;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoiceSession {
  readonly session_id: string;
  readonly created_at_ms: number;
  readonly updated_at_ms: number;
  readonly capture_state: VoiceCaptureState;
  readonly playback_state: VoicePlaybackState;
  readonly turns: readonly VoiceTurn[];
  readonly cancellation?: VoiceCancellationToken;
  readonly config: VoiceRuntimeConfig;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoiceProviderHealth {
  readonly provider_id: string;
  readonly provider_kind: VoiceProviderKind;
  readonly ok: boolean;
  readonly checked_at_ms: number;
  readonly latency_ms?: number;
  readonly degraded: boolean;
  readonly error_class?: VoiceCancellationReason | "provider_error";
  readonly metadata_only: true;
}

export interface VoiceAudioBufferMetadata {
  readonly buffer_id: string;
  readonly duration_ms: number;
  readonly sample_rate_hz?: number;
  readonly channel_count?: number;
  readonly byte_length?: number;
  readonly mime_type?: string;
  readonly metadata_only: true;
}

export interface VoiceAudioChunkMetadata {
  readonly chunk_id: string;
  readonly duration_ms: number;
  readonly sequence_index: number;
  readonly mime_type?: string;
  readonly metadata_only: true;
}

export interface VoiceProviderRequestProvenance {
  readonly session_id: string;
  readonly turn_id?: string;
  readonly requested_at_ms: number;
  readonly source: "voice_runtime_contract";
  readonly metadata_only: true;
}
