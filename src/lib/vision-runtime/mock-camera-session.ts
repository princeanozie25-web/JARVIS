import { z } from "zod";

import type { VisionObservation, VisionProviderResult } from "./contracts";
import {
  VisionCameraRequestSchema,
  validateVisionCameraRequest,
  type VisionCameraRequest,
} from "./mock-camera";
import {
  createMockCameraFrameProvider,
  MockCameraStreamOptionsSchema,
  MockCameraStreamResultSchema,
  type MockCameraFrameProvider,
  type MockCameraStreamOptions,
  type MockCameraStreamResult,
  type MockCameraStreamStatus,
} from "./mock-camera-provider";
import {
  sanitizeVisionMetadataPayload,
  sanitizeVisionObservation,
  sanitizeVisionProviderResult,
  sanitizeVisionSessionLifecycleEvent,
} from "./redaction";
import {
  VisionSessionRunner,
  type VisionSessionLifecycleEvent,
} from "./session";

export const MOCK_CAMERA_SESSION_STATUSES = [
  "completed",
  "denied",
  "frame_unavailable",
  "provider_failed",
  "cancelled",
  "timeout",
  "no_signal",
  "sanitized",
] as const;

export const MOCK_CAMERA_SESSION_EVENT_TYPES = [
  "mock_camera_session_started",
  "mock_camera_gate_denied",
  "mock_camera_gate_accepted",
  "mock_camera_stream_completed",
  "mock_camera_stream_failed",
  "fake_object_detection_completed",
  "fake_object_detection_failed",
  "mock_camera_session_completed",
  "mock_camera_session_cancelled",
  "mock_camera_session_timeout",
  "mock_camera_session_no_signal",
  "mock_camera_session_sanitized",
] as const;

const MockCameraSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const MockCameraSessionStatusSchema = z.enum(
  MOCK_CAMERA_SESSION_STATUSES,
);
export const MockCameraSessionEventTypeSchema = z.enum(
  MOCK_CAMERA_SESSION_EVENT_TYPES,
);

