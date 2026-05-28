import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS,
  createVisionDetectionArtifactFromMockCameraFrame,
  createYoloInvocationPlan,
  evaluateVisionDetectionEnablement,
  runDisabledYoloInvocation,
  sanitizeVisionMetadataPayload,
  type MockCameraFrameDescriptor,
  type VisionDetectionEnablementResult,
  type VisionDetectionInputArtifact,
  type VisionLocalDetectionProviderEnablementConfig,
} from "../../src/lib/vision-runtime";

const mockFrame: MockCameraFrameDescriptor = {
  frame_id: "yolo-invocation-frame",
  mock_fixture_id: "fixture-yolo-invocation",
  stream_id: "yolo-invocation-stream",
  frame_index: 0,
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:1212121212121212121212121212121212121212121212121212121212121212",
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

const enabledConfig: VisionLocalDetectionProviderEnablementConfig = {
  provider_id: "yolo-stub",
  provider_kind: "yolo_stub",
  enabled: true,
  model_name: "yolo-disabled-stub",
  weights_configured: false,
  supported_capability: "object_detection",
  timeout_ms: 5_000,
  confidence_threshold: 0.5,
  max_input_size_bytes: 5_000_000,
  cloud_fallback_requested: false,
  network_fallback_requested: false,
  metadata_only: true,
  redaction_required: true,
  raw_image_input_allowed: false,
  raw_detection_output_allowed: false,
  detection_results_included: false,
  python_execution_allowed: false,
  process_execution_allowed: false,
  persistence_allowed: false,
};

function safeArtifact(): VisionDetectionInputArtifact {
  const result = createVisionDetectionArtifactFromMockCameraFrame({
    frame: mockFrame,
    created_at_ms: 20,
  });
  if (!result.ok) throw new Error("expected safe detection artifact");
  return result.artifact;
}

function allowedEnablement(
  artifact: VisionDetectionInputArtifact,
): VisionDetectionEnablementResult {
  return evaluateVisionDetectionEnablement({
    provider_config: enabledConfig,
    capability: "object_detection",
    artifact,
    timeout_ms: 5_000,
    metadata_only: true,
  });
}

describe("Phase 15E.4 YOLO invocation boundary", () => {
  it("creates a metadata-only invocation plan from valid preconditions", () => {
    const artifact = safeArtifact();
    const enablement = allowedEnablement(artifact);
    const planResult = createYoloInvocationPlan({
      invocation_id: "yolo-invocation",
      artifact,
      enablement,
      metadata_only: true,
    });

    expect(planResult).toMatchObject({ ok: true, result: null });
    if (!planResult.ok) throw new Error("expected invocation plan");
    expect(planResult.plan).toMatchObject({
      invocation_id: "yolo-invocation",
      provider_id: "yolo-stub",
      artifact_id: artifact.artifact_id,
      artifact_kind: "mock_camera_frame",
      source_ref_kind: "mock_frame_ref",
      model_name: "yolo-disabled-stub",
      confidence_threshold: 0.5,
      timeout_ms: 5_000,
      redacted_source_id: "redacted",
      source_id_hash: mockFrame.source_id_hash,
      execution_mode: "disabled_stub",
      filesystem_path: null,
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
      detection_results_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
    expect(sanitizeVisionMetadataPayload(planResult.plan)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("does not create a runnable plan when preconditions fail", () => {
    const artifact = safeArtifact();
    const enablement = evaluateVisionDetectionEnablement({
      provider_config: {
        ...enabledConfig,
        enabled: false,
      },
      capability: "object_detection",
      artifact,
      timeout_ms: 5_000,
      metadata_only: true,
    });

    expect(
      createYoloInvocationPlan({
        artifact,
        enablement,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      plan: null,
      result: {
        status: "provider_disabled",
        metadata_only: true,
        raw_payload_included: false,
        provider_executed: false,
      },
    });
  });

  it("disabled invocation always returns execution_disabled", () => {
    const artifact = safeArtifact();
    const planResult = createYoloInvocationPlan({
      artifact,
      enablement: allowedEnablement(artifact),
      metadata_only: true,
    });
    if (!planResult.ok) throw new Error("expected invocation plan");

    expect(runDisabledYoloInvocation(planResult.plan)).toMatchObject({
      invocation_id: "yolo-stub-invocation",
      provider_id: "yolo-stub",
      artifact_id: artifact.artifact_id,
      status: "execution_disabled",
      reason: "execution_disabled",
      redaction_status: "metadata_only",
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
      detection_results_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
  });

  it("rejects raw bytes, base64, detection labels, and OCR text before planning", () => {
    const artifact = safeArtifact();
    const enablement = allowedEnablement(artifact);

    for (const unsafeArtifact of [
      { ...artifact, raw_bytes: new Uint8Array([1, 2, 3]) },
      { ...artifact, source_ref_id: "data:image/png;base64,aW1hZ2U=" },
      { ...artifact, detection_label: "unsafe object" },
      { ...artifact, ocr_text: "unsafe text" },
    ]) {
      expect(
        createYoloInvocationPlan({
          artifact: unsafeArtifact,
          enablement,
          metadata_only: true,
        }),
      ).toMatchObject({
        ok: false,
        plan: null,
        result: {
          status: "unsafe_payload_rejected",
          raw_payload_included: false,
        },
      });
    }
  });

  it("rejects remote URL sources before planning", () => {
    const artifact = safeArtifact();
    const enablement = allowedEnablement(artifact);

    expect(
      createYoloInvocationPlan({
        artifact: {
          ...artifact,
          source_ref_id: "https://example.test/frame.png",
        },
        enablement,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      plan: null,
      result: {
        status: "unsafe_payload_rejected",
      },
    });
  });

  it("inherits unsafe model, confidence, and timeout failed preconditions", () => {
    const artifact = safeArtifact();
    const badModel = evaluateVisionDetectionEnablement({
      provider_config: {
        ...enabledConfig,
        model_name: "real-yolo-weights",
      },
      capability: "object_detection",
      artifact,
      timeout_ms: 5_000,
      metadata_only: true,
    });
    const badConfidence = evaluateVisionDetectionEnablement({
      provider_config: {
        ...enabledConfig,
        confidence_threshold: 1,
      },
      capability: "object_detection",
      artifact,
      timeout_ms: 5_000,
      metadata_only: true,
    });
    const badTimeout = evaluateVisionDetectionEnablement({
      provider_config: enabledConfig,
      capability: "object_detection",
      artifact,
      timeout_ms: VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS + 1,
      metadata_only: true,
    });

    expect(
      createYoloInvocationPlan({
        artifact,
        enablement: badModel,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      result: { status: "model_not_allowed" },
    });
    expect(
      createYoloInvocationPlan({
        artifact,
        enablement: badConfidence,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      result: { status: "confidence_config_invalid" },
    });
    expect(
      createYoloInvocationPlan({
        artifact,
        enablement: badTimeout,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      result: { status: "timeout_config_invalid" },
    });
  });

  it("keeps invocation module free of Python, process, file-read, and detection package imports", () => {
    const sourceText = readFileSync(
      join(process.cwd(), "src/lib/vision-runtime/yolo-invocation.ts"),
      "utf8",
    );

    expect(sourceText).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /python\s*\(|python3|pyodide|subprocess|readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']\s*\)/i,
    );
  });

  it("does not include detection labels, classes, or results in any plan or result payload", () => {
    const artifact = safeArtifact();
    const planResult = createYoloInvocationPlan({
      artifact,
      enablement: allowedEnablement(artifact),
      metadata_only: true,
    });
    if (!planResult.ok) throw new Error("expected invocation plan");
    const result = runDisabledYoloInvocation(planResult.plan);

    expect(JSON.stringify({ plan: planResult.plan, result })).not.toMatch(
      /object_label|detection_label_value|bounding_box|detected_class|class_name|object_name|real_detection_result/i,
    );
  });
});
