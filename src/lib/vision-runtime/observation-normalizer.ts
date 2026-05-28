import { z } from "zod";

import {
  VisionCapabilitySchema,
  VisionInputKindSchema,
  VisionProviderKindSchema,
  VisionRedactionStatusSchema,
  type VisionCapability,
  type VisionInputKind,
  type VisionProviderResult,
} from "./contracts";
import {
  sanitizeVisionMetadataPayload,
  sanitizeVisionProviderResult,
} from "./redaction";

export const VISION_REPLAY_CONFIDENCE_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export const VISION_REPLAY_SOURCE_REF_KINDS = [
  "in_memory_ref",
  "temp_ref",
  "fixture_ref",
  "redacted_ref",
  "mock_frame_ref",
] as const;

export const VISION_REPLAY_NORMALIZATION_REASONS = [
  "invalid_payload",
  "unsafe_payload",
  "unsupported_payload",
] as const;

const ReplayIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const ReplayHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionReplayConfidenceBandSchema = z.enum(
  VISION_REPLAY_CONFIDENCE_BANDS,
);
export const VisionReplaySourceRefKindSchema = z.enum(
  VISION_REPLAY_SOURCE_REF_KINDS,
);
export const VisionReplayNormalizationReasonSchema = z.enum(
  VISION_REPLAY_NORMALIZATION_REASONS,
);

export const VisionReplayMetadataSchema = z.strictObject({
  replay_id: ReplayIdSchema,
  observation_id: ReplayIdSchema,
  request_id: ReplayIdSchema,
  capability: VisionCapabilitySchema,
  input_kind: VisionInputKindSchema,
  provider_id: ReplayIdSchema.nullable(),
  provider_kind: VisionProviderKindSchema.nullable(),
  result_status: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(120).nullable(),
  confidence_band: VisionReplayConfidenceBandSchema,
  latency_ms: z.number().int().nonnegative().nullable(),
  degraded: z.boolean(),
  fallback_used: z.literal(false),
  source_ref_kind: VisionReplaySourceRefKindSchema.nullable(),
  redacted_source_id: z.literal("redacted").nullable(),
  source_id_hash: ReplayHashSchema.nullable(),
  artifact_id: ReplayIdSchema.nullable(),
  frame_id: ReplayIdSchema.nullable(),
  mock_fixture_id: ReplayIdSchema.nullable(),
  derived: z.literal(true),
  advisory: z.literal(true),
  advisory_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_status: VisionRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  detection_results_included: z.literal(false),
  persisted: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
  mutation_authority_granted: z.literal(false),
});

export type VisionReplayConfidenceBand =
  (typeof VISION_REPLAY_CONFIDENCE_BANDS)[number];
export type VisionReplaySourceRefKind =
  (typeof VISION_REPLAY_SOURCE_REF_KINDS)[number];
export type VisionReplayNormalizationReason =
  (typeof VISION_REPLAY_NORMALIZATION_REASONS)[number];
export type VisionReplayMetadata = z.infer<typeof VisionReplayMetadataSchema>;

export type VisionReplayNormalizationResult =
  | {
      readonly ok: true;
      readonly replay: VisionReplayMetadata;
      readonly reason: null;
      readonly field_path: null;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly replay: null;
      readonly reason: VisionReplayNormalizationReason;
      readonly field_path: string | null;
      readonly metadata_only: true;
    };

export function normalizeVisionRouterResult(
  input: unknown,
): VisionReplayNormalizationResult {
  const safe = assertMetadataSafe(input);
  if (!safe.ok) return safe;
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const providerResult = providerResultFrom(input.provider_result);
  if (providerResult.reason) return reject("unsafe_payload", "provider_result");
  const firstObservation = firstRecord(input.observations);
  const invocationResult = isPlainRecord(input.invocation_result)
    ? input.invocation_result
    : null;

  return createReplayMetadata({
    request_id: stringValue(input.request_id, "vision-router-request"),
    capability: capabilityValue(input.capability),
    input_kind: inputKindValue(input.input_kind),
    provider_result: providerResult.value,
    result_status: stringValue(
      providerResult.value?.status ?? input.status,
      "unknown",
    ),
    reason: nullableString(providerResult.value?.reason ?? input.reason),
    confidence: numberOrNull(firstObservation?.confidence),
    source: sourceFromInvocation(invocationResult),
  });
}

