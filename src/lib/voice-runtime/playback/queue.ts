import {
  PLAYBACK_CONTENT_CLASSES,
  type PlaybackContentClass,
  type PlaybackQueue,
  type PlaybackQueueConfig,
  type PlaybackQueueFailureReason,
  type PlaybackQueueItem,
  type PlaybackQueueResult,
  type PlaybackQueueSnapshot,
} from "./types";

export const DEFAULT_PLAYBACK_QUEUE_CONFIG: PlaybackQueueConfig = {
  max_queue_depth: 8,
  allow_sensitive_content: false,
  metadata_only: true,
};

const PLAYBACK_QUEUE_ITEM_KEYS = [
  "item_id",
  "session_id",
  "turn_id",
  "chunk_id",
  "provider_id",
  "voice_id",
  "audio_ref",
  "duration_ms",
  "size_bytes",
  "content_class",
  "created_at",
  "metadata_only",
] as const;

const PLAYBACK_QUEUE_FORBIDDEN_KEYS = [
  "audio",
  "raw_audio",
  "audio_bytes",
  "waveform",
  "pcm",
  "buffer",
  "bytes",
  "transcript",
  "text",
  "raw_text",
  "prompt",
  "response",
  "model_output",
  "tool_output",
] as const;

export function createPlaybackQueue(
  config: PlaybackQueueConfig = DEFAULT_PLAYBACK_QUEUE_CONFIG,
): PlaybackQueue {
  const validatedConfig = isPlaybackQueueConfig(config)
    ? copyConfig(config)
    : null;
  const items: PlaybackQueueItem[] = [];

  const snapshot = (): PlaybackQueueSnapshot => ({
    items: items.map(copyItem),
    depth: items.length,
    max_queue_depth:
      validatedConfig?.max_queue_depth ??
      DEFAULT_PLAYBACK_QUEUE_CONFIG.max_queue_depth,
    metadata_only: true,
  });

  const failure = (
    reasons: readonly PlaybackQueueFailureReason[],
  ): PlaybackQueueResult => ({
    ok: false,
    item: null,
    snapshot: snapshot(),
    reasons,
    metadata_only: true,
  });

  const success = (item: PlaybackQueueItem | null): PlaybackQueueResult => ({
    ok: true,
    item: item ? copyItem(item) : null,
    snapshot: snapshot(),
    reasons: [],
    metadata_only: true,
  });

  return {
    enqueue: (item) => {
      if (!validatedConfig) return failure(["malformed_config"]);
      if (!isPlaybackQueueItem(item)) return failure(["malformed_item"]);
      if (
        !validatedConfig.allow_sensitive_content &&
        !isSpeakableByDefault(item)
      ) {
        return failure(["unsafe_content"]);
      }
      if (items.length >= validatedConfig.max_queue_depth) {
        return failure(["queue_full"]);
      }
      const queued = copyItem(item);
      items.push(queued);
      return success(queued);
    },
    dequeue: () => {
      if (!validatedConfig) return failure(["malformed_config"]);
      const item = items.shift();
      if (!item) return failure(["queue_empty"]);
      return success(item);
    },
    clear: () => {
      items.splice(0, items.length);
      return success(null);
    },
    snapshot,
  };
}

export function isPlaybackQueueItem(
  value: unknown,
): value is PlaybackQueueItem {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, PLAYBACK_QUEUE_ITEM_KEYS)) return false;
  if (hasForbiddenKeys(value)) return false;
  return (
    isNonEmptyString(value.item_id) &&
    isNonEmptyString(value.session_id) &&
    isNonEmptyString(value.turn_id) &&
    isNonEmptyString(value.chunk_id) &&
    isNonEmptyString(value.provider_id) &&
    isNonEmptyString(value.voice_id) &&
    isNonEmptyString(value.audio_ref) &&
    isNonNegativeFiniteNumber(value.duration_ms) &&
    isNonNegativeFiniteNumber(value.size_bytes) &&
    isPlaybackContentClass(value.content_class) &&
    isNonEmptyString(value.created_at) &&
    value.metadata_only === true
  );
}

export function isPlaybackContentClass(
  value: unknown,
): value is PlaybackContentClass {
  return (
    typeof value === "string" &&
    (PLAYBACK_CONTENT_CLASSES as readonly string[]).includes(value)
  );
}

function isPlaybackQueueConfig(value: unknown): value is PlaybackQueueConfig {
  if (!isRecord(value)) return false;
  const maxQueueDepth = value.max_queue_depth;
  return (
    hasExactKeys(value, [
      "max_queue_depth",
      "allow_sensitive_content",
      "metadata_only",
    ]) &&
    Number.isInteger(maxQueueDepth) &&
    typeof maxQueueDepth === "number" &&
    maxQueueDepth > 0 &&
    maxQueueDepth <= 128 &&
    typeof value.allow_sensitive_content === "boolean" &&
    value.metadata_only === true
  );
}

function isSpeakableByDefault(item: PlaybackQueueItem): boolean {
  return item.content_class === "assistant_prose";
}

function copyConfig(config: PlaybackQueueConfig): PlaybackQueueConfig {
  return { ...config };
}

function copyItem(item: PlaybackQueueItem): PlaybackQueueItem {
  return { ...item };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
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
  return PLAYBACK_QUEUE_FORBIDDEN_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}
