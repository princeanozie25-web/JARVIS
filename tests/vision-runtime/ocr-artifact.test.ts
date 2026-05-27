import { describe, expect, it } from "vitest";

import {
  VisionProviderRegistry,
  createDisabledTesseractProvider,
  createFakeScreenshotCaptureAdapter,
  createVisionOcrArtifactFromScreenshotCapture,
  sanitizeVisionMetadataPayload,
  validateVisionOcrInputArtifact,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  metadata_only: true,
} as const;

const validScreenshotRequest: VisionScreenshotRequest = {
  request_id: "ocr-artifact-request",
  input_kind: "screenshot.region",
  trigger: {
    trigger_id: "ocr-artifact-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  region: {
    region_id: "ocr-artifact-region",
    width_px: 640,
    height_px: 360,
    coordinate_space: "redacted_screen_region",
    exact_pixel_coordinates_included: false,
    metadata_only: true,
  },
  source,
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  ocr_text_included: false,
};

const captureOptions: VisionScreenshotCaptureOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
};

async function safeArtifactFromFakeCapture(): Promise<VisionOcrInputArtifact> {
  const capture = await createFakeScreenshotCaptureAdapter().capture(
    validScreenshotRequest,
    captureOptions,
  );
  const artifactResult = createVisionOcrArtifactFromScreenshotCapture({
    capture,
    created_at_ms: 20,
  });
  if (!artifactResult.ok) {
    throw new Error("expected fake capture artifact to be valid");
  }
  return artifactResult.artifact;
}

describe("Phase 15C.2 OCR input artifact contract", () => {
  it("creates a safe OCR artifact from valid fake screenshot capture metadata", async () => {
    const artifact = await safeArtifactFromFakeCapture();

    expect(artifact).toMatchObject({
      artifact_id: "ocr-artifact-request-capture-ocr-artifact",
      artifact_kind: "screenshot_capture",
      source_ref_kind: "redacted_ref",
      source_ref_id: "ocr-artifact-request-capture-ref",
      redacted_source_id: "redacted",
      source_id_hash: source.source_id_hash,
      mime_type_hint: "image/unknown",
      size_band: "medium",
      width_band: "medium",
      height_band: "small",
      created_at_ms: 20,
      retention_policy: "ephemeral_only",
      sensitivity_class: "sensitive",
      redaction_status: "metadata_only",
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      persisted: false,
    });
    expect(sanitizeVisionMetadataPayload(artifact)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(artifact)).not.toMatch(
      /raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload|ocr_text_value|extracted_text|file_contents/i,
    );
  });

  it("defaults artifacts to ephemeral-only retention", () => {
    const result = validateVisionOcrInputArtifact({
      ...baseArtifact(),
      retention_policy: undefined,
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.artifact.retention_policy).toBe("ephemeral_only");
    }
  });

  it("rejects raw bytes, typed arrays, base64, and data URLs", () => {
    for (const payload of [
      { ...baseArtifact(), raw_bytes: new Uint8Array([1, 2, 3]) },
      { ...baseArtifact(), image_bytes: new ArrayBuffer(8) },
      { ...baseArtifact(), base64: "aW1hZ2U=" },
      { ...baseArtifact(), source_ref_id: "data:image/png;base64,aW1hZ2U=" },
    ]) {
      const result = validateVisionOcrInputArtifact(payload);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(
        /forbidden_field|raw_binary_payload|base64_or_data_url_forbidden/,
      );
    }
  });

  it("rejects OCR text and extracted text fields", () => {
    for (const field of ["ocr_text", "extracted_text"] as const) {
      expect(
        validateVisionOcrInputArtifact({
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
      validateVisionOcrInputArtifact({
        ...baseArtifact(),
        source_ref_id: "https://example.test/image.png",
      }),
    ).toMatchObject({
      ok: false,
      reason: "remote_url_forbidden",
      field_path: "source_ref_id",
    });
  });

  it("rejects direct filesystem paths unless explicitly marked as a test fixture", () => {
    expect(
      validateVisionOcrInputArtifact({
        ...baseArtifact(),
        filesystem_path: "C:\\temp\\image.png",
      }),
    ).toMatchObject({
      ok: false,
      reason: "direct_filesystem_path_forbidden",
      field_path: "filesystem_path",
    });

    expect(
      validateVisionOcrInputArtifact({
        ...baseArtifact(),
        artifact_kind: "test_fixture",
        source_ref_kind: "fixture_ref",
        filesystem_path: "tests/fixtures/vision-safe-fixture.png",
      }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("fails closed on unknown artifact and source reference kinds", () => {
    expect(
      validateVisionOcrInputArtifact({
        ...baseArtifact(),
        artifact_kind: "live_camera_frame",
      }),
    ).toMatchObject({
      ok: false,
      reason: "unknown_artifact_kind",
      field_path: "artifact_kind",
    });
    expect(
      validateVisionOcrInputArtifact({
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
        validateVisionOcrInputArtifact({
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

  it("passes a safe artifact to the disabled Tesseract stub and still fails closed", async () => {
    const artifact = await safeArtifactFromFakeCapture();
    const request: VisionOcrArtifactProviderRunRequest = {
      request_id: "ocr-artifact-provider-run",
      session_id: "ocr-artifact-provider-session",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 30,
      environment: "test",
      metadata_only: true,
      ocr_artifact: artifact,
    };
    const result = await createDisabledTesseractProvider().run(request);

    expect(result).toMatchObject({
      observations: [],
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_kind: "tesseract_stub",
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
  });
});

function baseArtifact(): Record<string, unknown> {
  return {
    artifact_id: "ocr-artifact",
    artifact_kind: "screenshot_capture",
    source_ref_kind: "redacted_ref",
    source_ref_id: "ocr-artifact-ref",
    redacted_source_id: "redacted",
    source_id_hash: source.source_id_hash,
    mime_type_hint: "image/unknown",
    size_band: "small",
    width_band: "small",
    height_band: "small",
    created_at_ms: 10,
    retention_policy: "ephemeral_only",
    sensitivity_class: "sensitive",
    redaction_status: "metadata_only",
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    persisted: false,
  };
}
