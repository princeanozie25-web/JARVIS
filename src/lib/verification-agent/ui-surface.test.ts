import { describe, expect, it } from "vitest";

import {
  VERIFICATION_AGENT_CONFIDENCE_TONES,
  VERIFICATION_AGENT_UI_STATES,
  VerificationConfidenceSurfaceViewModelSchema,
  createSkippedVerificationConfidenceSurfaceViewModel,
  createUnavailableVerificationConfidenceSurfaceViewModel,
  createVerificationAgentRequest,
  createVerificationAgentResult,
  createVerificationConfidenceSurfaceViewModel,
  createVerificationConfidenceSurfaceViewModelFromResult,
} from "./index";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const CREATED_AT = "2026-06-02T10:00:00.000Z";
const RAW_ANSWER_MARKER = "raw answer body must not enter ui view model";

function verificationRequest() {
  return createVerificationAgentRequest({
    kind: "verification_agent.request",
    contract_version: "phase21a.verification-agent.contract.v1",
    request_id: "verification-request:ui",
    original_user_query: {
      query_id: "query:ui",
      task_class: "research",
      query_hash: HASH_A,
      created_at: CREATED_AT,
      metadata_only: true,
      raw_query_included: false,
    },
    primary_answer: {
      answer_id: "answer:ui",
      model_id: "qwen2.5:7b",
      answer_reference_hash: HASH_B,
      answer_summary: null,
      bounded_answer_text: RAW_ANSWER_MARKER,
      bounded_answer_text_included: true,
      raw_answer_body_included: false,
      telemetry_metadata_only: true,
    },
    source_metadata: [],
    verification_requested_at: CREATED_AT,
    cost_governance_required: true,
    metadata_only: true,
    raw_prompt_included: false,
    raw_answer_body_included: false,
  });
}

describe("Phase 21A.5 Verification confidence surface view model", () => {
  it("supports the required states and confidence tones", () => {
    expect(VERIFICATION_AGENT_UI_STATES).toEqual([
      "unverified",
      "verified",
      "unavailable",
      "skipped",
      "failed",
    ]);
    expect(VERIFICATION_AGENT_CONFIDENCE_TONES).toEqual([
      "success",
      "caution",
      "danger",
      "neutral",
      "unavailable",
    ]);
  });

  it("creates metadata-only view models with advisory labels", () => {
    const model = createVerificationConfidenceSurfaceViewModel({
      state: "unverified",
      confidence: "low",
      caveat: "The verifier found weak support.",
      risk_flags: ["unsupported_claim", "model_disagreement"],
    });

    expect(VerificationConfidenceSurfaceViewModelSchema.parse(model)).toEqual(
      model,
    );
    expect(model).toMatchObject({
      state: "unverified",
      confidence_label: "low confidence",
      confidence_tone: "danger",
      advisory_label: "Advisory verification metadata",
      truth_claim_label: "Not a source of truth",
      metadata_only: true,
      raw_prompt_included: false,
      raw_answer_body_included: false,
      raw_verifier_response_included: false,
      execution_controls_visible: false,
      approval_controls_visible: false,
    });
    expect(model.risk_badges.map((badge) => badge.flag)).toEqual([
      "unsupported_claim",
      "model_disagreement",
    ]);
  });

  it("maps verification results to safe UI states without raw answer leakage", () => {
    const result = createVerificationAgentResult({
      request: verificationRequest(),
      verification_id: "verification:ui",
      verification_status: "failed_closed",
      confidence: "low",
      caveat: "Verifier failed closed.",
      risk_flags: ["insufficient_sources"],
      evidence_notes: ["Provider unavailable."],
      verifier_model_id: "deepseek-v4-flash",
    });
    const model =
      createVerificationConfidenceSurfaceViewModelFromResult(result);
    const json = JSON.stringify(model);

    expect(model).toMatchObject({
      state: "failed",
      confidence_tone: "danger",
      caveat: "Verifier failed closed.",
    });
    expect(json).not.toContain(RAW_ANSWER_MARKER);
  });

  it("creates unavailable and skipped state models", () => {
    expect(
      createUnavailableVerificationConfidenceSurfaceViewModel(),
    ).toMatchObject({
      state: "unavailable",
      confidence: "unknown",
      confidence_tone: "unavailable",
    });
    expect(createSkippedVerificationConfidenceSurfaceViewModel()).toMatchObject(
      {
        state: "skipped",
        confidence: "unknown",
        confidence_tone: "unavailable",
      },
    );
  });
});
