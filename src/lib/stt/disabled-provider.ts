import type { TranscriptionProvider, TranscriptionResult } from "./types";

export const disabledTranscriptionProvider: TranscriptionProvider = {
  id: "disabled-local-placeholder",
  enabled: false,
  async transcribe(): Promise<TranscriptionResult> {
    return disabledTranscriptionResult("not_configured");
  },
};

export function disabledTranscriptionResult(
  reason: "not_configured" | "provider_disabled" = "not_configured",
  providerId: string = disabledTranscriptionProvider.id,
): TranscriptionResult {
  return {
    status: "disabled",
    providerId,
    text: "",
    reason,
  };
}
