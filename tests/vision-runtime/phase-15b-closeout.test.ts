import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ScreenshotSessionRunner,
  createFakeScreenshotCaptureAdapter,
  runFakeScreenshotOcrSession,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  type VisionScreenshotCaptureAdapter,
  type VisionScreenshotRequest,
  validateVisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  metadata_only: true,
} as const;

const userTrigger = {
  trigger_id: "trigger-closeout",
  source: "user",
  explicit_user_action: true,
  surface: "test",
  initiated_at_ms: 10,
  metadata_only: true,
} as const;

const region = {
  region_id: "region-closeout",
  width_px: 640,
  height_px: 360,
  coordinate_space: "redacted_screen_region",
  exact_pixel_coordinates_included: false,
  metadata_only: true,
} as const;

const fullRequest: VisionScreenshotRequest = {
  request_id: "phase-15b-closeout",
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

const captureOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
} as const;

function readRecursiveTsFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readRecursiveTsFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

function visionRuntimeSourceFiles(): readonly {
  readonly path: string;
  readonly source: string;
}[] {
  return readRecursiveTsFiles(VISION_RUNTIME_SOURCE_ROOT).map((path) => ({
    path: relative(process.cwd(), path).replace(/\\/g, "/"),
    source: readFileSync(path, "utf8"),
  }));
}

function combinedVisionRuntimeSource(): string {
  return visionRuntimeSourceFiles()
    .map((file) => file.source)
    .join("\n");
}

describe("Phase 15B screenshot OCR closeout guards", () => {
  it("requires explicit user-triggered screenshot requests", () => {
    expect(validateVisionScreenshotRequest(fullRequest)).toMatchObject({
      status: "accepted",
      trigger_source: "user",
      provider_execution_allowed: true,
      session_execution_allowed: true,
      metadata_only: true,
      raw_payload_included: false,
    });

    expect(
      validateVisionScreenshotRequest({
        ...fullRequest,
        trigger: null,
      }),
    ).toMatchObject({
      status: "denied",
      reason: "missing_trigger_provenance",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
    expect(
      validateVisionScreenshotRequest({
        ...fullRequest,
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
  });

  it("prefers region screenshots where valid region metadata exists", () => {
    expect(
      validateVisionScreenshotRequest({
        ...fullRequest,
        region,
      }),
    ).toMatchObject({
      status: "accepted",
      requested_input_kind: "screenshot.full",
      effective_input_kind: "screenshot.region",
      region_preferred: true,
    });
  });

  it("denies assistant, scheduler, background, periodic, voice-only, and remote triggers", () => {
    for (const triggerSource of [
      "assistant",
      "scheduler",
      "background",
      "periodic",
      "voice_only",
      "remote_network",
    ] as const) {
      expect(
        validateVisionScreenshotRequest({
          ...fullRequest,
          trigger: {
            ...userTrigger,
            source: triggerSource,
          },
        }),
      ).toMatchObject({
        status: "denied",
        trigger_source: triggerSource,
        provider_execution_allowed: false,
        session_execution_allowed: false,
      });
    }
  });

  it("denied requests never reach capture or provider execution", async () => {
    const throwingCapture: VisionScreenshotCaptureAdapter = {
      ...createFakeScreenshotCaptureAdapter(),
      async capture() {
        throw new Error("capture must not run for denied requests");
      },
    };
    const result = await new ScreenshotSessionRunner({
      capture_adapter: throwingCapture,
    }).run({
      request: {
        ...fullRequest,
        trigger: {
          ...userTrigger,
          source: "scheduler",
        },
      },
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "denied",
      capture_result: null,
      provider_result: null,
      observation_count: 0,
      provider_executed: false,
      fake_capture_executed: false,
      raw_payload_included: false,
    });
  });

  it("fake capture emits metadata only and stays deterministic", async () => {
    const adapter = createFakeScreenshotCaptureAdapter();
    const first = await adapter.capture(fullRequest, captureOptions);
    const second = await adapter.capture(fullRequest, captureOptions);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      adapter_kind: "fake_screenshot_capture",
      capture_status: "success",
      redacted_source_id: "redacted",
      source_id_hash: source.source_id_hash,
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

  it("fake OCR session emits only sanitized derived advisory observations", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "completed",
      provider_executed: true,
      fake_capture_executed: true,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      persisted: false,
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
        raw_payload_included: false,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      });
    }
  });

  it("keeps lifecycle events metadata-only", async () => {
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

  it("prevents raw image, frame, base64, OCR text, prompt, response, tool output, and file content leakage", async () => {
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

    for (const field of [
      "raw_image",
      "raw_frame",
      "frame_bytes",
      "base64",
      "ocr_text",
      "prompt",
      "response",
      "tool_output",
      "file_contents",
    ]) {
      expect(
        sanitizeVisionMetadataPayload({
          event_type: "vision_observation_recorded",
          session_id: "phase-15b-closeout",
          metadata_only: true,
          raw_payload_included: false,
          [field]: "forbidden",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
      });
    }
  });

  it("keeps screenshot orchestration fake-only and non-authoritative by default", async () => {
    const result = await runFakeScreenshotOcrSession({
      request: fullRequest,
      capture_options: captureOptions,
      metadata_only: true,
    });

    expect(result.capture_result).toMatchObject({
      adapter_kind: "fake_screenshot_capture",
      fake_capture_executed: true,
    });
    expect(result.provider_result).toMatchObject({
      provider_id: "fake-ocr",
      provider_kind: "fake_ocr",
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

  it("keeps real screenshot/browser/native/Tauri/OS capture markers absent from source", () => {
    const sourceText = combinedVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob/i,
    );
    expect(sourceText).not.toMatch(
      /powershell|screencapture|gnome-screenshot|@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.graphics\.capture|GraphicsCaptureItem/i,
    );
  });

  it("keeps real OCR imports, camera, cloud, network, UI, persistence, and mutation markers absent from source", () => {
    const sourceText = combinedVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|paddleocr|yolo|ultralytics|opencv|onnxruntime|easyocr|ocrad)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|paddleocr|yolo|ultralytics|opencv|onnxruntime|easyocr|ocrad)[^"']*["']\s*\)/i,
    );
    expect(sourceText).not.toMatch(
      /getUserMedia|MediaRecorder|MediaStream|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https|from\s+["'](?:openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(sourceText).not.toMatch(
      /React|useEffect|useState|button|onClick|app\/api|globalShortcut/i,
    );
    expect(sourceText).not.toMatch(
      /writeFile|appendFile|createWriteStream|better-sqlite3|sqlite|database|indexedDB|localStorage|sessionStorage/i,
    );
    expect(sourceText).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|shell_command|approveAction\s*\(|grantApproval\s*\(|runAction\s*\(|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
    );
  });
});
