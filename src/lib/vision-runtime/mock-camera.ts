import { z } from "zod";

import {
  VisionRedactionStatusSchema,
  VisionRuntimeEnvironmentSchema,
  type VisionRuntimeEnvironment,
} from "./contracts";

export const VISION_CAMERA_INPUT_KINDS = [
  "camera.frame.mock",
  "camera.frame.real",
] as const;

export const VISION_CAMERA_TRIGGER_SOURCES = [
  "user",
  "assistant",
  "scheduler",
  "background",
  "periodic",
  "remote_network",
  "unknown",
] as const;

export const VISION_CAMERA_SAMPLING_MODES = [
  "single_frame",
  "periodic",
  "continuous",
] as const;

export const VISION_CAMERA_RETENTION_POLICIES = ["ephemeral_only"] as const;

export const VISION_CAMERA_REQUEST_STATUSES = ["accepted", "denied"] as const;

export const VISION_CAMERA_DENIAL_REASONS = [
  "missing_trigger_provenance",
  "ambiguous_trigger_provenance",
  "assistant_trigger_forbidden",
  "scheduler_trigger_forbidden",
  "background_trigger_forbidden",
  "periodic_trigger_forbidden",
  "remote_network_trigger_forbidden",
  "mock_camera_dev_test_only",
  "real_camera_disabled",
  "continuous_video_forbidden",
  "sampling_policy_exceeded",
  "hidden_capture_forbidden",
  "active_indicator_required",
  "raw_payload_forbidden",
  "mutation_authority_forbidden",
  "unknown_camera_input_kind",
] as const;

export const VISION_CAMERA_MAX_FRAMES_PER_REQUEST = 1;

const CameraIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const CameraTimestampSchema = z.number().int().nonnegative();

export const VisionCameraInputKindSchema = z.enum(VISION_CAMERA_INPUT_KINDS);
export const VisionCameraTriggerSourceSchema = z.enum(
  VISION_CAMERA_TRIGGER_SOURCES,
);
export const VisionCameraSamplingModeSchema = z.enum(
  VISION_CAMERA_SAMPLING_MODES,
);
export const VisionCameraRetentionPolicySchema = z.enum(
  VISION_CAMERA_RETENTION_POLICIES,
);
export const VisionCameraRequestStatusSchema = z.enum(
  VISION_CAMERA_REQUEST_STATUSES,
);
export const VisionCameraDenialReasonSchema = z.enum(
  VISION_CAMERA_DENIAL_REASONS,
);

export const VisionCameraTriggerMetadataSchema = z.strictObject({
  trigger_id: CameraIdSchema,
  source: VisionCameraTriggerSourceSchema,
  explicit_user_action: z.boolean(),
  surface: z.enum(["chat", "keyboard_shortcut", "command_palette", "test"]),
  initiated_at_ms: CameraTimestampSchema,
  metadata_only: z.literal(true),
});

export const VisionMockCameraFrameMetadataSchema = z.strictObject({
  frame_id: CameraIdSchema,
  mock_fixture_id: CameraIdSchema,
  width_band: z.enum(["small", "medium", "large", "unknown"]),
  height_band: z.enum(["small", "medium", "large", "unknown"]),
  redacted_source_id: z.literal("redacted"),
  source_id_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  metadata_only: z.literal(true),
});

export const VisionCameraActiveIndicatorRequirementSchema = z.strictObject({
  required: z.literal(true),
  visible: z.boolean(),
  indicator_id: CameraIdSchema,
  metadata_only: z.literal(true),
});

export const VisionCameraRequestSchema = z.strictObject({
  request_id: CameraIdSchema,
  input_kind: VisionCameraInputKindSchema,
  environment: VisionRuntimeEnvironmentSchema,
  trigger: VisionCameraTriggerMetadataSchema.nullable(),
  frame: VisionMockCameraFrameMetadataSchema.nullable(),
  sampling_mode: VisionCameraSamplingModeSchema,
  requested_frame_count: z.number().int().positive(),
  active_indicator: VisionCameraActiveIndicatorRequirementSchema.nullable(),
  retention_policy: VisionCameraRetentionPolicySchema.default("ephemeral_only"),
  redaction_status: VisionRedactionStatusSchema,
  mutation_authority_requested: z
    .array(
      z.enum([
        "tool_trigger",
        "device_action",
        "project_write",
        "memory_write",
        "approval",
        "runtime_execution",
        "graph_execution",
      ]),
    )
    .default([]),
  requested_at_ms: CameraTimestampSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  persisted: z.literal(false),
});

