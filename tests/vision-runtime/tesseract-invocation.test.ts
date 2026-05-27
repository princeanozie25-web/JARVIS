import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VISION_LOCAL_OCR_MAX_TIMEOUT_MS,
  createFakeScreenshotCaptureAdapter,
  createTesseractInvocationPlan,
  createVisionOcrArtifactFromScreenshotCapture,
  evaluateVisionOcrEnablement,
  runDisabledTesseractInvocation,
  sanitizeVisionMetadataPayload,
  type VisionLocalOcrProviderEnablementConfig,
  type VisionOcrEnablementResult,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:9999999999999999999999999999999999999999999999999999999999999999",
  metadata_only: true,
} as const;

const screenshotRequest: VisionScreenshotRequest = {
  request_id: "tesseract-invocation-request",
  input_kind: "screenshot.region",
  trigger: {
    trigger_id: "tesseract-invocation-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  region: {
    region_id: "tesseract-invocation-region",
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

const enabledConfig: VisionLocalOcrProviderEnablementConfig = {
  provider_id: "tesseract-stub",
  provider_kind: "tesseract_stub",
  enabled: true,
  binary_path_configured: false,
  supported_capability: "screenshot_ocr",
  timeout_ms: 5_000,
  max_input_size_bytes: 5_000_000,
  language: "eng",
  cloud_fallback_requested: false,
  network_fallback_requested: false,
  metadata_only: true,
  redaction_required: true,
  raw_image_input_allowed: false,
  raw_ocr_text_output_allowed: false,
  process_execution_allowed: false,
  persistence_allowed: false,
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

function allowedEnablement(
  artifact: VisionOcrInputArtifact,
): VisionOcrEnablementResult {
  return evaluateVisionOcrEnablement({
    provider_config: enabledConfig,
    capability: "screenshot_ocr",
    artifact,
    user_triggered: true,
    timeout_ms: 5_000,
    metadata_only: true,
  });
}

describe("Phase 15C.4 local Tesseract invocation boundary", () => {
  it("creates a metadata-only invocation plan from valid preconditions", async () => {
    const artifact = await safeArtifact();
    const enablement = allowedEnablement(artifact);
    const planResult = createTesseractInvocationPlan({
      invocation_id: "tesseract-invocation",
      artifact,
      enablement,
      metadata_only: true,
    });

    expect(planResult).toMatchObject({ ok: true, result: null });
    if (!planResult.ok) throw new Error("expected invocation plan");
    expect(planResult.plan).toMatchObject({
      invocation_id: "tesseract-invocation",
      provider_id: "tesseract-stub",
      artifact_id: artifact.artifact_id,
      artifact_kind: "screenshot_capture",
      source_ref_kind: "redacted_ref",
      language: "eng",
      timeout_ms: 5_000,
      redacted_source_id: "redacted",
      source_id_hash: source.source_id_hash,
      execution_mode: "disabled_stub",
      filesystem_path: null,
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
    expect(sanitizeVisionMetadataPayload(planResult.plan)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("does not create a runnable plan when preconditions fail", async () => {
    const artifact = await safeArtifact();
    const enablement = evaluateVisionOcrEnablement({
      provider_config: {
        ...enabledConfig,
        enabled: false,
      },
      capability: "screenshot_ocr",
      artifact,
      user_triggered: true,
      timeout_ms: 5_000,
      metadata_only: true,
    });

    expect(
      createTesseractInvocationPlan({
        artifact,
        enablement,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      plan: null,
      result: {
        status: "provider_disabled",
        metadata_only: true,
        raw_payload_included: false,
        provider_executed: false,
      },
    });
  });

  it("disabled invocation always returns execution_disabled", async () => {
    const artifact = await safeArtifact();
    const planResult = createTesseractInvocationPlan({
      artifact,
      enablement: allowedEnablement(artifact),
      metadata_only: true,
    });
    if (!planResult.ok) throw new Error("expected invocation plan");

    expect(runDisabledTesseractInvocation(planResult.plan)).toMatchObject({
      invocation_id: "tesseract-stub-invocation",
      provider_id: "tesseract-stub",
      artifact_id: artifact.artifact_id,
      status: "execution_disabled",
      reason: "execution_disabled",
      redaction_status: "metadata_only",
      metadata_only: true,
      advisory_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
  });

  it("rejects raw bytes, base64, and OCR text before planning", async () => {
    const artifact = await safeArtifact();
    const enablement = allowedEnablement(artifact);

    for (const unsafeArtifact of [
      { ...artifact, raw_bytes: new Uint8Array([1, 2, 3]) },
      { ...artifact, source_ref_id: "data:image/png;base64,aW1hZ2U=" },
      { ...artifact, ocr_text: "unsafe text" },
    ]) {
      expect(
        createTesseractInvocationPlan({
          artifact: unsafeArtifact,
          enablement,
          metadata_only: true,
        }),
      ).toMatchObject({
        ok: false,
        plan: null,
        result: {
          status: "unsafe_payload_rejected",
          raw_payload_included: false,
        },
      });
    }
  });

  it("rejects remote URL sources before planning", async () => {
    const artifact = await safeArtifact();
    const enablement = allowedEnablement(artifact);

    expect(
      createTesseractInvocationPlan({
        artifact: {
          ...artifact,
          source_ref_id: "https://example.test/image.png",
        },
        enablement,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      plan: null,
      result: {
        status: "unsafe_payload_rejected",
      },
    });
  });

  it("inherits unsafe language and timeout failed preconditions", async () => {
    const artifact = await safeArtifact();
    const badLanguage = evaluateVisionOcrEnablement({
      provider_config: {
        ...enabledConfig,
        language: "eng+unsafe",
      },
      capability: "screenshot_ocr",
      artifact,
      user_triggered: true,
      timeout_ms: 5_000,
      metadata_only: true,
    });
    const badTimeout = evaluateVisionOcrEnablement({
      provider_config: enabledConfig,
      capability: "screenshot_ocr",
      artifact,
      user_triggered: true,
      timeout_ms: VISION_LOCAL_OCR_MAX_TIMEOUT_MS + 1,
      metadata_only: true,
    });

    expect(
      createTesseractInvocationPlan({
        artifact,
        enablement: badLanguage,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      result: { status: "language_not_allowed" },
    });
    expect(
      createTesseractInvocationPlan({
        artifact,
        enablement: badTimeout,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      result: { status: "timeout_config_invalid" },
    });
  });

  it("keeps invocation module free of process, file-read, and OCR package imports", () => {
    const sourceText = readFileSync(
      join(process.cwd(), "src/lib/vision-runtime/tesseract-invocation.ts"),
      "utf8",
    );

    expect(sourceText).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(/i,
    );
    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|yolo|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|yolo|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
  });

  it("does not include OCR text in any plan or result payload", async () => {
    const artifact = await safeArtifact();
    const planResult = createTesseractInvocationPlan({
      artifact,
      enablement: allowedEnablement(artifact),
      metadata_only: true,
    });
    if (!planResult.ok) throw new Error("expected invocation plan");
    const result = runDisabledTesseractInvocation(planResult.plan);

    expect(JSON.stringify({ plan: planResult.plan, result })).not.toMatch(
      /recognized_text|extracted_text|ocr_text_value|raw_text|text_output/i,
    );
  });
});
