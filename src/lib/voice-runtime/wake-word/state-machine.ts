import {
  WAKE_WORD_LIFECYCLE_STATES,
  WAKE_WORD_STATE_EVENTS,
  WAKE_WORD_TERMINAL_STATES,
  type WakeWordLifecycleState,
  type WakeWordStateEvent,
  type WakeWordStateTransitionResult,
} from "./types";

export function isWakeWordLifecycleState(
  value: unknown,
): value is WakeWordLifecycleState {
  return (
    typeof value === "string" &&
    (WAKE_WORD_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function isWakeWordStateEvent(
  value: unknown,
): value is WakeWordStateEvent {
  return (
    typeof value === "string" &&
    (WAKE_WORD_STATE_EVENTS as readonly string[]).includes(value)
  );
}

export function transitionWakeWordState(
  currentState: unknown,
  event: unknown,
  options: { readonly activation_window_ms?: number } = {},
): WakeWordStateTransitionResult {
  if (!isWakeWordLifecycleState(currentState)) {
    return failure(null, null, "invalid_state");
  }
  if (!isWakeWordStateEvent(event)) {
    return failure(currentState, null, "invalid_event");
  }

  if (
    event === "open_activation_window" &&
    !isBoundedActivationWindow(options.activation_window_ms)
  ) {
    return failure(currentState, event, "invalid_transition");
  }

  const nextState = TRANSITIONS[currentState]?.[event];
  if (!nextState) return failure(currentState, event, "invalid_transition");

  return {
    ok: true,
    previous_state: currentState,
    event,
    next_state: nextState,
    ...(event === "open_activation_window"
      ? { activation_window_ms: options.activation_window_ms }
      : {}),
    metadata_only: true,
  };
}

const TRANSITIONS: Partial<
  Record<
    WakeWordLifecycleState,
    Partial<Record<WakeWordStateEvent, WakeWordLifecycleState>>
  >
> = {
  disabled: {
    enable: "available",
  },
  available: {
    arm: "armed",
    disable: "disabled",
    fail: "failed",
  },
  armed: {
    begin_detection: "detecting",
    cancel: "cancelled",
    disable: "disabled",
    fail: "failed",
  },
  detecting: {
    wake_detected: "wake_detected",
    expire: "expired",
    cancel: "cancelled",
    fail: "failed",
  },
  wake_detected: {
    open_activation_window: "activation_window",
    cancel: "cancelled",
    fail: "failed",
  },
  activation_window: {
    expire: "expired",
    cancel: "cancelled",
    fail: "failed",
  },
  expired: {
    reset: "available",
    disable: "disabled",
  },
  cancelled: {
    reset: "available",
    disable: "disabled",
  },
  failed: {
    reset: "available",
    disable: "disabled",
  },
};

function failure(
  previousState: WakeWordLifecycleState | null,
  event: WakeWordStateEvent | null,
  reason: "invalid_state" | "invalid_event" | "invalid_transition",
): WakeWordStateTransitionResult {
  return {
    ok: false,
    previous_state: previousState,
    event,
    next_state: null,
    reason,
    metadata_only: true,
  };
}

function isBoundedActivationWindow(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 30_000
  );
}

export function isWakeWordTerminalState(
  value: unknown,
): value is (typeof WAKE_WORD_TERMINAL_STATES)[number] {
  return (
    typeof value === "string" &&
    (WAKE_WORD_TERMINAL_STATES as readonly string[]).includes(value)
  );
}
