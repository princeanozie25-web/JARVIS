export type AudioSessionStatus =
  | "idle"
  | "requesting_permission"
  | "ready"
  | "recording"
  | "error";

export type MicrophonePermissionStatus =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
}

export interface AudioSessionState {
  status: AudioSessionStatus;
  microphonePermissionStatus: MicrophonePermissionStatus;
  selectedInputDeviceId: string;
  selectedOutputDeviceId: string;
  pushToTalkActive: boolean;
  captureStartedAt: number | null;
  inputDevices: AudioDeviceOption[];
  outputDevices: AudioDeviceOption[];
  errorMessage?: string;
}

export type AudioTelemetryEventType =
  | "mic_permission_granted"
  | "mic_permission_denied"
  | "ptt_started"
  | "ptt_stopped";

export interface AudioTelemetryEvent {
  eventType: AudioTelemetryEventType;
  status: AudioSessionStatus;
  selectedInputDeviceId?: string;
  selectedOutputDeviceId?: string;
  notes?: string;
}
