import { disabledSpeechResult } from "./disabled-provider";
import type {
  SpeechProvider,
  SpeechProviderStatus,
  SpeechSynthesisResult,
} from "./types";

export const localTtsPlaceholderProvider: SpeechProvider = {
  id: "local-tts-placeholder",
  enabled: false,
  status: "not_installed",
  metadata: {
    runsLocally: true,
    requiresNetwork: false,
    storesAudio: false,
    supportsStreaming: false,
  },
  async synthesize(): Promise<SpeechSynthesisResult> {
    return disabledSpeechResult(
      "provider_unavailable",
      "local-tts-placeholder",
    );
  },
};

export function localTtsProviderWithStatus(input: {
  status: SpeechProviderStatus;
  enabled?: boolean;
}): SpeechProvider {
  return {
    ...localTtsPlaceholderProvider,
    enabled: input.enabled ?? false,
    status: input.status,
  };
}
