export {
  TTS_CANCELLATION_REASONS,
  TTS_CONTENT_CLASSES,
  TTS_VALIDATION_FAILURE_REASONS,
} from "./types";
export type {
  TtsAudioChunkMetadata,
  TtsCancellationReason,
  TtsContentClass,
  TtsExecutionDiagnostics,
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

export {
  FAKE_TTS_PROVIDER_MODES,
  FakeTtsProviderError,
  createFakeTtsProvider,
} from "./fake-provider";
export type {
  FakeTtsProviderMode,
  FakeTtsProviderOptions,
} from "./fake-provider";

export {
  FAKE_TTS_ASSISTANT_PROSE_REQUEST,
  FAKE_TTS_DEGRADED_PROVIDER_HEALTH,
  FAKE_TTS_HEALTHY_PROVIDER_HEALTH,
  FAKE_TTS_PROVIDER_CONFIG,
  FAKE_TTS_TIMEOUT_CANCELLATION_REASON,
  FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH,
  FAKE_TTS_UNSAFE_CONTENT_REQUEST,
} from "./fixtures";

export {
  PiperTtsProviderError,
  buildPiperArgs,
  createPiperTtsProvider,
} from "./piper-provider";
export type {
  PiperProcessRunner,
  PiperSpawnOptions,
  PiperSpawnedProcess,
  PiperTtsProviderOptions,
} from "./piper-provider";

export {
  DEFAULT_PIPER_TTS_MAX_INPUT_CHARS,
  DEFAULT_PIPER_TTS_TIMEOUT_MS,
  PIPER_TTS_ENV_KEYS,
  PIPER_TTS_LOCAL_CONFIG_REASONS,
  loadPiperTtsLocalConfig,
} from "./local-config";
export type {
  PiperTtsEnvKey,
  PiperTtsLocalConfigReason,
  PiperTtsLocalConfigResult,
  PiperTtsLocalEnv,
} from "./local-config";
