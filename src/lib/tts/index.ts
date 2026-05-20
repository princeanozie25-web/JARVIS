export {
  chunkAssistantProseText,
  TtsSentenceChunker,
  type SpeechChunkerAllowedResult,
  type SpeechChunkerBlockedResult,
  type SpeechChunkerOptions,
  type SpeechChunkerResult,
} from "./chunker";
export {
  disabledSpeechProvider,
  disabledSpeechResult,
} from "./disabled-provider";
export {
  localTtsPlaceholderConfig,
  localTtsPlaceholderProvider,
  localTtsProviderFromRuntimeStatus,
  localTtsProviderWithStatus,
} from "./local-placeholder";
export {
  assertLocalSpeechOnly,
  LocalTtsRuntime,
  localTtsRuntimeMetadata,
  type LocalTtsRuntimeConfig,
  type LocalTtsRuntimeHandle,
  type LocalTtsRuntimeOptions,
  type LocalTtsRuntimeStatus,
} from "./local-runtime";
export {
  InMemorySpeechQueueManager,
  type SpeechQueueEnqueueResult,
  type SpeechQueueManagerOptions,
  type SpeechQueueRejectionReason,
} from "./queue";
export { SpeechProviderRegistry, speechProviders } from "./registry";
export {
  evaluateSpeechSafetyPolicy,
  type SpeechSafetyPolicyDecision,
} from "./safety-policy";
export type {
  SpeechPlaybackState,
  SpeechPlaybackStateStatus,
  LocalSpeechProviderConfig,
  SpeechChunk,
  SpeechQueueItem,
  SpeechQueueItemStatus,
  SpeechQueueTelemetryEvent,
  SpeechQueueTelemetryEventType,
  SpeechProvider,
  SpeechProviderMetadata,
  SpeechProviderStatus,
  SpeechSynthesisInput,
  SpeechSynthesisInputSource,
  SpeechSynthesisRefusalReason,
  SpeechSynthesisResult,
  SpeechSynthesisResultStatus,
} from "./types";
