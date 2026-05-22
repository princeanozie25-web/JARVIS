import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_PROVIDER_FEATURE_FLAGS,
  VISION_LOCAL_PROVIDER_CONTRACTS,
  VISION_PROVIDER_DISABLED_FEATURES,
  VisionProviderResultSchema,
  confidenceBandForScore,
  createVisionFrameDescriptor,
  createVisionProviderReplayStep,
  createVisionProviderResult,
  createVisionProviderTelemetryEvent,
  findEligibleVisionProviders,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OUTPUT_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function frameDescriptor() {
  return createVisionFrameDescriptor({
    frame_id: "frame:provider",
    vision_session_id: "vision-session:provider",
    source_type: "uploaded_image",
    input_hash: INPUT_HASH,
    observed_at: 1_000,
    received_at: 1_050,
  });
}

function providerResult() {
  return createVisionProviderResult({
    frame_id: "frame:provider",
    vision_session_id: "vision-session:provider",
    provider_id: "yolo_v8n",
    capability: "object_detection",
    result_class: "object_detection_summary",
    confidence: 0.88,
    output_hash: OUTPUT_HASH,
    detected_count: 2,
    summary_count: null,
    redaction_status: "hash_only",
  });
}

describe("Phase 7C local vision provider contract scaffold", () => {
  it("defines local-only metadata-only provider contracts", () => {
    expect(VISION_LOCAL_PROVIDER_CONTRACTS.map((c) => c.provider_id)).toEqual([
      "yolo_v8n",
      "mediapipe",
      "tesseract",
      "screen_ocr",
      "developer_fixture",
    ]);

    for (const contract of VISION_LOCAL_PROVIDER_CONTRACTS) {
      expect(contract).toMatchObject({
        local_only: true,
        cloud_provider: false,
        accepts_metadata_only_frame_descriptors: true,
        returns_metadata_only_result_summaries: true,
        executes_provider_code: false,
        metadata_only: true,
        raw_payload_access: false,
        advisory_only: true,
        perception_authority: false,
        action_executed: false,
      });
    }
  });

  it("rejects raw output, OCR text, image payloads, paths, and provider secrets", () => {
    const unsafe = {
      ...providerResult(),
      raw_output: "model payload",
      ocr_text: "private OCR text",
      raw_image: "image bytes",
      image_buffer: "buffer bytes",
      base64: "data:image/png;base64,private",
      blob: "opaque blob payload",
      file_path: "C:/Users/person/frame.png",
      provider_secret: "api-key-like-secret",
    };

    expect(VisionProviderResultSchema.safeParse(unsafe).success).toBe(false);
  });

  it("calculates deterministic confidence bands", () => {
    expect(confidenceBandForScore(null)).toBe("unknown");
    expect(confidenceBandForScore(0.1)).toBe("low");
    expect(confidenceBandForScore(0.4)).toBe("medium");
    expect(confidenceBandForScore(0.74)).toBe("medium");
    expect(confidenceBandForScore(0.75)).toBe("high");
    expect(confidenceBandForScore(1)).toBe("high");

    expect(
      VisionProviderResultSchema.safeParse({
        ...providerResult(),
        confidence: 0.88,
        confidence_band: "low",
      }).success,
    ).toBe(false);
  });

  it("returns provider eligibility decisions without executing providers", () => {
    const decision = findEligibleVisionProviders({
      frame_descriptor: frameDescriptor(),
      capability: "object_detection",
    });

    expect(decision).toMatchObject({
      kind: "vision.provider_eligibility_decision",
      requested_capability: "object_detection",
      source_type: "uploaded_image",
      status: "eligible",
      reason: "eligible_contract_found",
      executed_provider_code: false,
      metadata_only: true,
      raw_payload_accessed: false,
      advisory_only: true,
      perception_authority: false,
      action_executed: false,
    });
    expect(decision.eligible_provider_ids).toEqual([
      "yolo_v8n",
      "developer_fixture",
    ]);
  });

  it("denies unsupported source/capability pairings without execution", () => {
    const screenFrame = createVisionFrameDescriptor({
      frame_id: "frame:screen",
      vision_session_id: "vision-session:provider",
      source_type: "screen_region",
      input_hash: INPUT_HASH,
      observed_at: 1_000,
      received_at: 1_050,
    });
    const decision = findEligibleVisionProviders({
      frame_descriptor: screenFrame,
      capability: "pose_landmarks",
      contracts: VISION_LOCAL_PROVIDER_CONTRACTS.filter(
        (contract) => contract.provider_id !== "developer_fixture",
      ),
    });

    expect(decision).toMatchObject({
      status: "ineligible",
      reason: "source_type_not_supported",
      eligible_provider_ids: [],
      executed_provider_code: false,
      raw_payload_accessed: false,
      action_executed: false,
    });
  });

  it("keeps provider results derived, advisory, and non-authoritative", () => {
    const result = providerResult();

    expect(result).toMatchObject({
      provider_id: "yolo_v8n",
      result_class: "object_detection_summary",
      confidence: 0.88,
      confidence_band: "high",
      output_hash: OUTPUT_HASH,
      detected_count: 2,
      derived: true,
      metadata_only: true,
      raw_payload_stored: false,
      raw_payload_included: false,
      advisory_only: true,
      perception_authority: false,
      cloud_called: false,
      action_executed: false,
    });
  });

  it("creates failure replay provider steps with only redacted metadata", () => {
    const step = createVisionProviderReplayStep(providerResult());

    expect(step).toEqual({
      provider_id: "yolo_v8n",
      capability: "object_detection",
      result_class: "object_detection_summary",
      confidence: 0.88,
      confidence_band: "high",
      output_hash: OUTPUT_HASH,
      detected_count: 2,
      summary_count: null,
      redaction_status: "hash_only",
      metadata_only: true,
      raw_payload_included: false,
      advisory_only: true,
      perception_authority: false,
      action_executed: false,
    });
    expect(JSON.stringify(step)).not.toContain("private OCR text");
    expect(JSON.stringify(step)).not.toContain("image bytes");
  });

  it("keeps provider execution, model loading, capture, cloud, actions, and jobs disabled", () => {
    expect(Object.keys(DEFAULT_VISION_PROVIDER_FEATURE_FLAGS).sort()).toEqual(
      [...VISION_PROVIDER_DISABLED_FEATURES].sort(),
    );
    for (const feature of VISION_PROVIDER_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_PROVIDER_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("emits telemetry/result objects without secrets, paths, or raw content", () => {
    const resultEvent = createVisionProviderTelemetryEvent({
      result: providerResult(),
    });
    const eligibilityEvent = createVisionProviderTelemetryEvent({
      eligibility: findEligibleVisionProviders({
        frame_descriptor: frameDescriptor(),
        capability: "ocr",
      }),
    });
    const serialized = JSON.stringify([resultEvent, eligibilityEvent]);

    expect(resultEvent).toMatchObject({
      event_type: "provider_result_recorded",
      output_hash: OUTPUT_HASH,
      metadata_only: true,
      raw_payload_included: false,
      provider_secret_included: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(eligibilityEvent).toMatchObject({
      event_type: "provider_eligibility_evaluated",
      metadata_only: true,
      raw_payload_included: false,
      provider_secret_included: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("private OCR text");
    expect(serialized).not.toContain("frame.png");
    expect(serialized).not.toContain("base64");
  });
});
