import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_OBSERVATION_FEATURE_FLAGS,
  VISION_OBSERVATION_DISABLED_FEATURES,
  VisionObservationSchema,
  aggregateVisionObservations,
  createVisionFrameDescriptor,
  createVisionObservation,
  createVisionObservationReplayStep,
  createVisionProviderResult,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OUTPUT_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function frameDescriptor(overrides = {}) {
  return createVisionFrameDescriptor({
    frame_id: "frame:observation",
    vision_session_id: "vision-session:observation",
    source_type: "uploaded_image",
    input_hash: INPUT_HASH,
    observed_at: 1_000,
    received_at: 1_100,
    stale_after_ms: 5_000,
    ...overrides,
  });
}

function providerResult(overrides = {}) {
  return createVisionProviderResult({
    frame_id: "frame:observation",
    vision_session_id: "vision-session:observation",
    provider_id: "yolo_v8n",
    capability: "object_detection",
    result_class: "object_detection_summary",
    confidence: 0.82,
    output_hash: OUTPUT_HASH,
    detected_count: 3,
    summary_count: null,
    redaction_status: "hash_only",
    ...overrides,
  });
}

function observation(overrides = {}) {
  return {
    ...createVisionObservation({
      observation_id: "observation:one",
      frame_descriptor: frameDescriptor(),
      provider_result: providerResult(),
    }),
    ...overrides,
  };
}

describe("Phase 7D vision observation model", () => {
  it("creates derived advisory observations that are never canonical truth", () => {
    const item = observation();

    expect(item).toMatchObject({
      observation_id: "observation:one",
      observation_class: "object_presence",
      vision_session_id: "vision-session:observation",
      frame_id: "frame:observation",
      provider_id: "yolo_v8n",
      input_hash: INPUT_HASH,
      output_hash: OUTPUT_HASH,
      provider_result_class: "object_detection_summary",
      confidence: 0.82,
      confidence_band: "high",
      observed_count: 3,
      stale: false,
      current_truth: false,
      derived: true,
      advisory_only: true,
      canonical_truth: false,
      perception_authority: false,
      metadata_only: true,
      raw_payload_stored: false,
      text_payload_stored: false,
      action_executed: false,
      cloud_called: false,
      provider_executed: false,
    });
  });

  it("rejects raw image, OCR, screen, text, coordinate, and path payload fields", () => {
    const unsafe = {
      ...observation(),
      raw_image: "private image bytes",
      raw_frame: "private frame bytes",
      image_buffer: "buffer bytes",
      base64: "data:image/png;base64,private",
      blob: "opaque blob payload",
      ocr_text: "private OCR text",
      screen_contents: "private screen contents",
      text_payload: "recognized text",
      file_path: "C:/Users/person/frame.png",
      raw_coordinates: [[0, 0]],
      landmarks: [{ x: 1, y: 2 }],
    };

    expect(VisionObservationSchema.safeParse(unsafe).success).toBe(false);
  });

  it("aggregates observations into counts and classes only", () => {
    const objectObservation = observation();
    const textObservation = createVisionObservation({
      observation_id: "observation:text",
      frame_descriptor: frameDescriptor({ source_type: "ocr_region" }),
      provider_result: providerResult({
        provider_id: "tesseract",
        capability: "ocr",
        result_class: "ocr_summary",
        detected_count: null,
        summary_count: 1,
      }),
    });
    const aggregate = aggregateVisionObservations([
      objectObservation,
      textObservation,
    ]);

    expect(aggregate).toMatchObject({
      kind: "vision.observation_aggregate",
      total_observations: 2,
      stale_observations: 0,
      current_truth_count: 0,
      classes: {
        object_presence: 1,
        text_presence: 1,
        pose_presence: 0,
        hand_presence: 0,
        face_presence: 0,
        screen_context_presence: 0,
        unknown: 0,
      },
      metadata_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      canonical_truth: false,
      perception_authority: false,
    });
    expect(JSON.stringify(aggregate)).not.toContain("private OCR text");
    expect(JSON.stringify(aggregate)).not.toContain("recognized text");
  });

  it("marks stale observations stale and does not treat them as current truth", () => {
    const stale = createVisionObservation({
      observation_id: "observation:stale",
      frame_descriptor: frameDescriptor({
        observed_at: 1_000,
        received_at: 8_500,
        stale_after_ms: 5_000,
      }),
      provider_result: providerResult(),
    });

    expect(stale).toMatchObject({
      freshness_ms: 7_500,
      stale: true,
      current_truth: false,
      canonical_truth: false,
      perception_authority: false,
    });
  });

  it("converts provider results into observations using only hashes, classes, and counts", () => {
    const item = createVisionObservation({
      observation_id: "observation:converted",
      frame_descriptor: frameDescriptor(),
      provider_result: providerResult({
        result_class: "object_detection_summary",
        detected_count: 4,
      }),
    });
    const serialized = JSON.stringify(item);

    expect(item).toMatchObject({
      observation_class: "object_presence",
      input_hash: INPUT_HASH,
      output_hash: OUTPUT_HASH,
      provider_result_class: "object_detection_summary",
      observed_count: 4,
    });
    expect(serialized).not.toContain("cup");
    expect(serialized).not.toContain("person");
    expect(serialized).not.toContain("private");
  });

  it("does not allow identity, biometric labels, detected labels, or landmarks", () => {
    const unsafe = {
      ...observation(),
      detected_label: "person",
      detected_name: "Alice",
      face_identity: "Alice",
      person_identity: "user",
      biometric_attributes: { age: "adult" },
      gaze_vector: [1, 2, 3],
      landmark_coordinates: [[1, 2]],
    };

    expect(VisionObservationSchema.safeParse(unsafe).success).toBe(false);
  });

  it("creates failure replay observation steps with redacted metadata only", () => {
    const step = createVisionObservationReplayStep(observation());

    expect(step).toEqual({
      observation_class: "object_presence",
      provider_id: "yolo_v8n",
      provider_result_class: "object_detection_summary",
      input_hash: INPUT_HASH,
      output_hash: OUTPUT_HASH,
      confidence: 0.82,
      confidence_band: "high",
      observed_count: 3,
      stale: false,
      redaction_status: "hash_only",
      metadata_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      advisory_only: true,
      canonical_truth: false,
      perception_authority: false,
      action_executed: false,
    });
    expect(JSON.stringify(step)).not.toContain("private OCR text");
    expect(JSON.stringify(step)).not.toContain("face_identity");
  });

  it("keeps observation raw storage, identity, provider, cloud, actions, and jobs disabled", () => {
    expect(
      Object.keys(DEFAULT_VISION_OBSERVATION_FEATURE_FLAGS).sort(),
    ).toEqual([...VISION_OBSERVATION_DISABLED_FEATURES].sort());
    for (const feature of VISION_OBSERVATION_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_OBSERVATION_FEATURE_FLAGS[feature]).toBe(false);
    }
  });
});
