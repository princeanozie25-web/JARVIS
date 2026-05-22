import { z } from "zod";
import {
  VISION_OBSERVATION_CLASSES,
  VisionObservationClassSchema,
  VisionObservationSchema,
  type VisionObservation,
} from "./observation";
import { VisionLocalProviderIdSchema } from "./local-provider-contract";
import {
  VisionReplayConfidenceBandSchema,
  VisionReplayRedactionStatusSchema,
} from "./failure-replay";

export const VISION_CONTEXT_TELEMETRY_EVENT_TYPES = [
  "vision_context_assembled",
] as const;

export const VISION_CONTEXT_DISABLED_FEATURES = [
  "chat_router_wiring",
  "runtime_tool_wiring",
  "voice_wiring",
  "api_routes",
  "raw_frame_storage",
  "raw_image_storage",
  "ocr_text_storage",
  "screen_content_storage",
  "detected_label_storage",
  "identity_storage",
  "biometric_storage",
  "coordinate_storage",
  "provider_execution",
  "cloud_calls",
  "runtime_actions",
  "approval_granting",
  "background_watchers",
] as const;

export const DEFAULT_VISION_CONTEXT_CAPS = {
  max_observations: 8,
  max_classes: VISION_OBSERVATION_CLASSES.length,
  max_provenance_entries: 8,
  max_context_chars: 1_200,
} as const;

export type VisionContextTelemetryEventType =
  (typeof VISION_CONTEXT_TELEMETRY_EVENT_TYPES)[number];
export type VisionContextDisabledFeature =
  (typeof VISION_CONTEXT_DISABLED_FEATURES)[number];

const VisionContextIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionContextHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionContextTelemetryEventTypeSchema = z.enum(
  VISION_CONTEXT_TELEMETRY_EVENT_TYPES,
);
export const VisionContextDisabledFeatureSchema = z.enum(
  VISION_CONTEXT_DISABLED_FEATURES,
);

