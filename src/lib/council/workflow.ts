import { z } from "zod";

export const COUNCIL_WORKFLOW_VERSION = "phase21f.council-workflow.v1" as const;

export const COUNCIL_PROVIDER_CLASSES = [
  "claude",
  "gpt",
  "gemini",
  "deepseek",
  "local_model",
] as const;

export const COUNCIL_CAPABILITIES = [
  "reasoning",
  "critique",
  "risk_review",
  "synthesis_support",
] as const;

export const COUNCIL_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
  "unknown",
] as const;

export const COUNCIL_REVIEW_DECISIONS = [
  "support",
  "challenge",
  "needs_caveat",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const BoundedTextSchema = z.string().trim().min(1).max(1200);
const BoundedShortTextSchema = z.string().trim().min(1).max(260);

export const CouncilProviderClassSchema = z.enum(COUNCIL_PROVIDER_CLASSES);
export const CouncilCapabilitySchema = z.enum(COUNCIL_CAPABILITIES);
export const CouncilConfidenceSchema = z.enum(COUNCIL_CONFIDENCE_LEVELS);
export const CouncilReviewDecisionSchema = z.enum(COUNCIL_REVIEW_DECISIONS);

export const CouncilMemberSchema = z.strictObject({
  member_id: BoundedIdSchema,
  display_name: BoundedShortTextSchema,
  provider_class: CouncilProviderClassSchema,
  capabilities: z.array(CouncilCapabilitySchema).min(1),
  fixture_only: z.literal(true),
  provider_call_attempted: z.literal(false),
});

export const CouncilQuestionSchema = z.strictObject({
  question_id: BoundedIdSchema,
  prompt: BoundedTextSchema,
  task_class: z.enum([
    "general_reasoning",
    "planning",
    "risk_review",
    "comparison",
  ]),
  metadata_only: z.literal(true),
});

export const CouncilResponseSchema = z.strictObject({
  response_id: BoundedIdSchema,
  question_id: BoundedIdSchema,
  member_id: BoundedIdSchema,
  answer_summary: BoundedTextSchema,
  confidence: CouncilConfidenceSchema,
  caveats: z.array(BoundedShortTextSchema),
  metadata: z.strictObject({
    capability_count: z.number().int().nonnegative(),
    fixture_response: z.literal(true),
    provider_call_attempted: z.literal(false),
    model_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
  }),
  advisory_only: z.literal(true),
  execution_attempted: z.literal(false),
});

export const CouncilCouncilRunSchema = z.strictObject({
  run_id: BoundedIdSchema,
  workflow_version: z.literal(COUNCIL_WORKFLOW_VERSION),
  question: CouncilQuestionSchema,
  members: z.array(CouncilMemberSchema).min(1),
  responses: z.array(CouncilResponseSchema),
  advisory_only: z.literal(true),
  provider_call_attempted: z.literal(false),
  execution_attempted: z.literal(false),
});

export const CouncilResponseSummarySchema = z.strictObject({
  response_count: z.number().int().nonnegative(),
  confidence_counts: z.record(
    CouncilConfidenceSchema,
    z.number().int().nonnegative(),
  ),
  caveat_count: z.number().int().nonnegative(),
  advisory_only: z.literal(true),
  provider_call_attempted: z.literal(false),
  execution_attempted: z.literal(false),
});

export const CouncilReviewSchema = z.strictObject({
  review_id: BoundedIdSchema,
  reviewer_alias: BoundedIdSchema,
  subject_response_id: BoundedIdSchema,
  subject_alias: BoundedIdSchema,
  decision: CouncilReviewDecisionSchema,
  critique: BoundedTextSchema,
  provider_identity_hidden: z.literal(true),
  critique_only: z.literal(true),
  advisory_only: z.literal(true),
  execution_attempted: z.literal(false),
});

export const CouncilReviewSummarySchema = z.strictObject({
  review_count: z.number().int().nonnegative(),
  decision_counts: z.record(
    CouncilReviewDecisionSchema,
    z.number().int().nonnegative(),
  ),
  provider_identity_hidden: z.literal(true),
  critique_only: z.literal(true),
  advisory_only: z.literal(true),
  execution_attempted: z.literal(false),
});

export const CouncilFinalAnswerSchema = z.strictObject({
  answer_id: BoundedIdSchema,
  answer_summary: BoundedTextSchema,
  advisory_only: z.literal(true),
  execution_attempted: z.literal(false),
  approval_attempted: z.literal(false),
});

export const CouncilReasoningSummarySchema = z.strictObject({
  confidence_summary: BoundedTextSchema,
  disagreement_summary: BoundedTextSchema,
  response_count: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  advisory_only: z.literal(true),
});

export const CouncilSynthesisSchema = z.strictObject({
  synthesis_id: BoundedIdSchema,
  workflow_version: z.literal(COUNCIL_WORKFLOW_VERSION),
  final_answer: CouncilFinalAnswerSchema,
  reasoning_summary: CouncilReasoningSummarySchema,
  source_response_ids: z.array(BoundedIdSchema),
  source_review_ids: z.array(BoundedIdSchema),
  confidence: CouncilConfidenceSchema,
  advisory_only: z.literal(true),
  provider_call_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  mutation_attempted: z.literal(false),
});

export const CouncilModeCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(COUNCIL_WORKFLOW_VERSION),
  title: z.literal(
    "Council workflow complete through advisory reasoning boundary",
  ),
  status: z.literal("advisory_reasoning_complete"),
  components: z.array(
    z.enum([
      "council_members",
      "council_responses",
      "anonymous_reviews",
      "chairman_synthesis",
    ]),
  ),
  governance: z.strictObject({
    advisory_only: z.literal(true),
    no_provider_model_calls: z.literal(true),
    no_network_calls: z.literal(true),
    no_execution: z.literal(true),
    no_approvals: z.literal(true),
    no_mutations: z.literal(true),
    no_state_changes: z.literal(true),
    no_scheduler_execution: z.literal(true),
    no_inbox_writes: z.literal(true),
    no_file_writes: z.literal(true),
    no_authority_escalation: z.literal(true),
    no_new_authority_surface: z.literal(true),
  }),
  readme_safe_wording: z.array(BoundedShortTextSchema),
  future_work: z.array(BoundedShortTextSchema),
});

