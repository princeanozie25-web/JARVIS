import { z } from "zod";

import {
  VisionDetectionArtifactKindSchema,
  VisionDetectionSourceRefKindSchema,
  validateVisionDetectionInputArtifact,
  type VisionDetectionArtifactRejectionReason,
  type VisionDetectionInputArtifact,
} from "./detection-artifact";
import {
  VISION_LOCAL_DETECTION_MAX_CONFIDENCE_THRESHOLD,
  VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS,
  VISION_LOCAL_DETECTION_MIN_CONFIDENCE_THRESHOLD,
  VisionDetectionEnablementResultSchema,
  VisionLocalDetectionModelSchema,
  type VisionDetectionEnablementReason,
  type VisionDetectionEnablementResult,
} from "./detection-enablement";

export const YOLO_INVOCATION_EXECUTION_MODES = ["disabled_stub"] as const;

export const YOLO_INVOCATION_RESULT_STATES = [
  "execution_disabled",
  "precondition_failed",
  "provider_disabled",
  "invalid_artifact",
  "timeout_config_invalid",
  "confidence_config_invalid",
  "model_not_allowed",
  "unsafe_payload_rejected",
] as const;

const YoloInvocationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const YoloInvocationHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const YoloInvocationExecutionModeSchema = z.enum(
  YOLO_INVOCATION_EXECUTION_MODES,
);
export const YoloInvocationResultStateSchema = z.enum(
  YOLO_INVOCATION_RESULT_STATES,
);

export const YoloInvocationPlanSchema = z.strictObject({
  invocation_id: YoloInvocationIdSchema,
  provider_id: YoloInvocationIdSchema,
  artifact_id: YoloInvocationIdSchema,
  artifact_kind: VisionDetectionArtifactKindSchema,
  source_ref_kind: VisionDetectionSourceRefKindSchema,
  model_name: VisionLocalDetectionModelSchema,
  confidence_threshold: z
    .number()
    .min(VISION_LOCAL_DETECTION_MIN_CONFIDENCE_THRESHOLD)
    .max(VISION_LOCAL_DETECTION_MAX_CONFIDENCE_THRESHOLD),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .max(VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS),
  redacted_source_id: z.literal("redacted"),
  source_id_hash: YoloInvocationHashSchema,
  execution_mode: YoloInvocationExecutionModeSchema,
  filesystem_path: z.string().trim().min(1).max(260).nullable(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  detection_results_included: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  mutation_authority_granted: z.literal(false),
  runtime_executed: z.literal(false),
  provider_executed: z.literal(false),
});

export const YoloInvocationResultSchema = z.strictObject({
  invocation_id: YoloInvocationIdSchema,
  provider_id: YoloInvocationIdSchema,
  artifact_id: YoloInvocationIdSchema.nullable(),
  status: YoloInvocationResultStateSchema,
  reason: YoloInvocationResultStateSchema,
  redaction_status: z.enum(["metadata_only", "withheld"]),
  latency_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  detection_results_included: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  mutation_authority_granted: z.literal(false),
  runtime_executed: z.literal(false),
  provider_executed: z.literal(false),
});

export type YoloInvocationExecutionMode =
  (typeof YOLO_INVOCATION_EXECUTION_MODES)[number];
export type YoloInvocationResultState =
  (typeof YOLO_INVOCATION_RESULT_STATES)[number];
export type YoloInvocationPlan = z.infer<typeof YoloInvocationPlanSchema>;
export type YoloInvocationResult = z.infer<typeof YoloInvocationResultSchema>;

export type YoloInvocationPlanResult =
  | {
      readonly ok: true;
      readonly plan: YoloInvocationPlan;
      readonly result: null;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly plan: null;
      readonly result: YoloInvocationResult;
      readonly metadata_only: true;
    };

export interface CreateYoloInvocationPlanInput {
  readonly invocation_id?: string;
  readonly provider_id?: string;
  readonly artifact: unknown;
  readonly enablement: VisionDetectionEnablementResult;
  readonly metadata_only: true;
}

export function createYoloInvocationPlan(
  input: CreateYoloInvocationPlanInput,
): YoloInvocationPlanResult {
  const enablement = VisionDetectionEnablementResultSchema.parse(
    input.enablement,
  );
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

  const artifactResult = validateVisionDetectionInputArtifact(input.artifact);
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

  const plan = YoloInvocationPlanSchema.parse({
    invocation_id: invocationId,
    provider_id: providerId,
    artifact_id: artifact.artifact_id,
    artifact_kind: artifact.artifact_kind,
    source_ref_kind: artifact.source_ref_kind,
    model_name: enablement.model_name,
    confidence_threshold: enablement.confidence_threshold,
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
    detection_labels_included: false,
    detection_results_included: false,
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

export function runDisabledYoloInvocation(
  plan: YoloInvocationPlan,
): YoloInvocationResult {
  const safePlan = YoloInvocationPlanSchema.parse(plan);
  return invocationResult({
    invocation_id: safePlan.invocation_id,
    provider_id: safePlan.provider_id,
    artifact_id: safePlan.artifact_id,
    status: "execution_disabled",
  });
}

function fixtureFilesystemPath(
  artifact: VisionDetectionInputArtifact,
): string | null {
  return artifact.artifact_kind === "test_fixture"
    ? (artifact.filesystem_path ?? null)
    : null;
}

function mapEnablementReason(
  reason: VisionDetectionEnablementReason,
): YoloInvocationResultState {
  switch (reason) {
    case "provider_disabled":
      return "provider_disabled";
    case "invalid_artifact":
      return "invalid_artifact";
    case "timeout_out_of_bounds":
      return "timeout_config_invalid";
    case "confidence_threshold_out_of_bounds":
      return "confidence_config_invalid";
    case "model_not_allowlisted":
    case "weights_not_configured_for_stub":
      return "model_not_allowed";
    case "unsafe_payload":
    case "remote_source_forbidden":
      return "unsafe_payload_rejected";
    default:
      return "precondition_failed";
  }
}

function mapArtifactReason(
  reason: VisionDetectionArtifactRejectionReason,
): YoloInvocationResultState {
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
  readonly status: YoloInvocationResultState;
}): YoloInvocationPlanResult {
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
  readonly status: YoloInvocationResultState;
}): YoloInvocationResult {
  return YoloInvocationResultSchema.parse({
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
    detection_labels_included: false,
    detection_results_included: false,
    cloud_called: false,
    network_called: false,
    mutation_authority_granted: false,
    runtime_executed: false,
    provider_executed: false,
  });
}
