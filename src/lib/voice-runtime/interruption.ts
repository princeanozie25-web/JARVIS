import {
  VOICE_CANCELLATION_REASONS,
  type VoiceCancellationReason as BaseVoiceCancellationReason,
} from "./types";

export const VOICE_INTERRUPTION_TARGETS = [
  "capture",
  "stt",
  "runtime",
  "tts",
  "playback",
  "queue",
] as const;

export const VOICE_CANCELLATION_SCOPES = [
  "cancel_capture",
  "cancel_stt",
  "cancel_runtime",
  "cancel_tts",
  "cancel_playback",
  "clear_queue",
  "full_turn_interrupt",
] as const;

export const VOICE_INTERRUPTION_ERROR_CLASSES = [
  "invalid_event",
  "invalid_target",
  "invalid_scope",
  "invalid_reason",
  "target_scope_mismatch",
  "unsafe_payload",
] as const;

export type VoiceInterruptionTarget =
  (typeof VOICE_INTERRUPTION_TARGETS)[number];
export type VoiceCancellationScope = (typeof VOICE_CANCELLATION_SCOPES)[number];
export type VoiceCancellationReason = BaseVoiceCancellationReason;
export type VoiceInterruptionErrorClass =
  (typeof VOICE_INTERRUPTION_ERROR_CLASSES)[number];

export interface VoiceInterruptionEvent {
  readonly interruption_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly target: VoiceInterruptionTarget;
  readonly scope: VoiceCancellationScope;
  readonly reason: VoiceCancellationReason;
  readonly created_at: number;
  readonly metadata_only: true;
}

export interface VoiceCancellationPlan extends VoiceInterruptionEvent {
  readonly targets: readonly VoiceInterruptionTarget[];
  readonly scopes: readonly Exclude<
    VoiceCancellationScope,
    "full_turn_interrupt"
  >[];
}

export interface VoiceInterruptionSnapshot {
  readonly interruption_id: string | null;
  readonly turn_id: string | null;
  readonly session_id: string | null;
  readonly target: VoiceInterruptionTarget | null;
  readonly scope: VoiceCancellationScope | null;
  readonly reason: VoiceCancellationReason | null;
  readonly created_at: number | null;
  readonly planned_targets: readonly VoiceInterruptionTarget[];
  readonly planned_scopes: readonly Exclude<
    VoiceCancellationScope,
    "full_turn_interrupt"
  >[];
  readonly applied: boolean;
  readonly degraded: boolean;
  readonly error_class?: VoiceInterruptionErrorClass;
  readonly metadata_only: true;
}

export type VoiceInterruptionResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly snapshot: VoiceInterruptionSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly snapshot: VoiceInterruptionSnapshot;
      readonly reasons: readonly VoiceInterruptionErrorClass[];
      readonly metadata_only: true;
    };

const SINGLE_SCOPE_TARGETS: Record<
  Exclude<VoiceCancellationScope, "full_turn_interrupt">,
  VoiceInterruptionTarget
> = {
  cancel_capture: "capture",
  cancel_stt: "stt",
  cancel_runtime: "runtime",
  cancel_tts: "tts",
  cancel_playback: "playback",
  clear_queue: "queue",
};

const FULL_TURN_SCOPES = [
  "cancel_capture",
  "cancel_stt",
  "cancel_runtime",
  "cancel_tts",
  "cancel_playback",
  "clear_queue",
] as const satisfies readonly Exclude<
  VoiceCancellationScope,
  "full_turn_interrupt"
>[];

const FULL_TURN_TARGETS = [
  "capture",
  "stt",
  "runtime",
  "tts",
  "playback",
  "queue",
] as const satisfies readonly VoiceInterruptionTarget[];

const EVENT_KEYS = [
  "interruption_id",
  "session_id",
  "turn_id",
  "target",
  "scope",
  "reason",
  "created_at",
  "metadata_only",
] as const;

const PLAN_KEYS = [...EVENT_KEYS, "targets", "scopes"] as const;

