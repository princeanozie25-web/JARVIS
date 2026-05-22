import { z } from "zod";
import { VisionReplayRedactionStatusSchema } from "./failure-replay";
import { VisionFailureReplayReferenceSchema } from "./session";

export const VISION_FRAME_SOURCE_TYPES = [
  "camera_frame",
  "screen_region",
  "uploaded_image",
  "ocr_region",
  "developer_fixture",
] as const;

export const VISION_FRAME_INGESTION_STATUSES = [
  "accepted",
  "rejected",
  "stale",
  "invalid",
] as const;

export const VISION_FRAME_INGESTION_REASONS = [
  "accepted_metadata_only",
  "stale_frame",
  "invalid_descriptor",
  "hash_mismatch",
  "raw_payload_rejected",
] as const;

export const VISION_FRAME_TELEMETRY_EVENT_TYPES = [
  "frame_ingested",
  "frame_rejected",
] as const;

export const VISION_FRAME_DISABLED_FEATURES = [
  "camera_capture",
  "screen_capture",
  "raw_frame_storage",
  "raw_image_storage",
  "blob_storage",
  "base64_storage",
  "ocr_text_extraction",
  "provider_execution",
  "cloud_calls",
  "runtime_actions",
  "background_jobs",
] as const;

export type VisionFrameSourceType = (typeof VISION_FRAME_SOURCE_TYPES)[number];
export type VisionFrameIngestionStatus =
  (typeof VISION_FRAME_INGESTION_STATUSES)[number];
export type VisionFrameIngestionReason =
  (typeof VISION_FRAME_INGESTION_REASONS)[number];
export type VisionFrameTelemetryEventType =
  (typeof VISION_FRAME_TELEMETRY_EVENT_TYPES)[number];
export type VisionFrameDisabledFeature =
  (typeof VISION_FRAME_DISABLED_FEATURES)[number];

const VisionFrameIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionFrameHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionFrameSourceTypeSchema = z.enum(VISION_FRAME_SOURCE_TYPES);
export const VisionFrameIngestionStatusSchema = z.enum(
  VISION_FRAME_INGESTION_STATUSES,
);
export const VisionFrameIngestionReasonSchema = z.enum(
  VISION_FRAME_INGESTION_REASONS,
);
export const VisionFrameTelemetryEventTypeSchema = z.enum(
  VISION_FRAME_TELEMETRY_EVENT_TYPES,
);
export const VisionFrameDisabledFeatureSchema = z.enum(
  VISION_FRAME_DISABLED_FEATURES,
);

export const VisionFrameFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_FRAME_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionFrameDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_FRAME_FEATURE_FLAGS = Object.fromEntries(
  VISION_FRAME_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionFrameFeatureFlagsSchema>;

export const VisionFrameDescriptorSchema = z
  .strictObject({
    frame_id: VisionFrameIdSchema,
    vision_session_id: VisionFrameIdSchema,
    source_type: VisionFrameSourceTypeSchema,
    input_hash: VisionFrameHashSchema,
    observed_at: z.number().int().nonnegative(),
    received_at: z.number().int().nonnegative(),
    freshness_ms: z.number().int().nonnegative(),
    stale_after_ms: z.number().int().positive(),
    stale: z.boolean(),
    current_truth: z.literal(false),
    redaction_status: VisionReplayRedactionStatusSchema,
    failure_replay_ref: VisionFailureReplayReferenceSchema.nullable(),
    metadata_only: z.literal(true),
    raw_payload_stored: z.literal(false),
    advisory_only: z.literal(true),
    capture_started: z.literal(false),
    provider_executed: z.literal(false),
    cloud_called: z.literal(false),
    action_executed: z.literal(false),
    background_job_started: z.literal(false),
  })
  .superRefine((descriptor, ctx) => {
    if (descriptor.received_at < descriptor.observed_at) {
      ctx.addIssue({
        code: "custom",
        path: ["received_at"],
        message: "received_at must be greater than or equal to observed_at.",
      });
    }
    const expectedFreshnessMs = descriptor.received_at - descriptor.observed_at;
    if (descriptor.freshness_ms !== expectedFreshnessMs) {
      ctx.addIssue({
        code: "custom",
        path: ["freshness_ms"],
        message: "freshness_ms must equal received_at - observed_at.",
      });
    }
    const expectedStale = descriptor.freshness_ms > descriptor.stale_after_ms;
    if (descriptor.stale !== expectedStale) {
      ctx.addIssue({
        code: "custom",
        path: ["stale"],
        message: "stale must reflect freshness_ms > stale_after_ms.",
      });
    }
    if (
      descriptor.failure_replay_ref !== null &&
      descriptor.failure_replay_ref.input_hash !== descriptor.input_hash
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["failure_replay_ref", "input_hash"],
        message: "failure replay input_hash must match frame input_hash.",
      });
    }
  });

