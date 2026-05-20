import { describe, expect, it } from "vitest";
import { audioSessionReducer, initialAudioSessionState } from "./state";

describe("audioSessionReducer", () => {
  it("tracks permission request, grant, push-to-talk start, and stop", () => {
    const requesting = audioSessionReducer(initialAudioSessionState, {
      type: "permission_request_started",
    });
    expect(requesting.status).toBe("requesting_permission");

    const ready = audioSessionReducer(requesting, {
      type: "permission_resolved",
      permissionStatus: "granted",
    });
    expect(ready).toMatchObject({
      status: "ready",
      microphonePermissionStatus: "granted",
      pushToTalkActive: false,
    });

    const recording = audioSessionReducer(ready, {
      type: "ptt_started",
      captureSessionId: "capture-1",
      startedAt: 1_234,
      sampleRate: 48_000,
      streamActive: true,
    });
    expect(recording).toMatchObject({
      status: "recording",
      pushToTalkActive: true,
      activeCaptureSessionId: "capture-1",
      captureStartedAt: 1_234,
      captureSampleRate: 48_000,
      streamActive: true,
    });

    const updated = audioSessionReducer(recording, {
      type: "capture_vu_updated",
      vuLevel: 0.5,
      durationMs: 100,
    });
    expect(updated).toMatchObject({
      vuLevel: 0.5,
      captureDurationMs: 100,
    });

    const stopped = audioSessionReducer(updated, {
      type: "ptt_stopped",
      stoppedAt: 1_434,
    });
    expect(stopped).toMatchObject({
      status: "ready",
      pushToTalkActive: false,
      activeCaptureSessionId: null,
      captureStartedAt: null,
      captureDurationMs: 200,
      streamActive: false,
    });
  });

  it("surfaces permission denied without leaving capture active", () => {
    const denied = audioSessionReducer(
      {
        ...initialAudioSessionState,
        status: "requesting_permission",
        pushToTalkActive: true,
        captureStartedAt: 1_000,
        activeCaptureSessionId: "capture-1",
        streamActive: true,
      },
      {
        type: "permission_resolved",
        permissionStatus: "denied",
        errorMessage: "Permission denied",
      },
    );

    expect(denied).toMatchObject({
      status: "error",
      microphonePermissionStatus: "denied",
      pushToTalkActive: false,
      activeCaptureSessionId: null,
      captureStartedAt: null,
      streamActive: false,
      errorMessage: "Permission denied",
    });
  });

  it("transitions capture errors to a safe inactive state", () => {
    const errored = audioSessionReducer(
      {
        ...initialAudioSessionState,
        status: "recording",
        pushToTalkActive: true,
        captureStartedAt: 1_000,
        activeCaptureSessionId: "capture-1",
        streamActive: true,
      },
      { type: "capture_error", message: "Device disconnected" },
    );

    expect(errored).toMatchObject({
      status: "error",
      pushToTalkActive: false,
      activeCaptureSessionId: null,
      captureStartedAt: null,
      streamActive: false,
      vuLevel: 0,
      errorMessage: "Device disconnected",
    });
  });

  it("keeps browser default selected when refreshed devices do not include an explicit selection", () => {
    const refreshed = audioSessionReducer(
      {
        ...initialAudioSessionState,
        selectedInputDeviceId: "missing",
      },
      {
        type: "devices_refreshed",
        inputDevices: [
          { kind: "audioinput", deviceId: "mic-1", label: "Mic 1" },
        ],
        outputDevices: [],
      },
    );

    expect(refreshed.selectedInputDeviceId).toBe("");
  });
});
