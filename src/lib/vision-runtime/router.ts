import { z } from "zod";

import {
  VisionCapabilitySchema,
  VisionInputKindSchema,
  VisionObservationSchema,
  VisionProviderResultSchema,
  VisionRedactionStatusSchema,
  VisionRuntimeEnvironmentSchema,
  type VisionCapability,
  type VisionInputKind,
  type VisionObservation,
  type VisionProviderResult,
} from "./contracts";
import { evaluateVisionRuntimePolicy } from "./policy";
import {
  VisionDetectionInputArtifactSchema,
  type VisionDetectionArtifactProviderRunRequest,
  type VisionDetectionInputArtifact,
} from "./detection-artifact";
import {
  DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
  runYoloDryRunProviderPath,
  type YoloDryRunProviderPathResult,
} from "./yolo-provider";
import { MockCameraStreamOptionsSchema } from "./mock-camera-provider";
import { VisionCameraRequestSchema } from "./mock-camera";
import {
  VisionOcrInputArtifactSchema,
  type VisionOcrArtifactProviderRunRequest,
  type VisionOcrInputArtifact,
} from "./ocr-artifact";
import {
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
} from "./redaction";
import { VisionScreenshotCaptureOptionsSchema } from "./screenshot-capture";
import { VisionScreenshotRequestSchema } from "./screenshot";
import {
  runFakeScreenshotOcrSession,
  type VisionScreenshotSessionResult,
} from "./screenshot-session";
import {
  runMockCameraObjectSession,
  type MockCameraSessionResult,
} from "./mock-camera-session";
import {
  DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
  runTesseractDryRunProviderPath,
  type TesseractDryRunProviderPathResult,
} from "./tesseract-provider";

// 23F (spec §23F): "real_local" appended additively; the fake and
// dry_run_disabled literals and their behavior are byte-untouched.
export const VISION_ROUTER_MODES = [
  "fake",
  "dry_run_disabled",
  "real_local",
] as const;

export const VISION_ROUTER_STATUSES = [
  "completed",
  "denied",
  "failed",
] as const;

export const VISION_ROUTER_REASONS = [
  "completed",
  "execution_disabled",
  "unsupported_route",
  "invalid_request",
  "source_denied",
  "source_failed",
  "sanitization_failed",
] as const;

const RouterIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionRouterModeSchema = z.enum(VISION_ROUTER_MODES);
export const VisionRouterStatusSchema = z.enum(VISION_ROUTER_STATUSES);
export const VisionRouterReasonSchema = z.enum(VISION_ROUTER_REASONS);

