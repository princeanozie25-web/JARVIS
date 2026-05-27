import { z } from "zod";

import { VisionRedactionStatusSchema } from "./contracts";
import {
  VisionScreenshotCaptureResultSchema,
  VisionScreenshotDimensionBandSchema,
  type VisionScreenshotCaptureResult,
  type VisionScreenshotDimensionBand,
} from "./screenshot-capture";
import type { VisionProviderRunRequest } from "./provider";

export const VISION_OCR_ARTIFACT_KINDS = [
  "screenshot_capture",
  "uploaded_image",
  "test_fixture",
] as const;

export const VISION_OCR_SOURCE_REF_KINDS = [
  "in_memory_ref",
  "temp_ref",
  "fixture_ref",
  "redacted_ref",
] as const;

export const VISION_OCR_MIME_TYPE_HINTS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/unknown",
] as const;

export const VISION_OCR_SIZE_BANDS = [
  "unknown",
  "small",
  "medium",
  "large",
] as const;

export const VISION_OCR_RETENTION_POLICIES = ["ephemeral_only"] as const;

export const VISION_OCR_SENSITIVITY_CLASSES = [
  "standard",
  "sensitive",
  "restricted",
] as const;

export const VISION_OCR_ARTIFACT_REJECTION_REASONS = [
  "invalid_payload",
  "forbidden_field",
  "raw_binary_payload",
  "base64_or_data_url_forbidden",
  "remote_url_forbidden",
  "direct_filesystem_path_forbidden",
  "unknown_artifact_kind",
  "unknown_source_ref_kind",
  "non_ephemeral_retention_forbidden",
  "capture_not_successful",
] as const;

const OcrArtifactIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const OcrArtifactHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const OcrArtifactTimestampSchema = z.number().int().nonnegative();

export const VisionOcrArtifactKindSchema = z.enum(VISION_OCR_ARTIFACT_KINDS);
export const VisionOcrSourceRefKindSchema = z.enum(VISION_OCR_SOURCE_REF_KINDS);
export const VisionOcrMimeTypeHintSchema = z.enum(VISION_OCR_MIME_TYPE_HINTS);
export const VisionOcrSizeBandSchema = z.enum(VISION_OCR_SIZE_BANDS);
export const VisionOcrRetentionPolicySchema = z.enum(
  VISION_OCR_RETENTION_POLICIES,
);
export const VisionOcrSensitivityClassSchema = z.enum(
  VISION_OCR_SENSITIVITY_CLASSES,
);
export const VisionOcrArtifactRejectionReasonSchema = z.enum(
  VISION_OCR_ARTIFACT_REJECTION_REASONS,
);

