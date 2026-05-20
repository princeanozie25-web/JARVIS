import type {
  LocalTranscriptionProviderConfig,
  TranscriptionProvider,
  TranscriptionProviderStatus,
  TranscriptionResult,
} from "./types";

export const localWhisperPlaceholderConfig: LocalTranscriptionProviderConfig = {
  binaryPath: null,
  modelPath: null,
  device: "auto",
  language: null,
  startupTimeoutMs: 5_000,
  executionTimeoutMs: 30_000,
};

export const localWhisperPlaceholderProvider: TranscriptionProvider = {
  id: "local-whisper-placeholder",
  enabled: false,
  status: "not_installed",
  config: localWhisperPlaceholderConfig,
  capabilities: {
    supportsStreaming: false,
    supportsPartialResults: false,
    runsLocally: true,
    requiresNetwork: false,
    storesAudio: false,
  },
  async transcribe(): Promise<TranscriptionResult> {
    return {
      status: "disabled",
      providerId: "local-whisper-placeholder",
      text: "",
      reason: "not_installed",
      errorMessage: "Local Whisper is not installed or configured.",
    };
  },
};

export function localWhisperProviderWithStatus(input: {
  status: TranscriptionProviderStatus;
  config?: LocalTranscriptionProviderConfig;
  enabled?: boolean;
}): TranscriptionProvider {
  return {
    ...localWhisperPlaceholderProvider,
    enabled: input.enabled ?? false,
    status: input.status,
    config: input.config ?? localWhisperPlaceholderConfig,
  };
}
