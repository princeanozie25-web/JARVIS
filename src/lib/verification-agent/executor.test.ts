import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  VERIFICATION_AGENT_DEFAULT_VERIFIER_MODEL_ID,
  VerificationAgentResultSchema,
  createVerificationAgentRequest,
  executeVerificationRequest,
  planVerificationRequest,
  type VerificationAgentPlan,
  type VerificationAgentRequest,
  type VerificationAgentVerifier,
  type VerificationAgentVerifierExecutionInput,
} from "./index";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const CREATED_AT = "2026-06-02T10:00:00.000Z";
const RAW_ANSWER_MARKER =
  "raw answer body must not leak into executor telemetry";
const RAW_PROVIDER_MARKER =
  "raw verifier body must not leak into executor telemetry";

function request(
  overrides: Partial<VerificationAgentRequest> = {},
): VerificationAgentRequest {
  return createVerificationAgentRequest({
    kind: "verification_agent.request",
    contract_version: "phase21a.verification-agent.contract.v1",
    request_id: "verification-request:executor",
    original_user_query: {
      query_id: "query:executor",
      task_class: "research",
      query_hash: HASH_A,
      created_at: CREATED_AT,
      metadata_only: true,
      raw_query_included: false,
    },
    primary_answer: {
      answer_id: "answer:executor",
      model_id: "qwen2.5:7b",
      answer_reference_hash: HASH_B,
      answer_summary: "Bounded summary for executor verification.",
      bounded_answer_text: null,
      bounded_answer_text_included: false,
      raw_answer_body_included: false,
      telemetry_metadata_only: true,
    },
    source_metadata: [
      {
        source_id: "source:executor",
        source_type: "document",
        title: "Executor Source",
        content_hash: HASH_A,
        uri_hash: null,
        retrieved_at: CREATED_AT,
        raw_source_body_included: false,
      },
    ],
    verification_requested_at: CREATED_AT,
    cost_governance_required: true,
    metadata_only: true,
    raw_prompt_included: false,
    raw_answer_body_included: false,
    ...overrides,
  });
}

function plan(
  verificationRequest = request(),
  overrides: Record<string, unknown> = {},
): VerificationAgentPlan {
  return planVerificationRequest({
    kind: "verification_agent.planner_input",
    planner_version: "phase21a.verification-agent.planner.v1",
    request: verificationRequest,
    confidence_hints: {
      primary_confidence: "low",
      user_requested_verification: true,
      answer_contains_caveat: false,
    },
    risk_hints: ["unsupported_claim"],
    metadata_only: true,
    raw_answer_body_included: false,
    ...overrides,
  });
}

function executorInput(
  verificationRequest = request(),
  verificationPlan = plan(verificationRequest),
) {
  return {
    kind: "verification_agent.executor_input",
    executor_version: "phase21a.verification-agent.executor.v1",
    request: verificationRequest,
    plan: verificationPlan,
    verifier_model_id: VERIFICATION_AGENT_DEFAULT_VERIFIER_MODEL_ID,
    metadata_only: true,
    raw_prompt_included: false,
    raw_answer_body_included: false,
  };
}

function mockVerifier(
  calls: VerificationAgentVerifierExecutionInput[],
): VerificationAgentVerifier {
  return {
    verifier_model_id: "deepseek-v4-flash",
    verify: async (input) => {
      calls.push(structuredClone(input));
      return {
        verification_status: "verified_with_caveat",
        confidence: "medium",
        caveat: "Verification is advisory and source support is limited.",
        risk_flags: ["insufficient_sources"],
        evidence_notes: [
          "Checked bounded answer metadata against available source metadata.",
        ],
        verifier_model_id: "deepseek-v4-flash",
        estimated_input_tokens: 128,
        estimated_output_tokens: 64,
        raw_verifier_response_included: false,
      };
    },
  };
}