export const VisionOcrInputArtifactSchema = z.strictObject({
  artifact_id: OcrArtifactIdSchema,
  artifact_kind: VisionOcrArtifactKindSchema,
  source_ref_kind: VisionOcrSourceRefKindSchema,
  source_ref_id: OcrArtifactIdSchema,
  redacted_source_id: z.literal("redacted"),
  source_id_hash: OcrArtifactHashSchema,
  mime_type_hint: VisionOcrMimeTypeHintSchema,
  size_band: VisionOcrSizeBandSchema.default("unknown"),
  width_band: VisionScreenshotDimensionBandSchema,
  height_band: VisionScreenshotDimensionBandSchema,
  created_at_ms: OcrArtifactTimestampSchema,
  retention_policy: VisionOcrRetentionPolicySchema.default("ephemeral_only"),
  sensitivity_class: VisionOcrSensitivityClassSchema,
  redaction_status: VisionRedactionStatusSchema,
  filesystem_path: z.string().trim().min(1).max(260).nullable().optional(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  persisted: z.literal(false),
});

export type VisionOcrArtifactKind = (typeof VISION_OCR_ARTIFACT_KINDS)[number];
export type VisionOcrSourceRefKind =
  (typeof VISION_OCR_SOURCE_REF_KINDS)[number];
export type VisionOcrMimeTypeHint = (typeof VISION_OCR_MIME_TYPE_HINTS)[number];
export type VisionOcrSizeBand = (typeof VISION_OCR_SIZE_BANDS)[number];
export type VisionOcrRetentionPolicy =
  (typeof VISION_OCR_RETENTION_POLICIES)[number];
export type VisionOcrSensitivityClass =
  (typeof VISION_OCR_SENSITIVITY_CLASSES)[number];
export type VisionOcrArtifactRejectionReason =
  (typeof VISION_OCR_ARTIFACT_REJECTION_REASONS)[number];
export type VisionOcrInputArtifact = z.infer<
  typeof VisionOcrInputArtifactSchema
>;

export interface VisionOcrArtifactProviderRunRequest extends VisionProviderRunRequest {
  readonly ocr_artifact: VisionOcrInputArtifact;
}

export type VisionOcrArtifactValidationResult =
  | {
      readonly ok: true;
      readonly artifact: VisionOcrInputArtifact;
      readonly reason: null;
      readonly field_path: null;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly artifact: null;
      readonly reason: VisionOcrArtifactRejectionReason;
      readonly field_path: string | null;
      readonly metadata_only: true;
    };

export interface CreateVisionOcrArtifactFromCaptureInput {
  readonly capture: VisionScreenshotCaptureResult;
  readonly artifact_id?: string;
  readonly source_ref_id?: string;
  readonly created_at_ms?: number;
  readonly mime_type_hint?: VisionOcrMimeTypeHint;
  readonly sensitivity_class?: VisionOcrSensitivityClass;
}

export function validateVisionOcrInputArtifact(
  input: unknown,
): VisionOcrArtifactValidationResult {
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const inspected = inspectArtifactPayload(input);
  if (!inspected.ok) {
    return reject(inspected.reason, inspected.field_path);
  }

  if (
    typeof input.artifact_kind === "string" &&
    !VISION_OCR_ARTIFACT_KINDS.includes(input.artifact_kind as never)
  ) {
    return reject("unknown_artifact_kind", "artifact_kind");
  }
  if (
    typeof input.source_ref_kind === "string" &&
    !VISION_OCR_SOURCE_REF_KINDS.includes(input.source_ref_kind as never)
  ) {
    return reject("unknown_source_ref_kind", "source_ref_kind");
  }
  if (
    typeof input.retention_policy === "string" &&
    input.retention_policy !== "ephemeral_only"
  ) {
    return reject("non_ephemeral_retention_forbidden", "retention_policy");
  }

  const parsed = VisionOcrInputArtifactSchema.safeParse(input);
  if (!parsed.success) return reject("invalid_payload", null);

  if (
    parsed.data.filesystem_path &&
    (parsed.data.artifact_kind !== "test_fixture" ||
      parsed.data.source_ref_kind !== "fixture_ref")
  ) {
    return reject("direct_filesystem_path_forbidden", "filesystem_path");
  }
  if (
    parsed.data.source_ref_kind === "fixture_ref" &&
    parsed.data.artifact_kind !== "test_fixture"
  ) {
    return reject("direct_filesystem_path_forbidden", "source_ref_kind");
  }

  return {
    ok: true,
    artifact: parsed.data,
    reason: null,
    field_path: null,
    metadata_only: true,
  };
}

export function createVisionOcrArtifactFromScreenshotCapture(
  input: CreateVisionOcrArtifactFromCaptureInput,
): VisionOcrArtifactValidationResult {
  const capture = VisionScreenshotCaptureResultSchema.parse(input.capture);
  if (capture.capture_status !== "success") {
    return reject("capture_not_successful", "capture_status");
  }

  return validateVisionOcrInputArtifact({
    artifact_id: input.artifact_id ?? `${capture.capture_id}-ocr-artifact`,
    artifact_kind: "screenshot_capture",
    source_ref_kind: "redacted_ref",
    source_ref_id: input.source_ref_id ?? `${capture.capture_id}-ref`,
    redacted_source_id: capture.redacted_source_id,
    source_id_hash: capture.source_id_hash,
    mime_type_hint: input.mime_type_hint ?? "image/unknown",
    size_band: sizeBandFromDimensions(capture.width_band, capture.height_band),
    width_band: capture.width_band,
    height_band: capture.height_band,
    created_at_ms: input.created_at_ms ?? 0,
    retention_policy: "ephemeral_only",
    sensitivity_class: input.sensitivity_class ?? "sensitive",
    redaction_status: "metadata_only",
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    persisted: false,
  });
}

function inspectArtifactPayload(
  value: unknown,
  path: readonly string[] = [],
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: VisionOcrArtifactRejectionReason;
      readonly field_path: string;
    } {
  if (isBinaryPayload(value)) {
    return {
      ok: false,
      reason: "raw_binary_payload",
      field_path: path.join(".") || "<root>",
    };
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const inspected = inspectArtifactPayload(value[index], [
        ...path,
        String(index),
      ]);
      if (!inspected.ok) return inspected;
    }
    return { ok: true };
  }

  if (!isPlainRecord(value)) return { ok: true };

  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = [...path, key].join(".");
    if (isForbiddenArtifactField(key)) {
      return { ok: false, reason: "forbidden_field", field_path: fieldPath };
    }
    if (typeof nested === "string" && isBase64OrDataUrl(nested)) {
      return {
        ok: false,
        reason: "base64_or_data_url_forbidden",
        field_path: fieldPath,
      };
    }
    if (typeof nested === "string" && isRemoteUrl(nested)) {
      return {
        ok: false,
        reason: "remote_url_forbidden",
        field_path: fieldPath,
      };
    }

    const inspected = inspectArtifactPayload(nested, [...path, key]);
    if (!inspected.ok) return inspected;
  }

  return { ok: true };
}

function isForbiddenArtifactField(field: string): boolean {
  if (
    [
      "base64_included",
      "ocr_text_included",
      "persisted",
      "raw_frame_included",
      "raw_image_included",
      "raw_payload_included",
    ].includes(field)
  ) {
    return false;
  }

  return [
    /raw[_-]?(?:image|frame|bytes|data)?/i,
    /frame[_-]?bytes/i,
    /image[_-]?bytes/i,
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
    /buffer/i,
    /^bytes$/i,
  ].some((pattern) => pattern.test(field));
}

function isBinaryPayload(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function isBase64OrDataUrl(value: string): boolean {
  return /^data:/i.test(value) || /^base64,/i.test(value);
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sizeBandFromDimensions(
  widthBand: VisionScreenshotDimensionBand,
  heightBand: VisionScreenshotDimensionBand,
): VisionOcrSizeBand {
  if (widthBand === "none" || heightBand === "none") return "unknown";
  if (widthBand === "large" || heightBand === "large") return "large";
  if (widthBand === "medium" || heightBand === "medium") return "medium";
  return "small";
}

function reject(
  reason: VisionOcrArtifactRejectionReason,
  fieldPath: string | null,
): VisionOcrArtifactValidationResult {
  return {
    ok: false,
    artifact: null,
    reason,
    field_path: fieldPath,
    metadata_only: true,
  };
}
