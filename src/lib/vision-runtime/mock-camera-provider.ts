import { z } from "zod";

import {
  VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  VisionCameraGateDecisionSchema,
  VisionCameraRequestSchema,
  validateVisionCameraRequest,
  type VisionCameraGateDecision,
  type VisionCameraRequest,
} from "./mock-camera";

export const MOCK_CAMERA_FRAME_PROVIDER_KINDS = [
  "deterministic_mock_camera",
] as const;

export const MOCK_CAMERA_STREAM_STATUSES = [
  "success",
  "gate_denied",
  "cancelled",
  "timeout",
  "no_signal",
] as const;

const MockCameraIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const MockCameraFrameProviderKindSchema = z.enum(
  MOCK_CAMERA_FRAME_PROVIDER_KINDS,
);
export const MockCameraStreamStatusSchema = z.enum(MOCK_CAMERA_STREAM_STATUSES);

export const MockCameraStreamCancellationSchema = z.strictObject({
  cancellation_id: MockCameraIdSchema,
  cancelled: z.boolean(),
  requested_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const MockCameraStreamOptionsSchema = z.strictObject({
  timeout_ms: z.number().int().nonnegative(),
  requested_at_ms: z.number().int().nonnegative(),
  simulated_latency_ms: z.number().int().nonnegative().optional(),
  cancellation: MockCameraStreamCancellationSchema.optional(),
  degraded: z.boolean().optional(),
  metadata_only: z.literal(true),
});

export const MockCameraFrameDescriptorSchema = z.strictObject({
  frame_id: MockCameraIdSchema,
  mock_fixture_id: MockCameraIdSchema,
  stream_id: MockCameraIdSchema,
  frame_index: z.number().int().nonnegative(),
  redacted_source_id: z.literal("redacted"),
  source_id_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  width_band: z.enum(["small", "medium", "large", "unknown"]),
  height_band: z.enum(["small", "medium", "large", "unknown"]),
  sampling_mode: z.literal("single_frame"),
  active_indicator_required: z.literal(true),
  active_indicator_visible: z.literal(true),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
});

export const MockCameraStreamResultSchema = z.strictObject({
  stream_id: MockCameraIdSchema,
  provider_id: MockCameraIdSchema,
  provider_kind: MockCameraFrameProviderKindSchema,
  request_id: MockCameraIdSchema.nullable(),
  status: MockCameraStreamStatusSchema,
  reason: z.string().trim().min(1).max(120).nullable(),
  frame_count: z.number().int().nonnegative(),
  max_allowed_frame_count: z.number().int().positive(),
  frames: z.array(MockCameraFrameDescriptorSchema),
  latency_ms: z.number().int().nonnegative().nullable(),
  degraded: z.boolean(),
  cancelled: z.boolean(),
  timed_out: z.boolean(),
  gate_decision: VisionCameraGateDecisionSchema,
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  persisted: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  runtime_executed: z.literal(false),
  mutation_authority_granted: z.literal(false),
});

export type MockCameraFrameProviderKind =
  (typeof MOCK_CAMERA_FRAME_PROVIDER_KINDS)[number];
export type MockCameraStreamStatus =
  (typeof MOCK_CAMERA_STREAM_STATUSES)[number];
export type MockCameraStreamCancellation = z.infer<
  typeof MockCameraStreamCancellationSchema
>;
export type MockCameraStreamOptions = z.infer<
  typeof MockCameraStreamOptionsSchema
>;
export type MockCameraFrameDescriptor = z.infer<
  typeof MockCameraFrameDescriptorSchema
>;
export type MockCameraStreamResult = z.infer<
  typeof MockCameraStreamResultSchema
>;

export interface MockCameraFrameProvider {
  readonly id: string;
  readonly kind: MockCameraFrameProviderKind;
  readonly metadata_only: true;
  stream(
    request: VisionCameraRequest,
    options: MockCameraStreamOptions,
  ): Promise<MockCameraStreamResult>;
}

export function createMockCameraFrameProvider(
  providerId = "deterministic-mock-camera",
): MockCameraFrameProvider {
  return {
    id: providerId,
    kind: "deterministic_mock_camera",
    metadata_only: true,
    async stream(requestInput, optionsInput) {
      const request = VisionCameraRequestSchema.parse(requestInput);
      const options = MockCameraStreamOptionsSchema.parse(optionsInput);
      return createDeterministicMockCameraStream({
        provider_id: providerId,
        request,
        options,
      });
    },
  };
}

export function createDeterministicMockCameraStream(input: {
  readonly provider_id?: string;
  readonly request: VisionCameraRequest;
  readonly options: MockCameraStreamOptions;
}): MockCameraStreamResult {
  const request = VisionCameraRequestSchema.parse(input.request);
  const options = MockCameraStreamOptionsSchema.parse(input.options);
  const gateDecision = validateVisionCameraRequest(request);
  const providerId = input.provider_id ?? "deterministic-mock-camera";
  const streamId = `${request.request_id}-stream`;

  if (gateDecision.status !== "accepted") {
    return streamResult({
      stream_id: streamId,
      provider_id: providerId,
      request_id: request.request_id,
      status: "gate_denied",
      reason: gateDecision.reason,
      frames: [],
      latency_ms: null,
      gate_decision: gateDecision,
    });
  }

  const latency = options.simulated_latency_ms ?? 1;
  if (options.cancellation?.cancelled) {
    return streamResult({
      stream_id: streamId,
      provider_id: providerId,
      request_id: request.request_id,
      status: "cancelled",
      reason: "cancelled",
      frames: [],
      latency_ms: latency,
      gate_decision: gateDecision,
    });
  }
  if (options.timeout_ms <= 0 || latency > options.timeout_ms) {
    return streamResult({
      stream_id: streamId,
      provider_id: providerId,
      request_id: request.request_id,
      status: "timeout",
      reason: "timeout",
      frames: [],
      latency_ms: latency,
      gate_decision: gateDecision,
    });
  }
  if (options.degraded) {
    return streamResult({
      stream_id: streamId,
      provider_id: providerId,
      request_id: request.request_id,
      status: "no_signal",
      reason: "no_signal",
      frames: [],
      latency_ms: latency,
      gate_decision: gateDecision,
      degraded: true,
    });
  }

  const frameCount = Math.min(
    request.requested_frame_count,
    VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
  );
  const frames = Array.from({ length: frameCount }, (_, index) =>
    MockCameraFrameDescriptorSchema.parse({
      frame_id: `${request.frame!.mock_fixture_id}.frame-${index}`,
      mock_fixture_id: request.frame!.mock_fixture_id,
      stream_id: streamId,
      frame_index: index,
      redacted_source_id: request.frame!.redacted_source_id,
      source_id_hash: request.frame!.source_id_hash,
      width_band: request.frame!.width_band,
      height_band: request.frame!.height_band,
      sampling_mode: "single_frame",
      active_indicator_required: true,
      active_indicator_visible: true,
      metadata_only: true,
      raw_payload_included: false,
      raw_image_included: false,
      raw_frame_included: false,
      base64_included: false,
      ocr_text_included: false,
      detection_labels_included: false,
    }),
  );

  return streamResult({
    stream_id: streamId,
    provider_id: providerId,
    request_id: request.request_id,
    status: "success",
    reason: null,
    frames,
    latency_ms: latency,
    gate_decision: gateDecision,
  });
}

function streamResult(input: {
  readonly stream_id: string;
  readonly provider_id: string;
  readonly request_id: string | null;
  readonly status: MockCameraStreamStatus;
  readonly reason: string | null;
  readonly frames: readonly MockCameraFrameDescriptor[];
  readonly latency_ms: number | null;
  readonly gate_decision: VisionCameraGateDecision;
  readonly degraded?: boolean;
}): MockCameraStreamResult {
  return MockCameraStreamResultSchema.parse({
    stream_id: input.stream_id,
    provider_id: input.provider_id,
    provider_kind: "deterministic_mock_camera",
    request_id: input.request_id,
    status: input.status,
    reason: input.reason,
    frame_count: input.frames.length,
    max_allowed_frame_count: VISION_CAMERA_MAX_FRAMES_PER_REQUEST,
    frames: input.frames,
    latency_ms: input.latency_ms,
    degraded: input.degraded ?? input.status !== "success",
    cancelled: input.status === "cancelled",
    timed_out: input.status === "timeout",
    gate_decision: input.gate_decision,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    persisted: false,
    cloud_called: false,
    network_called: false,
    runtime_executed: false,
    mutation_authority_granted: false,
  });
}