export function normalizeFakeScreenshotSessionResult(
  input: unknown,
): VisionReplayNormalizationResult {
  const safe = assertMetadataSafe(input);
  if (!safe.ok) return safe;
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const providerResult = providerResultFrom(input.provider_result);
  if (providerResult.reason) return reject("unsafe_payload", "provider_result");
  const captureResult = isPlainRecord(input.capture_result)
    ? input.capture_result
    : null;
  const firstObservation = firstRecord(input.observations);

  return createReplayMetadata({
    request_id: stringValue(input.request_id, "vision-screenshot-request"),
    capability: providerResult.value?.capability ?? "screenshot_ocr",
    input_kind: "screenshot",
    provider_result: providerResult.value,
    result_status: stringValue(
      providerResult.value?.status ?? input.status,
      "unknown",
    ),
    reason: nullableString(providerResult.value?.reason ?? input.reason),
    confidence: numberOrNull(firstObservation?.confidence),
    source: sourceFromCapture(captureResult),
  });
}

export function normalizeMockCameraSessionResult(
  input: unknown,
): VisionReplayNormalizationResult {
  const safe = assertMetadataSafe(input);
  if (!safe.ok) return safe;
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const providerResult = providerResultFrom(input.provider_result);
  if (providerResult.reason) return reject("unsafe_payload", "provider_result");
  const streamResult = isPlainRecord(input.stream_result)
    ? input.stream_result
    : null;
  const firstObservation = firstRecord(input.observations);

  return createReplayMetadata({
    request_id: stringValue(input.request_id, "vision-camera-request"),
    capability: providerResult.value?.capability ?? "object_detection",
    input_kind: "mock_camera_frame",
    provider_result: providerResult.value,
    result_status: stringValue(
      providerResult.value?.status ?? input.status,
      "unknown",
    ),
    reason: nullableString(providerResult.value?.reason ?? input.reason),
    confidence: numberOrNull(firstObservation?.confidence),
    source: sourceFromStream(streamResult),
  });
}

export function normalizeTesseractDryRunResult(
  input: unknown,
): VisionReplayNormalizationResult {
  const safe = assertMetadataSafe(input);
  if (!safe.ok) return safe;
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const providerResult = providerResultFrom(input.provider_result);
  if (providerResult.reason) return reject("unsafe_payload", "provider_result");
  const invocationResult = isPlainRecord(input.invocation_result)
    ? input.invocation_result
    : null;

  return createReplayMetadata({
    request_id: requestIdFromProvider(
      providerResult.value,
      "tesseract-dry-run",
    ),
    capability: "screenshot_ocr",
    input_kind: "screenshot",
    provider_result: providerResult.value,
    result_status: stringValue(providerResult.value?.status, "unknown"),
    reason: nullableString(providerResult.value?.reason),
    confidence: null,
    source: sourceFromInvocation(invocationResult),
  });
}

export function normalizeYoloDryRunResult(
  input: unknown,
): VisionReplayNormalizationResult {
  const safe = assertMetadataSafe(input);
  if (!safe.ok) return safe;
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const providerResult = providerResultFrom(input.provider_result);
  if (providerResult.reason) return reject("unsafe_payload", "provider_result");
  const invocationResult = isPlainRecord(input.invocation_result)
    ? input.invocation_result
    : null;

  return createReplayMetadata({
    request_id: requestIdFromProvider(providerResult.value, "yolo-dry-run"),
    capability: "object_detection",
    input_kind: "mock_camera_frame",
    provider_result: providerResult.value,
    result_status: stringValue(providerResult.value?.status, "unknown"),
    reason: nullableString(providerResult.value?.reason),
    confidence: null,
    source: sourceFromInvocation(invocationResult),
  });
}

function createReplayMetadata(input: {
  readonly request_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly provider_result: VisionProviderResult | null;
  readonly result_status: string;
  readonly reason: string | null;
  readonly confidence: number | null;
  readonly source: ReplaySourceMetadata;
}): VisionReplayNormalizationResult {
  const replay = VisionReplayMetadataSchema.safeParse({
    replay_id: `${input.request_id}-replay`,
    observation_id: `${input.request_id}-replay-observation`,
    request_id: input.request_id,
    capability: input.capability,
    input_kind: input.input_kind,
    provider_id: input.provider_result?.provider_id ?? null,
    provider_kind: input.provider_result?.provider_kind ?? null,
    result_status: input.result_status,
    reason: input.reason,
    confidence_band: confidenceBand(input.confidence),
    latency_ms: input.provider_result?.latency_ms ?? null,
    degraded: input.provider_result?.degraded ?? false,
    fallback_used: false,
    source_ref_kind: input.source.source_ref_kind,
    redacted_source_id: input.source.redacted_source_id,
    source_id_hash: input.source.source_id_hash,
    artifact_id: input.source.artifact_id,
    frame_id: input.source.frame_id,
    mock_fixture_id: input.source.mock_fixture_id,
    derived: true,
    advisory: true,
    advisory_only: true,
    replay_safe: true,
    redaction_status: "metadata_only",
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    detection_results_included: false,
    persisted: false,
    cloud_called: false,
    network_called: false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
    mutation_authority_granted: false,
  });
  if (!replay.success) return reject("invalid_payload", null);

  const safeReplay = sanitizeVisionMetadataPayload(replay.data);
  if (!safeReplay.ok) {
    return reject("unsafe_payload", safeReplay.field_path);
  }

  return {
    ok: true,
    replay: replay.data,
    reason: null,
    field_path: null,
    metadata_only: true,
  };
}

