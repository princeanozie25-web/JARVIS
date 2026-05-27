import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  sanitizeVisionMetadataPayload,
  validateVisionCameraRequest,
  type VisionCameraRequest,
} from "../../src/lib/vision-runtime";

const baseRequest: VisionCameraRequest = {
  request_id: "mock-camera-request",
  input_kind: "camera.frame.mock",
  environment: "test",
  trigger: {
    trigger_id: "mock-camera-trigger",
    source: "user",
    explicit_user_action: true,
    surface: "test",
    initiated_at_ms: 10,
    metadata_only: true,
  },
  frame: {
    frame_id: "mock-camera-frame",
    mock_fixture_id: "fixture-front-desk",
    width_band: "medium",
    height_band: "small",
    redacted_source_id: "redacted",
    source_id_hash:
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    metadata_only: true,
  },
  sampling_mode: "single_frame",
  requested_frame_count: 1,
  active_indicator: {
    required: true,
    visible: true,
    indicator_id: "mock-camera-indicator",
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

describe("Phase 15D.1 mock camera governance gate", () => {
  it("accepts valid mock camera requests in test and development mode", () => {
    for (const environment of ["test", "development"] as const) {
      expect(
        validateVisionCameraRequest({
          ...baseRequest,
          environment,
        }),
      ).toMatchObject({
        request_id: "mock-camera-request",
        status: "accepted",
        reason: null,
        input_kind: "camera.frame.mock",
        environment,
        trigger_source: "user",
        sampling_mode: "single_frame",
        requested_frame_count: 1,
        max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
        provider_execution_allowed: true,
        session_execution_allowed: true,
        active_indicator_required: true,
        active_indicator_visible: true,
        retention_policy: "ephemeral_only",
        redaction_status: "metadata_only",
        metadata_only: true,
        raw_payload_included: false,
        raw_image_included: false,
        raw_frame_included: false,
        base64_included: false,
        ocr_text_included: false,
        mutation_authority_granted: false,
        runtime_executed: false,
      });
    }
    expect(
      sanitizeVisionMetadataPayload(validateVisionCameraRequest(baseRequest)),
    ).toMatchObject({
      ok: true,
      redaction_status: "metadata_only",
    });
  });

  it("denies mock camera requests outside dev/test mode", () => {
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

  it("denies real camera requests by default", () => {
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        input_kind: "camera.frame.real",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "real_camera_disabled",
      input_kind: "camera.frame.real",
      provider_execution_allowed: false,
      session_execution_allowed: false,
    });
  });

  it("denies missing and ambiguous trigger provenance", () => {
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        trigger: null,
      }),
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
  });

  it("denies assistant, scheduler, background, periodic, and remote triggers", () => {
    const cases = {
      assistant: "assistant_trigger_forbidden",
      scheduler: "scheduler_trigger_forbidden",
      background: "background_trigger_forbidden",
      periodic: "periodic_trigger_forbidden",
      remote_network: "remote_network_trigger_forbidden",
    } as const;

    for (const [source, reason] of Object.entries(cases)) {
      expect(
        validateVisionCameraRequest({
          ...baseRequest,
          trigger: {
            ...baseRequest.trigger!,
            source: source as keyof typeof cases,
          },
        }),
      ).toMatchObject({
        status: "denied",
        reason,
        trigger_source: source,
      });
    }
  });

  it("denies continuous video, periodic sampling, and sampling above policy", () => {
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
        sampling_mode: "periodic",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "sampling_policy_exceeded",
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

  it("denies hidden capture and missing active indicator metadata", () => {
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
  });

  it("rejects raw frame, image, base64, and OCR text fields", () => {
    for (const field of [
      "raw_frame",
      "raw_image",
      "frame_bytes",
      "image_bytes",
      "base64",
      "ocr_text",
    ]) {
      expect(
        validateVisionCameraRequest({
          ...baseRequest,
          [field]: "unsafe",
        }),
      ).toMatchObject({
        status: "denied",
        reason: "raw_payload_forbidden",
        raw_payload_included: false,
      });
    }
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        frame: {
          ...baseRequest.frame!,
          source_ref: "data:image/png;base64,unsafe",
        },
      }),
    ).toMatchObject({
      status: "denied",
      reason: "raw_payload_forbidden",
    });
  });

  it("denies mutation authority requests and unknown camera input kinds", () => {
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        mutation_authority_requested: ["tool_trigger"],
      }),
    ).toMatchObject({
      status: "denied",
      reason: "mutation_authority_forbidden",
      mutation_authority_granted: false,
    });
    expect(
      validateVisionCameraRequest({
        ...baseRequest,
        input_kind: "camera.stream.mock",
      }),
    ).toMatchObject({
      status: "denied",
      reason: "unknown_camera_input_kind",
      provider_execution_allowed: false,
    });
  });

  it("keeps real camera, browser media, native, Tauri, and network markers absent", () => {
    const sourceText = readVisionRuntimeSource();

    expect(sourceText).not.toMatch(
      /getUserMedia|mediaDevices|enumerateDevices|MediaRecorder|MediaStream|VideoCapture|cameraDevice|startCamera|openCamera/i,
    );
    expect(sourceText).not.toMatch(
      /getDisplayMedia|desktopCapturer|@tauri-apps\/api|invoke\s*\(|Command\.new|std::process|windows\.media|windows\.graphics\.capture/i,
    );
    expect(sourceText).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|node:http|node:https/i,
    );
    expect(sourceText).not.toMatch(
      /React|useEffect|useState|button|onClick|app\/api|writeFile|appendFile|better-sqlite3|sqlite|database/i,
    );
    expect(sourceText).not.toMatch(
      /executeTool\s*\(|runTool\s*\(|toolExecutor|deviceCommand\s*\(|projectWrite\s*\(|memoryWrite\s*\(|runtimeCommand\s*\(|executeRuntime\s*\(/i,
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