const RouterCommonRequestSchema = z.strictObject({
  request_id: RouterIdSchema,
  capability: VisionCapabilitySchema,
  input_kind: VisionInputKindSchema,
  mode: VisionRouterModeSchema,
  requested_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const VisionScreenshotOcrRouterRequestSchema =
  RouterCommonRequestSchema.extend({
    capability: z.literal("screenshot_ocr"),
    input_kind: z.literal("screenshot"),
    mode: z.literal("fake"),
    screenshot_request: VisionScreenshotRequestSchema,
    capture_options: VisionScreenshotCaptureOptionsSchema,
    provider_timeout_ms: z.number().int().positive().optional(),
    provider_simulated_latency_ms: z.number().int().nonnegative().optional(),
    provider_cancelled: z.boolean().optional(),
  });

export const VisionMockCameraObjectRouterRequestSchema =
  RouterCommonRequestSchema.extend({
    capability: z.literal("object_detection"),
    input_kind: z.literal("mock_camera_frame"),
    mode: z.literal("fake"),
    camera_request: VisionCameraRequestSchema,
    stream_options: MockCameraStreamOptionsSchema,
    provider_timeout_ms: z.number().int().positive().optional(),
    provider_simulated_latency_ms: z.number().int().nonnegative().optional(),
    provider_cancelled: z.boolean().optional(),
  });

export const VisionOcrArtifactRouterRequestSchema =
  RouterCommonRequestSchema.extend({
    capability: z.literal("screenshot_ocr"),
    input_kind: z.literal("screenshot"),
    mode: z.literal("dry_run_disabled"),
    ocr_artifact: VisionOcrInputArtifactSchema,
    provider_timeout_ms: z.number().int().positive().optional(),
  });

export const VisionDetectionArtifactRouterRequestSchema =
  RouterCommonRequestSchema.extend({
    capability: z.literal("object_detection"),
    input_kind: z.literal("mock_camera_frame"),
    mode: z.literal("dry_run_disabled"),
    detection_artifact: VisionDetectionInputArtifactSchema,
    provider_timeout_ms: z.number().int().positive().optional(),
  });

// 23F: real_local admission request — the router is the governance gate; the
// actual capture runs in src/lib/video-extraction/camera.ts. Structural
// requirements: user-initiated, single-shot, consent verdict injected by the
// caller (the consent loader runs there; the router stays IO-free).
export const VisionRealLocalCameraRouterRequestSchema =
  RouterCommonRequestSchema.extend({
    capability: z.literal("real_camera"),
    input_kind: z.literal("real_camera_frame"),
    mode: z.literal("real_local"),
    user_triggered: z.literal(true),
    capture_mode: z.literal("single"),
    environment: VisionRuntimeEnvironmentSchema,
    camera_capture_consent_granted: z.boolean(),
  });

export const VisionRouterRequestSchema = z.union([
  VisionScreenshotOcrRouterRequestSchema,
  VisionMockCameraObjectRouterRequestSchema,
  VisionOcrArtifactRouterRequestSchema,
  VisionDetectionArtifactRouterRequestSchema,
  VisionRealLocalCameraRouterRequestSchema,
]);

export const VisionRouterResultSchema = z.strictObject({
  request_id: RouterIdSchema,
  capability: VisionCapabilitySchema,
  input_kind: VisionInputKindSchema,
  mode: VisionRouterModeSchema,
  status: VisionRouterStatusSchema,
  reason: VisionRouterReasonSchema,
  redaction_status: VisionRedactionStatusSchema,
  observation_count: z.number().int().nonnegative(),
  provider_result: VisionProviderResultSchema.nullable(),
  observations: z.array(VisionObservationSchema),
  events: z.array(z.unknown()),
  invocation_result: z.unknown().nullable(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  detection_labels_included: z.literal(false),
  detection_results_included: z.literal(false),
  persisted: z.literal(false),
  cloud_called: z.literal(false),
  network_called: z.literal(false),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
  mutation_authority_granted: z.literal(false),
});

export type VisionRouterMode = (typeof VISION_ROUTER_MODES)[number];
export type VisionRouterStatus = (typeof VISION_ROUTER_STATUSES)[number];
export type VisionRouterReason = (typeof VISION_ROUTER_REASONS)[number];
export type VisionScreenshotOcrRouterRequest = z.infer<
  typeof VisionScreenshotOcrRouterRequestSchema
>;
export type VisionMockCameraObjectRouterRequest = z.infer<
  typeof VisionMockCameraObjectRouterRequestSchema
>;
export type VisionOcrArtifactRouterRequest = z.infer<
  typeof VisionOcrArtifactRouterRequestSchema
>;
export type VisionDetectionArtifactRouterRequest = z.infer<
  typeof VisionDetectionArtifactRouterRequestSchema
>;
export type VisionRouterRequest = z.infer<typeof VisionRouterRequestSchema>;
export type VisionRouterResult = z.infer<typeof VisionRouterResultSchema>;

export async function runVisionCapabilityRouter(
  input: unknown,
): Promise<VisionRouterResult> {
  const parsed = VisionRouterRequestSchema.safeParse(input);
  if (!parsed.success) {
    return routerResult({
      request_id: safeRequestId(input),
      capability: safeCapability(input),
      input_kind: safeInputKind(input),
      mode: safeMode(input),
      status: "denied",
      reason: "unsupported_route",
      provider_result: null,
      observations: [],
      events: [],
      invocation_result: null,
    });
  }

  const request = parsed.data;
  const fallbackRequest: VisionRouterRequest = parsed.data;
  if (
    request.capability === "screenshot_ocr" &&
    request.input_kind === "screenshot" &&
    request.mode === "fake" &&
    "screenshot_request" in request
  ) {
    return routeScreenshotOcr(request);
  }
  if (
    request.capability === "object_detection" &&
    request.input_kind === "mock_camera_frame" &&
    request.mode === "fake" &&
    "camera_request" in request
  ) {
    return routeMockCameraObjectSession(request);
  }
  if (
    request.capability === "screenshot_ocr" &&
    request.input_kind === "screenshot" &&
    request.mode === "dry_run_disabled" &&
    "ocr_artifact" in request
  ) {
    return routeTesseractDryRun(request);
  }
  if (
    request.capability === "object_detection" &&
    request.input_kind === "mock_camera_frame" &&
    request.mode === "dry_run_disabled" &&
    "detection_artifact" in request
  ) {
    return routeYoloDryRun(request);
  }
  if (
    request.capability === "real_camera" &&
    request.input_kind === "real_camera_frame" &&
    request.mode === "real_local" &&
    "camera_capture_consent_granted" in request
  ) {
    // 23F admission verdict only — no capture happens here. Denial reuses
    // the existing reason literals (no new telemetry or reason values).
    const decision = evaluateVisionRuntimePolicy({
      capability: request.capability,
      input_kind: request.input_kind,
      provider_kind: "real_camera",
      environment: request.environment,
      user_triggered: request.user_triggered,
      capture_mode: request.capture_mode,
      camera_capture_consent_granted: request.camera_capture_consent_granted,
    });
    return routerResult({
      request_id: request.request_id,
      capability: request.capability,
      input_kind: request.input_kind,
      mode: request.mode,
      status: decision.allowed ? "completed" : "denied",
      reason: decision.allowed ? "completed" : "source_denied",
      provider_result: null,
      observations: [],
      events: [],
      invocation_result: null,
    });
  }

  return routerResult({
    request_id: fallbackRequest.request_id,
    capability: fallbackRequest.capability,
    input_kind: fallbackRequest.input_kind,
    mode: fallbackRequest.mode,
    status: "denied",
    reason: "unsupported_route",
    provider_result: null,
    observations: [],
    events: [],
    invocation_result: null,
  });
}

async function routeScreenshotOcr(
  request: VisionScreenshotOcrRouterRequest,
): Promise<VisionRouterResult> {
  const result = await runFakeScreenshotOcrSession({
    request: request.screenshot_request,
    capture_options: request.capture_options,
    provider_timeout_ms: request.provider_timeout_ms,
    provider_simulated_latency_ms: request.provider_simulated_latency_ms,
    provider_cancelled: request.provider_cancelled,
    metadata_only: true,
  });

  return routerResultFromSession({
    request_id: request.request_id,
    capability: request.capability,
    input_kind: request.input_kind,
    mode: request.mode,
    result,
    invocation_result: null,
  });
}

async function routeMockCameraObjectSession(
  request: VisionMockCameraObjectRouterRequest,
): Promise<VisionRouterResult> {
  const result = await runMockCameraObjectSession({
    request: request.camera_request,
    stream_options: request.stream_options,
    provider_timeout_ms: request.provider_timeout_ms,
    provider_simulated_latency_ms: request.provider_simulated_latency_ms,
    provider_cancelled: request.provider_cancelled,
    metadata_only: true,
  });

  return routerResultFromSession({
    request_id: request.request_id,
    capability: request.capability,
    input_kind: request.input_kind,
    mode: request.mode,
    result,
    invocation_result: null,
  });
}

function routeTesseractDryRun(
  request: VisionOcrArtifactRouterRequest,
): VisionRouterResult {
  const providerResult = runTesseractDryRunProviderPath({
    config: {
      ...DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
      enabled: true,
    },
    request: ocrProviderRequest({
      request_id: request.request_id,
      artifact: request.ocr_artifact,
      timeout_ms: request.provider_timeout_ms ?? 5_000,
      requested_at_ms: request.requested_at_ms,
    }),
    metadata_only: true,
  });

  return routerResultFromDryRun({
    request_id: request.request_id,
    capability: request.capability,
    input_kind: request.input_kind,
    mode: request.mode,
    result: providerResult,
  });
}

function routeYoloDryRun(
  request: VisionDetectionArtifactRouterRequest,
): VisionRouterResult {
  const providerResult = runYoloDryRunProviderPath({
    config: {
      ...DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
      enabled: true,
    },
    request: detectionProviderRequest({
      request_id: request.request_id,
      artifact: request.detection_artifact,
      timeout_ms: request.provider_timeout_ms ?? 5_000,
      requested_at_ms: request.requested_at_ms,
    }),
    metadata_only: true,
  });

  return routerResultFromDryRun({
    request_id: request.request_id,
    capability: request.capability,
    input_kind: request.input_kind,
    mode: request.mode,
    result: providerResult,
  });
}

function routerResultFromSession(input: {
  readonly request_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly mode: VisionRouterMode;
  readonly result: VisionScreenshotSessionResult | MockCameraSessionResult;
  readonly invocation_result: null;
}): VisionRouterResult {
  return routerResult({
    request_id: input.request_id,
    capability: input.capability,
    input_kind: input.input_kind,
    mode: input.mode,
    status: mapSessionStatus(input.result.status),
    reason: mapSessionReason(input.result.status),
    provider_result: input.result.provider_result,
    observations: input.result.observations,
    events: input.result.events,
    invocation_result: input.invocation_result,
  });
}

function routerResultFromDryRun(input: {
  readonly request_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly mode: VisionRouterMode;
  readonly result:
    | TesseractDryRunProviderPathResult
    | YoloDryRunProviderPathResult;
}): VisionRouterResult {
  return routerResult({
    request_id: input.request_id,
    capability: input.capability,
    input_kind: input.input_kind,
    mode: input.mode,
    status:
      input.result.provider_result.status === "execution_disabled"
        ? "completed"
        : "denied",
    reason:
      input.result.provider_result.status === "execution_disabled"
        ? "execution_disabled"
        : "source_denied",
    provider_result: input.result.provider_result,
    observations: input.result.observations,
    events: [],
    invocation_result: input.result.invocation_result,
  });
}

function routerResult(input: {
  readonly request_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly mode: VisionRouterMode;
  readonly status: VisionRouterStatus;
  readonly reason: VisionRouterReason;
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly events: readonly unknown[];
  readonly invocation_result: unknown | null;
}): VisionRouterResult {
  const observations = input.observations.map((observation) => {
    const sanitized = sanitizeVisionObservation(observation);
    if (!sanitized.ok) throw new Error("Unsafe router observation.");
    return sanitized.value;
  });
  const providerResult = input.provider_result
    ? sanitizeProviderResult(input.provider_result)
    : null;

  const candidate = VisionRouterResultSchema.parse({
    request_id: input.request_id,
    capability: input.capability,
    input_kind: input.input_kind,
    mode: input.mode,
    status: input.status,
    reason: input.reason,
    redaction_status: "metadata_only",
    observation_count: observations.length,
    provider_result: providerResult,
    observations,
    events: input.events,
    invocation_result: input.invocation_result,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    detection_labels_included: false,
    detection_results_included: false,
    persisted: false,
    cloud_called: false,
    network_called: false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
    mutation_authority_granted: false,
  });
  const sanitized = sanitizeVisionMetadataPayload(candidate);
  if (!sanitized.ok) {
    if (input.reason === "sanitization_failed") return candidate;
    return routerResult({
      request_id: input.request_id,
      capability: input.capability,
      input_kind: input.input_kind,
      mode: input.mode,
      status: "failed",
      reason: "sanitization_failed",
      provider_result: null,
      observations: [],
      events: [],
      invocation_result: null,
    });
  }

  return candidate;
}

function sanitizeProviderResult(
  providerResult: VisionProviderResult,
): VisionProviderResult {
  const sanitized = sanitizeVisionProviderResult(providerResult);
  if (!sanitized.ok) throw new Error("Unsafe router provider result.");
  return sanitized.value;
}

function ocrProviderRequest(input: {
  readonly request_id: string;
  readonly artifact: VisionOcrInputArtifact;
  readonly timeout_ms: number;
  readonly requested_at_ms: number;
}): VisionOcrArtifactProviderRunRequest {
  return {
    request_id: `${input.request_id}-tesseract`,
    session_id: `${input.request_id}-tesseract-session`,
    capability: "screenshot_ocr",
    input_kind: "screenshot",
    user_triggered: true,
    timeout_ms: input.timeout_ms,
    requested_at_ms: input.requested_at_ms,
    environment: "test",
    metadata_only: true,
    ocr_artifact: input.artifact,
  };
}

function detectionProviderRequest(input: {
  readonly request_id: string;
  readonly artifact: VisionDetectionInputArtifact;
  readonly timeout_ms: number;
  readonly requested_at_ms: number;
}): VisionDetectionArtifactProviderRunRequest {
  return {
    request_id: `${input.request_id}-yolo`,
    session_id: `${input.request_id}-yolo-session`,
    capability: "object_detection",
    input_kind: "mock_camera_frame",
    user_triggered: true,
    timeout_ms: input.timeout_ms,
    requested_at_ms: input.requested_at_ms,
    environment: "test",
    metadata_only: true,
    detection_artifact: input.artifact,
  };
}

function mapSessionStatus(
  status:
    | VisionScreenshotSessionResult["status"]
    | MockCameraSessionResult["status"],
): VisionRouterStatus {
  if (status === "completed") return "completed";
  if (status === "denied") return "denied";
  return "failed";
}

function mapSessionReason(
  status:
    | VisionScreenshotSessionResult["status"]
    | MockCameraSessionResult["status"],
): VisionRouterReason {
  if (status === "completed") return "completed";
  if (status === "denied") return "source_denied";
  return "source_failed";
}

function safeRequestId(input: unknown): string {
  const value = isPlainRecord(input) ? input.request_id : null;
  const parsed = RouterIdSchema.safeParse(value);
  return parsed.success ? parsed.data : "vision-router-request";
}

function safeCapability(input: unknown): VisionCapability {
  const value = isPlainRecord(input) ? input.capability : null;
  const parsed = VisionCapabilitySchema.safeParse(value);
  return parsed.success ? parsed.data : "screenshot_ocr";
}

function safeInputKind(input: unknown): VisionInputKind {
  const value = isPlainRecord(input) ? input.input_kind : null;
  const parsed = VisionInputKindSchema.safeParse(value);
  return parsed.success ? parsed.data : "screenshot";
}

function safeMode(input: unknown): VisionRouterMode {
  const value = isPlainRecord(input) ? input.mode : null;
  const parsed = VisionRouterModeSchema.safeParse(value);
  return parsed.success ? parsed.data : "fake";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
