import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  createFakeScreenshotCaptureAdapter,
  createVisionDetectionArtifactFromMockCameraFrame,
  createVisionOcrArtifactFromScreenshotCapture,
  normalizeFakeScreenshotSessionResult,
  normalizeMockCameraSessionResult,
  normalizeTesseractDryRunResult,
  normalizeVisionRouterResult,
  normalizeYoloDryRunResult,
  runFakeScreenshotOcrSession,
  runMockCameraObjectSession,
  runTesseractDryRunProviderPath,
  runVisionCapabilityRouter,
  runYoloDryRunProviderPath,
  sanitizeVisionMetadataPayload,
  type MockCameraFrameDescriptor,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionReplayMetadata,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const HASH_A =
  "sha256:abababababababababababababababababababababababababababababababab";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function screenshotRequest(): VisionScreenshotRequest {
  return {
    request_id: "normalizer-screenshot",
    input_kind: "screenshot.full",
    trigger: {
      trigger_id: "normalizer-screenshot-trigger",
      source: "user",
      explicit_user_action: true,
      surface: "test",
      initiated_at_ms: 10,
      metadata_only: true,
    },
    region: null,
    source: {
      redacted_source_id: "redacted",
      source_id_hash: HASH_A,
      metadata_only: true,
    },
    requested_at_ms: 11,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    ocr_text_included: false,
  };
}

function screenshotCaptureOptions(): VisionScreenshotCaptureOptions {
  return {
    timeout_ms: 1_000,
    requested_at_ms: 12,
    simulated_latency_ms: 1,
    metadata_only: true,
  };
}

function cameraRequest(): VisionCameraRequest {
  return {
    request_id: "normalizer-camera",
    input_kind: "camera.frame.mock",
    environment: "test",
    trigger: {
      trigger_id: "normalizer-camera-trigger",
      source: "user",
      explicit_user_action: true,
      surface: "test",
      initiated_at_ms: 20,
      metadata_only: true,
    },
    frame: {
      frame_id: "normalizer-camera-frame",
      mock_fixture_id: "normalizer-fixture",
      width_band: "medium",
      height_band: "small",
      redacted_source_id: "redacted",
      source_id_hash: HASH_B,
      metadata_only: true,
    },
    sampling_mode: "single_frame",
    requested_frame_count: 1,
    active_indicator: {
      required: true,
      visible: true,
      indicator_id: "normalizer-camera-indicator",
      metadata_only: true,
    },
    retention_policy: "ephemeral_only",
    redaction_status: "metadata_only",
    mutation_authority_requested: [],
    requested_at_ms: 21,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    persisted: false,
  };
}

function streamOptions(): MockCameraStreamOptions {
  return {
    timeout_ms: 1_000,
    requested_at_ms: 22,
    simulated_latency_ms: 1,
    metadata_only: true,
  };
}

async function safeOcrArtifact(): Promise<VisionOcrInputArtifact> {
  const capture = await createFakeScreenshotCaptureAdapter().capture(
    screenshotRequest(),
    screenshotCaptureOptions(),
  );
  const artifact = createVisionOcrArtifactFromScreenshotCapture({
    capture,
    artifact_id: "normalizer-ocr-artifact",
    created_at_ms: 30,
  });
  if (!artifact.ok) throw new Error("expected safe OCR artifact");
  return artifact.artifact;
}

function safeDetectionArtifact(): VisionDetectionInputArtifact {
  const frame: MockCameraFrameDescriptor = {
    frame_id: "normalizer-detection-frame",
    mock_fixture_id: "normalizer-detection-fixture",
    stream_id: "normalizer-detection-stream",
    frame_index: 0,
    redacted_source_id: "redacted",
    source_id_hash: HASH_B,
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
  };
  const artifact = createVisionDetectionArtifactFromMockCameraFrame({
    frame,
    artifact_id: "normalizer-detection-artifact",
    created_at_ms: 31,
  });
  if (!artifact.ok) throw new Error("expected safe detection artifact");
  return artifact.artifact;
}

function expectReplaySafe(replay: VisionReplayMetadata): void {
  expect(replay).toMatchObject({
    metadata_only: true,
    replay_safe: true,
    derived: true,
    advisory: true,
    advisory_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    detection_results_included: false,
    persisted: false,
    cloud_called: false,
    network_called: false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
    mutation_authority_granted: false,
  });
  expect(sanitizeVisionMetadataPayload(replay)).toMatchObject({ ok: true });
  expect(JSON.stringify(replay)).not.toMatch(
    /raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload|data:image|ocr_text_value|extracted_text|detection_label_value|detected_class|class_name|object_name|prompt_payload|response_payload|tool_output|file_contents|secret_value|api_key_value|token_value|password_value/i,
  );
}