export type CouncilProviderClass = z.infer<typeof CouncilProviderClassSchema>;
export type CouncilCapability = z.infer<typeof CouncilCapabilitySchema>;
export type CouncilConfidence = z.infer<typeof CouncilConfidenceSchema>;
export type CouncilReviewDecision = z.infer<typeof CouncilReviewDecisionSchema>;
export type CouncilMember = z.infer<typeof CouncilMemberSchema>;
export type CouncilQuestion = z.infer<typeof CouncilQuestionSchema>;
export type CouncilResponse = z.infer<typeof CouncilResponseSchema>;
export type CouncilCouncilRun = z.infer<typeof CouncilCouncilRunSchema>;
export type CouncilResponseSummary = z.infer<
  typeof CouncilResponseSummarySchema
>;
export type CouncilReview = z.infer<typeof CouncilReviewSchema>;
export type CouncilReviewSummary = z.infer<typeof CouncilReviewSummarySchema>;
export type CouncilFinalAnswer = z.infer<typeof CouncilFinalAnswerSchema>;
export type CouncilReasoningSummary = z.infer<
  typeof CouncilReasoningSummarySchema
>;
export type CouncilSynthesis = z.infer<typeof CouncilSynthesisSchema>;
export type CouncilModeCloseoutReport = z.infer<
  typeof CouncilModeCloseoutReportSchema
>;

export function buildCouncilMemberResponse(input: {
  readonly question: CouncilQuestion;
  readonly member: CouncilMember;
  readonly answer_summary?: string;
  readonly confidence?: CouncilConfidence;
  readonly caveats?: readonly string[];
}): CouncilResponse {
  const question = CouncilQuestionSchema.parse(input.question);
  const member = CouncilMemberSchema.parse(input.member);
  const answerSummary =
    input.answer_summary ??
    `${member.display_name} recommends a bounded advisory answer for ${question.task_class}.`;

  return CouncilResponseSchema.parse({
    response_id: `council-response:${question.question_id}:${member.member_id}`,
    question_id: question.question_id,
    member_id: member.member_id,
    answer_summary: answerSummary,
    confidence: input.confidence ?? defaultConfidence(member),
    caveats: input.caveats?.length
      ? [...input.caveats]
      : ["Fixture response only; no live model participated."],
    metadata: {
      capability_count: member.capabilities.length,
      fixture_response: true,
      provider_call_attempted: false,
      model_call_attempted: false,
      network_call_attempted: false,
    },
    advisory_only: true,
    execution_attempted: false,
  });
}

