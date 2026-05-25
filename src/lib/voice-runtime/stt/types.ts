export const STT_CANCELLATION_REASONS = [
  "user_cancelled",
  "abort_signal",
  "timeout",
  "policy_blocked",
  "provider_unavailable",
  "unknown",
] as const;

export const STT_CONFIDENCE_BANDS = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type SttCancellationReason = (typeof STT_CANCELLATION_REASONS)[number];
export type SttConfidenceBand = (typeof STT_CONFIDENCE_BANDS)[number];

export interface SttProviderConfig {
  readonly provider_id: string;
  readonly provider_kind: "local";
  readonly model_id: string;
  readonly language?: string;
  readonly max_audio_bytes: number;
  readonly timeout_ms: number;
  readonly metadata_only: true;
}

export interface SttAudioMetadata {
  readonly audio_ref: string;
  readonly mime_type: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly sample_rate_hz?: number;
  readonly metadata_only: true;
}

export interface SttTranscriptionRequest {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly audio: SttAudioMetadata;
  readonly metadata_only: true;
}

export interface SttTranscriptionOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface SttTranscriptionResult {
  readonly request_id: string;
  readonly provider_id: string;
  readonly transcript: string;
  readonly language?: string;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly confidence_band: SttConfidenceBand;
  readonly metadata_only: true;
}

export interface SttProviderHealth {
  readonly provider_id: string;
  readonly ok: boolean;
  readonly provider_kind: "local";
  readonly checked_at_ms: number;
  readonly degraded: boolean;
  readonly error_class?: SttCancellationReason | "provider_error";
  readonly last_error_class?: SttCancellationReason | "provider_error";
  readonly metadata_only: true;
}

export const STT_VALIDATION_FAILURE_REASONS = [
  "malformed_request",
  "missing_audio_ref",
  "unsupported_audio",
  "audio_too_large",
  "audio_duration_invalid",
] as const;

export type SttValidationFailureReason =
  (typeof STT_VALIDATION_FAILURE_REASONS)[number];

export type SttValidationResult =
  | {
      readonly ok: true;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly reasons: readonly SttValidationFailureReason[];
    };