const SNAPSHOT_KEYS = [
  "interruption_id",
  "turn_id",
  "session_id",
  "target",
  "scope",
  "reason",
  "created_at",
  "planned_targets",
  "planned_scopes",
  "applied",
  "degraded",
  "metadata_only",
] as const;

const FORBIDDEN_KEYS = [
  "transcript",
  "raw_transcript",
  "prompt",
  "response",
  "assistant_text",
  "model_output",
  "tool_output",
  "approval_text",
  "raw_audio",
  "audio",
  "audio_bytes",
  "waveform",
  "pcm",
  "approved_action",
  "external_action",
  "action_payload",
] as const;

export function createVoiceInterruption(
  input: unknown,
): VoiceInterruptionResult<VoiceInterruptionEvent> {
  const parsed = parseEvent(input);
  if (!parsed.ok) return failure(parsed.reasons, parsed.snapshot);
  return success(parsed.value, snapshotFromEvent(parsed.value, false));
}

export function createVoiceCancellationPlan(
  input: unknown,
): VoiceInterruptionResult<VoiceCancellationPlan> {
  const existingPlan = parsePlan(input);
  if (existingPlan.ok) {
    return success(
      existingPlan.value,
      snapshotFromPlan(existingPlan.value, false),
    );
  }
  if (existingPlan.reasons[0] === "unsafe_payload") {
    return failure(existingPlan.reasons, existingPlan.snapshot);
  }

  const event = createVoiceInterruption(input);
  if (!event.ok) return failure(event.reasons, event.snapshot);

  const plan = expandPlan(event.value);
  return success(plan, snapshotFromPlan(plan, false));
}

export function applyVoiceInterruption(
  input: unknown,
): VoiceInterruptionResult<VoiceInterruptionSnapshot> {
  const plan = createVoiceCancellationPlan(input);
  if (!plan.ok) return failure(plan.reasons, plan.snapshot);

  const snapshot = snapshotFromPlan(plan.value, true);
  return success(snapshot, snapshot);
}

export function snapshotVoiceInterruption(
  input: unknown,
): VoiceInterruptionResult<VoiceInterruptionSnapshot> {
  const snapshot = parseSnapshot(input);
  if (snapshot.ok) return success(snapshot.value, snapshot.value);

  const plan = createVoiceCancellationPlan(input);
  if (!plan.ok) return failure(plan.reasons, plan.snapshot);

  const value = snapshotFromPlan(plan.value, false);
  return success(value, value);
}

export function isVoiceInterruptionTarget(
  value: unknown,
): value is VoiceInterruptionTarget {
  return (
    typeof value === "string" &&
    (VOICE_INTERRUPTION_TARGETS as readonly string[]).includes(value)
  );
}

export function isVoiceCancellationScope(
  value: unknown,
): value is VoiceCancellationScope {
  return (
    typeof value === "string" &&
    (VOICE_CANCELLATION_SCOPES as readonly string[]).includes(value)
  );
}

function parseEvent(
  input: unknown,
): VoiceInterruptionResult<VoiceInterruptionEvent> {
  if (!isRecord(input)) return failure(["invalid_event"]);
  if (hasForbiddenKeys(input)) return failure(["unsafe_payload"]);
  if (!hasExactKeys(input, EVENT_KEYS)) return failure(["invalid_event"]);
  if (!isVoiceInterruptionTarget(input.target)) {
    return failure(["invalid_target"]);
  }
  if (!isVoiceCancellationScope(input.scope)) {
    return failure(["invalid_scope"]);
  }
  if (!isVoiceCancellationReason(input.reason)) {
    return failure(["invalid_reason"]);
  }
  if (!isNonEmptyString(input.interruption_id)) {
    return failure(["invalid_event"]);
  }
  if (!isNonEmptyString(input.session_id)) return failure(["invalid_event"]);
  if (!isNonEmptyString(input.turn_id)) return failure(["invalid_event"]);
  if (!isFiniteTimestamp(input.created_at)) return failure(["invalid_event"]);
  if (input.metadata_only !== true) return failure(["invalid_event"]);
  if (!scopeMatchesTarget(input.scope, input.target)) {
    return failure(["target_scope_mismatch"]);
  }

  return success(
    {
      interruption_id: input.interruption_id,
      session_id: input.session_id,
      turn_id: input.turn_id,
      target: input.target,
      scope: input.scope,
      reason: input.reason,
      created_at: input.created_at,
      metadata_only: true,
    },
    emptySnapshot(),
  );
}

