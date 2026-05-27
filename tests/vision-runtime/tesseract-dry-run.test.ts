import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  VisionProviderRegistry,
  createDisabledTesseractDryRunProvider,
  createFakeScreenshotCaptureAdapter,
  createVisionOcrArtifactFromScreenshotCapture,
  runTesseractDryRunProviderPath,
  sanitizeVisionMetadataPayload,
  sanitizeVisionProviderResult,
  type DisabledTesseractProviderConfig,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  metadata_only: true,
} as const;

const screenshotRequest: VisionScreenshotRequest = {
  request_id: "dry-run-request",
  input_kind: "screenshot.region",
  trigger: {
    trigger_id: "dry-run-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  region: {
    region_id: "dry-run-region",
    width_px: 640,
    height_px: 360,
    coordinate_space: "redacted_screen_region",
    exact_pixel_coordinates_included: false,
    metadata_only: true,
  },
  source,
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  ocr_text_included: false,
};

const captureOptions: VisionScreenshotCaptureOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
};

const enabledConfig: DisabledTesseractProviderConfig = {
  ...DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  enabled: true,
};

async function safeArtifact(): Promise<VisionOcrInputArtifact> {
  const capture = await createFakeScreenshotCaptureAdapter().capture(
    screenshotRequest,
    captureOptions,
  );
  const artifact = createVisionOcrArtifactFromScreenshotCapture({
    capture,
    created_at_ms: 20,
  });
  if (!artifact.ok) throw new Error("expected safe OCR artifact");
  return artifact.artifact;
}

async function providerRequest(
  artifact: VisionOcrInputArtifact,
): Promise<VisionOcrArtifactProviderRunRequest> {
  return {
    request_id: "dry-run-provider-request",
    session_id: "dry-run-provider-session",
    capability: "screenshot_ocr",
    input_kind: "screenshot",
    user_triggered: true,
    timeout_ms: 5_000,
    requested_at_ms: 30,
    environment: "test",
    metadata_only: true,
    ocr_artifact: artifact,
  };
}

describe("Phase 15C.5 OCR provider dry-run integration path", () => {
  it("returns provider_disabled before enablement or invocation for disabled config", async () => {
    const artifact = await safeArtifact();
    const result = runTesseractDryRunProviderPath({
      config: DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
      request: await providerRequest(artifact),
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: false,
      enablement_reason: "provider_disabled",
      invocation_plan_created: false,
      invocation_result: null,
      observations: [],
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      status: "provider_disabled",
      reason: "provider_disabled",
      raw_payload_included: false,
      raw_ocr_text_included: false,
      runtime_executed: false,
    });
  });

  it("returns precondition_failed and creates no invocation plan for invalid artifacts", async () => {
    const request = {
      ...(await providerRequest(await safeArtifact())),
      ocr_artifact: {
        raw_bytes: new Uint8Array([1, 2, 3]),
      },
    };
    const result = runTesseractDryRunProviderPath({
      config: enabledConfig,
      request,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: false,
      enablement_reason: "unsafe_payload",
      invocation_plan_created: false,
      invocation_result: null,
      provider_result: {
        status: "precondition_failed",
        reason: "precondition_failed",
      },
    });
  });

  it("creates a plan for valid metadata-only artifacts but returns execution_disabled", async () => {
    const artifact = await safeArtifact();
    const result = runTesseractDryRunProviderPath({
      config: enabledConfig,
      request: await providerRequest(artifact),
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: true,
      enablement_reason: "allowed",
      invocation_plan_created: true,
      invocation_result: {
        status: "execution_disabled",
        reason: "execution_disabled",
        artifact_id: artifact.artifact_id,
        raw_payload_included: false,
        ocr_text_included: false,
        provider_executed: false,
        runtime_executed: false,
      },
      provider_result: {
        status: "execution_disabled",
        reason: "not_implemented",
        observation_count: 0,
        raw_payload_included: false,
        raw_ocr_text_included: false,
        cloud_called: false,
        runtime_executed: false,
      },
    });
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("explicit dry-run provider construction does not broaden default authority", async () => {
    const artifact = await safeArtifact();
    const provider = createDisabledTesseractDryRunProvider({ enabled: true });
    const result = await provider.run(await providerRequest(artifact));

    expect(result.provider_result).toMatchObject({
      provider_kind: "tesseract_stub",
      status: "execution_disabled",
      raw_payload_included: false,
      runtime_executed: false,
    });

    const registry = VisionProviderRegistry.createFakeOnly();
    if (!registry.ok) throw new Error("fake-only registry should initialize");
    expect(
      registry.registry.listProviders().map((registered) => registered.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
  });

  it("does not leak raw bytes, base64, OCR text, paths, prompts, responses, or tool output", async () => {
    const artifact = await safeArtifact();
    const result = runTesseractDryRunProviderPath({
      config: enabledConfig,
      request: await providerRequest(artifact),
      metadata_only: true,
    });

    expect(JSON.stringify(result)).not.toMatch(
      /raw_bytes|image_bytes|frame_bytes|base64_payload|data:image|recognized_text|extracted_text|ocr_text_value|filesystem_path|[A-Z]:\\|prompt|response|tool_output|file_contents/i,
    );
  });

  it("keeps subprocess, file, network, and OCR dependency markers absent", () => {
    const sourceText = readVisionRuntimeSource();
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const packageNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ].join("\n");

    expect(packageNames).not.toMatch(
      /tesseract|node-tesseract-ocr|paddleocr|yolo|opencv|onnxruntime/i,
    );
    expect(sourceText).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|yolo|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|yolo|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
  });
});

function readVisionRuntimeSource(): string {
  return readdirSync(join(process.cwd(), "src/lib/vision-runtime"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) =>
      readFileSync(join(process.cwd(), "src/lib/vision-runtime", entry.name), {
        encoding: "utf8",
      }),
    )
    .join("\n");
}
