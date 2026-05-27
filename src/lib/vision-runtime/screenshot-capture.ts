import { z } from "zod";
import {
  VISION_SCREENSHOT_INPUT_KINDS,
  VisionScreenshotInputKindSchema,
  VisionScreenshotRequestSchema,
  validateVisionScreenshotRequest,
  type VisionScreenshotGateDecision,
  type VisionScreenshotInputKind,
  type VisionScreenshotRequest,
} from "./screenshot";

export const VISION_SCREENSHOT_CAPTURE_ADAPTER_KINDS = [
  "fake_screenshot_capture",
] as const;

export const VISION_SCREENSHOT_CAPTURE_STATUSES = [
  "success",
  "gate_denied",
  "cancelled",
  "timeout",
  "permission_denied",
  "unsupported_region",
  "capture_unavailable",
] as const;

export const VISION_SCREENSHOT_CAPTURE_FAILURE_REASONS = [
  "gate_denied",
  "cancelled",
  "timeout",
  "permission_denied",
  "unsupported_region",
  "capture_unavailable",
] as const;

export const VISION_SCREENSHOT_DIMENSION_BANDS = [
  "none",
  "small",
  "medium",
  "large",
] as const;

const CaptureIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionScreenshotCaptureAdapterKindSchema = z.enum(
  VISION_SCREENSHOT_CAPTURE_ADAPTER_KINDS,
);
export const VisionScreenshotCaptureStatusSchema = z.enum(
  VISION_SCREENSHOT_CAPTURE_STATUSES,
);
export const VisionScreenshotCaptureFailureReasonSchema = z.enum(
  VISION_SCREENSHOT_CAPTURE_FAILURE_REASONS,
);
export const VisionScreenshotDimensionBandSchema = z.enum(
  VISION_SCREENSHOT_DIMENSION_BANDS,
);

