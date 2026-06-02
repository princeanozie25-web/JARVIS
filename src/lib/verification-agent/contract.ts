import { z } from "zod";

export const VERIFICATION_AGENT_CONTRACT_VERSION =
  "phase21a.verification-agent.contract.v1" as const;

export const VERIFICATION_AGENT_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
  "unknown",
] as const;

export const VERIFICATION_AGENT_STATUSES = [
  "verified",
  "verified_with_caveat",
  "unverified",
  "conflicting",
  "needs_human_review",
  "failed_closed",
] as const;

export const VERIFICATION_AGENT_RISK_FLAGS = [
  "unsupported_claim",
  "outdated_information",
  "insufficient_sources",
  "overconfident_answer",
  "safety_sensitive",
  "conflicting_context",
  "model_disagreement",
] as const;

export const VERIFICATION_AGENT_TASK_CLASSES = [
  "general",
  "coding",
  "research",
  "current_events",
  "medical",
  "legal",
  "financial",
  "career",
  "personal",
  "other",
] as const;

export const VERIFICATION_AGENT_UI_RENDER_TARGETS = [
  "confidence_chip",
  "caveat_tooltip",
  "risk_flag_badges",
] as const;

const ContractIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const BoundedTextSchema = z.string().trim().min(1).max(2_000);

export const VerificationAgentConfidenceSchema = z.enum(
  VERIFICATION_AGENT_CONFIDENCE_LEVELS,
);

export const VerificationAgentStatusSchema = z.enum(
  VERIFICATION_AGENT_STATUSES,
);

export const VerificationAgentRiskFlagSchema = z.enum(
  VERIFICATION_AGENT_RISK_FLAGS,
);

export const VerificationAgentTaskClassSchema = z.enum(
  VERIFICATION_AGENT_TASK_CLASSES,
);

export const VerificationAgentSourceMetadataSchema = z.strictObject({
  source_id: ContractIdSchema,
  source_type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(180).nullable().default(null),
  content_hash: HashReferenceSchema.nullable().default(null),
  uri_hash: HashReferenceSchema.nullable().default(null),
  retrieved_at: z
    .string()
    .trim()
    .datetime({ offset: true })
    .nullable()
    .default(null),
  raw_source_body_included: z.literal(false),
});

export const VerificationAgentOriginalQueryMetadataSchema = z.strictObject({
  query_id: ContractIdSchema,
  task_class: VerificationAgentTaskClassSchema,
  query_hash: HashReferenceSchema,
  created_at: z.string().trim().datetime({ offset: true }),
  metadata_only: z.literal(true),
  raw_query_included: z.literal(false),
});

export const VerificationAgentPrimaryAnswerMetadataSchema = z
  .strictObject({
    answer_id: ContractIdSchema,
    model_id: z.string().trim().min(1).max(120),
    answer_reference_hash: HashReferenceSchema,
    answer_summary: BoundedTextSchema.nullable().default(null),
    bounded_answer_text: BoundedTextSchema.nullable().default(null),
    bounded_answer_text_included: z.boolean(),
    raw_answer_body_included: z.literal(false),
    telemetry_metadata_only: z.literal(true),
  })
  .superRefine((value, context) => {
    if (!value.answer_summary && !value.bounded_answer_text) {
      context.addIssue({
        code: "custom",
        message:
          "Verification input requires an answer summary or bounded answer text.",
        path: ["answer_summary"],
      });
    }
    if (value.bounded_answer_text && !value.bounded_answer_text_included) {
      context.addIssue({
        code: "custom",
        message:
          "bounded_answer_text_included must be true when bounded text is present.",
        path: ["bounded_answer_text_included"],
      });
    }
  });

export const VerificationAgentRequestSchema = z.strictObject({
  kind: z.literal("verification_agent.request"),
  contract_version: z.literal(VERIFICATION_AGENT_CONTRACT_VERSION),
  request_id: ContractIdSchema,
  original_user_query: VerificationAgentOriginalQueryMetadataSchema,
  primary_answer: VerificationAgentPrimaryAnswerMetadataSchema,
  source_metadata: z.array(VerificationAgentSourceMetadataSchema).default([]),
  verification_requested_at: z.string().trim().datetime({ offset: true }),
  cost_governance_required: z.literal(true),
  metadata_only: z.literal(true),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
});

export const VerificationAgentCostEstimateSchema = z.strictObject({
  verifier_model_id: z.string().trim().min(1).max(120),
  provider_kind: z.string().trim().min(1).max(80),
  estimated_input_tokens: z.number().int().nonnegative(),
  estimated_output_tokens: z.number().int().nonnegative(),
  estimated_total_tokens: z.number().int().nonnegative(),
  pricing_verified: z.literal(false),
  exact_cost: z.null(),
  cost_basis: z.literal("configurable_unverified_metadata"),
});

