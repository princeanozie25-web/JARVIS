import {
  CAPTURE_LIFECYCLE_STATES,
  CAPTURE_STATE_EVENTS,
  type CaptureLifecycleState,
  type CaptureStateEvent,
  type CaptureStateTransitionResult,
} from "./types";

const CAPTURE_TRANSITIONS: Record<
  CaptureLifecycleState,
  Partial<Record<CaptureStateEvent, CaptureLifecycleState>>
> = {
  idle: {
    arm: "arming",
  },
  arming: {
    start_capture: "capturing",
    cancel: "cancelled",
    fail: "failed",
  },
  capturing: {
    endpoint_detected: "endpoint_detected",
    cancel: "cancelled",
    fail: "failed",
  },
  endpoint_detected: {
    begin_transcription: "transcribing",
    fail: "failed",
  },
  transcribing: {
    cancel: "cancelled",
    fail: "failed",
  },
  cancelled: {
    reset: "idle",
  },
  failed: {
    reset: "idle",
  },
};

export function transitionCaptureState(
  currentState: unknown,
  event: unknown,
): CaptureStateTransitionResult {
  if (!isCaptureLifecycleState(currentState)) {
    return {
      ok: false,
      previous_state: null,
      event: isCaptureStateEvent(event) ? event : null,
      next_state: null,
      reason: "invalid_state",
      metadata_only: true,
    };
  }

  if (!isCaptureStateEvent(event)) {
    return {
      ok: false,
      previous_state: currentState,
      event: null,
      next_state: currentState,
      reason: "invalid_event",
      metadata_only: true,
    };
  }

  const nextState = CAPTURE_TRANSITIONS[currentState][event];
  if (!nextState) {
    return {
      ok: false,
      previous_state: currentState,
      event,
      next_state: currentState,
      reason: "invalid_transition",
      metadata_only: true,
    };
  }

  return {
    ok: true,
    previous_state: currentState,
    event,
    next_state: nextState,
    metadata_only: true,
  };
}

export function isCaptureLifecycleState(
  value: unknown,
): value is CaptureLifecycleState {
  return (
    typeof value === "string" &&
    (CAPTURE_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function isCaptureStateEvent(
  value: unknown,
): value is CaptureStateEvent {
  return (
    typeof value === "string" &&
    (CAPTURE_STATE_EVENTS as readonly string[]).includes(value)
  );
}