export const VisionScreenshotCaptureCancellationSchema = z.strictObject({
  cancellation_id: CaptureIdSchema,
  cancelled: z.boolean(),
  requested_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const VisionScreenshotCaptureOptionsSchema = z.strictObject({
  timeout_ms: z.number().int().nonnegative(),
  requested_at_ms: z.number().int().nonnegative(),
  simulated_latency_ms: z.number().int().nonnegative().optional(),
  cancellation: VisionScreenshotCaptureCancellationSchema.optional(),
  failure_mode: VisionScreenshotCaptureFailureReasonSchema.optional(),
  metadata_only: z.literal(true),
});

export const VisionScreenshotCaptureResultSchema = z.strictObject({
  capture_id: CaptureIdSchema,
  request_id: CaptureIdSchema,
  adapter_id: CaptureIdSchema,
  adapter_kind: VisionScreenshotCaptureAdapterKindSchema,
  capture_status: VisionScreenshotCaptureStatusSchema,
  reason: VisionScreenshotCaptureFailureReasonSchema.nullable(),
  requested_input_kind: VisionScreenshotInputKindSchema,
  effective_input_kind: VisionScreenshotInputKindSchema.nullable(),
  region_preferred: z.boolean(),
  redacted_source_id: z.literal("redacted"),
  source_id_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  width_band: VisionScreenshotDimensionBandSchema,
  height_band: VisionScreenshotDimensionBandSchema,
  latency_ms: z.number().int().nonnegative().nullable(),
  degraded: z.boolean(),
  cancelled: z.boolean(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  persisted: z.literal(false),
  provider_executed: z.literal(false),
  runtime_executed: z.literal(false),
  fake_capture_executed: z.boolean(),
});

export type VisionScreenshotCaptureAdapterKind =
  (typeof VISION_SCREENSHOT_CAPTURE_ADAPTER_KINDS)[number];
export type VisionScreenshotCaptureStatus =
  (typeof VISION_SCREENSHOT_CAPTURE_STATUSES)[number];
export type VisionScreenshotCaptureFailureReason =
  (typeof VISION_SCREENSHOT_CAPTURE_FAILURE_REASONS)[number];
export type VisionScreenshotDimensionBand =
  (typeof VISION_SCREENSHOT_DIMENSION_BANDS)[number];
export type VisionScreenshotCaptureCancellation = z.infer<
  typeof VisionScreenshotCaptureCancellationSchema
>;
export type VisionScreenshotCaptureOptions = z.infer<
  typeof VisionScreenshotCaptureOptionsSchema
>;
export type VisionScreenshotCaptureResult = z.infer<
  typeof VisionScreenshotCaptureResultSchema
>;

export interface VisionScreenshotCaptureAdapter {
  readonly id: string;
  readonly kind: VisionScreenshotCaptureAdapterKind;
  readonly supported_input_kinds: readonly VisionScreenshotInputKind[];
  readonly metadata_only: true;
  capture(
    request: VisionScreenshotRequest,
    options: VisionScreenshotCaptureOptions,
  ): Promise<VisionScreenshotCaptureResult>;
}

export function createFakeScreenshotCaptureAdapter(
  adapterId = "fake-screenshot-capture",
): VisionScreenshotCaptureAdapter {
  return {
    id: adapterId,
    kind: "fake_screenshot_capture",
    supported_input_kinds: [...VISION_SCREENSHOT_INPUT_KINDS],
    metadata_only: true,
    async capture(
      requestInput: VisionScreenshotRequest,
      optionsInput: VisionScreenshotCaptureOptions,
    ): Promise<VisionScreenshotCaptureResult> {
      const request = VisionScreenshotRequestSchema.parse(requestInput);
      const options = VisionScreenshotCaptureOptionsSchema.parse(optionsInput);
      const gateDecision = validateVisionScreenshotRequest(request);

      if (gateDecision.status !== "accepted") {
        return createCaptureResult({
          adapter_id: adapterId,
          request,
          gate_decision: gateDecision,
          status: "gate_denied",
          reason: "gate_denied",
          latency_ms: null,
          fake_capture_executed: false,
        });
      }

      const latency = options.simulated_latency_ms ?? 1;
      if (options.cancellation?.cancelled) {
        return createCaptureResult({
          adapter_id: adapterId,
          request,
          gate_decision: gateDecision,
          status: "cancelled",
          reason: "cancelled",
          latency_ms: latency,
          fake_capture_executed: false,
        });
      }
      if (options.timeout_ms <= 0 || latency > options.timeout_ms) {
        return createCaptureResult({
          adapter_id: adapterId,
          request,
          gate_decision: gateDecision,
          status: "timeout",
          reason: "timeout",
          latency_ms: latency,
          fake_capture_executed: false,
        });
      }
      if (options.failure_mode) {
        return createCaptureResult({
          adapter_id: adapterId,
          request,
          gate_decision: gateDecision,
          status: options.failure_mode,
          reason: options.failure_mode,
          latency_ms: latency,
          fake_capture_executed: false,
        });
      }

      return createCaptureResult({
        adapter_id: adapterId,
        request,
        gate_decision: gateDecision,
        status: "success",
        reason: null,
        latency_ms: latency,
        fake_capture_executed: true,
      });
    },
  };
}

export function createFakeScreenshotCaptureAdapterFactory(): {
  readonly create: () => VisionScreenshotCaptureAdapter;
  readonly metadata_only: true;
} {
  return {
    create: () => createFakeScreenshotCaptureAdapter(),
    metadata_only: true,
  };
}

function createCaptureResult(input: {
  readonly adapter_id: string;
  readonly request: VisionScreenshotRequest;
  readonly gate_decision: VisionScreenshotGateDecision;
  readonly status: VisionScreenshotCaptureStatus;
  readonly reason: VisionScreenshotCaptureFailureReason | null;
  readonly latency_ms: number | null;
  readonly fake_capture_executed: boolean;
}): VisionScreenshotCaptureResult {
  return VisionScreenshotCaptureResultSchema.parse({
    capture_id: `${input.request.request_id}-capture`,
    request_id: input.request.request_id,
    adapter_id: input.adapter_id,
    adapter_kind: "fake_screenshot_capture",
    capture_status: input.status,
    reason: input.reason,
    requested_input_kind: input.request.input_kind,
    effective_input_kind: input.gate_decision.effective_input_kind,
    region_preferred: input.gate_decision.region_preferred,
    redacted_source_id: input.request.source.redacted_source_id,
    source_id_hash: input.request.source.source_id_hash,
    width_band: dimensionBand(input.request.region?.width_px ?? null),
    height_band: dimensionBand(input.request.region?.height_px ?? null),
    latency_ms: input.latency_ms,
    degraded: input.status !== "success",
    cancelled: input.status === "cancelled",
    metadata_only: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    persisted: false,
    provider_executed: false,
    runtime_executed: false,
    fake_capture_executed: input.fake_capture_executed,
  });
}

function dimensionBand(value: number | null): VisionScreenshotDimensionBand {
  if (value === null) return "none";
  if (value <= 512) return "small";
  if (value <= 1440) return "medium";
  return "large";
}
