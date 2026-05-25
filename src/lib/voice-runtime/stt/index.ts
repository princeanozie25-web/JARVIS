export {
  STT_CANCELLATION_REASONS,
  STT_CONFIDENCE_BANDS,
  STT_VALIDATION_FAILURE_REASONS,
} from "./types";
export type {
  SttAudioMetadata,
  SttCancellationReason,
  SttConfidenceBand,
  SttProviderConfig,
  SttProviderHealth,
  SttTranscriptionOptions,
  SttTranscriptionRequest,
  SttTranscriptionResult,
  SttValidationFailureReason,
  SttValidationResult,
} from "./types";

export { validateSttTranscriptionRequest } from "./provider";
export type { SttProvider } from "./provider";

export {
  FASTER_WHISPER_CONFIG_VALIDATION_REASONS,
  FASTER_WHISPER_CONTRACT_LIMITS,
  validateFasterWhisperProviderConfig,
} from "./faster-whisper-contract";
export type {
  FasterWhisperConfigValidationReason,
  FasterWhisperConfigValidationResult,
  FasterWhisperProviderConfig,
} from "./faster-whisper-contract";
