import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  MockCameraSessionLifecycleEventSchema,
  MockCameraSessionRunner,
  createDeterministicMockCameraStream,
  createMockCameraFrameProvider,
  runMockCameraObjectSession,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  validateVisionCameraRequest,
  type MockCameraFrameProvider,
  type MockCameraStreamOptions,
  type VisionCameraRequest,
} from "../../src/lib/vision-runtime";

const VISION_RUNTIME_SOURCE_ROOT = join(
  process.cwd(),
  "src/lib/vision-runtime",
);

const baseRequest: VisionCameraRequest = {
  request_id: "phase-15d-closeout-request",
  input_kind: "camera.frame.mock",
  environment: "test",
  trigger: {
    trigger_id: "phase-15d-closeout-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  frame: {
    frame_id: "phase-15d-closeout-frame",
    mock_fixture_id: "fixture-phase-15d-desk",
    width_band: "medium",
    height_band: "small",
    redacted_source_id: "redacted",
    source_id_hash:
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    metadata_only: true,
  },
  sampling_mode: "single_frame",
  requested_frame_count: 1,
  active_indicator: {
    required: true,
    visible: true,
    indicator_id: "phase-15d-closeout-indicator",
    metadata_only: true,
  },
  retention_policy: "ephemeral_only",
  redaction_status: "metadata_only",
  mutation_authority_requested: [],
  requested_at_ms: 10,
  metadata_only: true,
  raw_payload_included: false,
  raw_image_included: false,
  raw_frame_included: false,
  base64_included: false,
  ocr_text_included: false,
  persisted: false,
};