type ReplaySourceMetadata = {
  readonly source_ref_kind: VisionReplaySourceRefKind | null;
  readonly redacted_source_id: "redacted" | null;
  readonly source_id_hash: string | null;
  readonly artifact_id: string | null;
  readonly frame_id: string | null;
  readonly mock_fixture_id: string | null;
};

function sourceFromCapture(
  captureResult: Record<string, unknown> | null,
): ReplaySourceMetadata {
  if (!captureResult) return emptySource();
  return {
    source_ref_kind: "redacted_ref",
    redacted_source_id:
      captureResult.redacted_source_id === "redacted" ? "redacted" : null,
    source_id_hash: stringOrNull(captureResult.source_id_hash),
    artifact_id: null,
    frame_id: null,
    mock_fixture_id: null,
  };
}

function sourceFromStream(
  streamResult: Record<string, unknown> | null,
): ReplaySourceMetadata {
  const frame = Array.isArray(streamResult?.frames)
    ? firstRecord(streamResult.frames)
    : null;
  if (!frame) return emptySource();
  return {
    source_ref_kind: "mock_frame_ref",
    redacted_source_id:
      frame.redacted_source_id === "redacted" ? "redacted" : null,
    source_id_hash: stringOrNull(frame.source_id_hash),
    artifact_id: null,
    frame_id: stringOrNull(frame.frame_id),
    mock_fixture_id: stringOrNull(frame.mock_fixture_id),
  };
}

function sourceFromInvocation(
  invocationResult: Record<string, unknown> | null,
): ReplaySourceMetadata {
  if (!invocationResult) return emptySource();
  return {
    source_ref_kind: null,
    redacted_source_id: null,
    source_id_hash: null,
    artifact_id: stringOrNull(invocationResult.artifact_id),
    frame_id: null,
    mock_fixture_id: null,
  };
}

function emptySource(): ReplaySourceMetadata {
  return {
    source_ref_kind: null,
    redacted_source_id: null,
    source_id_hash: null,
    artifact_id: null,
    frame_id: null,
    mock_fixture_id: null,
  };
}

function assertMetadataSafe(
  input: unknown,
):
  | { readonly ok: true }
  | Exclude<VisionReplayNormalizationResult, { ok: true }> {
  const safe = sanitizeVisionMetadataPayload(input);
  if (safe.ok) return { ok: true };
  return reject("unsafe_payload", safe.field_path);
}

function providerResultFrom(
  input: unknown,
):
  | { readonly value: VisionProviderResult | null; readonly reason: null }
  | { readonly value: null; readonly reason: "unsafe_payload" } {
  if (input === null || input === undefined)
    return { value: null, reason: null };
  const safe = sanitizeVisionProviderResult(input);
  if (!safe.ok) return { value: null, reason: "unsafe_payload" };
  return { value: safe.value, reason: null };
}

function requestIdFromProvider(
  providerResult: VisionProviderResult | null,
  fallback: string,
): string {
  if (!providerResult) return fallback;
  return providerResult.result_id.replace(/-result$/, "");
}

function confidenceBand(confidence: number | null): VisionReplayConfidenceBand {
  if (confidence === null) return "unknown";
  if (confidence <= 0) return "none";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function capabilityValue(value: unknown): VisionCapability {
  const parsed = VisionCapabilitySchema.safeParse(value);
  return parsed.success ? parsed.data : "screenshot_ocr";
}

function inputKindValue(value: unknown): VisionInputKind {
  const parsed = VisionInputKindSchema.safeParse(value);
  return parsed.success ? parsed.data : "screenshot";
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  return isPlainRecord(first) ? first : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function reject(
  reason: VisionReplayNormalizationReason,
  fieldPath: string | null,
): VisionReplayNormalizationResult {
  return {
    ok: false,
    replay: null,
    reason,
    field_path: fieldPath,
    metadata_only: true,
  };
}