describe("Phase 21A.3 Verification Agent executor", () => {
  it("executes mock verification successfully without rewriting the answer", async () => {
    const calls: VerificationAgentVerifierExecutionInput[] = [];
    const result = await executeVerificationRequest(executorInput(), {
      verifier: mockVerifier(calls),
    });

    expect(VerificationAgentResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      verification_status: "verified_with_caveat",
      confidence: "medium",
      verifier_model_id: "deepseek-v4-flash",
      risk_flags: ["unsupported_claim", "insufficient_sources"],
      advisory_only: true,
      rewrites_primary_answer: false,
      automatic_rewrite_allowed: false,
      creates_autonomous_truth_claim: false,
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_verifier_response_included: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      metadata_only: true,
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_source_bodies_included: false,
      verification_scope: "normal",
    });
  });

  it("fails closed when provider is unavailable", async () => {
    const result = await executeVerificationRequest(executorInput());

    expect(result).toMatchObject({
      verification_status: "failed_closed",
      confidence: "low",
      verifier_model_id: "deepseek-v4-flash",
      caveat:
        "Verification provider is unavailable; result is advisory fail-closed metadata.",
      advisory_only: true,
      rewrites_primary_answer: false,
    });
    expect(result.evidence_notes).toEqual([
      "No verifier provider was injected.",
    ]);
  });

  it("fails closed without provider execution when verification is not required", async () => {
    const verificationRequest = request({
      original_user_query: {
        query_id: "query:no-verification",
        task_class: "general",
        query_hash: HASH_A,
        created_at: CREATED_AT,
        metadata_only: true,
        raw_query_included: false,
      },
    });
    const verificationPlan = planVerificationRequest({
      kind: "verification_agent.planner_input",
      planner_version: "phase21a.verification-agent.planner.v1",
      request: verificationRequest,
      confidence_hints: {
        primary_confidence: "high",
        user_requested_verification: false,
        answer_contains_caveat: true,
      },
      risk_hints: [],
      metadata_only: true,
      raw_answer_body_included: false,
    });
    const calls: VerificationAgentVerifierExecutionInput[] = [];
    const result = await executeVerificationRequest(
      executorInput(verificationRequest, verificationPlan),
      { verifier: mockVerifier(calls) },
    );

    expect(calls).toEqual([]);
    expect(result).toMatchObject({
      verification_status: "failed_closed",
      confidence: "unknown",
      caveat:
        "Verification was skipped because the planner did not require verification.",
      advisory_only: true,
    });
  });

  it("fails closed when injected provider throws or returns invalid output", async () => {
    const throwingVerifier: VerificationAgentVerifier = {
      verifier_model_id: "deepseek-v4-flash",
      verify: async () => {
        throw new Error("provider exploded");
      },
    };
    const invalidVerifier: VerificationAgentVerifier = {
      verifier_model_id: "deepseek-v4-flash",
      verify: async () => ({
        verification_status: "verified",
        confidence: "high",
        caveat: "",
        raw_verifier_response_included: false,
      }),
    };

    await expect(
      executeVerificationRequest(executorInput(), {
        verifier: throwingVerifier,
      }),
    ).resolves.toMatchObject({
      verification_status: "failed_closed",
      confidence: "low",
      evidence_notes: ["Verifier provider threw before returning metadata."],
    });
    await expect(
      executeVerificationRequest(executorInput(), {
        verifier: invalidVerifier,
      }),
    ).resolves.toMatchObject({
      verification_status: "failed_closed",
      confidence: "low",
      evidence_notes: ["Verifier output did not satisfy the contract schema."],
    });
  });

  it("keeps executor telemetry metadata-only and free of raw answer/provider text", async () => {
    const verificationRequest = request({
      primary_answer: {
        answer_id: "answer:bounded",
        model_id: "qwen2.5:7b",
        answer_reference_hash: HASH_B,
        answer_summary: null,
        bounded_answer_text: RAW_ANSWER_MARKER,
        bounded_answer_text_included: true,
        raw_answer_body_included: false,
        telemetry_metadata_only: true,
      },
    });
    const calls: VerificationAgentVerifierExecutionInput[] = [];
    const verifier: VerificationAgentVerifier = {
      verifier_model_id: "deepseek-v4-flash",
      verify: async (input) => {
        calls.push(structuredClone(input));
        return {
          verification_status: "unverified",
          confidence: "low",
          caveat: "The answer needs stronger evidence.",
          risk_flags: ["unsupported_claim"],
          evidence_notes: [RAW_PROVIDER_MARKER],
          verifier_model_id: "deepseek-v4-flash",
          estimated_input_tokens: 20,
          estimated_output_tokens: 10,
          raw_verifier_response_included: false,
        };
      },
    };
    const result = await executeVerificationRequest(
      executorInput(verificationRequest, plan(verificationRequest)),
      { verifier },
    );
    const telemetryJson = JSON.stringify(result.telemetry_metadata);

    expect(calls[0]?.bounded_answer_text).toBe(RAW_ANSWER_MARKER);
    expect(result.telemetry_metadata).toMatchObject({
      metadata_only: true,
      redaction_status: "metadata_only",
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_verifier_response_included: false,
      bounded_answer_text_retained: false,
      raw_source_bodies_included: false,
    });
    expect(telemetryJson).not.toContain(RAW_ANSWER_MARKER);
    expect(telemetryJson).not.toContain(RAW_PROVIDER_MARKER);
  });
});

describe("Phase 21A.3 Verification Agent executor governance tripwires", () => {
  it("keeps the executor free of direct network, model runtime, and provider imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/verification-agent/executor.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'].*(?:models|provider|deepseek|runtime)|createModelRuntime|createDeepSeek|loadDefaultModelRegistry|fetch\s*\(|globalThis\.fetch/,
    );
    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|child_process)\b/,
    );
  });
});