export function summarizeCouncilResponses(
  responses: readonly CouncilResponse[],
): CouncilResponseSummary {
  const parsed = responses.map((response) =>
    CouncilResponseSchema.parse(response),
  );
  return CouncilResponseSummarySchema.parse({
    response_count: parsed.length,
    confidence_counts: countBy(
      COUNCIL_CONFIDENCE_LEVELS,
      parsed.map((response) => response.confidence),
    ),
    caveat_count: parsed.reduce(
      (sum, response) => sum + response.caveats.length,
      0,
    ),
    advisory_only: true,
    provider_call_attempted: false,
    execution_attempted: false,
  });
}

export function buildCouncilCouncilRun(input: {
  readonly run_id: string;
  readonly question: CouncilQuestion;
  readonly members: readonly CouncilMember[];
  readonly responses?: readonly CouncilResponse[];
}): CouncilCouncilRun {
  const question = CouncilQuestionSchema.parse(input.question);
  const members = input.members.map((member) =>
    CouncilMemberSchema.parse(member),
  );
  const responses =
    input.responses?.map((response) => CouncilResponseSchema.parse(response)) ??
    members.map((member) => buildCouncilMemberResponse({ question, member }));

  return CouncilCouncilRunSchema.parse({
    run_id: input.run_id,
    workflow_version: COUNCIL_WORKFLOW_VERSION,
    question,
    members,
    responses,
    advisory_only: true,
    provider_call_attempted: false,
    execution_attempted: false,
  });
}

export function buildCouncilReview(input: {
  readonly reviewer_alias: string;
  readonly subject_alias: string;
  readonly subject_response: CouncilResponse;
}): CouncilReview {
  const subject = CouncilResponseSchema.parse(input.subject_response);
  const decision = decisionFor(subject);
  return CouncilReviewSchema.parse({
    review_id: `council-review:${input.reviewer_alias}:${input.subject_alias}`,
    reviewer_alias: input.reviewer_alias,
    subject_response_id: `anonymous-subject:${input.subject_alias}`,
    subject_alias: input.subject_alias,
    decision,
    critique: critiqueFor(decision, subject, input.subject_alias),
    provider_identity_hidden: true,
    critique_only: true,
    advisory_only: true,
    execution_attempted: false,
  });
}

export function buildCouncilReviewSet(
  responses: readonly CouncilResponse[],
): CouncilReview[] {
  const parsed = responses
    .map((response) => CouncilResponseSchema.parse(response))
    .sort((left, right) => left.response_id.localeCompare(right.response_id));
  const aliasByResponseId = new Map(
    parsed.map((response, index) => [
      response.response_id,
      `anonymous-response-${index + 1}`,
    ]),
  );

  return parsed.flatMap((reviewer, reviewerIndex) =>
    parsed
      .filter((subject) => subject.response_id !== reviewer.response_id)
      .map((subject) =>
        buildCouncilReview({
          reviewer_alias: `anonymous-reviewer-${reviewerIndex + 1}`,
          subject_alias:
            aliasByResponseId.get(subject.response_id) ?? "anonymous-response",
          subject_response: subject,
        }),
      ),
  );
}

export function summarizeCouncilReviews(
  reviews: readonly CouncilReview[],
): CouncilReviewSummary {
  const parsed = reviews.map((review) => CouncilReviewSchema.parse(review));
  return CouncilReviewSummarySchema.parse({
    review_count: parsed.length,
    decision_counts: countBy(
      COUNCIL_REVIEW_DECISIONS,
      parsed.map((review) => review.decision),
    ),
    provider_identity_hidden: true,
    critique_only: true,
    advisory_only: true,
    execution_attempted: false,
  });
}

export function buildCouncilSynthesis(input: {
  readonly question: CouncilQuestion;
  readonly responses: readonly CouncilResponse[];
  readonly reviews: readonly CouncilReview[];
}): CouncilSynthesis {
  const question = CouncilQuestionSchema.parse(input.question);
  const responses = input.responses.map((response) =>
    CouncilResponseSchema.parse(response),
  );
  const reviews = input.reviews.map((review) =>
    CouncilReviewSchema.parse(review),
  );
  const responseSummary = summarizeCouncilResponses(responses);
  const reviewSummary = summarizeCouncilReviews(reviews);
  const leadingResponses = responses
    .filter(
      (response) =>
        response.confidence === "high" || response.confidence === "medium",
    )
    .slice(0, 2);
  const selectedResponses =
    leadingResponses.length > 0 ? leadingResponses : responses.slice(0, 1);
  const finalText = selectedResponses.length
    ? `Advisory synthesis for ${question.task_class}: ${selectedResponses
        .map((response) => response.answer_summary)
        .join(" ")}`
    : `Advisory synthesis for ${question.task_class}: no responses were available.`;

  return CouncilSynthesisSchema.parse({
    synthesis_id: `council-synthesis:${question.question_id}`,
    workflow_version: COUNCIL_WORKFLOW_VERSION,
    final_answer: {
      answer_id: `council-final-answer:${question.question_id}`,
      answer_summary: finalText.slice(0, 1200),
      advisory_only: true,
      execution_attempted: false,
      approval_attempted: false,
    },
    reasoning_summary: {
      confidence_summary: confidenceSummary(responseSummary),
      disagreement_summary: disagreementSummary(reviewSummary),
      response_count: responses.length,
      review_count: reviews.length,
      advisory_only: true,
    },
    source_response_ids: responses
      .map((response) => response.response_id)
      .sort(),
    source_review_ids: reviews.map((review) => review.review_id).sort(),
    confidence: synthesisConfidence(responseSummary, reviewSummary),
    advisory_only: true,
    provider_call_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    execution_attempted: false,
    mutation_attempted: false,
  });
}

