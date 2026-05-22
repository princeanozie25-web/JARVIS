import { z } from "zod";
import {
  VisionFrameDescriptorSchema,
  VisionFrameSourceTypeSchema,
  type VisionFrameDescriptor,
  type VisionFrameSourceType,
} from "./frame-ingestion";
import {
  VisionReplayConfidenceBandSchema,
  VisionReplayRedactionStatusSchema,
} from "./failure-replay";

export const VISION_LOCAL_PROVIDER_IDS = [
  "yolo_v8n",
  "mediapipe",
  "tesseract",
  "screen_ocr",
  "developer_fixture",
] as const;

export const VISION_PROVIDER_CAPABILITIES = [
  "object_detection",
  "pose_landmarks",
  "hand_landmarks",
  "face_landmarks",
  "ocr",
  "screen_context",
] as const;

export const VISION_PROVIDER_RESULT_CLASSES = [
  "no_result",
  "object_detection_summary",
  "pose_landmark_summary",
  "hand_landmark_summary",
  "face_landmark_summary",
  "ocr_summary",
  "screen_context_summary",
  "developer_fixture_summary",
] as const;

export const VISION_PROVIDER_ELIGIBILITY_STATUSES = [
  "eligible",
  "ineligible",
  "invalid_frame",
] as const;

export const VISION_PROVIDER_ELIGIBILITY_REASONS = [
  "eligible_contract_found",
  "source_type_not_supported",
  "capability_not_supported",
  "invalid_frame_descriptor",
] as const;

export const VISION_PROVIDER_TELEMETRY_EVENT_TYPES = [
  "provider_eligibility_evaluated",
  "provider_result_recorded",
] as const;

export const VISION_PROVIDER_DISABLED_FEATURES = [
  "real_provider_execution",
  "model_loading",
  "camera_capture",
  "screen_capture",
  "raw_frame_storage",
  "raw_image_storage",
  "ocr_text_storage",
  "image_buffer_storage",
  "cloud_calls",
  "runtime_actions",
  "approval_granting",
  "background_jobs",
] as const;

export type VisionLocalProviderId = (typeof VISION_LOCAL_PROVIDER_IDS)[number];
export type VisionProviderCapability =
  (typeof VISION_PROVIDER_CAPABILITIES)[number];
export type VisionProviderResultClass =
  (typeof VISION_PROVIDER_RESULT_CLASSES)[number];
export type VisionProviderEligibilityStatus =
  (typeof VISION_PROVIDER_ELIGIBILITY_STATUSES)[number];
export type VisionProviderEligibilityReason =
  (typeof VISION_PROVIDER_ELIGIBILITY_REASONS)[number];
export type VisionProviderTelemetryEventType =
  (typeof VISION_PROVIDER_TELEMETRY_EVENT_TYPES)[number];
export type VisionProviderDisabledFeature =
  (typeof VISION_PROVIDER_DISABLED_FEATURES)[number];

const VisionProviderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionProviderHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionLocalProviderIdSchema = z.enum(VISION_LOCAL_PROVIDER_IDS);
export const VisionProviderCapabilitySchema = z.enum(
  VISION_PROVIDER_CAPABILITIES,
);
export const VisionProviderResultClassSchema = z.enum(
  VISION_PROVIDER_RESULT_CLASSES,
);
export const VisionProviderEligibilityStatusSchema = z.enum(
  VISION_PROVIDER_ELIGIBILITY_STATUSES,
);
export const VisionProviderEligibilityReasonSchema = z.enum(
  VISION_PROVIDER_ELIGIBILITY_REASONS,
);
export const VisionProviderTelemetryEventTypeSchema = z.enum(
  VISION_PROVIDER_TELEMETRY_EVENT_TYPES,
);
export const VisionProviderDisabledFeatureSchema = z.enum(
  VISION_PROVIDER_DISABLED_FEATURES,
);

