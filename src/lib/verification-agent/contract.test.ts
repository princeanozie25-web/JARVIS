import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  VERIFICATION_AGENT_CONFIDENCE_LEVELS,
  VERIFICATION_AGENT_RISK_FLAGS,
  VERIFICATION_AGENT_STATUSES,
  VERIFICATION_AGENT_UI_RENDER_TARGETS,
  VerificationAgentRequestSchema,
  VerificationAgentResultSchema,
  createVerificationAgentRequest,
  createVerificationAgentResult,
  type VerificationAgentRequest,
} from "./index";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const CREATED_AT = "2026-06-02T10:00:00.000Z";
const RAW_ANSWER_MARKER = "raw answer body must never enter telemetry";
const RAW_VERIFIER_MARKER = "raw verifier response must never enter telemetry";

function request(
  overrides: Partial<VerificationAgentRequest> = {},
): VerificationAgentRequest {
  return createVerificationAgentRequest({
    kind: "verification_agent.request",
    contract_version: "phase21a.verification-agent.contract.v1",
    request_id: "verification-request:alpha",
    original_user_query: {
      query_id: "query:alpha",
      task_class: "research",
      query_hash: HASH_A,
      created_at: CREATED_AT,
      metadata_only: true,
      raw_query_included: false,
    },
    primary_answer: {
      answer_id: "answer:alpha",
      model_id: "qwen2.5:7b",
      answer_reference_hash: HASH_B,
      answer_summary: "A bounded answer summary for verification.",
      bounded_answer_text: null,
      bounded_answer_text_included: false,
      raw_answer_body_included: false,
      telemetry_metadata_only: true,
    },
    source_metadata: [
      {
        source_id: "source:alpha",
        source_type: "document",
        title: "Alpha Source",
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

describe("Phase 21A.1 Verification Agent contract", () => {
  it("validates request and result schemas for advisory answer verification", () => {
    const verificationRequest = request();
    const result = createVerificationAgentResult({
      request: verificationRequest,
      verification_id: "verification:alpha",
      verification_status: "verified_with_caveat",
      confidence: "medium",
      caveat: "The answer is plausible but relies on one source.",
      risk_flags: ["insufficient_sources", "overconfident_answer"],
      evidence_notes: ["Source metadata exists but corroboration is limited."],
      verifier_model_id: "deepseek-v4-flash",
      cost_estimate: {
        estimated_input_tokens: 120,
        estimated_output_tokens: 60,
      },
    });

    expect(VerificationAgentRequestSchema.parse(verificationRequest)).toEqual(
      verificationRequest,
    );
    expect(VerificationAgentResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      kind: "verification_agent.result",
      verification_status: "verified_with_caveat",
      confidence: "medium",
      verifier_model_id: "deepseek-v4-flash",
      advisory_only: true,
      rewrites_primary_answer: false,
      automatic_rewrite_allowed: false,
      creates_autonomous_truth_claim: false,
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_verifier_response_included: false,
    });
  });

  it("supports the required confidence levels and typed risk flags", () => {
    expect(VERIFICATION_AGENT_CONFIDENCE_LEVELS).toEqual([
      "high",
      "medium",
      "low",
      "unknown",
    ]);
    expect(VERIFICATION_AGENT_RISK_FLAGS).toEqual(
      expect.arrayContaining([
        "unsupported_claim",
        "outdated_information",
        "insufficient_sources",
        "overconfident_answer",
        "safety_sensitive",
        "conflicting_context",
        "model_disagreement",
      ]),
    );
    expect(VERIFICATION_AGENT_STATUSES).toContain("failed_closed");

    const result = createVerificationAgentResult({
      request: request(),
      verification_id: "verification:risk-flags",
      verification_status: "needs_human_review",
      confidence: "unknown",
      caveat: "The verifier cannot establish enough support.",
      risk_flags: [
        "unsupported_claim",
        "outdated_information",
        "safety_sensitive",
        "model_disagreement",
      ],
      verifier_model_id: "deepseek-v4-flash",
    });

    expect(result.risk_flags).toEqual([
      "unsupported_claim",
      "outdated_information",
      "safety_sensitive",
      "model_disagreement",
    ]);
    expect(
      VerificationAgentResultSchema.safeParse({
        ...result,
        risk_flags: ["not_a_real_flag"],
      }).success,
    ).toBe(false);
  });

  it("requires confidence and caveat in verifier output", () => {
    const result = createVerificationAgentResult({
      request: request(),
      verification_id: "verification:required-fields",
      verification_status: "verified",
      confidence: "high",
      caveat: "No material caveat beyond available source limits.",
      verifier_model_id: "deepseek-v4-flash",
    });

    expect(
      VerificationAgentResultSchema.safeParse({
        ...result,
        confidence: undefined,
      }).success,
    ).toBe(false);
    expect(
      VerificationAgentResultSchema.safeParse({
        ...result,
        caveat: "",
      }).success,
    ).toBe(false);
  });

  it("accepts bounded answer text but keeps raw bodies out of telemetry", () => {
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
    const result = createVerificationAgentResult({
      request: verificationRequest,
      verification_id: "verification:telemetry",
      verification_status: "unverified",
      confidence: "low",
      caveat: "The bounded answer text needs stronger support.",
      risk_flags: ["unsupported_claim"],
      evidence_notes: [RAW_VERIFIER_MARKER],
      verifier_model_id: "deepseek-v4-flash",
    });
    const telemetryJson = JSON.stringify(result.telemetry_metadata);

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
    expect(telemetryJson).not.toContain(RAW_VERIFIER_MARKER);
  });

  it("models Command Center render metadata without implementing UI", () => {
    const result = createVerificationAgentResult({
      request: request(),
      verification_id: "verification:ui",
      verification_status: "conflicting",
      confidence: "low",
      caveat: "Sources conflict on the key claim.",
      risk_flags: ["conflicting_context", "insufficient_sources"],
      verifier_model_id: "deepseek-v4-flash",
    });

    expect(VERIFICATION_AGENT_UI_RENDER_TARGETS).toEqual([
      "confidence_chip",
      "caveat_tooltip",
      "risk_flag_badges",
    ]);
    expect(result.ui_contract).toMatchObject({
      render_targets: ["confidence_chip", "caveat_tooltip", "risk_flag_badges"],
      confidence_chip: {
        visible: true,
        confidence: "low",
        advisory: true,
      },
      caveat_tooltip: {
        visible: true,
        hidden_from_ui: false,
      },
      risk_flag_badges: [
        { flag: "conflicting_context", visible: true },
        { flag: "insufficient_sources", visible: true },
      ],
    });
  });

  it("rejects missing answer summary and missing bounded answer text", () => {
    expect(() =>
      request({
        primary_answer: {
          answer_id: "answer:missing-text",
          model_id: "qwen2.5:7b",
          answer_reference_hash: HASH_B,
          answer_summary: null,
          bounded_answer_text: null,
          bounded_answer_text_included: false,
          raw_answer_body_included: false,
          telemetry_metadata_only: true,
        },
      }),
    ).toThrow(/answer summary or bounded answer text/);
  });
});

describe("Phase 21A.1 Verification Agent governance tripwires", () => {
  it("keeps the contract free of model/provider execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/verification-agent/contract.ts"),
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
