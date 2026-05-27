import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VisionScreenshotCaptureResultSchema,
  createFakeScreenshotCaptureAdapter,
  sanitizeVisionMetadataPayload,
  validateVisionScreenshotRequest,
  type VisionScreenshotCaptureFailureReason,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  metadata_only: true,
} as const;

const trigger = {
  trigger_id: "trigger-1",
  source: "user",
  explicit_user_action: true,
  surface: "test",
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

const fullRequest: VisionScreenshotRequest = {
  request_id: "capture-request-1",
  input_kind: "screenshot.full",
  trigger,
  region: null,
  source,
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  ocr_text_included: false,
};

const captureOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
} as const;

describe("Phase 15B.2 fake screenshot capture adapter", () => {
  it("fake full screenshot capture succeeds only after valid user trigger gate", async () => {
    const gate = validateVisionScreenshotRequest(fullRequest);
    const result = await createFakeScreenshotCaptureAdapter().capture(
      fullRequest,
      captureOptions,
    );

    expect(gate).toMatchObject({
      status: "accepted",
      session_execution_allowed: true,
      provider_execution_allowed: true,
    });
    expect(result).toMatchObject({
      capture_id: "capture-request-1-capture",
      adapter_id: "fake-screenshot-capture",
      adapter_kind: "fake_screenshot_capture",
      capture_status: "success",
      requested_input_kind: "screenshot.full",
      effective_input_kind: "screenshot.full",
      redacted_source_id: "redacted",
      source_id_hash: source.source_id_hash,
      width_band: "none",
      height_band: "none",
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      persisted: false,
      provider_executed: false,
      runtime_executed: false,
      fake_capture_executed: true,
    });
  });

  it("fake region screenshot capture succeeds only after valid user trigger gate", async () => {
    const request = {
      ...fullRequest,
      request_id: "capture-request-region",
      input_kind: "screenshot.region",
      region,
    } as const;

    const result = await createFakeScreenshotCaptureAdapter().capture(
      request,
      captureOptions,
    );

    expect(result).toMatchObject({
      capture_status: "success",
      requested_input_kind: "screenshot.region",
      effective_input_kind: "screenshot.region",
      region_preferred: true,
      width_band: "medium",
      height_band: "small",
      metadata_only: true,
      raw_image_included: false,
      raw_frame_included: false,
      ocr_text_included: false,
    });
  });

  it("invalid or denied screenshot requests never reach successful capture", async () => {
    const denied = await createFakeScreenshotCaptureAdapter().capture(
      {
        ...fullRequest,
        trigger: {
          ...trigger,
          source: "scheduler",
        },
      },
      captureOptions,
    );

    expect(denied).toMatchObject({
      capture_status: "gate_denied",
      reason: "gate_denied",
      degraded: true,
      fake_capture_executed: false,
      provider_executed: false,
      runtime_executed: false,
      raw_payload_included: false,
    });
  });

  it("fake capture result contains metadata only and sanitizes cleanly", async () => {
    const result = await createFakeScreenshotCaptureAdapter().capture(
      fullRequest,
      captureOptions,
    );

    expect(VisionScreenshotCaptureResultSchema.safeParse(result).success).toBe(
      true,
    );
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
      metadata_only: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /image_bytes|frame_bytes|base64_payload|ocr_text_value|extracted_text|prompt|response|file_contents/i,
    );
  });

  it("raw image, frame, base64, and OCR text fields are absent or rejected", async () => {
    const result = await createFakeScreenshotCaptureAdapter().capture(
      fullRequest,
      captureOptions,
    );

    expect(result).toMatchObject({
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
    });
    for (const field of ["raw_image", "raw_frame", "base64", "ocr_text"]) {
      expect(
        sanitizeVisionMetadataPayload({
          ...result,
          [field]: "forbidden",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("cancellation returns a metadata-safe cancelled result", async () => {
    const result = await createFakeScreenshotCaptureAdapter().capture(
      fullRequest,
      {
        ...captureOptions,
        cancellation: {
          cancellation_id: "cancel-1",
          cancelled: true,
          requested_at_ms: 11,
          metadata_only: true,
        },
      },
    );

    expect(result).toMatchObject({
      capture_status: "cancelled",
      reason: "cancelled",
      cancelled: true,
      degraded: true,
      fake_capture_executed: false,
      metadata_only: true,
      raw_payload_included: false,
    });
  });

  it("timeout returns a metadata-safe timeout result", async () => {
    const result = await createFakeScreenshotCaptureAdapter().capture(
      fullRequest,
      {
        ...captureOptions,
        timeout_ms: 1,
        simulated_latency_ms: 2,
      },
    );

    expect(result).toMatchObject({
      capture_status: "timeout",
      reason: "timeout",
      degraded: true,
      fake_capture_executed: false,
      metadata_only: true,
      raw_payload_included: false,
    });
  });

  it("permission_denied, unsupported_region, and capture_unavailable fail closed", async () => {
    for (const failureMode of [
      "permission_denied",
      "unsupported_region",
      "capture_unavailable",
    ] satisfies readonly VisionScreenshotCaptureFailureReason[]) {
      expect(
        await createFakeScreenshotCaptureAdapter().capture(fullRequest, {
          ...captureOptions,
          failure_mode: failureMode,
        }),
      ).toMatchObject({
        capture_status: failureMode,
        reason: failureMode,
        degraded: true,
        fake_capture_executed: false,
        metadata_only: true,
        raw_payload_included: false,
        persisted: false,
        provider_executed: false,
        runtime_executed: false,
      });
    }
  });

  it("keeps real screenshot, native, browser, Tauri, and OS API markers absent from runtime source", () => {
    const source = readVisionRuntimeSource();

    expect(source).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob/i,
    );
    expect(source).not.toMatch(
      /powershell|screencapture|gnome-screenshot|import\s+["']@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.graphics\.capture/i,
    );
  });
});

function readVisionRuntimeSource(): string {
  const root = join(process.cwd(), "src/lib/vision-runtime");
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => readFileSync(join(root, entry.name), "utf8"))
    .join("\n");
}
