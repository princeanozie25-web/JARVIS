import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VisionProviderRegistry,
  createFakeScreenshotCaptureAdapter,
  createVisionDetectionArtifactFromMockCameraFrame,
  createVisionOcrArtifactFromScreenshotCapture,
  runVisionCapabilityRouter,
  sanitizeVisionMetadataPayload,
  type MockCameraFrameDescriptor,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
  type VisionDetectionInputArtifact,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function screenshotRequest(
  triggerSource: NonNullable<
    VisionScreenshotRequest["trigger"]
  >["source"] = "user",
): VisionScreenshotRequest {
  return {
    request_id: `router-shot-${triggerSource.replace("_", "-")}`,
    input_kind: "screenshot.full",
    trigger: {
      trigger_id: `router-trigger-${triggerSource.replace("_", "-")}`,
      source: triggerSource,
      explicit_user_action: triggerSource === "user",
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

function cameraRequest(
  inputKind: VisionCameraRequest["input_kind"] = "camera.frame.mock",
): VisionCameraRequest {
  return {
    request_id: `router-camera-${inputKind.split(".").at(-1)}`,
    input_kind: inputKind,
    environment: "test",
    trigger: {
      trigger_id: "router-camera-trigger",
      source: "user",
      explicit_user_action: true,
      surface: "test",
      initiated_at_ms: 20,
      metadata_only: true,
    },
    frame: {
      frame_id: "router-camera-frame",
      mock_fixture_id: "router-fixture",
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
      indicator_id: "router-camera-indicator",
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
    artifact_id: "router-ocr-artifact",
    created_at_ms: 30,
  });
  if (!artifact.ok) throw new Error("expected safe OCR artifact");
  return artifact.artifact;
}

function safeDetectionArtifact(): VisionDetectionInputArtifact {
  const frame: MockCameraFrameDescriptor = {
    frame_id: "router-detection-frame",
    mock_fixture_id: "router-detection-fixture",
    stream_id: "router-detection-stream",
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
    artifact_id: "router-detection-artifact",
    created_at_ms: 31,
  });
  if (!artifact.ok) throw new Error("expected safe detection artifact");
  return artifact.artifact;
}

function readRecursiveTsFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readRecursiveTsFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

function visionRuntimeSource(): string {
  return readRecursiveTsFiles(VISION_RUNTIME_SOURCE_ROOT)
    .map((path) => ({
      path: relative(process.cwd(), path).replace(/\\/g, "/"),
      source: readFileSync(path, "utf8"),
    }))
    .map((file) => `${file.path}\n${file.source}`)
    .join("\n");
}

describe("unified vision capability router", () => {
  it("routes fake screenshot OCR requests through the governed fake session", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "router-screenshot-request",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 100,
      metadata_only: true,
      screenshot_request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
    });

    expect(result).toMatchObject({
      request_id: "router-screenshot-request",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      status: "completed",
      reason: "completed",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_image_included: false,
      ocr_text_included: false,
      provider_result: {
        provider_kind: "fake_ocr",
        status: "success",
        raw_payload_included: false,
      },
      observations: [
        {
          kind: "ocr_summary",
          metadata_only: true,
          advisory_only: true,
          derived: true,
          raw_payload_included: false,
        },
      ],
    });
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_image_payload|frame_bytes|base64_payload|ocr_text_value|extracted_text|prompt|response|tool_output|file_contents/i,
    );
  });

  it("routes mock camera object requests through the mock frame stream and fake detector", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "router-camera-request",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "fake",
      requested_at_ms: 101,
      metadata_only: true,
      camera_request: cameraRequest(),
      stream_options: streamOptions(),
    });

    expect(result).toMatchObject({
      request_id: "router-camera-request",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "fake",
      status: "completed",
      observation_count: 1,
      provider_result: {
        provider_kind: "fake_object_detector",
        status: "success",
        raw_payload_included: false,
      },
      observations: [
        {
          kind: "object_hint",
          metadata_only: true,
          advisory_only: true,
          derived: true,
          raw_payload_included: false,
        },
      ],
      detection_labels_included: false,
      detection_results_included: false,
    });
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_frame_payload|image_bytes|base64_payload|object_label|detected_class|class_name|prompt|response|tool_output|file_contents/i,
    );
  });

  it("routes OCR artifacts to the disabled Tesseract dry-run path", async () => {
    const artifact = await safeOcrArtifact();
    const result = await runVisionCapabilityRouter({
      request_id: "router-ocr-artifact-request",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "dry_run_disabled",
      requested_at_ms: 102,
      metadata_only: true,
      ocr_artifact: artifact,
    });

    expect(result).toMatchObject({
      status: "completed",
      reason: "execution_disabled",
      mode: "dry_run_disabled",
      invocation_result: {
        status: "execution_disabled",
        raw_payload_included: false,
        ocr_text_included: false,
        provider_executed: false,
      },
      provider_result: {
        provider_kind: "tesseract_stub",
        status: "execution_disabled",
        reason: "not_implemented",
        raw_payload_included: false,
        cloud_called: false,
        runtime_executed: false,
      },
    });
    expect(result.observations).toEqual([]);
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({ ok: true });
  });

  it("routes detection artifacts to the disabled YOLO dry-run path", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "router-detection-artifact-request",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "dry_run_disabled",
      requested_at_ms: 103,
      metadata_only: true,
      detection_artifact: safeDetectionArtifact(),
    });

    expect(result).toMatchObject({
      status: "completed",
      reason: "execution_disabled",
      mode: "dry_run_disabled",
      invocation_result: {
        status: "execution_disabled",
        raw_payload_included: false,
        detection_labels_included: false,
        detection_results_included: false,
        provider_executed: false,
      },
      provider_result: {
        provider_kind: "yolo_stub",
        status: "execution_disabled",
        reason: "not_implemented",
        raw_payload_included: false,
        cloud_called: false,
        runtime_executed: false,
      },
    });
    expect(result.observations).toEqual([]);
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({ ok: true });
  });

  it("fails closed for unsupported capability, input, or mode", async () => {
    await expect(
      runVisionCapabilityRouter({
        request_id: "router-unsupported-mode",
        capability: "screenshot_ocr",
        input_kind: "screenshot",
        mode: "real",
        requested_at_ms: 104,
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "unsupported_route",
      provider_result: null,
      observations: [],
      metadata_only: true,
      raw_payload_included: false,
    });

    await expect(
      runVisionCapabilityRouter({
        request_id: "router-unsupported-capability",
        capability: "cloud_vision",
        input_kind: "screenshot",
        mode: "fake",
        requested_at_ms: 105,
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "unsupported_route",
      provider_result: null,
      observations: [],
      cloud_called: false,
      runtime_executed: false,
    });
  });

  it("denies invalid provenance before provider execution", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "router-invalid-provenance",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 106,
      metadata_only: true,
      screenshot_request: screenshotRequest("assistant"),
      capture_options: screenshotCaptureOptions(),
    });

    expect(result).toMatchObject({
      status: "denied",
      reason: "source_denied",
      provider_result: null,
      observations: [],
      raw_payload_included: false,
      persisted: false,
      runtime_executed: false,
    });
  });

  it("keeps default providers fake-only after dry-run routing", async () => {
    await runVisionCapabilityRouter({
      request_id: "router-registry-dry-run",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "dry_run_disabled",
      requested_at_ms: 107,
      metadata_only: true,
      detection_artifact: safeDetectionArtifact(),
    });

    const registry = VisionProviderRegistry.createFakeOnly();
    if (!registry.ok) throw new Error("fake-only registry should initialize");
    expect(
      registry.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
  });

  it("introduces no real execution, capture, camera, UI, network, persistence, or mutation markers", () => {
    const source = visionRuntimeSource();
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).not.toMatch(
      /node-tesseract-ocr|tesseract\.js|paddleocr|ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe/i,
    );
    expect(source).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(|python\s*\(|python3|subprocess/i,
    );
    expect(source).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob|@tauri-apps\/api|invoke\s*\(|screencapture|gnome-screenshot/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https|from\s+["'](?:openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /React|useEffect|useState|button|onClick|app\/api|globalShortcut/i,
    );
    expect(source).not.toMatch(
      /readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(|createWriteStream|better-sqlite3|sqlite|database|indexedDB|localStorage|sessionStorage/i,
    );
    expect(source).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|shell_command|approveAction\s*\(|grantApproval\s*\(|runAction\s*\(|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
    );
  });
});
