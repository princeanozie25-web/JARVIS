import { z } from "zod";
import {
  VisionReplayConfidenceBandSchema,
  VisionReplayRedactionStatusSchema,
} from "./failure-replay";
import {
  VisionObservationClassSchema,
  VisionObservationSchema,
  type VisionObservation,
} from "./observation";
import {
  VisionProviderCapabilitySchema,
  VisionProviderResultClassSchema,
  VisionProviderResultSchema,
  type VisionProviderCapability,
  type VisionProviderResult,
} from "./local-provider-contract";

export const VISION_FALLBACK_REASONS = [
  "low_confidence",
  "unsupported_capability",
  "provider_unavailable",
  "stale_frame",
  "policy_blocked",
  "user_consent_required",
  "budget_blocked",
  "not_needed",
] as const;

export const VISION_FALLBACK_DECISIONS = [
  "not_needed",
  "blocked_by_policy",
  "requires_user_consent",
  "denied",
  "eligible_metadata_only",
] as const;

export const VISION_FALLBACK_CONSENT_STATES = [
  "granted",
  "missing",
  "denied",
] as const;

export const VISION_FALLBACK_BUDGET_STATES = [
  "available",
  "blocked",
  "unknown",
] as const;

export const VISION_FALLBACK_TELEMETRY_EVENT_TYPES = [
  "vision_fallback_evaluated",
] as const;

export const VISION_FALLBACK_DISABLED_FEATURES = [
  "real_cloud_calls",
  "cloud_provider_execution",
  "network_clients",
  "raw_frame_transfer",
  "raw_image_transfer",
  "ocr_text_transfer",
  "screen_content_transfer",
  "file_transfer",
  "base64_transfer",
  "blob_transfer",
  "provider_execution",
  "approval_granting",
  "runtime_actions",
  "chat_router_wiring",
  "api_routes",
  "background_jobs",
] as const;

export type VisionFallbackReason = (typeof VISION_FALLBACK_REASONS)[number];
export type VisionFallbackDecision = (typeof VISION_FALLBACK_DECISIONS)[number];
export type VisionFallbackConsentState =
  (typeof VISION_FALLBACK_CONSENT_STATES)[number];
export type VisionFallbackBudgetState =
  (typeof VISION_FALLBACK_BUDGET_STATES)[number];
export type VisionFallbackTelemetryEventType =
  (typeof VISION_FALLBACK_TELEMETRY_EVENT_TYPES)[number];
export type VisionFallbackDisabledFeature =
  (typeof VISION_FALLBACK_DISABLED_FEATURES)[number];

const VisionFallbackHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionFallbackReasonSchema = z.enum(VISION_FALLBACK_REASONS);
export const VisionFallbackDecisionSchema = z.enum(VISION_FALLBACK_DECISIONS);
export const VisionFallbackConsentStateSchema = z.enum(
  VISION_FALLBACK_CONSENT_STATES,
);
export const VisionFallbackBudgetStateSchema = z.enum(
  VISION_FALLBACK_BUDGET_STATES,
);
export const VisionFallbackTelemetryEventTypeSchema = z.enum(
  VISION_FALLBACK_TELEMETRY_EVENT_TYPES,
);
export const VisionFallbackDisabledFeatureSchema = z.enum(
  VISION_FALLBACK_DISABLED_FEATURES,
);

