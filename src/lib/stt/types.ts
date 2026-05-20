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
  confidence?: number;
  language?: string;
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
  executionTimeoutMs: number;
}

export interface TranscriptionProviderRunOptions {
  signal?: AbortSignal;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly enabled: boolean;
  readonly status: TranscriptionProviderStatus;
  readonly capabilities: TranscriptionProviderCapabilities;
  readonly config?: LocalTranscriptionProviderConfig;
  transcribe(
    input: TranscriptionInput,
    options?: TranscriptionProviderRunOptions,
  ): Promise<TranscriptionResult>;
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

export type LocalTranscriptionTelemetryEventType =
  | "local_transcription_started"
  | "local_transcription_completed"
  | "local_transcription_failed";

export interface LocalTranscriptionTelemetryEvent {
  eventType: LocalTranscriptionTelemetryEventType;
  providerId: string;
  success: boolean;
  durationMs?: number;
  error?: string;
}

export type VoiceTranscriptDraftStatus = "draft" | "discarded" | "submitted";

export interface VoiceTranscriptDraft {
  id: string;
  text: string;
  sourceJobId: string;
  createdAt: number;
  confidence?: number;
  language?: string;
  status: VoiceTranscriptDraftStatus;
}

export interface VoiceTranscriptChatPayload {
  target: "chat_input";
  source: "voice";
  text: string;
  sourceDraftId: string;
  sourceJobId: string;
  canApproveRuntimeActions: false;
}

export type VoiceTranscriptDraftTelemetryEventType =
  | "transcript_draft_created"
  | "transcript_draft_discarded"
  | "transcript_draft_submitted"
  | "transcript_draft_rejected";

export interface VoiceTranscriptDraftTelemetryEvent {
  eventType: VoiceTranscriptDraftTelemetryEventType;
  draftId?: string;
  sourceJobId?: string;
  status?: VoiceTranscriptDraftStatus;
  success: boolean;
  reason?: "not_completed" | "empty_transcript" | "no_active_draft";
}

export interface TranscriptionState {
  status: TranscriptionStatus;
  providerId: string | null;
  captureSessionId: string | null;
  text: string;
  errorMessage?: string;
  reason?: TranscriptionResult["reason"];
}
