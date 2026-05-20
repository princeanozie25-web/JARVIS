import { disabledSpeechResult } from "./disabled-provider";
import type { LocalTtsRuntimeStatus } from "./local-runtime";
import type {
  LocalSpeechProviderConfig,
  SpeechProvider,
  SpeechProviderStatus,
  SpeechSynthesisResult,
} from "./types";

export const localTtsPlaceholderConfig: LocalSpeechProviderConfig = {
  binaryPath: null,
  voiceModelPath: null,
  speakerId: null,
  sampleRate: null,
  startupTimeoutMs: 5_000,
};

export const localTtsPlaceholderProvider: SpeechProvider = {
  id: "local-tts-placeholder",
  enabled: false,
  status: "not_installed",
  config: localTtsPlaceholderConfig,
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
  config?: LocalSpeechProviderConfig;
  enabled?: boolean;
}): SpeechProvider {
  return {
    ...localTtsPlaceholderProvider,
    enabled: input.enabled ?? false,
    status: input.status,
    config: input.config ?? localTtsPlaceholderConfig,
  };
}

export function localTtsProviderFromRuntimeStatus(
  status: LocalTtsRuntimeStatus,
): SpeechProvider {
  return {
    ...localTtsPlaceholderProvider,
    enabled: status.config.enabled,
    status: status.status,
    config: status.config,
    metadata: status.metadata,
  };
}
