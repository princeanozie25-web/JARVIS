import type { AudioDeviceOption, MicrophonePermissionStatus } from "./types";

export interface AudioMediaDevices {
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  addEventListener?(
    type: "devicechange",
    listener: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener?(
    type: "devicechange",
    listener: EventListenerOrEventListenerObject,
  ): void;
}

export interface MicrophonePermissionResult {
  status: MicrophonePermissionStatus;
  message?: string;
}

export function getBrowserAudioMediaDevices(): AudioMediaDevices | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.mediaDevices;
}

export async function requestMicrophonePermission(
  mediaDevices: AudioMediaDevices | undefined = getBrowserAudioMediaDevices(),
): Promise<MicrophonePermissionResult> {
  if (!mediaDevices?.getUserMedia) {
    return {
      status: "unsupported",
      message: "Microphone access is not supported in this browser.",
    };
  }

  let stream: MediaStream | undefined;
  try {
    stream = await mediaDevices.getUserMedia({ audio: true });
    return { status: "granted" };
  } catch (error) {
    return {
      status: "denied",
      message:
        error instanceof Error
          ? error.message
          : "Microphone permission was denied.",
    };
  } finally {
    stopMediaStream(stream);
  }
}

export async function listAudioDevices(
  mediaDevices: AudioMediaDevices | undefined = getBrowserAudioMediaDevices(),
): Promise<{
  inputDevices: AudioDeviceOption[];
  outputDevices: AudioDeviceOption[];
}> {
  if (!mediaDevices?.enumerateDevices) {
    return { inputDevices: [], outputDevices: [] };
  }

  const devices = await mediaDevices.enumerateDevices();
  return {
    inputDevices: devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => toAudioDeviceOption(device, index, "audioinput")),
    outputDevices: devices
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) =>
        toAudioDeviceOption(device, index, "audiooutput"),
      ),
  };
}

export function subscribeToAudioDeviceChanges(
  onChange: () => void,
  mediaDevices: AudioMediaDevices | undefined = getBrowserAudioMediaDevices(),
): () => void {
  if (!mediaDevices?.addEventListener || !mediaDevices.removeEventListener) {
    return () => undefined;
  }

  const listener = () => onChange();
  mediaDevices.addEventListener("devicechange", listener);
  return () => {
    mediaDevices.removeEventListener?.("devicechange", listener);
  };
}

export function stopMediaStream(stream: MediaStream | undefined): void {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}

function toAudioDeviceOption(
  device: MediaDeviceInfo,
  index: number,
  kind: AudioDeviceOption["kind"],
): AudioDeviceOption {
  return {
    deviceId: device.deviceId,
    label: device.label || `Audio device ${index + 1}`,
    kind,
  };
}
