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

export {
  FAKE_STT_PROVIDER_MODES,
  FakeSttProviderError,
  createFakeSttProvider,
} from "./fake-provider";
export type {
  FakeSttProviderMode,
  FakeSttProviderOptions,
} from "./fake-provider";

export {
  FAKE_STT_DEGRADED_PROVIDER_HEALTH,
  FAKE_STT_HEALTHY_PROVIDER_HEALTH,
  FAKE_STT_OVERSIZED_AUDIO_REQUEST,
  FAKE_STT_PROVIDER_CONFIG,
  FAKE_STT_TIMEOUT_CANCELLATION_REASON,
  FAKE_STT_TRANSCRIPT,
  FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH,
  FAKE_STT_VALID_AUDIO_REQUEST,
} from "./fixtures";
