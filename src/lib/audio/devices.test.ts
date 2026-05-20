import { describe, expect, it, vi } from "vitest";
import {
  listAudioDevices,
  requestMicrophonePermission,
  stopMediaStream,
  subscribeToAudioDeviceChanges,
  type AudioMediaDevices,
} from "./devices";

function mediaDevice(input: {
  deviceId: string;
  label?: string;
  kind: MediaDeviceKind;
}): MediaDeviceInfo {
  return input as MediaDeviceInfo;
}

describe("audio device helpers", () => {
  it("lists microphone and speaker devices without selecting one", async () => {
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: async () => [
        mediaDevice({
          deviceId: "mic-1",
          label: "Desk Mic",
          kind: "audioinput",
        }),
        mediaDevice({
          deviceId: "speaker-1",
          label: "Desk Speaker",
          kind: "audiooutput",
        }),
        mediaDevice({ deviceId: "cam-1", label: "Camera", kind: "videoinput" }),
      ],
      getUserMedia: vi.fn(),
    };

    await expect(listAudioDevices(mediaDevices)).resolves.toEqual({
      inputDevices: [
        { deviceId: "mic-1", label: "Desk Mic", kind: "audioinput" },
      ],
      outputDevices: [
        {
          deviceId: "speaker-1",
          label: "Desk Speaker",
          kind: "audiooutput",
        },
      ],
    });
  });

  it("closes permission-test microphone tracks immediately after grant", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };

    await expect(requestMicrophonePermission(mediaDevices)).resolves.toEqual({
      status: "granted",
    });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("surfaces permission denial without retaining a stream", async () => {
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn().mockRejectedValue(new Error("denied by browser")),
    };

    await expect(requestMicrophonePermission(mediaDevices)).resolves.toEqual({
      status: "denied",
      message: "denied by browser",
    });
  });

  it("unsubscribes devicechange listeners", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn(),
      addEventListener,
      removeEventListener,
    };

    const unsubscribe = subscribeToAudioDeviceChanges(vi.fn(), mediaDevices);
    expect(addEventListener).toHaveBeenCalledWith(
      "devicechange",
      expect.any(Function),
    );

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith(
      "devicechange",
      expect.any(Function),
    );
  });

  it("stops every track during explicit teardown", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stream = {
      getTracks: () => [{ stop: first }, { stop: second }],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
