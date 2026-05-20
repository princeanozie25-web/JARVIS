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
      startedAt: 1_234,
    });
    expect(recording).toMatchObject({
      status: "recording",
      pushToTalkActive: true,
      captureStartedAt: 1_234,
    });

    const stopped = audioSessionReducer(recording, { type: "ptt_stopped" });
    expect(stopped).toMatchObject({
      status: "ready",
      pushToTalkActive: false,
      captureStartedAt: null,
    });
  });

  it("surfaces permission denied without leaving capture active", () => {
    const denied = audioSessionReducer(
      {
        ...initialAudioSessionState,
        status: "requesting_permission",
        pushToTalkActive: true,
        captureStartedAt: 1_000,
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
      captureStartedAt: null,
      errorMessage: "Permission denied",
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
