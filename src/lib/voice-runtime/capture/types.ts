import type { VoiceCancellationReason } from "../types";

export const CAPTURE_LIFECYCLE_STATES = [
  "idle",
  "arming",
  "capturing",
  "endpoint_detected",
  "transcribing",
  "cancelled",
  "failed",
] as const;

export const CAPTURE_STATE_EVENTS = [
  "arm",
  "start_capture",
  "endpoint_detected",
  "begin_transcription",
  "cancel",
  "fail",
  "reset",
] as const;

export const CAPTURE_TERMINAL_STATES = ["cancelled", "failed"] as const;

export type CaptureLifecycleState = (typeof CAPTURE_LIFECYCLE_STATES)[number];
export type CaptureStateEvent = (typeof CAPTURE_STATE_EVENTS)[number];
export type CaptureTerminalState = (typeof CAPTURE_TERMINAL_STATES)[number];

export type CaptureStateTransitionFailureReason =
  | "invalid_state"
  | "invalid_event"
  | "invalid_transition";

export type CaptureErrorClass =
  | VoiceCancellationReason
  | "capture_error"
  | "invalid_transition"
  | "unknown";

export interface CaptureSessionMetadata {
  readonly session_id: string;
  readonly turn_id: string;
  readonly state: CaptureLifecycleState;
  readonly started_at?: string;
  readonly ended_at?: string;
  readonly duration_ms?: number;
  readonly cancellation_reason?: VoiceCancellationReason;
  readonly error_class?: CaptureErrorClass;
  readonly metadata_only: true;
}

export type CaptureStateTransitionResult =
  | {
      readonly ok: true;
      readonly previous_state: CaptureLifecycleState;
      readonly event: CaptureStateEvent;
      readonly next_state: CaptureLifecycleState;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly previous_state: CaptureLifecycleState | null;
      readonly event: CaptureStateEvent | null;
      readonly next_state: CaptureLifecycleState | null;
      readonly reason: CaptureStateTransitionFailureReason;
      readonly metadata_only: true;
    };