export const MockCameraSessionLifecycleEventSchema = z.strictObject({
  event_id: MockCameraSessionIdSchema,
  event_type: MockCameraSessionEventTypeSchema,
  request_id: MockCameraSessionIdSchema,
  status: MockCameraSessionStatusSchema,
  reason: z.string().trim().min(1).max(120).nullable(),
  stream_status: z.string().trim().min(1).max(120).nullable(),
  result_status: z.string().trim().min(1).max(120).nullable(),
  frame_count: z.number().int().nonnegative(),
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
  detection_labels_included: z.literal(false),
  provider_executed: z.boolean(),
  mock_frame_stream_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export const MockCameraSessionResultSchema = z.strictObject({
  request_id: MockCameraSessionIdSchema,
  status: MockCameraSessionStatusSchema,
  reason: z.string().trim().min(1).max(120).nullable(),
  stream_result: MockCameraStreamResultSchema.nullable(),
  provider_result: z.unknown().nullable(),
  frame_count: z.number().int().nonnegative(),
  observation_count: z.number().int().nonnegative(),
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
  provider_executed: z.boolean(),
  mock_frame_stream_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export type MockCameraSessionStatus =
  (typeof MOCK_CAMERA_SESSION_STATUSES)[number];
export type MockCameraSessionEventType =
  (typeof MOCK_CAMERA_SESSION_EVENT_TYPES)[number];
export type MockCameraSessionLifecycleEvent = z.infer<
  typeof MockCameraSessionLifecycleEventSchema
>;
export type MockCameraSessionResult = z.infer<
  typeof MockCameraSessionResultSchema
> & {
  readonly stream_result: MockCameraStreamResult | null;
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly events: readonly (
    | MockCameraSessionLifecycleEvent
    | VisionSessionLifecycleEvent
  )[];
};

export interface MockCameraObjectSessionInput {
  readonly request: VisionCameraRequest;
  readonly stream_options: MockCameraStreamOptions;
  readonly provider_timeout_ms?: number;
  readonly provider_simulated_latency_ms?: number;
  readonly provider_cancelled?: boolean;
  readonly metadata_only: true;
}

export interface MockCameraSessionRunnerOptions {
  readonly frame_provider?: MockCameraFrameProvider;
  readonly vision_session_runner?: VisionSessionRunner;
}

export class MockCameraSessionRunner {
  private readonly frameProvider: MockCameraFrameProvider;
  private readonly visionSessionRunner: VisionSessionRunner;

  constructor(options: MockCameraSessionRunnerOptions = {}) {
    this.frameProvider =
      options.frame_provider ?? createMockCameraFrameProvider();
    this.visionSessionRunner =
      options.vision_session_runner ?? new VisionSessionRunner();
  }

  async run(
    input: MockCameraObjectSessionInput,
  ): Promise<MockCameraSessionResult> {
    const request = VisionCameraRequestSchema.parse(input.request);
    const streamOptions = MockCameraStreamOptionsSchema.parse(
      input.stream_options,
    );
    const events: (
      | MockCameraSessionLifecycleEvent
      | VisionSessionLifecycleEvent
    )[] = [
      createMockCameraSessionEvent({
        request_id: request.request_id,
        event_type: "mock_camera_session_started",
        status: "sanitized",
        reason: "started",
        timestamp_ms: streamOptions.requested_at_ms,
      }),
    ];

    const gate = validateVisionCameraRequest(request);
    if (gate.status !== "accepted") {
      events.push(
        createMockCameraSessionEvent({
          request_id: request.request_id,
          event_type: "mock_camera_gate_denied",
          status: "denied",
          reason: gate.reason ?? "gate_denied",
          timestamp_ms: streamOptions.requested_at_ms,
        }),
      );
      return mockCameraSessionResult({
        request_id: request.request_id,
        status: "denied",
        reason: gate.reason ?? "gate_denied",
        stream_result: null,
        provider_result: null,
        observations: [],
        events,
        provider_executed: false,
        mock_frame_stream_executed: false,
      });
    }

    events.push(
      createMockCameraSessionEvent({
        request_id: request.request_id,
        event_type: "mock_camera_gate_accepted",
        status: "sanitized",
        reason: "gate_accepted",
        timestamp_ms: streamOptions.requested_at_ms,
      }),
    );

    const streamResult = sanitizeStreamResult(
      await this.frameProvider.stream(request, streamOptions),
    );
    if (streamResult.status !== "success") {
      const status = statusForStreamFailure(streamResult.status);
      events.push(
        createMockCameraSessionEvent({
          request_id: request.request_id,
          event_type:
            status === "cancelled"
              ? "mock_camera_session_cancelled"
              : status === "timeout"
                ? "mock_camera_session_timeout"
                : status === "no_signal"
                  ? "mock_camera_session_no_signal"
                  : "mock_camera_stream_failed",
          status,
          reason: streamResult.reason ?? streamResult.status,
          stream_status: streamResult.status,
          frame_count: streamResult.frame_count,
          timestamp_ms: streamOptions.requested_at_ms,
        }),
      );
      return mockCameraSessionResult({
        request_id: request.request_id,
        status,
        reason: streamResult.reason ?? streamResult.status,
        stream_result: streamResult,
        provider_result: null,
        observations: [],
        events,
        provider_executed: false,
        mock_frame_stream_executed: streamResult.status === "no_signal",
      });
    }

    events.push(
      createMockCameraSessionEvent({
        request_id: request.request_id,
        event_type: "mock_camera_stream_completed",
        status: "sanitized",
        reason: "stream_completed",
        stream_status: streamResult.status,
        frame_count: streamResult.frame_count,
        mock_frame_stream_executed: true,
        timestamp_ms: streamOptions.requested_at_ms,
      }),
    );

    const providerRun = await this.visionSessionRunner.run({
      request_id: `${request.request_id}-object-detection`,
      session_id: `${request.request_id}-vision`,
      capability: "object_detection",
      input_kind: "mock_camera_frame",
      environment: request.environment,
      user_triggered: true,
      timeout_ms: input.provider_timeout_ms ?? 100,
      requested_at_ms: streamOptions.requested_at_ms,
      cancellation_token: input.provider_cancelled
        ? {
            cancellation_id: `${request.request_id}-provider-cancelled`,
            cancelled: true,
            reason: "user_cancelled",
            requested_at_ms: streamOptions.requested_at_ms,
            metadata_only: true,
          }
        : undefined,
      simulated_latency_ms: input.provider_simulated_latency_ms,
      metadata_only: true,
    });

    const providerResult = providerRun.provider_result
      ? sanitizeOrThrow(
          sanitizeVisionProviderResult(providerRun.provider_result),
          "Unsafe mock camera object provider result.",
        )
      : null;
    const observations = providerRun.observations.map((observation) =>
      sanitizeOrThrow(
        sanitizeVisionObservation(observation),
        "Unsafe mock camera object observation.",
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
        createMockCameraSessionEvent({
          request_id: request.request_id,
          event_type:
            status === "cancelled"
              ? "mock_camera_session_cancelled"
              : status === "timeout"
                ? "mock_camera_session_timeout"
                : "fake_object_detection_failed",
          status,
          reason: providerRun.session.reason,
          stream_status: streamResult.status,
          result_status: providerResult?.status ?? null,
          frame_count: streamResult.frame_count,
          observation_count: 0,
          provider_executed: providerRun.session.provider_executed,
          mock_frame_stream_executed: true,
          timestamp_ms: streamOptions.requested_at_ms,
        }),
      );
      return mockCameraSessionResult({
        request_id: request.request_id,
        status,
        reason: providerRun.session.reason,
        stream_result: streamResult,
        provider_result: providerResult,
        observations: [],
        events,
        provider_executed: providerRun.session.provider_executed,
        mock_frame_stream_executed: true,
      });
    }

    events.push(
      createMockCameraSessionEvent({
        request_id: request.request_id,
        event_type: "fake_object_detection_completed",
        status: "sanitized",
        reason: "object_detection_completed",
        stream_status: streamResult.status,
        result_status: providerResult.status,
        frame_count: streamResult.frame_count,
        observation_count: observations.length,
        provider_executed: true,
        mock_frame_stream_executed: true,
        timestamp_ms: streamOptions.requested_at_ms,
      }),
      createMockCameraSessionEvent({
        request_id: request.request_id,
        event_type: "mock_camera_session_completed",
        status: "completed",
        reason: "completed",
        stream_status: streamResult.status,
        result_status: providerResult.status,
        frame_count: streamResult.frame_count,
        observation_count: observations.length,
        provider_executed: true,
        mock_frame_stream_executed: true,
        timestamp_ms: streamOptions.requested_at_ms,
      }),
    );

    return mockCameraSessionResult({
      request_id: request.request_id,
      status: "completed",
      reason: "completed",
      stream_result: streamResult,
      provider_result: providerResult,
      observations,
      events,
      provider_executed: true,
      mock_frame_stream_executed: true,
    });
  }
}

export function runMockCameraObjectSession(
  input: MockCameraObjectSessionInput,
): Promise<MockCameraSessionResult> {
  return new MockCameraSessionRunner().run(input);
}

function createMockCameraSessionEvent(input: {
  readonly request_id: string;
  readonly event_type: MockCameraSessionEventType;
  readonly status: MockCameraSessionStatus;
  readonly reason: string;
  readonly stream_status?: string | null;
  readonly result_status?: string | null;
  readonly frame_count?: number;
  readonly observation_count?: number;
  readonly provider_executed?: boolean;
  readonly mock_frame_stream_executed?: boolean;
  readonly timestamp_ms: number;
}): MockCameraSessionLifecycleEvent {
  const event = MockCameraSessionLifecycleEventSchema.parse({
    event_id: `${input.request_id}.${input.event_type.replace(/_/g, "-")}`,
    event_type: input.event_type,
    request_id: input.request_id,
    status: input.status,
    reason: input.reason,
    stream_status: input.stream_status ?? null,
    result_status: input.result_status ?? null,
    frame_count: input.frame_count ?? 0,
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
    detection_labels_included: false,
    provider_executed: input.provider_executed ?? false,
    mock_frame_stream_executed: input.mock_frame_stream_executed ?? false,
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
    "Unsafe mock camera session event.",
  ) as MockCameraSessionLifecycleEvent;
}

function mockCameraSessionResult(input: {
  readonly request_id: string;
  readonly status: MockCameraSessionStatus;
  readonly reason: string;
  readonly stream_result: MockCameraStreamResult | null;
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly events: readonly (
    | MockCameraSessionLifecycleEvent
    | VisionSessionLifecycleEvent
  )[];
  readonly provider_executed: boolean;
  readonly mock_frame_stream_executed: boolean;
}): MockCameraSessionResult {
  for (const event of input.events) {
    sanitizeOrThrow(
      "request_id" in event
        ? sanitizeVisionMetadataPayload(event)
        : sanitizeVisionSessionLifecycleEvent(event),
      "Unsafe mock camera session event.",
    );
  }
  if (input.stream_result) {
    sanitizeOrThrow(
      sanitizeVisionMetadataPayload(input.stream_result),
      "Unsafe mock camera stream result.",
    );
  }
  if (input.provider_result) {
    sanitizeOrThrow(
      sanitizeVisionProviderResult(input.provider_result),
      "Unsafe mock camera provider result.",
    );
  }
  for (const observation of input.observations) {
    sanitizeOrThrow(
      sanitizeVisionObservation(observation),
      "Unsafe mock camera observation.",
    );
  }

  const parsed = MockCameraSessionResultSchema.parse({
    request_id: input.request_id,
    status: input.status,
    reason: input.reason,
    stream_result: input.stream_result,
    provider_result: input.provider_result,
    frame_count: input.stream_result?.frame_count ?? 0,
    observation_count: input.observations.length,
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
    provider_executed: input.provider_executed,
    mock_frame_stream_executed: input.mock_frame_stream_executed,
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

function sanitizeStreamResult(
  streamResult: MockCameraStreamResult,
): MockCameraStreamResult {
  sanitizeOrThrow(
    sanitizeVisionMetadataPayload(streamResult),
    "Unsafe mock camera stream result.",
  );
  return MockCameraStreamResultSchema.parse(streamResult);
}

function statusForStreamFailure(
  streamStatus: MockCameraStreamStatus,
): MockCameraSessionStatus {
  switch (streamStatus) {
    case "cancelled":
      return "cancelled";
    case "timeout":
      return "timeout";
    case "no_signal":
      return "no_signal";
    case "gate_denied":
      return "denied";
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
