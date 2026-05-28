import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MockCameraSessionLifecycleEventSchema,
  MockCameraSessionRunner,
  createMockCameraFrameProvider,
  runMockCameraObjectSession,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  type MockCameraFrameProvider,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
} from "../../src/lib/vision-runtime";

const validRequest: VisionCameraRequest = {
  request_id: "mock-camera-session-request",
  input_kind: "camera.frame.mock",
  environment: "test",
  trigger: {
    trigger_id: "mock-camera-session-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  frame: {
    frame_id: "mock-camera-session-frame",
    mock_fixture_id: "fixture-session-front-desk",
    width_band: "medium",
    height_band: "small",
    redacted_source_id: "redacted",
    source_id_hash:
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    metadata_only: true,
  },
  sampling_mode: "single_frame",
  requested_frame_count: 1,
  active_indicator: {
    required: true,
    visible: true,
    indicator_id: "mock-camera-session-indicator",
    metadata_only: true,
  },
  retention_policy: "ephemeral_only",
  redaction_status: "metadata_only",
  mutation_authority_requested: [],
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  base64_included: false,
  ocr_text_included: false,
  persisted: false,
};

const streamOptions: MockCameraStreamOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
};

describe("Phase 15D.3 mock camera session orchestration", () => {
  it("valid mock camera request completes through mock stream and fake object detector", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      request_id: "mock-camera-session-request",
      status: "completed",
      reason: "completed",
      frame_count: 1,
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
      persisted: false,
      provider_executed: true,
      mock_frame_stream_executed: true,
      runtime_executed: false,
    });
    expect(result.stream_result).toMatchObject({
      status: "success",
      frame_count: 1,
      raw_frame_included: false,
      detection_labels_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_id: "fake-object-detector",
      provider_kind: "fake_object_detector",
      capability: "object_detection",
      status: "success",
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
    expect(result.observations).toEqual([
      expect.objectContaining({
        kind: "object_hint",
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      }),
    ]);
  });

  it("invalid camera request is denied before frame provider execution", async () => {
    const result = await runnerWithThrowingFrameProvider().run({
      request: {
        ...validRequest,
        trigger: {
          ...validRequest.trigger!,
          source: "assistant",
        },
      },
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "denied",
      reason: "assistant_trigger_forbidden",
      stream_result: null,
      provider_result: null,
      observations: [],
      observation_count: 0,
      provider_executed: false,
      mock_frame_stream_executed: false,
    });
  });

  it("real camera request is denied before frame provider execution", async () => {
    const result = await runnerWithThrowingFrameProvider().run({
      request: {
        ...validRequest,
        input_kind: "camera.frame.real",
      },
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "denied",
      reason: "real_camera_disabled",
      stream_result: null,
      provider_result: null,
      provider_executed: false,
      mock_frame_stream_executed: false,
    });
  });

  it("no-signal frame stream prevents provider execution", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: {
        ...streamOptions,
        degraded: true,
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "no_signal",
      reason: "no_signal",
      provider_result: null,
      observations: [],
      observation_count: 0,
      provider_executed: false,
      raw_payload_included: false,
    });
    expect(result.stream_result).toMatchObject({
      status: "no_signal",
      degraded: true,
      frame_count: 0,
      detection_labels_included: false,
    });
  });

  it("cancellation prevents completed observation", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: {
        ...streamOptions,
        cancellation: {
          cancellation_id: "mock-camera-session-cancel",
          cancelled: true,
          requested_at_ms: 11,
          metadata_only: true,
        },
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "cancelled",
      reason: "cancelled",
      provider_result: null,
      observations: [],
      observation_count: 0,
      provider_executed: false,
      mock_frame_stream_executed: false,
    });
  });

  it("timeout returns metadata-safe timeout result", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: {
        ...streamOptions,
        timeout_ms: 1,
        simulated_latency_ms: 2,
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "timeout",
      reason: "timeout",
      observations: [],
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
    });
  });

  it("provider failure remains metadata-safe", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      provider_timeout_ms: 1,
      provider_simulated_latency_ms: 2,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "timeout",
      reason: "provider_timeout",
      observation_count: 0,
      provider_executed: true,
      mock_frame_stream_executed: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      status: "timeout",
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
  });

  it("final observations are derived and advisory", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result.observations).toHaveLength(1);
    for (const observation of result.observations) {
      expect(sanitizeVisionObservation(observation)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(observation).toMatchObject({
        advisory_only: true,
        derived: true,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      });
    }
  });

  it("lifecycle events are metadata-only", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      if ("request_id" in event) {
        expect(
          MockCameraSessionLifecycleEventSchema.safeParse(event).success,
        ).toBe(true);
      }
      expect(event).toMatchObject({
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        action_executed: false,
        mutation_performed: false,
        runtime_executed: false,
      });
    }
  });

  it("no raw frame, image, base64, OCR text, or object payload leaks through result", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_frame_payload|raw_image_payload|frame_bytes|image_bytes|base64_payload|ocr_text_value|extracted_text|recognized_text|object_label|detection_label_value|bounding_box|prompt|response|tool_output|file_contents/i,
    );
  });

  it("cannot trigger runtime, tool, device, project, or memory mutation authority", async () => {
    const result = await runMockCameraObjectSession({
      request: validRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      action_executed: false,
      mutation_performed: false,
      tool_triggered: false,
      device_action_triggered: false,
      project_mutated: false,
      memory_mutated: false,
      runtime_executed: false,
    });
  });

  it("keeps real camera/media/browser/Tauri/native/device-enumeration markers absent", () => {
    const sourceText = readVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /getUserMedia|mediaDevices|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.media|windows\.graphics\.capture/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:yolo|ultralytics|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:yolo|ultralytics|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
  });
});

function runnerWithThrowingFrameProvider(): MockCameraSessionRunner {
  const throwingFrameProvider: MockCameraFrameProvider = {
    ...createMockCameraFrameProvider(),
    async stream() {
      throw new Error("frame provider must not be called for denied gates");
    },
  };

  return new MockCameraSessionRunner({
    frame_provider: throwingFrameProvider,
  });
}

function readVisionRuntimeSource(): string {
  return readdirSync(join(process.cwd(), "src/lib/vision-runtime"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) =>
      readFileSync(join(process.cwd(), "src/lib/vision-runtime", entry.name), {
        encoding: "utf8",
      }),
    )
    .join("\n");
}
