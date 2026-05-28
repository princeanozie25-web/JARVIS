import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  PHASE_15_DISABLED_FEATURES,
  PHASE_15_VISION_RUNTIME_STATUS,
  VisionProviderRegistry,
  createDisabledTesseractDryRunProvider,
  createDisabledYoloDryRunProvider,
  createFakeScreenshotCaptureAdapter,
  createVisionDetectionArtifactFromMockCameraFrame,
  createVisionOcrArtifactFromScreenshotCapture,
  normalizeVisionRouterResult,
  runTesseractDryRunProviderPath,
  runVisionCapabilityRouter,
  runYoloDryRunProviderPath,
  sanitizeVisionMetadataPayload,
  validateVisionCameraRequest,
  validateVisionScreenshotRequest,
  type MockCameraFrameDescriptor,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionReplayMetadata,
  type VisionRouterResult,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const HASH_A =
  "sha256:1515151515151515151515151515151515151515151515151515151515151515";
const HASH_B =
  "sha256:2525252525252525252525252525252525252525252525252525252525252525";

function screenshotRequest(
  source: NonNullable<VisionScreenshotRequest["trigger"]>["source"] = "user",
): VisionScreenshotRequest {
  return {
    request_id: `phase-15-final-shot-${source.replace("_", "-")}`,
    input_kind: "screenshot.full",
    trigger: {
      trigger_id: `phase-15-final-shot-trigger-${source.replace("_", "-")}`,
      source,
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

function cameraRequest(
  inputKind: VisionCameraRequest["input_kind"] = "camera.frame.mock",
): VisionCameraRequest {
  return {
    request_id: `phase-15-final-camera-${inputKind.split(".").at(-1)}`,
    input_kind: inputKind,
    environment: "test",
    trigger: {
      trigger_id: "phase-15-final-camera-trigger",
      source: "user",
      explicit_user_action: true,
      surface: "test",
      initiated_at_ms: 20,
      metadata_only: true,
    },
    frame: {
      frame_id: "phase-15-final-camera-frame",
      mock_fixture_id: "phase-15-final-fixture",
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
      indicator_id: "phase-15-final-indicator",
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
    artifact_id: "phase-15-final-ocr-artifact",
    created_at_ms: 30,
  });
  if (!artifact.ok) throw new Error("expected safe OCR artifact");
  return artifact.artifact;
}

function safeDetectionArtifact(): VisionDetectionInputArtifact {
  const frame: MockCameraFrameDescriptor = {
    frame_id: "phase-15-final-detection-frame",
    mock_fixture_id: "phase-15-final-detection-fixture",
    stream_id: "phase-15-final-detection-stream",
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
    artifact_id: "phase-15-final-detection-artifact",
    created_at_ms: 31,
  });
  if (!artifact.ok) throw new Error("expected safe detection artifact");
  return artifact.artifact;
}

function ocrProviderRequest(
  artifact: VisionOcrInputArtifact,
): VisionOcrArtifactProviderRunRequest {
  return {
    request_id: "phase-15-final-tesseract",
    session_id: "phase-15-final-tesseract-session",
    capability: "screenshot_ocr",
    input_kind: "screenshot",
    user_triggered: true,
    timeout_ms: 5_000,
    requested_at_ms: 40,
    environment: "test",
    metadata_only: true,
    ocr_artifact: artifact,
  };
}

function detectionProviderRequest(
  artifact: VisionDetectionInputArtifact,
): VisionDetectionArtifactProviderRunRequest {
  return {
    request_id: "phase-15-final-yolo",
    session_id: "phase-15-final-yolo-session",
    capability: "object_detection",
    input_kind: "mock_camera_frame",
    user_triggered: true,
    timeout_ms: 5_000,
    requested_at_ms: 41,
    environment: "test",
    metadata_only: true,
    detection_artifact: artifact,
  };
}

function readRecursiveTsFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readRecursiveTsFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

function visionRuntimeSourceFiles(): readonly {
  readonly path: string;
  readonly source: string;
}[] {
  return readRecursiveTsFiles(VISION_RUNTIME_SOURCE_ROOT).map((path) => ({
    path: relative(process.cwd(), path).replace(/\\/g, "/"),
    source: readFileSync(path, "utf8"),
  }));
}

function combinedVisionRuntimeSource(): string {
  return visionRuntimeSourceFiles()
    .map((file) => file.source)
    .join("\n");
}

function packageJson(): {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
} {
  return JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
  };
}

function expectMetadataSafeAuthorityFalse(
  value: VisionRouterResult | VisionReplayMetadata,
): void {
  expect(value).toMatchObject({
    metadata_only: true,
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
  expect(sanitizeVisionMetadataPayload(value)).toMatchObject({ ok: true });
  expect(JSON.stringify(value)).not.toMatch(
    /raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload|data:image|ocr_text_value|extracted_text|detection_label_value|detected_class|class_name|object_name|prompt_payload|response_payload|tool_output|file_contents|secret_value|api_key_value|token_value|password_value/i,
  );
}

describe("Phase 15 final closeout audit", () => {
  it("publishes the final governed fake/dry-run status with real providers disabled", () => {
    expect(PHASE_15_VISION_RUNTIME_STATUS).toEqual({
      phase: 15,
      status: "fake_dry_run_governed",
      verdict: "pass_with_notes",
      real_ocr_enabled: false,
      real_detection_enabled: false,
      real_camera_enabled: false,
      cloud_vision_enabled: false,
      metadata_only: true,
      replay_safe: true,
      advisory_only: true,
      non_executable: true,
      non_authoritative: true,
    });

    expect(PHASE_15_DISABLED_FEATURES).toEqual(
      expect.arrayContaining([
        "real_camera_activation",
        "always_on_vision",
        "background_screenshots",
        "periodic_screenshots",
        "continuous_camera_stream",
        "cloud_vision_default_enablement",
        "autonomous_visual_actions",
        "raw_image_frame_telemetry",
        "graph_driven_execution",
        "vision_triggered_device_project_runtime_mutation",
      ]),
    );
  });

  it("keeps screenshot user-triggered and camera mock-only with real camera denied", () => {
    expect(validateVisionScreenshotRequest(screenshotRequest())).toMatchObject({
      status: "accepted",
      provider_execution_allowed: true,
      session_execution_allowed: true,
      raw_image_included: false,
      ocr_text_included: false,
    });
    expect(
      validateVisionScreenshotRequest(screenshotRequest("assistant")),
    ).toMatchObject({
      status: "denied",
      reason: "assistant_trigger_forbidden",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
    expect(validateVisionCameraRequest(cameraRequest())).toMatchObject({
      status: "accepted",
      provider_execution_allowed: true,
      session_execution_allowed: true,
      active_indicator_required: true,
      active_indicator_visible: true,
    });
    expect(
      validateVisionCameraRequest(cameraRequest("camera.frame.real")),
    ).toMatchObject({
      status: "denied",
      reason: "real_camera_disabled",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
  });

  it("keeps the unified router limited to fake and dry-run disabled paths", async () => {
    const screenshotResult = await runVisionCapabilityRouter({
      request_id: "phase-15-final-router-shot",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 100,
      metadata_only: true,
      screenshot_request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
    });
    const cameraResult = await runVisionCapabilityRouter({
      request_id: "phase-15-final-router-camera",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "fake",
      requested_at_ms: 101,
      metadata_only: true,
      camera_request: cameraRequest(),
      stream_options: streamOptions(),
    });
    const tesseractResult = await runVisionCapabilityRouter({
      request_id: "phase-15-final-router-tesseract",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "dry_run_disabled",
      requested_at_ms: 102,
      metadata_only: true,
      ocr_artifact: await safeOcrArtifact(),
    });
    const yoloResult = await runVisionCapabilityRouter({
      request_id: "phase-15-final-router-yolo",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      mode: "dry_run_disabled",
      requested_at_ms: 103,
      metadata_only: true,
      detection_artifact: safeDetectionArtifact(),
    });
    const unsupported = await runVisionCapabilityRouter({
      request_id: "phase-15-final-router-real",
      capability: "real_camera",
      input_kind: "real_camera_frame",
      mode: "fake",
      requested_at_ms: 104,
      metadata_only: true,
    });

    expect(screenshotResult.provider_result).toMatchObject({
      provider_kind: "fake_ocr",
      status: "success",
    });
    expect(cameraResult.provider_result).toMatchObject({
      provider_kind: "fake_object_detector",
      status: "success",
    });
    expect(tesseractResult.provider_result).toMatchObject({
      provider_kind: "tesseract_stub",
      status: "execution_disabled",
    });
    expect(yoloResult.provider_result).toMatchObject({
      provider_kind: "yolo_stub",
      status: "execution_disabled",
    });
    expect(unsupported).toMatchObject({
      status: "denied",
      reason: "unsupported_route",
      provider_result: null,
      observations: [],
    });

    for (const result of [
      screenshotResult,
      cameraResult,
      tesseractResult,
      yoloResult,
      unsupported,
    ]) {
      expectMetadataSafeAuthorityFalse(result);
    }
  });

  it("keeps replay metadata normalized, advisory, derived, and non-executable", async () => {
    const routerResults = [
      await runVisionCapabilityRouter({
        request_id: "phase-15-final-replay-shot",
        capability: "screenshot_ocr",
        input_kind: "screenshot",
        mode: "fake",
        requested_at_ms: 110,
        metadata_only: true,
        screenshot_request: screenshotRequest(),
        capture_options: screenshotCaptureOptions(),
      }),
      await runVisionCapabilityRouter({
        request_id: "phase-15-final-replay-camera",
        capability: "object_detection",
        input_kind: "mock_camera_frame",
        mode: "fake",
        requested_at_ms: 111,
        metadata_only: true,
        camera_request: cameraRequest(),
        stream_options: streamOptions(),
      }),
    ];

    for (const routerResult of routerResults) {
      const normalized = normalizeVisionRouterResult(routerResult);
      expect(normalized).toMatchObject({ ok: true });
      if (!normalized.ok) throw new Error("expected replay metadata");
      expect(normalized.replay).toMatchObject({
        replay_safe: true,
        metadata_only: true,
        derived: true,
        advisory: true,
        advisory_only: true,
        fallback_used: false,
      });
      expectMetadataSafeAuthorityFalse(normalized.replay);
    }

    expect(
      normalizeVisionRouterResult({
        ...routerResults[0],
        prompt_payload: "unsafe",
      }),
    ).toMatchObject({
      ok: false,
      reason: "unsafe_payload",
      field_path: "prompt_payload",
    });
  });

  it("keeps OCR and YOLO dry-run providers non-executing and outside default registry authority", async () => {
    const ocrArtifact = await safeOcrArtifact();
    const detectionArtifact = safeDetectionArtifact();
    const tesseractDryRun = runTesseractDryRunProviderPath({
      config: {
        ...DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
        enabled: true,
      },
      request: ocrProviderRequest(ocrArtifact),
      metadata_only: true,
    });
    const yoloDryRun = runYoloDryRunProviderPath({
      config: {
        ...DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
        enabled: true,
      },
      request: detectionProviderRequest(detectionArtifact),
      metadata_only: true,
    });

    expect(tesseractDryRun).toMatchObject({
      enablement_allowed: true,
      invocation_plan_created: true,
      provider_result: {
        provider_kind: "tesseract_stub",
        status: "execution_disabled",
        runtime_executed: false,
        cloud_called: false,
      },
      invocation_result: {
        status: "execution_disabled",
        provider_executed: false,
        runtime_executed: false,
      },
    });
    expect(yoloDryRun).toMatchObject({
      enablement_allowed: true,
      invocation_plan_created: true,
      provider_result: {
        provider_kind: "yolo_stub",
        status: "execution_disabled",
        runtime_executed: false,
        cloud_called: false,
      },
      invocation_result: {
        status: "execution_disabled",
        provider_executed: false,
        runtime_executed: false,
      },
    });

    await expect(
      createDisabledTesseractDryRunProvider({ enabled: true }).run(
        ocrProviderRequest(ocrArtifact),
      ),
    ).resolves.toMatchObject({
      provider_result: { status: "execution_disabled" },
    });
    await expect(
      createDisabledYoloDryRunProvider({ enabled: true }).run(
        detectionProviderRequest(detectionArtifact),
      ),
    ).resolves.toMatchObject({
      provider_result: { status: "execution_disabled" },
    });

    const registry = VisionProviderRegistry.createFakeOnly();
    if (!registry.ok) throw new Error("fake-only registry should initialize");
    expect(
      registry.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
  });

  it("keeps raw payload, OCR text, detection output, secrets, and executable payloads blocked", async () => {
    const safeRouterResult = await runVisionCapabilityRouter({
      request_id: "phase-15-final-unsafe-router",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      mode: "fake",
      requested_at_ms: 120,
      metadata_only: true,
      screenshot_request: screenshotRequest(),
      capture_options: screenshotCaptureOptions(),
    });

    const unsafePayloads = [
      { raw_image_payload: "unsafe" },
      { raw_frame_payload: "unsafe" },
      { image_bytes: new Uint8Array([1, 2, 3]) },
      { base64_payload: "base64,unsafe" },
      { image_data_url: "data:image/png;base64,unsafe" },
      { ocr_text_value: "unsafe" },
      { extracted_text: "unsafe" },
      { detection_label_value: "unsafe" },
      { detected_class: "unsafe" },
      { prompt_payload: "unsafe" },
      { response_payload: "unsafe" },
      { tool_output: "unsafe" },
      { file_contents: "unsafe" },
      { secret_value: "unsafe" },
      { api_key_value: "unsafe" },
      { token_value: "unsafe" },
      { password_value: "unsafe" },
    ];

    for (const unsafePayload of unsafePayloads) {
      expect(
        sanitizeVisionMetadataPayload({
          ...safeRouterResult,
          ...unsafePayload,
        }),
      ).toMatchObject({
        ok: false,
        redaction_status: "withheld",
      });
      expect(
        normalizeVisionRouterResult({
          ...safeRouterResult,
          ...unsafePayload,
        }),
      ).toMatchObject({
        ok: false,
        reason: "unsafe_payload",
      });
    }
  });

  it("keeps real provider, capture, media, network, UI, persistence, and mutation markers absent", () => {
    const sourceText = combinedVisionRuntimeSource();
    const packageNames = [
      ...Object.keys(packageJson().dependencies ?? {}),
      ...Object.keys(packageJson().devDependencies ?? {}),
    ].join("\n");

    expect(packageNames).not.toMatch(
      /(?:^|[-_@/])(node-tesseract-ocr|tesseract\.js|paddleocr|ultralytics|yolo|opencv|onnxruntime|tensorflow|tfjs|mediapipe)(?:$|[-_@/])/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:node-tesseract-ocr|tesseract\.js|paddleocr|ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:node-tesseract-ocr|tesseract\.js|paddleocr|ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']\s*\)/i,
    );
    expect(sourceText).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(|Command\.new|std::process|python\s*\(|python3|pyodide|subprocess/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob|@tauri-apps\/api|invoke\s*\(|screencapture|gnome-screenshot/i,
    );
    expect(sourceText).not.toMatch(
      /getUserMedia|mediaDevices|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https|from\s+["'](?:openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(sourceText).not.toMatch(
      /React|useEffect|useState|button|onClick|app\/api|globalShortcut/i,
    );
    expect(sourceText).not.toMatch(
      /readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(|createWriteStream|better-sqlite3|sqlite|database|indexedDB|localStorage|sessionStorage/i,
    );
    expect(sourceText).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|shell_command|approveAction\s*\(|grantApproval\s*\(|runAction\s*\(|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /graph_driven_execution_enabled:\s*true|runtime_execution_enabled:\s*true|replay_(?:run|execute|retry)|retry_(?:requested|enabled)|run_affordance|execute_affordance/i,
    );
  });

  it("does not include Phase 14 voice/runtime files in the current vision-runtime slice", () => {
    const changedFiles = execFileSync("git", ["diff", "--name-only"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => file.replace(/\\/g, "/"));

    expect(
      changedFiles.filter((file) =>
        /^(src|tests)\/.*(?:voice-runtime|voice-streaming|voice\/)/i.test(file),
      ),
    ).toEqual([]);
  });
});