export const VisionCameraGateDecisionSchema = z.strictObject({
  request_id: CameraIdSchema.nullable(),
  status: VisionCameraRequestStatusSchema,
  reason: VisionCameraDenialReasonSchema.nullable(),
  input_kind: VisionCameraInputKindSchema.nullable(),
  environment: VisionRuntimeEnvironmentSchema.nullable(),
  trigger_source: VisionCameraTriggerSourceSchema.nullable(),
  sampling_mode: VisionCameraSamplingModeSchema.nullable(),
  requested_frame_count: z.number().int().nonnegative(),
  max_allowed_frame_count: z.number().int().positive(),
  provider_execution_allowed: z.boolean(),
  session_execution_allowed: z.boolean(),
  active_indicator_required: z.boolean(),
  active_indicator_visible: z.boolean(),
  retention_policy: VisionCameraRetentionPolicySchema,
  redaction_status: VisionRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  mutation_authority_granted: z.literal(false),
  runtime_executed: z.literal(false),
});

export type VisionCameraInputKind = (typeof VISION_CAMERA_INPUT_KINDS)[number];
export type VisionCameraTriggerSource =
  (typeof VISION_CAMERA_TRIGGER_SOURCES)[number];
export type VisionCameraSamplingMode =
  (typeof VISION_CAMERA_SAMPLING_MODES)[number];
export type VisionCameraRetentionPolicy =
  (typeof VISION_CAMERA_RETENTION_POLICIES)[number];
export type VisionCameraRequestStatus =
  (typeof VISION_CAMERA_REQUEST_STATUSES)[number];
export type VisionCameraDenialReason =
  (typeof VISION_CAMERA_DENIAL_REASONS)[number];
export type VisionCameraTriggerMetadata = z.infer<
  typeof VisionCameraTriggerMetadataSchema
>;
export type VisionMockCameraFrameMetadata = z.infer<
  typeof VisionMockCameraFrameMetadataSchema
>;
export type VisionCameraActiveIndicatorRequirement = z.infer<
  typeof VisionCameraActiveIndicatorRequirementSchema
>;
export type VisionCameraRequest = z.infer<typeof VisionCameraRequestSchema>;
export type VisionCameraGateDecision = z.infer<
  typeof VisionCameraGateDecisionSchema
>;

export function validateVisionCameraRequest(
  input: unknown,
): VisionCameraGateDecision {
  const unsafe = inspectCameraRequestPayload(input);
  if (!unsafe.ok) {
    return deny(null, "raw_payload_forbidden", {
      input_kind: null,
      environment: null,
      trigger_source: null,
      sampling_mode: null,
      requested_frame_count: 0,
      active_indicator_required: false,
      active_indicator_visible: false,
    });
  }

  if (isPlainRecord(input) && typeof input.input_kind === "string") {
    if (
      !VISION_CAMERA_INPUT_KINDS.includes(
        input.input_kind as VisionCameraInputKind,
      )
    ) {
      return deny(
        typeof input.request_id === "string" ? input.request_id : null,
        "unknown_camera_input_kind",
        {
          input_kind: null,
          environment: parseEnvironment(input.environment),
          trigger_source: null,
          sampling_mode: null,
          requested_frame_count: 0,
          active_indicator_required: false,
          active_indicator_visible: false,
        },
      );
    }
  }

  const parsed = VisionCameraRequestSchema.safeParse(input);
  if (!parsed.success) {
    return deny(null, "missing_trigger_provenance", {
      input_kind: null,
      environment: null,
      trigger_source: null,
      sampling_mode: null,
      requested_frame_count: 0,
      active_indicator_required: false,
      active_indicator_visible: false,
    });
  }

  const request = parsed.data;
  const context = {
    input_kind: request.input_kind,
    environment: request.environment,
    trigger_source: request.trigger?.source ?? null,
    sampling_mode: request.sampling_mode,
    requested_frame_count: request.requested_frame_count,
    active_indicator_required: request.active_indicator?.required ?? false,
    active_indicator_visible: request.active_indicator?.visible ?? false,
  } as const;

  if (!request.trigger) {
    return deny(request.request_id, "missing_trigger_provenance", context);
  }
  if (
    !request.trigger.explicit_user_action ||
    request.trigger.source === "unknown"
  ) {
    return deny(request.request_id, "ambiguous_trigger_provenance", context);
  }

  switch (request.trigger.source) {
    case "user":
      break;
    case "assistant":
      return deny(request.request_id, "assistant_trigger_forbidden", context);
    case "scheduler":
      return deny(request.request_id, "scheduler_trigger_forbidden", context);
    case "background":
      return deny(request.request_id, "background_trigger_forbidden", context);
    case "periodic":
      return deny(request.request_id, "periodic_trigger_forbidden", context);
    case "remote_network":
      return deny(
        request.request_id,
        "remote_network_trigger_forbidden",
        context,
      );
  }

  if (request.input_kind === "camera.frame.real") {
    return deny(request.request_id, "real_camera_disabled", context);
  }
  if (!["development", "test"].includes(request.environment)) {
    return deny(request.request_id, "mock_camera_dev_test_only", context);
  }
  if (request.sampling_mode === "continuous") {
    return deny(request.request_id, "continuous_video_forbidden", context);
  }
  if (
    request.sampling_mode === "periodic" ||
    request.requested_frame_count > VISION_CAMERA_MAX_FRAMES_PER_REQUEST
  ) {
    return deny(request.request_id, "sampling_policy_exceeded", context);
  }
  if (!request.active_indicator) {
    return deny(request.request_id, "active_indicator_required", context);
  }
  if (!request.active_indicator.visible) {
    return deny(request.request_id, "hidden_capture_forbidden", context);
  }
  if (request.mutation_authority_requested.length > 0) {
    return deny(request.request_id, "mutation_authority_forbidden", context);
  }

  return VisionCameraGateDecisionSchema.parse({
    request_id: request.request_id,
    status: "accepted",
    reason: null,
    input_kind: request.input_kind,
    environment: request.environment,
    trigger_source: request.trigger.source,
    sampling_mode: request.sampling_mode,
    requested_frame_count: request.requested_frame_count,
    max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
    provider_execution_allowed: true,
    session_execution_allowed: true,
    active_indicator_required: true,
    active_indicator_visible: true,
    retention_policy: "ephemeral_only",
    redaction_status: request.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    mutation_authority_granted: false,
    runtime_executed: false,
  });
}

