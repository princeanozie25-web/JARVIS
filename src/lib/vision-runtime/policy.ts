import {
  VisionCapabilitySchema,
  VisionCaptureModeSchema,
  VisionInputKindSchema,
  VisionObservationSchema,
  VisionProviderKindSchema,
  VisionRuntimeEnvironmentSchema,
  VisionRuntimePolicySchema,
  VisionTelemetryEventSchema,
  type VisionCapability,
  type VisionCaptureMode,
  type VisionInputKind,
  type VisionObservation,
  type VisionProviderKind,
  type VisionRuntimeEnvironment,
  type VisionRuntimePolicy,
  type VisionTelemetryEvent,
} from "./contracts";

export const PHASE_15_DISABLED_FEATURES = [
  "real_camera_activation",
  "always_on_vision",
  "background_screenshots",
  "periodic_screenshots",
  "continuous_camera_stream",
  "face_recognition",
  "identity_recognition",
  "emotion_recognition",
  "biometric_inference",
  "cloud_vision_default_enablement",
  "autonomous_visual_actions",
  "raw_image_frame_telemetry",
  "graph_driven_execution",
  "vision_triggered_device_project_runtime_mutation",
] as const;

export const VISION_MUTATION_AUTHORITY_CLASSES = [
  "tool_trigger",
  "device_action",
  "project_write",
  "memory_write",
  "approval",
  "runtime_execution",
  "graph_execution",
] as const;

export const VISION_TELEMETRY_ALLOWED_FIELDS = [
  "event_type",
  "session_id",
  "provider_id",
  "capability",
  "input_kind",
  "provider_kind",
  "decision",
  "reason",
  "redaction_status",
  "observation_count",
  "latency_ms",
  "timestamp_ms",
  "metadata_only",
  "advisory_only",
  "raw_payload_included",
  "cloud_called",
  "action_executed",
  "mutation_performed",
] as const;

export const VISION_TELEMETRY_FORBIDDEN_FIELDS = [
  "raw_frame",
  "frame",
  "raw_image",
  "image",
  "image_bytes",
  "screenshot",
  "pixels",
  "base64",
  "blob",
  "ocr_text",
  "raw_ocr_text",
  "recognized_text",
  "prompt",
  "response",
  "file_contents",
  "screen_content",
] as const;

export type Phase15DisabledFeature =
  (typeof PHASE_15_DISABLED_FEATURES)[number];
export type VisionMutationAuthorityClass =
  (typeof VISION_MUTATION_AUTHORITY_CLASSES)[number];

export type VisionPolicyDenialReason =
  | "screenshot_user_trigger_required"
  | "real_camera_disabled"
  | "mock_camera_dev_test_only"
  | "cloud_vision_disabled"
  | "background_capture_forbidden"
  | "periodic_capture_forbidden"
  | "continuous_video_forbidden"
  | "raw_frame_persistence_forbidden"
  | "raw_ocr_text_telemetry_forbidden"
  | "mutation_authority_forbidden";

export type VisionPolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: null;
      readonly metadata_only: true;
    }
  | {
      readonly allowed: false;
      readonly reason: VisionPolicyDenialReason;
      readonly metadata_only: true;
    };

export interface VisionPolicyEvaluationInput {
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly provider_kind: VisionProviderKind;
  readonly environment: VisionRuntimeEnvironment;
  readonly user_triggered: boolean;
  readonly capture_mode: VisionCaptureMode;
  readonly raw_frame_persistence_requested?: boolean;
  readonly raw_ocr_text_telemetry_requested?: boolean;
  readonly mutation_authority_requested?: readonly VisionMutationAuthorityClass[];
  readonly policy?: VisionRuntimePolicy;
}

export type VisionTelemetryValidationResult =
  | {
      readonly ok: true;
      readonly event: VisionTelemetryEvent;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly event: null;
      readonly reason:
        | "forbidden_telemetry_field"
        | "unknown_telemetry_field"
        | "invalid_telemetry_event";
      readonly field: string | null;
      readonly metadata_only: true;
    };

export const DEFAULT_VISION_RUNTIME_POLICY: VisionRuntimePolicy =
  VisionRuntimePolicySchema.parse({
    screenshot_ocr_enabled: true,
    screenshot_requires_user_trigger: true,
    mock_camera_enabled_in_dev_test: true,
    real_camera_enabled: false,
    cloud_vision_enabled: false,
    background_capture_enabled: false,
    periodic_capture_enabled: false,
    continuous_video_enabled: false,
    raw_frame_persistence_enabled: false,
    raw_ocr_text_telemetry_enabled: false,
    observations_advisory_only: true,
    observations_derived_only: true,
    tool_triggers_enabled: false,
    device_actions_enabled: false,
    project_writes_enabled: false,
    memory_writes_enabled: false,
    approvals_enabled: false,
    runtime_execution_enabled: false,
    graph_driven_execution_enabled: false,
    metadata_only: true,
  });

