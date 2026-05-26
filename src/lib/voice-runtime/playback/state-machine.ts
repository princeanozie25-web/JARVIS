import {
  PLAYBACK_LIFECYCLE_STATES,
  PLAYBACK_STATE_EVENTS,
  type PlaybackLifecycleState,
  type PlaybackStateEvent,
  type PlaybackStateTransitionResult,
} from "./types";

const PLAYBACK_TRANSITIONS: Record<
  PlaybackLifecycleState,
  Partial<Record<PlaybackStateEvent, PlaybackLifecycleState>>
> = {
  idle: {
    enqueue: "queueing",
  },
  queueing: {
    begin_synthesis: "synthesizing",
    interrupt: "interrupted",
    fail: "failed",
  },
  synthesizing: {
    begin_playback: "playing",
    interrupt: "interrupted",
    fail: "failed",
  },
  playing: {
    complete: "completed",
    interrupt: "interrupted",
    fail: "failed",
  },
  interrupted: {
    reset: "idle",
  },
  completed: {
    reset: "idle",
  },
  failed: {
    reset: "idle",
  },
};

export function transitionPlaybackState(
  currentState: unknown,
  event: unknown,
): PlaybackStateTransitionResult {
  if (!isPlaybackLifecycleState(currentState)) {
    return {
      ok: false,
      previous_state: null,
      event: isPlaybackStateEvent(event) ? event : null,
      next_state: null,
      reason: "invalid_state",
      metadata_only: true,
    };
  }

  if (!isPlaybackStateEvent(event)) {
    return {
      ok: false,
      previous_state: currentState,
      event: null,
      next_state: currentState,
      reason: "invalid_event",
      metadata_only: true,
    };
  }

  const nextState = PLAYBACK_TRANSITIONS[currentState][event];
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

export function isPlaybackLifecycleState(
  value: unknown,
): value is PlaybackLifecycleState {
  return (
    typeof value === "string" &&
    (PLAYBACK_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function isPlaybackStateEvent(
  value: unknown,
): value is PlaybackStateEvent {
  return (
    typeof value === "string" &&
    (PLAYBACK_STATE_EVENTS as readonly string[]).includes(value)
  );
}
