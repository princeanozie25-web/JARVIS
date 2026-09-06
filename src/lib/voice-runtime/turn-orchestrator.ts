import {
  createVoiceCancellationSupervisor,
  type VoiceCancellationSupervisor,
} from "./cancellation-supervisor";
import type { PlaybackQueue, PlaybackQueueResult } from "./playback";
import {
  createVoiceRuntimeBridge,
  type VoiceRuntimeBridge,
} from "./runtime-bridge";
import type {
  VoiceRuntimeAdapter,
  VoiceRuntimeAdapterResponse,
} from "./runtime-adapter";
import type { SttProvider } from "./stt";
import type { VoiceEngineTelemetrySink } from "@/lib/voice/tts-engine";
import type { TtsContentClass, TtsProvider } from "./tts";
import type { VoiceCancellationReason } from "./types";

export type VoiceTurnPhase =
  | "idle"
  | "transcribing"
  | "executing_runtime"
  | "synthesizing"
  | "queued_for_playback"
  | "failed"
  | "cancelled"
  | "interrupted";

export type VoiceTurnStageStatus =
  | "idle"
  | "running"
  | "complete"
  | "failed"
  | "cancelled";

export type VoiceTurnFailureReason =
  | "malformed_capture"
  | "stt_unavailable"
  | "stt_failed"
  | "runtime_unavailable"
  | "runtime_failed"
  | "runtime_cancelled"
  | "tts_unavailable"
  | "tts_failed"
  | "unsafe_content"
  | "enqueue_failed"
  | "cancelled"
  | "interruption_failed";

export type VoiceTurnInterruptionStatus =
  | "idle"
  | "not_required"
  | "interrupting"
  | "interrupted"
  | "failed";

export interface VoiceTurnSnapshot {
  readonly turn_id: string | null;
  readonly session_id: string | null;
  readonly phase: VoiceTurnPhase;
  readonly stt_status: VoiceTurnStageStatus;
  readonly runtime_status: VoiceTurnStageStatus;
  readonly tts_status: VoiceTurnStageStatus;
  readonly playback_status: VoiceTurnStageStatus;
  readonly playback_queue_depth: number;
  readonly active_turn_id?: string | null;
  readonly interrupted_turn_id?: string | null;
  readonly interruption_status?: VoiceTurnInterruptionStatus;
  readonly cancellation_result_count?: number;
  readonly stale_completion_count?: number;
  readonly degraded: boolean;
  readonly error_class?: VoiceTurnFailureReason;
  readonly metadata_only: true;
}

export interface VoiceTurnResultMetadata {
  readonly session_id: string;
  readonly turn_id: string;
  readonly runtime_response_id: string;
  readonly runtime_latency_ms: number;
  readonly runtime_provider_id: string | null;
  readonly runtime_finish_reason: string;
  readonly playback_item_id: string;
  readonly playback_queue_depth: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export type VoiceTurnResult =
  | {
      readonly ok: true;
      readonly value: VoiceTurnResultMetadata | null;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly VoiceTurnFailureReason[];
      readonly metadata_only: true;
    };

export interface VoiceTurnRunOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly requested_voice_id?: string;
  readonly assistant_content_class?: TtsContentClass;
  readonly metadata_only: true;
}

