import { z } from "zod";

import {
  VisionOcrArtifactKindSchema,
  VisionOcrSourceRefKindSchema,
  validateVisionOcrInputArtifact,
  type VisionOcrArtifactRejectionReason,
  type VisionOcrInputArtifact,
} from "./ocr-artifact";
import {
  VISION_LOCAL_OCR_MAX_TIMEOUT_MS,
  VisionLocalOcrLanguageSchema,
  VisionOcrEnablementResultSchema,
  type VisionOcrEnablementReason,
  type VisionOcrEnablementResult,
} from "./ocr-enablement";

export const TESSERACT_INVOCATION_EXECUTION_MODES = ["disabled_stub"] as const;

export const TESSERACT_INVOCATION_RESULT_STATES = [
  "execution_disabled",
  "precondition_failed",
  "provider_disabled",
  "invalid_artifact",
  "timeout_config_invalid",
  "language_not_allowed",
  "unsafe_payload_rejected",
] as const;

const TesseractInvocationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const TesseractInvocationHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const TesseractInvocationExecutionModeSchema = z.enum(
  TESSERACT_INVOCATION_EXECUTION_MODES,
);
export const TesseractInvocationResultStateSchema = z.enum(
  TESSERACT_INVOCATION_RESULT_STATES,
);

export const TesseractInvocationPlanSchema = z.strictObject({
  invocation_id: TesseractInvocationIdSchema,
  provider_id: TesseractInvocationIdSchema,
  artifact_id: TesseractInvocationIdSchema,
  artifact_kind: VisionOcrArtifactKindSchema,
  source_ref_kind: VisionOcrSourceRefKindSchema,
  language: VisionLocalOcrLanguageSchema,
  timeout_ms: z.number().int().positive().max(VISION_LOCAL_OCR_MAX_TIMEOUT_MS),
  redacted_source_id: z.literal("redacted"),
  source_id_hash: TesseractInvocationHashSchema,
  execution_mode: TesseractInvocationExecutionModeSchema,
  filesystem_path: z.string().trim().min(1).max(260).nullable(),
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

export const TesseractInvocationResultSchema = z.strictObject({
  invocation_id: TesseractInvocationIdSchema,
  provider_id: TesseractInvocationIdSchema,
  artifact_id: TesseractInvocationIdSchema.nullable(),
  status: TesseractInvocationResultStateSchema,
  reason: TesseractInvocationResultStateSchema,
  redaction_status: z.enum(["metadata_only", "withheld"]),
  latency_ms: z.number().int().nonnegative().nullable(),
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

export type TesseractInvocationExecutionMode =
  (typeof TESSERACT_INVOCATION_EXECUTION_MODES)[number];
export type TesseractInvocationResultState =
  (typeof TESSERACT_INVOCATION_RESULT_STATES)[number];
export type TesseractInvocationPlan = z.infer<
  typeof TesseractInvocationPlanSchema
>;
export type TesseractInvocationResult = z.infer<
  typeof TesseractInvocationResultSchema
>;

export type TesseractInvocationPlanResult =
  | {
      readonly ok: true;
      readonly plan: TesseractInvocationPlan;
      readonly result: null;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly plan: null;
      readonly result: TesseractInvocationResult;
      readonly metadata_only: true;
    };

export interface CreateTesseractInvocationPlanInput {
  readonly invocation_id?: string;
  readonly provider_id?: string;
  readonly artifact: unknown;
  readonly enablement: VisionOcrEnablementResult;
  readonly metadata_only: true;
}

export function createTesseractInvocationPlan(
  input: CreateTesseractInvocationPlanInput,
): TesseractInvocationPlanResult {
  const enablement = VisionOcrEnablementResultSchema.parse(input.enablement);
  const invocationId =
    input.invocation_id ?? `${enablement.provider_id}-invocation`;
  const providerId = input.provider_id ?? enablement.provider_id;

  if (!enablement.allowed) {
    return rejectedPlan({
      invocation_id: invocationId,
      provider_id: providerId,
      artifact_id: enablement.artifact_id,
      status: mapEnablementReason(enablement.reason),
    });
  }

  const artifactResult = validateVisionOcrInputArtifact(input.artifact);
  if (!artifactResult.ok) {
    return rejectedPlan({
      invocation_id: invocationId,
      provider_id: providerId,
      artifact_id: null,
      status: mapArtifactReason(artifactResult.reason),
    });
  }

  const artifact = artifactResult.artifact;
  if (enablement.artifact_id !== artifact.artifact_id) {
    return rejectedPlan({
      invocation_id: invocationId,
      provider_id: providerId,
      artifact_id: artifact.artifact_id,
      status: "precondition_failed",
    });
  }

  const plan = TesseractInvocationPlanSchema.parse({
    invocation_id: invocationId,
    provider_id: providerId,
    artifact_id: artifact.artifact_id,
    artifact_kind: artifact.artifact_kind,
    source_ref_kind: artifact.source_ref_kind,
    language: enablement.language,
    timeout_ms: enablement.timeout_ms,
    redacted_source_id: artifact.redacted_source_id,
    source_id_hash: artifact.source_id_hash,
    execution_mode: "disabled_stub",
    filesystem_path: fixtureFilesystemPath(artifact),
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

  return {
    ok: true,
    plan,
    result: null,
    metadata_only: true,
  };
}

export function runDisabledTesseractInvocation(
  plan: TesseractInvocationPlan,
): TesseractInvocationResult {
  const safePlan = TesseractInvocationPlanSchema.parse(plan);
  return invocationResult({
    invocation_id: safePlan.invocation_id,
    provider_id: safePlan.provider_id,
    artifact_id: safePlan.artifact_id,
    status: "execution_disabled",
  });
}

function fixtureFilesystemPath(
  artifact: VisionOcrInputArtifact,
): string | null {
  return artifact.artifact_kind === "test_fixture"
    ? (artifact.filesystem_path ?? null)
    : null;
}

function mapEnablementReason(
  reason: VisionOcrEnablementReason,
): TesseractInvocationResultState {
  switch (reason) {
    case "provider_disabled":
      return "provider_disabled";
    case "invalid_artifact":
      return "invalid_artifact";
    case "timeout_out_of_bounds":
      return "timeout_config_invalid";
    case "language_not_allowlisted":
      return "language_not_allowed";
    case "unsafe_payload":
    case "remote_source_forbidden":
      return "unsafe_payload_rejected";
    default:
      return "precondition_failed";
  }
}

function mapArtifactReason(
  reason: VisionOcrArtifactRejectionReason,
): TesseractInvocationResultState {
  switch (reason) {
    case "remote_url_forbidden":
    case "forbidden_field":
    case "raw_binary_payload":
    case "base64_or_data_url_forbidden":
      return "unsafe_payload_rejected";
    case "invalid_payload":
    case "unknown_artifact_kind":
    case "unknown_source_ref_kind":
      return "invalid_artifact";
    default:
      return "precondition_failed";
  }
}

function rejectedPlan(input: {
  readonly invocation_id: string;
  readonly provider_id: string;
  readonly artifact_id: string | null;
  readonly status: TesseractInvocationResultState;
}): TesseractInvocationPlanResult {
  return {
    ok: false,
    plan: null,
    result: invocationResult(input),
    metadata_only: true,
  };
}

function invocationResult(input: {
  readonly invocation_id: string;
  readonly provider_id: string;
  readonly artifact_id: string | null;
  readonly status: TesseractInvocationResultState;
}): TesseractInvocationResult {
  return TesseractInvocationResultSchema.parse({
    invocation_id: input.invocation_id,
    provider_id: input.provider_id,
    artifact_id: input.artifact_id,
    status: input.status,
    reason: input.status,
    redaction_status:
      input.status === "execution_disabled" ? "metadata_only" : "withheld",
    latency_ms: null,
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
