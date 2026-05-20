import type {
  AudioDeviceOption,
  AudioSessionState,
  MicrophonePermissionStatus,
} from "./types";

export const initialAudioSessionState: AudioSessionState = {
  status: "idle",
  microphonePermissionStatus: "unknown",
  selectedInputDeviceId: "",
  selectedOutputDeviceId: "",
  pushToTalkActive: false,
  captureStartedAt: null,
  activeCaptureSessionId: null,
  captureDurationMs: 0,
  captureSampleRate: null,
  streamActive: false,
  vuLevel: 0,
  inputDevices: [],
  outputDevices: [],
};

export type AudioSessionAction =
  | { type: "permission_request_started" }
  | {
      type: "permission_resolved";
      permissionStatus: MicrophonePermissionStatus;
      errorMessage?: string;
    }
  | {
      type: "devices_refreshed";
      inputDevices: AudioDeviceOption[];
      outputDevices: AudioDeviceOption[];
    }
  | { type: "input_selected"; deviceId: string }
  | { type: "output_selected"; deviceId: string }
  | {
      type: "ptt_started";
      captureSessionId: string;
      startedAt: number;
      sampleRate: number | null;
      streamActive: boolean;
    }
  | { type: "ptt_stopped"; stoppedAt: number }
  | { type: "capture_vu_updated"; vuLevel: number; durationMs: number }
  | { type: "capture_error"; message: string }
  | { type: "error"; message: string }
  | { type: "reset" };

export function audioSessionReducer(
  state: AudioSessionState,
  action: AudioSessionAction,
): AudioSessionState {
  switch (action.type) {
    case "permission_request_started":
      return {
        ...state,
        status: "requesting_permission",
        errorMessage: undefined,
      };

    case "permission_resolved":
      if (action.permissionStatus === "granted") {
        return {
          ...state,
          status: "ready",
          microphonePermissionStatus: "granted",
          errorMessage: undefined,
        };
      }
      return {
        ...state,
        status: action.permissionStatus === "denied" ? "error" : "idle",
        microphonePermissionStatus: action.permissionStatus,
        pushToTalkActive: false,
        captureStartedAt: null,
        activeCaptureSessionId: null,
        streamActive: false,
        vuLevel: 0,
        errorMessage: action.errorMessage,
      };

    case "devices_refreshed":
      return {
        ...state,
        inputDevices: action.inputDevices,
        outputDevices: action.outputDevices,
        selectedInputDeviceId: keepSelectedDevice(
          state.selectedInputDeviceId,
          action.inputDevices,
        ),
        selectedOutputDeviceId: keepSelectedDevice(
          state.selectedOutputDeviceId,
          action.outputDevices,
        ),
      };

    case "input_selected":
      return { ...state, selectedInputDeviceId: action.deviceId };

    case "output_selected":
      return { ...state, selectedOutputDeviceId: action.deviceId };

    case "ptt_started":
      if (state.status !== "idle" && state.status !== "ready") return state;
      return {
        ...state,
        status: "recording",
        pushToTalkActive: true,
        activeCaptureSessionId: action.captureSessionId,
        captureStartedAt: action.startedAt,
        captureDurationMs: 0,
        captureSampleRate: action.sampleRate,
        streamActive: action.streamActive,
        vuLevel: 0,
        errorMessage: undefined,
      };

    case "ptt_stopped":
      if (state.status !== "recording") return state;
      return {
        ...state,
        status: "ready",
        pushToTalkActive: false,
        activeCaptureSessionId: null,
        captureDurationMs:
          state.captureStartedAt === null
            ? state.captureDurationMs
            : Math.max(0, action.stoppedAt - state.captureStartedAt),
        captureStartedAt: null,
        streamActive: false,
        vuLevel: 0,
      };

    case "capture_vu_updated":
      if (state.status !== "recording") return state;
      return {
        ...state,
        captureDurationMs: Math.max(0, action.durationMs),
        vuLevel: Math.min(Math.max(action.vuLevel, 0), 1),
      };

    case "capture_error":
      return {
        ...state,
        status: "error",
        pushToTalkActive: false,
        activeCaptureSessionId: null,
        captureStartedAt: null,
        streamActive: false,
        vuLevel: 0,
        errorMessage: action.message,
      };

    case "error":
      return {
        ...state,
        status: "error",
        pushToTalkActive: false,
        captureStartedAt: null,
        activeCaptureSessionId: null,
        streamActive: false,
        vuLevel: 0,
        errorMessage: action.message,
      };

    case "reset":
      return initialAudioSessionState;
  }
}

function keepSelectedDevice(
  currentDeviceId: string,
  devices: AudioDeviceOption[],
): string {
  if (!currentDeviceId) return "";
  return devices.some((device) => device.deviceId === currentDeviceId)
    ? currentDeviceId
    : "";
}