function parsePlan(
  input: unknown,
): VoiceInterruptionResult<VoiceCancellationPlan> {
  if (!isRecord(input)) return failure(["invalid_event"]);
  if (hasForbiddenKeys(input)) return failure(["unsafe_payload"]);
  if (!hasExactKeys(input, PLAN_KEYS)) return failure(["invalid_event"]);

  const event = parseEvent(pickEvent(input));
  if (!event.ok) return failure(event.reasons, event.snapshot);

  const expected = expandPlan(event.value);
  if (
    !sameStringArray(input.targets, expected.targets) ||
    !sameStringArray(input.scopes, expected.scopes)
  ) {
    return failure(["invalid_event"]);
  }
  return success(expected, snapshotFromPlan(expected, false));
}

function parseSnapshot(
  input: unknown,
): VoiceInterruptionResult<VoiceInterruptionSnapshot> {
  if (!isRecord(input)) return failure(["invalid_event"]);
  if (hasForbiddenKeys(input)) return failure(["unsafe_payload"]);
  if (!hasExactKeys(input, SNAPSHOT_KEYS)) return failure(["invalid_event"]);
  if (
    input.interruption_id !== null &&
    !isNonEmptyString(input.interruption_id)
  ) {
    return failure(["invalid_event"]);
  }
  if (input.turn_id !== null && !isNonEmptyString(input.turn_id)) {
    return failure(["invalid_event"]);
  }
  if (input.session_id !== null && !isNonEmptyString(input.session_id)) {
    return failure(["invalid_event"]);
  }
  if (input.target !== null && !isVoiceInterruptionTarget(input.target)) {
    return failure(["invalid_target"]);
  }
  if (input.scope !== null && !isVoiceCancellationScope(input.scope)) {
    return failure(["invalid_scope"]);
  }
  if (input.reason !== null && !isVoiceCancellationReason(input.reason)) {
    return failure(["invalid_reason"]);
  }
  if (input.created_at !== null && !isFiniteTimestamp(input.created_at)) {
    return failure(["invalid_event"]);
  }
  if (!isTargetArray(input.planned_targets)) {
    return failure(["invalid_target"]);
  }
  if (!isScopeArray(input.planned_scopes)) return failure(["invalid_scope"]);
  if (typeof input.applied !== "boolean") return failure(["invalid_event"]);
  if (typeof input.degraded !== "boolean") return failure(["invalid_event"]);
  if (input.metadata_only !== true) return failure(["invalid_event"]);

  return success(
    {
      interruption_id: input.interruption_id,
      turn_id: input.turn_id,
      session_id: input.session_id,
      target: input.target,
      scope: input.scope,
      reason: input.reason,
      created_at: input.created_at,
      planned_targets: [...input.planned_targets],
      planned_scopes: [...input.planned_scopes],
      applied: input.applied,
      degraded: input.degraded,
      metadata_only: true,
    },
    emptySnapshot(),
  );
}

function expandPlan(event: VoiceInterruptionEvent): VoiceCancellationPlan {
  if (event.scope === "full_turn_interrupt") {
    return {
      ...event,
      targets: [...FULL_TURN_TARGETS],
      scopes: [...FULL_TURN_SCOPES],
    };
  }

  return {
    ...event,
    targets: [SINGLE_SCOPE_TARGETS[event.scope]],
    scopes: [event.scope],
  };
}

function snapshotFromEvent(
  event: VoiceInterruptionEvent,
  applied: boolean,
): VoiceInterruptionSnapshot {
  return snapshotFromPlan(expandPlan(event), applied);
}