export interface VoiceTurnInterruptionOptions {
  readonly interruption_id?: string;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface VoiceTurnInterruptionMetadata {
  readonly active_turn_id: string | null;
  readonly interrupted_turn_id: string | null;
  readonly interruption_status: VoiceTurnInterruptionStatus;
  readonly cancellation_result_count: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export type VoiceTurnInterruptionResult =
  | {
      readonly ok: true;
      readonly value: VoiceTurnInterruptionMetadata;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly VoiceTurnFailureReason[];
      readonly metadata_only: true;
    };

export interface VoiceTurnOrchestratorOptions {
  readonly stt_provider: SttProvider;
  readonly runtime_adapter: VoiceRuntimeAdapter;
  readonly tts_provider: TtsProvider;
  readonly playback_queue: PlaybackQueue;
  /** E-012: live failover chain + audit sink, threaded to the bridge. */
  readonly fallback_tts_providers?: readonly TtsProvider[];
  readonly failover_telemetry?: VoiceEngineTelemetrySink;
  readonly cancellation_supervisor?: VoiceCancellationSupervisor;
  readonly now_ms?: () => number;
  readonly interruption_id_factory?: () => string;
}

export interface VoiceTurnOrchestrator {
  runVoiceTurn(
    captureMetadata: unknown,
    options?: VoiceTurnRunOptions,
  ): Promise<VoiceTurnResult>;
  interruptActiveTurn(
    reason: VoiceCancellationReason,
    options?: VoiceTurnInterruptionOptions,
  ): Promise<VoiceTurnInterruptionResult>;
  beginNewTurnWithInterruption(
    captureMetadata: unknown,
    options?: VoiceTurnRunOptions & {
      readonly interruption_reason?: VoiceCancellationReason;
    },
  ): Promise<VoiceTurnResult>;
  reset(): VoiceTurnResult;
  snapshot(): VoiceTurnSnapshot;
}

export function createVoiceTurnOrchestrator(
  options: VoiceTurnOrchestratorOptions,
): VoiceTurnOrchestrator {
  const nowMs = options.now_ms ?? (() => Date.now());
  const interruptionIdFactory =
    options.interruption_id_factory ?? (() => `voice-interruption-${nowMs()}`);
  const cancellationSupervisor =
    options.cancellation_supervisor ??
    createVoiceCancellationSupervisor({
      targets: {
        stt: options.stt_provider,
        runtime: options.runtime_adapter,
        tts: options.tts_provider,
        queue: options.playback_queue,
      },
      now_ms: nowMs,
    });
  let snapshot: VoiceTurnSnapshot = idleSnapshot(options.playback_queue);
  let nextRunId = 0;
  let activeRunId: number | null = null;
  let activeAcceptedTurnId: string | null = null;
  let activeAbortSignal: AbortSignal | null = null;
  let staleCompletionCount = 0;
  let interruptionInFlight: Promise<VoiceTurnInterruptionResult> | null = null;
  const interruptedTurnIds = new Set<string>();

  const copySnapshot = (): VoiceTurnSnapshot => ({ ...snapshot });
  const guardedPlaybackQueue: PlaybackQueue = createGuardedPlaybackQueue();
  const createBridge = (): VoiceRuntimeBridge =>
    createVoiceRuntimeBridge({
      stt_provider: options.stt_provider,
      runtime_adapter: options.runtime_adapter,
      tts_provider: options.tts_provider,
      playback_queue: guardedPlaybackQueue,
      fallback_tts_providers: options.fallback_tts_providers,
      failover_telemetry: options.failover_telemetry,
    });
  let bridge = createBridge();

  const runVoiceTurn: VoiceTurnOrchestrator["runVoiceTurn"] = async (
    captureMetadata,
    runOptions,
  ) => {
    if (runOptions?.abort_signal?.aborted) {
      return fail(["cancelled"], {
        phase: "cancelled",
        stt_status: "cancelled",
        runtime_status: "cancelled",
        tts_status: "cancelled",
        playback_status: "cancelled",
        error_class: "cancelled",
      });
    }

    const ids = readCaptureIds(captureMetadata);
    if (!ids.session_id || !ids.turn_id) {
      return fail(["malformed_capture"], {
        phase: "failed",
        stt_status: "failed",
        error_class: "malformed_capture",
      });
    }
    const runId = ++nextRunId;
    const turnBridge = bridge;
    activeRunId = runId;
    activeAcceptedTurnId = ids.turn_id;
    activeAbortSignal = runOptions?.abort_signal ?? null;
    snapshot = {
      ...snapshot,
      session_id: ids.session_id,
      turn_id: ids.turn_id,
      phase: "transcribing",
      stt_status: "running",
    };
    const sttResult = await turnBridge.ingestCapturedAudio(captureMetadata, {
      timeout_ms: runOptions?.timeout_ms,
      abort_signal: runOptions?.abort_signal,
      metadata_only: true,
    });
    if (!isCurrentRun(runId, ids.turn_id)) {
      return staleCompletionFailure(ids.turn_id);
    }
    if (runOptions?.abort_signal?.aborted) {
      return cancelCurrentRun(runId);
    }
    if (!sttResult.ok) {
      return fail(
        mapFailure(sttResult.reasons[0]),
        {
          phase: "failed",
          stt_status: "failed",
          error_class: mapFailure(sttResult.reasons[0])[0],
        },
        runId,
      );
    }

    snapshot = {
      ...snapshot,
      session_id: sttResult.value.session_id,
      turn_id: sttResult.value.turn_id,
      stt_status: "complete",
      runtime_status: "running",
      phase: "executing_runtime",
      degraded: sttResult.value.degraded,
    };
    const runtimeResult = await turnBridge.executeRuntimeRequest({
      timeout_ms: runOptions?.timeout_ms,
      abort_signal: runOptions?.abort_signal,
      metadata_only: true,
    });
    if (!isCurrentRun(runId, ids.turn_id)) {
      return staleCompletionFailure(ids.turn_id);
    }
    if (runOptions?.abort_signal?.aborted) {
      return cancelCurrentRun(runId);
    }
    if (!runtimeResult.ok) {
      return fail(
        mapFailure(runtimeResult.reasons[0]),
        {
          phase:
            runtimeResult.reasons[0] === "runtime_cancelled"
              ? "cancelled"
              : "failed",
          runtime_status:
            runtimeResult.reasons[0] === "runtime_cancelled"
              ? "cancelled"
              : "failed",
          error_class: mapFailure(runtimeResult.reasons[0])[0],
        },
        runId,
      );
    }

    if (
      runOptions?.assistant_content_class !== undefined &&
      runOptions.assistant_content_class !== "assistant_prose"
    ) {
      return fail(
        ["unsafe_content"],
        {
          phase: "failed",
          runtime_status: "complete",
          error_class: "unsafe_content",
        },
        runId,
      );
    }

    snapshot = {
      ...snapshot,
      runtime_status: "complete",
      tts_status: "running",
      phase: "synthesizing",
      degraded: snapshot.degraded || runtimeResult.value.degraded,
    };
    if (runOptions?.abort_signal?.aborted) {
      return cancelCurrentRun(runId);
    }
    const playbackResult = await createPlaybackRequest(
      turnBridge,
      runtimeResult.value,
      runOptions,
    );
    if (!isCurrentRun(runId, ids.turn_id)) {
      return staleCompletionFailure(ids.turn_id);
    }
    if (runOptions?.abort_signal?.aborted) {
      return cancelCurrentRun(runId);
    }
    if (!playbackResult.ok) {
      return fail(
        mapFailure(playbackResult.reasons[0]),
        {
          phase: "failed",
          tts_status:
            playbackResult.reasons[0] === "tts_failed" ||
            playbackResult.reasons[0] === "tts_unavailable"
              ? "failed"
              : snapshot.tts_status,
          playback_status:
            playbackResult.reasons[0] === "enqueue_failed"
              ? "failed"
              : snapshot.playback_status,
          error_class: mapFailure(playbackResult.reasons[0])[0],
        },
        runId,
      );
    }

    snapshot = {
      ...snapshot,
      tts_status: "complete",
      playback_status: "complete",
      phase: "queued_for_playback",
      playback_queue_depth: playbackResult.value.playback_queue_depth,
      degraded: snapshot.degraded || playbackResult.value.degraded,
    };
    return success({
      session_id: playbackResult.value.session_id,
      turn_id: playbackResult.value.turn_id,
      runtime_response_id: runtimeResult.value.response_id,
      runtime_latency_ms: runtimeResult.value.latency_ms,
      runtime_provider_id: runtimeResult.value.provider_id ?? null,
      runtime_finish_reason: runtimeResult.value.finish_reason,
      playback_item_id: playbackResult.value.item_id,
      playback_queue_depth: playbackResult.value.playback_queue_depth,
      degraded: snapshot.degraded,
      metadata_only: true,
    });
  };

  return {
    runVoiceTurn,
    reset: () => {
      bridge.reset();
      bridge = createBridge();
      activeRunId = null;
      activeAcceptedTurnId = null;
      activeAbortSignal = null;
      staleCompletionCount = 0;
      interruptionInFlight = null;
      interruptedTurnIds.clear();
      snapshot = idleSnapshot(options.playback_queue);
      return success(null);
    },
    interruptActiveTurn: async (reason, interruptionOptions) =>
      interruptActiveTurn(reason, interruptionOptions),
    beginNewTurnWithInterruption: async (captureMetadata, runOptions) => {
      if (isTurnActive(snapshot)) {
        const interruption = await interruptActiveTurn(
          runOptions?.interruption_reason ?? "barge_in",
          {
            abort_signal: runOptions?.abort_signal,
            metadata_only: true,
          },
        );
        if (!interruption.ok) {
          return fail(["interruption_failed"], {
            phase: "failed",
            error_class: "interruption_failed",
            interruption_status: "failed",
          });
        }
      } else {
        snapshot = {
          ...snapshot,
          interruption_status: "not_required",
          cancellation_result_count: 0,
        };
      }

      const ids = readCaptureIds(captureMetadata);
      snapshot = {
        ...snapshot,
        active_turn_id: ids.turn_id,
      };
      return runVoiceTurn(captureMetadata, runOptions);
    },
    snapshot: copySnapshot,
  };

  async function interruptActiveTurn(
    reason: VoiceCancellationReason,
    interruptionOptions: VoiceTurnInterruptionOptions | undefined,
  ): Promise<VoiceTurnInterruptionResult> {
    const activeTurnId = snapshot.active_turn_id ?? snapshot.turn_id;
    if (
      snapshot.interruption_status === "interrupted" &&
      snapshot.interrupted_turn_id
    ) {
      return interruptionSuccess({
        active_turn_id: null,
        interrupted_turn_id: snapshot.interrupted_turn_id,
        interruption_status: "interrupted",
        cancellation_result_count: snapshot.cancellation_result_count ?? 0,
        degraded: snapshot.degraded,
        metadata_only: true,
      });
    }
    if (interruptionInFlight) {
      return interruptionInFlight;
    }
    if (!isTurnActive(snapshot) || !activeTurnId) {
      snapshot = {
        ...snapshot,
        interruption_status: "not_required",
        cancellation_result_count: 0,
      };
      return interruptionSuccess({
        active_turn_id: null,
        interrupted_turn_id: null,
        interruption_status: "not_required",
        cancellation_result_count: 0,
        degraded: false,
        metadata_only: true,
      });
    }

    interruptedTurnIds.add(activeTurnId);
    activeRunId = null;
    activeAcceptedTurnId = null;
    activeAbortSignal = null;
    snapshot = {
      ...snapshot,
      active_turn_id: activeTurnId,
      interruption_status: "interrupting",
    };

    interruptionInFlight = (async () => {
      const result = await cancellationSupervisor.applyInterruption(
        {
          interruption_id:
            interruptionOptions?.interruption_id ?? interruptionIdFactory(),
          session_id: snapshot.session_id ?? "voice-session",
          turn_id: activeTurnId,
          target: "playback",
          scope: "full_turn_interrupt",
          reason,
          created_at: nowMs(),
          metadata_only: true,
        },
        {
          abort_signal: interruptionOptions?.abort_signal,
          metadata_only: true,
        },
      );

      if (!result.ok) {
        snapshot = {
          ...snapshot,
          interruption_status: "failed",
          cancellation_result_count: 0,
          degraded: true,
          error_class: "interruption_failed",
        };
        return interruptionFailure(["interruption_failed"]);
      }

      if (options.playback_queue.snapshot().depth > 0) {
        options.playback_queue.clear("voice_turn_interruption_cleanup");
      }
      bridge = createBridge();
      snapshot = {
        ...snapshot,
        active_turn_id: null,
        interrupted_turn_id: activeTurnId,
        phase: "interrupted",
        stt_status: "cancelled",
        runtime_status: "cancelled",
        tts_status: "cancelled",
        playback_status: "cancelled",
        playback_queue_depth: options.playback_queue.snapshot().depth,
        interruption_status: "interrupted",
        cancellation_result_count: result.target_results.length,
        degraded: snapshot.degraded || result.snapshot.degraded,
      };

      return interruptionSuccess({
        active_turn_id: null,
        interrupted_turn_id: activeTurnId,
        interruption_status: "interrupted",
        cancellation_result_count: result.target_results.length,
        degraded: result.snapshot.degraded,
        metadata_only: true,
      });
    })();

    try {
      return await interruptionInFlight;
    } finally {
      interruptionInFlight = null;
    }
  }

  async function createPlaybackRequest(
    turnBridge: VoiceRuntimeBridge,
    runtimeResponse: VoiceRuntimeAdapterResponse,
    runOptions: VoiceTurnRunOptions | undefined,
  ) {
    return turnBridge.createVoicePlaybackRequest(
      {
        request_id: runtimeResponse.response_id,
        session_id: snapshot.session_id ?? "voice-session",
        turn_id: snapshot.turn_id ?? "voice-turn",
        text: runtimeResponse.assistant_text,
        content_class: runOptions?.assistant_content_class ?? "assistant_prose",
        requested_voice_id: runOptions?.requested_voice_id,
        metadata_only: true,
      },
      {
        timeout_ms: runOptions?.timeout_ms,
        abort_signal: runOptions?.abort_signal,
        metadata_only: true,
      },
    );
  }

  function success(value: VoiceTurnResultMetadata | null): VoiceTurnResult {
    return value === null
      ? {
          ok: true,
          value: null,
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        }
      : {
          ok: true,
          value: { ...value },
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        };
  }

  function fail(
    reasons: readonly VoiceTurnFailureReason[],
    patch: Partial<VoiceTurnSnapshot>,
    runId?: number,
  ): VoiceTurnResult {
    if (runId === undefined || activeRunId === runId) {
      activeRunId = null;
      activeAcceptedTurnId = null;
      activeAbortSignal = null;
    }
    snapshot = {
      ...snapshot,
      ...patch,
      playback_queue_depth: options.playback_queue.snapshot().depth,
      degraded: true,
    };
    return {
      ok: false,
      value: null,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }

  function interruptionSuccess(
    value: VoiceTurnInterruptionMetadata,
  ): VoiceTurnInterruptionResult {
    return {
      ok: true,
      value: { ...value },
      snapshot: copySnapshot(),
      reasons: [],
      metadata_only: true,
    };
  }

  function interruptionFailure(
    reasons: readonly VoiceTurnFailureReason[],
  ): VoiceTurnInterruptionResult {
    return {
      ok: false,
      value: null,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }

  function cancelCurrentRun(runId: number): VoiceTurnResult {
    return fail(
      ["cancelled"],
      {
        phase: "cancelled",
        stt_status: "cancelled",
        runtime_status: "cancelled",
        tts_status: "cancelled",
        playback_status: "cancelled",
        error_class: "cancelled",
      },
      runId,
    );
  }

  function staleCompletionFailure(turnId: string | null): VoiceTurnResult {
    if (turnId) {
      interruptedTurnIds.add(turnId);
    }
    staleCompletionCount += 1;
    snapshot = {
      ...snapshot,
      stale_completion_count: staleCompletionCount,
      degraded: true,
    };
    return {
      ok: false,
      value: null,
      snapshot: copySnapshot(),
      reasons: ["cancelled"],
      metadata_only: true,
    };
  }

  function isCurrentRun(runId: number, turnId: string | null): boolean {
    return (
      activeRunId === runId &&
      activeAcceptedTurnId === turnId &&
      turnId !== null &&
      !interruptedTurnIds.has(turnId)
    );
  }

  function createGuardedPlaybackQueue(): PlaybackQueue {
    return {
      enqueue: (item) => {
        const turnId = readQueueItemTurnId(item);
        if (
          turnId !== null &&
          (activeRunId === null ||
            activeAcceptedTurnId !== turnId ||
            interruptedTurnIds.has(turnId) ||
            activeAbortSignal?.aborted === true)
        ) {
          return playbackQueueFailure(["malformed_item"]);
        }
        return options.playback_queue.enqueue(item);
      },
      dequeue: () => options.playback_queue.dequeue(),
      clear: (reason) => options.playback_queue.clear(reason),
      snapshot: () => options.playback_queue.snapshot(),
    };
  }

  function playbackQueueFailure(
    reasons: readonly ["malformed_item"],
  ): PlaybackQueueResult {
    return {
      ok: false,
      item: null,
      snapshot: options.playback_queue.snapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function idleSnapshot(playbackQueue: PlaybackQueue): VoiceTurnSnapshot {
  return {
    turn_id: null,
    session_id: null,
    phase: "idle",
    stt_status: "idle",
    runtime_status: "idle",
    tts_status: "idle",
    playback_status: "idle",
    playback_queue_depth: playbackQueue.snapshot().depth,
    degraded: false,
    metadata_only: true,
  };
}

function readCaptureIds(captureMetadata: unknown): {
  readonly session_id: string | null;
  readonly turn_id: string | null;
} {
  if (!captureMetadata || typeof captureMetadata !== "object") {
    return { session_id: null, turn_id: null };
  }
  const record = captureMetadata as Record<string, unknown>;
  return {
    session_id:
      typeof record.session_id === "string" ? record.session_id : null,
    turn_id: typeof record.turn_id === "string" ? record.turn_id : null,
  };
}

function mapFailure(reason: unknown): readonly VoiceTurnFailureReason[] {
  if (
    reason === "malformed_capture" ||
    reason === "stt_unavailable" ||
    reason === "stt_failed" ||
    reason === "runtime_unavailable" ||
    reason === "runtime_failed" ||
    reason === "runtime_cancelled" ||
    reason === "tts_unavailable" ||
    reason === "tts_failed" ||
    reason === "unsafe_content" ||
    reason === "enqueue_failed" ||
    reason === "cancelled" ||
    reason === "interruption_failed"
  ) {
    return [reason];
  }
  return ["runtime_failed"];
}

function isTurnActive(snapshot: VoiceTurnSnapshot): boolean {
  return (
    snapshot.phase === "transcribing" ||
    snapshot.phase === "executing_runtime" ||
    snapshot.phase === "synthesizing" ||
    snapshot.phase === "queued_for_playback" ||
    snapshot.playback_queue_depth > 0
  );
}

function readQueueItemTurnId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const turnId = (value as { readonly turn_id?: unknown }).turn_id;
  return typeof turnId === "string" && turnId.length > 0 ? turnId : null;
}
