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
  | { type: "ptt_started"; startedAt: number }
  | { type: "ptt_stopped" }
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
        captureStartedAt: action.startedAt,
        errorMessage: undefined,
      };

    case "ptt_stopped":
      if (state.status !== "recording") return state;
      return {
        ...state,
        status: "ready",
        pushToTalkActive: false,
        captureStartedAt: null,
      };

    case "error":
      return {
        ...state,
        status: "error",
        pushToTalkActive: false,
        captureStartedAt: null,
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
