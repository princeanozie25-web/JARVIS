export const PLAYBACK_LIFECYCLE_STATES = [
  "idle",
  "queueing",
  "synthesizing",
  "playing",
  "interrupted",
  "completed",
  "failed",
] as const;

export const PLAYBACK_STATE_EVENTS = [
  "enqueue",
  "begin_synthesis",
  "begin_playback",
  "complete",
  "interrupt",
  "fail",
  "reset",
] as const;

export const PLAYBACK_TERMINAL_STATES = [
  "interrupted",
  "completed",
  "failed",
] as const;

export const PLAYBACK_CONTENT_CLASSES = [
  "assistant_prose",
  "tool_output",
  "code_block",
  "approval_prompt",
  "personal_context",
  "file_content",
  "error_stack",
  "audit_log",
  "transcript",
] as const;

export type PlaybackLifecycleState = (typeof PLAYBACK_LIFECYCLE_STATES)[number];
export type PlaybackStateEvent = (typeof PLAYBACK_STATE_EVENTS)[number];
export type PlaybackTerminalState = (typeof PLAYBACK_TERMINAL_STATES)[number];
export type PlaybackContentClass = (typeof PLAYBACK_CONTENT_CLASSES)[number];

export type PlaybackStateTransitionFailureReason =
  | "invalid_state"
  | "invalid_event"
  | "invalid_transition";

export interface PlaybackQueueItem {
  readonly item_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly chunk_id: string;
  readonly provider_id: string;
  readonly voice_id: string;
  readonly audio_ref: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly content_class: PlaybackContentClass;
  readonly created_at: string;
  readonly metadata_only: true;
}

export interface PlaybackQueueConfig {
  readonly max_queue_depth: number;
  readonly allow_sensitive_content: boolean;
  readonly metadata_only: true;
}

export interface PlaybackQueueSnapshot {
  readonly items: readonly PlaybackQueueItem[];
  readonly depth: number;
  readonly max_queue_depth: number;
  readonly metadata_only: true;
}

export type PlaybackQueueFailureReason =
  | "malformed_item"
  | "malformed_config"
  | "queue_full"
  | "unsafe_content"
  | "queue_empty";

export interface PlaybackQueue {
  enqueue(item: unknown): PlaybackQueueResult;
  dequeue(): PlaybackQueueResult;
  clear(reason: string): PlaybackQueueResult;
  snapshot(): PlaybackQueueSnapshot;
}

export type PlaybackQueueResult =
  | {
      readonly ok: true;
      readonly item: PlaybackQueueItem | null;
      readonly snapshot: PlaybackQueueSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly item: null;
      readonly snapshot: PlaybackQueueSnapshot;
      readonly reasons: readonly PlaybackQueueFailureReason[];
      readonly metadata_only: true;
    };

export type PlaybackStateTransitionResult =
  | {
      readonly ok: true;
      readonly previous_state: PlaybackLifecycleState;
      readonly event: PlaybackStateEvent;
      readonly next_state: PlaybackLifecycleState;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly previous_state: PlaybackLifecycleState | null;
      readonly event: PlaybackStateEvent | null;
      readonly next_state: PlaybackLifecycleState | null;
      readonly reason: PlaybackStateTransitionFailureReason;
      readonly metadata_only: true;
    };
