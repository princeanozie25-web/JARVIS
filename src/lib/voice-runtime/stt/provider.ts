import type {
  SttCancellationReason,
  SttProviderConfig,
  SttProviderHealth,
  SttTranscriptionOptions,
  SttTranscriptionRequest,
  SttTranscriptionResult,
  SttValidationFailureReason,
  SttValidationResult,
} from "./types";

export interface SttProvider {
  readonly id: string;
  readonly kind: "local";
  readonly config: SttProviderConfig;
  readonly metadata_only: true;
  transcribe(
    request: SttTranscriptionRequest,
    options: SttTranscriptionOptions,
  ): Promise<SttTranscriptionResult>;
  cancel(reason: SttCancellationReason): Promise<void>;
  health(): Promise<SttProviderHealth>;
}

export function validateSttTranscriptionRequest(
  request: unknown,
  config: SttProviderConfig,
): SttValidationResult {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return fail(["malformed_request"]);
  }

  const record = request as Record<string, unknown>;
  const audio = record.audio as Record<string, unknown> | undefined;
  const reasons = new Set<SttValidationFailureReason>();
  if (!isNonemptyString(record.request_id)) reasons.add("malformed_request");
  if (!isNonemptyString(record.session_id)) reasons.add("malformed_request");
  if (!isNonemptyString(record.turn_id)) reasons.add("malformed_request");
  if (record.metadata_only !== true) reasons.add("malformed_request");
  if (!audio || typeof audio !== "object" || Array.isArray(audio)) {
    reasons.add("malformed_request");
  } else {
    if (!isNonemptyString(audio.audio_ref)) reasons.add("missing_audio_ref");
    if (!isNonemptyString(audio.mime_type)) reasons.add("unsupported_audio");
    if (!isNonnegativeNumber(audio.duration_ms) || audio.duration_ms <= 0) {
      reasons.add("audio_duration_invalid");
    }
    if (!isNonnegativeNumber(audio.size_bytes) || audio.size_bytes <= 0) {
      reasons.add("malformed_request");
    } else if (audio.size_bytes > config.max_audio_bytes) {
      reasons.add("audio_too_large");
    }
    if (
      audio.sample_rate_hz !== undefined &&
      (!isNonnegativeNumber(audio.sample_rate_hz) || audio.sample_rate_hz <= 0)
    ) {
      reasons.add("malformed_request");
    }
    if (audio.metadata_only !== true) reasons.add("malformed_request");
  }

  if (reasons.size > 0) return fail([...reasons]);
  return {
    ok: true,
    reasons: [],
  };
}

function fail(
  reasons: readonly SttValidationFailureReason[],
): SttValidationResult {
  return {
    ok: false,
    reasons,
  };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
