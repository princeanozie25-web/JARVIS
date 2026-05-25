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

export type VoiceTelemetryRedactionStatus =
  (typeof VOICE_TELEMETRY_REDACTION_STATUSES)[number];
export type VoiceTelemetryAllowedField =
  (typeof VOICE_TELEMETRY_ALLOWED_FIELDS)[number];
export type VoiceTelemetryForbiddenField =
  (typeof VOICE_TELEMETRY_FORBIDDEN_FIELDS)[number];

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
      readonly reasons: readonly (
        | "malformed_event"
        | "forbidden_field_present"
        | "invalid_allowed_field"
      )[];
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
  if (Object.keys(record).some((key) => forbidden.has(key))) {
    return fail("forbidden_field_present");
  }

  const event = allowlisted(record, allowed);
  if (
    !isNonemptyString(event.event_type) ||
    !isNonemptyString(event.session_id) ||
    !isRedactionStatus(event.redaction_status) ||
    !isNonemptyString(event.timestamp)
  ) {
    return fail("invalid_allowed_field");
  }
  if (event.turn_id !== undefined && !isNonemptyString(event.turn_id)) {
    return fail("invalid_allowed_field");
  }
  if (event.provider_id !== undefined && !isNonemptyString(event.provider_id)) {
    return fail("invalid_allowed_field");
  }
  if (
    event.provider_kind !== undefined &&
    !isProviderKind(event.provider_kind)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    event.duration_ms !== undefined &&
    !isNonnegativeNumber(event.duration_ms)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    event.latency_ms !== undefined &&
    !isNonnegativeNumber(event.latency_ms)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    event.capture_state !== undefined &&
    !isCaptureState(event.capture_state)
  ) {
    return fail("invalid_allowed_field");
  }
  if (
    event.playback_state !== undefined &&
    !isPlaybackState(event.playback_state)
  ) {
    return fail("invalid_allowed_field");
  }
  if (event.degraded !== undefined && typeof event.degraded !== "boolean") {
    return fail("invalid_allowed_field");
  }
  if (
    event.cancellation_reason !== undefined &&
    !isCancellationReason(event.cancellation_reason)
  ) {
    return fail("invalid_allowed_field");
  }
  if (event.error_class !== undefined && !isNonemptyString(event.error_class)) {
    return fail("invalid_allowed_field");
  }

  return {
    ok: true,
    event: event as VoiceTelemetryEvent,
    reasons: [],
  };
}

export function assertVoiceTelemetrySafe(value: unknown): VoiceTelemetryEvent {
  const result = sanitizeVoiceTelemetryEvent(value);
  if (!result.ok) {
    throw new TypeError(`Unsafe voice telemetry event: ${result.reasons}`);
  }
  return result.event;
}

export function isVoiceTelemetrySafe(
  value: unknown,
): value is VoiceTelemetryEvent {
  return sanitizeVoiceTelemetryEvent(value).ok;
}

export const isVoiceTelemetryMetadataOnlyEvent = isVoiceTelemetrySafe;

function allowlisted(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): Partial<Record<VoiceTelemetryAllowedField, unknown>> {
  const event: Partial<Record<VoiceTelemetryAllowedField, unknown>> = {};
  for (const [key, value] of Object.entries(record)) {
    if (allowed.has(key)) {
      event[key as VoiceTelemetryAllowedField] = value;
    }
  }
  return event;
}

function fail(
  reason:
    | "malformed_event"
    | "forbidden_field_present"
    | "invalid_allowed_field",
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
