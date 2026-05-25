export {
  TTS_CANCELLATION_REASONS,
  TTS_CONTENT_CLASSES,
  TTS_VALIDATION_FAILURE_REASONS,
} from "./types";
export type {
  TtsAudioChunkMetadata,
  TtsCancellationReason,
  TtsContentClass,
  TtsProviderConfig,
  TtsProviderHealth,
  TtsSynthesisOptions,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsValidationFailureReason,
  TtsValidationResult,
} from "./types";

export { validateTtsSynthesisRequest } from "./provider";
export type { TtsProvider } from "./provider";

export {
  PIPER_CONFIG_VALIDATION_REASONS,
  PIPER_CONTRACT_LIMITS,
  validatePiperProviderConfig,
} from "./piper-contract";
export type {
  PiperConfigValidationReason,
  PiperConfigValidationResult,
  PiperProviderConfig,
} from "./piper-contract";
