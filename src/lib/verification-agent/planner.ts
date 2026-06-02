import { z } from "zod";

import {
  VERIFICATION_AGENT_CONTRACT_VERSION,
  VERIFICATION_AGENT_RISK_FLAGS,
  VerificationAgentConfidenceSchema,
  VerificationAgentRequestSchema,
  VerificationAgentRiskFlagSchema,
  VerificationAgentTaskClassSchema,
  type VerificationAgentConfidence,
  type VerificationAgentRequest,
  type VerificationAgentRiskFlag,
  type VerificationAgentTaskClass,
} from "./contract";

export const VERIFICATION_AGENT_PLANNER_VERSION =
  "phase21a.verification-agent.planner.v1" as const;

export const VERIFICATION_AGENT_SCOPES = [
  "none",
  "light",
  "normal",
  "deep",
] as const;

export const VERIFICATION_AGENT_INTENSITIES = [
  "low",
  "medium",
  "high",
] as const;

export const VERIFICATION_AGENT_EVIDENCE_REQUIREMENTS = [
  "source_presence",
  "source_consistency",
  "date_freshness",
  "answer_consistency",
  "model_crosscheck",
] as const;

export const VERIFICATION_AGENT_COST_BANDS = [
  "none",
  "low",
  "medium",
  "high",
] as const;

const RISK_WEIGHT: Record<VerificationAgentRiskFlag, number> = {
  unsupported_claim: 2,
  outdated_information: 2,
  insufficient_sources: 2,
  overconfident_answer: 1,
  safety_sensitive: 3,
  conflicting_context: 3,
  model_disagreement: 3,
};

const HIGH_STAKES_TASKS = new Set<VerificationAgentTaskClass>([
  "medical",
  "legal",
  "financial",
]);

const TIME_SENSITIVE_TASKS = new Set<VerificationAgentTaskClass>([
  "current_events",
]);

export const VerificationAgentScopeSchema = z.enum(VERIFICATION_AGENT_SCOPES);
export const VerificationAgentIntensitySchema = z.enum(
  VERIFICATION_AGENT_INTENSITIES,
);
export const VerificationAgentEvidenceRequirementSchema = z.enum(
  VERIFICATION_AGENT_EVIDENCE_REQUIREMENTS,
);
export const VerificationAgentCostBandSchema = z.enum(
  VERIFICATION_AGENT_COST_BANDS,
);

export const VerificationAgentPlannerConfidenceHintsSchema = z.strictObject({
  primary_confidence: VerificationAgentConfidenceSchema.default("unknown"),
  user_requested_verification: z.boolean().default(false),
  answer_contains_caveat: z.boolean().default(false),
});

export const VerificationAgentPlannerInputSchema = z.strictObject({
  kind: z.literal("verification_agent.planner_input"),
  planner_version: z.literal(VERIFICATION_AGENT_PLANNER_VERSION),
  request: VerificationAgentRequestSchema,
  confidence_hints: VerificationAgentPlannerConfidenceHintsSchema.default({
    primary_confidence: "unknown",
    user_requested_verification: false,
    answer_contains_caveat: false,
  }),
  risk_hints: z.array(VerificationAgentRiskFlagSchema).default([]),
  metadata_only: z.literal(true),
  raw_answer_body_included: z.literal(false),
});

export const VerificationAgentPlannerTelemetrySchema = z.strictObject({
  telemetry_version: z.literal(VERIFICATION_AGENT_PLANNER_VERSION),
  request_id: z.string().trim().min(1),
  query_id: z.string().trim().min(1),
  answer_id: z.string().trim().min(1),
  task_class: VerificationAgentTaskClassSchema,
  source_count: z.number().int().nonnegative(),
  verification_required: z.boolean(),
  verification_scope: VerificationAgentScopeSchema,
  verification_intensity: VerificationAgentIntensitySchema,
  risk_flag_count: z.number().int().nonnegative(),
  evidence_requirement_count: z.number().int().nonnegative(),
  estimated_cost_band: VerificationAgentCostBandSchema,
  metadata_only: z.literal(true),
  redaction_status: z.literal("metadata_only"),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
  raw_verifier_response_included: z.literal(false),
  raw_source_bodies_included: z.literal(false),
});

