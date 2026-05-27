import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ScreenshotSessionRunner,
  createFakeScreenshotCaptureAdapter,
  runFakeScreenshotOcrSession,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  type VisionScreenshotCaptureAdapter,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
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
  request_id: "session-request-1",
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

describe("Phase 15B.3 fake screenshot OCR orchestration", () => {
  it("valid full screenshot request completes through fake capture and fake OCR", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      request_id: "session-request-1",
      status: "completed",
      reason: "completed",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      persisted: false,
      provider_executed: true,
      fake_capture_executed: true,
      runtime_executed: false,
    });
    expect(result.capture_result).toMatchObject({
      capture_status: "success",
      fake_capture_executed: true,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_id: "fake-ocr",
      status: "success",
      raw_payload_included: false,
      raw_ocr_text_included: false,
    });
    expect(result.observations).toEqual([
      expect.objectContaining({
        kind: "ocr_summary",
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      }),
    ]);
  });

  it("valid region screenshot request completes through fake capture and fake OCR", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: {
        ...fullRequest,
        request_id: "session-request-region",
        input_kind: "screenshot.region",
        region,
      },
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "completed",
      observation_count: 1,
      provider_executed: true,
      fake_capture_executed: true,
    });
    expect(result.capture_result).toMatchObject({
      requested_input_kind: "screenshot.region",
      effective_input_kind: "screenshot.region",
      region_preferred: true,
      width_band: "medium",
      height_band: "small",
    });
  });

  it("invalid trigger is denied before capture", async () => {
    const throwingCapture: VisionScreenshotCaptureAdapter = {
      ...createFakeScreenshotCaptureAdapter(),
      async capture() {
        throw new Error("capture must not be called for denied gates");
      },
    };
    const result = await new ScreenshotSessionRunner({
      capture_adapter: throwingCapture,
    }).run({
      request: {
        ...fullRequest,
        trigger: {
          ...trigger,
          source: "assistant",
        },
      },
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "denied",
      reason: "assistant_trigger_forbidden",
      capture_result: null,
      provider_result: null,
      observation_count: 0,
      provider_executed: false,
      fake_capture_executed: false,
    });
  });

  it("capture failure prevents provider execution", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: {
        ...captureOptions,
        failure_mode: "permission_denied",
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "capture_failed",
      reason: "permission_denied",
      provider_result: null,
      observations: [],
      observation_count: 0,
      provider_executed: false,
      fake_capture_executed: false,
    });
    expect(result.capture_result).toMatchObject({
      capture_status: "permission_denied",
      raw_payload_included: false,
    });
  });

  it("cancellation prevents completed observation", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: {
        ...captureOptions,
        cancellation: {
          cancellation_id: "cancel-1",
          cancelled: true,
          requested_at_ms: 11,
          metadata_only: true,
        },
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "cancelled",
      reason: "cancelled",
      provider_result: null,
      observations: [],
      observation_count: 0,
      provider_executed: false,
      fake_capture_executed: false,
    });
  });

  it("timeout returns metadata-safe timeout result", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: {
        ...captureOptions,
        timeout_ms: 1,
        simulated_latency_ms: 2,
      },
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "timeout",
      reason: "timeout",
      observations: [],
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
    });
  });

  it("provider failure remains metadata-safe", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      provider_timeout_ms: 1,
      provider_simulated_latency_ms: 2,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "timeout",
      reason: "provider_timeout",
      observation_count: 0,
      provider_executed: true,
      fake_capture_executed: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      status: "timeout",
      raw_payload_included: false,
      raw_ocr_text_included: false,
    });
  });

  it("final observations are derived and advisory", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result.observations).toHaveLength(1);
    for (const observation of result.observations) {
      expect(sanitizeVisionObservation(observation)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(observation).toMatchObject({
        advisory_only: true,
        derived: true,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      });
    }
  });

  it("lifecycle events are metadata-only", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      expect(event).toMatchObject({
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        action_executed: false,
        mutation_performed: false,
        runtime_executed: false,
      });
    }
  });

  it("no raw image, frame, base64, OCR text, or prompt payload leaks through result", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_image_payload|raw_frame_payload|frame_bytes|image_bytes|base64_payload|ocr_text_value|extracted_text|prompt|response|tool_output|file_contents/i,
    );
  });

  it("cannot trigger runtime, tool, device, project, or memory mutation authority", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      action_executed: false,
      mutation_performed: false,
      tool_triggered: false,
      device_action_triggered: false,
      project_mutated: false,
      memory_mutated: false,
      runtime_executed: false,
    });
  });

  it("keeps real screenshot, OCR imports, UI, native, network, and persistence markers absent from runtime source", () => {
    const source = readVisionRuntimeSource();

    expect(source).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob/i,
    );
    expect(source).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|paddleocr|yolo|ultralytics|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|paddleocr|yolo|ultralytics|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
    expect(source).not.toMatch(
      /powershell|screencapture|gnome-screenshot|@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.graphics\.capture|fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|writeFile|appendFile|better-sqlite3|sqlite|database|React|useEffect|useState/i,
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
