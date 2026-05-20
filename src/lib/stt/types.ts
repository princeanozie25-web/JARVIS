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
  reason?: "not_configured" | "provider_disabled" | "transcription_failed";
  errorMessage?: string;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly enabled: boolean;
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
