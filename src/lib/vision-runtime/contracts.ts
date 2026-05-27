import { z } from "zod";

export const VISION_CAPABILITIES = [
  "screenshot_ocr",
  "object_detection",
  "mock_camera",
  "real_camera",
  "cloud_vision",
] as const;

export const VISION_INPUT_KINDS = [
  "screenshot",
  "mock_camera_frame",
  "real_camera_frame",
] as const;

export const VISION_PROVIDER_KINDS = [
  "screenshot_ocr_placeholder",
  "fake_ocr",
  "fake_object_detector",
  "fake_mock_camera",
  "local_ocr",
  "tesseract_stub",
  "mock_camera",
  "real_camera",
  "cloud_vision",
] as const;

export const VISION_CAPTURE_MODES = [
  "single",
  "background",
  "periodic",
  "continuous",
] as const;

export const VISION_RUNTIME_ENVIRONMENTS = [
  "development",
  "test",
  "production",
] as const;

export const VISION_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
  "withheld",
] as const;

export const VISION_OBSERVATION_KINDS = [
  "ocr_summary",
  "mock_camera_observation",
  "object_hint",
] as const;

export const VISION_PROVIDER_RESULT_KINDS = [
  "no_result",
  "metadata_summary",
  "mock_observation",
] as const;

export const VISION_PROVIDER_RESULT_STATUSES = [
  "success",
  "degraded",
  "timeout",
  "cancelled",
  "unsupported_capability",
  "policy_denied",
] as const;

export const VISION_PROVIDER_RESULT_REASONS = [
  "completed",
  "degraded_fixture",
  "timeout",
  "cancelled",
  "unsupported_capability",
  "policy_denied",
] as const;

export const VISION_TELEMETRY_EVENT_TYPES = [
  "vision_policy_evaluated",
  "vision_session_created",
  "vision_observation_recorded",
  "vision_provider_result_recorded",
] as const;

const VisionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionTimestampSchema = z.number().int().nonnegative();

export const VisionCapabilitySchema = z.enum(VISION_CAPABILITIES);
export const VisionInputKindSchema = z.enum(VISION_INPUT_KINDS);
export const VisionProviderKindSchema = z.enum(VISION_PROVIDER_KINDS);
export const VisionCaptureModeSchema = z.enum(VISION_CAPTURE_MODES);
export const VisionRuntimeEnvironmentSchema = z.enum(
  VISION_RUNTIME_ENVIRONMENTS,
);
export const VisionRedactionStatusSchema = z.enum(VISION_REDACTION_STATUSES);
export const VisionObservationKindSchema = z.enum(VISION_OBSERVATION_KINDS);
export const VisionProviderResultKindSchema = z.enum(
  VISION_PROVIDER_RESULT_KINDS,
);
export const VisionProviderResultStatusSchema = z.enum(
  VISION_PROVIDER_RESULT_STATUSES,
);
export const VisionProviderResultReasonSchema = z.enum(
  VISION_PROVIDER_RESULT_REASONS,
);
export const VisionTelemetryEventTypeSchema = z.enum(
  VISION_TELEMETRY_EVENT_TYPES,
);

export type VisionCapability = (typeof VISION_CAPABILITIES)[number];
export type VisionInputKind = (typeof VISION_INPUT_KINDS)[number];
export type VisionProviderKind = (typeof VISION_PROVIDER_KINDS)[number];
export type VisionCaptureMode = (typeof VISION_CAPTURE_MODES)[number];
export type VisionRuntimeEnvironment =
  (typeof VISION_RUNTIME_ENVIRONMENTS)[number];
export type VisionRedactionStatus = (typeof VISION_REDACTION_STATUSES)[number];
export type VisionObservationKind = (typeof VISION_OBSERVATION_KINDS)[number];
export type VisionProviderResultKind =
  (typeof VISION_PROVIDER_RESULT_KINDS)[number];
export type VisionProviderResultStatus =
  (typeof VISION_PROVIDER_RESULT_STATUSES)[number];
export type VisionProviderResultReason =
  (typeof VISION_PROVIDER_RESULT_REASONS)[number];
export type VisionTelemetryEventType =
  (typeof VISION_TELEMETRY_EVENT_TYPES)[number];