function snapshotFromPlan(
  plan: VoiceCancellationPlan,
  applied: boolean,
): VoiceInterruptionSnapshot {
  return {
    interruption_id: plan.interruption_id,
    turn_id: plan.turn_id,
    session_id: plan.session_id,
    target: plan.target,
    scope: plan.scope,
    reason: plan.reason,
    created_at: plan.created_at,
    planned_targets: [...plan.targets],
    planned_scopes: [...plan.scopes],
    applied,
    degraded: false,
    metadata_only: true,
  };
}

function scopeMatchesTarget(
  scope: VoiceCancellationScope,
  target: VoiceInterruptionTarget,
): boolean {
  return (
    scope === "full_turn_interrupt" || SINGLE_SCOPE_TARGETS[scope] === target
  );
}

function pickEvent(
  record: Record<string, unknown>,
): Record<(typeof EVENT_KEYS)[number], unknown> {
  return {
    interruption_id: record.interruption_id,
    session_id: record.session_id,
    turn_id: record.turn_id,
    target: record.target,
    scope: record.scope,
    reason: record.reason,
    created_at: record.created_at,
    metadata_only: record.metadata_only,
  };
}

function success<T>(
  value: T,
  snapshot: VoiceInterruptionSnapshot,
): VoiceInterruptionResult<T> {
  return {
    ok: true,
    value: copyValue(value),
    snapshot: copySnapshot(snapshot),
    reasons: [],
    metadata_only: true,
  };
}

function failure<T = never>(
  reasons: readonly VoiceInterruptionErrorClass[],
  snapshot: VoiceInterruptionSnapshot = emptySnapshot(reasons[0]),
): VoiceInterruptionResult<T> {
  return {
    ok: false,
    value: null,
    snapshot: copySnapshot(snapshot),
    reasons,
    metadata_only: true,
  };
}

function emptySnapshot(
  errorClass?: VoiceInterruptionErrorClass,
): VoiceInterruptionSnapshot {
  return {
    interruption_id: null,
    turn_id: null,
    session_id: null,
    target: null,
    scope: null,
    reason: null,
    created_at: null,
    planned_targets: [],
    planned_scopes: [],
    applied: false,
    degraded: Boolean(errorClass),
    ...(errorClass ? { error_class: errorClass } : {}),
    metadata_only: true,
  };
}

function copySnapshot(
  snapshot: VoiceInterruptionSnapshot,
): VoiceInterruptionSnapshot {
  return {
    ...snapshot,
    planned_targets: [...snapshot.planned_targets],
    planned_scopes: [...snapshot.planned_scopes],
  };
}

function copyValue<T>(value: T): T {
  if (isPlanLike(value)) {
    return {
      ...value,
      targets: [...value.targets],
      scopes: [...value.scopes],
    } as T;
  }
  if (isSnapshotLike(value)) {
    return copySnapshot(value) as T;
  }
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value;
}

function isPlanLike(value: unknown): value is VoiceCancellationPlan {
  return (
    isRecord(value) &&
    Array.isArray(value.targets) &&
    Array.isArray(value.scopes)
  );
}

function isSnapshotLike(value: unknown): value is VoiceInterruptionSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.planned_targets) &&
    Array.isArray(value.planned_scopes)
  );
}

function isVoiceCancellationReason(
  value: unknown,
): value is VoiceCancellationReason {
  return (
    typeof value === "string" &&
    (VOICE_CANCELLATION_REASONS as readonly string[]).includes(value)
  );
}

function isTargetArray(
  value: unknown,
): value is readonly VoiceInterruptionTarget[] {
  return Array.isArray(value) && value.every(isVoiceInterruptionTarget);
}

function isScopeArray(
  value: unknown,
): value is readonly Exclude<VoiceCancellationScope, "full_turn_interrupt">[] {
  return (
    Array.isArray(value) &&
    value.every(
      (scope) =>
        isVoiceCancellationScope(scope) && scope !== "full_turn_interrupt",
    )
  );
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function hasForbiddenKeys(value: Record<string, unknown>): boolean {
  return FORBIDDEN_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}
