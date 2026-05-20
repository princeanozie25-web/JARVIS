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
  activeCaptureSessionId: string | null;
  captureDurationMs: number;
  captureSampleRate: number | null;
  streamActive: boolean;
  vuLevel: number;
  inputDevices: AudioDeviceOption[];
  outputDevices: AudioDeviceOption[];
  errorMessage?: string;
}

export interface TransientAudioChunk {
  sessionId: string;
  capturedAt: number;
  sampleRate: number | null;
  pcm: Float32Array;
}

export interface AudioCaptureSessionMetadata {
  id: string;
  startedAt: number;
  sampleRate: number | null;
  streamActive: boolean;
}

export type AudioTelemetryEventType =
  | "mic_permission_granted"
  | "mic_permission_denied"
  | "ptt_started"
  | "ptt_stopped"
  | "audio_capture_started"
  | "audio_capture_stopped"
  | "audio_capture_error";

export interface AudioTelemetryEvent {
  eventType: AudioTelemetryEventType;
  status: AudioSessionStatus;
  selectedInputDeviceId?: string;
  selectedOutputDeviceId?: string;
  notes?: string;
}