export function summarizeCouncilSynthesis(
  synthesis: CouncilSynthesis,
): CouncilReasoningSummary {
  return CouncilSynthesisSchema.parse(synthesis).reasoning_summary;
}

export function buildCouncilModeCloseoutReport(): CouncilModeCloseoutReport {
  return CouncilModeCloseoutReportSchema.parse({
    closeout_version: COUNCIL_WORKFLOW_VERSION,
    title: "Council workflow complete through advisory reasoning boundary",
    status: "advisory_reasoning_complete",
    components: [
      "council_members",
      "council_responses",
      "anonymous_reviews",
      "chairman_synthesis",
    ],
    governance: {
      advisory_only: true,
      no_provider_model_calls: true,
      no_network_calls: true,
      no_execution: true,
      no_approvals: true,
      no_mutations: true,
      no_state_changes: true,
      no_scheduler_execution: true,
      no_inbox_writes: true,
      no_file_writes: true,
      no_authority_escalation: true,
      no_new_authority_surface: true,
    },
    readme_safe_wording: [
      "Council workflow complete through advisory reasoning boundary.",
      "It supports deterministic council responses, anonymous review, and chairman synthesis without live model calls.",
      "Council Mode is advisory only and cannot approve, execute, mutate, or escalate authority.",
    ],
    future_work: [
      "Real provider participation remains future work.",
      "Live model calls remain future work.",
      "Execution decisions, action approvals, and autonomous reasoning loops remain future work.",
    ],
  });
}

function defaultConfidence(member: CouncilMember): CouncilConfidence {
  if (member.capabilities.includes("risk_review")) return "medium";
  if (member.capabilities.includes("synthesis_support")) return "high";
  return "medium";
}

function countBy<T extends string>(
  keys: readonly T[],
  values: readonly T[],
): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    T,
    number
  >;
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}

function decisionFor(response: CouncilResponse): CouncilReviewDecision {
  if (response.confidence === "low" || response.confidence === "unknown")
    return "challenge";
  if (response.caveats.length > 1) return "needs_caveat";
  return "support";
}

function critiqueFor(
  decision: CouncilReviewDecision,
  response: CouncilResponse,
  subjectAlias: string,
): string {
  if (decision === "challenge") {
    return `Anonymous critique challenges ${subjectAlias} because confidence is ${response.confidence}.`;
  }
  if (decision === "needs_caveat") {
    return `Anonymous critique accepts ${subjectAlias} but asks the chairman to retain caveats.`;
  }
  return `Anonymous critique supports ${subjectAlias} as advisory reasoning.`;
}

function confidenceSummary(summary: CouncilResponseSummary): string {
  return `Confidence distribution: high=${summary.confidence_counts.high}, medium=${summary.confidence_counts.medium}, low=${summary.confidence_counts.low}, unknown=${summary.confidence_counts.unknown}.`;
}

function disagreementSummary(summary: CouncilReviewSummary): string {
  return `Review distribution: support=${summary.decision_counts.support}, challenge=${summary.decision_counts.challenge}, needs_caveat=${summary.decision_counts.needs_caveat}.`;
}

function synthesisConfidence(
  responseSummary: CouncilResponseSummary,
  reviewSummary: CouncilReviewSummary,
): CouncilConfidence {
  if (reviewSummary.decision_counts.challenge > 0) return "medium";
  if (
    responseSummary.confidence_counts.high > 0 &&
    reviewSummary.decision_counts.support > 0
  ) {
    return "high";
  }
  return responseSummary.response_count > 0 ? "medium" : "unknown";
}