export const VerificationAgentTelemetryMetadataSchema = z.strictObject({
  telemetry_version: z.literal(VERIFICATION_AGENT_CONTRACT_VERSION),
  verification_id: ContractIdSchema,
  request_id: ContractIdSchema,
  query_id: ContractIdSchema,
  answer_id: ContractIdSchema,
  task_class: VerificationAgentTaskClassSchema,
  primary_model_id: z.string().trim().min(1).max(120),
  verifier_model_id: z.string().trim().min(1).max(120),
  answer_reference_hash: HashReferenceSchema,
  source_count: z.number().int().nonnegative(),
  verification_status: VerificationAgentStatusSchema,
  confidence: VerificationAgentConfidenceSchema,
  risk_flags: z.array(VerificationAgentRiskFlagSchema),
  estimated_total_tokens: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  redaction_status: z.literal("metadata_only"),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
  raw_verifier_response_included: z.literal(false),
  bounded_answer_text_retained: z.literal(false),
  raw_source_bodies_included: z.literal(false),
});

export const VerificationAgentUiContractSchema = z.strictObject({
  render_targets: z.array(z.enum(VERIFICATION_AGENT_UI_RENDER_TARGETS)),
  confidence_chip: z.strictObject({
    visible: z.literal(true),
    confidence: VerificationAgentConfidenceSchema,
    advisory: z.literal(true),
  }),
  caveat_tooltip: z.strictObject({
    visible: z.literal(true),
    caveat: z.string().trim().min(1).max(800),
    hidden_from_ui: z.literal(false),
  }),
  risk_flag_badges: z.array(
    z.strictObject({
      flag: VerificationAgentRiskFlagSchema,
      visible: z.literal(true),
    }),
  ),
});

export const VerificationAgentResultSchema = z.strictObject({
  kind: z.literal("verification_agent.result"),
  contract_version: z.literal(VERIFICATION_AGENT_CONTRACT_VERSION),
  verification_id: ContractIdSchema,
  request_id: ContractIdSchema,
  verification_status: VerificationAgentStatusSchema,
  confidence: VerificationAgentConfidenceSchema,
  caveat: z.string().trim().min(1).max(800),
  risk_flags: z.array(VerificationAgentRiskFlagSchema),
  evidence_notes: z.array(z.string().trim().min(1).max(500)),
  verifier_model_id: z.string().trim().min(1).max(120),
  cost_estimate: VerificationAgentCostEstimateSchema,
  telemetry_metadata: VerificationAgentTelemetryMetadataSchema,
  ui_contract: VerificationAgentUiContractSchema,
  advisory_only: z.literal(true),
  rewrites_primary_answer: z.literal(false),
  automatic_rewrite_allowed: z.literal(false),
  creates_autonomous_truth_claim: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
  raw_verifier_response_included: z.literal(false),
});

export type VerificationAgentConfidence = z.infer<
  typeof VerificationAgentConfidenceSchema
>;
export type VerificationAgentStatus = z.infer<
  typeof VerificationAgentStatusSchema
>;
export type VerificationAgentRiskFlag = z.infer<
  typeof VerificationAgentRiskFlagSchema
>;
export type VerificationAgentTaskClass = z.infer<
  typeof VerificationAgentTaskClassSchema
>;
export type VerificationAgentSourceMetadata = z.infer<
  typeof VerificationAgentSourceMetadataSchema
>;
export type VerificationAgentOriginalQueryMetadata = z.infer<
  typeof VerificationAgentOriginalQueryMetadataSchema
>;
export type VerificationAgentPrimaryAnswerMetadata = z.infer<
  typeof VerificationAgentPrimaryAnswerMetadataSchema
>;
export type VerificationAgentRequest = z.infer<
  typeof VerificationAgentRequestSchema
>;
export type VerificationAgentCostEstimate = z.infer<
  typeof VerificationAgentCostEstimateSchema
>;
export type VerificationAgentTelemetryMetadata = z.infer<
  typeof VerificationAgentTelemetryMetadataSchema
>;
export type VerificationAgentUiContract = z.infer<
  typeof VerificationAgentUiContractSchema
>;
export type VerificationAgentResult = z.infer<
  typeof VerificationAgentResultSchema
>;

export function createVerificationAgentRequest(
  input: unknown,
): VerificationAgentRequest {
  return VerificationAgentRequestSchema.parse(input);
}

