import type { VoiceCancellationReason } from "../types";
import type { CaptureDeviceSelection, CapturePermissionState } from "./device";
import {
  canArmCapture,
  type CaptureArmDenialReason,
  type CaptureRuntimeConfig,
} from "./config";
import { transitionCaptureState } from "./state-machine";
import type {
  CaptureErrorClass,
  CaptureLifecycleState,
  CaptureStateEvent,
} from "./types";

export const CAPTURE_SUPERVISOR_TIMEOUT_KINDS = [
  "max_capture",
  "endpoint",
  "silence",
] as const;

export type CaptureSupervisorTimeoutKind =
  (typeof CAPTURE_SUPERVISOR_TIMEOUT_KINDS)[number];

export type CaptureSupervisorOperation =
  | "arm"
  | "startCapture"
  | "endpointDetected"
  | "beginTranscription"
  | "cancel"
  | "fail"
  | "reset"
  | "handleTimeout";

export type CaptureSupervisorFailureReason =
  | CaptureArmDenialReason
  | "active_session_exists"
  | "invalid_transition"
  | "timeout_not_applicable";

export interface CaptureSupervisorSnapshot {
  readonly session_id: string | null;
  readonly turn_id: string | null;
  readonly state: CaptureLifecycleState;
  readonly duration_ms?: number;
  readonly started_at?: string;
  readonly ended_at?: string;
  readonly cancellation_reason?: VoiceCancellationReason;
  readonly error_class?: CaptureErrorClass;
  readonly permission_state: CapturePermissionState;
  readonly selected_device_id: string | null;
  readonly metadata_only: true;
}

export type CaptureSupervisorResult =
  | {
      readonly ok: true;
      readonly operation: CaptureSupervisorOperation;
      readonly snapshot: CaptureSupervisorSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly operation: CaptureSupervisorOperation;
      readonly snapshot: CaptureSupervisorSnapshot;
      readonly reasons: readonly CaptureSupervisorFailureReason[];
      readonly metadata_only: true;
    };

export interface CaptureSupervisorOptions {
  readonly config: CaptureRuntimeConfig;
  readonly selection: CaptureDeviceSelection;
  readonly now_ms?: () => number;
  readonly session_id_factory?: () => string;
  readonly turn_id_factory?: () => string;
}

export interface CaptureSupervisor {
  arm(): CaptureSupervisorResult;
  startCapture(): CaptureSupervisorResult;
  endpointDetected(): CaptureSupervisorResult;
  beginTranscription(): CaptureSupervisorResult;
  cancel(reason: VoiceCancellationReason): CaptureSupervisorResult;
  fail(
    error: CaptureErrorClass | { readonly error_class?: CaptureErrorClass },
  ): CaptureSupervisorResult;
  reset(): CaptureSupervisorResult;
  handleTimeout(kind: CaptureSupervisorTimeoutKind): CaptureSupervisorResult;
  snapshot(): CaptureSupervisorSnapshot;
}

