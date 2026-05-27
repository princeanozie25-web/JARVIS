import { z } from "zod";

import {
  VisionCapabilitySchema,
  VisionProviderKindSchema,
  type VisionCapability,
  type VisionProviderKind,
} from "./contracts";
import {
  validateVisionOcrInputArtifact,
  type VisionOcrArtifactRejectionReason,
  type VisionOcrInputArtifact,
} from "./ocr-artifact";
import type { VisionMutationAuthorityClass } from "./policy";

export const VISION_LOCAL_OCR_PROVIDER_KINDS = [
  "local_ocr",
  "tesseract_stub",
] as const;

export const VISION_LOCAL_OCR_ALLOWED_LANGUAGES = ["eng"] as const;

export const VISION_LOCAL_OCR_MAX_TIMEOUT_MS = 10_000;

export const VISION_OCR_ENABLEMENT_REASONS = [
  "allowed",
  "provider_disabled",
  "unsupported_provider_kind",
  "cloud_provider_forbidden",
  "invalid_artifact",
  "non_ephemeral_retention_forbidden",
  "remote_source_forbidden",
  "user_trigger_required",
  "timeout_out_of_bounds",
  "language_not_allowlisted",
  "unsafe_payload",
  "mutation_authority_forbidden",
  "cloud_fallback_forbidden",
  "network_fallback_forbidden",
  "redaction_unsafe",
] as const;

const OcrEnablementIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionLocalOcrProviderKindSchema =
  VisionProviderKindSchema.extract(VISION_LOCAL_OCR_PROVIDER_KINDS);
export const VisionLocalOcrLanguageSchema = z.enum(
  VISION_LOCAL_OCR_ALLOWED_LANGUAGES,
);
export const VisionOcrEnablementReasonSchema = z.enum(
  VISION_OCR_ENABLEMENT_REASONS,
);

export const VisionLocalOcrProviderEnablementConfigSchema = z.strictObject({
  provider_id: OcrEnablementIdSchema,
  provider_kind: VisionProviderKindSchema,
  enabled: z.boolean(),
  binary_path_configured: z.boolean(),
  supported_capability: VisionCapabilitySchema.extract(["screenshot_ocr"]),
  timeout_ms: z.number().int().positive(),
  max_input_size_bytes: z.number().int().positive(),
  language: z.string().trim().min(1).max(24),
  cloud_fallback_requested: z.boolean().default(false),
  network_fallback_requested: z.boolean().default(false),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  raw_image_input_allowed: z.literal(false),
  raw_ocr_text_output_allowed: z.literal(false),
  process_execution_allowed: z.literal(false),
  persistence_allowed: z.literal(false),
});

export const VisionOcrEnablementResultSchema = z.strictObject({
  allowed: z.boolean(),
  reason: VisionOcrEnablementReasonSchema,
  provider_id: OcrEnablementIdSchema,
  provider_kind: VisionProviderKindSchema,
  capability: VisionCapabilitySchema,
  artifact_id: OcrEnablementIdSchema.nullable(),
  artifact_validation_reason: z.string().trim().min(1).max(120).nullable(),
  timeout_ms: z.number().int().nonnegative(),
  language: z.string().trim().min(1).max(24),
  redaction_status: z.enum(["metadata_only", "redacted", "withheld"]),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  mutation_authority_granted: z.literal(false),
  runtime_executed: z.literal(false),
  provider_executed: z.literal(false),
});

export type VisionLocalOcrProviderKind =
  (typeof VISION_LOCAL_OCR_PROVIDER_KINDS)[number];
export type VisionLocalOcrAllowedLanguage =
  (typeof VISION_LOCAL_OCR_ALLOWED_LANGUAGES)[number];
export type VisionOcrEnablementReason =
  (typeof VISION_OCR_ENABLEMENT_REASONS)[number];
export type VisionLocalOcrProviderEnablementConfig = z.infer<
  typeof VisionLocalOcrProviderEnablementConfigSchema
>;
export type VisionOcrEnablementResult = z.infer<
  typeof VisionOcrEnablementResultSchema
>;

export interface VisionOcrEnablementInput {
  readonly provider_config: VisionLocalOcrProviderEnablementConfig;
  readonly capability: VisionCapability;
  readonly artifact: unknown;
  readonly user_triggered: boolean;
  readonly timeout_ms: number;
  readonly mutation_authority_requested?: readonly VisionMutationAuthorityClass[];
  readonly cloud_fallback_requested?: boolean;
  readonly network_fallback_requested?: boolean;
  readonly metadata_only: true;
}

