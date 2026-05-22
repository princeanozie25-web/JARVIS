import { z } from "zod";

export const VISION_REPLAY_INPUT_TYPES = [
  "camera_frame",
  "screen_region",
  "uploaded_image",
  "ocr_region",
] as const;

export const VISION_REPLAY_LOCAL_PROVIDERS = [
  "yolo",
  "mediapipe",
  "tesseract",
  "screen_ocr",
] as const;

export const VISION_REPLAY_CONFIDENCE_BANDS = [
  "unknown",
  "low",
  "medium",
  "high",
] as const;

export const VISION_REPLAY_FALLBACK_REASONS = [
  "not_applicable",
  "low_confidence",
  "provider_error",
  "policy_check",
  "redaction_required",
] as const;

export const VISION_REPLAY_FALLBACK_DECISIONS = [
  "not_needed",
  "denied",
  "used",
  "blocked_by_policy",
] as const;

export const VISION_REPLAY_APPROVAL_DECISIONS = [
  "not_required",
  "pending",
  "approved",
  "denied",
  "expired",
  "cancelled",
] as const;

export const VISION_REPLAY_REDACTION_STATUSES = [
  "redacted",
  "hash_only",
  "metadata_only",
] as const;

export const VISION_REPLAY_RESULT_CLASSES = [
  "completed",
  "blocked",
  "failed",
  "needs_approval",
  "advisory_only",
] as const;

export const VISION_REPLAY_DISABLED_FEATURES = [
  "camera_capture",
  "screen_capture",
  "raw_frame_storage",
  "raw_image_storage",
  "ocr_text_storage",
  "cloud_vision_calls",
  "provider_execution",
  "runtime_actions",
  "background_watchers",
] as const;

export type VisionReplayInputType = (typeof VISION_REPLAY_INPUT_TYPES)[number];
export type VisionReplayLocalProvider =
  (typeof VISION_REPLAY_LOCAL_PROVIDERS)[number];
export type VisionReplayConfidenceBand =
  (typeof VISION_REPLAY_CONFIDENCE_BANDS)[number];
export type VisionReplayFallbackReason =
  (typeof VISION_REPLAY_FALLBACK_REASONS)[number];
export type VisionReplayFallbackDecision =
  (typeof VISION_REPLAY_FALLBACK_DECISIONS)[number];
export type VisionReplayApprovalDecision =
  (typeof VISION_REPLAY_APPROVAL_DECISIONS)[number];
export type VisionReplayRedactionStatus =
  (typeof VISION_REPLAY_REDACTION_STATUSES)[number];
export type VisionReplayResultClass =
  (typeof VISION_REPLAY_RESULT_CLASSES)[number];
export type VisionReplayDisabledFeature =
  (typeof VISION_REPLAY_DISABLED_FEATURES)[number];

const VisionReplayIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionReplayHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const VisionReplayClassSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionReplayInputTypeSchema = z.enum(VISION_REPLAY_INPUT_TYPES);
export const VisionReplayLocalProviderSchema = z.enum(
  VISION_REPLAY_LOCAL_PROVIDERS,
);
export const VisionReplayConfidenceBandSchema = z.enum(
  VISION_REPLAY_CONFIDENCE_BANDS,
);
export const VisionReplayFallbackReasonSchema = z.enum(
  VISION_REPLAY_FALLBACK_REASONS,
);
export const VisionReplayFallbackDecisionSchema = z.enum(
  VISION_REPLAY_FALLBACK_DECISIONS,
);
export const VisionReplayApprovalDecisionSchema = z.enum(
  VISION_REPLAY_APPROVAL_DECISIONS,
);
export const VisionReplayRedactionStatusSchema = z.enum(
  VISION_REPLAY_REDACTION_STATUSES,
);
export const VisionReplayResultClassSchema = z.enum(
  VISION_REPLAY_RESULT_CLASSES,
);
export const VisionReplayDisabledFeatureSchema = z.enum(
  VISION_REPLAY_DISABLED_FEATURES,
);

