import { z } from "zod";
import {
  VisionReplayInputTypeSchema,
  VisionReplayRedactionStatusSchema,
} from "./failure-replay";

export const VISION_SESSION_STATES = [
  "idle",
  "requested",
  "active",
  "cancelling",
  "completed",
  "failed",
  "expired",
  "denied",
] as const;

export const VISION_SESSION_SURFACES = [
  "chat",
  "voice",
  "developer_test",
] as const;

export const VISION_SESSION_REASONS = [
  "requested",
  "started",
  "completed",
  "cancel_requested",
  "cancelled",
  "failed",
  "expired",
  "single_active_session_denied",
  "abort_signal_received",
] as const;

export const VISION_SESSION_EVENT_TYPES = [
  "vision_session_requested",
  "vision_session_started",
  "vision_session_cancelled",
  "vision_session_failed",
  "vision_session_completed",
  "vision_session_expired",
  "vision_session_denied",
] as const;

export const VISION_SESSION_DISABLED_FEATURES = [
  "camera_capture",
  "screen_capture",
  "raw_frame_storage",
  "raw_image_storage",
  "ocr_text_storage",
  "cloud_vision_calls",
  "provider_execution",
  "runtime_actions",
  "approval_granting",
  "background_watchers",
] as const;

export type VisionSessionState = (typeof VISION_SESSION_STATES)[number];
export type VisionSessionSurface = (typeof VISION_SESSION_SURFACES)[number];
export type VisionSessionReason = (typeof VISION_SESSION_REASONS)[number];
export type VisionSessionEventType =
  (typeof VISION_SESSION_EVENT_TYPES)[number];
export type VisionSessionDisabledFeature =
  (typeof VISION_SESSION_DISABLED_FEATURES)[number];

const VisionSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionSessionHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VisionSessionStateSchema = z.enum(VISION_SESSION_STATES);
export const VisionSessionSurfaceSchema = z.enum(VISION_SESSION_SURFACES);
export const VisionSessionReasonSchema = z.enum(VISION_SESSION_REASONS);
export const VisionSessionEventTypeSchema = z.enum(VISION_SESSION_EVENT_TYPES);
export const VisionSessionDisabledFeatureSchema = z.enum(
  VISION_SESSION_DISABLED_FEATURES,
);

export const VisionSessionFeatureFlagsSchema = z.object(
  Object.fromEntries(
    VISION_SESSION_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<VisionSessionDisabledFeature, z.ZodLiteral<false>>,
);

export const DEFAULT_VISION_SESSION_FEATURE_FLAGS = Object.fromEntries(
  VISION_SESSION_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof VisionSessionFeatureFlagsSchema>;

export const VisionFailureReplayReferenceSchema = z.strictObject({
  replay_id: VisionSessionIdSchema,
  input_hash: VisionSessionHashSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const VisionSessionRecordSchema = z
  .strictObject({
    session_id: VisionSessionIdSchema,
    requested_input_type: VisionReplayInputTypeSchema,
    surface: VisionSessionSurfaceSchema,
    state: VisionSessionStateSchema,
    started_at: z.number().int().nonnegative(),
    ended_at: z.number().int().nonnegative().nullable(),
    duration_ms: z.number().int().nonnegative().nullable(),
    reason: VisionSessionReasonSchema,
    redaction_status: VisionReplayRedactionStatusSchema,
    cancellation_token_hash: VisionSessionHashSchema.nullable(),
    abort_signal_received: z.boolean(),
    failure_replay_ref: VisionFailureReplayReferenceSchema.nullable(),
    metadata_only: z.literal(true),
    advisory_only: z.literal(true),
    perception_authority: z.literal(false),
    raw_payload_stored: z.literal(false),
    capture_started: z.literal(false),
    cloud_called: z.literal(false),
    action_executed: z.literal(false),
    background_watcher_started: z.literal(false),
  })
  .superRefine((session, ctx) => {
    if (session.ended_at !== null && session.ended_at < session.started_at) {
      ctx.addIssue({
        code: "custom",
        path: ["ended_at"],
        message: "ended_at must be greater than or equal to started_at.",
      });
    }
    if (session.ended_at === null && session.duration_ms !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["duration_ms"],
        message: "duration_ms must be null until the session ends.",
      });
    }
    if (
      session.ended_at !== null &&
      session.duration_ms !== session.ended_at - session.started_at
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["duration_ms"],
        message: "duration_ms must equal ended_at - started_at.",
      });
    }
  });

