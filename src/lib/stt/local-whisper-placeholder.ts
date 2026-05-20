import type {
  LocalTranscriptionProviderConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

export const localWhisperPlaceholderConfig: LocalTranscriptionProviderConfig = {
  modelPath: null,
  device: "auto",
  language: null,
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
