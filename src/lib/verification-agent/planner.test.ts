import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  VERIFICATION_AGENT_EVIDENCE_REQUIREMENTS,
  VERIFICATION_AGENT_INTENSITIES,
  VERIFICATION_AGENT_SCOPES,
  VerificationAgentPlanSchema,
  createVerificationAgentRequest,
  planVerificationRequest,
  type VerificationAgentRequest,
} from "./index";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const CREATED_AT = "2026-06-02T10:00:00.000Z";
const RAW_ANSWER_MARKER =
  "raw answer body should never appear in planner telemetry";

function request(
  overrides: Partial<VerificationAgentRequest> = {},
): VerificationAgentRequest {
  return createVerificationAgentRequest({
    kind: "verification_agent.request",
    contract_version: "phase21a.verification-agent.contract.v1",
    request_id: "verification-request:planner",
    original_user_query: {
      query_id: "query:planner",
      task_class: "general",
      query_hash: HASH_A,
      created_at: CREATED_AT,
      metadata_only: true,
      raw_query_included: false,
    },
    primary_answer: {
      answer_id: "answer:planner",
      model_id: "qwen2.5:7b",
      answer_reference_hash: HASH_B,
      answer_summary: "Bounded answer summary for planner tests.",
      bounded_answer_text: null,
      bounded_answer_text_included: false,
      raw_answer_body_included: false,
      telemetry_metadata_only: true,
    },
    source_metadata: [
      {
        source_id: "source:planner",
        source_type: "document",
        title: "Planner Source",
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

function plannerInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "verification_agent.planner_input",
    planner_version: "phase21a.verification-agent.planner.v1",
    request: request(),
    confidence_hints: {
      primary_confidence: "high",
      user_requested_verification: false,
      answer_contains_caveat: true,
    },
    risk_hints: [],
    metadata_only: true,
    raw_answer_body_included: false,
    ...overrides,
  };
}

describe("Phase 21A.2 Verification Agent planner", () => {
  it("plans no verification for low-risk high-confidence metadata", () => {
    const plan = planVerificationRequest(plannerInput());

    expect(VerificationAgentPlanSchema.parse(plan)).toEqual(plan);
    expect(plan).toMatchObject({
      verification_required: false,
      verification_scope: "none",
      verification_intensity: "low",
      expected_confidence: "unknown",
      evidence_requirements: [],
      risk_flags: [],
      estimated_cost_band: "none",
      advisory_only: true,
      answer_rewrite_allowed: false,
      creates_truth_claim: false,
      model_call_attempted: false,
      provider_call_attempted: false,
      write_attempted: false,
      metadata_only: true,
      raw_answer_body_included: false,
    });
  });

  it("supports the required scope, intensity, and evidence models", () => {
    expect(VERIFICATION_AGENT_SCOPES).toEqual([
      "none",
      "light",
      "normal",
      "deep",
    ]);
    expect(VERIFICATION_AGENT_INTENSITIES).toEqual(["low", "medium", "high"]);
    expect(VERIFICATION_AGENT_EVIDENCE_REQUIREMENTS).toEqual([
      "source_presence",
      "source_consistency",
      "date_freshness",
      "answer_consistency",
      "model_crosscheck",
    ]);
  });

  it("escalates safety-sensitive high-stakes answers to deep verification", () => {
    const plan = planVerificationRequest(
      plannerInput({
        request: request({
          original_user_query: {
            query_id: "query:medical",
            task_class: "medical",
            query_hash: HASH_A,
            created_at: CREATED_AT,
            metadata_only: true,
            raw_query_included: false,
          },
        }),
        confidence_hints: {
          primary_confidence: "high",
          user_requested_verification: false,
          answer_contains_caveat: false,
        },
      }),
    );

    expect(plan).toMatchObject({
      verification_required: true,
      verification_scope: "deep",
      verification_intensity: "high",
      estimated_cost_band: "high",
      risk_flags: ["overconfident_answer", "safety_sensitive"],
      evidence_requirements: [
        "source_presence",
        "source_consistency",
        "answer_consistency",
        "model_crosscheck",
      ],
    });
  });

  it("escalates current-events answers for freshness verification", () => {
    const plan = planVerificationRequest(
      plannerInput({
        request: request({
          original_user_query: {
            query_id: "query:current-events",
            task_class: "current_events",
            query_hash: HASH_A,
            created_at: CREATED_AT,
            metadata_only: true,
            raw_query_included: false,
          },
        }),
      }),
    );

    expect(plan).toMatchObject({
      verification_required: true,
      verification_scope: "normal",
      verification_intensity: "medium",
      risk_flags: ["outdated_information"],
      evidence_requirements: expect.arrayContaining(["date_freshness"]),
    });
  });

  it("escalates missing-source and low-confidence answers deterministically", () => {
    const input = plannerInput({
      request: request({
        source_metadata: [],
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
      }),
      confidence_hints: {
        primary_confidence: "low",
        user_requested_verification: false,
        answer_contains_caveat: false,
      },
    });
    const firstPlan = planVerificationRequest(input);
    const secondPlan = planVerificationRequest(input);

    expect(firstPlan).toEqual(secondPlan);
    expect(firstPlan).toMatchObject({
      verification_required: true,
      verification_scope: "deep",
      verification_intensity: "high",
      expected_confidence: "high",
      risk_flags: ["unsupported_claim", "insufficient_sources"],
      evidence_requirements: expect.arrayContaining([
        "source_presence",
        "source_consistency",
        "answer_consistency",
        "model_crosscheck",
      ]),
    });
  });

  it("keeps planner telemetry metadata-only and free of raw answer text", () => {
    const plan = planVerificationRequest(
      plannerInput({
        request: request({
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
        }),
        risk_hints: ["model_disagreement"],
      }),
    );
    const telemetryJson = JSON.stringify(plan.telemetry_metadata);

    expect(plan.telemetry_metadata).toMatchObject({
      metadata_only: true,
      redaction_status: "metadata_only",
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_verifier_response_included: false,
      raw_source_bodies_included: false,
    });
    expect(telemetryJson).not.toContain(RAW_ANSWER_MARKER);
  });
});

describe("Phase 21A.2 Verification Agent planner governance tripwires", () => {
  it("keeps the planner free of model/provider execution imports and write paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/verification-agent/planner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'].*(?:models|provider|deepseek|runtime)|createModelRuntime|createDeepSeek|loadDefaultModelRegistry|\.execute\s*\(|\.complete\s*\(|fetch\s*\(|globalThis\.fetch/,
    );
    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|child_process)\b/,
    );
  });
});