export const VisionProviderFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_PROVIDER_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionProviderDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_PROVIDER_FEATURE_FLAGS = Object.fromEntries(
  VISION_PROVIDER_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionProviderFeatureFlagsSchema>;

export const VisionLocalProviderContractSchema = z.strictObject({
  provider_id: VisionLocalProviderIdSchema,
  capabilities: z.array(VisionProviderCapabilitySchema).min(1),
  accepted_source_types: z.array(VisionFrameSourceTypeSchema).min(1),
  local_only: z.literal(true),
  cloud_provider: z.literal(false),
  accepts_metadata_only_frame_descriptors: z.literal(true),
  returns_metadata_only_result_summaries: z.literal(true),
  executes_provider_code: z.literal(false),
  metadata_only: z.literal(true),
  raw_payload_access: z.literal(false),
  advisory_only: z.literal(true),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export interface VisionLocalProviderContract extends z.infer<
  typeof VisionLocalProviderContractSchema
> {
  acceptsFrameDescriptor(descriptor: VisionFrameDescriptor): boolean;
}

export const VisionProviderResultSchema = z
  .strictObject({
    frame_id: VisionProviderIdSchema,
    vision_session_id: VisionProviderIdSchema,
    provider_id: VisionLocalProviderIdSchema,
    capability: VisionProviderCapabilitySchema,
    result_class: VisionProviderResultClassSchema,
    confidence: z.number().min(0).max(1).nullable(),
    confidence_band: VisionReplayConfidenceBandSchema,
    output_hash: VisionProviderHashSchema,
    detected_count: z.number().int().nonnegative().nullable(),
    summary_count: z.number().int().nonnegative().nullable(),
    redaction_status: VisionReplayRedactionStatusSchema,
    derived: z.literal(true),
    metadata_only: z.literal(true),
    raw_payload_stored: z.literal(false),
    raw_payload_included: z.literal(false),
    advisory_only: z.literal(true),
    perception_authority: z.literal(false),
    cloud_called: z.literal(false),
    action_executed: z.literal(false),
  })
  .superRefine((result, ctx) => {
    const expectedBand = confidenceBandForScore(result.confidence);
    if (result.confidence_band !== expectedBand) {
      ctx.addIssue({
        code: "custom",
        path: ["confidence_band"],
        message: "confidence_band must match deterministic confidence helper.",
      });
    }
    if (result.detected_count === null && result.summary_count === null) {
      ctx.addIssue({
        code: "custom",
        path: ["summary_count"],
        message: "one metadata count is required.",
      });
    }
  });

export const VisionProviderEligibilityDecisionSchema = z.strictObject({
  kind: z.literal("vision.provider_eligibility_decision"),
  requested_capability: VisionProviderCapabilitySchema,
  source_type: VisionFrameSourceTypeSchema.nullable(),
  status: VisionProviderEligibilityStatusSchema,
  reason: VisionProviderEligibilityReasonSchema,
  eligible_provider_ids: z.array(VisionLocalProviderIdSchema),
  executed_provider_code: z.literal(false),
  metadata_only: z.literal(true),
  raw_payload_accessed: z.literal(false),
  advisory_only: z.literal(true),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionProviderReplayStepSchema = z.strictObject({
  provider_id: VisionLocalProviderIdSchema,
  capability: VisionProviderCapabilitySchema,
  result_class: VisionProviderResultClassSchema,
  confidence: z.number().min(0).max(1).nullable(),
  confidence_band: VisionReplayConfidenceBandSchema,
  output_hash: VisionProviderHashSchema,
  detected_count: z.number().int().nonnegative().nullable(),
  summary_count: z.number().int().nonnegative().nullable(),
  redaction_status: VisionReplayRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  advisory_only: z.literal(true),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionProviderTelemetryEventSchema = z.strictObject({
  event_type: VisionProviderTelemetryEventTypeSchema,
  provider_id: VisionLocalProviderIdSchema.nullable(),
  capability: VisionProviderCapabilitySchema.nullable(),
  frame_id: VisionProviderIdSchema.nullable(),
  vision_session_id: VisionProviderIdSchema.nullable(),
  output_hash: VisionProviderHashSchema.nullable(),
  confidence_band: VisionReplayConfidenceBandSchema.nullable(),
  result_class: VisionProviderResultClassSchema.nullable(),
  eligible_provider_count: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  provider_secret_included: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionProviderFeatureFlags = z.infer<
  typeof VisionProviderFeatureFlagsSchema
>;
export type VisionProviderResult = z.infer<typeof VisionProviderResultSchema>;
export type VisionProviderEligibilityDecision = z.infer<
  typeof VisionProviderEligibilityDecisionSchema
>;
export type VisionProviderReplayStep = z.infer<
  typeof VisionProviderReplayStepSchema
>;
export type VisionProviderTelemetryEvent = z.infer<
  typeof VisionProviderTelemetryEventSchema
>;

const CONTRACT_DEFINITIONS = [
  {
    provider_id: "yolo_v8n",
    capabilities: ["object_detection"],
    accepted_source_types: ["camera_frame", "uploaded_image"],
  },
  {
    provider_id: "mediapipe",
    capabilities: ["pose_landmarks", "hand_landmarks", "face_landmarks"],
    accepted_source_types: ["camera_frame", "uploaded_image"],
  },
  {
    provider_id: "tesseract",
    capabilities: ["ocr"],
    accepted_source_types: ["uploaded_image", "ocr_region"],
  },
  {
    provider_id: "screen_ocr",
    capabilities: ["ocr", "screen_context"],
    accepted_source_types: ["screen_region", "ocr_region"],
  },
  {
    provider_id: "developer_fixture",
    capabilities: [...VISION_PROVIDER_CAPABILITIES],
    accepted_source_types: [
      "camera_frame",
      "screen_region",
      "uploaded_image",
      "ocr_region",
      "developer_fixture",
    ],
  },
] satisfies Array<{
  provider_id: VisionLocalProviderId;
  capabilities: VisionProviderCapability[];
  accepted_source_types: VisionFrameSourceType[];
}>;

export const VISION_LOCAL_PROVIDER_CONTRACTS: VisionLocalProviderContract[] =
  CONTRACT_DEFINITIONS.map((definition) => {
    const parsed = VisionLocalProviderContractSchema.parse({
      ...definition,
      local_only: true,
      cloud_provider: false,
      accepts_metadata_only_frame_descriptors: true,
      returns_metadata_only_result_summaries: true,
      executes_provider_code: false,
      metadata_only: true,
      raw_payload_access: false,
      advisory_only: true,
      perception_authority: false,
      action_executed: false,
    });
    return {
      ...parsed,
      acceptsFrameDescriptor(descriptor: VisionFrameDescriptor) {
        return parsed.accepted_source_types.includes(descriptor.source_type);
      },
    };
  });

export function confidenceBandForScore(
  confidence: number | null,
): z.infer<typeof VisionReplayConfidenceBandSchema> {
  if (confidence === null) return "unknown";
  if (confidence < 0.4) return "low";
  if (confidence < 0.75) return "medium";
  return "high";
}

export interface FindVisionProviderEligibilityInput {
  frame_descriptor: unknown;
  capability: VisionProviderCapability;
  contracts?: VisionLocalProviderContract[];
}

export function findEligibleVisionProviders(
  input: FindVisionProviderEligibilityInput,
): VisionProviderEligibilityDecision {
  const frame = VisionFrameDescriptorSchema.safeParse(input.frame_descriptor);
  if (!frame.success) {
    return VisionProviderEligibilityDecisionSchema.parse({
      kind: "vision.provider_eligibility_decision",
      requested_capability: input.capability,
      source_type: null,
      status: "invalid_frame",
      reason: "invalid_frame_descriptor",
      eligible_provider_ids: [],
      executed_provider_code: false,
      metadata_only: true,
      raw_payload_accessed: false,
      advisory_only: true,
      perception_authority: false,
      action_executed: false,
    });
  }

  const contracts = input.contracts ?? VISION_LOCAL_PROVIDER_CONTRACTS;
  const eligible = contracts.filter(
    (contract) =>
      contract.capabilities.includes(input.capability) &&
      contract.acceptsFrameDescriptor(frame.data),
  );

  const capabilitySupported = contracts.some((contract) =>
    contract.capabilities.includes(input.capability),
  );
  return VisionProviderEligibilityDecisionSchema.parse({
    kind: "vision.provider_eligibility_decision",
    requested_capability: input.capability,
    source_type: frame.data.source_type,
    status: eligible.length > 0 ? "eligible" : "ineligible",
    reason:
      eligible.length > 0
        ? "eligible_contract_found"
        : capabilitySupported
          ? "source_type_not_supported"
          : "capability_not_supported",
    eligible_provider_ids: eligible.map((contract) => contract.provider_id),
    executed_provider_code: false,
    metadata_only: true,
    raw_payload_accessed: false,
    advisory_only: true,
    perception_authority: false,
    action_executed: false,
  });
}

export function createVisionProviderResult(
  input: Omit<
    z.input<typeof VisionProviderResultSchema>,
    | "confidence_band"
    | "derived"
    | "metadata_only"
    | "raw_payload_stored"
    | "raw_payload_included"
    | "advisory_only"
    | "perception_authority"
    | "cloud_called"
    | "action_executed"
  >,
): VisionProviderResult {
  return VisionProviderResultSchema.parse({
    ...input,
    confidence_band: confidenceBandForScore(input.confidence),
    derived: true,
    metadata_only: true,
    raw_payload_stored: false,
    raw_payload_included: false,
    advisory_only: true,
    perception_authority: false,
    cloud_called: false,
    action_executed: false,
  });
}

export function createVisionProviderReplayStep(
  resultInput: VisionProviderResult,
): VisionProviderReplayStep {
  const result = VisionProviderResultSchema.parse(resultInput);
  return VisionProviderReplayStepSchema.parse({
    provider_id: result.provider_id,
    capability: result.capability,
    result_class: result.result_class,
    confidence: result.confidence,
    confidence_band: result.confidence_band,
    output_hash: result.output_hash,
    detected_count: result.detected_count,
    summary_count: result.summary_count,
    redaction_status: result.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
    advisory_only: true,
    perception_authority: false,
    action_executed: false,
  });
}

export function createVisionProviderTelemetryEvent(
  input:
    | { result: VisionProviderResult }
    | { eligibility: VisionProviderEligibilityDecision },
): VisionProviderTelemetryEvent {
  if ("result" in input) {
    const result = VisionProviderResultSchema.parse(input.result);
    return VisionProviderTelemetryEventSchema.parse({
      event_type: "provider_result_recorded",
      provider_id: result.provider_id,
      capability: result.capability,
      frame_id: result.frame_id,
      vision_session_id: result.vision_session_id,
      output_hash: result.output_hash,
      confidence_band: result.confidence_band,
      result_class: result.result_class,
      eligible_provider_count: null,
      metadata_only: true,
      raw_payload_included: false,
      provider_secret_included: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
    });
  }

  const eligibility = VisionProviderEligibilityDecisionSchema.parse(
    input.eligibility,
  );
  return VisionProviderTelemetryEventSchema.parse({
    event_type: "provider_eligibility_evaluated",
    provider_id: null,
    capability: eligibility.requested_capability,
    frame_id: null,
    vision_session_id: null,
    output_hash: null,
    confidence_band: null,
    result_class: null,
    eligible_provider_count: eligibility.eligible_provider_ids.length,
    metadata_only: true,
    raw_payload_included: false,
    provider_secret_included: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
  });
}
