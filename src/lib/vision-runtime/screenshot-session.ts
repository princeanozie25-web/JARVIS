import { z } from "zod";
import {
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
  sanitizeVisionSessionLifecycleEvent,
} from "./redaction";
import {
  createFakeScreenshotCaptureAdapter,
  VisionScreenshotCaptureOptionsSchema,
  VisionScreenshotCaptureResultSchema,
  type VisionScreenshotCaptureAdapter,
  type VisionScreenshotCaptureOptions,
  type VisionScreenshotCaptureResult,
} from "./screenshot-capture";
import {
  validateVisionScreenshotRequest,
  VisionScreenshotRequestSchema,
  type VisionScreenshotRequest,
} from "./screenshot";
import {
  VisionSessionRunner,
  type VisionSessionLifecycleEvent,
} from "./session";
import type { VisionObservation, VisionProviderResult } from "./contracts";

export const VISION_SCREENSHOT_SESSION_STATUSES = [
  "completed",
  "denied",
  "capture_failed",
  "provider_failed",
  "cancelled",
  "timeout",
  "sanitized",
] as const;

export const VISION_SCREENSHOT_SESSION_EVENT_TYPES = [
  "screenshot_session_started",
  "screenshot_gate_denied",
  "screenshot_gate_accepted",
  "fake_capture_completed",
  "fake_capture_failed",
  "fake_ocr_completed",
  "fake_ocr_failed",
  "screenshot_session_completed",
  "screenshot_session_cancelled",
  "screenshot_session_timeout",
  "screenshot_session_sanitized",
] as const;

const ScreenshotSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionScreenshotSessionStatusSchema = z.enum(
  VISION_SCREENSHOT_SESSION_STATUSES,
);
export const VisionScreenshotSessionEventTypeSchema = z.enum(
  VISION_SCREENSHOT_SESSION_EVENT_TYPES,
);

