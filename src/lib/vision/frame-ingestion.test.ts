import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_FRAME_FEATURE_FLAGS,
  VISION_FRAME_DISABLED_FEATURES,
  VisionFrameDescriptorSchema,
  VisionFrameIngestionResultSchema,
  createVisionFrameDescriptor,
  createVisionFrameTelemetryEvent,
  ingestVisionFrameDescriptor,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function freshDescriptor() {
  return createVisionFrameDescriptor({
    frame_id: "frame:one",
    vision_session_id: "vision-session:one",
    source_type: "uploaded_image",
    input_hash: INPUT_HASH,
    observed_at: 1_000,
    received_at: 1_200,
    stale_after_ms: 5_000,
  });
}

describe("Phase 7B vision frame descriptor and ingestion scaffold", () => {
  it("creates hash-only frame identity metadata without raw payload storage", () => {
    const descriptor = freshDescriptor();

    expect(descriptor).toMatchObject({
      frame_id: "frame:one",
      vision_session_id: "vision-session:one",
      source_type: "uploaded_image",
      input_hash: INPUT_HASH,
      freshness_ms: 200,
      stale: false,
      current_truth: false,
      redaction_status: "hash_only",
      metadata_only: true,
      raw_payload_stored: false,
      advisory_only: true,
      capture_started: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
      background_job_started: false,
    });
    expect(JSON.stringify(descriptor)).not.toContain("base64");
    expect(JSON.stringify(descriptor)).not.toContain("raw_image");
  });

  it("rejects raw image, frame, blob, OCR text, content, and file path fields", () => {
    const unsafe = {
      ...freshDescriptor(),
      raw_frame: "private frame bytes",
      raw_image: "private image bytes",
      base64: "data:image/png;base64,private",
      blob: "opaque blob payload",
      ocr_text: "private OCR text",
      content: "screen contents",
      file_path: "C:/Users/person/Pictures/frame.png",
    };

    expect(VisionFrameDescriptorSchema.safeParse(unsafe).success).toBe(false);
    expect(ingestVisionFrameDescriptor(unsafe)).toMatchObject({
      status: "invalid",
      reason: "invalid_descriptor",
      descriptor: null,
      stored: false,
      raw_payload_stored: false,
    });
  });

  it("marks stale frames as stale and never treats them as current truth", () => {
    const descriptor = createVisionFrameDescriptor({
      frame_id: "frame:stale",
      vision_session_id: "vision-session:one",
      source_type: "camera_frame",
      input_hash: INPUT_HASH,
      observed_at: 1_000,
      received_at: 7_001,
      stale_after_ms: 5_000,
    });
    const result = ingestVisionFrameDescriptor(descriptor);

    expect(descriptor).toMatchObject({
      freshness_ms: 6_001,
      stale: true,
      current_truth: false,
    });
    expect(result).toMatchObject({
      status: "stale",
      reason: "stale_frame",
      current_truth: false,
      action_executed: false,
    });
  });

  it("links ingestion to a vision session by ID only", () => {
    const result = ingestVisionFrameDescriptor(freshDescriptor());

    expect(result).toMatchObject({
      status: "accepted",
      reason: "accepted_metadata_only",
      frame_id: "frame:one",
      vision_session_id: "vision-session:one",
      input_hash: INPUT_HASH,
      stored: false,
      metadata_only: true,
    });
    expect(JSON.stringify(result)).not.toContain("session_record");
  });

  it("emits metadata-only frame ingestion and rejection telemetry shapes", () => {
    const accepted = ingestVisionFrameDescriptor(freshDescriptor());
    const acceptedEvent = createVisionFrameTelemetryEvent(accepted);
    const rejectedEvent = createVisionFrameTelemetryEvent(
      ingestVisionFrameDescriptor({ ...freshDescriptor(), freshness_ms: 1 }),
    );

    expect(acceptedEvent).toEqual({
      event_type: "frame_ingested",
      status: "accepted",
      reason: "accepted_metadata_only",
      frame_id: "frame:one",
      vision_session_id: "vision-session:one",
      source_type: "uploaded_image",
      input_hash: INPUT_HASH,
      stale: false,
      freshness_ms: 200,
      metadata_only: true,
      raw_payload_included: false,
      stored: false,
      capture_started: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(rejectedEvent).toMatchObject({
      event_type: "frame_rejected",
      status: "invalid",
      reason: "invalid_descriptor",
      frame_id: null,
      raw_payload_included: false,
      stored: false,
    });
  });

  it("keeps frame capture, raw storage, providers, cloud, actions, and jobs disabled", () => {
    expect(Object.keys(DEFAULT_VISION_FRAME_FEATURE_FLAGS).sort()).toEqual(
      [...VISION_FRAME_DISABLED_FEATURES].sort(),
    );
    for (const feature of VISION_FRAME_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_FRAME_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("references failure replay by replay_id and input_hash only", () => {
    const descriptor = createVisionFrameDescriptor({
      frame_id: "frame:with-replay",
      vision_session_id: "vision-session:one",
      source_type: "ocr_region",
      input_hash: INPUT_HASH,
      observed_at: 1_000,
      received_at: 1_005,
      failure_replay_ref: {
        replay_id: "replay:one",
        input_hash: INPUT_HASH,
        metadata_only: true,
        raw_payload_included: false,
      },
    });

    expect(descriptor.failure_replay_ref).toEqual({
      replay_id: "replay:one",
      input_hash: INPUT_HASH,
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(
      VisionFrameDescriptorSchema.safeParse({
        ...descriptor,
        failure_replay_ref: {
          replay_id: "replay:mismatch",
          input_hash: OTHER_HASH,
          metadata_only: true,
          raw_payload_included: false,
        },
      }).success,
    ).toBe(false);
  });

  it("cannot represent capture, provider, cloud, action, or storage execution", () => {
    const descriptor = freshDescriptor();
    const result = ingestVisionFrameDescriptor(descriptor);

    expect(
      VisionFrameDescriptorSchema.safeParse({
        ...descriptor,
        capture_started: true,
      }).success,
    ).toBe(false);
    expect(
      VisionFrameIngestionResultSchema.safeParse({
        ...result,
        action_executed: true,
        stored: true,
      }).success,
    ).toBe(false);
    expect(result).toMatchObject({
      capture_started: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
      stored: false,
    });
  });
});
