import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_15_DISABLED_FEATURE_GUARD,
  DEFAULT_VISION_RUNTIME_POLICY,
  PHASE_15_DISABLED_FEATURES,
  VISION_MUTATION_AUTHORITY_CLASSES,
  VISION_TELEMETRY_FORBIDDEN_FIELDS,
  VisionObservationSchema,
  canVisionRequestMutationAuthority,
  createVisionObservation,
  evaluateVisionRuntimePolicy,
  sanitizeVisionTelemetryEvent,
} from "../../src/lib/vision-runtime";

const baseRequest = {
  capability: "screenshot_ocr",
  input_kind: "screenshot",
  provider_kind: "screenshot_ocr_placeholder",
  environment: "test",
  user_triggered: true,
  capture_mode: "single",
} as const;

describe("Phase 15A.1 vision runtime policy scaffold", () => {
  it("denies real camera by default", () => {
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capability: "real_camera",
        input_kind: "real_camera_frame",
        provider_kind: "real_camera",
      }),
    ).toEqual({
      allowed: false,
      reason: "real_camera_disabled",
      metadata_only: true,
    });
  });

  it("allows mock camera only in development or test mode", () => {
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capability: "mock_camera",
        input_kind: "mock_camera_frame",
        provider_kind: "mock_camera",
        environment: "test",
      }),
    ).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });

    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capability: "mock_camera",
        input_kind: "mock_camera_frame",
        provider_kind: "mock_camera",
        environment: "production",
      }),
    ).toEqual({
      allowed: false,
      reason: "mock_camera_dev_test_only",
      metadata_only: true,
    });
  });

  it("requires an explicit user trigger for screenshot input", () => {
    expect(evaluateVisionRuntimePolicy(baseRequest)).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        user_triggered: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "screenshot_user_trigger_required",
      metadata_only: true,
    });
  });

  it("denies cloud vision by default", () => {
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capability: "cloud_vision",
        provider_kind: "cloud_vision",
      }),
    ).toEqual({
      allowed: false,
      reason: "cloud_vision_disabled",
      metadata_only: true,
    });
    expect(DEFAULT_VISION_RUNTIME_POLICY.cloud_vision_enabled).toBe(false);
  });

  it("denies background, periodic, and continuous capture modes", () => {
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capture_mode: "background",
      }),
    ).toMatchObject({ allowed: false, reason: "background_capture_forbidden" });
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capture_mode: "periodic",
      }),
    ).toMatchObject({ allowed: false, reason: "periodic_capture_forbidden" });
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        capture_mode: "continuous",
      }),
    ).toMatchObject({ allowed: false, reason: "continuous_video_forbidden" });
  });

  it("denies raw frame persistence and raw OCR text telemetry requests", () => {
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        raw_frame_persistence_requested: true,
      }),
    ).toEqual({
      allowed: false,
      reason: "raw_frame_persistence_forbidden",
      metadata_only: true,
    });
    expect(
      evaluateVisionRuntimePolicy({
        ...baseRequest,
        raw_ocr_text_telemetry_requested: true,
      }),
    ).toEqual({
      allowed: false,
      reason: "raw_ocr_text_telemetry_forbidden",
      metadata_only: true,
    });
  });

  it("rejects raw frame, image, and OCR text telemetry fields", () => {
    for (const field of VISION_TELEMETRY_FORBIDDEN_FIELDS) {
      expect(
        sanitizeVisionTelemetryEvent({
          event_type: "vision_policy_evaluated",
          redaction_status: "metadata_only",
          timestamp_ms: 1,
          metadata_only: true,
          advisory_only: true,
          raw_payload_included: false,
          cloud_called: false,
          action_executed: false,
          mutation_performed: false,
          [field]: "forbidden",
        }),
      ).toEqual({
        ok: false,
        event: null,
        reason: "forbidden_telemetry_field",
        field,
        metadata_only: true,
      });
    }
  });

  it("accepts metadata-only telemetry and rejects unknown payload fields", () => {
    expect(
      sanitizeVisionTelemetryEvent({
        event_type: "vision_policy_evaluated",
        session_id: "session-1",
        capability: "screenshot_ocr",
        input_kind: "screenshot",
        provider_kind: "screenshot_ocr_placeholder",
        decision: "allowed",
        reason: "explicit_user_trigger",
        redaction_status: "metadata_only",
        timestamp_ms: 1,
        metadata_only: true,
        advisory_only: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
      }),
    ).toMatchObject({
      ok: true,
      metadata_only: true,
    });

    expect(
      sanitizeVisionTelemetryEvent({
        event_type: "vision_policy_evaluated",
        redaction_status: "metadata_only",
        timestamp_ms: 1,
        metadata_only: true,
        advisory_only: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
        debug_payload: "not allowed",
      }),
    ).toEqual({
      ok: false,
      event: null,
      reason: "unknown_telemetry_field",
      field: "debug_payload",
      metadata_only: true,
    });
  });

  it("marks observations as derived and advisory only", () => {
    const observation = createVisionObservation({
      observation_id: "observation-1",
      session_id: "session-1",
      kind: "ocr_summary",
      redaction_status: "metadata_only",
      confidence: 0.8,
      created_at_ms: 1,
    });

    expect(observation).toMatchObject({
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      tool_trigger_requested: false,
      action_requested: false,
      mutation_requested: false,
    });
    expect(
      VisionObservationSchema.safeParse({
        ...observation,
        advisory_only: false,
      }).success,
    ).toBe(false);
  });

  it("forbids vision from requesting mutation, action, approval, or runtime authority", () => {
    for (const authority of VISION_MUTATION_AUTHORITY_CLASSES) {
      expect(canVisionRequestMutationAuthority([authority])).toEqual({
        allowed: false,
        reason: "mutation_authority_forbidden",
        metadata_only: true,
      });
      expect(
        evaluateVisionRuntimePolicy({
          ...baseRequest,
          mutation_authority_requested: [authority],
        }),
      ).toEqual({
        allowed: false,
        reason: "mutation_authority_forbidden",
        metadata_only: true,
      });
    }
  });

  it("pins every disabled Phase 15 feature off", () => {
    expect(PHASE_15_DISABLED_FEATURES).toEqual([
      "real_camera_activation",
      "always_on_vision",
      "background_screenshots",
      "periodic_screenshots",
      "continuous_camera_stream",
      "face_recognition",
      "identity_recognition",
      "emotion_recognition",
      "biometric_inference",
      "cloud_vision_default_enablement",
      "autonomous_visual_actions",
      "raw_image_frame_telemetry",
      "graph_driven_execution",
      "vision_triggered_device_project_runtime_mutation",
    ]);

    for (const feature of PHASE_15_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE_15_DISABLED_FEATURE_GUARD[feature]).toBe(false);
    }
  });
});
