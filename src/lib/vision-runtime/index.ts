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
  createVisionProviderDisabledResult,
  createVisionProviderExecutionDisabledResult,
  createVisionProviderPolicyDeniedResult,
  createVisionProviderPreconditionFailedResult,
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

export {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  DisabledTesseractProviderConfigSchema,
  TESSERACT_PROVIDER_HEALTH_STATUSES,
  createDisabledTesseractDryRunProvider,
  createDisabledTesseractProvider,
  createDisabledTesseractProviderFactory,
  runTesseractDryRunProviderPath,
} from "./tesseract-provider";

export {
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  DisabledYoloProviderConfigSchema,
  YOLO_PROVIDER_HEALTH_STATUSES,
  createDisabledYoloProvider,
  createDisabledYoloProviderFactory,
} from "./yolo-provider";

export {
  VISION_OCR_ARTIFACT_KINDS,
  VISION_OCR_ARTIFACT_REJECTION_REASONS,
  VISION_OCR_MIME_TYPE_HINTS,
  VISION_OCR_RETENTION_POLICIES,
  VISION_OCR_SENSITIVITY_CLASSES,
  VISION_OCR_SIZE_BANDS,
  VISION_OCR_SOURCE_REF_KINDS,
  VisionOcrArtifactKindSchema,
  VisionOcrArtifactRejectionReasonSchema,
  VisionOcrInputArtifactSchema,
  VisionOcrMimeTypeHintSchema,
  VisionOcrRetentionPolicySchema,
  VisionOcrSensitivityClassSchema,
  VisionOcrSizeBandSchema,
  VisionOcrSourceRefKindSchema,
  createVisionOcrArtifactFromScreenshotCapture,
  validateVisionOcrInputArtifact,
} from "./ocr-artifact";

export {
  VISION_LOCAL_OCR_ALLOWED_LANGUAGES,
  VISION_LOCAL_OCR_MAX_TIMEOUT_MS,
  VISION_LOCAL_OCR_PROVIDER_KINDS,
  VISION_OCR_ENABLEMENT_REASONS,
  VisionLocalOcrLanguageSchema,
  VisionLocalOcrProviderEnablementConfigSchema,
  VisionLocalOcrProviderKindSchema,
  VisionOcrEnablementReasonSchema,
  VisionOcrEnablementResultSchema,
  evaluateVisionOcrEnablement,
} from "./ocr-enablement";

export {
  TESSERACT_INVOCATION_EXECUTION_MODES,
  TESSERACT_INVOCATION_RESULT_STATES,
  TesseractInvocationExecutionModeSchema,
  TesseractInvocationPlanSchema,
  TesseractInvocationResultSchema,
  TesseractInvocationResultStateSchema,
  createTesseractInvocationPlan,
  runDisabledTesseractInvocation,
} from "./tesseract-invocation";

export {
  VISION_CAMERA_DENIAL_REASONS,
  VISION_CAMERA_INPUT_KINDS,
  VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  VISION_CAMERA_REQUEST_STATUSES,
  VISION_CAMERA_RETENTION_POLICIES,
  VISION_CAMERA_SAMPLING_MODES,
  VISION_CAMERA_TRIGGER_SOURCES,
  VisionCameraActiveIndicatorRequirementSchema,
  VisionCameraDenialReasonSchema,
  VisionCameraGateDecisionSchema,
  VisionCameraInputKindSchema,
  VisionCameraRequestSchema,
  VisionCameraRequestStatusSchema,
  VisionCameraRetentionPolicySchema,
  VisionCameraSamplingModeSchema,
  VisionCameraTriggerMetadataSchema,
  VisionCameraTriggerSourceSchema,
  VisionMockCameraFrameMetadataSchema,
  validateVisionCameraRequest,
} from "./mock-camera";

export {
  MOCK_CAMERA_FRAME_PROVIDER_KINDS,
  MOCK_CAMERA_STREAM_STATUSES,
  MockCameraFrameDescriptorSchema,
  MockCameraFrameProviderKindSchema,
  MockCameraStreamCancellationSchema,
  MockCameraStreamOptionsSchema,
  MockCameraStreamResultSchema,
  MockCameraStreamStatusSchema,
  createDeterministicMockCameraStream,
  createMockCameraFrameProvider,
} from "./mock-camera-provider";

export {
  MOCK_CAMERA_SESSION_EVENT_TYPES,
  MOCK_CAMERA_SESSION_STATUSES,
  MockCameraSessionEventTypeSchema,
  MockCameraSessionLifecycleEventSchema,
  MockCameraSessionResultSchema,
  MockCameraSessionRunner,
  MockCameraSessionStatusSchema,
  runMockCameraObjectSession,
} from "./mock-camera-session";

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

export type {
  DisabledTesseractProviderConfig,
  DisabledTesseractProviderHealth,
  TesseractDryRunProviderPathResult,
} from "./tesseract-provider";

export type {
  DisabledYoloProviderConfig,
  DisabledYoloProviderHealth,
} from "./yolo-provider";

export type {
  CreateVisionOcrArtifactFromCaptureInput,
  VisionOcrArtifactKind,
  VisionOcrArtifactProviderRunRequest,
  VisionOcrArtifactRejectionReason,
  VisionOcrArtifactValidationResult,
  VisionOcrInputArtifact,
  VisionOcrMimeTypeHint,
  VisionOcrRetentionPolicy,
  VisionOcrSensitivityClass,
  VisionOcrSizeBand,
  VisionOcrSourceRefKind,
} from "./ocr-artifact";

export type {
  VisionLocalOcrAllowedLanguage,
  VisionLocalOcrProviderEnablementConfig,
  VisionLocalOcrProviderKind,
  VisionOcrEnablementInput,
  VisionOcrEnablementReason,
  VisionOcrEnablementResult,
} from "./ocr-enablement";

export type {
  CreateTesseractInvocationPlanInput,
  TesseractInvocationExecutionMode,
  TesseractInvocationPlan,
  TesseractInvocationPlanResult,
  TesseractInvocationResult,
  TesseractInvocationResultState,
} from "./tesseract-invocation";

export type {
  VisionCameraActiveIndicatorRequirement,
  VisionCameraDenialReason,
  VisionCameraGateDecision,
  VisionCameraInputKind,
  VisionCameraRequest,
  VisionCameraRequestStatus,
  VisionCameraRetentionPolicy,
  VisionCameraSamplingMode,
  VisionCameraTriggerMetadata,
  VisionCameraTriggerSource,
  VisionMockCameraFrameMetadata,
} from "./mock-camera";

export type {
  MockCameraFrameDescriptor,
  MockCameraFrameProvider,
  MockCameraFrameProviderKind,
  MockCameraStreamCancellation,
  MockCameraStreamOptions,
  MockCameraStreamResult,
  MockCameraStreamStatus,
} from "./mock-camera-provider";

export type {
  MockCameraObjectSessionInput,
  MockCameraSessionEventType,
  MockCameraSessionLifecycleEvent,
  MockCameraSessionResult,
  MockCameraSessionRunnerOptions,
  MockCameraSessionStatus,
} from "./mock-camera-session";
