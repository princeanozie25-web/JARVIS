import {
  VisionObservationSchema,
  VisionProviderResultSchema,
  VisionTelemetryEventSchema,
  type VisionObservation,
  type VisionProviderResult,
  type VisionTelemetryEvent,
} from "./contracts";
import type { VisionSessionLifecycleEvent } from "./session";

export const VISION_METADATA_ALLOWED_FIELDS = [
  "action_executed",
  "action_requested",
  "adapter_id",
  "adapter_kind",
  "advisory",
  "advisory_only",
  "allowed",
  "artifact_id",
  "artifact_validation_reason",
  "artifact_kind",
  "active_indicator_required",
  "active_indicator_visible",
  "base64_included",
  "capability",
  "cancelled",
  "capture_id",
  "capture_result",
  "capture_status",
  "cloud_called",
  "cloud_fallback_requested",
  "confidence",
  "confidence_band",
  "created_at_ms",
  "decision",
  "degraded",
  "derived",
  "device_action_triggered",
  "ended_at_ms",
  "enablement_allowed",
  "enablement_reason",
  "environment",
  "event_id",
  "event_type",
  "events",
  "execution_mode",
  "effective_input_kind",
  "fallback_used",
  "fake_capture_executed",
  "filesystem_path",
  "frame_id",
  "height_band",
  "input_kind",
  "invocation_id",
  "invocation_plan_created",
  "invocation_result",
  "kind",
  "latency_ms",
  "language",
  "memory_mutated",
  "metadata_only",
  "mime_type_hint",
  "mock_fixture_id",
  "mutation_authority_granted",
  "mutation_performed",
  "mutation_requested",
  "network_called",
  "network_fallback_requested",
  "observation_count",
  "observation_id",
  "observations",
  "ocr_text_included",
  "persisted",
  "policy_denied",
  "project_mutated",
  "provider_executed",
  "provider_execution_allowed",
  "provider_id",
  "provider_kind",
  "provider_result",
  "redacted_source_id",
  "raw_frame_persisted",
  "raw_frame_included",
  "raw_image_included",
  "raw_ocr_text_included",
  "raw_payload_included",
  "reason",
  "redaction_status",
  "region_preferred",
  "request_id",
  "requested_input_kind",
  "requested_frame_count",
  "result_id",
  "result_kind",
  "result_status",
  "runtime_executed",
  "session_id",
  "session_execution_allowed",
  "source_id_hash",
  "source_ref_id",
  "source_ref_kind",
  "started_at_ms",
  "state",
  "status",
  "max_allowed_frame_count",
  "retention_policy",
  "sampling_mode",
  "timestamp_ms",
  "timeout_ms",
  "timed_out",
  "tool_trigger_requested",
  "tool_triggered",
  "trigger_source",
  "unsupported_capability",
  "width_band",
  "sensitivity_class",
  "size_band",
] as const;

export const VISION_TELEMETRY_FORBIDDEN_FIELD_PATTERNS = [
  /raw[_-]?image/i,
  /raw[_-]?frame/i,
  /frame[_-]?bytes/i,
  /screenshot/i,
  /image[_-]?data/i,
  /base64/i,
  /ocr[_-]?text/i,
  /extracted[_-]?text/i,
  /transcript/i,
  /prompt/i,
  /response/i,
  /tool[_-]?output/i,
  /file[_-]?contents/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /password/i,
  /exact[_-]?pixel[_-]?coordinates/i,
] as const;

export type VisionMetadataAllowedField =
  (typeof VISION_METADATA_ALLOWED_FIELDS)[number];

export type VisionRedactionReason =
  | "forbidden_field"
  | "unknown_field"
  | "invalid_payload";

export type VisionRedactionResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly redaction_status: "metadata_only";
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly reason: VisionRedactionReason;
      readonly field_path: string | null;
      readonly redaction_status: "withheld";
      readonly metadata_only: true;
    };

const ALLOWED_FIELDS = new Set<string>(VISION_METADATA_ALLOWED_FIELDS);
const EXPLICIT_FALSE_SAFETY_FIELDS = new Set<string>([
  "base64_included",
  "ocr_text_included",
  "persisted",
  "raw_frame_included",
  "raw_frame_persisted",
  "raw_image_included",
  "raw_ocr_text_included",
  "raw_payload_included",
]);

