import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  VISION_LOCAL_OCR_MAX_TIMEOUT_MS,
  VisionProviderRegistry,
  createDisabledTesseractDryRunProvider,
  createDisabledTesseractProvider,
  createFakeScreenshotCaptureAdapter,
  createTesseractInvocationPlan,
  createVisionOcrArtifactFromScreenshotCapture,
  evaluateVisionOcrEnablement,
  runDisabledTesseractInvocation,
  runTesseractDryRunProviderPath,
  sanitizeVisionMetadataPayload,
  sanitizeVisionProviderResult,
  validateVisionOcrInputArtifact,
  type DisabledTesseractProviderConfig,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const source = {
  redacted_source_id: "redacted",
  source_id_hash:
    "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  metadata_only: true,
} as const;

const screenshotRequest: VisionScreenshotRequest = {
  request_id: "phase-15c-closeout-request",
  input_kind: "screenshot.region",
  trigger: {
    trigger_id: "phase-15c-closeout-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  region: {
    region_id: "phase-15c-closeout-region",
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

function providerRequest(
  artifact: VisionOcrInputArtifact,
): VisionOcrArtifactProviderRunRequest {
  return {
    request_id: "phase-15c-closeout-provider-request",
    session_id: "phase-15c-closeout-provider-session",
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

function combinedVisionOcrSource(): string {
  return visionRuntimeSourceFiles()
    .filter(
      (file) =>
        file.path.toLowerCase().includes("ocr") ||
        file.path.toLowerCase().includes("tesseract"),
    )
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

describe("Phase 15C real OCR integration closeout guards", () => {
  it("keeps the Tesseract provider disabled and not configured by default", async () => {
    expect(DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG).toMatchObject({
      provider_id: "tesseract-stub",
      provider_kind: "tesseract_stub",
      enabled: false,
      binary_path_configured: false,
      language: "eng",
      metadata_only: true,
      raw_image_input_allowed: false,
      raw_ocr_text_output_allowed: false,
      process_execution_allowed: false,
      persistence_allowed: false,
    });

    await expect(createDisabledTesseractProvider().health(15)).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        status: "disabled",
        reason: "not_configured",
        enabled: false,
        configured: false,
        binary_path_configured: false,
        process_spawned: false,
        metadata_only: true,
      }),
    );
  });

  it("fails closed when the disabled provider is run", async () => {
    const artifact = await safeArtifact();
    const result = await createDisabledTesseractProvider().run(
      providerRequest(artifact),
    );

    expect(result).toMatchObject({
      observations: [],
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_kind: "tesseract_stub",
      status: "provider_disabled",
      reason: "provider_disabled",
      raw_payload_included: false,
      raw_ocr_text_included: false,
      cloud_called: false,
      runtime_executed: false,
    });
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("allows valid OCR artifact metadata through preconditions but only to disabled execution", async () => {
    const artifact = await safeArtifact();
    const enablement = evaluateVisionOcrEnablement({
      provider_config: enabledConfig,
      capability: "screenshot_ocr",
      artifact,
      user_triggered: true,
      timeout_ms: 5_000,
      metadata_only: true,
    });
    const planResult = createTesseractInvocationPlan({
      artifact,
      enablement,
      metadata_only: true,
    });

    expect(enablement).toMatchObject({
      allowed: true,
      reason: "allowed",
      artifact_id: artifact.artifact_id,
      metadata_only: true,
      raw_payload_included: false,
      cloud_called: false,
      network_called: false,
      mutation_authority_granted: false,
      runtime_executed: false,
      provider_executed: false,
    });
    expect(planResult).toMatchObject({ ok: true, result: null });
    if (!planResult.ok) throw new Error("expected invocation plan");
    expect(planResult.plan).toMatchObject({
      execution_mode: "disabled_stub",
      artifact_id: artifact.artifact_id,
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      provider_executed: false,
      runtime_executed: false,
    });
    expect(runDisabledTesseractInvocation(planResult.plan)).toMatchObject({
      status: "execution_disabled",
      reason: "execution_disabled",
      metadata_only: true,
      raw_payload_included: false,
      ocr_text_included: false,
      provider_executed: false,
      runtime_executed: false,
    });
  });

  it("keeps dry-run provider results sanitized and metadata-only", async () => {
    const artifact = await safeArtifact();
    const result = runTesseractDryRunProviderPath({
      config: enabledConfig,
      request: providerRequest(artifact),
      metadata_only: true,
    });

    expect(result).toMatchObject({
      enablement_allowed: true,
      enablement_reason: "allowed",
      invocation_plan_created: true,
      observations: [],
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      invocation_result: {
        status: "execution_disabled",
        raw_payload_included: false,
        ocr_text_included: false,
      },
      provider_result: {
        status: "execution_disabled",
        reason: "not_implemented",
        raw_payload_included: false,
        raw_ocr_text_included: false,
      },
    });
    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({ ok: true });
    expect(sanitizeVisionProviderResult(result.provider_result)).toMatchObject({
      ok: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_image_payload|raw_frame_payload|image_bytes|frame_bytes|base64_payload|data:image|recognized_text|extracted_text|ocr_text_value|prompt|response|tool_output|file_contents/i,
    );
  });

  it("fails closed for unsafe artifact retention, remote sources, raw bytes, and secrets", async () => {
    const artifact = await safeArtifact();
    const unsafePayloads = [
      {
        payload: { ...artifact, retention_policy: "persist_until_restart" },
        reason: "non_ephemeral_retention_forbidden",
      },
      {
        payload: { ...artifact, source_ref_id: "https://example.test/a.png" },
        reason: "remote_source_forbidden",
      },
      {
        payload: { ...artifact, raw_bytes: Buffer.from("unsafe") },
        reason: "unsafe_payload",
      },
      {
        payload: { ...artifact, raw_bytes: new Uint8Array([1, 2, 3]) },
        reason: "unsafe_payload",
      },
      {
        payload: { ...artifact, secret: "unsafe" },
        reason: "unsafe_payload",
      },
      {
        payload: { ...artifact, token: "unsafe" },
        reason: "unsafe_payload",
      },
      {
        payload: { ...artifact, password: "unsafe" },
        reason: "unsafe_payload",
      },
    ] as const;

    for (const { payload, reason } of unsafePayloads) {
      expect(
        evaluateVisionOcrEnablement({
          provider_config: enabledConfig,
          capability: "screenshot_ocr",
          artifact: payload,
          user_triggered: true,
          timeout_ms: 5_000,
          metadata_only: true,
        }),
      ).toMatchObject({
        allowed: false,
        reason,
        raw_payload_included: false,
        provider_executed: false,
        runtime_executed: false,
      });
    }

    expect(
      validateVisionOcrInputArtifact({ ...artifact, api_key: "unsafe" }),
    ).toMatchObject({
      ok: false,
      reason: "forbidden_field",
      field_path: "api_key",
    });
  });

  it("fails closed for unsafe language and oversized timeout", async () => {
    const artifact = await safeArtifact();

    expect(
      evaluateVisionOcrEnablement({
        provider_config: {
          ...enabledConfig,
          language: "eng+unsafe",
        },
        capability: "screenshot_ocr",
        artifact,
        user_triggered: true,
        timeout_ms: 5_000,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "language_not_allowlisted",
    });
    expect(
      evaluateVisionOcrEnablement({
        provider_config: enabledConfig,
        capability: "screenshot_ocr",
        artifact,
        user_triggered: true,
        timeout_ms: VISION_LOCAL_OCR_MAX_TIMEOUT_MS + 1,
        metadata_only: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "timeout_out_of_bounds",
    });
  });

  it("keeps the default provider registry fake-only after explicit dry-run construction", async () => {
    const artifact = await safeArtifact();
    const explicitProvider = createDisabledTesseractDryRunProvider({
      enabled: true,
    });
    await expect(
      explicitProvider.run(providerRequest(artifact)),
    ).resolves.toMatchObject({
      provider_result: {
        provider_kind: "tesseract_stub",
        status: "execution_disabled",
        runtime_executed: false,
      },
    });

    const registry = VisionProviderRegistry.createFakeOnly();
    if (!registry.ok) throw new Error("fake-only registry should initialize");

    expect(
      registry.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
    expect(
      registry.registry
        .listProviders()
        .some((provider) => provider.kind === "tesseract_stub"),
    ).toBe(false);
  });

  it("keeps OCR dependency and subprocess execution markers absent", () => {
    const packageNames = [
      ...Object.keys(packageJson().dependencies ?? {}),
      ...Object.keys(packageJson().devDependencies ?? {}),
    ].join("\n");
    const ocrSource = combinedVisionOcrSource();

    expect(packageNames).not.toMatch(
      /tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime/i,
    );
    expect(ocrSource).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:tesseract|node-tesseract-ocr|paddleocr|paddle|yolo|ultralytics|opencv|onnxruntime)[^"']*["']\s*\)/i,
    );
    expect(ocrSource).not.toMatch(
      /node:child_process|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(|fork\s*\(|Command\.new|std::process/i,
    );
  });

  it("keeps screenshot, camera, cloud, network, UI, persistence, and mutation authority absent", () => {
    const sourceText = combinedVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|screenshot-desktop|captureScreen|screenCapture|takeScreenshot|captureScreenshot|ImageCapture|navigator\.mediaDevices|canvas\.toDataURL|toBlob|@tauri-apps\/api|invoke\s*\(|powershell|screencapture|gnome-screenshot/i,
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
      /readFile\s*\(|createReadStream\s*\(|writeFile\s*\(|appendFile\s*\(|createWriteStream|better-sqlite3|sqlite|database|indexedDB|localStorage|sessionStorage/i,
    );
    expect(sourceText).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|shell_command|approveAction\s*\(|grantApproval\s*\(|runAction\s*\(|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
    );
  });
});