export const VerificationAgentPlanSchema = z.strictObject({
  kind: z.literal("verification_agent.plan"),
  contract_version: z.literal(VERIFICATION_AGENT_CONTRACT_VERSION),
  planner_version: z.literal(VERIFICATION_AGENT_PLANNER_VERSION),
  request_id: z.string().trim().min(1),
  verification_required: z.boolean(),
  verification_scope: VerificationAgentScopeSchema,
  verification_intensity: VerificationAgentIntensitySchema,
  expected_confidence: VerificationAgentConfidenceSchema,
  evidence_requirements: z.array(VerificationAgentEvidenceRequirementSchema),
  risk_flags: z.array(VerificationAgentRiskFlagSchema),
  estimated_cost_band: VerificationAgentCostBandSchema,
  telemetry_metadata: VerificationAgentPlannerTelemetrySchema,
  advisory_only: z.literal(true),
  answer_rewrite_allowed: z.literal(false),
  creates_truth_claim: z.literal(false),
  model_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_answer_body_included: z.literal(false),
});

export type VerificationAgentScope = z.infer<
  typeof VerificationAgentScopeSchema
>;
export type VerificationAgentIntensity = z.infer<
  typeof VerificationAgentIntensitySchema
>;
export type VerificationAgentEvidenceRequirement = z.infer<
  typeof VerificationAgentEvidenceRequirementSchema
>;
export type VerificationAgentCostBand = z.infer<
  typeof VerificationAgentCostBandSchema
>;
export type VerificationAgentPlannerConfidenceHints = z.infer<
  typeof VerificationAgentPlannerConfidenceHintsSchema
>;
export type VerificationAgentPlannerInput = z.infer<
  typeof VerificationAgentPlannerInputSchema
>;
export type VerificationAgentPlannerTelemetry = z.infer<
  typeof VerificationAgentPlannerTelemetrySchema
>;
export type VerificationAgentPlan = z.infer<typeof VerificationAgentPlanSchema>;

export function planVerificationRequest(input: unknown): VerificationAgentPlan {
  const parsed = VerificationAgentPlannerInputSchema.parse(input);
  const request = parsed.request;
  const riskFlags = deriveRiskFlags(request, parsed);
  const verificationRequired = shouldVerify(request, parsed, riskFlags);
  const scope = scopeFor(request, riskFlags, verificationRequired);
  const intensity = intensityFor(scope);
  const evidenceRequirements = evidenceRequirementsFor(
    request,
    riskFlags,
    scope,
  );
  const estimatedCostBand = costBandFor(scope);
  const expectedConfidence = expectedConfidenceFor(scope, riskFlags);

  return VerificationAgentPlanSchema.parse({
    kind: "verification_agent.plan",
    contract_version: VERIFICATION_AGENT_CONTRACT_VERSION,
    planner_version: VERIFICATION_AGENT_PLANNER_VERSION,
    request_id: request.request_id,
    verification_required: verificationRequired,
    verification_scope: scope,
    verification_intensity: intensity,
    expected_confidence: expectedConfidence,
    evidence_requirements: evidenceRequirements,
    risk_flags: riskFlags,
    estimated_cost_band: estimatedCostBand,
    telemetry_metadata: telemetryFor({
      request,
      verificationRequired,
      scope,
      intensity,
      riskFlags,
      evidenceRequirements,
      estimatedCostBand,
    }),
    advisory_only: true,
    answer_rewrite_allowed: false,
    creates_truth_claim: false,
    model_call_attempted: false,
    provider_call_attempted: false,
    write_attempted: false,
    metadata_only: true,
    raw_answer_body_included: false,
  });
}

function shouldVerify(
  request: VerificationAgentRequest,
  input: VerificationAgentPlannerInput,
  riskFlags: readonly VerificationAgentRiskFlag[],
): boolean {
  if (input.confidence_hints.user_requested_verification) return true;
  if (riskFlags.length > 0) return true;
  if (HIGH_STAKES_TASKS.has(request.original_user_query.task_class))
    return true;
  if (TIME_SENSITIVE_TASKS.has(request.original_user_query.task_class)) {
    return true;
  }
  if (input.confidence_hints.primary_confidence !== "high") return true;
  return false;
}

function deriveRiskFlags(
  request: VerificationAgentRequest,
  input: VerificationAgentPlannerInput,
): VerificationAgentRiskFlag[] {
  const riskFlags = new Set<VerificationAgentRiskFlag>(input.risk_hints);
  const taskClass = request.original_user_query.task_class;

  if (request.source_metadata.length === 0) {
    riskFlags.add("insufficient_sources");
  }
  if (TIME_SENSITIVE_TASKS.has(taskClass)) {
    riskFlags.add("outdated_information");
  }
  if (HIGH_STAKES_TASKS.has(taskClass)) {
    riskFlags.add("safety_sensitive");
  }
  if (
    input.confidence_hints.primary_confidence === "low" ||
    input.confidence_hints.primary_confidence === "unknown"
  ) {
    riskFlags.add("unsupported_claim");
  }
  if (
    input.confidence_hints.primary_confidence === "high" &&
    !input.confidence_hints.answer_contains_caveat &&
    (HIGH_STAKES_TASKS.has(taskClass) ||
      TIME_SENSITIVE_TASKS.has(taskClass) ||
      riskFlags.has("unsupported_claim"))
  ) {
    riskFlags.add("overconfident_answer");
  }

  return [...riskFlags].sort(compareRiskFlags);
}

