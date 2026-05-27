import { describe, expect, it } from "vitest";

import {
  VISION_METADATA_ALLOWED_FIELDS,
  createFakeVisionSessionRunner,
  createVisionProviderSuccessResult,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
  sanitizeVisionSessionLifecycleEvent,
  sanitizeVisionTelemetryEventForEmission,
} from "../../src/lib/vision-runtime";

describe("Phase 15A.4 vision telemetry redaction", () => {
  it("preserves allowed telemetry fields through sanitization", () => {
    const result = sanitizeVisionTelemetryEventForEmission({
      event_type: "vision_provider_result_recorded",
      session_id: "session-1",
      provider_id: "fake-ocr",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      provider_kind: "fake_ocr",
      reason: "completed",
      redaction_status: "metadata_only",
      observation_count: 1,
      latency_ms: 1,
      timestamp_ms: 10,
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      cloud_called: false,
      action_executed: false,
      mutation_performed: false,
    });

    expect(result).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
      metadata_only: true,
    });
    if (!result.ok) throw new Error("expected metadata-only telemetry");
    expect(result.value).toMatchObject({
      event_type: "vision_provider_result_recorded",
      provider_id: "fake-ocr",
      metadata_only: true,
      raw_payload_included: false,
    });
  });

  it("rejects forbidden top-level fields", () => {
    for (const field of [
      "raw_image",
      "raw_frame",
      "frame_bytes",
      "screenshot",
      "image_data",
      "base64",
      "ocr_text",
      "extracted_text",
      "transcript",
      "prompt",
      "response",
      "tool_output",
      "file_contents",
      "secret",
      "api_key",
      "token",
      "password",
      "exact_pixel_coordinates",
    ]) {
      expect(
        sanitizeVisionMetadataPayload({
          event_type: "vision_policy_evaluated",
          metadata_only: true,
          raw_payload_included: false,
          [field]: "forbidden",
        }),
      ).toEqual({
        ok: false,
        value: null,
        reason: "forbidden_field",
        field_path: field,
        redaction_status: "withheld",
        metadata_only: true,
      });
    }
  });

  it("rejects nested forbidden fields", () => {
    expect(
      sanitizeVisionMetadataPayload({
        event_type: "vision_policy_evaluated",
        metadata_only: true,
        raw_payload_included: false,
        reason: {
          token: "secret-token",
        },
      }),
    ).toEqual({
      ok: false,
      value: null,
      reason: "forbidden_field",
      field_path: "reason.token",
      redaction_status: "withheld",
      metadata_only: true,
    });
  });

  it("prevents OCR text and raw image/frame/base64 telemetry", () => {
    for (const field of [
      "ocr_text",
      "extracted_text",
      "raw_image",
      "raw_frame",
      "base64",
    ]) {
      const result = sanitizeVisionMetadataPayload({
        event_type: "vision_observation_recorded",
        session_id: "session-1",
        metadata_only: true,
        raw_payload_included: false,
        [field]: "payload",
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("prevents secrets, tokens, and passwords from appearing in telemetry", () => {
    for (const field of ["secret", "api_key", "token", "password"]) {
      expect(
        sanitizeVisionMetadataPayload({
          event_type: "vision_session_created",
          session_id: "session-1",
          metadata_only: true,
          raw_payload_included: false,
          [field]: "sensitive",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("sanitizes lifecycle events from VisionSessionRunner", async () => {
    const result = await createFakeVisionSessionRunner().run({
      request_id: "request-1",
      session_id: "session-1",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      environment: "test",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 10,
      metadata_only: true,
    });

    for (const event of result.events) {
      expect(sanitizeVisionSessionLifecycleEvent(event)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
        metadata_only: true,
      });
      expect(event).toMatchObject({
        metadata_only: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
      });
    }
  });

  it("sanitizes observations from VisionSessionRunner", async () => {
    const result = await createFakeVisionSessionRunner().run({
      request_id: "request-2",
      session_id: "session-2",
      capability: "object_detection",
      input_kind: "screenshot",
      environment: "test",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 10,
      metadata_only: true,
    });

    expect(result.observations).toHaveLength(1);
    expect(sanitizeVisionObservation(result.observations[0])).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
      metadata_only: true,
    });
    expect(result.observations[0]).toMatchObject({
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
  });

  it("sanitizes provider results and preserves explicit false safety flags", () => {
    const providerResult = createVisionProviderSuccessResult({
      result_id: "result-1",
      session_id: "session-1",
      provider_id: "fake-ocr",
      provider_kind: "fake_ocr",
      capability: "screenshot_ocr",
      observation_count: 1,
      latency_ms: 1,
    });

    const sanitized = sanitizeVisionProviderResult(providerResult);

    expect(sanitized).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    if (!sanitized.ok) throw new Error("expected safe provider result");
    expect(sanitized.value).toMatchObject({
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
  });

  it("fails closed on unknown unsafe payloads", () => {
    expect(
      sanitizeVisionMetadataPayload({
        event_type: "vision_policy_evaluated",
        metadata_only: true,
        raw_payload_included: false,
        debug_payload: "not allowed",
      }),
    ).toEqual({
      ok: false,
      value: null,
      reason: "unknown_field",
      field_path: "debug_payload",
      redaction_status: "withheld",
      metadata_only: true,
    });
  });

  it("keeps the allowlist explicit", () => {
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("event_type");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("session_id");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("provider_id");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("status");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("reason");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("latency_ms");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("degraded");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("fallback_used");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("redaction_status");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("derived");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("advisory");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("timestamp_ms");
  });
});
