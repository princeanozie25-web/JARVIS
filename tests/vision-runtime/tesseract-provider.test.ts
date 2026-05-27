import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  VisionProviderRegistry,
  createDisabledTesseractProvider,
  sanitizeVisionProviderResult,
  type VisionProviderRunRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const baseRequest: VisionProviderRunRequest = {
  request_id: "request-tesseract-stub",
  session_id: "session-tesseract-stub",
  capability: "screenshot_ocr",
  input_kind: "screenshot",
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

describe("Phase 15C.1 disabled Tesseract OCR provider stub", () => {
  it("defaults the Tesseract provider config to disabled metadata-only OCR scaffold", () => {
    expect(DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG).toEqual({
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      enabled: false,
      binary_path_configured: false,
      supported_capability: "screenshot_ocr",
      timeout_ms: 5_000,
      max_input_size_bytes: 5_000_000,
      language: "eng",
      metadata_only: true,
      redaction_required: true,
      raw_image_input_allowed: false,
      raw_ocr_text_output_allowed: false,
      process_execution_allowed: false,
      persistence_allowed: false,
    });
  });

  it("reports health as disabled and not configured by default", async () => {
    const health = await createDisabledTesseractProvider().health(15);

    expect(health).toEqual({
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      supported_capability: "screenshot_ocr",
      ok: false,
      degraded: true,
      checked_at_ms: 15,
      metadata_only: true,
      status: "disabled",
      reason: "not_configured",
      enabled: false,
      configured: false,
      binary_path_configured: false,
      process_spawned: false,
    });
  });

  it("fails closed on run without executing OCR", async () => {
    const result = await createDisabledTesseractProvider().run(baseRequest);

    expect(result).toMatchObject({
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      observations: [],
    });
    expect(result.provider_result).toMatchObject({
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      capability: "screenshot_ocr",
      status: "policy_denied",
      reason: "policy_denied",
      observation_count: 0,
      policy_denied: true,
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

  it("keeps disabled provider results free of OCR text, raw image, base64, and frame data", async () => {
    const result = await createDisabledTesseractProvider().run(baseRequest);

    expect(JSON.stringify(result)).not.toMatch(
      /recognized_text|extracted_text|ocr_text_value|raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload/i,
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
        .some((provider) => provider.kind === "tesseract_stub"),
    ).toBe(false);
  });

  it("does not add Tesseract package dependencies or real OCR imports", () => {
    const allPackageNames = [
      ...Object.keys(packageJson().dependencies ?? {}),
      ...Object.keys(packageJson().devDependencies ?? {}),
    ].join("\n");

    expect(allPackageNames).not.toMatch(
      /tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime/i,
    );
    expect(combinedVisionRuntimeSource()).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
  });

  it("keeps the Tesseract stub non-executing and free of screenshot capture paths", () => {
    const tesseractStubSource =
      visionRuntimeSourceFiles().find((file) =>
        file.path.endsWith("tesseract-provider.ts"),
      )?.source ?? "";
    const sourceText = combinedVisionRuntimeSource();

    expect(tesseractStubSource).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(tesseractStubSource).not.toMatch(
      /readFile\s*\(|createReadStream\s*\(|image_bytes|frame_bytes|base64_payload/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob/i,
    );
  });
});
