import type { TranscriptionProvider, TranscriptionResult } from "./types";

export const disabledTranscriptionProvider: TranscriptionProvider = {
  id: "disabled-local-placeholder",
  enabled: false,
  status: "unavailable",
  capabilities: {
    supportsStreaming: false,
    supportsPartialResults: false,
    runsLocally: true,
    requiresNetwork: false,
    storesAudio: false,
  },
  async transcribe(): Promise<TranscriptionResult> {
    return disabledTranscriptionResult("not_configured");
  },
};

export function disabledTranscriptionResult(
  reason: TranscriptionResult["reason"] = "not_configured",
  providerId: string = disabledTranscriptionProvider.id,
): TranscriptionResult {
  return {
    status: "disabled",
    providerId,
    text: "",
    reason,
  };
}
