export {
  VISION_CAPABILITIES,
  VISION_CAPTURE_MODES,
  VISION_INPUT_KINDS,
  VISION_OBSERVATION_KINDS,
  VISION_PROVIDER_KINDS,
  VISION_PROVIDER_RESULT_KINDS,
  VISION_PROVIDER_RESULT_REASONS,
  VISION_PROVIDER_RESULT_STATUSES,
  VISION_REDACTION_STATUSES,
  VISION_RUNTIME_ENVIRONMENTS,
  VISION_TELEMETRY_EVENT_TYPES,
  VisionCapabilitySchema,
  VisionCaptureModeSchema,
  VisionInputKindSchema,
  VisionObservationKindSchema,
  VisionObservationSchema,
  VisionProviderKindSchema,
  VisionProviderResultKindSchema,
  VisionProviderResultReasonSchema,
  VisionProviderResultSchema,
  VisionProviderResultStatusSchema,
  VisionRedactionStatusSchema,
  VisionRuntimeEnvironmentSchema,
  VisionRuntimePolicySchema,
  VisionSessionSchema,
  VisionTelemetryEventSchema,
  VisionTelemetryEventTypeSchema,
} from "./contracts";

export {
  DEFAULT_PHASE_15_DISABLED_FEATURE_GUARD,
  DEFAULT_VISION_RUNTIME_POLICY,
  PHASE_15_DISABLED_FEATURES,
  VISION_MUTATION_AUTHORITY_CLASSES,
  VISION_TELEMETRY_ALLOWED_FIELDS,
  VISION_TELEMETRY_FORBIDDEN_FIELDS,
  canVisionRequestMutationAuthority,
  createVisionObservation,
  evaluateVisionRuntimePolicy,
  sanitizeVisionTelemetryEvent,
} from "./policy";

export {
  createVisionProviderCancelledResult,
  createVisionProviderDegradedResult,
  createVisionProviderPolicyDeniedResult,
  createVisionProviderSuccessResult,
  createVisionProviderTimeoutResult,
  createVisionProviderUnsupportedCapabilityResult,
  evaluateVisionProviderRequest,
  isVisionProviderCapabilityAllowed,
} from "./provider";

export {
  createFakeMockCameraProvider,
  createFakeObjectDetectionProvider,
  createFakeOcrProvider,
} from "./fake-providers";

export {
  VisionProviderRegistry,
  createVisionProviderRegistry,
} from "./registry";

export {
  VISION_SESSION_EVENT_TYPES,
  VISION_SESSION_RESULT_REASONS,
  VISION_SESSION_STATES,
  VisionRuntimeSessionRecordSchema,
  VisionSessionEventTypeSchema,
  VisionSessionLifecycleEventSchema,
  VisionSessionResultReasonSchema,
  VisionSessionRunner,
  VisionSessionStateSchema,
  createFakeVisionSessionRunner,
} from "./session";

export {
  VISION_METADATA_ALLOWED_FIELDS,
  VISION_TELEMETRY_FORBIDDEN_FIELD_PATTERNS,
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
  sanitizeVisionSessionLifecycleEvent,
  sanitizeVisionTelemetryEventForEmission,
} from "./redaction";

export {
  VISION_SCREENSHOT_DENIAL_REASONS,
  VISION_SCREENSHOT_INPUT_KINDS,
  VISION_SCREENSHOT_REQUEST_STATUSES,
  VISION_SCREENSHOT_TRIGGER_SOURCES,
  VisionScreenshotDenialReasonSchema,
  VisionScreenshotGateDecisionSchema,
  VisionScreenshotInputKindSchema,
  VisionScreenshotRegionMetadataSchema,
  VisionScreenshotRequestSchema,
  VisionScreenshotRequestStatusSchema,
  VisionScreenshotSourceMetadataSchema,
  VisionScreenshotTriggerSourceSchema,
  VisionScreenshotUserTriggerMetadataSchema,
  validateVisionScreenshotRequest,
} from "./screenshot";