export function evaluateVisionOcrEnablement(
  input: VisionOcrEnablementInput,
): VisionOcrEnablementResult {
  const config = VisionLocalOcrProviderEnablementConfigSchema.parse(
    input.provider_config,
  );
  const capability = VisionCapabilitySchema.parse(input.capability);
  const timeoutMs = Math.max(0, input.timeout_ms);
  const base = {
    provider_id: config.provider_id,
    provider_kind: config.provider_kind,
    capability,
    timeout_ms: timeoutMs,
    language: config.language,
  };

  if (!config.enabled) return deny(base, "provider_disabled", null, null);
  if (config.provider_kind === "cloud_vision") {
    return deny(base, "cloud_provider_forbidden", null, null);
  }
  if (!isLocalOcrProviderKind(config.provider_kind)) {
    return deny(base, "unsupported_provider_kind", null, null);
  }

  const artifactResult = validateVisionOcrInputArtifact(input.artifact);
  if (!artifactResult.ok) {
    return deny(
      base,
      mapArtifactRejectionReason(artifactResult.reason),
      null,
      artifactResult.reason,
    );
  }

  const artifact = artifactResult.artifact;
  if (artifact.retention_policy !== "ephemeral_only") {
    return deny(
      base,
      "non_ephemeral_retention_forbidden",
      artifact,
      "non_ephemeral_retention_forbidden",
    );
  }
  if (!input.user_triggered) {
    return deny(base, "user_trigger_required", artifact, null);
  }
  if (
    timeoutMs <= 0 ||
    timeoutMs > VISION_LOCAL_OCR_MAX_TIMEOUT_MS ||
    config.timeout_ms > VISION_LOCAL_OCR_MAX_TIMEOUT_MS
  ) {
    return deny(base, "timeout_out_of_bounds", artifact, null);
  }
  if (
    !VISION_LOCAL_OCR_ALLOWED_LANGUAGES.includes(
      config.language as VisionLocalOcrAllowedLanguage,
    )
  ) {
    return deny(base, "language_not_allowlisted", artifact, null);
  }
  if (config.cloud_fallback_requested || input.cloud_fallback_requested) {
    return deny(base, "cloud_fallback_forbidden", artifact, null);
  }
  if (config.network_fallback_requested || input.network_fallback_requested) {
    return deny(base, "network_fallback_forbidden", artifact, null);
  }
  if ((input.mutation_authority_requested?.length ?? 0) > 0) {
    return deny(base, "mutation_authority_forbidden", artifact, null);
  }
  if (
    artifact.raw_payload_included ||
    artifact.raw_image_included ||
    artifact.raw_frame_included ||
    artifact.base64_included ||
    artifact.ocr_text_included ||
    artifact.persisted ||
    config.raw_image_input_allowed ||
    config.raw_ocr_text_output_allowed ||
    config.persistence_allowed
  ) {
    return deny(base, "unsafe_payload", artifact, null);
  }
  if (
    artifact.redaction_status !== "metadata_only" &&
    artifact.redaction_status !== "redacted"
  ) {
    return deny(base, "redaction_unsafe", artifact, null);
  }

  return VisionOcrEnablementResultSchema.parse({
    ...base,
    allowed: true,
    reason: "allowed",
    artifact_id: artifact.artifact_id,
    artifact_validation_reason: null,
    redaction_status: artifact.redaction_status,
    metadata_only: true,
    advisory_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    cloud_called: false,
    network_called: false,
    mutation_authority_granted: false,
    runtime_executed: false,
    provider_executed: false,
  });
}

function isLocalOcrProviderKind(
  providerKind: VisionProviderKind,
): providerKind is VisionLocalOcrProviderKind {
  return VISION_LOCAL_OCR_PROVIDER_KINDS.includes(
    providerKind as VisionLocalOcrProviderKind,
  );
}

function mapArtifactRejectionReason(
  reason: VisionOcrArtifactRejectionReason,
): VisionOcrEnablementReason {
  switch (reason) {
    case "non_ephemeral_retention_forbidden":
      return "non_ephemeral_retention_forbidden";
    case "remote_url_forbidden":
      return "remote_source_forbidden";
    case "forbidden_field":
    case "raw_binary_payload":
    case "base64_or_data_url_forbidden":
      return "unsafe_payload";
    default:
      return "invalid_artifact";
  }
}

function deny(
  base: {
    readonly provider_id: string;
    readonly provider_kind: VisionProviderKind;
    readonly capability: VisionCapability;
    readonly timeout_ms: number;
    readonly language: string;
  },
  reason: VisionOcrEnablementReason,
  artifact: VisionOcrInputArtifact | null,
  artifactValidationReason: string | null,
): VisionOcrEnablementResult {
  return VisionOcrEnablementResultSchema.parse({
    ...base,
    allowed: false,
    reason,
    artifact_id: artifact?.artifact_id ?? null,
    artifact_validation_reason: artifactValidationReason,
    redaction_status: artifact?.redaction_status ?? "withheld",
    metadata_only: true,
    advisory_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    cloud_called: false,
    network_called: false,
    mutation_authority_granted: false,
    runtime_executed: false,
    provider_executed: false,
  });
}
