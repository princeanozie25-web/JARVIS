import { describe, expect, it } from "vitest";

import {
  VISION_LOCAL_OCR_MAX_TIMEOUT_MS,
  VisionProviderRegistry,
  createDisabledTesseractProvider,
  createFakeScreenshotCaptureAdapter,
  createVisionOcrArtifactFromScreenshotCapture,
  evaluateVisionOcrEnablement,
  sanitizeVisionMetadataPayload,
  type VisionLocalOcrProviderEnablementConfig,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  metadata_only: true,
} as const;

const screenshotRequest: VisionScreenshotRequest = {
  request_id: "ocr-enable-request",
  input_kind: "screenshot.region",
  trigger: {
    trigger_id: "ocr-enable-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  region: {
    region_id: "ocr-enable-region",
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

const enabledConfig: VisionLocalOcrProviderEnablementConfig = {
  provider_id: "tesseract-stub",
  provider_kind: "tesseract_stub",
  enabled: true,
  binary_path_configured: false,
  supported_capability: "screenshot_ocr",
  timeout_ms: 5_000,
  max_input_size_bytes: 5_000_000,
  language: "eng",
  cloud_fallback_requested: false,
  network_fallback_requested: false,
  metadata_only: true,
  redaction_required: true,
  raw_image_input_allowed: false,
  raw_ocr_text_output_allowed: false,
  process_execution_allowed: false,
  persistence_allowed: false,
};

async function safeArtifact(): Promise<VisionOcrInputArtifact> {
  const capture = await createFakeScreenshotCaptureAdapter().capture(
    screenshotRequest,
    captureOptions,
  );
  const artifact = createVisionOcrArtifactFromScreenshotCapture({
    capture,
    created_at_ms: 20,
  });
  if (!artifact.ok) throw new Error("expected safe OCR artifact");
  return artifact.artifact;
}

async function evaluate(
  overrides: Partial<Parameters<typeof evaluateVisionOcrEnablement>[0]> = {},
) {
  const artifact = await safeArtifact();
  return evaluateVisionOcrEnablement({
    provider_config: enabledConfig,
    capability: "screenshot_ocr",
    artifact,
    user_triggered: true,
    timeout_ms: 5_000,
    metadata_only: true,
    ...overrides,
  });
}

describe("Phase 15C.3 OCR provider enablement gate", () => {
  it("fails disabled provider config as provider_disabled", async () => {
    await expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          enabled: false,
        },
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "provider_disabled",
      provider_id: "tesseract-stub",
      artifact_id: null,
      metadata_only: true,
      raw_payload_included: false,
      provider_executed: false,
    });
  });

  it("fails invalid artifacts as precondition failures", async () => {
    await expect(evaluate({ artifact: {} })).resolves.toMatchObject({
      allowed: false,
      reason: "invalid_artifact",
      artifact_id: null,
      artifact_validation_reason: "invalid_payload",
      metadata_only: true,
    });
  });

  it("fails non-ephemeral artifacts", async () => {
    const artifact = await safeArtifact();

    expect(
      evaluateVisionOcrEnablement({
        provider_config: enabledConfig,
        capability: "screenshot_ocr",
        artifact: {
          ...artifact,
          retention_policy: "persist_until_restart",
        },
        user_triggered: true,
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "non_ephemeral_retention_forbidden",
      artifact_validation_reason: "non_ephemeral_retention_forbidden",
    });
  });

  it("fails remote source references", async () => {
    const artifact = await safeArtifact();

    expect(
      evaluateVisionOcrEnablement({
        provider_config: enabledConfig,
        capability: "screenshot_ocr",
        artifact: {
          ...artifact,
          source_ref_id: "https://example.test/image.png",
        },
        user_triggered: true,
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "remote_source_forbidden",
      artifact_validation_reason: "remote_url_forbidden",
    });
  });

  it("fails cloud and network fallback requests", async () => {
    await expect(
      evaluate({ cloud_fallback_requested: true }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "cloud_fallback_forbidden",
    });
    await expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          network_fallback_requested: true,
        },
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "network_fallback_forbidden",
    });
  });

  it("fails mutation authority requests", async () => {
    await expect(
      evaluate({
        mutation_authority_requested: ["tool_trigger"],
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "mutation_authority_forbidden",
      mutation_authority_granted: false,
    });
  });

  it("fails unsafe language config and oversized timeouts", async () => {
    await expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          language: "eng+unsafe",
        },
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "language_not_allowlisted",
    });
    await expect(
      evaluate({
        timeout_ms: VISION_LOCAL_OCR_MAX_TIMEOUT_MS + 1,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "timeout_out_of_bounds",
    });
  });

  it("allows valid local metadata-only artifact preconditions", async () => {
    const result = await evaluate();

    expect(result).toMatchObject({
      allowed: true,
      reason: "allowed",
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      capability: "screenshot_ocr",
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
    expect(result.artifact_id).toBe("ocr-enable-request-capture-ocr-artifact");
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("keeps the Tesseract stub execution-disabled even when preconditions pass", async () => {
    const artifact = await safeArtifact();
    const request: VisionOcrArtifactProviderRunRequest = {
      request_id: "ocr-enable-provider-request",
      session_id: "ocr-enable-provider-session",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      user_triggered: true,
      timeout_ms: 5_000,
      requested_at_ms: 30,
      environment: "test",
      metadata_only: true,
      ocr_artifact: artifact,
    };
    const result = await createDisabledTesseractProvider({
      enabled: true,
    }).run(request);

    expect(result).toMatchObject({
      observations: [],
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_kind: "tesseract_stub",
      status: "execution_disabled",
      reason: "not_implemented",
      observation_count: 0,
      raw_payload_included: false,
      raw_ocr_text_included: false,
      cloud_called: false,
      runtime_executed: false,
    });
  });

  it("keeps default provider registry fake-only", () => {
    const result = VisionProviderRegistry.createFakeOnly();
    if (!result.ok) throw new Error("fake-only registry should initialize");

    expect(
      result.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
  });
});