export const VisionFailureReplayFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_REPLAY_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionReplayDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_FAILURE_REPLAY_FEATURE_FLAGS = Object.fromEntries(
  VISION_REPLAY_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionFailureReplayFeatureFlagsSchema>;

export const VisionFailureReplayRecordSchema = z
  .strictObject({
    replay_id: VisionReplayIdSchema,
    vision_session_id: VisionReplayIdSchema,
    input_type: VisionReplayInputTypeSchema,
    input_hash: VisionReplayHashSchema,
    local_provider: VisionReplayLocalProviderSchema,
    local_result_class: VisionReplayClassSchema,
    confidence_band: VisionReplayConfidenceBandSchema,
    confidence_value: z.number().min(0).max(1).nullable(),
    fallback_considered: z.boolean(),
    fallback_reason: VisionReplayFallbackReasonSchema,
    fallback_decision: VisionReplayFallbackDecisionSchema,
    cloud_provider_hash_or_alias: VisionReplayClassSchema.nullable(),
    output_class: VisionReplayClassSchema,
    approval_required: z.boolean(),
    approval_decision: VisionReplayApprovalDecisionSchema,
    result_class: VisionReplayResultClassSchema,
    started_at: z.number().int().nonnegative(),
    completed_at: z.number().int().nonnegative(),
    duration_ms: z.number().int().nonnegative(),
    redaction_status: VisionReplayRedactionStatusSchema,
    metadata_only: z.literal(true),
    advisory_only: z.literal(true),
    perception_authority: z.literal(false),
    raw_payload_stored: z.literal(false),
    action_executed: z.literal(false),
    cloud_called: z.literal(false),
  })
  .superRefine((record, ctx) => {
    if (record.completed_at < record.started_at) {
      ctx.addIssue({
        code: "custom",
        path: ["completed_at"],
        message: "completed_at must be greater than or equal to started_at.",
      });
    }
    if (record.duration_ms !== record.completed_at - record.started_at) {
      ctx.addIssue({
        code: "custom",
        path: ["duration_ms"],
        message: "duration_ms must equal completed_at - started_at.",
      });
    }
    if (
      record.fallback_decision !== "used" &&
      record.cloud_provider_hash_or_alias !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["cloud_provider_hash_or_alias"],
        message:
          "cloud_provider_hash_or_alias is only allowed when fallback was used.",
      });
    }
    if (
      record.fallback_considered === false &&
      record.fallback_decision !== "not_needed"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fallback_decision"],
        message: "unconsidered fallback must be not_needed.",
      });
    }
  });

export const VisionFailureReplayGraphNodeSchema = z.strictObject({
  id: VisionReplayIdSchema,
  kind: z.enum([
    "input",
    "provider",
    "confidence",
    "fallback_gate",
    "output",
    "action_gate",
    "result",
  ]),
  label: z.string().trim().min(1).max(160),
  metadata: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
  redacted: z.literal(true),
});

export const VisionFailureReplayGraphEdgeSchema = z.strictObject({
  from: VisionReplayIdSchema,
  to: VisionReplayIdSchema,
  label: z.string().trim().min(1).max(80),
});

export const VisionFailureReplayGraphSchema = z.strictObject({
  replay_id: VisionReplayIdSchema,
  vision_session_id: VisionReplayIdSchema,
  nodes: z.array(VisionFailureReplayGraphNodeSchema),
  edges: z.array(VisionFailureReplayGraphEdgeSchema),
  metadata_only: z.literal(true),
  redacted: z.literal(true),
  raw_payload_included: z.literal(false),
});

export type VisionFailureReplayFeatureFlags = z.infer<
  typeof VisionFailureReplayFeatureFlagsSchema
>;
export type VisionFailureReplayRecord = z.infer<
  typeof VisionFailureReplayRecordSchema