export const VisionFallbackFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_FALLBACK_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionFallbackDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_FALLBACK_FEATURE_FLAGS = Object.fromEntries(
  VISION_FALLBACK_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionFallbackFeatureFlagsSchema>;

export const VisionFallbackPolicySchema = z.strictObject({
  local_first: z.literal(true),
  cloud_fallback_enabled: z.boolean(),
  allow_metadata_only_fallback: z.boolean(),
  require_user_consent: z.boolean(),
  min_confidence_for_no_fallback: z.number().min(0).max(1),
  metadata_only: z.literal(true),
  raw_payload_transfer_allowed: z.literal(false),
  provider_execution_allowed: z.literal(false),
  cloud_call_allowed: z.literal(false),
  approval_granting_allowed: z.literal(false),
  runtime_action_allowed: z.literal(false),
});

export const DEFAULT_VISION_FALLBACK_POLICY = {
  local_first: true,
  cloud_fallback_enabled: false,
  allow_metadata_only_fallback: false,
  require_user_consent: true,
  min_confidence_for_no_fallback: 0.75,
  metadata_only: true,
  raw_payload_transfer_allowed: false,
  provider_execution_allowed: false,
  cloud_call_allowed: false,
  approval_granting_allowed: false,
  runtime_action_allowed: false,
} as const satisfies z.input<typeof VisionFallbackPolicySchema>;

export const VisionFallbackDecisionRecordSchema = z.strictObject({
  kind: z.literal("vision.fallback_decision"),
  requested_capability: VisionProviderCapabilitySchema,
  reason: VisionFallbackReasonSchema,
  decision: VisionFallbackDecisionSchema,
  cloud_enabled: z.boolean(),
  consent_state: VisionFallbackConsentStateSchema,
  budget_state: VisionFallbackBudgetStateSchema,
  confidence: z.number().min(0).max(1).nullable(),
  confidence_band: VisionReplayConfidenceBandSchema,
  provider_result_class: VisionProviderResultClassSchema.nullable(),
  observation_class: VisionObservationClassSchema.nullable(),
  input_hash: VisionFallbackHashSchema.nullable(),
  output_hash: VisionFallbackHashSchema.nullable(),
  stale: z.boolean(),
  redaction_status: VisionReplayRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_transferred: z.literal(false),
  text_payload_transferred: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  approval_granted: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionFallbackReplayStepSchema = z.strictObject({
  reason: VisionFallbackReasonSchema,
  decision: VisionFallbackDecisionSchema,
  requested_capability: VisionProviderCapabilitySchema,
  provider_result_class: VisionProviderResultClassSchema.nullable(),
  observation_class: VisionObservationClassSchema.nullable(),
  input_hash: VisionFallbackHashSchema.nullable(),
  output_hash: VisionFallbackHashSchema.nullable(),
  confidence_band: VisionReplayConfidenceBandSchema,
  stale: z.boolean(),
  redaction_status: VisionReplayRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  approval_granted: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionFallbackTelemetryEventSchema = z.strictObject({
  event_type: VisionFallbackTelemetryEventTypeSchema,
  requested_capability: VisionProviderCapabilitySchema,
  reason: VisionFallbackReasonSchema,
  decision: VisionFallbackDecisionSchema,
  confidence_band: VisionReplayConfidenceBandSchema,
  provider_result_class: VisionProviderResultClassSchema.nullable(),
  observation_class: VisionObservationClassSchema.nullable(),
  stale_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_classes_only: z.literal(true),
  raw_payload_included: z.literal(false),
  text_payload_included: z.literal(false),
  hashes_included: z.literal(false),
  provider_executed: z.literal(false),
  cloud_called: z.literal(false),
  approval_granted: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionFallbackPolicy = z.infer<typeof VisionFallbackPolicySchema>;
export type VisionFallbackFeatureFlags = z.infer<
  typeof VisionFallbackFeatureFlagsSchema
>;
export type VisionFallbackDecisionRecord = z.infer<
  typeof VisionFallbackDecisionRecordSchema
>;
export type VisionFallbackReplayStep = z.infer<
  typeof VisionFallbackReplayStepSchema
>;
export type VisionFallbackTelemetryEvent = z.infer<
  typeof VisionFallbackTelemetryEventSchema
>;

export interface EvaluateVisionFallbackInput {
  requested_capability: VisionProviderCapability;
  policy?: Partial<VisionFallbackPolicy>;
  provider_result?: VisionProviderResult | null;
  observation?: VisionObservation | null;
  cloud_enabled: boolean;
  consent_state: VisionFallbackConsentState;
  budget_state: VisionFallbackBudgetState;
  redaction_status?: z.infer<typeof VisionReplayRedactionStatusSchema>;
  provider_available?: boolean;
  capability_supported?: boolean;
}

function parsePolicy(
  policy?: Partial<VisionFallbackPolicy>,
): VisionFallbackPolicy {
  return VisionFallbackPolicySchema.parse({
    ...DEFAULT_VISION_FALLBACK_POLICY,
    ...policy,
  });
}

function confidenceFromInputs(input: {
  providerResult: VisionProviderResult | null;
  observation: VisionObservation | null;
}): {
  confidence: number | null;
  confidence_band: z.infer<typeof VisionReplayConfidenceBandSchema>;
} {
  if (input.observation) {
    return {
      confidence: input.observation.confidence,
      confidence_band: input.observation.confidence_band,
    };
  }
  if (input.providerResult) {
    return {
      confidence: input.providerResult.confidence,
      confidence_band: input.providerResult.confidence_band,
    };
  }
  return { confidence: null, confidence_band: "unknown" };
}

function hasSufficientConfidence(
  confidence: number | null,
  policy: VisionFallbackPolicy,
): boolean {
  return (
    confidence !== null && confidence >= policy.min_confidence_for_no_fallback
  );
}

export function evaluateVisionFallback(
  input: EvaluateVisionFallbackInput,
): VisionFallbackDecisionRecord {
  const policy = parsePolicy(input.policy);
  const providerResult = input.provider_result
    ? VisionProviderResultSchema.parse(input.provider_result)
    : null;
  const observation = input.observation
    ? VisionObservationSchema.parse(input.observation)
    : null;
  const confidence = confidenceFromInputs({ providerResult, observation });
  const stale = observation?.stale ?? false;
  let reason: VisionFallbackReason = "not_needed";
  let decision: VisionFallbackDecision = "not_needed";

  if (hasSufficientConfidence(confidence.confidence, policy)) {
    reason = "not_needed";
    decision = "not_needed";
  } else if (stale) {
    reason = "stale_frame";
    decision = "denied";
  } else if (input.provider_available === false) {
    reason = "provider_unavailable";
    decision = policy.cloud_fallback_enabled
      ? "requires_user_consent"
      : "blocked_by_policy";
  } else if (input.capability_supported === false) {
    reason = "unsupported_capability";
    decision = policy.cloud_fallback_enabled
      ? "requires_user_consent"
      : "blocked_by_policy";
  } else if (!policy.cloud_fallback_enabled || !input.cloud_enabled) {
    reason = "policy_blocked";
    decision = "blocked_by_policy";
  } else if (input.budget_state !== "available") {
    reason = "budget_blocked";
    decision = "denied";
  } else if (input.consent_state !== "granted") {
    reason = "user_consent_required";
    decision = "requires_user_consent";
  } else if (!policy.allow_metadata_only_fallback) {
    reason = "policy_blocked";
    decision = "blocked_by_policy";
  } else {
    reason = "low_confidence";
    decision = "eligible_metadata_only";
  }

  return VisionFallbackDecisionRecordSchema.parse({
    kind: "vision.fallback_decision",
    requested_capability: input.requested_capability,
    reason,
    decision,
    cloud_enabled: input.cloud_enabled,
    consent_state: input.consent_state,
    budget_state: input.budget_state,
    confidence: confidence.confidence,
    confidence_band: confidence.confidence_band,
    provider_result_class: providerResult?.result_class ?? null,
    observation_class: observation?.observation_class ?? null,
    input_hash: observation?.input_hash ?? null,
    output_hash:
      observation?.output_hash ?? providerResult?.output_hash ?? null,
    stale,
    redaction_status: input.redaction_status ?? "metadata_only",
    metadata_only: true,
    raw_payload_transferred: false,
    text_payload_transferred: false,
    provider_executed: false,
    cloud_called: false,
    approval_granted: false,
    action_executed: false,
  });
}

export function createVisionFallbackReplayStep(
  decisionInput: VisionFallbackDecisionRecord,
): VisionFallbackReplayStep {
  const decision = VisionFallbackDecisionRecordSchema.parse(decisionInput);
  return VisionFallbackReplayStepSchema.parse({
    reason: decision.reason,
    decision: decision.decision,
    requested_capability: decision.requested_capability,
    provider_result_class: decision.provider_result_class,
    observation_class: decision.observation_class,
    input_hash: decision.input_hash,
    output_hash: decision.output_hash,
    confidence_band: decision.confidence_band,
    stale: decision.stale,
    redaction_status: decision.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    provider_executed: false,
    cloud_called: false,
    approval_granted: false,
    action_executed: false,
  });
}

export function createVisionFallbackTelemetryEvent(
  decisionInput: VisionFallbackDecisionRecord,
): VisionFallbackTelemetryEvent {
  const decision = VisionFallbackDecisionRecordSchema.parse(decisionInput);
  return VisionFallbackTelemetryEventSchema.parse({
    event_type: "vision_fallback_evaluated",
    requested_capability: decision.requested_capability,
    reason: decision.reason,
    decision: decision.decision,
    confidence_band: decision.confidence_band,
    provider_result_class: decision.provider_result_class,
    observation_class: decision.observation_class,
    stale_count: decision.stale ? 1 : 0,
    metadata_only: true,
    counts_and_classes_only: true,
    raw_payload_included: false,
    text_payload_included: false,
    hashes_included: false,
    provider_executed: false,
    cloud_called: false,
    approval_granted: false,
    action_executed: false,
  });
}
