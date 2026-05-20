import type { TransientAudioChunk } from "../audio";

export type TranscriptionStatus =
  | "idle"
  | "preparing"
  | "transcribing"
  | "completed"
  | "error"
  | "disabled";

export interface TranscriptionInput {
  captureSessionId: string;
  chunks: readonly TransientAudioChunk[];
  sampleRate: number | null;
  durationMs: number;
  language?: string;
}

export interface TranscriptionResult {
  status: Exclude<TranscriptionStatus, "idle" | "preparing" | "transcribing">;
  providerId: string;
  text: string;
  reason?:
    | "not_configured"
    | "not_installed"
    | "provider_disabled"
    | "provider_unavailable"
    | "transcription_failed";
  errorMessage?: string;
}

export type TranscriptionProviderStatus =
  | "available"
  | "unavailable"
  | "not_installed";

export interface TranscriptionProviderCapabilities {
  supportsStreaming: boolean;
  supportsPartialResults: boolean;
  runsLocally: boolean;
  requiresNetwork: boolean;
  storesAudio: boolean;
}

export interface LocalTranscriptionProviderConfig {
  modelPath: string | null;
  device: "auto" | "cpu" | "gpu";
  language: string | null;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly enabled: boolean;
  readonly status: TranscriptionProviderStatus;
  readonly capabilities: TranscriptionProviderCapabilities;
  readonly config?: LocalTranscriptionProviderConfig;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export interface TranscriptionState {
  status: TranscriptionStatus;
  providerId: string | null;
  captureSessionId: string | null;
  text: string;
  errorMessage?: string;
  reason?: TranscriptionResult["reason"];
}
