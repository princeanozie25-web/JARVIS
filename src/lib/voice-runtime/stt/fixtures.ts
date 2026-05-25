import type {
  SttProviderConfig,
  SttProviderHealth,
  SttTranscriptionRequest,
} from "./types";

export const FAKE_STT_TRANSCRIPT = "Good evening. All systems are operational.";

export const FAKE_STT_PROVIDER_CONFIG: SttProviderConfig = {
  provider_id: "fake-local-stt",
  provider_kind: "local",
  model_id: "fake-whisper-model",
  language: "en",
  max_audio_bytes: 1_000_000,
  timeout_ms: 5_000,
  metadata_only: true,
};

export const FAKE_STT_HEALTHY_PROVIDER_HEALTH: SttProviderHealth = {
  provider_id: "fake-local-stt",
  ok: true,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: false,
  metadata_only: true,
};

export const FAKE_STT_DEGRADED_PROVIDER_HEALTH: SttProviderHealth = {
  provider_id: "fake-local-stt",
  ok: true,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: true,
  last_error_class: "provider_error",
  metadata_only: true,
};

export const FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH: SttProviderHealth = {
  provider_id: "fake-local-stt",
  ok: false,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: true,
  error_class: "provider_unavailable",
  last_error_class: "provider_unavailable",
  metadata_only: true,
};

export const FAKE_STT_TIMEOUT_CANCELLATION_REASON = "timeout" as const;

export const FAKE_STT_VALID_AUDIO_REQUEST: SttTranscriptionRequest = {
  request_id: "fake-stt-request-1",
  session_id: "session-1",
  turn_id: "turn-1",
  audio: {
    audio_ref: "local-audio://session-1/turn-1.wav",
    mime_type: "audio/wav",
    duration_ms: 1_200,
    size_bytes: 32_000,
    sample_rate_hz: 16_000,
    metadata_only: true,
  },
  metadata_only: true,
};

export const FAKE_STT_OVERSIZED_AUDIO_REQUEST: SttTranscriptionRequest = {
  ...FAKE_STT_VALID_AUDIO_REQUEST,
  request_id: "fake-stt-oversized-request-1",
  audio: {
    ...FAKE_STT_VALID_AUDIO_REQUEST.audio,
    size_bytes: 1_000_001,
  },
};