export const VisionContextFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_CONTEXT_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionContextDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_CONTEXT_FEATURE_FLAGS = Object.fromEntries(
  VISION_CONTEXT_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionContextFeatureFlagsSchema>;

export const VisionContextCapsSchema = z.strictObject({
  max_observations: z.number().int().positive(),
  max_classes: z.number().int().positive(),
  max_provenance_entries: z.number().int().positive(),
  max_context_chars: z.number().int().positive(),
});

export const VisionContextClassSummarySchema = z.strictObject({
  observation_class: VisionObservationClassSchema,
  count: z.number().int().nonnegative(),
  confidence_bands: z.array(VisionReplayConfidenceBandSchema),
});

export const VisionContextProvenanceSchema = z.strictObject({
  vision_session_id: VisionContextIdSchema,
  frame_id: VisionContextIdSchema,
  provider_id: VisionLocalProviderIdSchema,
  input_hash: VisionContextHashSchema,
  output_hash: VisionContextHashSchema,
  observation_class: VisionObservationClassSchema,
  confidence_band: VisionReplayConfidenceBandSchema,
  stale: z.boolean(),
});

export const VisionContextSnapshotSchema = z.strictObject({
  kind: z.literal("vision.context_snapshot"),
  assembled_at: z.number().int().nonnegative(),
  observation_count_input: z.number().int().nonnegative(),
  observation_count_included: z.number().int().nonnegative(),
  stale_observation_count: z.number().int().nonnegative(),
  stale_policy: z.literal("excluded"),
  caps: VisionContextCapsSchema,
  class_summaries: z.array(VisionContextClassSummarySchema),
  provenance: z.array(VisionContextProvenanceSchema),
  context_block: z.string(),
  truncated: z.boolean(),
  redaction_status: VisionReplayRedactionStatusSchema,
  derived: z.literal(true),
  advisory_only: z.literal(true),
  canonical_truth: z.literal(false),
  perception_authority: z.literal(false),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  labels_included: z.literal(false),
  identity_included: z.literal(false),
  biometrics_included: z.literal(false),
  coordinates_included: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  background_job_started: z.literal(false),
});

export const VisionContextTelemetryEventSchema = z.strictObject({
  event_type: VisionContextTelemetryEventTypeSchema,
  observation_count_input: z.number().int().nonnegative(),
  observation_count_included: z.number().int().nonnegative(),
  stale_observation_count: z.number().int().nonnegative(),
  class_summary_count: z.number().int().nonnegative(),
  provenance_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  labels_included: z.literal(false),
  identity_included: z.literal(false),
  biometrics_included: z.literal(false),
  coordinates_included: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionContextReplayStepSchema = z.strictObject({
  observation_count_included: z.number().int().nonnegative(),
  stale_observation_count: z.number().int().nonnegative(),
  class_summaries: z.array(VisionContextClassSummarySchema),
  provenance_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  redaction_status: VisionReplayRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  labels_included: z.literal(false),
  identity_included: z.literal(false),
  biometrics_included: z.literal(false),
  coordinates_included: z.literal(false),
  advisory_only: z.literal(true),
  canonical_truth: z.literal(false),
  perception_authority: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionContextFeatureFlags = z.infer<
  typeof VisionContextFeatureFlagsSchema
>;
export type VisionContextCaps = z.infer<typeof VisionContextCapsSchema>;
export type VisionContextClassSummary = z.infer<
  typeof VisionContextClassSummarySchema
>;
export type VisionContextProvenance = z.infer<
  typeof VisionContextProvenanceSchema
>;
export type VisionContextSnapshot = z.infer<typeof VisionContextSnapshotSchema>;
export type VisionContextTelemetryEvent = z.infer<
  typeof VisionContextTelemetryEventSchema
>;
export type VisionContextReplayStep = z.infer<
  typeof VisionContextReplayStepSchema
>;

export interface AssembleVisionContextInput {
  observations: VisionObservation[];
  assembled_at: number;
  caps?: Partial<VisionContextCaps>;
}

function mergeCaps(caps?: Partial<VisionContextCaps>): VisionContextCaps {
  return VisionContextCapsSchema.parse({
    ...DEFAULT_VISION_CONTEXT_CAPS,
    ...caps,
  });
}

function uniqueConfidenceBands(
  observations: VisionObservation[],
): Array<z.infer<typeof VisionReplayConfidenceBandSchema>> {
  return [
    ...new Set(observations.map((observation) => observation.confidence_band)),
  ];
}

function summarizeClasses(
  observations: VisionObservation[],
  maxClasses: number,
): VisionContextClassSummary[] {
  return VISION_OBSERVATION_CLASSES.map((observationClass) => {
    const matching = observations.filter(
      (observation) => observation.observation_class === observationClass,
    );
    return {
      observation_class: observationClass,
      count: matching.length,
      confidence_bands: uniqueConfidenceBands(matching),
    };
  })
    .filter((summary) => summary.count > 0)
    .slice(0, maxClasses)
    .map((summary) => VisionContextClassSummarySchema.parse(summary));
}

function buildProvenance(
  observations: VisionObservation[],
  maxEntries: number,
): VisionContextProvenance[] {
  return observations.slice(0, maxEntries).map((observation) =>
    VisionContextProvenanceSchema.parse({
      vision_session_id: observation.vision_session_id,
      frame_id: observation.frame_id,
      provider_id: observation.provider_id,
      input_hash: observation.input_hash,
      output_hash: observation.output_hash,
      observation_class: observation.observation_class,
      confidence_band: observation.confidence_band,
      stale: observation.stale,
    }),
  );
}

function buildContextBlock(input: {
  class_summaries: VisionContextClassSummary[];
  provenance: VisionContextProvenance[];
  stale_observation_count: number;
  max_context_chars: number;
}): { context_block: string; truncated: boolean } {
  const lines = [
    "vision_context: derived advisory metadata only; canonical_truth=false",
    `stale_observations_excluded: ${input.stale_observation_count}`,
    `classes: ${input.class_summaries
      .map(
        (summary) =>
          `${summary.observation_class}=${summary.count}` +
          `[${summary.confidence_bands.join(",") || "unknown"}]`,
      )
      .join("; ")}`,
    `provenance: ${input.provenance
      .map(
        (item) =>
          `${item.vision_session_id}/${item.frame_id}/${item.provider_id}` +
          `/${item.observation_class}/${item.confidence_band}`,
      )
      .join("; ")}`,
  ];
  const block = lines.join("\n");
  if (block.length <= input.max_context_chars) {
    return { context_block: block, truncated: false };
  }
  return {
    context_block: block.slice(0, Math.max(0, input.max_context_chars)),
    truncated: true,
  };
}

export function assembleVisionContext(
  input: AssembleVisionContextInput,
): VisionContextSnapshot {
  const caps = mergeCaps(input.caps);
  const observations = input.observations.map((observation) =>
    VisionObservationSchema.parse(observation),
  );
  const nonStaleObservations = observations.filter(
    (observation) => !observation.stale,
  );
  const staleObservationCount =
    observations.length - nonStaleObservations.length;
  const freshObservations = nonStaleObservations.slice(
    0,
    caps.max_observations,
  );
  const class_summaries = summarizeClasses(freshObservations, caps.max_classes);
  const provenance = buildProvenance(
    freshObservations,
    caps.max_provenance_entries,
  );
  const block = buildContextBlock({
    class_summaries,
    provenance,
    stale_observation_count: staleObservationCount,
    max_context_chars: caps.max_context_chars,
  });
  const truncated =
    block.truncated ||
    nonStaleObservations.length > freshObservations.length ||
    class_summaries.length <
      new Set(freshObservations.map((item) => item.observation_class)).size ||
    provenance.length < freshObservations.length;

  return VisionContextSnapshotSchema.parse({
    kind: "vision.context_snapshot",
    assembled_at: input.assembled_at,
    observation_count_input: observations.length,
    observation_count_included: freshObservations.length,
    stale_observation_count: staleObservationCount,
    stale_policy: "excluded",
    caps,
    class_summaries,
    provenance,
    context_block: block.context_block,
    truncated,
    redaction_status: "metadata_only",
    derived: true,
    advisory_only: true,
    canonical_truth: false,
    perception_authority: false,
    metadata_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    labels_included: false,
    identity_included: false,
    biometrics_included: false,
    coordinates_included: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
    approval_granted: false,
    background_job_started: false,
  });
}

export function createVisionContextTelemetryEvent(
  snapshotInput: VisionContextSnapshot,
): VisionContextTelemetryEvent {
  const snapshot = VisionContextSnapshotSchema.parse(snapshotInput);
  return VisionContextTelemetryEventSchema.parse({
    event_type: "vision_context_assembled",
    observation_count_input: snapshot.observation_count_input,
    observation_count_included: snapshot.observation_count_included,
    stale_observation_count: snapshot.stale_observation_count,
    class_summary_count: snapshot.class_summaries.length,
    provenance_count: snapshot.provenance.length,
    truncated: snapshot.truncated,
    metadata_only: true,
    counts_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    labels_included: false,
    identity_included: false,
    biometrics_included: false,
    coordinates_included: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
  });
}

export function createVisionContextReplayStep(
  snapshotInput: VisionContextSnapshot,
): VisionContextReplayStep {
  const snapshot = VisionContextSnapshotSchema.parse(snapshotInput);
  return VisionContextReplayStepSchema.parse({
    observation_count_included: snapshot.observation_count_included,
    stale_observation_count: snapshot.stale_observation_count,
    class_summaries: snapshot.class_summaries,
    provenance_count: snapshot.provenance.length,
    truncated: snapshot.truncated,
    redaction_status: snapshot.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    labels_included: false,
    identity_included: false,
    biometrics_included: false,
    coordinates_included: false,
    advisory_only: true,
    canonical_truth: false,
    perception_authority: false,
    action_executed: false,
  });
}
