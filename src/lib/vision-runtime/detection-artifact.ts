import { z } from "zod";

import { VisionRedactionStatusSchema } from "./contracts";
import {
  MockCameraFrameDescriptorSchema,
  type MockCameraFrameDescriptor,
} from "./mock-camera-provider";
import type { VisionProviderRunRequest } from "./provider";

export const VISION_DETECTION_ARTIFACT_KINDS = [
  "mock_camera_frame",
  "screenshot_capture",
  "uploaded_image",
  "test_fixture",
] as const;

export const VISION_DETECTION_SOURCE_REF_KINDS = [
  "mock_frame_ref",
  "in_memory_ref",
  "temp_ref",
  "fixture_ref",
  "redacted_ref",
] as const;

export const VISION_DETECTION_MIME_TYPE_HINTS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/unknown",
] as const;

export const VISION_DETECTION_SIZE_BANDS = [
  "unknown",
  "small",
  "medium",
  "large",
] as const;

export const VISION_DETECTION_RETENTION_POLICIES = ["ephemeral_only"] as const;

export const VISION_DETECTION_SENSITIVITY_CLASSES = [
  "standard",
  "sensitive",
  "restricted",
] as const;

export const VISION_DETECTION_ARTIFACT_REJECTION_REASONS = [
  "invalid_payload",
  "forbidden_field",
  "raw_binary_payload",
  "base64_or_data_url_forbidden",
  "remote_url_forbidden",
  "direct_filesystem_path_forbidden",
  "unknown_artifact_kind",
  "unknown_source_ref_kind",
  "non_ephemeral_retention_forbidden",
  "active_indicator_required",
] as const;

const DetectionArtifactIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const DetectionArtifactHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const DetectionArtifactDimensionBandSchema = z.enum([
  "unknown",
  "small",
  "medium",
  "large",
]);

const DetectionArtifactTimestampSchema = z.number().int().nonnegative();

export const VisionDetectionArtifactKindSchema = z.enum(
  VISION_DETECTION_ARTIFACT_KINDS,
);
export const VisionDetectionSourceRefKindSchema = z.enum(
  VISION_DETECTION_SOURCE_REF_KINDS,
);
export const VisionDetectionMimeTypeHintSchema = z.enum(
  VISION_DETECTION_MIME_TYPE_HINTS,
);
export const VisionDetectionSizeBandSchema = z.enum(
  VISION_DETECTION_SIZE_BANDS,
);
export const VisionDetectionRetentionPolicySchema = z.enum(
  VISION_DETECTION_RETENTION_POLICIES,
);
export const VisionDetectionSensitivityClassSchema = z.enum(
  VISION_DETECTION_SENSITIVITY_CLASSES,
);
export const VisionDetectionArtifactRejectionReasonSchema = z.enum(
  VISION_DETECTION_ARTIFACT_REJECTION_REASONS,
);

