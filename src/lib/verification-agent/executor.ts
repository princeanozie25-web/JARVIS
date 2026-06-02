import { z } from "zod";

import {
  VerificationAgentConfidenceSchema,
  VerificationAgentRequestSchema,
  VerificationAgentResultSchema,
  VerificationAgentRiskFlagSchema,
  VerificationAgentStatusSchema,
  createVerificationAgentResult,
  type VerificationAgentConfidence,
  type VerificationAgentRequest,
  type VerificationAgentResult,
  type VerificationAgentRiskFlag,
  type VerificationAgentStatus,
} from "./contract";
import {
  VerificationAgentPlanSchema,
  type VerificationAgentPlan,
} from "./planner";

export const VERIFICATION_AGENT_EXECUTOR_VERSION =
  "phase21a.verification-agent.executor.v1" as const;

export const VERIFICATION_AGENT_DEFAULT_VERIFIER_MODEL_ID =
  "deepseek-v4-flash" as const;

export const VERIFICATION_AGENT_EXECUTOR_FAILURE_REASONS = [
  "verification_not_required",
  "provider_unavailable",
  "provider_failed",
  "provider_output_invalid",
] as const;

export const VerificationAgentExecutorFailureReasonSchema = z.enum(
  VERIFICATION_AGENT_EXECUTOR_FAILURE_REASONS,
);

export const VerificationAgentExecutorInputSchema = z.strictObject({
  kind: z.literal("verification_agent.executor_input"),
  executor_version: z.literal(VERIFICATION_AGENT_EXECUTOR_VERSION),
  request: VerificationAgentRequestSchema,
  plan: VerificationAgentPlanSchema,
  verifier_model_id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default(VERIFICATION_AGENT_DEFAULT_VERIFIER_MODEL_ID),
  metadata_only: z.literal(true),
  raw_prompt_included: z.literal(false),
  raw_answer_body_included: z.literal(false),
});

export const VerificationAgentVerifierOutputSchema = z.strictObject({
  verification_status: VerificationAgentStatusSchema,
  confidence: VerificationAgentConfidenceSchema,
  caveat: z.string().trim().min(1).max(800),
  risk_flags: z.array(VerificationAgentRiskFlagSchema).default([]),
  evidence_notes: z.array(z.string().trim().min(1).max(500)).default([]),
  verifier_model_id: z.string().trim().min(1).max(120).optional(),
  estimated_input_tokens: z.number().int().nonnegative().default(0),
  estimated_output_tokens: z.number().int().nonnegative().default(0),
  raw_verifier_response_included: z.literal(false),
});

export type VerificationAgentExecutorFailureReason = z.infer<
  typeof VerificationAgentExecutorFailureReasonSchema
>;
export type VerificationAgentExecutorInput = z.infer<
  typeof VerificationAgentExecutorInputSchema
>;
export type VerificationAgentVerifierOutput = z.infer<
  typeof VerificationAgentVerifierOutputSchema
>;

export interface VerificationAgentVerifierExecutionInput {
  readonly request_id: string;
  readonly query_id: string;
  readonly answer_id: string;
  readonly task_class: string;
  readonly answer_summary: string | null;
  readonly bounded_answer_text: string | null;
  readonly source_count: number;
  readonly verification_scope: VerificationAgentPlan["verification_scope"];
  readonly verification_intensity: VerificationAgentPlan["verification_intensity"];
  readonly evidence_requirements: VerificationAgentPlan["evidence_requirements"];
  readonly risk_flags: VerificationAgentPlan["risk_flags"];
  readonly metadata_only: true;
  readonly raw_prompt_included: false;
  readonly raw_answer_body_included: false;
  readonly raw_source_bodies_included: false;
}

export interface VerificationAgentVerifier {
  readonly verifier_model_id: string;
  verify(
    input: VerificationAgentVerifierExecutionInput,
  ): Promise<VerificationAgentVerifierOutput | unknown>;
}

export interface ExecuteVerificationRequestDependencies {
  readonly verifier?: VerificationAgentVerifier;
}

