import type {
  SpeechProvider,
  SpeechSynthesisResult,
  SpeechSynthesisRefusalReason,
} from "./types";

export const disabledSpeechProvider: SpeechProvider = {
  id: "disabled",
  enabled: false,
  status: "disabled",
  metadata: {
    runsLocally: true,
    requiresNetwork: false,
    storesAudio: false,
    supportsStreaming: false,
  },
  async synthesize(): Promise<SpeechSynthesisResult> {
    return disabledSpeechResult("provider_disabled");
  },
};

export function disabledSpeechResult(
  reason: SpeechSynthesisRefusalReason = "provider_disabled",
  providerId: string = disabledSpeechProvider.id,
): SpeechSynthesisResult {
  return {
    status: "disabled",
    providerId,
    audio: null,
    reason,
  };
}
