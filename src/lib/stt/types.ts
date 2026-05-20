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
  | "disabled"
  | "not_installed"
  | "loading"
  | "ready"
  | "error";

export interface TranscriptionProviderCapabilities {
  supportsStreaming: boolean;
  supportsPartialResults: boolean;
  runsLocally: boolean;
  requiresNetwork: boolean;
  storesAudio: boolean;
}

export interface LocalTranscriptionProviderConfig {
  binaryPath: string | null;
  modelPath: string | null;
  device: "auto" | "cpu" | "gpu";
  language: string | null;
  startupTimeoutMs: number;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly enabled: boolean;
  readonly status: TranscriptionProviderStatus;
  readonly capabilities: TranscriptionProviderCapabilities;
  readonly config?: LocalTranscriptionProviderConfig;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export type TranscriptionJobStatus =
  | "queued"
  | "rejected"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TranscriptionJob {
  id: string;
  providerId: string;
  status: TranscriptionJobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  source: "ptt_capture";
  error?: string;
}

export type TranscriptionJobTelemetryEventType =
  | "transcription_job_rejected"
  | "transcription_job_started"
  | "transcription_job_completed"
  | "transcription_job_failed"
  | "transcription_job_cancelled";

export interface TranscriptionJobTelemetryEvent {
  eventType: TranscriptionJobTelemetryEventType;
  jobId: string;
  providerId: string;
  status: TranscriptionJobStatus;
  source: TranscriptionJob["source"];
  success: boolean;
  durationMs?: number;
  error?: string;
}

export interface TranscriptionState {
  status: TranscriptionStatus;
  providerId: string | null;
  captureSessionId: string | null;
  text: string;
  errorMessage?: string;
  reason?: TranscriptionResult["reason"];
}