export function createVerificationAgentResult(input: {
  readonly request: VerificationAgentRequest;
  readonly verification_id: string;
  readonly verification_status: VerificationAgentStatus;
  readonly confidence: VerificationAgentConfidence;
  readonly caveat: string;
  readonly risk_flags?: readonly VerificationAgentRiskFlag[];
  readonly evidence_notes?: readonly string[];
  readonly verifier_model_id: string;
  readonly cost_estimate?: Partial<VerificationAgentCostEstimate>;
}): VerificationAgentResult {
  const riskFlags = [...(input.risk_flags ?? [])];
  const costEstimate = createCostEstimate({
    verifierModelId: input.verifier_model_id,
    estimate: input.cost_estimate,
  });
  const telemetry = createVerificationAgentTelemetryMetadata({
    request: input.request,
    verification_id: input.verification_id,
    verification_status: input.verification_status,
    confidence: input.confidence,
    risk_flags: riskFlags,
    verifier_model_id: input.verifier_model_id,
    cost_estimate: costEstimate,
  });

  return VerificationAgentResultSchema.parse({
    kind: "verification_agent.result",
    contract_version: VERIFICATION_AGENT_CONTRACT_VERSION,
    verification_id: input.verification_id,
    request_id: input.request.request_id,
    verification_status: input.verification_status,
    confidence: input.confidence,
    caveat: input.caveat,
    risk_flags: riskFlags,
    evidence_notes: input.evidence_notes ?? [],
    verifier_model_id: input.verifier_model_id,
    cost_estimate: costEstimate,
    telemetry_metadata: telemetry,
    ui_contract: createVerificationAgentUiContract({
      confidence: input.confidence,
      caveat: input.caveat,
      risk_flags: riskFlags,
    }),
    advisory_only: true,
    rewrites_primary_answer: false,
    automatic_rewrite_allowed: false,
    creates_autonomous_truth_claim: false,
    raw_prompt_included: false,
    raw_answer_body_included: false,
    raw_verifier_response_included: false,
  });
}

export function createVerificationAgentTelemetryMetadata(input: {
  readonly request: VerificationAgentRequest;
  readonly verification_id: string;
  readonly verification_status: VerificationAgentStatus;
  readonly confidence: VerificationAgentConfidence;
  readonly risk_flags: readonly VerificationAgentRiskFlag[];
  readonly verifier_model_id: string;
  readonly cost_estimate: VerificationAgentCostEstimate;
}): VerificationAgentTelemetryMetadata {
  return VerificationAgentTelemetryMetadataSchema.parse({
    telemetry_version: VERIFICATION_AGENT_CONTRACT_VERSION,
    verification_id: input.verification_id,
    request_id: input.request.request_id,
    query_id: input.request.original_user_query.query_id,
    answer_id: input.request.primary_answer.answer_id,
    task_class: input.request.original_user_query.task_class,
    primary_model_id: input.request.primary_answer.model_id,
    verifier_model_id: input.verifier_model_id,
    answer_reference_hash: input.request.primary_answer.answer_reference_hash,
    source_count: input.request.source_metadata.length,
    verification_status: input.verification_status,
    confidence: input.confidence,
    risk_flags: [...input.risk_flags],
    estimated_total_tokens: input.cost_estimate.estimated_total_tokens,
    metadata_only: true,
    redaction_status: "metadata_only",
    raw_prompt_included: false,
    raw_answer_body_included: false,
    raw_verifier_response_included: false,
    bounded_answer_text_retained: false,
    raw_source_bodies_included: false,
  });
}

export function createVerificationAgentUiContract(input: {
  readonly confidence: VerificationAgentConfidence;
  readonly caveat: string;
  readonly risk_flags: readonly VerificationAgentRiskFlag[];
}): VerificationAgentUiContract {
  return VerificationAgentUiContractSchema.parse({
    render_targets: ["confidence_chip", "caveat_tooltip", "risk_flag_badges"],
    confidence_chip: {
      visible: true,
      confidence: input.confidence,
      advisory: true,
    },
    caveat_tooltip: {
      visible: true,
      caveat: input.caveat,
      hidden_from_ui: false,
    },
    risk_flag_badges: input.risk_flags.map((flag) => ({
      flag,
      visible: true,
    })),
  });
}

function createCostEstimate(input: {
  readonly verifierModelId: string;
  readonly estimate?: Partial<VerificationAgentCostEstimate>;
}): VerificationAgentCostEstimate {
  const estimatedInputTokens = input.estimate?.estimated_input_tokens ?? 0;
  const estimatedOutputTokens = input.estimate?.estimated_output_tokens ?? 0;
  return VerificationAgentCostEstimateSchema.parse({
    verifier_model_id:
      input.estimate?.verifier_model_id ?? input.verifierModelId,
    provider_kind: input.estimate?.provider_kind ?? "deepseek",
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_total_tokens:
      input.estimate?.estimated_total_tokens ??
      estimatedInputTokens + estimatedOutputTokens,
    pricing_verified: false,
    exact_cost: null,
    cost_basis: "configurable_unverified_metadata",
  });
}