export const VisionScreenshotSessionLifecycleEventSchema = z.strictObject({
  event_id: ScreenshotSessionIdSchema,
  event_type: VisionScreenshotSessionEventTypeSchema,
  request_id: ScreenshotSessionIdSchema,
  status: VisionScreenshotSessionStatusSchema,
  reason: z.string().trim().min(1).max(120).nullable(),
  capture_status: z.string().trim().min(1).max(120).nullable(),
  result_status: z.string().trim().min(1).max(120).nullable(),
  observation_count: z.number().int().nonnegative(),
  timestamp_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  provider_executed: z.boolean(),
  fake_capture_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export const VisionScreenshotSessionResultSchema = z.strictObject({
  request_id: ScreenshotSessionIdSchema,
  status: VisionScreenshotSessionStatusSchema,
  reason: z.string().trim().min(1).max(120).nullable(),
  capture_result: VisionScreenshotCaptureResultSchema.nullable(),
  provider_result: z.unknown().nullable(),
  observation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_image_included: z.literal(false),
  raw_frame_included: z.literal(false),
  base64_included: z.literal(false),
  ocr_text_included: z.literal(false),
  persisted: z.literal(false),
  provider_executed: z.boolean(),
  fake_capture_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export type VisionScreenshotSessionStatus =
  (typeof VISION_SCREENSHOT_SESSION_STATUSES)[number];
export type VisionScreenshotSessionEventType =
  (typeof VISION_SCREENSHOT_SESSION_EVENT_TYPES)[number];
export type VisionScreenshotSessionLifecycleEvent = z.infer<
  typeof VisionScreenshotSessionLifecycleEventSchema
>;
export type VisionScreenshotSessionResult = z.infer<
  typeof VisionScreenshotSessionResultSchema
> & {
  readonly capture_result: VisionScreenshotCaptureResult | null;
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly events: readonly (
    | VisionScreenshotSessionLifecycleEvent
    | VisionSessionLifecycleEvent
  )[];
};

export interface FakeScreenshotOcrSessionInput {
  readonly request: VisionScreenshotRequest;
  readonly capture_options: VisionScreenshotCaptureOptions;
  readonly provider_timeout_ms?: number;
  readonly provider_simulated_latency_ms?: number;
  readonly provider_cancelled?: boolean;
  readonly metadata_only: true;
}

export interface ScreenshotSessionRunnerOptions {
  readonly capture_adapter?: VisionScreenshotCaptureAdapter;
  readonly vision_session_runner?: VisionSessionRunner;
}

export class ScreenshotSessionRunner {
  private readonly captureAdapter: VisionScreenshotCaptureAdapter;
  private readonly visionSessionRunner: VisionSessionRunner;

  constructor(options: ScreenshotSessionRunnerOptions = {}) {
    this.captureAdapter =
      options.capture_adapter ?? createFakeScreenshotCaptureAdapter();
    this.visionSessionRunner =
      options.vision_session_runner ?? new VisionSessionRunner();
  }

  async run(
    input: FakeScreenshotOcrSessionInput,
  ): Promise<VisionScreenshotSessionResult> {
    const request = VisionScreenshotRequestSchema.parse(input.request);
    const captureOptions = VisionScreenshotCaptureOptionsSchema.parse(
      input.capture_options,
    );
    const events: (
      | VisionScreenshotSessionLifecycleEvent
      | VisionSessionLifecycleEvent
    )[] = [
      createScreenshotSessionEvent({
        request_id: request.request_id,
        event_type: "screenshot_session_started",
        status: "sanitized",
        reason: "started",
        timestamp_ms: captureOptions.requested_at_ms,
      }),
    ];

    const gate = validateVisionScreenshotRequest(request);
    if (gate.status !== "accepted") {
      events.push(
        createScreenshotSessionEvent({
          request_id: request.request_id,
          event_type: "screenshot_gate_denied",
          status: "denied",
          reason: gate.reason ?? "gate_denied",
          timestamp_ms: captureOptions.requested_at_ms,
        }),
      );
      return screenshotSessionResult({
        request_id: request.request_id,
        status: "denied",
        reason: gate.reason ?? "gate_denied",
        capture_result: null,
        provider_result: null,
        observations: [],
        events,
        provider_executed: false,
        fake_capture_executed: false,
      });
    }

    events.push(
      createScreenshotSessionEvent({
        request_id: request.request_id,
        event_type: "screenshot_gate_accepted",
        status: "sanitized",
        reason: "gate_accepted",
        timestamp_ms: captureOptions.requested_at_ms,
      }),
    );

    const captureResult = sanitizeCaptureResult(
      await this.captureAdapter.capture(request, captureOptions),
    );
    if (captureResult.capture_status !== "success") {
      const status = statusForCaptureFailure(captureResult.capture_status);
      events.push(
        createScreenshotSessionEvent({
          request_id: request.request_id,
          event_type:
            status === "cancelled"
              ? "screenshot_session_cancelled"
              : status === "timeout"
                ? "screenshot_session_timeout"
                : "fake_capture_failed",
          status,
          reason: captureResult.reason ?? captureResult.capture_status,
          capture_status: captureResult.capture_status,
          timestamp_ms: captureOptions.requested_at_ms,
        }),
      );
      return screenshotSessionResult({
        request_id: request.request_id,
        status,
        reason: captureResult.reason ?? captureResult.capture_status,
        capture_result: captureResult,
        provider_result: null,
        observations: [],
        events,
        provider_executed: false,
        fake_capture_executed: captureResult.fake_capture_executed,
      });
    }

    events.push(
      createScreenshotSessionEvent({
        request_id: request.request_id,
        event_type: "fake_capture_completed",
        status: "sanitized",
        reason: "capture_completed",
        capture_status: captureResult.capture_status,
        timestamp_ms: captureOptions.requested_at_ms,
        fake_capture_executed: true,
      }),
    );

    const providerRun = await this.visionSessionRunner.run({
      request_id: `${request.request_id}-ocr`,
      session_id: `${request.request_id}-vision`,
      capability: "screenshot_ocr",
      input_kind: "screenshot",
      environment: "test",
      user_triggered: true,
      timeout_ms: input.provider_timeout_ms ?? 100,
      requested_at_ms: captureOptions.requested_at_ms,
      cancellation_token: input.provider_cancelled
        ? {
            cancellation_id: `${request.request_id}-provider-cancelled`,
            cancelled: true,
            reason: "user_cancelled",
            requested_at_ms: captureOptions.requested_at_ms,
            metadata_only: true,
          }
        : undefined,
      simulated_latency_ms: input.provider_simulated_latency_ms,
      metadata_only: true,
    });

    const providerResult = providerRun.provider_result
      ? sanitizeOrThrow(
          sanitizeVisionProviderResult(providerRun.provider_result),
          "Unsafe screenshot OCR provider result.",
        )
      : null;
    const observations = providerRun.observations.map((observation) =>
      sanitizeOrThrow(
        sanitizeVisionObservation(observation),
        "Unsafe screenshot OCR observation.",
      ),
    );
    events.push(...providerRun.events);

    if (providerRun.session.state !== "completed" || !providerResult) {
      const status =
        providerRun.session.state === "cancelled"
          ? "cancelled"
          : providerRun.session.reason === "provider_timeout"
            ? "timeout"
            : "provider_failed";
      events.push(
        createScreenshotSessionEvent({
          request_id: request.request_id,
          event_type:
            status === "cancelled"
              ? "screenshot_session_cancelled"
              : status === "timeout"
                ? "screenshot_session_timeout"
                : "fake_ocr_failed",
          status,
          reason: providerRun.session.reason,
          result_status: providerResult?.status ?? null,
          observation_count: 0,
          provider_executed: providerRun.session.provider_executed,
          fake_capture_executed: true,
          timestamp_ms: captureOptions.requested_at_ms,
        }),
      );
      return screenshotSessionResult({
        request_id: request.request_id,
        status,
        reason: providerRun.session.reason,
        capture_result: captureResult,
        provider_result: providerResult,
        observations: [],
        events,
        provider_executed: providerRun.session.provider_executed,
        fake_capture_executed: true,
      });
    }

    events.push(
      createScreenshotSessionEvent({
        request_id: request.request_id,
        event_type: "fake_ocr_completed",
        status: "sanitized",
        reason: "ocr_completed",
        result_status: providerResult.status,
        observation_count: observations.length,
        provider_executed: true,
        fake_capture_executed: true,
        timestamp_ms: captureOptions.requested_at_ms,
      }),
      createScreenshotSessionEvent({
        request_id: request.request_id,
        event_type: "screenshot_session_completed",
        status: "completed",
        reason: "completed",
        result_status: providerResult.status,
        observation_count: observations.length,
        provider_executed: true,
        fake_capture_executed: true,
        timestamp_ms: captureOptions.requested_at_ms,
      }),
    );

    return screenshotSessionResult({
      request_id: request.request_id,
      status: "completed",
      reason: "completed",
      capture_result: captureResult,
      provider_result: providerResult,
      observations,
      events,
      provider_executed: true,
      fake_capture_executed: true,
    });
  }
}

export function runFakeScreenshotOcrSession(
  input: FakeScreenshotOcrSessionInput,
): Promise<VisionScreenshotSessionResult> {
  return new ScreenshotSessionRunner().run(input);
}

function createScreenshotSessionEvent(input: {
  readonly request_id: string;
  readonly event_type: VisionScreenshotSessionEventType;
  readonly status: VisionScreenshotSessionStatus;
  readonly reason: string;
  readonly capture_status?: string | null;
  readonly result_status?: string | null;
  readonly observation_count?: number;
  readonly provider_executed?: boolean;
  readonly fake_capture_executed?: boolean;
  readonly timestamp_ms: number;
}): VisionScreenshotSessionLifecycleEvent {
  const event = VisionScreenshotSessionLifecycleEventSchema.parse({
    event_id: `${input.request_id}.${input.event_type.replace(/_/g, "-")}`,
    event_type: input.event_type,
    request_id: input.request_id,
    status: input.status,
    reason: input.reason,
    capture_status: input.capture_status ?? null,
    result_status: input.result_status ?? null,
    observation_count: input.observation_count ?? 0,
    timestamp_ms: input.timestamp_ms,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    provider_executed: input.provider_executed ?? false,
    fake_capture_executed: input.fake_capture_executed ?? false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
  });
  return sanitizeOrThrow(
    sanitizeVisionMetadataPayload(event),
    "Unsafe screenshot session event.",
  ) as VisionScreenshotSessionLifecycleEvent;
}

function screenshotSessionResult(input: {
  readonly request_id: string;
  readonly status: VisionScreenshotSessionStatus;
  readonly reason: string;
  readonly capture_result: VisionScreenshotCaptureResult | null;
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly events: readonly (
    | VisionScreenshotSessionLifecycleEvent
    | VisionSessionLifecycleEvent
  )[];
  readonly provider_executed: boolean;
  readonly fake_capture_executed: boolean;
}): VisionScreenshotSessionResult {
  for (const event of input.events) {
    sanitizeOrThrow(
      "capture_status" in event
        ? sanitizeVisionMetadataPayload(event)
        : sanitizeVisionSessionLifecycleEvent(event),
      "Unsafe screenshot session event.",
    );
  }
  if (input.provider_result) {
    sanitizeOrThrow(
      sanitizeVisionProviderResult(input.provider_result),
      "Unsafe screenshot provider result.",
    );
  }
  for (const observation of input.observations) {
    sanitizeOrThrow(
      sanitizeVisionObservation(observation),
      "Unsafe screenshot observation.",
    );
  }

  const parsed = VisionScreenshotSessionResultSchema.parse({
    request_id: input.request_id,
    status: input.status,
    reason: input.reason,
    capture_result: input.capture_result,
    provider_result: input.provider_result,
    observation_count: input.observations.length,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    raw_image_included: false,
    raw_frame_included: false,
    base64_included: false,
    ocr_text_included: false,
    persisted: false,
    provider_executed: input.provider_executed,
    fake_capture_executed: input.fake_capture_executed,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
  });

  return {
    ...parsed,
    provider_result: input.provider_result,
    observations: input.observations,
    events: input.events,
  };
}

function sanitizeCaptureResult(
  captureResult: VisionScreenshotCaptureResult,
): VisionScreenshotCaptureResult {
  sanitizeOrThrow(
    sanitizeVisionMetadataPayload(captureResult),
    "Unsafe screenshot capture result.",
  );
  return VisionScreenshotCaptureResultSchema.parse(captureResult);
}

function statusForCaptureFailure(
  captureStatus: VisionScreenshotCaptureResult["capture_status"],
): VisionScreenshotSessionStatus {
  switch (captureStatus) {
    case "cancelled":
      return "cancelled";
    case "timeout":
      return "timeout";
    case "gate_denied":
      return "denied";
    case "permission_denied":
    case "unsupported_region":
    case "capture_unavailable":
      return "capture_failed";
    case "success":
      return "completed";
  }
}

function sanitizeOrThrow<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | {
        readonly ok: false;
        readonly reason: string;
        readonly field_path: string | null;
      },
  message: string,
): T {
  if (result.ok) return result.value;
  throw new TypeError(`${message} ${result.reason}:${result.field_path ?? ""}`);
}
