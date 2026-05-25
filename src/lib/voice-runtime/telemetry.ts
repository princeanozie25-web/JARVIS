import {
  VOICE_CANCELLATION_REASONS,
  VOICE_CAPTURE_STATES,
  VOICE_PLAYBACK_STATES,
  VOICE_PROVIDER_KINDS,
  type VoiceCancellationReason,
  type VoiceCaptureState,
  type VoicePlaybackState,
  type VoiceProviderKind,
} from "./types";

export const VOICE_TELEMETRY_ALLOWED_FIELDS = [
  "event_type",
  "session_id",
  "turn_id",
  "provider_id",
  "provider_kind",
  "duration_ms",
  "latency_ms",
  "capture_state",
  "playback_state",
  "degraded",
  "cancellation_reason",
  "error_class",
  "redaction_status",
  "timestamp",
] as const;

export const VOICE_TELEMETRY_FORBIDDEN_FIELDS = [
  "transcript",
  "raw_transcript",
  "text",
  "raw_text",
  "audio",
  "raw_audio",
  "audio_bytes",
  "waveform",
  "waveform_bytes",
  "pcm",
  "speaker_embedding",
  "speaker_embeddings",
  "voiceprint",
  "biometric_identifier",
  "biometric_identifiers",
  "file_path",
  "prompt",
  "response",
  "model_output",
  "tool_output",
  "approval_text",
  "personal_context",
] as const;

export const VOICE_TELEMETRY_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
  "withheld",
] as const;

export const VOICE_TELEMETRY_SANITIZATION_REASONS = [
  "malformed_event",
  "forbidden_field_present",
  "invalid_allowed_field",
] as const;

export type VoiceTelemetryAllowedField =
  (typeof VOICE_TELEMETRY_ALLOWED_FIELDS)[number];
export type VoiceTelemetryForbiddenField =
  (typeof VOICE_TELEMETRY_FORBIDDEN_FIELDS)[number];
export type VoiceTelemetryRedactionStatus =
  (typeof VOICE_TELEMETRY_REDACTION_STATUSES)[number];
export type VoiceTelemetrySanitizationReason =
  (typeof VOICE_TELEMETRY_SANITIZATION_REASONS)[number];

export interface VoiceTelemetryEvent {
  readonly event_type: string;
  readonly session_id: string;
  readonly turn_id?: string;
  readonly provider_id?: string;
  readonly provider_kind?: VoiceProviderKind;
  readonly duration_ms?: number;
  readonly latency_ms?: number;
  readonly capture_state?: VoiceCaptureState;
  readonly playback_state?: VoicePlaybackState;
  readonly degraded?: boolean;
  readonly cancellation_reason?: VoiceCancellationReason;
  readonly error_class?: string;
  readonly redaction_status: VoiceTelemetryRedactionStatus;
  readonly timestamp: string;
}

export type VoiceTelemetrySanitizationResult =
  | {
      readonly ok: true;
      readonly event: VoiceTelemetryEvent;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly event: null;
      readonly reasons: readonly VoiceTelemetrySanitizationReason[];
    };

