import { describe, expect, it } from "vitest";

import {
  VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS,
  VisionProviderRegistry,
  createDisabledYoloProvider,
  createVisionDetectionArtifactFromMockCameraFrame,
  evaluateVisionDetectionEnablement,
  sanitizeVisionMetadataPayload,
  type MockCameraFrameDescriptor,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
  type VisionLocalDetectionProviderEnablementConfig,
} from "../../src/lib/vision-runtime";

const mockFrame: MockCameraFrameDescriptor = {
  frame_id: "detection-enable-frame",
  mock_fixture_id: "fixture-detection-enable",
  stream_id: "detection-enable-stream",
  frame_index: 0,
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
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

function evaluate(
  overrides: Partial<
    Parameters<typeof evaluateVisionDetectionEnablement>[0]
  > = {},
) {
  return evaluateVisionDetectionEnablement({
    provider_config: enabledConfig,
    capability: "object_detection",
    artifact: safeArtifact(),
    timeout_ms: 5_000,
    metadata_only: true,
    ...overrides,
  });
}

describe("Phase 15E.3 object detection provider enablement gate", () => {
  it("fails disabled provider config as provider_disabled", () => {
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          enabled: false,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "provider_disabled",
      provider_id: "yolo-stub",
      artifact_id: null,
      metadata_only: true,
      raw_payload_included: false,
      provider_executed: false,
    });
  });

  it("fails invalid artifacts as precondition failures", () => {
    expect(evaluate({ artifact: {} })).toMatchObject({
      allowed: false,
      reason: "invalid_artifact",
      artifact_id: null,
      artifact_validation_reason: "invalid_payload",
      metadata_only: true,
    });
  });

  it("fails non-ephemeral artifacts", () => {
    const artifact = safeArtifact();

    expect(
      evaluateVisionDetectionEnablement({
        provider_config: enabledConfig,
        capability: "object_detection",
        artifact: {
          ...artifact,
          retention_policy: "persist_until_restart",
        },
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "non_ephemeral_retention_forbidden",
      artifact_validation_reason: "non_ephemeral_retention_forbidden",
    });
  });

  it("fails remote source references", () => {
    const artifact = safeArtifact();

    expect(
      evaluateVisionDetectionEnablement({
        provider_config: enabledConfig,
        capability: "object_detection",
        artifact: {
          ...artifact,
          source_ref_id: "https://example.test/frame.png",
        },
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "remote_source_forbidden",
      artifact_validation_reason: "remote_url_forbidden",
    });
  });

  it("fails camera-derived artifacts without active indicator metadata", () => {
    const artifact = safeArtifact();

    expect(
      evaluateVisionDetectionEnablement({
        provider_config: enabledConfig,
        capability: "object_detection",
        artifact: {
          ...artifact,
          active_indicator_visible: false,
        },
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "active_indicator_required",
      artifact_validation_reason: "active_indicator_required",
    });
  });

  it("fails cloud and network fallback requests", () => {
    expect(evaluate({ cloud_fallback_requested: true })).toMatchObject({
      allowed: false,
      reason: "cloud_fallback_forbidden",
    });
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          network_fallback_requested: true,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "network_fallback_forbidden",
    });
  });

  it("fails mutation authority requests", () => {
    expect(
      evaluate({
        mutation_authority_requested: ["tool_trigger"],
      }),
    ).toMatchObject({
      allowed: false,
      reason: "mutation_authority_forbidden",
      mutation_authority_granted: false,
    });
  });

  it("fails unsafe model and weights config", () => {
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          model_name: "real-yolo-weights",
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "model_not_allowlisted",
    });
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          weights_configured: true,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "weights_not_configured_for_stub",
    });
  });

  it("fails unsafe confidence thresholds and oversized timeouts", () => {
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          confidence_threshold: 0,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "confidence_threshold_out_of_bounds",
    });
    expect(
      evaluate({
        provider_config: {
          ...enabledConfig,
          confidence_threshold: 1,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "confidence_threshold_out_of_bounds",
    });
    expect(
      evaluate({
        timeout_ms: VISION_LOCAL_DETECTION_MAX_TIMEOUT_MS + 1,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "timeout_out_of_bounds",
    });
  });

  it("allows valid local metadata-only detection artifact preconditions", () => {
    const result = evaluate();

    expect(result).toMatchObject({
      allowed: true,
      reason: "allowed",
      provider_id: "yolo-stub",
      provider_kind: "yolo_stub",
      capability: "object_detection",
      artifact_id: "detection-enable-frame-detection-artifact",
      timeout_ms: 5_000,
      confidence_threshold: 0.5,
      model_name: "yolo-disabled-stub",
      weights_configured: false,
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
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("keeps the YOLO stub execution-disabled even when preconditions pass", async () => {
    const artifact = safeArtifact();
    const request: VisionDetectionArtifactProviderRunRequest = {
      request_id: "detection-enable-provider-request",
      session_id: "detection-enable-provider-session",
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      user_triggered: true,
      timeout_ms: 5_000,
      requested_at_ms: 30,
      environment: "test",
      metadata_only: true,
      detection_artifact: artifact,
    };
    const result = await createDisabledYoloProvider({
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
      provider_kind: "yolo_stub",
      status: "execution_disabled",
      reason: "not_implemented",
      observation_count: 0,
      raw_payload_included: false,
      raw_frame_persisted: false,
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
    expect(
      result.registry
        .listProviders()
        .some((provider) => provider.kind === "yolo_stub"),
    ).toBe(false);
  });
});
