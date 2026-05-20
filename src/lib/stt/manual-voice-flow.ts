import type { TranscriptionInput, TranscriptionProvider } from "./types";

export type ManualTranscriptionStartBlockReason =
  | "recording_active"
  | "provider_disabled"
  | "provider_unavailable"
  | "empty_capture";

export function getManualTranscriptionStartBlockReason(input: {
  provider: TranscriptionProvider;
  transcriptionInput: TranscriptionInput;
  recordingActive: boolean;
}): ManualTranscriptionStartBlockReason | null {
  if (input.recordingActive) return "recording_active";
  if (!input.provider.enabled) return "provider_disabled";
  if (input.provider.status !== "ready") return "provider_unavailable";
  if (input.transcriptionInput.chunks.length === 0) return "empty_capture";
  return null;
}
