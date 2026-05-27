import { z } from "zod";

export const VISION_SCREENSHOT_INPUT_KINDS = [
  "screenshot.full",
  "screenshot.region",
] as const;

export const VISION_SCREENSHOT_TRIGGER_SOURCES = [
  "user",
  "assistant",
  "scheduler",
  "background",
  "periodic",
  "voice_only",
  "remote_network",
  "unknown",
] as const;

export const VISION_SCREENSHOT_REQUEST_STATUSES = [
  "accepted",
  "denied",
] as const;

export const VISION_SCREENSHOT_DENIAL_REASONS = [
  "missing_trigger_provenance",
  "ambiguous_trigger_provenance",
  "assistant_trigger_forbidden",
  "scheduler_trigger_forbidden",
  "background_trigger_forbidden",
  "periodic_trigger_forbidden",
  "voice_only_trigger_forbidden",
  "remote_network_trigger_forbidden",
  "invalid_region_metadata",
] as const;

const ScreenshotIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const ScreenshotHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const ScreenshotTimestampSchema = z.number().int().nonnegative();

export const VisionScreenshotInputKindSchema = z.enum(
  VISION_SCREENSHOT_INPUT_KINDS,
);
export const VisionScreenshotTriggerSourceSchema = z.enum(
  VISION_SCREENSHOT_TRIGGER_SOURCES,
);
export const VisionScreenshotRequestStatusSchema = z.enum(
  VISION_SCREENSHOT_REQUEST_STATUSES,
);
export const VisionScreenshotDenialReasonSchema = z.enum(
  VISION_SCREENSHOT_DENIAL_REASONS,
);

export const VisionScreenshotUserTriggerMetadataSchema = z.strictObject({
  trigger_id: ScreenshotIdSchema,
  source: VisionScreenshotTriggerSourceSchema,
  explicit_user_action: z.boolean(),
  surface: z.enum(["chat", "keyboard_shortcut", "command_palette", "test"]),
  initiated_at_ms: ScreenshotTimestampSchema,
  metadata_only: z.literal(true),
});

export const VisionScreenshotRegionMetadataSchema = z.strictObject({
  region_id: ScreenshotIdSchema,
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
  coordinate_space: z.literal("redacted_screen_region"),
  exact_pixel_coordinates_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const VisionScreenshotSourceMetadataSchema = z.strictObject({
  redacted_source_id: z.literal("redacted"),
  source_id_hash: ScreenshotHashSchema,
  metadata_only: z.literal(true),
});

export const VisionScreenshotRequestSchema = z.strictObject({
  request_id: ScreenshotIdSchema,
  input_kind: VisionScreenshotInputKindSchema,
  trigger: VisionScreenshotUserTriggerMetadataSchema.nullable(),
  region: VisionScreenshotRegionMetadataSchema.nullable(),
  source: VisionScreenshotSourceMetadataSchema,
  requested_at_ms: ScreenshotTimestampSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  ocr_text_included: z.literal(false),
});

export const VisionScreenshotGateDecisionSchema = z.strictObject({
  request_id: ScreenshotIdSchema,
  status: VisionScreenshotRequestStatusSchema,
  reason: VisionScreenshotDenialReasonSchema.nullable(),
  requested_input_kind: VisionScreenshotInputKindSchema,
  effective_input_kind: VisionScreenshotInputKindSchema.nullable(),
  region_preferred: z.boolean(),
  trigger_source: VisionScreenshotTriggerSourceSchema.nullable(),
  provider_execution_allowed: z.boolean(),
  session_execution_allowed: z.boolean(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  ocr_text_included: z.literal(false),
});

export type VisionScreenshotInputKind =
  (typeof VISION_SCREENSHOT_INPUT_KINDS)[number];
export type VisionScreenshotTriggerSource =
  (typeof VISION_SCREENSHOT_TRIGGER_SOURCES)[number];
export type VisionScreenshotRequestStatus =
  (typeof VISION_SCREENSHOT_REQUEST_STATUSES)[number];
export type VisionScreenshotDenialReason =
  (typeof VISION_SCREENSHOT_DENIAL_REASONS)[number];
export type VisionScreenshotUserTriggerMetadata = z.infer<
  typeof VisionScreenshotUserTriggerMetadataSchema
>;
export type VisionScreenshotRegionMetadata = z.infer<
  typeof VisionScreenshotRegionMetadataSchema
>;
export type VisionScreenshotSourceMetadata = z.infer<
  typeof VisionScreenshotSourceMetadataSchema
>;
export type VisionScreenshotRequest = z.infer<
  typeof VisionScreenshotRequestSchema
>;
export type VisionScreenshotGateDecision = z.infer<
  typeof VisionScreenshotGateDecisionSchema
>;

export function validateVisionScreenshotRequest(
  input: VisionScreenshotRequest,
): VisionScreenshotGateDecision {
  const request = VisionScreenshotRequestSchema.parse(input);
  const trigger = request.trigger;

  if (!trigger) {
    return deny(request, "missing_trigger_provenance", null);
  }
  if (!trigger.explicit_user_action || trigger.source === "unknown") {
    return deny(request, "ambiguous_trigger_provenance", trigger.source);
  }

  switch (trigger.source) {
    case "user":
      break;
    case "assistant":
      return deny(request, "assistant_trigger_forbidden", trigger.source);
    case "scheduler":
      return deny(request, "scheduler_trigger_forbidden", trigger.source);
    case "background":
      return deny(request, "background_trigger_forbidden", trigger.source);
    case "periodic":
      return deny(request, "periodic_trigger_forbidden", trigger.source);
    case "voice_only":
      return deny(request, "voice_only_trigger_forbidden", trigger.source);
    case "remote_network":
      return deny(request, "remote_network_trigger_forbidden", trigger.source);
  }

  if (request.input_kind === "screenshot.region" && request.region === null) {
    return deny(request, "invalid_region_metadata", trigger.source);
  }

  const regionPreferred = request.region !== null;
  return VisionScreenshotGateDecisionSchema.parse({
    request_id: request.request_id,
    status: "accepted",
    reason: null,
    requested_input_kind: request.input_kind,
    effective_input_kind: regionPreferred
      ? "screenshot.region"
      : request.input_kind,
    region_preferred: regionPreferred,
    trigger_source: trigger.source,
    provider_execution_allowed: true,
    session_execution_allowed: true,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    ocr_text_included: false,
  });
}

function deny(
  request: VisionScreenshotRequest,
  reason: VisionScreenshotDenialReason,
  triggerSource: VisionScreenshotTriggerSource | null,
): VisionScreenshotGateDecision {
  return VisionScreenshotGateDecisionSchema.parse({
    request_id: request.request_id,
    status: "denied",
    reason,
    requested_input_kind: request.input_kind,
    effective_input_kind: null,
    region_preferred: false,
    trigger_source: triggerSource,
    provider_execution_allowed: false,
    session_execution_allowed: false,
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    ocr_text_included: false,
  });
}
