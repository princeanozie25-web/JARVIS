export const TTS_CONTENT_CLASSES = [
  "assistant_prose",
  "tool_output",
  "code_block",
  "approval_prompt",
  "personal_context",
  "file_content",
  "error_stack",
  "audit_log",
  "transcript",
] as const;

export const TTS_CANCELLATION_REASONS = [
  "user_cancelled",
  "abort_signal",
  "timeout",
  "policy_blocked",
  "provider_unavailable",
  "unknown",
] as const;

export type TtsContentClass = (typeof TTS_CONTENT_CLASSES)[number];
export type TtsCancellationReason = (typeof TTS_CANCELLATION_REASONS)[number];

export interface TtsProviderConfig {
  readonly provider_id: string;
  readonly provider_kind: "local";
  readonly voice_id: string;
  readonly max_input_chars: number;
  readonly timeout_ms: number;
  readonly metadata_only: true;
}

export interface TtsSynthesisRequest {
  readonly request_id: string;
  readonly text: string;
  readonly content_class: TtsContentClass;
  readonly turn_id: string;
  readonly session_id: string;
  readonly requested_voice_id: string;
  readonly allow_sensitive_content: boolean;
  readonly metadata_only: true;
}

export interface TtsSynthesisOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface TtsAudioChunkMetadata {
  readonly chunk_id: string;
  readonly provider_id: string;
  readonly voice_id: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly degraded: boolean;
  readonly output_ref: string;
  readonly metadata_only: true;
}

export interface TtsExecutionDiagnostics {
  readonly stdout_preview?: string;
  readonly stderr_preview?: string;
  readonly exit_code?: number | null;
  readonly signal?: string | null;
  readonly truncated: boolean;
  readonly metadata_only: true;
}

export interface TtsSynthesisResult {
  readonly request_id: string;
  readonly chunk: TtsAudioChunkMetadata;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly diagnostics?: TtsExecutionDiagnostics;
  readonly metadata_only: true;
}

export interface TtsProviderHealth {
  readonly provider_id: string;
  readonly ok: boolean;
  readonly provider_kind: "local";
  readonly checked_at_ms: number;
  readonly degraded: boolean;
  readonly error_class?: TtsCancellationReason | "provider_error";
  readonly last_error_class?: TtsCancellationReason | "provider_error";
  readonly metadata_only: true;
}

export type TtsValidationResult =
  | {
      readonly ok: true;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly reasons: readonly TtsValidationFailureReason[];
    };

export const TTS_VALIDATION_FAILURE_REASONS = [
  "malformed_request",
  "empty_text",
  "input_too_long",
  "sensitive_content_blocked",
  "unsupported_voice",
] as const;

export type TtsValidationFailureReason =
  (typeof TTS_VALIDATION_FAILURE_REASONS)[number];
