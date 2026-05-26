export {
  PLAYBACK_CONTENT_CLASSES,
  PLAYBACK_LIFECYCLE_STATES,
  PLAYBACK_STATE_EVENTS,
  PLAYBACK_TERMINAL_STATES,
} from "./types";
export type {
  PlaybackContentClass,
  PlaybackLifecycleState,
  PlaybackQueue,
  PlaybackQueueConfig,
  PlaybackQueueFailureReason,
  PlaybackQueueItem,
  PlaybackQueueResult,
  PlaybackQueueSnapshot,
  PlaybackStateEvent,
  PlaybackStateTransitionFailureReason,
  PlaybackStateTransitionResult,
  PlaybackTerminalState,
} from "./types";

export {
  isPlaybackLifecycleState,
  isPlaybackStateEvent,
  transitionPlaybackState,
} from "./state-machine";

export {
  DEFAULT_PLAYBACK_QUEUE_CONFIG,
  createPlaybackQueue,
  isPlaybackContentClass,
  isPlaybackQueueItem,
} from "./queue";

export { createLocalPlaybackAdapter } from "./adapter";
export type {
  LocalPlaybackAdapter,
  LocalPlaybackAdapterConfig,
  LocalPlaybackAdapterOptions,
  PlaybackAdapterFailureReason,
  PlaybackAdapterResult,
  PlaybackAdapterSnapshot,
  PlaybackDriver,
  PlaybackDriverHealth,
} from "./adapter";

export { createPlaybackSupervisor } from "./supervisor";
export type {
  PlaybackSupervisor,
  PlaybackSupervisorFailureReason,
  PlaybackSupervisorOperation,
  PlaybackSupervisorOptions,
  PlaybackSupervisorResult,
  PlaybackSupervisorSnapshot,
} from "./supervisor";

export {
  LOCAL_PLAYBACK_DEFAULT_COMMAND,
  LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS,
  LocalPlaybackDriverError,
  buildWindowsPlaybackArgs,
  createLocalPlaybackDriver,
  createNodePlaybackCommandRunner,
  isSafeLocalAudioRef,
} from "./local-driver";
export type {
  LocalPlaybackCommandOptions,
  LocalPlaybackCommandResult,
  LocalPlaybackCommandRunner,
  LocalPlaybackDriverFailureReason,
  LocalPlaybackDriverOptions,
} from "./local-driver";
