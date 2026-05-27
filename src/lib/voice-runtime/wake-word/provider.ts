import type {
  WakeWordProviderDetectionResult,
  WakeWordProviderHealth,
  WakeWordProviderOptions,
} from "./types";

export interface WakeWordProvider {
  readonly id: string;
  readonly kind: "local";
  readonly metadata_only: true;
  arm(options?: WakeWordProviderOptions): Promise<WakeWordProviderHealth>;
  disarm(options?: WakeWordProviderOptions): Promise<WakeWordProviderHealth>;
  detect(
    options?: WakeWordProviderOptions,
  ): Promise<WakeWordProviderDetectionResult>;
  cancel(reason: string, options?: WakeWordProviderOptions): Promise<void>;
  health(): Promise<WakeWordProviderHealth>;
}

export function isWakeWordProviderDetectionResult(
  value: unknown,
): value is WakeWordProviderDetectionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (hasForbiddenKeys(record)) return false;
  return (
    typeof record.provider_id === "string" &&
    record.provider_id.length > 0 &&
    typeof record.wake_detected === "boolean" &&
    (record.confidence_band === "low" ||
      record.confidence_band === "medium" ||
      record.confidence_band === "high") &&
    typeof record.latency_ms === "number" &&
    Number.isFinite(record.latency_ms) &&
    record.latency_ms >= 0 &&
    typeof record.degraded === "boolean" &&
    record.metadata_only === true
  );
}

function hasForbiddenKeys(record: Record<string, unknown>): boolean {
  return [
    "audio",
    "raw_audio",
    "audio_bytes",
    "waveform",
    "pcm",
    "transcript",
    "raw_transcript",
    "text",
    "speaker_embedding",
    "voiceprint",
    "biometric_identifier",
    "prompt",
    "response",
    "tool_output",
  ].some((key) => Object.prototype.hasOwnProperty.call(record, key));
}
