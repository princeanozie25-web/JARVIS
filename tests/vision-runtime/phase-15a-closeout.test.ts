import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_15_DISABLED_FEATURE_GUARD,
  PHASE_15_DISABLED_FEATURES,
  VISION_TELEMETRY_FORBIDDEN_FIELD_PATTERNS,
  VisionProviderRegistry,
  createFakeOcrProvider,
  createFakeVisionSessionRunner,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
  sanitizeVisionSessionLifecycleEvent,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

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

function packageJson(): {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
} {
  return JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
  };
}

describe("Phase 15A closeout audit guards", () => {
  it("keeps every Phase 15 disabled feature pinned off", () => {
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

  it("keeps real OCR and object detector dependencies unreachable", () => {
    const allPackageNames = [
      ...Object.keys(packageJson().dependencies ?? {}),
      ...Object.keys(packageJson().devDependencies ?? {}),
    ].join("\n");

    expect(allPackageNames).not.toMatch(
      /tesseract|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime/i,
    );
    expect(combinedVisionRuntimeSource()).not.toMatch(
      /from\s+["'][^"']*(?:tesseract|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'][^"']*(?:tesseract|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
  });

  it("keeps screenshot capture, camera access, cloud, network, UI, and persistence authority absent", () => {
    const source = combinedVisionRuntimeSource();

    expect(source).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|navigator\.mediaDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https|from\s+["'](?:openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /React|useEffect|useState|tsx|jsx|app\/api|tauri|invoke\s*\(|globalShortcut/i,
    );
    expect(source).not.toMatch(
      /writeFile|appendFile|createWriteStream|better-sqlite3|sqlite|database|indexedDB|localStorage|sessionStorage/i,
    );
  });

  it("keeps runtime, tool, device, project, and memory mutation authority absent", () => {
    const source = combinedVisionRuntimeSource();

    expect(source).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|shell_command|approveAction\s*\(|grantApproval\s*\(|runAction\s*\(|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
    );
    expect(source).toContain("mutation_authority_forbidden");
    expect(source).toContain("runtime_executed: false");
  });

  it("keeps session lifecycle events metadata-only and sanitized", async () => {
    const result = await createFakeVisionSessionRunner().run({
      request_id: "request-closeout",
      session_id: "session-closeout",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      environment: "test",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 10,
      metadata_only: true,
    });

    expect(result.session).toMatchObject({
      state: "completed",
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      cloud_called: false,
      action_executed: false,
      mutation_performed: false,
      runtime_executed: false,
    });
    for (const event of result.events) {
      expect(sanitizeVisionSessionLifecycleEvent(event)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(event).toMatchObject({
        metadata_only: true,
        raw_payload_included: false,
        action_executed: false,
        mutation_performed: false,
        runtime_executed: false,
      });
    }
  });

  it("sanitizes provider outputs before observation creation", async () => {
    const result = await createFakeVisionSessionRunner().run({
      request_id: "request-provider-sanitize",
      session_id: "session-provider-sanitize",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      environment: "test",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 10,
      metadata_only: true,
    });

    expect(result.events.map((event) => event.event_type)).toEqual([
      "session_started",
      "provider_selected",
      "provider_completed",
      "observation_created",
      "session_completed",
    ]);
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
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

  it("fails closed for raw image, frame, base64, and OCR text fields", () => {
    const forbiddenFields = [
      "raw_image",
      "raw_frame",
      "frame_bytes",
      "image_data",
      "base64",
      "ocr_text",
      "extracted_text",
      "exact_pixel_coordinates",
    ];

    for (const field of forbiddenFields) {
      expect(
        sanitizeVisionMetadataPayload({
          event_type: "vision_observation_recorded",
          session_id: "session-closeout",
          metadata_only: true,
          raw_payload_included: false,
          [field]: "forbidden",
        }),
      ).toMatchObject({
        ok: false,
        reason: "forbidden_field",
        field_path: field,
        redaction_status: "withheld",
      });
    }
    expect(VISION_TELEMETRY_FORBIDDEN_FIELD_PATTERNS.length).toBeGreaterThan(0);
  });

  it("keeps fake providers deterministic", async () => {
    const provider = createFakeOcrProvider();
    const request = {
      request_id: "request-deterministic",
      session_id: "session-deterministic",
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      user_triggered: true,
      timeout_ms: 100,
      requested_at_ms: 10,
      environment: "test",
      metadata_only: true,
    } as const;

    await expect(provider.run(request)).resolves.toEqual(
      await provider.run(request),
    );
  });

  it("keeps the default provider registry fake-only", () => {
    const result = VisionProviderRegistry.createFakeOnly();
    if (!result.ok) throw new Error("fake-only registry should initialize");

    expect(
      result.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
    expect(
      result.registry
        .listProviders()
        .every(
          (provider) =>
            provider.metadata_only &&
            provider.kind.startsWith("fake_") &&
            provider.supported_capability !== "real_camera" &&
            provider.supported_capability !== "cloud_vision",
        ),
    ).toBe(true);
  });
});