>;
export type VisionFailureReplayGraphNode = z.infer<
  typeof VisionFailureReplayGraphNodeSchema
>;
export type VisionFailureReplayGraphEdge = z.infer<
  typeof VisionFailureReplayGraphEdgeSchema
>;
export type VisionFailureReplayGraph = z.infer<
  typeof VisionFailureReplayGraphSchema
>;

export function createVisionFailureReplayRecord(
  input: z.input<typeof VisionFailureReplayRecordSchema>,
): VisionFailureReplayRecord {
  return VisionFailureReplayRecordSchema.parse(input);
}

function graphNode(
  input: Omit<VisionFailureReplayGraphNode, "redacted">,
): VisionFailureReplayGraphNode {
  return VisionFailureReplayGraphNodeSchema.parse({
    ...input,
    redacted: true,
  });
}

export function buildVisionFailureReplayGraph(
  recordInput: VisionFailureReplayRecord,
): VisionFailureReplayGraph {
  const record = VisionFailureReplayRecordSchema.parse(recordInput);
  const replayPrefix = record.replay_id;
  const nodes: VisionFailureReplayGraphNode[] = [
    graphNode({
      id: `${replayPrefix}:input`,
      kind: "input",
      label: "input_hash/input_type",
      metadata: {
        input_hash: record.input_hash,
        input_type: record.input_type,
      },
    }),
    graphNode({
      id: `${replayPrefix}:provider`,
      kind: "provider",
      label: "provider",
      metadata: {
        local_provider: record.local_provider,
        local_result_class: record.local_result_class,
      },
    }),
    graphNode({
      id: `${replayPrefix}:confidence`,
      kind: "confidence",
      label: "confidence",
      metadata: {
        confidence_band: record.confidence_band,
        confidence_value: record.confidence_value,
      },
    }),
    graphNode({
      id: `${replayPrefix}:fallback`,
      kind: "fallback_gate",
      label: "fallback_gate",
      metadata: {
        fallback_considered: record.fallback_considered,
        fallback_reason: record.fallback_reason,
        fallback_decision: record.fallback_decision,
        cloud_provider_hash_or_alias: record.cloud_provider_hash_or_alias,
      },
    }),
    graphNode({
      id: `${replayPrefix}:output`,
      kind: "output",
      label: "output_class",
      metadata: {
        output_class: record.output_class,
      },
    }),
    graphNode({
      id: `${replayPrefix}:action`,
      kind: "action_gate",
      label: "action_gate",
      metadata: {
        approval_required: record.approval_required,
        approval_decision: record.approval_decision,
        action_executed: false,
      },
    }),
    graphNode({
      id: `${replayPrefix}:result`,
      kind: "result",
      label: "result_class",
      metadata: {
        result_class: record.result_class,
        redaction_status: record.redaction_status,
      },
    }),
  ];

  return VisionFailureReplayGraphSchema.parse({
    replay_id: record.replay_id,
    vision_session_id: record.vision_session_id,
    nodes,
    edges: [
      {
        from: `${replayPrefix}:input`,
        to: `${replayPrefix}:provider`,
        label: "to_provider",
      },
      {
        from: `${replayPrefix}:provider`,
        to: `${replayPrefix}:confidence`,
        label: "scored",
      },
      {
        from: `${replayPrefix}:confidence`,
        to: `${replayPrefix}:fallback`,
        label: "gated",
      },
      {
        from: `${replayPrefix}:fallback`,
        to: `${replayPrefix}:output`,
        label: "selected",
      },
      {
        from: `${replayPrefix}:output`,
        to: `${replayPrefix}:action`,
        label: "action_gate",
      },
      {
        from: `${replayPrefix}:action`,
        to: `${replayPrefix}:result`,
        label: "result",
      },
    ],
    metadata_only: true,
    redacted: true,
    raw_payload_included: false,
  });
}
