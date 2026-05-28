import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  VisionProviderRegistry,
  createDisabledYoloDryRunProvider,
  createVisionDetectionArtifactFromMockCameraFrame,
  runYoloDryRunProviderPath,
  sanitizeVisionMetadataPayload,
  sanitizeVisionProviderResult,
  type DisabledYoloProviderConfig,
  type MockCameraFrameDescriptor,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
} from "../../src/lib/vision-runtime";

const mockFrame: MockCameraFrameDescriptor = {
  frame_id: "yolo-dry-run-frame",
  mock_fixture_id: "fixture-yolo-dry-run",
  stream_id: "yolo-dry-run-stream",
  frame_index: 0,
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:3434343434343434343434343434343434343434343434343434343434343434",
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

const enabledConfig: DisabledYoloProviderConfig = {
  ...DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  enabled: true,
};

function safeArtifact(): VisionDetectionInputArtifact {
  const artifact = createVisionDetectionArtifactFromMockCameraFrame({
    frame: mockFrame,
    created_at_ms: 20,
  });
  if (!artifact.ok) throw new Error("expected safe detection artifact");
  return artifact.artifact;
}

function providerRequest(
  artifact: VisionDetectionInputArtifact,
): VisionDetectionArtifactProviderRunRequest {
  return {
    request_id: "yolo-dry-run-provider-request",
    session_id: "yolo-dry-run-provider-session",
    capability: "object_detection",
    input_kind: "mock_camera_frame",
    user_triggered: true,
    timeout_ms: 5_000,
    requested_at_ms: 30,
    environment: "test",
    metadata_only: true,
    detection_artifact: artifact,
  };
}

describe("Phase 15E.5 YOLO provider dry-run integration path", () => {
  it("returns provider_disabled before invocation for disabled config", () => {
    const artifact = safeArtifact();
    const result = runYoloDryRunProviderPath({
      config: DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
      request: providerRequest(artifact),
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: false,
      enablement_reason: "provider_disabled",
      invocation_plan_created: false,
      invocation_result: null,
      observations: [],
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      status: "provider_disabled",
      reason: "provider_disabled",
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      runtime_executed: false,
    });
  });

  it("returns precondition_failed and creates no invocation plan for invalid artifacts", () => {
    const request = {
      ...providerRequest(safeArtifact()),
      detection_artifact: {
        raw_bytes: new Uint8Array([1, 2, 3]),
      },
    };
    const result = runYoloDryRunProviderPath({
      config: enabledConfig,
      request,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: false,
      enablement_reason: "unsafe_payload",
      invocation_plan_created: false,
      invocation_result: null,
      provider_result: {
        status: "precondition_failed",
        reason: "precondition_failed",
      },
    });
  });

  it("creates a plan for valid metadata-only artifacts but returns execution_disabled", () => {
    const artifact = safeArtifact();
    const result = runYoloDryRunProviderPath({
      config: enabledConfig,
      request: providerRequest(artifact),
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: true,
      enablement_reason: "allowed",
      invocation_plan_created: true,
      invocation_result: {
        status: "execution_disabled",
        reason: "execution_disabled",
        artifact_id: artifact.artifact_id,
        raw_payload_included: false,
        raw_image_included: false,
        raw_frame_included: false,
        base64_included: false,
        ocr_text_included: false,
        detection_labels_included: false,
        detection_results_included: false,
        provider_executed: false,
        runtime_executed: false,
      },
      provider_result: {
        status: "execution_disabled",
        reason: "not_implemented",
        observation_count: 0,
        raw_payload_included: false,
        raw_ocr_text_included: false,
        cloud_called: false,
        runtime_executed: false,
      },
    });
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("explicit dry-run provider construction does not broaden default authority", async () => {
    const artifact = safeArtifact();
    const provider = createDisabledYoloDryRunProvider({ enabled: true });
    const result = await provider.run(providerRequest(artifact));

    expect(result.provider_result).toMatchObject({
      provider_kind: "yolo_stub",
      status: "execution_disabled",
      raw_payload_included: false,
      runtime_executed: false,
    });

    const registry = VisionProviderRegistry.createFakeOnly();
    if (!registry.ok) throw new Error("fake-only registry should initialize");
    expect(
      registry.registry.listProviders().map((registered) => registered.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
  });

  it("does not leak raw bytes, base64, detection labels, classes, results, paths, prompts, responses, or tool output", () => {
    const artifact = safeArtifact();
    const result = runYoloDryRunProviderPath({
      config: enabledConfig,
      request: providerRequest(artifact),
      metadata_only: true,
    });

    expect(JSON.stringify(result)).not.toMatch(
      /raw_bytes|image_bytes|frame_bytes|base64_payload|data:image|object_label|detection_label_value|bounding_box|detected_class|class_name|object_name|filesystem_path|[A-Z]:\\|prompt|response|tool_output|file_contents/i,
    );
  });

  it("keeps Python, subprocess, file, network, and detection dependency markers absent", () => {
    const sourceText = readVisionRuntimeSource();
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const packageNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ].join("\n");

    expect(packageNames).not.toMatch(
      /(?:^|[-_@/])(ultralytics|yolo|opencv|onnxruntime|tensorflow|tfjs|mediapipe)(?:$|[-_@/])/i,
    );
    expect(sourceText).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /python\s*\(|python3|pyodide|subprocess|readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']\s*\)/i,
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