export async function executeVerificationRequest(
  input: unknown,
  dependencies: ExecuteVerificationRequestDependencies = {},
): Promise<VerificationAgentResult> {
  const parsed = VerificationAgentExecutorInputSchema.parse(input);
  const request = parsed.request;
  const plan = parsed.plan;
  const verifierModelId =
    dependencies.verifier?.verifier_model_id ?? parsed.verifier_model_id;

  if (!plan.verification_required) {
    return failClosedResult({
      request,
      plan,
      verifierModelId,
      reason: "verification_not_required",
      caveat:
        "Verification was skipped because the planner did not require verification.",
      evidenceNote: "No verifier provider call was attempted.",
    });
  }

  if (!dependencies.verifier) {
    return failClosedResult({
      request,
      plan,
      verifierModelId,
      reason: "provider_unavailable",
      caveat:
        "Verification provider is unavailable; result is advisory fail-closed metadata.",
      evidenceNote: "No verifier provider was injected.",
    });
  }

  try {
    const output = await dependencies.verifier.verify(
      verifierInputFor(request, plan),
    );
    const parsedOutput =
      VerificationAgentVerifierOutputSchema.safeParse(output);
    if (!parsedOutput.success) {
      return failClosedResult({
        request,
        plan,
        verifierModelId,
        reason: "provider_output_invalid",
        caveat:
          "Verifier provider returned invalid metadata; verification failed closed.",
        evidenceNote: "Verifier output did not satisfy the contract schema.",
      });
    }

    return successResult({
      request,
      plan,
      output: parsedOutput.data,
      verifierModelId:
        parsedOutput.data.verifier_model_id ??
        dependencies.verifier.verifier_model_id,
    });
  } catch {
    return failClosedResult({
      request,
      plan,
      verifierModelId,
      reason: "provider_failed",
      caveat:
        "Verifier provider failed during execution; verification failed closed.",
      evidenceNote: "Verifier provider threw before returning metadata.",
    });
  }
}

function successResult(input: {
  readonly request: VerificationAgentRequest;
  readonly plan: VerificationAgentPlan;
  readonly output: VerificationAgentVerifierOutput;
  readonly verifierModelId: string;
}): VerificationAgentResult {
  return VerificationAgentResultSchema.parse(
    createVerificationAgentResult({
      request: input.request,
      verification_id: verificationIdFor(input.request),
      verification_status: input.output.verification_status,
      confidence: input.output.confidence,
      caveat: input.output.caveat,
      risk_flags: mergeRiskFlags(
        input.plan.risk_flags,
        input.output.risk_flags,
      ),
      evidence_notes: input.output.evidence_notes,
      verifier_model_id: input.verifierModelId,
      cost_estimate: {
        verifier_model_id: input.verifierModelId,
        provider_kind: "injected_verifier",
        estimated_input_tokens: input.output.estimated_input_tokens,
        estimated_output_tokens: input.output.estimated_output_tokens,
      },
    }),
  );
}

function failClosedResult(input: {
  readonly request: VerificationAgentRequest;
  readonly plan: VerificationAgentPlan;
  readonly verifierModelId: string;
  readonly reason: VerificationAgentExecutorFailureReason;
  readonly caveat: string;
  readonly evidenceNote: string;
}): VerificationAgentResult {
  const confidence = confidenceForFailure(input.reason);
  const status = statusForFailure(input.reason);

  return VerificationAgentResultSchema.parse(
    createVerificationAgentResult({
      request: input.request,
      verification_id: verificationIdFor(input.request),
      verification_status: status,
      confidence,
      caveat: input.caveat,
      risk_flags: input.plan.risk_flags,
      evidence_notes: [input.evidenceNote],
      verifier_model_id: input.verifierModelId,
      cost_estimate: {
        verifier_model_id: input.verifierModelId,
        provider_kind: "injected_verifier",
        estimated_input_tokens: 0,
        estimated_output_tokens: 0,
      },
    }),
  );
}

function verifierInputFor(
  request: VerificationAgentRequest,
  plan: VerificationAgentPlan,
): VerificationAgentVerifierExecutionInput {
  return {
    request_id: request.request_id,
    query_id: request.original_user_query.query_id,
    answer_id: request.primary_answer.answer_id,
    task_class: request.original_user_query.task_class,
    answer_summary: request.primary_answer.answer_summary,
    bounded_answer_text: request.primary_answer.bounded_answer_text,
    source_count: request.source_metadata.length,
    verification_scope: plan.verification_scope,
    verification_intensity: plan.verification_intensity,
    evidence_requirements: plan.evidence_requirements,
    risk_flags: plan.risk_flags,
    metadata_only: true,
    raw_prompt_included: false,
    raw_answer_body_included: false,
    raw_source_bodies_included: false,
  };
}

function verificationIdFor(request: VerificationAgentRequest): string {
  return `verification:${request.request_id.replace(/[^a-z0-9]+/g, ".")}`;
}

function statusForFailure(
  reason: VerificationAgentExecutorFailureReason,
): VerificationAgentStatus {
  if (reason === "verification_not_required") return "failed_closed";
  return "failed_closed";
}

function confidenceForFailure(
  reason: VerificationAgentExecutorFailureReason,
): VerificationAgentConfidence {
  if (reason === "verification_not_required") return "unknown";
  return "low";
}

function mergeRiskFlags(
  planned: readonly VerificationAgentRiskFlag[],
  verifier: readonly VerificationAgentRiskFlag[],
): VerificationAgentRiskFlag[] {
  const merged = new Set<VerificationAgentRiskFlag>([...planned, ...verifier]);
  return [
    "unsupported_claim",
    "outdated_information",
    "insufficient_sources",
    "overconfident_answer",
    "safety_sensitive",
    "conflicting_context",
    "model_disagreement",
  ].filter((flag): flag is VerificationAgentRiskFlag =>
    merged.has(flag as VerificationAgentRiskFlag),
  );
}
