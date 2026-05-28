import { describe, expect, it } from "vitest";

import {
  VisionProviderRegistry,
  createDisabledYoloProvider,
  createVisionDetectionArtifactFromMockCameraFrame,
  sanitizeVisionMetadataPayload,
  validateVisionDetectionInputArtifact,
  type MockCameraFrameDescriptor,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
} from "../../src/lib/vision-runtime";

const mockFrame: MockCameraFrameDescriptor = {
  frame_id: "detection-artifact-frame",
  mock_fixture_id: "fixture-detection-front-desk",
  stream_id: "detection-artifact-stream",
  frame_index: 0,
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:abababababababababababababababababababababababababababababababab",
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

describe("Phase 15E.2 detection input artifact contract", () => {
  it("creates a safe detection artifact from valid mock camera frame metadata", () => {
    const result = createVisionDetectionArtifactFromMockCameraFrame({
      frame: mockFrame,
      created_at_ms: 20,
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected safe detection artifact");
    expect(result.artifact).toMatchObject({
      artifact_id: "detection-artifact-frame-detection-artifact",
      artifact_kind: "mock_camera_frame",
      source_ref_kind: "mock_frame_ref",
      source_ref_id: "detection-artifact-frame-ref",
      redacted_source_id: "redacted",
      source_id_hash: mockFrame.source_id_hash,
      mock_fixture_id: "fixture-detection-front-desk",
      frame_id: "detection-artifact-frame",
      mime_type_hint: "image/unknown",
      size_band: "medium",
      width_band: "medium",
      height_band: "small",
      created_at_ms: 20,
      retention_policy: "ephemeral_only",
      sensitivity_class: "sensitive",
      redaction_status: "metadata_only",
      active_indicator_required: true,
      active_indicator_visible: true,
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
      detection_results_included: false,
      persisted: false,
    });
    expect(sanitizeVisionMetadataPayload(result.artifact)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(result.artifact)).not.toMatch(
      /raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload|object_label|detection_label_value|bounding_box|ocr_text_value|extracted_text/i,
    );
  });

  it("defaults artifacts to ephemeral-only retention", () => {
    const result = validateVisionDetectionInputArtifact({
      ...baseArtifact(),
      retention_policy: undefined,
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.artifact.retention_policy).toBe("ephemeral_only");
    }
  });

  it("requires active indicator metadata for camera-derived artifacts", () => {
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        active_indicator_required: false,
      }),
    ).toMatchObject({
      ok: false,
      reason: "active_indicator_required",
      field_path: "active_indicator_visible",
    });
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        active_indicator_visible: false,
      }),
    ).toMatchObject({
      ok: false,
      reason: "active_indicator_required",
      field_path: "active_indicator_visible",
    });
  });

  it("rejects raw bytes, typed arrays, base64, and data URLs", () => {
    for (const payload of [
      { ...baseArtifact(), raw_bytes: new Uint8Array([1, 2, 3]) },
      { ...baseArtifact(), frame_bytes: new ArrayBuffer(8) },
      { ...baseArtifact(), base64: "aW1hZ2U=" },
      { ...baseArtifact(), source_ref_id: "data:image/png;base64,aW1hZ2U=" },
    ]) {
      const result = validateVisionDetectionInputArtifact(payload);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(
        /forbidden_field|raw_binary_payload|base64_or_data_url_forbidden/,
      );
    }
  });

  it("rejects detection labels, results, object classes, and object names", () => {
    for (const field of [
      "detection_label",
      "detection_results",
      "object_class",
      "object_name",
      "labels",
      "classes",
    ] as const) {
      expect(
        validateVisionDetectionInputArtifact({
          ...baseArtifact(),
          [field]: "unsafe",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("rejects OCR and extracted text fields", () => {
    for (const field of ["ocr_text", "extracted_text"] as const) {
      expect(
        validateVisionDetectionInputArtifact({
          ...baseArtifact(),
          [field]: "unsafe text",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("rejects remote URLs", () => {
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        source_ref_id: "https://example.test/frame.png",
      }),
    ).toMatchObject({
      ok: false,
      reason: "remote_url_forbidden",
      field_path: "source_ref_id",
    });
  });

  it("rejects direct filesystem paths unless explicitly marked as a test fixture", () => {
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        filesystem_path: "C:\\temp\\frame.png",
      }),
    ).toMatchObject({
      ok: false,
      reason: "direct_filesystem_path_forbidden",
      field_path: "filesystem_path",
    });

    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        artifact_kind: "test_fixture",
        source_ref_kind: "fixture_ref",
        source_ref_id: "vision-safe-fixture",
        mock_fixture_id: "vision-safe-fixture",
        frame_id: null,
        active_indicator_required: false,
        active_indicator_visible: false,
        filesystem_path: "tests/fixtures/vision-safe-detection.png",
      }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("fails closed on unknown artifact and source reference kinds", () => {
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        artifact_kind: "live_camera_frame",
      }),
    ).toMatchObject({
      ok: false,
      reason: "unknown_artifact_kind",
      field_path: "artifact_kind",
    });
    expect(
      validateVisionDetectionInputArtifact({
        ...baseArtifact(),
        source_ref_kind: "remote_url",
      }),
    ).toMatchObject({
      ok: false,
      reason: "unknown_source_ref_kind",
      field_path: "source_ref_kind",
    });
  });

  it("rejects secret, token, and password-like fields", () => {
    for (const field of ["secret", "api_key", "token", "password"] as const) {
      expect(
        validateVisionDetectionInputArtifact({
          ...baseArtifact(),
          [field]: "unsafe",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("passes a safe artifact to the disabled YOLO stub and still fails closed", async () => {
    const artifact = safeArtifactFromMockFrame();
    const request: VisionDetectionArtifactProviderRunRequest = {
      request_id: "detection-artifact-provider-run",
      session_id: "detection-artifact-provider-session",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 30,
      environment: "test",
      metadata_only: true,
      detection_artifact: artifact,
    };
    const result = await createDisabledYoloProvider().run(request);

    expect(result).toMatchObject({
      observations: [],
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_kind: "yolo_stub",
      status: "provider_disabled",
      policy_denied: false,
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      runtime_executed: false,
    });
  });

  it("keeps the default provider registry fake-only", () => {
    const registryResult = VisionProviderRegistry.createFakeOnly();
    if (!registryResult.ok) {
      throw new Error("fake-only registry should initialize");
    }

    expect(
      registryResult.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
    expect(
      registryResult.registry
        .listProviders()
        .some((provider) => provider.kind === "yolo_stub"),
    ).toBe(false);
  });
});

function safeArtifactFromMockFrame(): VisionDetectionInputArtifact {
  const result = createVisionDetectionArtifactFromMockCameraFrame({
    frame: mockFrame,
    created_at_ms: 20,
  });
  if (!result.ok) {
    throw new Error("expected mock frame artifact to be valid");
  }
  return result.artifact;
}

function baseArtifact(): Record<string, unknown> {
  return {
    artifact_id: "detection-artifact",
    artifact_kind: "mock_camera_frame",
    source_ref_kind: "mock_frame_ref",
    source_ref_id: "detection-artifact-ref",
    redacted_source_id: "redacted",
    source_id_hash: mockFrame.source_id_hash,
    mock_fixture_id: "fixture-detection-front-desk",
    frame_id: "detection-artifact-frame",
    mime_type_hint: "image/unknown",
    size_band: "small",
    width_band: "small",
    height_band: "small",
    created_at_ms: 10,
    retention_policy: "ephemeral_only",
    sensitivity_class: "sensitive",
    redaction_status: "metadata_only",
    active_indicator_required: true,
    active_indicator_visible: true,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    detection_results_included: false,
    persisted: false,
  };
}
