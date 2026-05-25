import type {
  VoiceCancellationReason,
  VoiceCaptureState,
  VoicePlaybackState,
  VoiceProviderKind,
} from "./types";

export const VOICE_TELEMETRY_ALLOWED_FIELDS = [
  "session_id",
  "duration_ms",
  "latency_ms",
  "provider_id",
  "provider_kind",
  "degraded",
  "cancellation_reason",
  "capture_state",
  "playback_state",
  "metadata_only",
] as const;

export const VOICE_TELEMETRY_FORBIDDEN_FIELDS = [
  "raw_audio",
  "audio_bytes",
  "waveform_bytes",
  "transcript",
  "transcript_content",
  "speaker_embedding",
  "speaker_embeddings",
  "biometric_identifier",
  "biometric_identifiers",
  "voiceprint",
  "voice_sample",
] as const;

export interface VoiceTelemetryEvent {
  readonly session_id: string;
  readonly duration_ms?: number;
  readonly latency_ms?: number;
  readonly provider_id?: string;
  readonly provider_kind?: VoiceProviderKind;
  readonly degraded: boolean;
  readonly cancellation_reason?: VoiceCancellationReason;
  readonly capture_state?: VoiceCaptureState;
  readonly playback_state?: VoicePlaybackState;
  readonly metadata_only: true;
}

export function isVoiceTelemetryMetadataOnlyEvent(
  value: unknown,
): value is VoiceTelemetryEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const allowed = new Set<string>(VOICE_TELEMETRY_ALLOWED_FIELDS);
  const forbidden = new Set<string>(VOICE_TELEMETRY_FORBIDDEN_FIELDS);

  if (!Object.keys(record).every((key) => allowed.has(key))) return false;
  if (Object.keys(record).some((key) => forbidden.has(key))) return false;
  if (typeof record.session_id !== "string" || record.session_id.length === 0) {
    return false;
  }
  if (typeof record.degraded !== "boolean") return false;
  if (record.metadata_only !== true) return false;
  if ("duration_ms" in record && !isNonnegativeNumber(record.duration_ms)) {
    return false;
  }
  if ("latency_ms" in record && !isNonnegativeNumber(record.latency_ms)) {
    return false;
  }
  if ("provider_id" in record && typeof record.provider_id !== "string") {
    return false;
  }

  return true;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
