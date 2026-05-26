import type {
  LocalPlaybackAdapter,
  PlaybackAdapterFailureReason,
} from "./adapter";
import { createPlaybackQueue } from "./queue";
import { transitionPlaybackState } from "./state-machine";
import type {
  PlaybackLifecycleState,
  PlaybackQueue,
  PlaybackQueueConfig,
  PlaybackQueueFailureReason,
  PlaybackQueueItem,
} from "./types";

export type PlaybackSupervisorOperation =
  | "enqueue"
  | "loadNext"
  | "beginPlayback"
  | "complete"
  | "interrupt"
  | "fail"
  | "clear"
  | "reset";

export type PlaybackSupervisorFailureReason =
  | PlaybackQueueFailureReason
  | PlaybackAdapterFailureReason
  | "active_playback_exists"
  | "no_loaded_item"
  | "no_queued_item"
  | "invalid_state";

export interface PlaybackSupervisorSnapshot {
  readonly playback_state: PlaybackLifecycleState;
  readonly active_item_id: string | null;
  readonly session_id: string | null;
  readonly turn_id: string | null;
  readonly chunk_id: string | null;
  readonly provider_id: string | null;
  readonly voice_id: string | null;
  readonly queue_depth: number;
  readonly interruption_reason?: string;
  readonly started_at?: string;
  readonly stopped_at?: string;
  readonly error_class?: PlaybackSupervisorFailureReason;
  readonly metadata_only: true;
}

export type PlaybackSupervisorResult =
  | {
      readonly ok: true;
      readonly operation: PlaybackSupervisorOperation;
      readonly snapshot: PlaybackSupervisorSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly operation: PlaybackSupervisorOperation;
      readonly snapshot: PlaybackSupervisorSnapshot;
      readonly reasons: readonly PlaybackSupervisorFailureReason[];
      readonly metadata_only: true;
    };

export interface PlaybackSupervisorOptions {
  readonly adapter: LocalPlaybackAdapter;
  readonly queue?: PlaybackQueue;
  readonly queue_config?: PlaybackQueueConfig;
  readonly now_ms?: () => number;
}

export interface PlaybackSupervisor {
  enqueue(item: unknown): PlaybackSupervisorResult;
  loadNext(): Promise<PlaybackSupervisorResult>;
  beginPlayback(): Promise<PlaybackSupervisorResult>;
  complete(): Promise<PlaybackSupervisorResult>;
  interrupt(reason: string): Promise<PlaybackSupervisorResult>;
  fail(
    error:
      | PlaybackSupervisorFailureReason
      | { readonly error_class?: PlaybackSupervisorFailureReason },
  ): Promise<PlaybackSupervisorResult>;
  clear(reason: string): Promise<PlaybackSupervisorResult>;
  reset(): PlaybackSupervisorResult;
  snapshot(): PlaybackSupervisorSnapshot;
}

