import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  createDeterministicMockCameraStream,
  createMockCameraFrameProvider,
  sanitizeVisionMetadataPayload,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
} from "../../src/lib/vision-runtime";

const validRequest: VisionCameraRequest = {
  request_id: "mock-camera-provider-request",
  input_kind: "camera.frame.mock",
  environment: "test",
  trigger: {
    trigger_id: "mock-camera-provider-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  frame: {
    frame_id: "mock-camera-provider-frame",
    mock_fixture_id: "fixture-provider-front-desk",
    width_band: "medium",
    height_band: "small",
    redacted_source_id: "redacted",
    source_id_hash:
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    metadata_only: true,
  },
  sampling_mode: "single_frame",
  requested_frame_count: 1,
  active_indicator: {
    required: true,
    visible: true,
    indicator_id: "mock-camera-provider-indicator",
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

const options: MockCameraStreamOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
};

describe("Phase 15D.2 deterministic mock camera frame provider", () => {
  it("produces deterministic metadata-only frames for valid test/dev requests", async () => {
    const provider = createMockCameraFrameProvider();
    const first = await provider.stream(validRequest, options);
    const second = await provider.stream(validRequest, options);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      stream_id: "mock-camera-provider-request-stream",
      provider_id: "deterministic-mock-camera",
      provider_kind: "deterministic_mock_camera",
      request_id: "mock-camera-provider-request",
      status: "success",
      frame_count: 1,
      max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
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
      cloud_called: false,
      network_called: false,
      runtime_executed: false,
      mutation_authority_granted: false,
    });
    expect(first.frames).toEqual([
      {
        frame_id: "fixture-provider-front-desk.frame-0",
        mock_fixture_id: "fixture-provider-front-desk",
        stream_id: "mock-camera-provider-request-stream",
        frame_index: 0,
        redacted_source_id: "redacted",
        source_id_hash: validRequest.frame!.source_id_hash,
        width_band: "medium",
        height_band: "small",
        sampling_mode: "single_frame",
        active_indicator_required: true,
        active_indicator_visible: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_image_included: false,
        raw_frame_included: false,
        base64_included: false,
        ocr_text_included: false,
        detection_labels_included: false,
      },
    ]);
    expect(sanitizeVisionMetadataPayload(first)).toMatchObject({ ok: true });
  });

  it("same fixture id produces the same deterministic frame metadata", () => {
    const first = createDeterministicMockCameraStream({
      request: validRequest,
      options,
    });
    const second = createDeterministicMockCameraStream({
      request: {
        ...validRequest,
        request_id: "mock-camera-provider-request",
        frame: {
          ...validRequest.frame!,
          frame_id: "different-redacted-frame",
        },
      },
      options,
    });

    expect(first.frames).toEqual(second.frames);
  });

  it("produces no frames for invalid, real-camera, missing-indicator, and excessive-sampling requests", async () => {
    const provider = createMockCameraFrameProvider();
    for (const request of [
      { ...validRequest, environment: "production" },
      { ...validRequest, input_kind: "camera.frame.real" },
      { ...validRequest, active_indicator: null },
      { ...validRequest, requested_frame_count: 2 },
    ] as const) {
      const result = await provider.stream(request, options);
      expect(result).toMatchObject({
        status: "gate_denied",
        frame_count: 0,
        frames: [],
        raw_payload_included: false,
        runtime_executed: false,
      });
    }
  });

  it("enforces bounded frame count even when called directly", () => {
    const result = createDeterministicMockCameraStream({
      request: validRequest,
      options,
    });

    expect(result.frame_count).toBeLessThanOrEqual(
      VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
    );
    expect(result.frames).toHaveLength(1);
  });

  it("supports metadata-safe cancellation and timeout results", () => {
    expect(
      createDeterministicMockCameraStream({
        request: validRequest,
        options: {
          ...options,
          cancellation: {
            cancellation_id: "mock-camera-cancel",
            cancelled: true,
            requested_at_ms: 11,
            metadata_only: true,
          },
        },
      }),
    ).toMatchObject({
      status: "cancelled",
      cancelled: true,
      frame_count: 0,
      frames: [],
      raw_payload_included: false,
    });
    expect(
      createDeterministicMockCameraStream({
        request: validRequest,
        options: {
          ...options,
          timeout_ms: 1,
          simulated_latency_ms: 2,
        },
      }),
    ).toMatchObject({
      status: "timeout",
      timed_out: true,
      frame_count: 0,
      frames: [],
      raw_payload_included: false,
    });
  });

  it("supports metadata-safe no-signal degraded result", () => {
    expect(
      createDeterministicMockCameraStream({
        request: validRequest,
        options: {
          ...options,
          degraded: true,
        },
      }),
    ).toMatchObject({
      status: "no_signal",
      reason: "no_signal",
      degraded: true,
      frame_count: 0,
      frames: [],
      raw_payload_included: false,
      detection_labels_included: false,
    });
  });

  it("does not emit raw frames, image payloads, base64, OCR text, or detection labels", () => {
    const result = createDeterministicMockCameraStream({
      request: validRequest,
      options,
    });

    expect(JSON.stringify(result)).not.toMatch(
      /raw_frame_payload|raw_image_payload|frame_bytes|image_bytes|base64_payload|ocr_text_value|recognized_text|object_label|detection_label_value|bounding_box/i,
    );
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
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https|writeFile|appendFile|better-sqlite3|sqlite|database/i,
    );
  });
});

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
