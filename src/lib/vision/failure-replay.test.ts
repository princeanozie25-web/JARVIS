import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_FAILURE_REPLAY_FEATURE_FLAGS,
  VISION_REPLAY_DISABLED_FEATURES,
  VisionFailureReplayRecordSchema,
  buildVisionFailureReplayGraph,
  createVisionFailureReplayRecord,
  type VisionFailureReplayRecord,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function replayRecord(
  overrides: Partial<VisionFailureReplayRecord> = {},
): VisionFailureReplayRecord {
  return createVisionFailureReplayRecord({
    replay_id: "replay:one",
    vision_session_id: "vision-session:one",
    input_type: "camera_frame",
    input_hash: INPUT_HASH,
    local_provider: "yolo",
    local_result_class: "object_detected",
    confidence_band: "medium",
    confidence_value: 0.62,
    fallback_considered: true,
    fallback_reason: "low_confidence",
    fallback_decision: "blocked_by_policy",
    cloud_provider_hash_or_alias: null,
    output_class: "cup_like_object",
    approval_required: true,
    approval_decision: "pending",
    result_class: "needs_approval",
    started_at: 1_000,
    completed_at: 1_075,
    duration_ms: 75,
    redaction_status: "hash_only",
    metadata_only: true,
    advisory_only: true,
    perception_authority: false,
    raw_payload_stored: false,
    action_executed: false,
    cloud_called: false,
    ...overrides,
  });
}

describe("Phase 7 vision failure replay diagnostics scaffold", () => {
  it("rejects raw frame, image, OCR text, screen, path, and personal data fields", () => {
    const unsafe = {
      ...replayRecord(),
      raw_frame: "base64-frame",
      raw_image: "image-bytes",
      ocr_text: "private text from screen",
      screen_contents: "private screen contents",
      file_path: "C:/Users/person/Pictures/frame.png",
      personal_data: "face or identity payload",
    };

    expect(VisionFailureReplayRecordSchema.safeParse(unsafe).success).toBe(
      false,
    );
  });

  it("creates a full metadata-only vision decision path record", () => {
    const record = replayRecord();

    expect(record).toMatchObject({
      replay_id: "replay:one",
      vision_session_id: "vision-session:one",
      input_type: "camera_frame",
      input_hash: INPUT_HASH,
      local_provider: "yolo",
      local_result_class: "object_detected",
      confidence_band: "medium",
      confidence_value: 0.62,
      fallback_considered: true,
      fallback_reason: "low_confidence",
      fallback_decision: "blocked_by_policy",
      output_class: "cup_like_object",
      approval_required: true,
      approval_decision: "pending",
      result_class: "needs_approval",
      duration_ms: 75,
      redaction_status: "hash_only",
      metadata_only: true,
      advisory_only: true,
      perception_authority: false,
      raw_payload_stored: false,
      action_executed: false,
      cloud_called: false,
    });
  });

  it("builds a redacted graph with metadata-only nodes and edges", () => {
    const graph = buildVisionFailureReplayGraph(replayRecord());

    expect(graph).toMatchObject({
      replay_id: "replay:one",
      vision_session_id: "vision-session:one",
      metadata_only: true,
      redacted: true,
      raw_payload_included: false,
    });
    expect(graph.nodes.map((node) => node.kind)).toEqual([
      "input",
      "provider",
      "confidence",
      "fallback_gate",
      "output",
      "action_gate",
      "result",
    ]);
    expect(graph.edges.map((edge) => edge.label)).toEqual([
      "to_provider",
      "scored",
      "gated",
      "selected",
      "action_gate",
      "result",
    ]);

    const serialized = JSON.stringify(graph);
    expect(serialized).toContain(INPUT_HASH);
    expect(serialized).not.toContain("base64-frame");
    expect(serialized).not.toContain("private text");
    expect(serialized).not.toContain("screen contents");
    expect(serialized).not.toContain("Pictures");
  });

  it("represents fallback decisions without provider secrets or payloads", () => {
    const record = replayRecord({
      fallback_decision: "used",
      cloud_provider_hash_or_alias: "provider_alias:cloud_redacted",
      result_class: "advisory_only",
      approval_required: false,
      approval_decision: "not_required",
    });
    const graph = buildVisionFailureReplayGraph(record);
    const fallback = graph.nodes.find((node) => node.kind === "fallback_gate");

    expect(fallback).toMatchObject({
      metadata: {
        fallback_considered: true,
        fallback_reason: "low_confidence",
        fallback_decision: "used",
        cloud_provider_hash_or_alias: "provider_alias:cloud_redacted",
      },
      redacted: true,
    });
    expect(JSON.stringify(graph)).not.toContain("api_key");
    expect(JSON.stringify(graph)).not.toContain("secret");
    expect(JSON.stringify(graph)).not.toContain("raw image payload");
  });

  it("records approval decision as metadata only without granting approval", () => {
    const record = replayRecord({
      approval_required: true,
      approval_decision: "denied",
      result_class: "blocked",
    });
    const graph = buildVisionFailureReplayGraph(record);
    const actionGate = graph.nodes.find((node) => node.kind === "action_gate");

    expect(actionGate).toMatchObject({
      metadata: {
        approval_required: true,
        approval_decision: "denied",
        action_executed: false,
      },
    });
    expect(record.action_executed).toBe(false);
    expect(record.perception_authority).toBe(false);
  });

  it("keeps capture, cloud fallback, provider execution, and actions disabled by default", () => {
    expect(
      Object.keys(DEFAULT_VISION_FAILURE_REPLAY_FEATURE_FLAGS).sort(),
    ).toEqual([...VISION_REPLAY_DISABLED_FEATURES].sort());
    for (const feature of VISION_REPLAY_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_FAILURE_REPLAY_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("rejects cloud aliases when fallback was not used", () => {
    expect(
      VisionFailureReplayRecordSchema.safeParse({
        ...replayRecord({ fallback_decision: "not_needed" }),
        cloud_provider_hash_or_alias: "provider_alias:should_not_exist",
      }).success,
    ).toBe(false);
  });
});