export const VisionFrameIngestionResultSchema = z.strictObject({
  kind: z.literal("vision.frame_ingestion_result"),
  status: VisionFrameIngestionStatusSchema,
  reason: VisionFrameIngestionReasonSchema,
  frame_id: VisionFrameIdSchema.nullable(),
  vision_session_id: VisionFrameIdSchema.nullable(),
  input_hash: VisionFrameHashSchema.nullable(),
  descriptor: VisionFrameDescriptorSchema.nullable(),
  metadata_only: z.literal(true),
  stored: z.literal(false),
  raw_payload_stored: z.literal(false),
  current_truth: z.literal(false),
  advisory_only: z.literal(true),
  capture_started: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionFrameTelemetryEventSchema = z.strictObject({
  event_type: VisionFrameTelemetryEventTypeSchema,
  status: VisionFrameIngestionStatusSchema,
  reason: VisionFrameIngestionReasonSchema,
  frame_id: VisionFrameIdSchema.nullable(),
  vision_session_id: VisionFrameIdSchema.nullable(),
  source_type: VisionFrameSourceTypeSchema.nullable(),
  input_hash: VisionFrameHashSchema.nullable(),
  stale: z.boolean().nullable(),
  freshness_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  stored: z.literal(false),
  capture_started: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionFrameFeatureFlags = z.infer<
  typeof VisionFrameFeatureFlagsSchema
>;
export type VisionFrameDescriptor = z.infer<typeof VisionFrameDescriptorSchema>;
export type VisionFrameIngestionResult = z.infer<
  typeof VisionFrameIngestionResultSchema
>;
export type VisionFrameTelemetryEvent = z.infer<
  typeof VisionFrameTelemetryEventSchema
>;

export interface CreateVisionFrameDescriptorInput {
  frame_id: string;
  vision_session_id: string;
  source_type: VisionFrameSourceType;
  input_hash: string;
  observed_at: number;
  received_at: number;
  stale_after_ms?: number;
  failure_replay_ref?: z.infer<
    typeof VisionFailureReplayReferenceSchema
  > | null;
}

function invalidResult(): VisionFrameIngestionResult {
  return VisionFrameIngestionResultSchema.parse({
    kind: "vision.frame_ingestion_result",
    status: "invalid",
    reason: "invalid_descriptor",
    frame_id: null,
    vision_session_id: null,
    input_hash: null,
    descriptor: null,
    metadata_only: true,
    stored: false,
    raw_payload_stored: false,
    current_truth: false,
    advisory_only: true,
    capture_started: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
  });
}

export function createVisionFrameDescriptor(
  input: CreateVisionFrameDescriptorInput,
): VisionFrameDescriptor {
  const freshness_ms = input.received_at - input.observed_at;
  const stale_after_ms = input.stale_after_ms ?? 5_000;
  return VisionFrameDescriptorSchema.parse({
    frame_id: input.frame_id,
    vision_session_id: input.vision_session_id,
    source_type: input.source_type,
    input_hash: input.input_hash,
    observed_at: input.observed_at,
    received_at: input.received_at,
    freshness_ms,
    stale_after_ms,
    stale: freshness_ms > stale_after_ms,
    current_truth: false,
    redaction_status: "hash_only",
    failure_replay_ref: input.failure_replay_ref ?? null,
    metadata_only: true,
    raw_payload_stored: false,
    advisory_only: true,
    capture_started: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
    background_job_started: false,
  });
}

export function validateVisionFrameDescriptor(
  input: unknown,
): VisionFrameDescriptor | null {
  const parsed = VisionFrameDescriptorSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function ingestVisionFrameDescriptor(
  input: unknown,
): VisionFrameIngestionResult {
  const descriptor = validateVisionFrameDescriptor(input);
  if (!descriptor) return invalidResult();

  return VisionFrameIngestionResultSchema.parse({
    kind: "vision.frame_ingestion_result",
    status: descriptor.stale ? "stale" : "accepted",
    reason: descriptor.stale ? "stale_frame" : "accepted_metadata_only",
    frame_id: descriptor.frame_id,
    vision_session_id: descriptor.vision_session_id,
    input_hash: descriptor.input_hash,
    descriptor,
    metadata_only: true,
    stored: false,
    raw_payload_stored: false,
    current_truth: false,
    advisory_only: true,
    capture_started: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
  });
}

export function createVisionFrameTelemetryEvent(
  resultInput: VisionFrameIngestionResult,
): VisionFrameTelemetryEvent {
  const result = VisionFrameIngestionResultSchema.parse(resultInput);
  return VisionFrameTelemetryEventSchema.parse({
    event_type:
      result.status === "accepted" ? "frame_ingested" : "frame_rejected",
    status: result.status,
    reason: result.reason,
    frame_id: result.frame_id,
    vision_session_id: result.vision_session_id,
    source_type: result.descriptor?.source_type ?? null,
    input_hash: result.input_hash,
    stale: result.descriptor?.stale ?? null,
    freshness_ms: result.descriptor?.freshness_ms ?? null,
    metadata_only: true,
    raw_payload_included: false,
    stored: false,
    capture_started: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
  });
}