function deny(
  requestId: string | null,
  reason: VisionCameraDenialReason,
  context: {
    readonly input_kind: VisionCameraInputKind | null;
    readonly environment: VisionRuntimeEnvironment | null;
    readonly trigger_source: VisionCameraTriggerSource | null;
    readonly sampling_mode: VisionCameraSamplingMode | null;
    readonly requested_frame_count: number;
    readonly active_indicator_required: boolean;
    readonly active_indicator_visible: boolean;
  },
): VisionCameraGateDecision {
  return VisionCameraGateDecisionSchema.parse({
    request_id: requestId,
    status: "denied",
    reason,
    input_kind: context.input_kind,
    environment: context.environment,
    trigger_source: context.trigger_source,
    sampling_mode: context.sampling_mode,
    requested_frame_count: context.requested_frame_count,
    max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
    provider_execution_allowed: false,
    session_execution_allowed: false,
    active_indicator_required: context.active_indicator_required,
    active_indicator_visible: context.active_indicator_visible,
    retention_policy: "ephemeral_only",
    redaction_status: "withheld",
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    mutation_authority_granted: false,
    runtime_executed: false,
  });
}

function inspectCameraRequestPayload(
  value: unknown,
  path: readonly string[] = [],
): { readonly ok: true } | { readonly ok: false; readonly field_path: string } {
  if (isBinaryPayload(value)) return { ok: false, field_path: path.join(".") };
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const inspected = inspectCameraRequestPayload(value[index], [
        ...path,
        String(index),
      ]);
      if (!inspected.ok) return inspected;
    }
    return { ok: true };
  }
  if (!isPlainRecord(value)) return { ok: true };

  for (const [key, nested] of Object.entries(value)) {
    if (isForbiddenCameraField(key)) {
      return { ok: false, field_path: [...path, key].join(".") };
    }
    if (typeof nested === "string" && /^data:/i.test(nested)) {
      return { ok: false, field_path: [...path, key].join(".") };
    }
    const inspected = inspectCameraRequestPayload(nested, [...path, key]);
    if (!inspected.ok) return inspected;
  }
  return { ok: true };
}

function isForbiddenCameraField(field: string): boolean {
  if (
    [
      "base64_included",
      "ocr_text_included",
      "persisted",
      "raw_frame_included",
      "raw_image_included",
      "raw_payload_included",
    ].includes(field)
  ) {
    return false;
  }
  return [
    /raw[_-]?frame/i,
    /raw[_-]?image/i,
    /frame[_-]?bytes/i,
    /image[_-]?bytes/i,
    /image[_-]?data/i,
    /base64/i,
    /ocr[_-]?text/i,
    /extracted[_-]?text/i,
    /buffer/i,
    /^bytes$/i,
  ].some((pattern) => pattern.test(field));
}

function isBinaryPayload(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function parseEnvironment(value: unknown): VisionRuntimeEnvironment | null {
  const parsed = VisionRuntimeEnvironmentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