export const VisionSessionTelemetryEventSchema = z.strictObject({
  event_type: VisionSessionEventTypeSchema,
  session_id_hash: VisionSessionHashSchema,
  state: VisionSessionStateSchema,
  surface: VisionSessionSurfaceSchema,
  requested_input_type: VisionReplayInputTypeSchema,
  reason: VisionSessionReasonSchema,
  duration_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  advisory_only: z.literal(true),
  perception_authority: z.literal(false),
  capture_started: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionSessionFeatureFlags = z.infer<
  typeof VisionSessionFeatureFlagsSchema
>;
export type VisionFailureReplayReference = z.infer<
  typeof VisionFailureReplayReferenceSchema
>;
export type VisionSessionRecord = z.infer<typeof VisionSessionRecordSchema>;
export type VisionSessionTelemetryEvent = z.infer<
  typeof VisionSessionTelemetryEventSchema
>;

export interface RequestVisionSessionInput {
  session_id: string;
  requested_input_type: z.infer<typeof VisionReplayInputTypeSchema>;
  surface: VisionSessionSurface;
  requested_at: number;
  existing_sessions?: VisionSessionRecord[];
  cancellation_token_hash?: string | null;
  failure_replay_ref?: VisionFailureReplayReference | null;
}

export interface TransitionVisionSessionInput {
  session: VisionSessionRecord;
  now_ms: number;
}

export interface FailVisionSessionInput extends TransitionVisionSessionInput {
  reason?: Extract<VisionSessionReason, "failed" | "abort_signal_received">;
}

const OCCUPYING_STATES = new Set<VisionSessionState>([
  "requested",
  "active",
  "cancelling",
]);

function isOccupying(session: VisionSessionRecord): boolean {
  return OCCUPYING_STATES.has(session.state);
}

function duration(started_at: number, ended_at: number): number {
  return ended_at - started_at;
}

function transition(
  session: VisionSessionRecord,
  changes: Partial<VisionSessionRecord>,
): VisionSessionRecord {
  return VisionSessionRecordSchema.parse({
    ...session,
    ...changes,
    metadata_only: true,
    advisory_only: true,
    perception_authority: false,
    raw_payload_stored: false,
    capture_started: false,
    cloud_called: false,
    action_executed: false,
    background_watcher_started: false,
  });
}

function terminalNoop(
  session: VisionSessionRecord,
  now_ms: number,
  reason: VisionSessionReason,
): VisionSessionRecord {
  return transition(session, {
    state: "failed",
    ended_at: now_ms,
    duration_ms: duration(session.started_at, now_ms),
    reason,
  });
}

export function requestVisionSession(
  input: RequestVisionSessionInput,
): VisionSessionRecord {
  const existing = input.existing_sessions ?? [];
  const hasOccupyingSession = existing
    .map((session) => VisionSessionRecordSchema.parse(session))
    .some(isOccupying);

  return VisionSessionRecordSchema.parse({
    session_id: input.session_id,
    requested_input_type: input.requested_input_type,
    surface: input.surface,
    state: hasOccupyingSession ? "denied" : "requested",
    started_at: input.requested_at,
    ended_at: hasOccupyingSession ? input.requested_at : null,
    duration_ms: hasOccupyingSession ? 0 : null,
    reason: hasOccupyingSession ? "single_active_session_denied" : "requested",
    redaction_status: "metadata_only",
    cancellation_token_hash: input.cancellation_token_hash ?? null,
    abort_signal_received: false,
    failure_replay_ref: input.failure_replay_ref ?? null,
    metadata_only: true,
    advisory_only: true,
    perception_authority: false,
    raw_payload_stored: false,
    capture_started: false,
    cloud_called: false,
    action_executed: false,
    background_watcher_started: false,
  });
}

export function startVisionSession(
  input: TransitionVisionSessionInput,
): VisionSessionRecord {
  const session = VisionSessionRecordSchema.parse(input.session);
  if (session.state !== "requested") {
    return terminalNoop(session, input.now_ms, "failed");
  }
  return transition(session, {
    state: "active",
    reason: "started",
  });
}

export function cancelVisionSession(
  input: TransitionVisionSessionInput,
): VisionSessionRecord {
  const session = VisionSessionRecordSchema.parse(input.session);
  if (session.state === "completed") return session;
  return transition(session, {
    state: "cancelling",
    ended_at: input.now_ms,
    duration_ms: duration(session.started_at, input.now_ms),
    reason: "cancelled",
    abort_signal_received: true,
  });
}

export function completeVisionSession(
  input: TransitionVisionSessionInput,
): VisionSessionRecord {
  const session = VisionSessionRecordSchema.parse(input.session);
  if (session.state !== "active") {
    return transition(session, {
      state: session.state,
      reason: session.reason,
    });
  }
  return transition(session, {
    state: "completed",
    ended_at: input.now_ms,
    duration_ms: duration(session.started_at, input.now_ms),
    reason: "completed",
  });
}

export function failVisionSession(
  input: FailVisionSessionInput,
): VisionSessionRecord {
  const session = VisionSessionRecordSchema.parse(input.session);
  return transition(session, {
    state: "failed",
    ended_at: input.now_ms,
    duration_ms: duration(session.started_at, input.now_ms),
    reason: input.reason ?? "failed",
    abort_signal_received:
      session.abort_signal_received || input.reason === "abort_signal_received",
  });
}

export function expireVisionSession(
  input: TransitionVisionSessionInput,
): VisionSessionRecord {
  const session = VisionSessionRecordSchema.parse(input.session);
  return transition(session, {
    state: "expired",
    ended_at: input.now_ms,
    duration_ms: duration(session.started_at, input.now_ms),
    reason: "expired",
  });
}

export function createVisionSessionTelemetryEvent(input: {
  session: VisionSessionRecord;
  event_type: VisionSessionEventType;
  session_id_hash: string;
}): VisionSessionTelemetryEvent {
  const session = VisionSessionRecordSchema.parse(input.session);
  return VisionSessionTelemetryEventSchema.parse({
    event_type: input.event_type,
    session_id_hash: input.session_id_hash,
    state: session.state,
    surface: session.surface,
    requested_input_type: session.requested_input_type,
    reason: session.reason,
    duration_ms: session.duration_ms,
    metadata_only: true,
    raw_payload_included: false,
    advisory_only: true,
    perception_authority: false,
    capture_started: false,
    cloud_called: false,
    action_executed: false,
  });
}