export {
  VISION_SCREENSHOT_CAPTURE_ADAPTER_KINDS,
  VISION_SCREENSHOT_CAPTURE_FAILURE_REASONS,
  VISION_SCREENSHOT_CAPTURE_STATUSES,
  VISION_SCREENSHOT_DIMENSION_BANDS,
  VisionScreenshotCaptureAdapterKindSchema,
  VisionScreenshotCaptureCancellationSchema,
  VisionScreenshotCaptureFailureReasonSchema,
  VisionScreenshotCaptureOptionsSchema,
  VisionScreenshotCaptureResultSchema,
  VisionScreenshotCaptureStatusSchema,
  VisionScreenshotDimensionBandSchema,
  createFakeScreenshotCaptureAdapter,
  createFakeScreenshotCaptureAdapterFactory,
} from "./screenshot-capture";

export {
  VISION_SCREENSHOT_SESSION_EVENT_TYPES,
  VISION_SCREENSHOT_SESSION_STATUSES,
  ScreenshotSessionRunner,
  VisionScreenshotSessionEventTypeSchema,
  VisionScreenshotSessionLifecycleEventSchema,
  VisionScreenshotSessionResultSchema,
  VisionScreenshotSessionStatusSchema,
  runFakeScreenshotOcrSession,
} from "./screenshot-session";

export type {
  VisionCapability,
  VisionCaptureMode,
  VisionInputKind,
  VisionObservation,
  VisionObservationKind,
  VisionProviderKind,
  VisionProviderResult,
  VisionProviderResultKind,
  VisionProviderResultReason,
  VisionProviderResultStatus,
  VisionRedactionStatus,
  VisionRuntimeEnvironment,
  VisionRuntimePolicy,
  VisionSession,
  VisionTelemetryEvent,
  VisionTelemetryEventType,
} from "./contracts";

export type {
  Phase15DisabledFeature,
  VisionMutationAuthorityClass,
  VisionPolicyDecision,
  VisionPolicyDenialReason,
  VisionPolicyEvaluationInput,
  VisionTelemetryValidationResult,
} from "./policy";

export type {
  VisionProvider,
  VisionProviderCancellationToken,
  VisionProviderHealth,
  VisionProviderRunRequest,
  VisionProviderRunResult,
} from "./provider";

export type { VisionProviderRegistryResult } from "./registry";

export type {
  VisionRuntimeSessionRecord,
  VisionSessionEventType,
  VisionSessionLifecycleEvent,
  VisionSessionResultReason,
  VisionSessionRunRequest,
  VisionSessionRunResult,
  VisionSessionRunnerOptions,
  VisionSessionState,
} from "./session";

export type {
  VisionMetadataAllowedField,
  VisionRedactionReason,
  VisionRedactionResult,
} from "./redaction";

export type {
  VisionScreenshotDenialReason,
  VisionScreenshotGateDecision,
  VisionScreenshotInputKind,
  VisionScreenshotRegionMetadata,
  VisionScreenshotRequest,
  VisionScreenshotRequestStatus,
  VisionScreenshotSourceMetadata,
  VisionScreenshotTriggerSource,
  VisionScreenshotUserTriggerMetadata,
} from "./screenshot";

export type {
  VisionScreenshotCaptureAdapter,
  VisionScreenshotCaptureAdapterKind,
  VisionScreenshotCaptureCancellation,
  VisionScreenshotCaptureFailureReason,
  VisionScreenshotCaptureOptions,
  VisionScreenshotCaptureResult,
  VisionScreenshotCaptureStatus,
  VisionScreenshotDimensionBand,
} from "./screenshot-capture";

export type {
  FakeScreenshotOcrSessionInput,
  ScreenshotSessionRunnerOptions,
  VisionScreenshotSessionEventType,
  VisionScreenshotSessionLifecycleEvent,
  VisionScreenshotSessionResult,
  VisionScreenshotSessionStatus,
} from "./screenshot-session";
