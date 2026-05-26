import { isPlaybackQueueItem } from "./queue";
import { transitionPlaybackState } from "./state-machine";
import type { PlaybackLifecycleState, PlaybackQueueItem } from "./types";

export type PlaybackAdapterFailureReason =
  | "malformed_item"
  | "unsafe_content"
  | "not_loaded"
  | "playback_already_active"
  | "invalid_state"
  | "driver_error";

export interface PlaybackDriverHealth {
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly error_class?: "unavailable" | "driver_error" | "unknown";
  readonly metadata_only: true;
}

export interface PlaybackDriver {
  loadAudioRef(audio_ref: string): Promise<void>;
  playLoaded(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<PlaybackDriverHealth>;
}

export interface LocalPlaybackAdapterConfig {
  readonly allow_sensitive_content: boolean;
  readonly metadata_only: true;
}

export interface PlaybackAdapterSnapshot {
  readonly state: PlaybackLifecycleState;
  readonly item_id: string | null;
  readonly session_id: string | null;
  readonly turn_id: string | null;
  readonly chunk_id: string | null;
  readonly audio_ref: string | null;
  readonly provider_id: string | null;
  readonly voice_id: string | null;
  readonly duration_ms: number | null;
  readonly started_at?: string;
  readonly stopped_at?: string;
  readonly interruption_reason?: string;
  readonly error_class?: PlaybackAdapterFailureReason;
  readonly metadata_only: true;
}

export type PlaybackAdapterResult =
  | {
      readonly ok: true;
      readonly snapshot: PlaybackAdapterSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly snapshot: PlaybackAdapterSnapshot;
      readonly reasons: readonly PlaybackAdapterFailureReason[];
      readonly metadata_only: true;
    };

export interface LocalPlaybackAdapterOptions {
  readonly driver: PlaybackDriver;
  readonly config?: LocalPlaybackAdapterConfig;
  readonly now_ms?: () => number;
}

export interface LocalPlaybackAdapter {
  load(item: unknown): Promise<PlaybackAdapterResult>;
  play(): Promise<PlaybackAdapterResult>;
  stop(reason: string): Promise<PlaybackAdapterResult>;
  interrupt(reason: string): Promise<PlaybackAdapterResult>;
  health(): Promise<
    PlaybackDriverHealth & { readonly state: PlaybackLifecycleState }
  >;
  snapshot(): PlaybackAdapterSnapshot;
}

const DEFAULT_LOCAL_PLAYBACK_ADAPTER_CONFIG: LocalPlaybackAdapterConfig = {
  allow_sensitive_content: false,
  metadata_only: true,
};

export function createLocalPlaybackAdapter(
  options: LocalPlaybackAdapterOptions,
): LocalPlaybackAdapter {
  const config = options.config ?? DEFAULT_LOCAL_PLAYBACK_ADAPTER_CONFIG;
  const nowMs = options.now_ms ?? (() => Date.now());
  let loadedItem: PlaybackQueueItem | null = null;
  let active = false;
  let snapshot: PlaybackAdapterSnapshot = emptySnapshot("idle");

  const copySnapshot = (): PlaybackAdapterSnapshot => ({ ...snapshot });

  return {
    load: async (item) => {
      if (!isPlaybackQueueItem(item)) return failure(["malformed_item"]);
      if (
        !config.allow_sensitive_content &&
        item.content_class !== "assistant_prose"
      ) {
        return failure(["unsafe_content"]);
      }
      const transition = transitionPlaybackState(snapshot.state, "enqueue");
      if (!transition.ok) return failure(["invalid_state"]);

      try {
        await options.driver.loadAudioRef(item.audio_ref);
      } catch {
        snapshot = {
          ...snapshot,
          error_class: "driver_error",
        };
        return failure(["driver_error"]);
      }

      loadedItem = { ...item };
      active = false;
      snapshot = itemSnapshot(loadedItem, transition.next_state);
      return success();
    },
    play: async () => {
      if (!loadedItem) return failure(["not_loaded"]);
      if (active) return failure(["playback_already_active"]);

      const synthesisTransition = transitionPlaybackState(
        snapshot.state,
        "begin_synthesis",
      );
      if (!synthesisTransition.ok) return failure(["invalid_state"]);
      const playbackTransition = transitionPlaybackState(
        synthesisTransition.next_state,
        "begin_playback",
      );
      if (!playbackTransition.ok) return failure(["invalid_state"]);

      try {
        await options.driver.playLoaded();
      } catch {
        snapshot = {
          ...snapshot,
          state: "failed",
          error_class: "driver_error",
          stopped_at: timestamp(nowMs()),
        };
        loadedItem = null;
        active = false;
        return failure(["driver_error"]);
      }

      active = true;
      snapshot = {
        ...itemSnapshot(loadedItem, playbackTransition.next_state),
        started_at: timestamp(nowMs()),
      };
      return success();
    },
    stop: async () => {
      if (!loadedItem) return failure(["not_loaded"]);
      if (active) {
        try {
          await options.driver.stop();
        } catch {
          snapshot = {
            ...snapshot,
            state: "failed",
            error_class: "driver_error",
            stopped_at: timestamp(nowMs()),
          };
          loadedItem = null;
          active = false;
          return failure(["driver_error"]);
        }
      }
      const item = loadedItem;
      loadedItem = null;
      active = false;
      snapshot = {
        ...itemSnapshot(item, "completed"),
        started_at: snapshot.started_at,
        stopped_at: timestamp(nowMs()),
      };
      return success();
    },
    interrupt: async (reason) => {
      if (!loadedItem) return failure(["not_loaded"]);
      if (active) {
        try {
          await options.driver.stop();
        } catch {
          snapshot = {
            ...snapshot,
            state: "failed",
            error_class: "driver_error",
            stopped_at: timestamp(nowMs()),
          };
          loadedItem = null;
          active = false;
          return failure(["driver_error"]);
        }
      }
      const item = loadedItem;
      loadedItem = null;
      active = false;
      snapshot = {
        ...itemSnapshot(item, "interrupted"),
        started_at: snapshot.started_at,
        stopped_at: timestamp(nowMs()),
        interruption_reason: boundedReason(reason),
      };
      return success();
    },
    health: async () => ({
      ...(await options.driver.health()),
      state: snapshot.state,
    }),
    snapshot: copySnapshot,
  };

  function success(): PlaybackAdapterResult {
    return {
      ok: true,
      snapshot: copySnapshot(),
      reasons: [],
      metadata_only: true,
    };
  }

  function failure(
    reasons: readonly PlaybackAdapterFailureReason[],
  ): PlaybackAdapterResult {
    return {
      ok: false,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function itemSnapshot(
  item: PlaybackQueueItem,
  state: PlaybackLifecycleState,
): PlaybackAdapterSnapshot {
  return {
    state,
    item_id: item.item_id,
    session_id: item.session_id,
    turn_id: item.turn_id,
    chunk_id: item.chunk_id,
    audio_ref: item.audio_ref,
    provider_id: item.provider_id,
    voice_id: item.voice_id,
    duration_ms: item.duration_ms,
    metadata_only: true,
  };
}

function emptySnapshot(state: PlaybackLifecycleState): PlaybackAdapterSnapshot {
  return {
    state,
    item_id: null,
    session_id: null,
    turn_id: null,
    chunk_id: null,
    audio_ref: null,
    provider_id: null,
    voice_id: null,
    duration_ms: null,
    metadata_only: true,
  };
}

function boundedReason(reason: string): string {
  return reason.replace(/[^\w .:-]/g, "_").slice(0, 80);
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}