export const DEFAULT_PHASE_15_DISABLED_FEATURE_GUARD = Object.fromEntries(
  PHASE_15_DISABLED_FEATURES.map((feature) => [feature, false]),
) as Record<Phase15DisabledFeature, false>;

const DEV_TEST_ENVIRONMENTS = new Set<VisionRuntimeEnvironment>([
  "development",
  "test",
]);

const ALLOWED_TELEMETRY_FIELDS = new Set<string>(
  VISION_TELEMETRY_ALLOWED_FIELDS,
);

const FORBIDDEN_TELEMETRY_FIELDS = new Set<string>(
  VISION_TELEMETRY_FORBIDDEN_FIELDS,
);

export function evaluateVisionRuntimePolicy(
  input: VisionPolicyEvaluationInput,
): VisionPolicyDecision {
  const policy = VisionRuntimePolicySchema.parse(
    input.policy ?? DEFAULT_VISION_RUNTIME_POLICY,
  );
  const capability = VisionCapabilitySchema.parse(input.capability);
  const inputKind = VisionInputKindSchema.parse(input.input_kind);
  const providerKind = VisionProviderKindSchema.parse(input.provider_kind);
  const environment = VisionRuntimeEnvironmentSchema.parse(input.environment);
  const captureMode = VisionCaptureModeSchema.parse(input.capture_mode);

  if (captureMode === "background") return deny("background_capture_forbidden");
  if (captureMode === "periodic") return deny("periodic_capture_forbidden");
  if (captureMode === "continuous") return deny("continuous_video_forbidden");
  if (
    input.raw_frame_persistence_requested ||
    policy.raw_frame_persistence_enabled
  ) {
    return deny("raw_frame_persistence_forbidden");
  }
  if (
    input.raw_ocr_text_telemetry_requested ||
    policy.raw_ocr_text_telemetry_enabled
  ) {
    return deny("raw_ocr_text_telemetry_forbidden");
  }
  if ((input.mutation_authority_requested?.length ?? 0) > 0) {
    return deny("mutation_authority_forbidden");
  }
  if (
    capability === "cloud_vision" ||
    providerKind === "cloud_vision" ||
    policy.cloud_vision_enabled
  ) {
    return deny("cloud_vision_disabled");
  }
  if (
    capability === "real_camera" ||
    inputKind === "real_camera_frame" ||
    providerKind === "real_camera" ||
    policy.real_camera_enabled
  ) {
    return deny("real_camera_disabled");
  }
  if (
    capability === "mock_camera" ||
    inputKind === "mock_camera_frame" ||
    providerKind === "mock_camera"
  ) {
    return DEV_TEST_ENVIRONMENTS.has(environment)
      ? allow()
      : deny("mock_camera_dev_test_only");
  }
  if (
    capability === "screenshot_ocr" ||
    inputKind === "screenshot" ||
    providerKind === "screenshot_ocr_placeholder"
  ) {
    return input.user_triggered && policy.screenshot_requires_user_trigger
      ? allow()
      : deny("screenshot_user_trigger_required");
  }

  return allow();
}

export function sanitizeVisionTelemetryEvent(
  payload: Record<string, unknown>,
): VisionTelemetryValidationResult {
  for (const field of Object.keys(payload)) {
    if (FORBIDDEN_TELEMETRY_FIELDS.has(field)) {
      return rejectTelemetry("forbidden_telemetry_field", field);
    }
    if (!ALLOWED_TELEMETRY_FIELDS.has(field)) {
      return rejectTelemetry("unknown_telemetry_field", field);
    }
  }

  const parsed = VisionTelemetryEventSchema.safeParse(payload);
  if (!parsed.success) {
    return rejectTelemetry("invalid_telemetry_event", null);
  }

  return {
    ok: true,
    event: parsed.data,
    metadata_only: true,
  };
}

export function createVisionObservation(
  input: Omit<
    VisionObservation,
    | "metadata_only"
    | "advisory_only"
    | "derived"
    | "raw_payload_included"
    | "tool_trigger_requested"
    | "action_requested"
    | "mutation_requested"
  >,
): VisionObservation {
  return VisionObservationSchema.parse({
    ...input,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    tool_trigger_requested: false,
    action_requested: false,
    mutation_requested: false,
  });
}

export function canVisionRequestMutationAuthority(
  requested: readonly VisionMutationAuthorityClass[],
): VisionPolicyDecision {
  return requested.length === 0
    ? allow()
    : deny("mutation_authority_forbidden");
}

function allow(): VisionPolicyDecision {
  return {
    allowed: true,
    reason: null,
    metadata_only: true,
  };
}

function deny(reason: VisionPolicyDenialReason): VisionPolicyDecision {
  return {
    allowed: false,
    reason,
    metadata_only: true,
  };
}

function rejectTelemetry(
  reason: Exclude<VisionTelemetryValidationResult, { ok: true }>["reason"],
  field: string | null,
): VisionTelemetryValidationResult {
  return {
    ok: false,
    event: null,
    reason,
    field,
    metadata_only: true,
  };
}
