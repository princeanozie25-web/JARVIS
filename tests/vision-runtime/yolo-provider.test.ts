import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  VisionProviderRegistry,
  createDisabledYoloProvider,
  sanitizeVisionMetadataPayload,
  sanitizeVisionProviderResult,
  type VisionProviderRunRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const baseRequest: VisionProviderRunRequest = {
  request_id: "request-yolo-stub",
  session_id: "session-yolo-stub",
  capability: "object_detection",
  input_kind: "mock_camera_frame",
  user_triggered: true,
  timeout_ms: 100,
  requested_at_ms: 10,
  environment: "test",
  metadata_only: true,
};

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

function yoloProviderSource(): string {
  return (
    visionRuntimeSourceFiles().find((file) =>
      file.path.endsWith("yolo-provider.ts"),
    )?.source ?? ""
  );
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

describe("Phase 15E.1 disabled YOLO object detection provider stub", () => {
  it("defaults the YOLO provider config to disabled metadata-only detection scaffold", () => {
    expect(DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG).toEqual({
      provider_id: "yolo-stub",
      provider_kind: "yolo_stub",
      enabled: false,
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
    });
    expect(
      sanitizeVisionMetadataPayload(DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG),
    ).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("reports health as disabled and not configured by default", async () => {
    const health = await createDisabledYoloProvider().health(15);

    expect(health).toEqual({
      provider_id: "yolo-stub",
      provider_kind: "yolo_stub",
      supported_capability: "object_detection",
      ok: false,
      degraded: true,
      checked_at_ms: 15,
      metadata_only: true,
      status: "disabled",
      reason: "not_configured",
      enabled: false,
      configured: false,
      weights_configured: false,
      python_execution_allowed: false,
      process_spawned: false,
    });
    expect(sanitizeVisionMetadataPayload(health)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("fails closed on run without executing object detection", async () => {
    const result = await createDisabledYoloProvider().run(baseRequest);

    expect(result).toMatchObject({
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      observations: [],
    });
    expect(result.provider_result).toMatchObject({
      provider_id: "yolo-stub",
      provider_kind: "yolo_stub",
      capability: "object_detection",
      status: "provider_disabled",
      reason: "provider_disabled",
      observation_count: 0,
      policy_denied: false,
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      cloud_called: false,
      runtime_executed: false,
    });
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("returns policy denied for unsupported provider requests without execution", async () => {
    const result = await createDisabledYoloProvider().run({
      ...baseRequest,
      capability: "screenshot_ocr",
      input_kind: "screenshot",
    });

    expect(result).toMatchObject({
      observations: [],
      raw_payload_included: false,
      provider_result: {
        provider_kind: "yolo_stub",
        capability: "object_detection",
        status: "policy_denied",
        reason: "policy_denied",
        observation_count: 0,
        raw_payload_included: false,
        runtime_executed: false,
      },
    });
  });

  it("keeps disabled provider results free of detection labels, raw image, base64, and frame data", async () => {
    const result = await createDisabledYoloProvider().run(baseRequest);

    expect(JSON.stringify(result)).not.toMatch(
      /object_label|detection_label_value|bounding_box|detected_class|raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload/i,
    );
  });

  it("keeps the default provider registry fake-only", () => {
    const registryResult = VisionProviderRegistry.createFakeOnly();
    if (!registryResult.ok) {
      throw new Error("fake-only registry should initialize");
    }

    expect(
      registryResult.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
    expect(
      registryResult.registry
        .listProviders()
        .some((provider) => provider.kind === "yolo_stub"),
    ).toBe(false);
  });

  it("does not add YOLO, ultralytics, or object detection package imports", () => {
    const allPackageNames = [
      ...Object.keys(packageJson().dependencies ?? {}),
      ...Object.keys(packageJson().devDependencies ?? {}),
    ].join("\n");

    expect(allPackageNames).not.toMatch(
      /(?:^|[-_@/])(ultralytics|yolo|opencv|onnxruntime|tensorflow|tfjs|mediapipe)(?:$|[-_@/])/i,
    );
    expect(combinedVisionRuntimeSource()).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']\s*\)/i,
    );
  });

  it("keeps the YOLO stub non-executing and free of process, Python, file, camera, and screenshot paths", () => {
    const stubSource = yoloProviderSource();
    const sourceText = combinedVisionRuntimeSource();

    expect(stubSource).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(stubSource).not.toMatch(
      /python\s*\(|python3|pyodide|subprocess|readFile\s*\(|createReadStream\s*\(|image_bytes|frame_bytes|base64_payload/i,
    );
    expect(sourceText).not.toMatch(
      /getUserMedia|mediaDevices|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob/i,
    );
  });
});