describe("unified vision observation normalizer", () => {
  it("normalizes fake screenshot OCR router results into replay-safe metadata", async () => {
    const routerResult = await runVisionCapabilityRouter({
      request_id: "normalizer-router-screenshot",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 100,
      metadata_only: true,
      screenshot_request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
    });
    const normalized = normalizeVisionRouterResult(routerResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      replay_id: "normalizer-router-screenshot-replay",
      request_id: "normalizer-router-screenshot",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      provider_id: "fake-ocr",
      provider_kind: "fake_ocr",
      result_status: "success",
      reason: "completed",
      confidence_band: "high",
      fallback_used: false,
    });
    expectReplaySafe(normalized.replay);
  });

  it("normalizes mock camera object router results into replay-safe metadata", async () => {
    const routerResult = await runVisionCapabilityRouter({
      request_id: "normalizer-router-camera",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "fake",
      requested_at_ms: 101,
      metadata_only: true,
      camera_request: cameraRequest(),
      stream_options: streamOptions(),
    });
    const normalized = normalizeVisionRouterResult(routerResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      request_id: "normalizer-router-camera",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      provider_id: "fake-object-detector",
      provider_kind: "fake_object_detector",
      result_status: "success",
      confidence_band: "high",
    });
    expectReplaySafe(normalized.replay);
  });

  it("normalizes fake screenshot session results with redacted source metadata", async () => {
    const sessionResult = await runFakeScreenshotOcrSession({
      request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
      metadata_only: true,
    });
    const normalized = normalizeFakeScreenshotSessionResult(sessionResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      request_id: "normalizer-screenshot",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      source_ref_kind: "redacted_ref",
      redacted_source_id: "redacted",
      source_id_hash: HASH_A,
      result_status: "success",
    });
    expectReplaySafe(normalized.replay);
  });

  it("normalizes mock camera sessions with mock frame source metadata", async () => {
    const sessionResult = await runMockCameraObjectSession({
      request: cameraRequest(),
      stream_options: streamOptions(),
      metadata_only: true,
    });
    const normalized = normalizeMockCameraSessionResult(sessionResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      request_id: "normalizer-camera",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      source_ref_kind: "mock_frame_ref",
      redacted_source_id: "redacted",
      source_id_hash: HASH_B,
      frame_id: "normalizer-fixture.frame-0",
      mock_fixture_id: "normalizer-fixture",
      result_status: "success",
    });
    expectReplaySafe(normalized.replay);
  });

  it("normalizes disabled Tesseract dry-run results", async () => {
    const artifact = await safeOcrArtifact();
    const request: VisionOcrArtifactProviderRunRequest = {
      request_id: "normalizer-tesseract",
      session_id: "normalizer-tesseract-session",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      user_triggered: true,
      timeout_ms: 5_000,
      requested_at_ms: 40,
      environment: "test",
      metadata_only: true,
      ocr_artifact: artifact,
    };
    const dryRunResult = runTesseractDryRunProviderPath({
      config: {
        ...DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
        enabled: true,
      },
      request,
      metadata_only: true,
    });
    const normalized = normalizeTesseractDryRunResult(dryRunResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      result_status: "execution_disabled",
      reason: "not_implemented",
      confidence_band: "unknown",
      artifact_id: "normalizer-ocr-artifact",
    });
    expectReplaySafe(normalized.replay);
  });

  it("normalizes disabled YOLO dry-run results", () => {
    const artifact = safeDetectionArtifact();
    const request: VisionDetectionArtifactProviderRunRequest = {
      request_id: "normalizer-yolo",
      session_id: "normalizer-yolo-session",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      user_triggered: true,
      timeout_ms: 5_000,
      requested_at_ms: 41,
      environment: "test",
      metadata_only: true,
      detection_artifact: artifact,
    };
    const dryRunResult = runYoloDryRunProviderPath({
      config: {
        ...DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
        enabled: true,
      },
      request,
      metadata_only: true,
    });
    const normalized = normalizeYoloDryRunResult(dryRunResult);

    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok) throw new Error("expected normalized replay metadata");
    expect(normalized.replay).toMatchObject({
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      provider_id: "yolo-stub",
      provider_kind: "yolo_stub",
      result_status: "execution_disabled",
      reason: "not_implemented",
      confidence_band: "unknown",
      artifact_id: "normalizer-detection-artifact",
    });
    expectReplaySafe(normalized.replay);
  });

  it("fails closed for unsafe or unsupported payloads", async () => {
    const routerResult = await runVisionCapabilityRouter({
      request_id: "normalizer-unsafe-router",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 102,
      metadata_only: true,
      screenshot_request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
    });

    expect(
      normalizeVisionRouterResult({
        ...routerResult,
        raw_image_payload: "unsafe",
      }),
    ).toMatchObject({
      ok: false,
      reason: "unsafe_payload",
      field_path: "raw_image_payload",
    });
    expect(
      normalizeVisionRouterResult({
        ...routerResult,
        observations: [
          {
            ...routerResult.observations[0],
            detection_label: "unsafe",
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      reason: "unsafe_payload",
      field_path: "observations.0.detection_label",
    });
    expect(normalizeVisionRouterResult("unsupported")).toMatchObject({
      ok: false,
      reason: "unsafe_payload",
    });
  });

  it("keeps replay metadata render-only with no executable affordance markers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/vision-runtime/observation-normalizer.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /retry|rerun|run_affordance|execute_affordance|tool_output|file_contents/i,
    );
    expect(source).not.toMatch(
      /child_process|spawn\s*\(|exec\s*\(|fork\s*\(|fetch\s*\(|WebSocket|XMLHttpRequest|writeFile\s*\(|createWriteStream/i,
    );
  });
});
