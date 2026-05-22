import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_FALLBACK_FEATURE_FLAGS,
  VISION_FALLBACK_DISABLED_FEATURES,
  VisionFallbackDecisionRecordSchema,
  createVisionFallbackReplayStep,
  createVisionFallbackTelemetryEvent,
  createVisionFrameDescriptor,
  createVisionObservation,
  createVisionProviderResult,
  evaluateVisionFallback,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OUTPUT_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function providerResult(confidence: number | null) {
  return createVisionProviderResult({
    frame_id: "frame:fallback",
    vision_session_id: "vision-session:fallback",
    provider_id: "yolo_v8n",
    capability: "object_detection",
    result_class: "object_detection_summary",
    confidence,
    output_hash: OUTPUT_HASH,
    detected_count: 1,
    summary_count: null,
    redaction_status: "hash_only",
  });
}

function observation(options: { confidence: number | null; stale?: boolean }) {
  const frame = createVisionFrameDescriptor({
    frame_id: "frame:fallback",
    vision_session_id: "vision-session:fallback",
    source_type: "uploaded_image",
    input_hash: INPUT_HASH,
    observed_at: 1_000,
    received_at: options.stale ? 8_500 : 1_100,
    stale_after_ms: 5_000,
  });
  return createVisionObservation({
    observation_id: "observation:fallback",
    frame_descriptor: frame,
    provider_result: providerResult(options.confidence),
  });
}

const enabledMetadataPolicy = {
  cloud_fallback_enabled: true,
  allow_metadata_only_fallback: true,
  require_user_consent: true,
};

describe("Phase 7F vision fallback governance", () => {
  it("does not need fallback when confidence is sufficient", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.91),
      observation: observation({ confidence: 0.91 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });

    expect(decision).toMatchObject({
      reason: "not_needed",
      decision: "not_needed",
      confidence_band: "high",
      metadata_only: true,
      raw_payload_transferred: false,
      text_payload_transferred: false,
      provider_executed: false,
      cloud_called: false,
      approval_granted: false,
      action_executed: false,
    });
  });

  it("low confidence requires consent when policy permits cloud but consent is missing", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.32),
      observation: observation({ confidence: 0.32 }),
      cloud_enabled: true,
      consent_state: "missing",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });

    expect(decision).toMatchObject({
      reason: "user_consent_required",
      decision: "requires_user_consent",
      confidence_band: "low",
      cloud_called: false,
      approval_granted: false,
    });
  });

  it("low confidence can become eligible metadata-only when policy, consent, and budget permit", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.51),
      observation: observation({ confidence: 0.51 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });

    expect(decision).toMatchObject({
      reason: "low_confidence",
      decision: "eligible_metadata_only",
      confidence_band: "medium",
      input_hash: INPUT_HASH,
      output_hash: OUTPUT_HASH,
      raw_payload_transferred: false,
      cloud_called: false,
    });
  });

  it("blocks fallback when cloud is disabled by runtime flag or policy", () => {
    const runtimeBlocked = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.25),
      observation: observation({ confidence: 0.25 }),
      cloud_enabled: false,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });
    const policyBlocked = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.25),
      observation: observation({ confidence: 0.25 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
    });

    expect(runtimeBlocked).toMatchObject({
      reason: "policy_blocked",
      decision: "blocked_by_policy",
      cloud_called: false,
    });
    expect(policyBlocked).toMatchObject({
      reason: "policy_blocked",
      decision: "blocked_by_policy",
      cloud_called: false,
    });
  });

  it("blocks fallback when budget is blocked", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.25),
      observation: observation({ confidence: 0.25 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "blocked",
      policy: enabledMetadataPolicy,
    });

    expect(decision).toMatchObject({
      reason: "budget_blocked",
      decision: "denied",
      cloud_called: false,
      action_executed: false,
    });
  });

  it("denies stale observations instead of treating them as current truth", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.2),
      observation: observation({ confidence: 0.2, stale: true }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });

    expect(decision).toMatchObject({
      reason: "stale_frame",
      decision: "denied",
      stale: true,
      cloud_called: false,
    });
  });

  it("rejects raw payload, OCR, screen, file, base64, and blob transfer fields", () => {
    const unsafe = {
      ...evaluateVisionFallback({
        requested_capability: "object_detection",
        provider_result: providerResult(0.5),
        observation: observation({ confidence: 0.5 }),
        cloud_enabled: true,
        consent_state: "granted",
        budget_state: "available",
        policy: enabledMetadataPolicy,
      }),
      raw_frame: "frame bytes",
      raw_image: "image bytes",
      ocr_text: "private OCR text",
      screen_contents: "private screen contents",
      file_path: "C:/Users/person/frame.png",
      base64: "data:image/png;base64,private",
      blob: "opaque blob payload",
    };

    expect(VisionFallbackDecisionRecordSchema.safeParse(unsafe).success).toBe(
      false,
    );
  });

  it("keeps telemetry and replay metadata-only", () => {
    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.45),
      observation: observation({ confidence: 0.45 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });
    const event = createVisionFallbackTelemetryEvent(decision);
    const step = createVisionFallbackReplayStep(decision);

    expect(event).toEqual({
      event_type: "vision_fallback_evaluated",
      requested_capability: "object_detection",
      reason: "low_confidence",
      decision: "eligible_metadata_only",
      confidence_band: "medium",
      provider_result_class: "object_detection_summary",
      observation_class: "object_presence",
      stale_count: 0,
      metadata_only: true,
      counts_and_classes_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      hashes_included: false,
      provider_executed: false,
      cloud_called: false,
      approval_granted: false,
      action_executed: false,
    });
    expect(step).toMatchObject({
      reason: "low_confidence",
      decision: "eligible_metadata_only",
      input_hash: INPUT_HASH,
      output_hash: OUTPUT_HASH,
      metadata_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(JSON.stringify(event)).not.toContain(INPUT_HASH);
    expect(JSON.stringify(event)).not.toContain("private OCR text");
    expect(JSON.stringify(step)).not.toContain("private OCR text");
  });

  it("keeps cloud, network, providers, payload transfer, approvals, actions, and jobs disabled", () => {
    expect(Object.keys(DEFAULT_VISION_FALLBACK_FEATURE_FLAGS).sort()).toEqual(
      [...VISION_FALLBACK_DISABLED_FEATURES].sort(),
    );
    for (const feature of VISION_FALLBACK_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_FALLBACK_FEATURE_FLAGS[feature]).toBe(false);
    }

    const decision = evaluateVisionFallback({
      requested_capability: "object_detection",
      provider_result: providerResult(0.2),
      observation: observation({ confidence: 0.2 }),
      cloud_enabled: true,
      consent_state: "granted",
      budget_state: "available",
      policy: enabledMetadataPolicy,
    });
    expect(decision).toMatchObject({
      provider_executed: false,
      cloud_called: false,
      approval_granted: false,
      action_executed: false,
      raw_payload_transferred: false,
      text_payload_transferred: false,
    });
  });
});