const streamOptions: MockCameraStreamOptions = {
  timeout_ms: 100,
  requested_at_ms: 10,
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

describe("Phase 15D mock camera runtime closeout guards", () => {
  it("keeps mock camera limited to development and test mode", () => {
    for (const environment of ["test", "development"] as const) {
      expect(
        validateVisionCameraRequest({
          ...baseRequest,
          environment,
        }),
      ).toMatchObject({
        status: "accepted",
        environment,
        input_kind: "camera.frame.mock",
        provider_execution_allowed: true,
        session_execution_allowed: true,
        metadata_only: true,
        raw_payload_included: false,
      });
    }

    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        environment: "production",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "mock_camera_dev_test_only",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
  });

  it("keeps real camera denied by default", () => {
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        input_kind: "camera.frame.real",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "real_camera_disabled",
      provider_execution_allowed: false,
      session_execution_allowed: false,
      runtime_executed: false,
    });
  });

  it("denies missing, ambiguous, assistant, scheduler, background, periodic, and remote provenance", () => {
    expect(
      validateVisionCameraRequest({ ...baseRequest, trigger: null }),
    ).toMatchObject({
      status: "denied",
      reason: "missing_trigger_provenance",
    });
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        trigger: {
          ...baseRequest.trigger!,
          explicit_user_action: false,
        },
      }),
    ).toMatchObject({
      status: "denied",
      reason: "ambiguous_trigger_provenance",
    });

    const forbiddenTriggers = {
      assistant: "assistant_trigger_forbidden",
      scheduler: "scheduler_trigger_forbidden",
      background: "background_trigger_forbidden",
      periodic: "periodic_trigger_forbidden",
      remote_network: "remote_network_trigger_forbidden",
    } as const;

    for (const [source, reason] of Object.entries(forbiddenTriggers)) {
      expect(
        validateVisionCameraRequest({
          ...baseRequest,
          trigger: {
            ...baseRequest.trigger!,
            source: source as keyof typeof forbiddenTriggers,
          },
        }),
      ).toMatchObject({
        status: "denied",
        reason,
        trigger_source: source,
        provider_execution_allowed: false,
        session_execution_allowed: false,
      });
    }
  });

  it("keeps continuous video, hidden capture, missing indicators, and excessive sampling denied", () => {
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        sampling_mode: "continuous",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "continuous_video_forbidden",
    });
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        active_indicator: {
          ...baseRequest.active_indicator!,
          visible: false,
        },
      }),
    ).toMatchObject({
      status: "denied",
      reason: "hidden_capture_forbidden",
      active_indicator_visible: false,
    });
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        active_indicator: null,
      }),
    ).toMatchObject({
      status: "denied",
      reason: "active_indicator_required",
      active_indicator_required: false,
    });
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        requested_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST + 1,
      }),
    ).toMatchObject({
      status: "denied",
      reason: "sampling_policy_exceeded",
    });
  });

  it("denied requests produce no frames and no provider execution", async () => {
    const provider = createMockCameraFrameProvider();
    const deniedStream = await provider.stream(
      {
        ...baseRequest,
        trigger: {
          ...baseRequest.trigger!,
          source: "scheduler",
        },
      },
      streamOptions,
    );
    expect(deniedStream).toMatchObject({
      status: "gate_denied",
      frame_count: 0,
      frames: [],
      raw_payload_included: false,
      runtime_executed: false,
      mutation_authority_granted: false,
    });

    const deniedSession = await runnerWithThrowingFrameProvider().run({
      request: {
        ...baseRequest,
        trigger: {
          ...baseRequest.trigger!,
          source: "scheduler",
        },
      },
      stream_options: streamOptions,
      metadata_only: true,
    });
    expect(deniedSession).toMatchObject({
      status: "denied",
      stream_result: null,
      provider_result: null,
      observations: [],
      frame_count: 0,
      observation_count: 0,
      provider_executed: false,
      mock_frame_stream_executed: false,
    });
  });

  it("keeps the mock frame stream deterministic and bounded", () => {
    const first = createDeterministicMockCameraStream({
      request: baseRequest,
      options: streamOptions,
    });
    const second = createDeterministicMockCameraStream({
      request: baseRequest,
      options: streamOptions,
    });
    const sameFixture = createDeterministicMockCameraStream({
      request: {
        ...baseRequest,
        frame: {
          ...baseRequest.frame!,
          frame_id: "phase-15d-closeout-different-frame",
        },
      },
      options: streamOptions,
    });

    expect(first).toEqual(second);
    expect(first.frames).toEqual(sameFixture.frames);
    expect(first).toMatchObject({
      status: "success",
      frame_count: 1,
      max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
      metadata_only: true,
      raw_frame_included: false,
      raw_image_included: false,
      base64_included: false,
      detection_labels_included: false,
    });
    expect(first.frame_count).toBeLessThanOrEqual(
      VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
    );
  });

  it("keeps cancellation, timeout, and no-signal states metadata-safe", () => {
    const cancelled = createDeterministicMockCameraStream({
      request: baseRequest,
      options: {
        ...streamOptions,
        cancellation: {
          cancellation_id: "phase-15d-closeout-cancelled",
          cancelled: true,
          requested_at_ms: 11,
          metadata_only: true,
        },
      },
    });
    const timeout = createDeterministicMockCameraStream({
      request: baseRequest,
      options: {
        ...streamOptions,
        timeout_ms: 1,
        simulated_latency_ms: 2,
      },
    });
    const noSignal = createDeterministicMockCameraStream({
      request: baseRequest,
      options: {
        ...streamOptions,
        degraded: true,
      },
    });

    for (const result of [cancelled, timeout, noSignal]) {
      expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(result).toMatchObject({
        frame_count: 0,
        frames: [],
        metadata_only: true,
        raw_payload_included: false,
        raw_image_included: false,
        raw_frame_included: false,
        base64_included: false,
        ocr_text_included: false,
        detection_labels_included: false,
      });
    }
    expect(cancelled).toMatchObject({ status: "cancelled", cancelled: true });
    expect(timeout).toMatchObject({ status: "timeout", timed_out: true });
    expect(noSignal).toMatchObject({
      status: "no_signal",
      degraded: true,
    });
  });

  it("keeps mock camera object sessions derived, advisory, and metadata-only", async () => {
    const result = await runMockCameraObjectSession({
      request: baseRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      status: "completed",
      frame_count: 1,
      observation_count: 1,
      provider_executed: true,
      mock_frame_stream_executed: true,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      persisted: false,
      runtime_executed: false,
    });
    expect(result.provider_result).toMatchObject({
      provider_kind: "fake_object_detector",
      capability: "object_detection",
      status: "success",
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      runtime_executed: false,
    });
    expect(result.observations).toHaveLength(1);
    for (const observation of result.observations) {
      expect(sanitizeVisionObservation(observation)).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(observation).toMatchObject({
        kind: "object_hint",
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      });
    }
  });

  it("keeps mock camera lifecycle events metadata-only", async () => {
    const result = await runMockCameraObjectSession({
      request: baseRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      if ("request_id" in event) {
        expect(
          MockCameraSessionLifecycleEventSchema.safeParse(event).success,
        ).toBe(true);
      }
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

  it("prevents raw frame, image, base64, OCR text, object payload, prompt, response, tool output, and file content leakage", async () => {
    const result = await runMockCameraObjectSession({
      request: baseRequest,
      stream_options: streamOptions,
      metadata_only: true,
    });

    expect(sanitizeVisionMetadataPayload(result)).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /raw_frame_payload|raw_image_payload|frame_bytes|image_bytes|base64_payload|ocr_text_value|extracted_text|recognized_text|object_label|detection_label_value|bounding_box|prompt|response|tool_output|file_contents/i,
    );

    for (const field of [
      "raw_frame",
      "raw_image",
      "frame_bytes",
      "image_data",
      "base64",
      "ocr_text",
      "prompt",
      "response",
      "tool_output",
      "file_contents",
      "secret",
      "token",
      "password",
    ]) {
      expect(
        sanitizeVisionMetadataPayload({
          event_type: "vision_observation_recorded",
          session_id: "phase-15d-closeout-session",
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

  it("keeps camera sessions non-authoritative", async () => {
    const result = await runMockCameraObjectSession({
      request: baseRequest,
      stream_options: streamOptions,
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

  it("keeps real camera, media, browser, Tauri, native, and device-enumeration markers absent", () => {
    const sourceText = combinedVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /getUserMedia|mediaDevices|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.media|windows\.graphics\.capture|GraphicsCaptureItem/i,
    );
  });

  it("keeps real object detection, cloud, network, UI, persistence, and mutation authority absent", () => {
    const sourceText = combinedVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /from\s+["'](?!\.)[^"']*(?:yolo|ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']|require\s*\(\s*["'](?!\.)[^"']*(?:yolo|ultralytics|opencv|onnxruntime|tensorflow|tfjs|mediapipe)[^"']*["']\s*\)/i,
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

function runnerWithThrowingFrameProvider(): MockCameraSessionRunner {
  const throwingFrameProvider: MockCameraFrameProvider = {
    ...createMockCameraFrameProvider(),
    async stream() {
      throw new Error("frame provider must not run for denied requests");
    },
  };

  return new MockCameraSessionRunner({
    frame_provider: throwingFrameProvider,
  });
}