function scopeFor(
  request: VerificationAgentRequest,
  riskFlags: readonly VerificationAgentRiskFlag[],
  verificationRequired: boolean,
): VerificationAgentScope {
  if (!verificationRequired) return "none";

  const riskScore = riskFlags.reduce(
    (score, riskFlag) => score + RISK_WEIGHT[riskFlag],
    0,
  );
  if (
    riskScore >= 4 ||
    riskFlags.includes("safety_sensitive") ||
    riskFlags.includes("conflicting_context") ||
    riskFlags.includes("model_disagreement")
  ) {
    return "deep";
  }
  if (
    riskScore >= 2 ||
    HIGH_STAKES_TASKS.has(request.original_user_query.task_class) ||
    TIME_SENSITIVE_TASKS.has(request.original_user_query.task_class)
  ) {
    return "normal";
  }
  return "light";
}

function intensityFor(
  scope: VerificationAgentScope,
): VerificationAgentIntensity {
  if (scope === "deep") return "high";
  if (scope === "normal") return "medium";
  return "low";
}

function evidenceRequirementsFor(
  request: VerificationAgentRequest,
  riskFlags: readonly VerificationAgentRiskFlag[],
  scope: VerificationAgentScope,
): VerificationAgentEvidenceRequirement[] {
  if (scope === "none") return [];

  const requirements = new Set<VerificationAgentEvidenceRequirement>([
    "answer_consistency",
  ]);

  requirements.add("source_presence");
  if (request.source_metadata.length > 1 || scope !== "light") {
    requirements.add("source_consistency");
  }
  if (
    TIME_SENSITIVE_TASKS.has(request.original_user_query.task_class) ||
    riskFlags.includes("outdated_information")
  ) {
    requirements.add("date_freshness");
  }
  if (scope === "deep" || riskFlags.includes("model_disagreement")) {
    requirements.add("model_crosscheck");
  }

  return VERIFICATION_AGENT_EVIDENCE_REQUIREMENTS.filter((requirement) =>
    requirements.has(requirement),
  );
}

function costBandFor(scope: VerificationAgentScope): VerificationAgentCostBand {
  if (scope === "none") return "none";
  if (scope === "light") return "low";
  if (scope === "normal") return "medium";
  return "high";
}

function expectedConfidenceFor(
  scope: VerificationAgentScope,
  riskFlags: readonly VerificationAgentRiskFlag[],
): VerificationAgentConfidence {
  if (scope === "none") return "unknown";
  if (scope === "deep") return "high";
  if (
    riskFlags.includes("insufficient_sources") ||
    riskFlags.includes("unsupported_claim")
  ) {
    return "medium";
  }
  return scope === "normal" ? "medium" : "low";
}

function telemetryFor(input: {
  readonly request: VerificationAgentRequest;
  readonly verificationRequired: boolean;
  readonly scope: VerificationAgentScope;
  readonly intensity: VerificationAgentIntensity;
  readonly riskFlags: readonly VerificationAgentRiskFlag[];
  readonly evidenceRequirements: readonly VerificationAgentEvidenceRequirement[];
  readonly estimatedCostBand: VerificationAgentCostBand;
}): VerificationAgentPlannerTelemetry {
  return VerificationAgentPlannerTelemetrySchema.parse({
    telemetry_version: VERIFICATION_AGENT_PLANNER_VERSION,
    request_id: input.request.request_id,
    query_id: input.request.original_user_query.query_id,
    answer_id: input.request.primary_answer.answer_id,
    task_class: input.request.original_user_query.task_class,
    source_count: input.request.source_metadata.length,
    verification_required: input.verificationRequired,
    verification_scope: input.scope,
    verification_intensity: input.intensity,
    risk_flag_count: input.riskFlags.length,
    evidence_requirement_count: input.evidenceRequirements.length,
    estimated_cost_band: input.estimatedCostBand,
    metadata_only: true,
    redaction_status: "metadata_only",
    raw_prompt_included: false,
    raw_answer_body_included: false,
    raw_verifier_response_included: false,
    raw_source_bodies_included: false,
  });
}

function compareRiskFlags(
  left: VerificationAgentRiskFlag,
  right: VerificationAgentRiskFlag,
): number {
  return (
    VERIFICATION_AGENT_RISK_FLAGS.indexOf(left) -
    VERIFICATION_AGENT_RISK_FLAGS.indexOf(right)
  );
}
