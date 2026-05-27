import { describe, expect, it } from "vitest";

import {
  VisionScreenshotRequestSchema,
  validateVisionScreenshotRequest,
  type VisionScreenshotRequest,
  type VisionScreenshotTriggerSource,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  metadata_only: true,
} as const;

const userTrigger = {
  trigger_id: "trigger-1",
  source: "user",
  explicit_user_action: true,
  surface: "chat",
  initiated_at_ms: 10,
  metadata_only: true,
} as const;

const region = {
  region_id: "region-1",
  width_px: 640,
  height_px: 360,
  coordinate_space: "redacted_screen_region",
  exact_pixel_coordinates_included: false,
  metadata_only: true,
} as const;

const baseRequest: VisionScreenshotRequest = {
  request_id: "screenshot-request-1",
  input_kind: "screenshot.full",
  trigger: userTrigger,
  region: null,
  source,
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  ocr_text_included: false,
};

describe("Phase 15B.1 screenshot input contract and user-trigger gate", () => {
  it("accepts explicit user-triggered full screenshot requests", () => {
    expect(validateVisionScreenshotRequest(baseRequest)).toEqual({
      request_id: "screenshot-request-1",
      status: "accepted",
      reason: null,
      requested_input_kind: "screenshot.full",
      effective_input_kind: "screenshot.full",
      region_preferred: false,
      trigger_source: "user",
      provider_execution_allowed: true,
      session_execution_allowed: true,
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      ocr_text_included: false,
    });
  });

  it("accepts explicit user-triggered region screenshot requests", () => {
    expect(
      validateVisionScreenshotRequest({
        ...baseRequest,
        request_id: "screenshot-request-region",
        input_kind: "screenshot.region",
        region,
      }),
    ).toMatchObject({
      status: "accepted",
      requested_input_kind: "screenshot.region",
      effective_input_kind: "screenshot.region",
      region_preferred: true,
      provider_execution_allowed: true,
      session_execution_allowed: true,
      metadata_only: true,
      raw_payload_included: false,
    });
  });

  it("marks region metadata preferred when supplied with a full request", () => {
    expect(
      validateVisionScreenshotRequest({
        ...baseRequest,
        region,
      }),
    ).toMatchObject({
      status: "accepted",
      requested_input_kind: "screenshot.full",
      effective_input_kind: "screenshot.region",
      region_preferred: true,
    });
  });

  it("denies missing trigger provenance", () => {
    expect(
      validateVisionScreenshotRequest({
        ...baseRequest,
        trigger: null,
      }),
    ).toEqual({
      request_id: "screenshot-request-1",
      status: "denied",
      reason: "missing_trigger_provenance",
      requested_input_kind: "screenshot.full",
      effective_input_kind: null,
      region_preferred: false,
      trigger_source: null,
      provider_execution_allowed: false,
      session_execution_allowed: false,
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      ocr_text_included: false,
    });
  });

  it("denies assistant, scheduler, background, periodic, remote, and voice-only triggers", () => {
    const cases: readonly {
      readonly source: VisionScreenshotTriggerSource;
      readonly reason:
        | "assistant_trigger_forbidden"
        | "scheduler_trigger_forbidden"
        | "background_trigger_forbidden"
        | "periodic_trigger_forbidden"
        | "remote_network_trigger_forbidden"
        | "voice_only_trigger_forbidden";
    }[] = [
      { source: "assistant", reason: "assistant_trigger_forbidden" },
      { source: "scheduler", reason: "scheduler_trigger_forbidden" },
      { source: "background", reason: "background_trigger_forbidden" },
      { source: "periodic", reason: "periodic_trigger_forbidden" },
      { source: "remote_network", reason: "remote_network_trigger_forbidden" },
      { source: "voice_only", reason: "voice_only_trigger_forbidden" },
    ];

    for (const testCase of cases) {
      expect(
        validateVisionScreenshotRequest({
          ...baseRequest,
          trigger: {
            ...userTrigger,
            source: testCase.source,
          },
        }),
      ).toMatchObject({
        status: "denied",
        reason: testCase.reason,
        trigger_source: testCase.source,
        provider_execution_allowed: false,
        session_execution_allowed: false,
      });
    }
  });

  it("fails closed on ambiguous trigger provenance", () => {
    expect(
      validateVisionScreenshotRequest({
        ...baseRequest,
        trigger: {
          ...userTrigger,
          explicit_user_action: false,
        },
      }),
    ).toMatchObject({
      status: "denied",
      reason: "ambiguous_trigger_provenance",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
    expect(
      validateVisionScreenshotRequest({
        ...baseRequest,
        trigger: {
          ...userTrigger,
          source: "unknown",
        },
      }),
    ).toMatchObject({
      status: "denied",
      reason: "ambiguous_trigger_provenance",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
  });

  it("denied requests do not reach provider or session execution", () => {
    const decision = validateVisionScreenshotRequest({
      ...baseRequest,
      trigger: {
        ...userTrigger,
        source: "scheduler",
      },
    });

    expect(decision).toMatchObject({
      status: "denied",
      provider_execution_allowed: false,
      session_execution_allowed: false,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      ocr_text_included: false,
    });
  });

  it("request metadata is safe and rejects raw image/frame fields", () => {
    expect(baseRequest).toMatchObject({
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      ocr_text_included: false,
    });
    expect(JSON.stringify(baseRequest)).not.toMatch(
      /image_bytes|frame_bytes|base64|ocr_text_value|extracted_text|prompt|response|file_contents/i,
    );
    expect(
      VisionScreenshotRequestSchema.safeParse({
        ...baseRequest,
        raw_image: "forbidden",
      }).success,
    ).toBe(false);
    expect(
      VisionScreenshotRequestSchema.safeParse({
        ...baseRequest,
        frame_bytes: "forbidden",
      }).success,
    ).toBe(false);
  });
});
