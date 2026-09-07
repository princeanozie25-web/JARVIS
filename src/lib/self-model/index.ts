// Self Model (E-050) — public surface. Browser-safe: nothing here touches
// sqlite, the filesystem or the network; `./default` (node composition) is
// imported explicitly by hosts that need the live model.
export * from "./contracts";
export { SelfModel, SELF_MODEL_DEFAULT_CACHE_TTL_MS } from "./model";
export type {
  SelfModelOptions,
  SelfModelSources,
  SelfSourceFn,
  SelfStatusSummary,
} from "./model";
export {
  reconcileClaims,
  freshnessOf,
  decayStaleClaim,
  compareClaims,
} from "./reconcile";
export {
  buildSelfContext,
  explainClaim,
  SELF_CONTEXT_DEFAULT_MAX_CHARS,
} from "./context";
export type {
  SelfContext,
  SelfContextOptions,
  SelfExplanation,
} from "./context";
export {
  buildSelfProjection,
  SelfProjectionSchema,
  SelfProjectionItemSchema,
  SELF_PROJECTION_SECTION_IDS,
} from "./projection";
export type { SelfProjection, SelfProjectionItem } from "./projection";
export {
  findSelfLeak,
  assertNoSelfLeak,
  isForbiddenKey,
  scrubText,
  SelfModelLeakError,
  SELF_MODEL_FORBIDDEN_KEYS,
  SECRET_VALUE_PATTERNS,
} from "./redaction";
export {
  buildConstitutionalClaims,
  parseIdentityLine,
  SELF_MODEL_STANDING_LIMITS,
} from "./sources/constitutional";
export { buildCapabilityClaims } from "./sources/capabilities";
export type {
  CapabilitySourceInput,
  CapabilityToolSummary,
  CapabilityModelSummary,
  CapabilityVoiceSummary,
} from "./sources/capabilities";
export {
  buildRuntimeClaims,
  RUNTIME_PROBE_TTL_MS,
  RUNTIME_DOCTOR_TTL_MS,
  RUNTIME_DB_TTL_MS,
} from "./sources/runtime";
export type { RuntimeObservations } from "./sources/runtime";
export {
  buildExperienceClaims,
  EXPERIENCE_DEFAULT_MIN_SAMPLES,
  EXPERIENCE_DEFAULT_WINDOW_MS,
} from "./sources/experience";
export type {
  ExperienceSourceInput,
  ExperienceToolCallRow,
  ExperienceTelemetryRow,
} from "./sources/experience";
export {
  buildRepositoryClaims,
  parseEnhancementRows,
  mapEnhancementStatus,
} from "./sources/repository";
export type {
  RepositorySourceInput,
  EnhancementRow,
} from "./sources/repository";
export {
  createSelfModelWriter,
  SELF_MODEL_WRITER_OPERATIONS,
  SELF_SNAPSHOT_EVENT_TYPE,
  SELF_OBSERVATION_EVENT_TYPE,
  SELF_MODEL_EVENT_SOURCE,
  SelfObservationSchema,
  SelfSnapshotEventMetadataSchema,
} from "./writers";
export type {
  SelfModelWriter,
  SelfEventSink,
  SelfObservation,
} from "./writers";
export {
  selfModelTools,
  SELF_MODEL_TOOL_IDS,
  setSelfModelProvider,
  selfDescribeTool,
  selfCapabilitiesTool,
  selfLimitsTool,
  selfStatusTool,
  selfExplainTool,
  selfContextTool,
  selfProjectionTool,
} from "./tools";
