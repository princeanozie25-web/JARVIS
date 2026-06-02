import { z } from "zod";

import {
  VERIFICATION_AGENT_RISK_FLAGS,
  VerificationAgentConfidenceSchema,
  VerificationAgentResultSchema,
  VerificationAgentRiskFlagSchema,
  type VerificationAgentConfidence,
  type VerificationAgentResult,
  type VerificationAgentRiskFlag,
} from "./contract";

export const VERIFICATION_AGENT_UI_SURFACE_VERSION =
  "phase21a.verification-agent.ui-surface.v1" as const;

export const VERIFICATION_AGENT_UI_STATES = [
  "unverified",
  "verified",
  "unavailable",
  "skipped",
  "failed",
] as const;

export const VERIFICATION_AGENT_CONFIDENCE_TONES = [
  "success",
  "caution",
  "danger",
  "neutral",
  "unavailable",
] as const;

const DisplayLabelSchema = z.string().trim().min(1).max(120);

export const VerificationAgentUiStateSchema = z.enum(
  VERIFICATION_AGENT_UI_STATES,
);

export const VerificationAgentConfidenceToneSchema = z.enum(
  VERIFICATION_AGENT_CONFIDENCE_TONES,
);

export const VerificationAgentRiskBadgeViewModelSchema = z.strictObject({
  flag: VerificationAgentRiskFlagSchema,
  label: DisplayLabelSchema,
  visible: z.literal(true),
});

export const VerificationConfidenceSurfaceViewModelSchema = z.strictObject({
  surface_version: z.literal(VERIFICATION_AGENT_UI_SURFACE_VERSION),
  state: VerificationAgentUiStateSchema,
  confidence: VerificationAgentConfidenceSchema,
  confidence_label: DisplayLabelSchema,
  confidence_tone: VerificationAgentConfidenceToneSchema,
  caveat: z.string().trim().min(1).max(800),
  caveat_visible: z.literal(true),
  risk_badges: z.array(VerificationAgentRiskBadgeViewModelSchema),
  advisory_label: z.literal("Advisory verification metadata"),
  truth_claim_label: z.literal("Not a source of truth"),
  metadata_only: z.literal(true),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
  raw_verifier_response_included: z.literal(false),
  execution_controls_visible: z.literal(false),
  approval_controls_visible: z.literal(false),
});

export type VerificationAgentUiState = z.infer<
  typeof VerificationAgentUiStateSchema
>;
export type VerificationAgentConfidenceTone = z.infer<
  typeof VerificationAgentConfidenceToneSchema
>;
export type VerificationAgentRiskBadgeViewModel = z.infer<
  typeof VerificationAgentRiskBadgeViewModelSchema
>;
export type VerificationConfidenceSurfaceViewModel = z.infer<
  typeof VerificationConfidenceSurfaceViewModelSchema
>;

export function createVerificationConfidenceSurfaceViewModel(input: {
  readonly state: VerificationAgentUiState;
  readonly confidence: VerificationAgentConfidence;
  readonly caveat: string;
  readonly risk_flags?: readonly VerificationAgentRiskFlag[];
}): VerificationConfidenceSurfaceViewModel {
  return VerificationConfidenceSurfaceViewModelSchema.parse({
    surface_version: VERIFICATION_AGENT_UI_SURFACE_VERSION,
    state: input.state,
    confidence: input.confidence,
    confidence_label: confidenceLabel(input.confidence),
    confidence_tone: confidenceTone(input.state, input.confidence),
    caveat: input.caveat,
    caveat_visible: true,
    risk_badges: riskBadges(input.risk_flags ?? []),
    advisory_label: "Advisory verification metadata",
    truth_claim_label: "Not a source of truth",
    metadata_only: true,
    raw_prompt_included: false,
    raw_answer_body_included: false,
    raw_verifier_response_included: false,
    execution_controls_visible: false,
    approval_controls_visible: false,
  });
}

export function createVerificationConfidenceSurfaceViewModelFromResult(
  result: unknown,
): VerificationConfidenceSurfaceViewModel {
  const parsed = VerificationAgentResultSchema.parse(result);
  return createVerificationConfidenceSurfaceViewModel({
    state: stateForResult(parsed),
    confidence: parsed.confidence,
    caveat: parsed.caveat,
    risk_flags: parsed.risk_flags,
  });
}

export function createUnavailableVerificationConfidenceSurfaceViewModel(
  caveat = "Verification metadata is unavailable.",
): VerificationConfidenceSurfaceViewModel {
  return createVerificationConfidenceSurfaceViewModel({
    state: "unavailable",
    confidence: "unknown",
    caveat,
    risk_flags: [],
  });
}

export function createSkippedVerificationConfidenceSurfaceViewModel(
  caveat = "Verification was skipped by policy.",
): VerificationConfidenceSurfaceViewModel {
  return createVerificationConfidenceSurfaceViewModel({
    state: "skipped",
    confidence: "unknown",
    caveat,
    risk_flags: [],
  });
}

function stateForResult(
  result: VerificationAgentResult,
): VerificationAgentUiState {
  if (
    result.verification_status === "verified" ||
    result.verification_status === "verified_with_caveat"
  ) {
    return "verified";
  }
  if (result.verification_status === "failed_closed") return "failed";
  return "unverified";
}

function confidenceLabel(confidence: VerificationAgentConfidence): string {
  return `${formatToken(confidence)} confidence`;
}

function confidenceTone(
  state: VerificationAgentUiState,
  confidence: VerificationAgentConfidence,
): VerificationAgentConfidenceTone {
  if (state === "unavailable" || state === "skipped") return "unavailable";
  if (state === "failed") return "danger";
  if (confidence === "high") return "success";
  if (confidence === "medium") return "caution";
  if (confidence === "low") return "danger";
  return "neutral";
}

function riskBadges(
  riskFlags: readonly VerificationAgentRiskFlag[],
): VerificationAgentRiskBadgeViewModel[] {
  const visible = new Set(riskFlags);
  return VERIFICATION_AGENT_RISK_FLAGS.filter((flag) => visible.has(flag)).map(
    (flag) => ({
      flag,
      label: formatToken(flag),
      visible: true as const,
    }),
  );
}

function formatToken(value: string): string {
  return value.replaceAll("_", " ");
}
