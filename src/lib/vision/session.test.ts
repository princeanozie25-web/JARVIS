import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_SESSION_FEATURE_FLAGS,
  VISION_SESSION_DISABLED_FEATURES,
  VisionSessionRecordSchema,
  cancelVisionSession,
  completeVisionSession,
  createVisionSessionTelemetryEvent,
  expireVisionSession,
  failVisionSession,
  requestVisionSession,
  startVisionSession,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SESSION_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function requestedSession() {
  return requestVisionSession({
    session_id: "vision-session:one",
    requested_input_type: "uploaded_image",
    surface: "chat",
    requested_at: 1_000,
    cancellation_token_hash: INPUT_HASH,
  });
}

describe("Phase 7A vision session foundation", () => {
  it("allows only one occupying vision session at once", () => {
    const first = startVisionSession({
      session: requestedSession(),
      now_ms: 1_010,
    });
    const second = requestVisionSession({
      session_id: "vision-session:two",
      requested_input_type: "camera_frame",
      surface: "developer_test",
      requested_at: 1_020,
      existing_sessions: [first],
    });

    expect(first).toMatchObject({
      state: "active",
      capture_started: false,
      perception_authority: false,
    });
    expect(second).toMatchObject({
      state: "denied",
      reason: "single_active_session_denied",
      ended_at: 1_020,
      duration_ms: 0,
      capture_started: false,
      action_executed: false,
    });
  });

  it("does not allow cancelled sessions to later complete successfully", () => {
    const active = startVisionSession({
      session: requestedSession(),
      now_ms: 1_010,
    });
    const cancelled = cancelVisionSession({
      session: active,
      now_ms: 1_050,
    });
    const completed = completeVisionSession({
      session: cancelled,
      now_ms: 1_100,
    });

    expect(cancelled).toMatchObject({
      state: "cancelling",
      reason: "cancelled",
      abort_signal_received: true,
      ended_at: 1_050,
      duration_ms: 50,
    });
    expect(completed).toMatchObject({
      state: "cancelling",
      reason: "cancelled",
      action_executed: false,
      capture_started: false,
    });
  });

  it("keeps expired and failed sessions advisory-only without action authority", () => {
    const active = startVisionSession({
      session: requestedSession(),
      now_ms: 1_010,
    });
    const expired = expireVisionSession({
      session: active,
      now_ms: 1_200,
    });
    const failed = failVisionSession({
      session: active,
      now_ms: 1_300,
      reason: "abort_signal_received",
    });

    for (const session of [expired, failed]) {
      expect(session).toMatchObject({
        advisory_only: true,
        perception_authority: false,
        raw_payload_stored: false,
        capture_started: false,
        cloud_called: false,
        action_executed: false,
        background_watcher_started: false,
      });
    }
    expect(expired.state).toBe("expired");
    expect(failed).toMatchObject({
      state: "failed",
      reason: "abort_signal_received",
      abort_signal_received: true,
    });
  });

  it("session records are metadata-only and local-first", () => {
    const session = requestedSession();

    expect(session).toMatchObject({
      metadata_only: true,
      advisory_only: true,
      perception_authority: false,
      raw_payload_stored: false,
      capture_started: false,
      cloud_called: false,
      action_executed: false,
      background_watcher_started: false,
      redaction_status: "metadata_only",
    });
  });

  it("rejects raw frame, image, OCR text, screen contents, and file paths", () => {
    const unsafe = {
      ...requestedSession(),
      raw_frame: "base64 frame",
      raw_image: "image bytes",
      ocr_text: "private OCR text",
      screen_contents: "private screen text",
      file_path: "C:/Users/person/image.png",
    };

    expect(VisionSessionRecordSchema.safeParse(unsafe).success).toBe(false);
  });

  it("keeps capture, cloud, actions, approval granting, and watchers disabled by default", () => {
    expect(Object.keys(DEFAULT_VISION_SESSION_FEATURE_FLAGS).sort()).toEqual(
      [...VISION_SESSION_DISABLED_FEATURES].sort(),
    );
    for (const feature of VISION_SESSION_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_SESSION_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("references failure replay by id and hash only", () => {
    const session = requestVisionSession({
      session_id: "vision-session:with-replay",
      requested_input_type: "ocr_region",
      surface: "developer_test",
      requested_at: 2_000,
      failure_replay_ref: {
        replay_id: "replay:one",
        input_hash: INPUT_HASH,
        metadata_only: true,
        raw_payload_included: false,
      },
    });

    expect(session.failure_replay_ref).toEqual({
      replay_id: "replay:one",
      input_hash: INPUT_HASH,
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(JSON.stringify(session)).not.toContain("raw_frame");
    expect(JSON.stringify(session)).not.toContain("ocr text");
  });

  it("emits metadata-only telemetry event shapes", () => {
    const completed = completeVisionSession({
      session: startVisionSession({
        session: requestedSession(),
        now_ms: 1_010,
      }),
      now_ms: 1_200,
    });
    const event = createVisionSessionTelemetryEvent({
      session: completed,
      event_type: "vision_session_completed",
      session_id_hash: SESSION_HASH,
    });

    expect(event).toEqual({
      event_type: "vision_session_completed",
      session_id_hash: SESSION_HASH,
      state: "completed",
      surface: "chat",
      requested_input_type: "uploaded_image",
      reason: "completed",
      duration_ms: 200,
      metadata_only: true,
      raw_payload_included: false,
      advisory_only: true,
      perception_authority: false,
      capture_started: false,
      cloud_called: false,
      action_executed: false,
    });
  });
});