export const VisionDetectionInputArtifactSchema = z.strictObject({
  artifact_id: DetectionArtifactIdSchema,
  artifact_kind: VisionDetectionArtifactKindSchema,
  source_ref_kind: VisionDetectionSourceRefKindSchema,
  source_ref_id: DetectionArtifactIdSchema,
  redacted_source_id: z.literal("redacted"),
  source_id_hash: DetectionArtifactHashSchema,
  mock_fixture_id: DetectionArtifactIdSchema.nullable().default(null),
  frame_id: DetectionArtifactIdSchema.nullable().default(null),
  mime_type_hint: VisionDetectionMimeTypeHintSchema,
  size_band: VisionDetectionSizeBandSchema.default("unknown"),
  width_band: DetectionArtifactDimensionBandSchema,
  height_band: DetectionArtifactDimensionBandSchema,
  created_at_ms: DetectionArtifactTimestampSchema,
  retention_policy:
    VisionDetectionRetentionPolicySchema.default("ephemeral_only"),
  sensitivity_class: VisionDetectionSensitivityClassSchema,
  redaction_status: VisionRedactionStatusSchema,
  active_indicator_required: z.boolean().default(false),
  active_indicator_visible: z.boolean().default(false),
  filesystem_path: z.string().trim().min(1).max(260).nullable().optional(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  detection_results_included: z.literal(false),
  persisted: z.literal(false),
});

export type VisionDetectionArtifactKind =
  (typeof VISION_DETECTION_ARTIFACT_KINDS)[number];
export type VisionDetectionSourceRefKind =
  (typeof VISION_DETECTION_SOURCE_REF_KINDS)[number];
export type VisionDetectionMimeTypeHint =
  (typeof VISION_DETECTION_MIME_TYPE_HINTS)[number];
export type VisionDetectionSizeBand =
  (typeof VISION_DETECTION_SIZE_BANDS)[number];
export type VisionDetectionRetentionPolicy =
  (typeof VISION_DETECTION_RETENTION_POLICIES)[number];
export type VisionDetectionSensitivityClass =
  (typeof VISION_DETECTION_SENSITIVITY_CLASSES)[number];
export type VisionDetectionArtifactRejectionReason =
  (typeof VISION_DETECTION_ARTIFACT_REJECTION_REASONS)[number];
export type VisionDetectionInputArtifact = z.infer<
  typeof VisionDetectionInputArtifactSchema
>;

export interface VisionDetectionArtifactProviderRunRequest extends VisionProviderRunRequest {
  readonly detection_artifact: VisionDetectionInputArtifact;
}

export type VisionDetectionArtifactValidationResult =
  | {
      readonly ok: true;
      readonly artifact: VisionDetectionInputArtifact;
      readonly reason: null;
      readonly field_path: null;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly artifact: null;
      readonly reason: VisionDetectionArtifactRejectionReason;
      readonly field_path: string | null;
      readonly metadata_only: true;
    };

export interface CreateVisionDetectionArtifactFromMockFrameInput {
  readonly frame: MockCameraFrameDescriptor;
  readonly artifact_id?: string;
  readonly source_ref_id?: string;
  readonly created_at_ms?: number;
  readonly mime_type_hint?: VisionDetectionMimeTypeHint;
  readonly sensitivity_class?: VisionDetectionSensitivityClass;
}

export function validateVisionDetectionInputArtifact(
  input: unknown,
): VisionDetectionArtifactValidationResult {
  if (!isPlainRecord(input)) return reject("invalid_payload", null);

  const inspected = inspectDetectionArtifactPayload(input);
  if (!inspected.ok) {
    return reject(inspected.reason, inspected.field_path);
  }

  if (
    typeof input.artifact_kind === "string" &&
    !VISION_DETECTION_ARTIFACT_KINDS.includes(input.artifact_kind as never)
  ) {
    return reject("unknown_artifact_kind", "artifact_kind");
  }
  if (
    typeof input.source_ref_kind === "string" &&
    !VISION_DETECTION_SOURCE_REF_KINDS.includes(input.source_ref_kind as never)
  ) {
    return reject("unknown_source_ref_kind", "source_ref_kind");
  }
  if (
    typeof input.retention_policy === "string" &&
    input.retention_policy !== "ephemeral_only"
  ) {
    return reject("non_ephemeral_retention_forbidden", "retention_policy");
  }

  const parsed = VisionDetectionInputArtifactSchema.safeParse(input);
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
  if (
    isCameraDerivedArtifact(parsed.data) &&
    (!parsed.data.active_indicator_required ||
      !parsed.data.active_indicator_visible)
  ) {
    return reject("active_indicator_required", "active_indicator_visible");
  }

  return {
    ok: true,
    artifact: parsed.data,
    reason: null,
    field_path: null,
    metadata_only: true,
  };
}

export function createVisionDetectionArtifactFromMockCameraFrame(
  input: CreateVisionDetectionArtifactFromMockFrameInput,
): VisionDetectionArtifactValidationResult {
  const frame = MockCameraFrameDescriptorSchema.parse(input.frame);

  return validateVisionDetectionInputArtifact({
    artifact_id: input.artifact_id ?? `${frame.frame_id}-detection-artifact`,
    artifact_kind: "mock_camera_frame",
    source_ref_kind: "mock_frame_ref",
    source_ref_id: input.source_ref_id ?? `${frame.frame_id}-ref`,
    redacted_source_id: frame.redacted_source_id,
    source_id_hash: frame.source_id_hash,
    mock_fixture_id: frame.mock_fixture_id,
    frame_id: frame.frame_id,
    mime_type_hint: input.mime_type_hint ?? "image/unknown",
    size_band: sizeBandFromDimensions(frame.width_band, frame.height_band),
    width_band: frame.width_band,
    height_band: frame.height_band,
    created_at_ms: input.created_at_ms ?? 0,
    retention_policy: "ephemeral_only",
    sensitivity_class: input.sensitivity_class ?? "sensitive",
    redaction_status: "metadata_only",
    active_indicator_required: frame.active_indicator_required,
    active_indicator_visible: frame.active_indicator_visible,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    detection_results_included: false,
    persisted: false,
  });
}

function inspectDetectionArtifactPayload(
  value: unknown,
  path: readonly string[] = [],
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: VisionDetectionArtifactRejectionReason;
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
      const inspected = inspectDetectionArtifactPayload(value[index], [
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
    if (isForbiddenDetectionArtifactField(key)) {
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

    const inspected = inspectDetectionArtifactPayload(nested, [...path, key]);
    if (!inspected.ok) return inspected;
  }

  return { ok: true };
}

function isForbiddenDetectionArtifactField(field: string): boolean {
  if (
    [
      "base64_included",
      "detection_labels_included",
      "detection_results_included",
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
    /detection[_-]?(?:label|result|class|object)/i,
    /object[_-]?(?:label|class|name|result)/i,
    /^labels?$/i,
    /^classes?$/i,
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

function isCameraDerivedArtifact(
  artifact: VisionDetectionInputArtifact,
): boolean {
  return (
    artifact.artifact_kind === "mock_camera_frame" ||
    artifact.source_ref_kind === "mock_frame_ref"
  );
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
  widthBand: VisionDetectionSizeBand,
  heightBand: VisionDetectionSizeBand,
): VisionDetectionSizeBand {
  if (widthBand === "large" || heightBand === "large") return "large";
  if (widthBand === "medium" || heightBand === "medium") return "medium";
  if (widthBand === "small" || heightBand === "small") return "small";
  return "unknown";
}

function reject(
  reason: VisionDetectionArtifactRejectionReason,
  fieldPath: string | null,
): VisionDetectionArtifactValidationResult {
  return {
    ok: false,
    artifact: null,
    reason,
    field_path: fieldPath,
    metadata_only: true,
  };
}
