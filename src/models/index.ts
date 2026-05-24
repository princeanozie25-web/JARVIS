export {
  MODEL_CAPABILITIES,
  MODEL_PROVIDER_KINDS,
  MODEL_RUNTIME_CLASSES,
  MODEL_TIERS,
  MODEL_VISIBILITIES,
} from "./types";
export type {
  ModelCapability,
  ModelProviderKind,
  ModelRegistry,
  ModelRegistryEntry,
  ModelRuntimeClass,
  ModelTier,
  ModelVisibility,
} from "./types";

export {
  ModelCapabilitySchema,
  ModelProviderKindSchema,
  ModelRegistryEntryMetadataSchema,
  ModelRegistryEntrySchema,
  ModelRegistrySchema,
  ModelRuntimeClassSchema,
  ModelTierSchema,
  ModelVisibilitySchema,
  parseModelRegistry,
  validateModelRegistry,
} from "./schema";

export {
  DEFAULT_MODEL_REGISTRY_PATH,
  createModelRegistry,
  createModelRegistryFromYaml,
  loadDefaultModelRegistry,
  loadModelRegistryFromFile,
  parseModelRegistryYaml,
} from "./registry";
export type {
  ModelRegistryAuthoritySnapshot,
  ModelRegistryLoader,
} from "./registry";

export {
  MODEL_FALLBACK_GOVERNANCE_FLAGS,
  MODEL_RESOLVER_FAILURE_REASONS,
  MODEL_RESOLVER_REJECTION_REASONS,
  buildFallbackPlan,
  resolveModel,
} from "./resolver";
export type {
  ModelFallbackGovernanceFlag,
  ModelFallbackPlan,
  ModelFallbackPlanOptions,
  ModelFallbackRejectionTrace,
  ModelResolverCandidate,
  ModelResolverFailure,
  ModelResolverFailureReason,
  ModelResolverInput,
  ModelResolverRejectionReason,
  ModelResolverResult,
  NormalizedModelResolverInput,
} from "./resolver";

export {
  MODEL_PROVIDER_FAILURE_CLASSES,
  MODEL_PROVIDER_FINISH_REASONS,
  MODEL_PROVIDER_REDACTION_STATUSES,
  MODEL_PROVIDER_STREAM_EVENT_KINDS,
} from "./providers/contract";
export type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderFinishReason,
  ModelProviderHealth,
  ModelProviderInput,
  ModelProviderMetadata,
  ModelProviderOutput,
  ModelProviderProvenance,
  ModelProviderRedactionStatus,
  ModelProviderRequest,
  ModelProviderRequestOptions,
  ModelProviderResponse,
  ModelProviderStreamEvent,
  ModelProviderStreamEventKind,
  ModelProviderTokenUsage,
  ModelProviderToolCall,
} from "./providers/contract";

export {
  MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
  MOCK_MODEL_PROVIDER_DEFAULT_MODEL_ID,
  createMockModelProvider,
} from "./providers/mock-provider";
export type {
  MockModelProviderFailureMode,
  MockModelProviderOptions,
} from "./providers/mock-provider";

export {
  OLLAMA_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
  createOllamaModelProvider,
} from "./providers/ollama-provider";
export type {
  OllamaProviderHealthErrorClass,
  OllamaProviderOptions,
  OllamaProviderProbeResult,
} from "./providers/ollama-provider";

export {
  createFakeOllamaClient,
  createOllamaHttpClient,
  createOllamaClientError,
} from "./providers/ollama-client";
export type {
  FakeOllamaClientOptions,
  OllamaClient,
  OllamaClientCallOptions,
  OllamaClientError,
  OllamaClientFailureClass,
  OllamaClientMessage,
  OllamaCompleteInput,
  OllamaCompleteRequest,
  OllamaCompleteResult,
  OllamaListModelsResult,
  OllamaModelDescriptor,
  OllamaFetchImpl,
  OllamaFetchResponse,
  OllamaHttpClientOptions,
  OllamaStreamEvent,
  OllamaTokenUsage,
} from "./providers/ollama-client";