export function createPlaybackSupervisor(
  options: PlaybackSupervisorOptions,
): PlaybackSupervisor {
  const queue = options.queue ?? createPlaybackQueue(options.queue_config);
  const nowMs = options.now_ms ?? (() => Date.now());
  let playbackState: PlaybackLifecycleState = "idle";
  let activeItem: PlaybackQueueItem | null = null;
  let snapshot: PlaybackSupervisorSnapshot = emptySnapshot("idle", queue);

  const copySnapshot = (): PlaybackSupervisorSnapshot => ({ ...snapshot });

  return {
    enqueue: (item) => {
      const enqueueResult = queue.enqueue(item);
      if (!enqueueResult.ok) {
        snapshot = {
          ...snapshot,
          queue_depth: enqueueResult.snapshot.depth,
          error_class: enqueueResult.reasons[0],
        };
        return failure("enqueue", enqueueResult.reasons);
      }
      snapshot = {
        ...snapshot,
        queue_depth: enqueueResult.snapshot.depth,
      };
      return success("enqueue");
    },
    loadNext: async () => {
      if (isActiveState(playbackState) || activeItem) {
        return failure("loadNext", ["active_playback_exists"]);
      }
      const dequeueResult = queue.dequeue();
      if (!dequeueResult.ok || !dequeueResult.item) {
        snapshot = {
          ...snapshot,
          queue_depth: dequeueResult.snapshot.depth,
          error_class: "no_queued_item",
        };
        return failure("loadNext", ["no_queued_item"]);
      }
      const transition = transitionPlaybackState(playbackState, "enqueue");
      if (!transition.ok) return failure("loadNext", ["invalid_state"]);

      const adapterResult = await options.adapter.load(dequeueResult.item);
      if (!adapterResult.ok) {
        playbackState = "failed";
        activeItem = null;
        snapshot = {
          ...emptySnapshot("failed", queue),
          error_class: adapterResult.reasons[0] ?? "driver_error",
        };
        return failure("loadNext", adapterResult.reasons);
      }

      activeItem = { ...dequeueResult.item };
      playbackState = transition.next_state;
      snapshot = itemSnapshot(activeItem, playbackState, queue);
      return success("loadNext");
    },
    beginPlayback: async () => {
      if (!activeItem) return failure("beginPlayback", ["no_loaded_item"]);
      const synthesisTransition = transitionPlaybackState(
        playbackState,
        "begin_synthesis",
      );
      if (!synthesisTransition.ok) {
        return failure("beginPlayback", ["invalid_state"]);
      }
      const playbackTransition = transitionPlaybackState(
        synthesisTransition.next_state,
        "begin_playback",
      );
      if (!playbackTransition.ok) {
        return failure("beginPlayback", ["invalid_state"]);
      }

      const adapterResult = await options.adapter.play();
      if (!adapterResult.ok) {
        playbackState = "failed";
        activeItem = null;
        snapshot = {
          ...adapterSnapshot(adapterResult.snapshot, queue),
          playback_state: "failed",
          error_class: adapterResult.reasons[0] ?? "driver_error",
        };
        return failure("beginPlayback", adapterResult.reasons);
      }

      playbackState = playbackTransition.next_state;
      snapshot = {
        ...itemSnapshot(activeItem, playbackState, queue),
        started_at: adapterResult.snapshot.started_at ?? timestamp(nowMs()),
      };
      return success("beginPlayback");
    },
    complete: async () => {
      if (!activeItem) return failure("complete", ["no_loaded_item"]);
      const transition = transitionPlaybackState(playbackState, "complete");
      if (!transition.ok) return failure("complete", ["invalid_state"]);

      const adapterResult = await options.adapter.stop("completed");
      if (!adapterResult.ok) {
        playbackState = "failed";
        activeItem = null;
        snapshot = {
          ...adapterSnapshot(adapterResult.snapshot, queue),
          playback_state: "failed",
          error_class: adapterResult.reasons[0] ?? "driver_error",
        };
        return failure("complete", adapterResult.reasons);
      }

      const item = activeItem;
      activeItem = null;
      playbackState = transition.next_state;
      snapshot = {
        ...itemSnapshot(item, playbackState, queue),
        started_at: adapterResult.snapshot.started_at,
        stopped_at: adapterResult.snapshot.stopped_at ?? timestamp(nowMs()),
      };
      return success("complete");
    },
    interrupt: async (reason) => {
      if (!activeItem) return failure("interrupt", ["no_loaded_item"]);
      const transition = transitionPlaybackState(playbackState, "interrupt");
      if (!transition.ok) return failure("interrupt", ["invalid_state"]);

      const adapterResult = await options.adapter.interrupt(reason);
      if (!adapterResult.ok) {
        playbackState = "failed";
        activeItem = null;
        snapshot = {
          ...adapterSnapshot(adapterResult.snapshot, queue),
          playback_state: "failed",
          error_class: adapterResult.reasons[0] ?? "driver_error",
        };
        return failure("interrupt", adapterResult.reasons);
      }

      const item = activeItem;
      activeItem = null;
      playbackState = transition.next_state;
      snapshot = {
        ...itemSnapshot(item, playbackState, queue),
        started_at: adapterResult.snapshot.started_at,
        stopped_at: adapterResult.snapshot.stopped_at ?? timestamp(nowMs()),
        interruption_reason: boundedReason(reason),
      };
      return success("interrupt");
    },
    fail: async (error) => {
      const normalized = normalizeError(error);
      if (activeItem) {
        await options.adapter.interrupt(normalized);
      }
      const transition = transitionPlaybackState(playbackState, "fail");
      playbackState = transition.ok ? transition.next_state : "failed";
      activeItem = null;
      snapshot = {
        ...snapshot,
        playback_state: playbackState,
        active_item_id: snapshot.active_item_id,
        stopped_at: timestamp(nowMs()),
        error_class: normalized,
        queue_depth: queue.snapshot().depth,
      };
      return success("fail");
    },
    clear: async (reason) => {
      queue.clear(reason);
      if (activeItem) {
        await options.adapter.stop(reason);
      }
      activeItem = null;
      playbackState = "completed";
      snapshot = {
        ...emptySnapshot(playbackState, queue),
        stopped_at: timestamp(nowMs()),
      };
      return success("clear");
    },
    reset: () => {
      const transition = transitionPlaybackState(playbackState, "reset");
      if (!transition.ok) return failure("reset", ["invalid_state"]);
      playbackState = transition.next_state;
      activeItem = null;
      snapshot = emptySnapshot(playbackState, queue);
      return success("reset");
    },
    snapshot: copySnapshot,
  };

  function success(
    operation: PlaybackSupervisorOperation,
  ): PlaybackSupervisorResult {
    return {
      ok: true,
      operation,
      snapshot: copySnapshot(),
      reasons: [],
      metadata_only: true,
    };
  }

  function failure(
    operation: PlaybackSupervisorOperation,
    reasons: readonly PlaybackSupervisorFailureReason[],
  ): PlaybackSupervisorResult {
    return {
      ok: false,
      operation,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function isActiveState(state: PlaybackLifecycleState): boolean {
  return (
    state === "queueing" || state === "synthesizing" || state === "playing"
  );
}

function emptySnapshot(
  state: PlaybackLifecycleState,
  queue: PlaybackQueue,
): PlaybackSupervisorSnapshot {
  return {
    playback_state: state,
    active_item_id: null,
    session_id: null,
    turn_id: null,
    chunk_id: null,
    provider_id: null,
    voice_id: null,
    queue_depth: queue.snapshot().depth,
    metadata_only: true,
  };
}

function itemSnapshot(
  item: PlaybackQueueItem,
  state: PlaybackLifecycleState,
  queue: PlaybackQueue,
): PlaybackSupervisorSnapshot {
  return {
    playback_state: state,
    active_item_id: item.item_id,
    session_id: item.session_id,
    turn_id: item.turn_id,
    chunk_id: item.chunk_id,
    provider_id: item.provider_id,
    voice_id: item.voice_id,
    queue_depth: queue.snapshot().depth,
    metadata_only: true,
  };
}

function adapterSnapshot(
  snapshot: ReturnType<LocalPlaybackAdapter["snapshot"]>,
  queue: PlaybackQueue,
): PlaybackSupervisorSnapshot {
  return {
    playback_state: snapshot.state,
    active_item_id: snapshot.item_id,
    session_id: snapshot.session_id,
    turn_id: snapshot.turn_id,
    chunk_id: snapshot.chunk_id,
    provider_id: snapshot.provider_id,
    voice_id: snapshot.voice_id,
    queue_depth: queue.snapshot().depth,
    started_at: snapshot.started_at,
    stopped_at: snapshot.stopped_at,
    interruption_reason: snapshot.interruption_reason,
    error_class: snapshot.error_class,
    metadata_only: true,
  };
}

function normalizeError(
  error:
    | PlaybackSupervisorFailureReason
    | { readonly error_class?: PlaybackSupervisorFailureReason },
): PlaybackSupervisorFailureReason {
  if (typeof error === "string") return error;
  return error.error_class ?? "invalid_state";
}

function boundedReason(reason: string): string {
  return reason.replace(/[^\w .:-]/g, "_").slice(0, 80);
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}
