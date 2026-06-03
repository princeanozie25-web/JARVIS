import { z } from "zod";

import {
  CouncilConfidenceSchema,
  CouncilQuestionSchema,
  type CouncilConfidence,
  type CouncilQuestion,
} from "./workflow";

export const LIVE_COUNCIL_REALIZATION_VERSION =
  "phase21f-r.live-council.v1" as const;

export const LIVE_COUNCIL_MEMBER_IDS = [
  "claude",
  "gpt",
  "deepseek",
  "local_fast",
  "local_smart",
] as const;

export const LIVE_COUNCIL_PROVIDER_AVAILABILITIES = [
  "available",
  "disabled",
  "missing",
  "unavailable",
] as const;

export const LIVE_COUNCIL_PROVIDER_POSTURES = ["cloud", "local"] as const;

export const LIVE_COUNCIL_DISPATCH_STATUSES = [
  "ready",
  "degraded",
  "blocked",
] as const;

export const LIVE_COUNCIL_STAGES = ["answer", "review", "chairman"] as const;

export const LIVE_COUNCIL_RUN_STATUSES = [
  "completed",
  "degraded",
  "blocked",
] as const;

export const LIVE_COUNCIL_COST_GATE_STATUSES = [
  "approved",
  "degraded",
  "blocked",
] as const;

