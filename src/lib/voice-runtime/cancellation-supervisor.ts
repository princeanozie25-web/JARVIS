import {
  createVoiceCancellationPlan,
  type VoiceCancellationPlan,
  type VoiceCancellationScope,
  type VoiceInterruptionErrorClass,
  type VoiceInterruptionSnapshot,
  type VoiceInterruptionTarget,
} from "./interruption";
import type { VoiceCancellationReason } from "./types";
import type { SttCancellationReason } from "./stt";
import type { TtsCancellationReason } from "./tts";
import type {
  VoiceRuntimeAdapterFailureClass,
  VoiceRuntimeAdapterOptions,
} from "./runtime-adapter";

export type VoiceCancellationSupervisorFailureReason =
  | VoiceInterruptionErrorClass
  | "target_unavailable"
  | "target_failed";

export interface VoiceCancellationSupervisorApplyOptions {
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface VoiceCancellationTargetResult {
  readonly target: VoiceInterruptionTarget;
  readonly scope: Exclude<VoiceCancellationScope, "full_turn_interrupt">;
  readonly applied: boolean;
  readonly cancelled: boolean;
  readonly degraded: boolean;
  readonly error_class?: VoiceCancellationSupervisorFailureReason;
  readonly completed_at: number;
  readonly metadata_only: true;
}

export interface VoiceCancellationSupervisorSnapshot {
  readonly interruption_id: string | null;
  readonly turn_id: string | null;
  readonly session_id: string | null;
  readonly applied: boolean;
  readonly degraded: boolean;
  readonly target_results: readonly VoiceCancellationTargetResult[];
  readonly last_error_class?: VoiceCancellationSupervisorFailureReason;
  readonly metadata_only: true;
}

export type VoiceCancellationSupervisorResult =
  | {
      readonly ok: true;
      readonly plan: VoiceCancellationPlan;
      readonly target_results: readonly VoiceCancellationTargetResult[];
      readonly snapshot: VoiceCancellationSupervisorSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly plan: null;
      readonly target_results: readonly [];
      readonly snapshot: VoiceCancellationSupervisorSnapshot;
      readonly reasons: readonly VoiceCancellationSupervisorFailureReason[];
      readonly metadata_only: true;
    };

export interface VoiceCancellationCaptureTarget {
  cancel(
    reason: VoiceCancellationReason,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationSttTarget {
  cancel(
    reason: SttCancellationReason,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationRuntimeTarget {
  cancel(
    reason: VoiceRuntimeAdapterFailureClass,
    options?: VoiceRuntimeAdapterOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationTtsTarget {
  cancel(
    reason: TtsCancellationReason,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationPlaybackTarget {
  interrupt(
    reason: string,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationQueueTarget {
  clear(
    reason: string,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): unknown | Promise<unknown>;
}

export interface VoiceCancellationSupervisorTargets {
  readonly capture?: VoiceCancellationCaptureTarget;
  readonly stt?: VoiceCancellationSttTarget;
  readonly runtime?: VoiceCancellationRuntimeTarget;
  readonly tts?: VoiceCancellationTtsTarget;
  readonly playback?: VoiceCancellationPlaybackTarget;
  readonly queue?: VoiceCancellationQueueTarget;
}

export interface VoiceCancellationSupervisorOptions {
  readonly targets?: VoiceCancellationSupervisorTargets;
  readonly now_ms?: () => number;
}

export interface VoiceCancellationSupervisor {
  applyInterruption(
    event: unknown,
    options?: VoiceCancellationSupervisorApplyOptions,
  ): Promise<VoiceCancellationSupervisorResult>;
  snapshot(): VoiceCancellationSupervisorSnapshot;
}

export function createVoiceCancellationSupervisor(
  options: VoiceCancellationSupervisorOptions = {},
): VoiceCancellationSupervisor {
  const nowMs = options.now_ms ?? (() => Date.now());
  const targets = options.targets ?? {};
  let snapshot = emptySnapshot();

  const copySnapshot = (): VoiceCancellationSupervisorSnapshot => ({
    ...snapshot,
    target_results: snapshot.target_results.map(copyTargetResult),
  });

  return {
    applyInterruption: async (event, applyOptions) => {
      const planResult = createVoiceCancellationPlan(event);
      if (!planResult.ok) {
        snapshot = failureSnapshot(
          planResult.snapshot,
          planResult.reasons[0] ?? "invalid_event",
        );
        return {
          ok: false,
          plan: null,
          target_results: [],
          snapshot: copySnapshot(),
          reasons: planResult.reasons,
          metadata_only: true,
        };
      }

      const plan = planResult.value;
      const targetResults: VoiceCancellationTargetResult[] = [];
      for (const scope of plan.scopes) {
        targetResults.push(await applyScope(plan, scope, applyOptions));
      }

      const degraded = targetResults.some((result) => result.degraded);
      snapshot = {
        interruption_id: plan.interruption_id,
        turn_id: plan.turn_id,
        session_id: plan.session_id,
        applied: true,
        degraded,
        target_results: targetResults.map(copyTargetResult),
        ...(degraded
          ? {
              last_error_class:
                targetResults.find((result) => result.error_class)
                  ?.error_class ?? "target_failed",
            }
          : {}),
        metadata_only: true,
      };

      return {
        ok: true,
        plan: copyPlan(plan),
        target_results: targetResults.map(copyTargetResult),
        snapshot: copySnapshot(),
        reasons: [],
        metadata_only: true,
      };
    },
    snapshot: copySnapshot,
  };

  async function applyScope(
    plan: VoiceCancellationPlan,
    scope: Exclude<VoiceCancellationScope, "full_turn_interrupt">,
    applyOptions: VoiceCancellationSupervisorApplyOptions | undefined,
  ): Promise<VoiceCancellationTargetResult> {
    const target = targetForScope(scope);
    const targetApi = targets[target];
    if (!targetApi) {
      return targetResult(target, scope, false, false, "target_unavailable");
    }

    try {
      const rawResult = await invokeTarget(
        target,
        scope,
        targetApi,
        plan.reason,
        applyOptions,
      );
      if (isFailureLike(rawResult)) {
        return targetResult(target, scope, true, false, "target_failed");
      }
      return targetResult(target, scope, true, true);
    } catch {
      return targetResult(target, scope, true, false, "target_failed");
    }
  }

  function targetResult(
    target: VoiceInterruptionTarget,
    scope: Exclude<VoiceCancellationScope, "full_turn_interrupt">,
    applied: boolean,
    cancelled: boolean,
    errorClass?: VoiceCancellationSupervisorFailureReason,
  ): VoiceCancellationTargetResult {
    return {
      target,
      scope,
      applied,
      cancelled,
      degraded: Boolean(errorClass),
      ...(errorClass ? { error_class: errorClass } : {}),
      completed_at: nowMs(),
      metadata_only: true,
    };
  }
}

async function invokeTarget(
  target: VoiceInterruptionTarget,
  scope: Exclude<VoiceCancellationScope, "full_turn_interrupt">,
  targetApi: NonNullable<
    VoiceCancellationSupervisorTargets[VoiceInterruptionTarget]
  >,
  reason: VoiceCancellationReason,
  options: VoiceCancellationSupervisorApplyOptions | undefined,
): Promise<unknown> {
  switch (target) {
    case "capture":
      return (targetApi as VoiceCancellationCaptureTarget).cancel(
        reason,
        options,
      );
    case "stt":
      return (targetApi as VoiceCancellationSttTarget).cancel(
        mapProviderReason(reason),
        options,
      );
    case "runtime":
      return (targetApi as VoiceCancellationRuntimeTarget).cancel(
        mapRuntimeReason(reason),
        options,
      );
    case "tts":
      return (targetApi as VoiceCancellationTtsTarget).cancel(
        mapProviderReason(reason),
        options,
      );
    case "playback":
      return (targetApi as VoiceCancellationPlaybackTarget).interrupt(
        reason,
        options,
      );
    case "queue":
      return (targetApi as VoiceCancellationQueueTarget).clear(scope, options);
  }
}

function targetForScope(
  scope: Exclude<VoiceCancellationScope, "full_turn_interrupt">,
): VoiceInterruptionTarget {
  switch (scope) {
    case "cancel_capture":
      return "capture";
    case "cancel_stt":
      return "stt";
    case "cancel_runtime":
      return "runtime";
    case "cancel_tts":
      return "tts";
    case "cancel_playback":
      return "playback";
    case "clear_queue":
      return "queue";
  }
}

function mapProviderReason(
  reason: VoiceCancellationReason,
): SttCancellationReason | TtsCancellationReason {
  switch (reason) {
    case "barge_in":
      return "user_cancelled";
    case "governance_blocked":
      return "policy_blocked";
    case "provider_unavailable":
      return "provider_unavailable";
    case "abort_signal":
    case "timeout":
    case "user_cancelled":
    case "unknown":
      return reason;
  }
}

function mapRuntimeReason(
  reason: VoiceCancellationReason,
): VoiceRuntimeAdapterFailureClass {
  switch (reason) {
    case "provider_unavailable":
      return "unavailable";
    case "governance_blocked":
      return "policy_blocked";
    case "unknown":
      return "unknown";
    case "barge_in":
    case "abort_signal":
    case "timeout":
    case "user_cancelled":
      return "cancelled";
  }
}

function isFailureLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { readonly ok?: unknown }).ok === false
  );
}

function failureSnapshot(
  interruptionSnapshot: VoiceInterruptionSnapshot,
  errorClass: VoiceCancellationSupervisorFailureReason,
): VoiceCancellationSupervisorSnapshot {
  return {
    interruption_id: interruptionSnapshot.interruption_id,
    turn_id: interruptionSnapshot.turn_id,
    session_id: interruptionSnapshot.session_id,
    applied: false,
    degraded: true,
    target_results: [],
    last_error_class: errorClass,
    metadata_only: true,
  };
}

function emptySnapshot(): VoiceCancellationSupervisorSnapshot {
  return {
    interruption_id: null,
    turn_id: null,
    session_id: null,
    applied: false,
    degraded: false,
    target_results: [],
    metadata_only: true,
  };
}

function copyPlan(plan: VoiceCancellationPlan): VoiceCancellationPlan {
  return {
    ...plan,
    targets: [...plan.targets],
    scopes: [...plan.scopes],
  };
}

function copyTargetResult(
  result: VoiceCancellationTargetResult,
): VoiceCancellationTargetResult {
  return { ...result };
}
