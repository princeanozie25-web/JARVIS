export { VOICE_ENGINE_FAILOVER_REASONS } from "./types";
export type {
  VoiceEngineFailoverInfo,
  VoiceEngineFailoverOptions,
  VoiceEngineFailoverReason,
  VoiceEngineHealth,
  VoiceEngineSelectedInfo,
  VoiceEngineTelemetrySink,
  VoiceSynthesisEngine,
} from "./types";

export { selectVoiceEngine, synthesizeOverEngineChain } from "./failover";
export type { VoiceEngineChainOutcome, VoiceEngineSelection } from "./failover";

export {
  CANONICAL_TERMINAL_ENGINE_ID,
  CANONICAL_TTS_ENGINE_IDS,
  CANONICAL_TTS_ENGINE_PRIORITIES,
} from "./registry";
export type { CanonicalTtsEngineId } from "./registry";

export { snapshotVoiceEngineHealth } from "./health-snapshot";
export type { VoiceEngineHealthSnapshot } from "./health-snapshot";

export {
  MLX_AUDIO_DEFAULT_TIMEOUT_MS,
  MLX_AUDIO_DEFAULT_URL,
  MLX_AUDIO_ENGINE_MODELS,
  MlxAudioEngineError,
  createMlxAudioSynthesisEngine,
  wavDurationMs,
} from "./mlx-audio-engine";
export type {
  MlxAudioCue,
  MlxAudioEngineKey,
  MlxAudioEngineOptions,
  MlxAudioLine,
} from "./mlx-audio-engine";