export function sanitizeVoiceTelemetryEvent(
  value: unknown,
): VoiceTelemetrySanitizationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("malformed_event");
  }

  const record = value as Record<string, unknown>;
  const forbidden = new Set<string>(VOICE_TELEMETRY_FORBIDDEN_FIELDS);
  const allowed = new Set<string>(VOICE_TELEMETRY_ALLOWED_FIELDS);
  const keys = Object.keys(record);

  if (keys.some((key) => forbidden.has(key))) {
    return fail("forbidden_field_present");
  }

  const sanitized: Partial<Record<VoiceTelemetryAllowedField, unknown>> = {};
  for (const key of keys) {
    if (allowed.has(key)) {
      sanitized[key as VoiceTelemetryAllowedField] = record[key];
    }
  }

  if (!isNonemptyString(sanitized.event_type)) {
    return fail("invalid_allowed_field");
  }
  if (!isNonemptyString(sanitized.session_id)) {
    return fail("invalid_allowed_field");
  }
  if (!isRedactionStatus(sanitized.redaction_status)) {
    return fail("invalid_allowed_field");
  }
  if (!isNonemptyString(sanitized.timestamp)) {
    return fail("invalid_allowed_field");
  }
  if (
    "turn_id" in sanitized &&
    sanitized.turn_id !== undefined &&
    !isNonemptyString(sanitized.turn_id)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "provider_id" in sanitized &&
    sanitized.provider_id !== undefined &&
    !isNonemptyString(sanitized.provider_id)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "provider_kind" in sanitized &&
    sanitized.provider_kind !== undefined &&
    !isProviderKind(sanitized.provider_kind)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "duration_ms" in sanitized &&
    sanitized.duration_ms !== undefined &&
    !isNonnegativeNumber(sanitized.duration_ms)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "latency_ms" in sanitized &&
    sanitized.latency_ms !== undefined &&
    !isNonnegativeNumber(sanitized.latency_ms)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "capture_state" in sanitized &&
    sanitized.capture_state !== undefined &&
    !isCaptureState(sanitized.capture_state)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "playback_state" in sanitized &&
    sanitized.playback_state !== undefined &&
    !isPlaybackState(sanitized.playback_state)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "degraded" in sanitized &&
    sanitized.degraded !== undefined &&
    typeof sanitized.degraded !== "boolean"
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "cancellation_reason" in sanitized &&
    sanitized.cancellation_reason !== undefined &&
    !isCancellationReason(sanitized.cancellation_reason)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    "error_class" in sanitized &&
    sanitized.error_class !== undefined &&
    !isNonemptyString(sanitized.error_class)
  ) {
    return fail("invalid_allowed_field");
  }

  const event: VoiceTelemetryEvent = {
    event_type: sanitized.event_type as string,
    session_id: sanitized.session_id as string,
    ...(sanitized.turn_id === undefined
      ? {}
      : { turn_id: sanitized.turn_id as string }),
    ...(sanitized.provider_id === undefined
      ? {}
      : { provider_id: sanitized.provider_id as string }),
    ...(sanitized.provider_kind === undefined
      ? {}
      : { provider_kind: sanitized.provider_kind as VoiceProviderKind }),
    ...(sanitized.duration_ms === undefined
      ? {}
      : { duration_ms: sanitized.duration_ms as number }),
    ...(sanitized.latency_ms === undefined
      ? {}
      : { latency_ms: sanitized.latency_ms as number }),
    ...(sanitized.capture_state === undefined
      ? {}
      : { capture_state: sanitized.capture_state as VoiceCaptureState }),
    ...(sanitized.playback_state === undefined
      ? {}
      : { playback_state: sanitized.playback_state as VoicePlaybackState }),
    ...(sanitized.degraded === undefined
      ? {}
      : { degraded: sanitized.degraded as boolean }),
    ...(sanitized.cancellation_reason === undefined
      ? {}
      : {
          cancellation_reason:
            sanitized.cancellation_reason as VoiceCancellationReason,
        }),
    ...(sanitized.error_class === undefined
      ? {}
      : { error_class: sanitized.error_class as string }),
    redaction_status:
      sanitized.redaction_status as VoiceTelemetryRedactionStatus,
    timestamp: sanitized.timestamp as string,
  };

  return {
    ok: true,
    event,
    reasons: [],
  };
}

export function assertVoiceTelemetrySafe(value: unknown): VoiceTelemetryEvent {
  const result = sanitizeVoiceTelemetryEvent(value);
  if (!result.ok) {
    throw new TypeError(
      `Unsafe voice telemetry event: ${result.reasons.join(",")}`,
    );
  }
  return result.event;
}

export function isVoiceTelemetrySafe(
  value: unknown,
): value is VoiceTelemetryEvent {
  return sanitizeVoiceTelemetryEvent(value).ok;
}

export function isVoiceTelemetryMetadataOnlyEvent(
  value: unknown,
): value is VoiceTelemetryEvent {
  return isVoiceTelemetrySafe(value);
}

function fail(
  reason: VoiceTelemetrySanitizationReason,
): VoiceTelemetrySanitizationResult {
  return {
    ok: false,
    event: null,
    reasons: [reason],
  };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isProviderKind(value: unknown): value is VoiceProviderKind {
  return (
    typeof value === "string" &&
    (VOICE_PROVIDER_KINDS as readonly string[]).includes(value)
  );
}

function isCaptureState(value: unknown): value is VoiceCaptureState {
  return (
    typeof value === "string" &&
    (VOICE_CAPTURE_STATES as readonly string[]).includes(value)
  );
}

function isPlaybackState(value: unknown): value is VoicePlaybackState {
  return (
    typeof value === "string" &&
    (VOICE_PLAYBACK_STATES as readonly string[]).includes(value)
  );
}

function isCancellationReason(
  value: unknown,
): value is VoiceCancellationReason {
  return (
    typeof value === "string" &&
    (VOICE_CANCELLATION_REASONS as readonly string[]).includes(value)
  );
}

function isRedactionStatus(
  value: unknown,
): value is VoiceTelemetryRedactionStatus {
  return (
    typeof value === "string" &&
    (VOICE_TELEMETRY_REDACTION_STATUSES as readonly string[]).includes(value)
  );
}