export const LIVE_COUNCIL_COST_GATE_REASONS = [
  "approved",
  "confirmation_missing",
  "budget_exceeded",
  "insufficient_available_members",
  "unknown_cloud_pricing",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const BoundedTextSchema = z.string().trim().min(1).max(2000);
const BoundedShortTextSchema = z.string().trim().min(1).max(360);
const NullableCostSchema = z.number().nonnegative().nullable();

export const CouncilLiveMemberIdSchema = z.enum(LIVE_COUNCIL_MEMBER_IDS);
export const CouncilProviderAvailabilitySchema = z.enum(
  LIVE_COUNCIL_PROVIDER_AVAILABILITIES,
);
export const CouncilProviderPostureSchema = z.enum(
  LIVE_COUNCIL_PROVIDER_POSTURES,
);
export const CouncilDispatchStatusSchema = z.enum(
  LIVE_COUNCIL_DISPATCH_STATUSES,
);
export const CouncilStageSchema = z.enum(LIVE_COUNCIL_STAGES);
export const CouncilRunStatusSchema = z.enum(LIVE_COUNCIL_RUN_STATUSES);
export const CouncilCostGateStatusSchema = z.enum(
  LIVE_COUNCIL_COST_GATE_STATUSES,
);
export const CouncilCostGateReasonSchema = z.enum(
  LIVE_COUNCIL_COST_GATE_REASONS,
);

export const CouncilProviderMemberSchema = z.strictObject({
  member_id: CouncilLiveMemberIdSchema,
  display_name: BoundedShortTextSchema,
  provider_id: BoundedShortTextSchema,
  model_id: BoundedShortTextSchema,
  posture: CouncilProviderPostureSchema,
  availability: CouncilProviderAvailabilitySchema,
  reason_if_skipped: BoundedShortTextSchema.nullable(),
  estimated_input_tokens: z.number().int().nonnegative(),
  estimated_output_tokens: z.number().int().nonnegative(),
  estimated_cost_usd: NullableCostSchema,
  unknown_pricing_warning: z.boolean(),
  max_token_budget: z.number().int().positive(),
  metadata_only: z.literal(true),
  dispatch_attempted: z.literal(false),
});

export const CouncilChairmanPlanSchema = z.strictObject({
  chairman_member_id: CouncilLiveMemberIdSchema.nullable(),
  chairman_model_id: BoundedShortTextSchema.nullable(),
  selection_reason: BoundedShortTextSchema,
  explicit: z.literal(true),
  fallback_order: z.array(CouncilLiveMemberIdSchema),
});

export const CouncilProviderPlanSchema = z.strictObject({
  kind: z.literal("council.provider_plan"),
  version: z.literal(LIVE_COUNCIL_REALIZATION_VERSION),
  plan_id: BoundedIdSchema,
  question_id: BoundedIdSchema,
  members: z
    .array(CouncilProviderMemberSchema)
    .length(LIVE_COUNCIL_MEMBER_IDS.length),
  available_member_count: z.number().int().nonnegative(),
  dispatch_status: CouncilDispatchStatusSchema,
  dispatch_reason: BoundedShortTextSchema,
  chairman: CouncilChairmanPlanSchema,
  target_roster: z
    .array(CouncilLiveMemberIdSchema)
    .length(LIVE_COUNCIL_MEMBER_IDS.length),
  gemini_included: z.literal(false),
  default_cloud_dispatch_enabled: z.literal(false),
  cost_gate_required: z.literal(true),
  provider_call_attempted: z.literal(false),
  advisory_only: z.literal(true),
});

export const CouncilBudgetPolicySchema = z.strictObject({
  policy_id: BoundedIdSchema,
  user_confirmation_received: z.boolean(),
  budget_cap_usd: z.number().nonnegative(),
  budget_remaining_usd: z.number().nonnegative().nullable(),
  metadata_only: z.literal(true),
});

export const CouncilCostEstimateSchema = z.strictObject({
  estimate_id: BoundedIdSchema,
  answer_stage_cost_usd: z.number().nonnegative(),
  review_stage_cost_usd: z.number().nonnegative(),
  chairman_stage_cost_usd: z.number().nonnegative(),
  local_stage_cost_usd: z.literal(0),
  total_estimated_cost_usd: z.number().nonnegative(),
  unknown_pricing_warnings: z.array(BoundedShortTextSchema),
  metadata_only: z.literal(true),
});

export const CouncilCostGateDecisionSchema = z.strictObject({
  gate_id: BoundedIdSchema,
  status: CouncilCostGateStatusSchema,
  reason: CouncilCostGateReasonSchema,
  dispatch_allowed: z.boolean(),
  user_confirmation_required: z.literal(true),
  user_confirmation_received: z.boolean(),
  cost_estimate: CouncilCostEstimateSchema,
  provider_call_attempted: z.literal(false),
  advisory_only: z.literal(true),
});

export const CouncilProviderRequestSchema = z.strictObject({
  request_id: BoundedIdSchema,
  stage: CouncilStageSchema,
  question_id: BoundedIdSchema,
  member_id: CouncilLiveMemberIdSchema,
  model_id: BoundedShortTextSchema,
  prompt: BoundedTextSchema,
  anonymized_peer_packet: z.unknown().optional(),
  metadata_only: z.literal(true),
  raw_answer_body_for_telemetry: z.literal(false),
  tool_call_allowed: z.literal(false),
  execution_allowed: z.literal(false),
});

export const CouncilTokenUsageSchema = z.strictObject({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export const CouncilProviderResultSchema = z.strictObject({
  request_id: BoundedIdSchema,
  stage: CouncilStageSchema,
  member_id: CouncilLiveMemberIdSchema,
  model_id: BoundedShortTextSchema,
  status: z.enum(["succeeded", "timeout", "provider_failed", "unavailable"]),
  answer_summary: BoundedTextSchema,
  confidence: CouncilConfidenceSchema,
  caveats: z.array(BoundedShortTextSchema),
  latency_ms: z.number().int().nonnegative(),
  token_usage: CouncilTokenUsageSchema,
  raw_body_written_to_telemetry: z.literal(false),
  advisory_only: z.literal(true),
  execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  tool_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
});

export const CouncilAnonymizedAnswerSchema = z.strictObject({
  alias: BoundedIdSchema,
  answer_summary: BoundedTextSchema,
  confidence: CouncilConfidenceSchema,
  caveats: z.array(BoundedShortTextSchema),
});

export const CouncilAnonymizedReviewPacketSchema = z.strictObject({
  packet_id: BoundedIdSchema,
  question_id: BoundedIdSchema,
  reviewer_alias: BoundedIdSchema,
  answers: z.array(CouncilAnonymizedAnswerSchema),
  provider_identity_hidden: z.literal(true),
  model_identity_hidden: z.literal(true),
  metadata_only: z.literal(true),
});

export const CouncilChairmanPacketSchema = z.strictObject({
  packet_id: BoundedIdSchema,
  question_id: BoundedIdSchema,
  original_question: BoundedTextSchema,
  answers: z.array(CouncilAnonymizedAnswerSchema),
  reviews: z.array(
    z.strictObject({
      reviewer_alias: BoundedIdSchema,
      review_summary: BoundedTextSchema,
      confidence: CouncilConfidenceSchema,
    }),
  ),
  disagreement_summary: BoundedShortTextSchema,
  confidence_summary: BoundedShortTextSchema,
  provider_identity_hidden_for_peer_reviews: z.literal(true),
  advisory_only: z.literal(true),
});

export const CouncilDispatchResultSchema = z.strictObject({
  stage: CouncilStageSchema,
  results: z.array(CouncilProviderResultSchema),
  degraded: z.boolean(),
  provider_identity_hidden: z.boolean(),
  provider_call_attempted: z.boolean(),
  advisory_only: z.literal(true),
});

export const LiveCouncilRunSchema = z.strictObject({
  kind: z.literal("council.live_run"),
  version: z.literal(LIVE_COUNCIL_REALIZATION_VERSION),
  run_id: BoundedIdSchema,
  status: CouncilRunStatusSchema,
  question_id: BoundedIdSchema,
  final_answer: BoundedTextSchema,
  confidence_summary: BoundedShortTextSchema,
  disagreement_summary: BoundedShortTextSchema,
  council_member_metadata: z.array(
    z.strictObject({
      member_id: CouncilLiveMemberIdSchema,
      model_id: BoundedShortTextSchema,
      posture: CouncilProviderPostureSchema,
      availability: CouncilProviderAvailabilitySchema,
    }),
  ),
  answer_stage: CouncilDispatchResultSchema,
  review_stage: CouncilDispatchResultSchema,
  chairman_stage: CouncilDispatchResultSchema,
  cost_summary: CouncilCostEstimateSchema,
  governance_summary: z.strictObject({
    advisory_only: z.literal(true),
    opt_in_required: z.literal(true),
    cost_gate_passed: z.boolean(),
    no_execution_authority: z.literal(true),
    no_approval_finalization: z.literal(true),
    no_tool_calls: z.literal(true),
    no_default_network_calls: z.literal(true),
    raw_answer_bodies_written_to_telemetry: z.literal(false),
  }),
});

export const CouncilRealizationCloseoutReportSchema = z.strictObject({
  kind: z.literal("council.realization_closeout"),
  version: z.literal(LIVE_COUNCIL_REALIZATION_VERSION),
  title: z.literal(
    "Council Mode realized as opt-in cost-gated live provider reasoning workflow",
  ),
  components: z.array(BoundedShortTextSchema),
  target_roster: z
    .array(CouncilLiveMemberIdSchema)
    .length(LIVE_COUNCIL_MEMBER_IDS.length),
  gemini_member_present: z.literal(false),
  governance_checks: z.strictObject({
    advisory_only: z.literal(true),
    cost_gate_required: z.literal(true),
    injected_provider_boundary: z.literal(true),
    no_default_provider_calls: z.literal(true),
    no_execution_authority: z.literal(true),
    no_approval_finalization: z.literal(true),
    no_tool_calls: z.literal(true),
    no_autonomous_triggering: z.literal(true),
    no_raw_answer_telemetry: z.literal(true),
    no_hidden_cloud_escalation: z.literal(true),
  }),
  summary: z.array(BoundedShortTextSchema),
});

export type CouncilLiveMemberId = z.infer<typeof CouncilLiveMemberIdSchema>;
export type CouncilProviderAvailability = z.infer<
  typeof CouncilProviderAvailabilitySchema
>;
export type CouncilProviderMember = z.infer<typeof CouncilProviderMemberSchema>;
export type CouncilProviderPlan = z.infer<typeof CouncilProviderPlanSchema>;
export type CouncilChairmanPlan = z.infer<typeof CouncilChairmanPlanSchema>;
export type CouncilBudgetPolicy = z.infer<typeof CouncilBudgetPolicySchema>;
export type CouncilCostEstimate = z.infer<typeof CouncilCostEstimateSchema>;
export type CouncilCostGateDecision = z.infer<
  typeof CouncilCostGateDecisionSchema
>;
export type CouncilProviderRequest = z.infer<
  typeof CouncilProviderRequestSchema
>;
export type CouncilProviderResult = z.infer<typeof CouncilProviderResultSchema>;
export type CouncilAnonymizedReviewPacket = z.infer<
  typeof CouncilAnonymizedReviewPacketSchema
>;
export type CouncilChairmanPacket = z.infer<typeof CouncilChairmanPacketSchema>;
export type CouncilDispatchResult = z.infer<typeof CouncilDispatchResultSchema>;
export type LiveCouncilRun = z.infer<typeof LiveCouncilRunSchema>;
export type CouncilRealizationCloseoutReport = z.infer<
  typeof CouncilRealizationCloseoutReportSchema
>;

export interface CouncilProviderRunner {
  run(
    request: CouncilProviderRequest,
  ): Promise<CouncilProviderResult | unknown> | CouncilProviderResult | unknown;
}

export interface LiveCouncilProviderPlanInput {
  readonly question: CouncilQuestion;
  readonly availability?: Partial<
    Record<CouncilLiveMemberId, CouncilProviderAvailability>
  >;
  readonly model_overrides?: Partial<Record<CouncilLiveMemberId, string>>;
  readonly estimated_cost_overrides?: Partial<
    Record<CouncilLiveMemberId, number | null>
  >;
  readonly max_token_budget?: number;
}

const DEFAULT_PROVIDER_MEMBERS: ReadonlyArray<
  Omit<
    CouncilProviderMember,
    | "availability"
    | "reason_if_skipped"
    | "estimated_input_tokens"
    | "estimated_output_tokens"
    | "estimated_cost_usd"
    | "unknown_pricing_warning"
    | "max_token_budget"
    | "metadata_only"
    | "dispatch_attempted"
  > & { readonly default_cost_usd: number | null }
> = [
  {
    member_id: "claude",
    display_name: "Claude",
    provider_id: "anthropic-compatible",
    model_id: "cloud-frontier",
    posture: "cloud",
    default_cost_usd: 0.03,
  },
  {
    member_id: "gpt",
    display_name: "GPT",
    provider_id: "openai-compatible",
    model_id: "gpt-frontier",
    posture: "cloud",
    default_cost_usd: 0.02,
  },
  {
    member_id: "deepseek",
    display_name: "DeepSeek",
    provider_id: "deepseek-compatible",
    model_id: "deepseek-v4-pro",
    posture: "cloud",
    default_cost_usd: 0.01,
  },
  {
    member_id: "local_fast",
    display_name: "Local Fast",
    provider_id: "local-fast",
    model_id: "llama3.2:3b",
    posture: "local",
    default_cost_usd: 0,
  },
  {
    member_id: "local_smart",
    display_name: "Local Smart",
    provider_id: "local-smart",
    model_id: "qwen2.5:7b",
    posture: "local",
    default_cost_usd: 0,
  },
] as const;

export function buildLiveCouncilProviderPlan(
  input: LiveCouncilProviderPlanInput,
): CouncilProviderPlan {
  const question = CouncilQuestionSchema.parse(input.question);
  const maxTokenBudget = input.max_token_budget ?? 2400;
  const members = DEFAULT_PROVIDER_MEMBERS.map((member) => {
    const { default_cost_usd: defaultCostUsd, ...memberMetadata } = member;
    const availability =
      input.availability?.[member.member_id] ??
      (member.member_id === "local_smart" ? "unavailable" : "available");
    const estimatedCost = Object.prototype.hasOwnProperty.call(
      input.estimated_cost_overrides ?? {},
      member.member_id,
    )
      ? (input.estimated_cost_overrides ?? {})[member.member_id]
      : defaultCostUsd;
    return CouncilProviderMemberSchema.parse({
      ...memberMetadata,
      model_id: input.model_overrides?.[member.member_id] ?? member.model_id,
      availability,
      reason_if_skipped: reasonForAvailability(member.member_id, availability),
      estimated_input_tokens: 1200,
      estimated_output_tokens: 800,
      estimated_cost_usd: member.posture === "local" ? 0 : estimatedCost,
      unknown_pricing_warning:
        member.posture === "cloud" && estimatedCost === null,
      max_token_budget: maxTokenBudget,
      metadata_only: true,
      dispatch_attempted: false,
    });
  });
  const availableMemberCount = members.filter(
    (member) => member.availability === "available",
  ).length;
  const unavailableCount = members.length - availableMemberCount;
  const dispatchStatus =
    availableMemberCount < 2
      ? "blocked"
      : unavailableCount > 0
        ? "degraded"
        : "ready";
  const chairman = selectCouncilChairman(members, question.task_class);

  return CouncilProviderPlanSchema.parse({
    kind: "council.provider_plan",
    version: LIVE_COUNCIL_REALIZATION_VERSION,
    plan_id: `council-provider-plan:${question.question_id}`,
    question_id: question.question_id,
    members,
    available_member_count: availableMemberCount,
    dispatch_status: dispatchStatus,
    dispatch_reason:
      availableMemberCount < 2
        ? "Live Council dispatch requires at least two available members."
        : unavailableCount > 0
          ? "Some target council members are unavailable; dispatch may proceed in degraded advisory mode after cost approval."
          : "All target council members are available for opt-in dispatch after cost approval.",
    chairman,
    target_roster: [...LIVE_COUNCIL_MEMBER_IDS],
    gemini_included: false,
    default_cloud_dispatch_enabled: false,
    cost_gate_required: true,
    provider_call_attempted: false,
    advisory_only: true,
  });
}

export function summarizeLiveCouncilProviderPlan(
  plan: CouncilProviderPlan,
): string {
  const parsed = CouncilProviderPlanSchema.parse(plan);
  const chairman = parsed.chairman.chairman_member_id ?? "none";
  return `${parsed.available_member_count}/${parsed.members.length} council members available; dispatch ${parsed.dispatch_status}; chairman ${chairman}.`;
}

export function selectCouncilChairman(
  members: readonly CouncilProviderMember[],
  taskClass: CouncilQuestion["task_class"] = "general_reasoning",
): CouncilChairmanPlan {
  const parsedMembers = members.map((member) =>
    CouncilProviderMemberSchema.parse(member),
  );
  const preferredOrder: CouncilLiveMemberId[] =
    taskClass === "planning" || taskClass === "risk_review"
      ? ["claude", "deepseek", "gpt"]
      : ["deepseek", "claude", "gpt"];
  const chairman = preferredOrder
    .map((memberId) =>
      parsedMembers.find(
        (member) =>
          member.member_id === memberId && member.availability === "available",
      ),
    )
    .find((member): member is CouncilProviderMember => Boolean(member));

  return CouncilChairmanPlanSchema.parse({
    chairman_member_id: chairman?.member_id ?? null,
    chairman_model_id: chairman?.model_id ?? null,
    selection_reason: chairman
      ? `${chairman.display_name} selected explicitly as chairman for ${taskClass}.`
      : "No chairman is available; dispatch must fail closed.",
    explicit: true,
    fallback_order: preferredOrder,
  });
}

export function estimateCouncilCost(
  plan: CouncilProviderPlan,
): CouncilCostEstimate {
  const parsed = CouncilProviderPlanSchema.parse(plan);
  const availableMembers = parsed.members.filter(
    (member) => member.availability === "available",
  );
  const answerStageCost = sumKnownCosts(availableMembers);
  const reviewStageCost =
    answerStageCost * Math.max(availableMembers.length - 1, 1);
  const chairmanMember = availableMembers.find(
    (member) => member.member_id === parsed.chairman.chairman_member_id,
  );
  const chairmanStageCost = knownCost(chairmanMember);
  const unknownPricingWarnings = availableMembers
    .filter((member) => member.unknown_pricing_warning)
    .map((member) => `${member.display_name} has unknown cloud pricing.`);

  return CouncilCostEstimateSchema.parse({
    estimate_id: `council-cost-estimate:${parsed.question_id}`,
    answer_stage_cost_usd: roundCost(answerStageCost),
    review_stage_cost_usd: roundCost(reviewStageCost),
    chairman_stage_cost_usd: roundCost(chairmanStageCost),
    local_stage_cost_usd: 0,
    total_estimated_cost_usd: roundCost(
      answerStageCost + reviewStageCost + chairmanStageCost,
    ),
    unknown_pricing_warnings: unknownPricingWarnings,
    metadata_only: true,
  });
}

export function evaluateCouncilCostGate(input: {
  readonly plan: CouncilProviderPlan;
  readonly policy: CouncilBudgetPolicy;
  readonly estimate?: CouncilCostEstimate;
}): CouncilCostGateDecision {
  const plan = CouncilProviderPlanSchema.parse(input.plan);
  const policy = CouncilBudgetPolicySchema.parse(input.policy);
  const estimate =
    input.estimate === undefined
      ? estimateCouncilCost(plan)
      : CouncilCostEstimateSchema.parse(input.estimate);

  const budgetRemaining = policy.budget_remaining_usd ?? policy.budget_cap_usd;
  const budgetExceeded =
    estimate.total_estimated_cost_usd > policy.budget_cap_usd ||
    estimate.total_estimated_cost_usd > budgetRemaining;
  const reason: z.infer<typeof CouncilCostGateReasonSchema> =
    plan.available_member_count < 2
      ? "insufficient_available_members"
      : !policy.user_confirmation_received
        ? "confirmation_missing"
        : budgetExceeded
          ? "budget_exceeded"
          : estimate.unknown_pricing_warnings.length > 0
            ? "unknown_cloud_pricing"
            : "approved";
  const status =
    reason === "approved"
      ? "approved"
      : reason === "unknown_cloud_pricing"
        ? "degraded"
        : "blocked";

  return CouncilCostGateDecisionSchema.parse({
    gate_id: `council-cost-gate:${plan.question_id}`,
    status,
    reason,
    dispatch_allowed: status === "approved",
    user_confirmation_required: true,
    user_confirmation_received: policy.user_confirmation_received,
    cost_estimate: estimate,
    provider_call_attempted: false,
    advisory_only: true,
  });
}

export async function runCouncilAnswerStage(input: {
  readonly plan: CouncilProviderPlan;
  readonly question: CouncilQuestion;
  readonly runner: CouncilProviderRunner;
}): Promise<CouncilDispatchResult> {
  const plan = CouncilProviderPlanSchema.parse(input.plan);
  const question = CouncilQuestionSchema.parse(input.question);
  const results = await Promise.all(
    availableMembers(plan).map((member) =>
      runProviderRequest(input.runner, {
        request_id: `council-answer:${question.question_id}:${member.member_id}`,
        stage: "answer",
        question_id: question.question_id,
        member_id: member.member_id,
        model_id: member.model_id,
        prompt: question.prompt,
        metadata_only: true,
        raw_answer_body_for_telemetry: false,
        tool_call_allowed: false,
        execution_allowed: false,
      }),
    ),
  );

  return CouncilDispatchResultSchema.parse({
    stage: "answer",
    results,
    degraded: results.some((result) => result.status !== "succeeded"),
    provider_identity_hidden: false,
    provider_call_attempted: true,
    advisory_only: true,
  });
}

export function buildCouncilAnonymizedReviewPacket(input: {
  readonly question: CouncilQuestion;
  readonly reviewer_member_id: CouncilLiveMemberId;
  readonly answers: readonly CouncilProviderResult[];
}): CouncilAnonymizedReviewPacket {
  const question = CouncilQuestionSchema.parse(input.question);
  const aliases = aliasMap(input.answers);
  const reviewerAlias =
    aliases.get(input.reviewer_member_id) ??
    `member_${input.reviewer_member_id}`;
  const answers = input.answers
    .map((answer) => CouncilProviderResultSchema.parse(answer))
    .filter((answer) => answer.member_id !== input.reviewer_member_id)
    .map((answer) =>
      CouncilAnonymizedAnswerSchema.parse({
        alias: aliases.get(answer.member_id) ?? `member_${answer.member_id}`,
        answer_summary: answer.answer_summary,
        confidence: answer.confidence,
        caveats: answer.caveats,
      }),
    );

  return CouncilAnonymizedReviewPacketSchema.parse({
    packet_id: `council-review-packet:${question.question_id}:${reviewerAlias}`,
    question_id: question.question_id,
    reviewer_alias: reviewerAlias,
    answers,
    provider_identity_hidden: true,
    model_identity_hidden: true,
    metadata_only: true,
  });
}

export async function runCouncilReviewStage(input: {
  readonly plan: CouncilProviderPlan;
  readonly question: CouncilQuestion;
  readonly answer_results: readonly CouncilProviderResult[];
  readonly runner: CouncilProviderRunner;
}): Promise<CouncilDispatchResult> {
  const plan = CouncilProviderPlanSchema.parse(input.plan);
  const question = CouncilQuestionSchema.parse(input.question);
  const answers = input.answer_results.map((result) =>
    CouncilProviderResultSchema.parse(result),
  );
  const results = await Promise.all(
    availableMembers(plan).map((member) => {
      const packet = buildCouncilAnonymizedReviewPacket({
        question,
        reviewer_member_id: member.member_id,
        answers,
      });
      return runProviderRequest(input.runner, {
        request_id: `council-review:${question.question_id}:${member.member_id}`,
        stage: "review",
        question_id: question.question_id,
        member_id: member.member_id,
        model_id: member.model_id,
        prompt:
          "Review the anonymized peer answers. Critique accuracy, caveats, and missing reasoning. Do not identify providers.",
        anonymized_peer_packet: packet,
        metadata_only: true,
        raw_answer_body_for_telemetry: false,
        tool_call_allowed: false,
        execution_allowed: false,
      });
    }),
  );

  return CouncilDispatchResultSchema.parse({
    stage: "review",
    results,
    degraded: results.some((result) => result.status !== "succeeded"),
    provider_identity_hidden: true,
    provider_call_attempted: true,
    advisory_only: true,
  });
}

export function buildCouncilChairmanPacket(input: {
  readonly question: CouncilQuestion;
  readonly answers: readonly CouncilProviderResult[];
  readonly reviews: readonly CouncilProviderResult[];
}): CouncilChairmanPacket {
  const question = CouncilQuestionSchema.parse(input.question);
  const answers = input.answers.map((result) =>
    CouncilProviderResultSchema.parse(result),
  );
  const reviews = input.reviews.map((result) =>
    CouncilProviderResultSchema.parse(result),
  );
  const aliases = aliasMap(answers);

  return CouncilChairmanPacketSchema.parse({
    packet_id: `council-chairman-packet:${question.question_id}`,
    question_id: question.question_id,
    original_question: question.prompt,
    answers: answers.map((answer) => ({
      alias: aliases.get(answer.member_id) ?? `member_${answer.member_id}`,
      answer_summary: answer.answer_summary,
      confidence: answer.confidence,
      caveats: answer.caveats,
    })),
    reviews: reviews.map((review) => ({
      reviewer_alias:
        aliases.get(review.member_id) ?? `member_${review.member_id}`,
      review_summary: review.answer_summary,
      confidence: review.confidence,
    })),
    disagreement_summary: summarizeDisagreementFromReviews(reviews),
    confidence_summary: summarizeConfidenceFromResults(answers),
    provider_identity_hidden_for_peer_reviews: true,
    advisory_only: true,
  });
}

export async function runCouncilChairmanStage(input: {
  readonly plan: CouncilProviderPlan;
  readonly question: CouncilQuestion;
  readonly answer_results: readonly CouncilProviderResult[];
  readonly review_results: readonly CouncilProviderResult[];
  readonly runner: CouncilProviderRunner;
}): Promise<CouncilDispatchResult> {
  const plan = CouncilProviderPlanSchema.parse(input.plan);
  const question = CouncilQuestionSchema.parse(input.question);
  const chairman = availableMembers(plan).find(
    (member) => member.member_id === plan.chairman.chairman_member_id,
  );
  if (!chairman) {
    return CouncilDispatchResultSchema.parse({
      stage: "chairman",
      results: [],
      degraded: true,
      provider_identity_hidden: false,
      provider_call_attempted: false,
      advisory_only: true,
    });
  }
  const packet = buildCouncilChairmanPacket({
    question,
    answers: input.answer_results,
    reviews: input.review_results,
  });
  const result = await runProviderRequest(input.runner, {
    request_id: `council-chairman:${question.question_id}:${chairman.member_id}`,
    stage: "chairman",
    question_id: question.question_id,
    member_id: chairman.member_id,
    model_id: chairman.model_id,
    prompt:
      "Synthesize the council answers and anonymous peer reviews into one advisory final answer.",
    anonymized_peer_packet: packet,
    metadata_only: true,
    raw_answer_body_for_telemetry: false,
    tool_call_allowed: false,
    execution_allowed: false,
  });

  return CouncilDispatchResultSchema.parse({
    stage: "chairman",
    results: [result],
    degraded: result.status !== "succeeded",
    provider_identity_hidden: false,
    provider_call_attempted: true,
    advisory_only: true,
  });
}

export async function runLiveCouncil(input: {
  readonly question: CouncilQuestion;
  readonly plan: CouncilProviderPlan;
  readonly budget_policy: CouncilBudgetPolicy;
  readonly runner?: CouncilProviderRunner;
}): Promise<LiveCouncilRun> {
  const question = CouncilQuestionSchema.parse(input.question);
  const plan = CouncilProviderPlanSchema.parse(input.plan);
  const costGate = evaluateCouncilCostGate({
    plan,
    policy: input.budget_policy,
  });
  if (!input.runner || !costGate.dispatch_allowed) {
    return blockedLiveCouncilRun(question, plan, costGate);
  }

  const answerStage = await runCouncilAnswerStage({
    plan,
    question,
    runner: input.runner,
  });
  const reviewStage = await runCouncilReviewStage({
    plan,
    question,
    answer_results: answerStage.results,
    runner: input.runner,
  });
  const chairmanStage = await runCouncilChairmanStage({
    plan,
    question,
    answer_results: answerStage.results,
    review_results: reviewStage.results,
    runner: input.runner,
  });
  const chairmanResult = chairmanStage.results[0];
  const degraded =
    plan.dispatch_status === "degraded" ||
    answerStage.degraded ||
    reviewStage.degraded ||
    chairmanStage.degraded;

  return LiveCouncilRunSchema.parse({
    kind: "council.live_run",
    version: LIVE_COUNCIL_REALIZATION_VERSION,
    run_id: `council-live-run:${question.question_id}`,
    status: degraded ? "degraded" : "completed",
    question_id: question.question_id,
    final_answer:
      chairmanResult?.answer_summary ??
      "Council chairman synthesis was unavailable; no advisory final answer was produced.",
    confidence_summary: summarizeConfidenceFromResults(answerStage.results),
    disagreement_summary: summarizeDisagreementFromReviews(reviewStage.results),
    council_member_metadata: plan.members.map((member) => ({
      member_id: member.member_id,
      model_id: member.model_id,
      posture: member.posture,
      availability: member.availability,
    })),
    answer_stage: answerStage,
    review_stage: reviewStage,
    chairman_stage: chairmanStage,
    cost_summary: costGate.cost_estimate,
    governance_summary: {
      advisory_only: true,
      opt_in_required: true,
      cost_gate_passed: true,
      no_execution_authority: true,
      no_approval_finalization: true,
      no_tool_calls: true,
      no_default_network_calls: true,
      raw_answer_bodies_written_to_telemetry: false,
    },
  });
}

export function summarizeLiveCouncilRun(run: LiveCouncilRun): string {
  const parsed = LiveCouncilRunSchema.parse(run);
  return `${parsed.status} live council advisory run with ${parsed.answer_stage.results.length} answer-stage members, ${parsed.review_stage.results.length} reviews, and total estimated cost $${parsed.cost_summary.total_estimated_cost_usd.toFixed(4)}.`;
}

export function buildCouncilRealizationCloseoutReport(): CouncilRealizationCloseoutReport {
  return CouncilRealizationCloseoutReportSchema.parse({
    kind: "council.realization_closeout",
    version: LIVE_COUNCIL_REALIZATION_VERSION,
    title:
      "Council Mode realized as opt-in cost-gated live provider reasoning workflow",
    components: [
      "live_provider_plan",
      "council_cost_gate",
      "injected_provider_dispatch_boundary",
      "independent_answer_stage",
      "anonymous_peer_review_stage",
      "chairman_synthesis_stage",
      "realization_closeout",
    ],
    target_roster: [...LIVE_COUNCIL_MEMBER_IDS],
    gemini_member_present: false,
    governance_checks: {
      advisory_only: true,
      cost_gate_required: true,
      injected_provider_boundary: true,
      no_default_provider_calls: true,
      no_execution_authority: true,
      no_approval_finalization: true,
      no_tool_calls: true,
      no_autonomous_triggering: true,
      no_raw_answer_telemetry: true,
      no_hidden_cloud_escalation: true,
    },
    summary: [
      "Live Council dispatch is opt-in and blocked before provider calls unless cost confirmation passes.",
      "The target council roster is Claude, GPT, DeepSeek, Local Fast, and Local Smart.",
      "The runtime uses an injected provider runner boundary and remains advisory-only.",
    ],
  });
}

async function runProviderRequest(
  runner: CouncilProviderRunner,
  request: CouncilProviderRequest,
): Promise<CouncilProviderResult> {
  const parsedRequest = CouncilProviderRequestSchema.parse(request);
  try {
    const result = await runner.run(parsedRequest);
    return CouncilProviderResultSchema.parse(result);
  } catch {
    return CouncilProviderResultSchema.parse({
      request_id: parsedRequest.request_id,
      stage: parsedRequest.stage,
      member_id: parsedRequest.member_id,
      model_id: parsedRequest.model_id,
      status: "provider_failed",
      answer_summary:
        "Provider runner failed closed before returning advisory metadata.",
      confidence: "unknown",
      caveats: ["Injected provider runner failed closed."],
      latency_ms: 0,
      token_usage: { input_tokens: 0, output_tokens: 0 },
      raw_body_written_to_telemetry: false,
      advisory_only: true,
      execution_attempted: false,
      approval_finalization_attempted: false,
      tool_call_attempted: false,
      network_call_attempted: false,
    });
  }
}

function availableMembers(plan: CouncilProviderPlan): CouncilProviderMember[] {
  return CouncilProviderPlanSchema.parse(plan).members.filter(
    (member) => member.availability === "available",
  );
}

function reasonForAvailability(
  memberId: CouncilLiveMemberId,
  availability: CouncilProviderAvailability,
): string | null {
  if (availability === "available") return null;
  if (memberId === "local_smart") {
    return "Local Smart is unavailable until local calibration is complete.";
  }
  return `${memberId} is ${availability}.`;
}

function knownCost(member: CouncilProviderMember | undefined): number {
  if (!member || member.estimated_cost_usd === null) return 0;
  return member.estimated_cost_usd;
}

function sumKnownCosts(members: readonly CouncilProviderMember[]): number {
  return members.reduce((sum, member) => sum + knownCost(member), 0);
}

function roundCost(cost: number): number {
  return Number(cost.toFixed(6));
}

function aliasMap(
  results: readonly CouncilProviderResult[],
): Map<CouncilLiveMemberId, string> {
  const parsed = results.map((result) =>
    CouncilProviderResultSchema.parse(result),
  );
  return new Map(
    parsed.map((result, index) => [
      result.member_id,
      `member_${String.fromCharCode(97 + index)}`,
    ]),
  );
}

function summarizeConfidenceFromResults(
  results: readonly CouncilProviderResult[],
): string {
  const counts = confidenceCounts(results.map((result) => result.confidence));
  return `Confidence high=${counts.high}, medium=${counts.medium}, low=${counts.low}, unknown=${counts.unknown}.`;
}

function summarizeDisagreementFromReviews(
  reviews: readonly CouncilProviderResult[],
): string {
  const caveatCount = reviews.reduce(
    (sum, review) => sum + review.caveats.length,
    0,
  );
  if (reviews.length === 0) return "No peer reviews were produced.";
  if (caveatCount === 0) return "No material disagreements were surfaced.";
  return `${caveatCount} caveat signals surfaced across anonymous peer reviews.`;
}

function confidenceCounts(
  confidences: readonly CouncilConfidence[],
): Record<CouncilConfidence, number> {
  return confidences.reduce<Record<CouncilConfidence, number>>(
    (counts, confidence) => {
      counts[confidence] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0, unknown: 0 },
  );
}

function blockedLiveCouncilRun(
  question: CouncilQuestion,
  plan: CouncilProviderPlan,
  costGate: CouncilCostGateDecision,
): LiveCouncilRun {
  const emptyStage = (stage: z.infer<typeof CouncilStageSchema>) =>
    CouncilDispatchResultSchema.parse({
      stage,
      results: [],
      degraded: true,
      provider_identity_hidden: stage === "review",
      provider_call_attempted: false,
      advisory_only: true,
    });

  return LiveCouncilRunSchema.parse({
    kind: "council.live_run",
    version: LIVE_COUNCIL_REALIZATION_VERSION,
    run_id: `council-live-run:${question.question_id}`,
    status: "blocked",
    question_id: question.question_id,
    final_answer:
      "Live Council dispatch was blocked before provider calls; no advisory final answer was produced.",
    confidence_summary: "Confidence unavailable because dispatch was blocked.",
    disagreement_summary:
      "Disagreement unavailable because anonymous review did not run.",
    council_member_metadata: plan.members.map((member) => ({
      member_id: member.member_id,
      model_id: member.model_id,
      posture: member.posture,
      availability: member.availability,
    })),
    answer_stage: emptyStage("answer"),
    review_stage: emptyStage("review"),
    chairman_stage: emptyStage("chairman"),
    cost_summary: costGate.cost_estimate,
    governance_summary: {
      advisory_only: true,
      opt_in_required: true,
      cost_gate_passed: false,
      no_execution_authority: true,
      no_approval_finalization: true,
      no_tool_calls: true,
      no_default_network_calls: true,
      raw_answer_bodies_written_to_telemetry: false,
    },
  });
}
