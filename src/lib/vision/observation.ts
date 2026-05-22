import { z } from "zod";
import {
  VisionFrameDescriptorSchema,
  type VisionFrameDescriptor,
} from "./frame-ingestion";
import {
  VisionReplayConfidenceBandSchema,
  VisionReplayRedactionStatusSchema,
} from "./failure-replay";
import {
  VisionLocalProviderIdSchema,
  VisionProviderResultClassSchema,
  VisionProviderResultSchema,
  type VisionProviderResult,
} from "./local-provider-contract";

export const VISION_OBSERVATION_CLASSES = [
  "object_presence",
  "text_presence",
  "pose_presence",
  "hand_presence",
  "face_presence",
  "screen_context_presence",
  "unknown",
] as const;

export const VISION_OBSERVATION_DISABLED_FEATURES = [
  "raw_frame_storage",
  "raw_image_storage",
  "ocr_text_storage",
  "screen_content_storage",
  "detected_label_storage",
  "face_identity_storage",
  "biometric_attribute_storage",
  "coordinate_storage",
  "provider_execution",
  "cloud_calls",
  "runtime_actions",
  "approval_granting",
  "background_watchers",
] as const;

export type VisionObservationClass =
  (typeof VISION_OBSERVATION_CLASSES)[number];
export type VisionObservationDisabledFeature =
  (typeof VISION_OBSERVATION_DISABLED_FEATURES)[number];

const VisionObservationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionObservationHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionObservationClassSchema = z.enum(VISION_OBSERVATION_CLASSES);
export const VisionObservationDisabledFeatureSchema = z.enum(
  VISION_OBSERVATION_DISABLED_FEATURES,
);