export interface VisionRuntimePolicy {
  readonly screenshot_ocr_enabled: true;
  readonly screenshot_requires_user_trigger: true;
  readonly mock_camera_enabled_in_dev_test: true;
  readonly real_camera_enabled: false;
  readonly cloud_vision_enabled: false;
  readonly background_capture_enabled: false;
  readonly periodic_capture_enabled: false;
  readonly continuous_video_enabled: false;
  readonly raw_frame_persistence_enabled: false;
  readonly raw_ocr_text_telemetry_enabled: false;
  readonly observations_advisory_only: true;
  readonly observations_derived_only: true;
  readonly tool_triggers_enabled: false;
  readonly device_actions_enabled: false;
  readonly project_writes_enabled: false;
  readonly memory_writes_enabled: false;
  readonly approvals_enabled: false;
  readonly runtime_execution_enabled: false;
  readonly graph_driven_execution_enabled: false;
  readonly metadata_only: true;
}

export const VisionRuntimePolicySchema = z.strictObject({
  screenshot_ocr_enabled: z.literal(true),
  screenshot_requires_user_trigger: z.literal(true),
  mock_camera_enabled_in_dev_test: z.literal(true),
  real_camera_enabled: z.literal(false),
  cloud_vision_enabled: z.literal(false),
  background_capture_enabled: z.literal(false),
  periodic_capture_enabled: z.literal(false),
  continuous_video_enabled: z.literal(false),
  raw_frame_persistence_enabled: z.literal(false),
  raw_ocr_text_telemetry_enabled: z.literal(false),
  observations_advisory_only: z.literal(true),
  observations_derived_only: z.literal(true),
  tool_triggers_enabled: z.literal(false),
  device_actions_enabled: z.literal(false),
  project_writes_enabled: z.literal(false),
  memory_writes_enabled: z.literal(false),
  approvals_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  graph_driven_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const VisionSessionSchema = z.strictObject({
  session_id: VisionIdSchema,
  input_kind: VisionInputKindSchema,
  provider_kind: VisionProviderKindSchema,
  capability: VisionCapabilitySchema,
  capture_mode: VisionCaptureModeSchema,
  environment: VisionRuntimeEnvironmentSchema,
  user_triggered: z.boolean(),
  created_at_ms: VisionTimestampSchema,
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived_only: z.literal(true),
  raw_frame_persisted: z.literal(false),
  raw_ocr_text_persisted: z.literal(false),
  cloud_called: z.literal(false),
  action_authority: z.literal(false),
  mutation_authority: z.literal(false),
});

export const VisionObservationSchema = z.strictObject({
  observation_id: VisionIdSchema,
  session_id: VisionIdSchema,
  kind: VisionObservationKindSchema,
  redaction_status: VisionRedactionStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  created_at_ms: VisionTimestampSchema,
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  tool_trigger_requested: z.literal(false),
  action_requested: z.literal(false),
  mutation_requested: z.literal(false),
});

export const VisionProviderResultSchema = z.strictObject({
  result_id: VisionIdSchema,
  session_id: VisionIdSchema,
  provider_id: VisionIdSchema,
  provider_kind: VisionProviderKindSchema,
  capability: VisionCapabilitySchema,
  result_kind: VisionProviderResultKindSchema,
  status: VisionProviderResultStatusSchema,
  reason: VisionProviderResultReasonSchema,
  redaction_status: VisionRedactionStatusSchema,
  observation_count: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  degraded: z.boolean(),
  timed_out: z.boolean(),
  cancelled: z.boolean(),
  policy_denied: z.boolean(),
  unsupported_capability: z.boolean(),
  raw_payload_included: z.literal(false),
  raw_frame_persisted: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  cloud_called: z.literal(false),
  runtime_executed: z.literal(false),
});

export const VisionTelemetryEventSchema = z.strictObject({
  event_type: VisionTelemetryEventTypeSchema,
  session_id: VisionIdSchema.optional(),
  provider_id: VisionIdSchema.optional(),
  capability: VisionCapabilitySchema.optional(),
  input_kind: VisionInputKindSchema.optional(),
  provider_kind: VisionProviderKindSchema.optional(),
  decision: z.enum(["allowed", "denied"]).optional(),
  reason: z.string().trim().min(1).max(120).optional(),
  redaction_status: VisionRedactionStatusSchema,
  observation_count: z.number().int().nonnegative().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  timestamp_ms: VisionTimestampSchema,
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
});

export type VisionSession = z.infer<typeof VisionSessionSchema>;
export type VisionObservation = z.infer<typeof VisionObservationSchema>;
export type VisionProviderResult = z.infer<typeof VisionProviderResultSchema>;
export type VisionTelemetryEvent = z.infer<typeof VisionTelemetryEventSchema>;