export function createCaptureSupervisor(
  options: CaptureSupervisorOptions,
): CaptureSupervisor {
  const nowMs = options.now_ms ?? (() => Date.now());
  const sessionIdFactory =
    options.session_id_factory ?? (() => `capture-session-${nowMs()}`);
  const turnIdFactory =
    options.turn_id_factory ?? (() => `capture-turn-${nowMs()}`);
  let startedAtMs: number | null = null;
  let snapshot: CaptureSupervisorSnapshot = idleSnapshot(options);

  const copySnapshot = (): CaptureSupervisorSnapshot => ({ ...snapshot });

  const result = (
    ok: boolean,
    operation: CaptureSupervisorOperation,
    reasons: readonly CaptureSupervisorFailureReason[] = [],
  ): CaptureSupervisorResult =>
    ok
      ? {
          ok: true,
          operation,
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        }
      : {
          ok: false,
          operation,
          snapshot: copySnapshot(),
          reasons,
          metadata_only: true,
        };

  const applyEvent = (
    operation: CaptureSupervisorOperation,
    event: CaptureStateEvent,
  ): CaptureSupervisorResult => {
    const transition = transitionCaptureState(snapshot.state, event);
    if (!transition.ok) {
      return result(false, operation, ["invalid_transition"]);
    }
    snapshot = {
      ...snapshot,
      state: transition.next_state,
      ...(isTerminalState(transition.next_state)
        ? endMetadata(nowMs(), startedAtMs)
        : {}),
    };
    return result(true, operation);
  };

  return {
    arm: () => {
      if (isActiveState(snapshot.state)) {
        return result(false, "arm", ["active_session_exists"]);
      }
      const decision = canArmCapture({
        config: options.config,
        selection: options.selection,
      });
      if (!decision.allowed) {
        return result(false, "arm", decision.reasons);
      }
      const transition = transitionCaptureState(snapshot.state, "arm");
      if (!transition.ok) {
        return result(false, "arm", ["invalid_transition"]);
      }

      startedAtMs = nowMs();
      snapshot = {
        session_id: sessionIdFactory(),
        turn_id: turnIdFactory(),
        state: transition.next_state,
        started_at: timestamp(startedAtMs),
        permission_state: options.selection.permission_state,
        selected_device_id: decision.device_id,
        metadata_only: true,
      };
      return result(true, "arm");
    },
    startCapture: () => applyEvent("startCapture", "start_capture"),
    endpointDetected: () => applyEvent("endpointDetected", "endpoint_detected"),
    beginTranscription: () =>
      applyEvent("beginTranscription", "begin_transcription"),
    cancel: (reason) => {
      const transition = transitionCaptureState(snapshot.state, "cancel");
      if (!transition.ok) {
        return result(false, "cancel", ["invalid_transition"]);
      }
      snapshot = {
        ...snapshot,
        state: transition.next_state,
        cancellation_reason: reason,
        ...endMetadata(nowMs(), startedAtMs),
      };
      return result(true, "cancel");
    },
    fail: (error) => {
      const transition = transitionCaptureState(snapshot.state, "fail");
      if (!transition.ok) {
        return result(false, "fail", ["invalid_transition"]);
      }
      snapshot = {
        ...snapshot,
        state: transition.next_state,
        error_class: normalizeErrorClass(error),
        ...endMetadata(nowMs(), startedAtMs),
      };
      return result(true, "fail");
    },
    reset: () => {
      const transition = transitionCaptureState(snapshot.state, "reset");
      if (!transition.ok) {
        return result(false, "reset", ["invalid_transition"]);
      }
      startedAtMs = null;
      snapshot = idleSnapshot(options);
      return result(true, "reset");
    },
    handleTimeout: (kind) => {
      if (kind === "silence") {
        if (snapshot.state !== "capturing") {
          return result(false, "handleTimeout", ["timeout_not_applicable"]);
        }
        return applyEvent("handleTimeout", "endpoint_detected");
      }
      if (
        kind === "max_capture" &&
        (snapshot.state === "arming" ||
          snapshot.state === "capturing" ||
          snapshot.state === "endpoint_detected" ||
          snapshot.state === "transcribing")
      ) {
        return timeoutFailure();
      }
      if (kind === "endpoint" && snapshot.state === "endpoint_detected") {
        return timeoutFailure();
      }
      return result(false, "handleTimeout", ["timeout_not_applicable"]);
    },
    snapshot: copySnapshot,
  };

  function timeoutFailure(): CaptureSupervisorResult {
    const transition = transitionCaptureState(snapshot.state, "fail");
    if (!transition.ok) {
      return result(false, "handleTimeout", ["invalid_transition"]);
    }
    snapshot = {
      ...snapshot,
      state: transition.next_state,
      error_class: "timeout",
      ...endMetadata(nowMs(), startedAtMs),
    };
    return result(true, "handleTimeout");
  }
}

function idleSnapshot(
  options: Pick<CaptureSupervisorOptions, "config" | "selection">,
): CaptureSupervisorSnapshot {
  return {
    session_id: null,
    turn_id: null,
    state: "idle",
    permission_state: options.selection.permission_state,
    selected_device_id: options.config.selected_device_id,
    metadata_only: true,
  };
}

function isActiveState(state: CaptureLifecycleState): boolean {
  return (
    state === "arming" ||
    state === "capturing" ||
    state === "endpoint_detected" ||
    state === "transcribing"
  );
}

function isTerminalState(state: CaptureLifecycleState): boolean {
  return state === "cancelled" || state === "failed";
}

function endMetadata(now: number, startedAtMs: number | null) {
  return {
    ended_at: timestamp(now),
    ...(startedAtMs === null
      ? {}
      : { duration_ms: Math.max(0, now - startedAtMs) }),
  };
}

function normalizeErrorClass(
  error: CaptureErrorClass | { readonly error_class?: CaptureErrorClass },
): CaptureErrorClass {
  if (typeof error === "string") return error;
  return error.error_class ?? "unknown";
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}
