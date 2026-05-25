import type {
  TtsProviderConfig,
  TtsProviderHealth,
  TtsSynthesisRequest,
} from "./types";

export const FAKE_TTS_PROVIDER_CONFIG: TtsProviderConfig = {
  provider_id: "fake-local-tts",
  provider_kind: "local",
  voice_id: "fake-voice",
  max_input_chars: 500,
  timeout_ms: 5_000,
  metadata_only: true,
};

export const FAKE_TTS_HEALTHY_PROVIDER_HEALTH: TtsProviderHealth = {
  provider_id: "fake-local-tts",
  ok: true,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: false,
  metadata_only: true,
};

export const FAKE_TTS_DEGRADED_PROVIDER_HEALTH: TtsProviderHealth = {
  provider_id: "fake-local-tts",
  ok: true,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: true,
  last_error_class: "provider_error",
  metadata_only: true,
};

export const FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH: TtsProviderHealth = {
  provider_id: "fake-local-tts",
  ok: false,
  provider_kind: "local",
  checked_at_ms: 0,
  degraded: true,
  error_class: "provider_unavailable",
  last_error_class: "provider_unavailable",
  metadata_only: true,
};

export const FAKE_TTS_TIMEOUT_CANCELLATION_REASON = "timeout" as const;

export const FAKE_TTS_ASSISTANT_PROSE_REQUEST: TtsSynthesisRequest = {
  request_id: "fake-tts-request-1",
  text: "JARVIS local voice scaffold online.",
  content_class: "assistant_prose",
  turn_id: "turn-1",
  session_id: "session-1",
  requested_voice_id: "fake-voice",
  allow_sensitive_content: false,
  metadata_only: true,
};

export const FAKE_TTS_UNSAFE_CONTENT_REQUEST: TtsSynthesisRequest = {
  ...FAKE_TTS_ASSISTANT_PROSE_REQUEST,
  request_id: "fake-tts-unsafe-request-1",
  text: "console.log('do not speak code blocks');",
  content_class: "code_block",
  allow_sensitive_content: true,
};