export function sanitizeVisionMetadataPayload(
  payload: unknown,
): VisionRedactionResult<Record<string, unknown>> {
  if (!isPlainRecord(payload)) {
    return reject("invalid_payload", null);
  }

  const inspected = inspectMetadataPayload(payload);
  if (!inspected.ok) {
    return reject(inspected.reason, inspected.field_path);
  }

  return {
    ok: true,
    value: payload,
    redaction_status: "metadata_only",
    metadata_only: true,
  };
}

export function sanitizeVisionTelemetryEventForEmission(
  payload: unknown,
): VisionRedactionResult<VisionTelemetryEvent> {
  const sanitized = sanitizeVisionMetadataPayload(payload);
  if (!sanitized.ok) return sanitized;

  const parsed = VisionTelemetryEventSchema.safeParse(sanitized.value);
  if (!parsed.success) return reject("invalid_payload", null);

  return accept(parsed.data);
}

export function sanitizeVisionSessionLifecycleEvent(
  payload: unknown,
): VisionRedactionResult<VisionSessionLifecycleEvent> {
  const sanitized = sanitizeVisionMetadataPayload(payload);
  if (!sanitized.ok) return sanitized;

  if (!hasMetadataSafetyFlags(sanitized.value)) {
    return reject("invalid_payload", null);
  }

  return accept(sanitized.value as VisionSessionLifecycleEvent);
}

export function sanitizeVisionProviderResult(
  payload: unknown,
): VisionRedactionResult<VisionProviderResult> {
  const sanitized = sanitizeVisionMetadataPayload(payload);
  if (!sanitized.ok) return sanitized;

  const parsed = VisionProviderResultSchema.safeParse(sanitized.value);
  if (!parsed.success) return reject("invalid_payload", null);

  return accept(parsed.data);
}

export function sanitizeVisionObservation(
  payload: unknown,
): VisionRedactionResult<VisionObservation> {
  const sanitized = sanitizeVisionMetadataPayload(payload);
  if (!sanitized.ok) return sanitized;

  const parsed = VisionObservationSchema.safeParse(sanitized.value);
  if (!parsed.success) return reject("invalid_payload", null);

  return accept(parsed.data);
}

function inspectMetadataPayload(
  value: unknown,
  path: readonly string[] = [],
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: VisionRedactionReason;
      readonly field_path: string;
    } {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const inspected = inspectMetadataPayload(value[index], [
        ...path,
        String(index),
      ]);
      if (!inspected.ok) return inspected;
    }
    return { ok: true };
  }

  if (!isPlainRecord(value)) {
    return { ok: true };
  }

  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = [...path, key].join(".");
    if (isForbiddenField(key)) {
      return {
        ok: false,
        reason: "forbidden_field",
        field_path: fieldPath,
      };
    }
    if (!ALLOWED_FIELDS.has(key)) {
      return {
        ok: false,
        reason: "unknown_field",
        field_path: fieldPath,
      };
    }

    const inspected = inspectMetadataPayload(nested, [...path, key]);
    if (!inspected.ok) return inspected;
  }

  return { ok: true };
}

function isForbiddenField(field: string): boolean {
  if (EXPLICIT_FALSE_SAFETY_FIELDS.has(field)) return false;
  return VISION_TELEMETRY_FORBIDDEN_FIELD_PATTERNS.some((pattern) =>
    pattern.test(field),
  );
}

function hasMetadataSafetyFlags(payload: Record<string, unknown>): boolean {
  return (
    payload.metadata_only === true &&
    payload.raw_payload_included === false &&
    payload.cloud_called === false &&
    payload.action_executed === false &&
    payload.mutation_performed === false
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function accept<T>(value: T): VisionRedactionResult<T> {
  return {
    ok: true,
    value,
    redaction_status: "metadata_only",
    metadata_only: true,
  };
}

function reject(
  reason: VisionRedactionReason,
  fieldPath: string | null,
): VisionRedactionResult<never> {
  return {
    ok: false,
    value: null,
    reason,
    field_path: fieldPath,
    redaction_status: "withheld",
    metadata_only: true,
  };
}