export const VisionObservationFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_OBSERVATION_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionObservationDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_OBSERVATION_FEATURE_FLAGS = Object.fromEntries(
  VISION_OBSERVATION_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionObservationFeatureFlagsSchema>;

export const VisionObservationSchema = z
  .strictObject({
    observation_id: VisionObservationIdSchema,
    observation_class: VisionObservationClassSchema,
    vision_session_id: VisionObservationIdSchema,
    frame_id: VisionObservationIdSchema,
    provider_id: VisionLocalProviderIdSchema,
    input_hash: VisionObservationHashSchema,
    output_hash: VisionObservationHashSchema,
    provider_result_class: VisionProviderResultClassSchema,
    confidence: z.number().min(0).max(1).nullable(),
    confidence_band: VisionReplayConfidenceBandSchema,
    observed_count: z.number().int().nonnegative(),
    observed_at: z.number().int().nonnegative(),
    received_at: z.number().int().nonnegative(),
    freshness_ms: z.number().int().nonnegative(),
    stale_after_ms: z.number().int().positive(),
    stale: z.boolean(),
    current_truth: z.literal(false),
    derived: z.literal(true),
    advisory_only: z.literal(true),
    canonical_truth: z.literal(false),
    perception_authority: z.literal(false),
    redaction_status: VisionReplayRedactionStatusSchema,
    metadata_only: z.literal(true),
    raw_payload_stored: z.literal(false),
    text_payload_stored: z.literal(false),
    action_executed: z.literal(false),
    cloud_called: z.literal(false),
    provider_executed: z.literal(false),
  })
  .superRefine((observation, ctx) => {
    const expectedFreshnessMs =
      observation.received_at - observation.observed_at;
    if (observation.freshness_ms !== expectedFreshnessMs) {
      ctx.addIssue({
        code: "custom",
        path: ["freshness_ms"],
        message: "freshness_ms must equal received_at - observed_at.",
      });
    }
    const expectedStale = observation.freshness_ms > observation.stale_after_ms;
    if (observation.stale !== expectedStale) {
      ctx.addIssue({
        code: "custom",
        path: ["stale"],
        message: "stale must reflect freshness_ms > stale_after_ms.",
      });
    }
  });

export const VisionObservationAggregateSchema = z.strictObject({
  kind: z.literal("vision.observation_aggregate"),
  total_observations: z.number().int().nonnegative(),
  stale_observations: z.number().int().nonnegative(),
  current_truth_count: z.literal(0),
  classes: z.record(
    VisionObservationClassSchema,
    z.number().int().nonnegative(),
  ),
  provider_ids: z.array(VisionLocalProviderIdSchema),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  advisory_only: z.literal(true),
  canonical_truth: z.literal(false),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionObservationReplayStepSchema = z.strictObject({
  observation_class: VisionObservationClassSchema,
  provider_id: VisionLocalProviderIdSchema,
  provider_result_class: VisionProviderResultClassSchema,
  input_hash: VisionObservationHashSchema,
  output_hash: VisionObservationHashSchema,
  confidence: z.number().min(0).max(1).nullable(),
  confidence_band: VisionReplayConfidenceBandSchema,
  observed_count: z.number().int().nonnegative(),
  stale: z.boolean(),
  redaction_status: VisionReplayRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  advisory_only: z.literal(true),
  canonical_truth: z.literal(false),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionObservationFeatureFlags = z.infer<
  typeof VisionObservationFeatureFlagsSchema
>;
export type VisionObservation = z.infer<typeof VisionObservationSchema>;
export type VisionObservationAggregate = z.infer<
  typeof VisionObservationAggregateSchema
>;
export type VisionObservationReplayStep = z.infer<
  typeof VisionObservationReplayStepSchema
>;

export interface CreateVisionObservationInput {
  observation_id: string;
  frame_descriptor: VisionFrameDescriptor;
  provider_result: VisionProviderResult;
}

function observationClassForProviderResult(
  result: VisionProviderResult,
): VisionObservationClass {
  switch (result.result_class) {
    case "object_detection_summary":
      return "object_presence";
    case "ocr_summary":
      return "text_presence";
    case "pose_landmark_summary":
      return "pose_presence";
    case "hand_landmark_summary":
      return "hand_presence";
    case "face_landmark_summary":
      return "face_presence";
    case "screen_context_summary":
      return "screen_context_presence";
    default:
      return "unknown";
  }
}

function observedCountForProviderResult(result: VisionProviderResult): number {
  return result.detected_count ?? result.summary_count ?? 0;
}

export function createVisionObservation(
  input: CreateVisionObservationInput,
): VisionObservation {
  const frame = VisionFrameDescriptorSchema.parse(input.frame_descriptor);
  const result = VisionProviderResultSchema.parse(input.provider_result);
  if (frame.frame_id !== result.frame_id) {
    throw new Error("provider result frame_id must match frame descriptor.");
  }
  if (frame.vision_session_id !== result.vision_session_id) {
    throw new Error(
      "provider result vision_session_id must match frame descriptor.",
    );
  }

  return VisionObservationSchema.parse({
    observation_id: input.observation_id,
    observation_class: observationClassForProviderResult(result),
    vision_session_id: frame.vision_session_id,
    frame_id: frame.frame_id,
    provider_id: result.provider_id,
    input_hash: frame.input_hash,
    output_hash: result.output_hash,
    provider_result_class: result.result_class,
    confidence: result.confidence,
    confidence_band: result.confidence_band,
    observed_count: observedCountForProviderResult(result),
    observed_at: frame.observed_at,
    received_at: frame.received_at,
    freshness_ms: frame.freshness_ms,
    stale_after_ms: frame.stale_after_ms,
    stale: frame.stale,
    current_truth: false,
    derived: true,
    advisory_only: true,
    canonical_truth: false,
    perception_authority: false,
    redaction_status: result.redaction_status,
    metadata_only: true,
    raw_payload_stored: false,
    text_payload_stored: false,
    action_executed: false,
    cloud_called: false,
    provider_executed: false,
  });
}

export function aggregateVisionObservations(
  observationsInput: VisionObservation[],
): VisionObservationAggregate {
  const observations = observationsInput.map((observation) =>
    VisionObservationSchema.parse(observation),
  );
  const classCounts = Object.fromEntries(
    VISION_OBSERVATION_CLASSES.map((observationClass) => [
      observationClass,
      observations.filter(
        (observation) => observation.observation_class === observationClass,
      ).length,
    ]),
  ) as Record<VisionObservationClass, number>;
  const providerIds = [
    ...new Set(observations.map((item) => item.provider_id)),
  ];

  return VisionObservationAggregateSchema.parse({
    kind: "vision.observation_aggregate",
    total_observations: observations.length,
    stale_observations: observations.filter((item) => item.stale).length,
    current_truth_count: 0,
    classes: classCounts,
    provider_ids: providerIds,
    metadata_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    advisory_only: true,
    canonical_truth: false,
    perception_authority: false,
    action_executed: false,
  });
}

export function createVisionObservationReplayStep(
  observationInput: VisionObservation,
): VisionObservationReplayStep {
  const observation = VisionObservationSchema.parse(observationInput);
  return VisionObservationReplayStepSchema.parse({
    observation_class: observation.observation_class,
    provider_id: observation.provider_id,
    provider_result_class: observation.provider_result_class,
    input_hash: observation.input_hash,
    output_hash: observation.output_hash,
    confidence: observation.confidence,
    confidence_band: observation.confidence_band,
    observed_count: observation.observed_count,
    stale: observation.stale,
    redaction_status: observation.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    advisory_only: true,
    canonical_truth: false,
    perception_authority: false,
    action_executed: false,
  });
}
