import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYBACK_QUEUE_CONFIG,
  PLAYBACK_CONTENT_CLASSES,
  createPlaybackQueue,
  isPlaybackContentClass,
  isPlaybackQueueItem,
  type PlaybackQueueConfig,
  type PlaybackQueueItem,
} from "../../../src/lib/voice-runtime";

function playbackQueueSource(): string {
  return [
    "src/lib/voice-runtime/playback/types.ts",
    "src/lib/voice-runtime/playback/queue.ts",
    "src/lib/voice-runtime/playback/index.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

function queueItem(
  overrides: Partial<PlaybackQueueItem> = {},
): PlaybackQueueItem {
  return {
    item_id: "playback-item-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    chunk_id: "tts-chunk-1",
    provider_id: "fake-local-tts",
    voice_id: "fake-voice",
    audio_ref: "tts-output://voice-session-1/voice-turn-1/chunk-1.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    content_class: "assistant_prose",
    created_at: "2026-05-26T07:00:00.000Z",
    metadata_only: true,
    ...overrides,
  };
}

function config(
  overrides: Partial<PlaybackQueueConfig> = {},
): PlaybackQueueConfig {
  return {
    ...DEFAULT_PLAYBACK_QUEUE_CONFIG,
    ...overrides,
  };
}

describe("Phase 14E.1 playback queue contracts", () => {
  it("defines metadata-only queue defaults and content classes", () => {
    expect(DEFAULT_PLAYBACK_QUEUE_CONFIG).toEqual({
      max_queue_depth: 8,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    expect(PLAYBACK_CONTENT_CLASSES).toEqual([
      "assistant_prose",
      "tool_output",
      "code_block",
      "approval_prompt",
      "personal_context",
      "file_content",
      "error_stack",
      "audit_log",
      "transcript",
    ]);
    expect(isPlaybackContentClass("assistant_prose")).toBe(true);
    expect(isPlaybackContentClass("raw_audio")).toBe(false);
  });

  it("validates queue item shape and rejects unknown/raw fields", () => {
    expect(isPlaybackQueueItem(queueItem())).toBe(true);
    expect(isPlaybackQueueItem({ ...queueItem(), raw_audio: "RIFF" })).toBe(
      false,
    );
    expect(isPlaybackQueueItem({ ...queueItem(), unexpected: true })).toBe(
      false,
    );
    expect(isPlaybackQueueItem({ ...queueItem(), metadata_only: false })).toBe(
      false,
    );
  });

  it("enqueues and dequeues items in FIFO order", () => {
    const queue = createPlaybackQueue();
    const first = queueItem({
      item_id: "playback-item-1",
      chunk_id: "chunk-1",
    });
    const second = queueItem({
      item_id: "playback-item-2",
      chunk_id: "chunk-2",
      created_at: "2026-05-26T07:00:01.000Z",
    });

    expect(queue.enqueue(first)).toMatchObject({
      ok: true,
      item: first,
      snapshot: { depth: 1 },
    });
    expect(queue.enqueue(second)).toMatchObject({
      ok: true,
      item: second,
      snapshot: { depth: 2 },
    });
    expect(queue.dequeue()).toMatchObject({
      ok: true,
      item: first,
      snapshot: { depth: 1 },
    });
    expect(queue.dequeue()).toMatchObject({
      ok: true,
      item: second,
      snapshot: { depth: 0 },
    });
    expect(queue.dequeue()).toMatchObject({
      ok: false,
      reasons: ["queue_empty"],
    });
  });

  it("enforces max queue depth", () => {
    const queue = createPlaybackQueue(config({ max_queue_depth: 1 }));

    expect(queue.enqueue(queueItem())).toMatchObject({ ok: true });
    expect(
      queue.enqueue(
        queueItem({ item_id: "playback-item-2", chunk_id: "chunk-2" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: ["queue_full"],
      snapshot: { depth: 1 },
    });
  });

  it("rejects unsafe content by default and allows it only with explicit config", () => {
    const queue = createPlaybackQueue();
    const unsafe = queueItem({ content_class: "tool_output" });

    expect(queue.enqueue(unsafe)).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
    });

    const permissive = createPlaybackQueue(
      config({ allow_sensitive_content: true }),
    );
    expect(permissive.enqueue(unsafe)).toMatchObject({
      ok: true,
      item: unsafe,
    });
  });

  it("fails closed for malformed queue config and items", () => {
    const malformedConfig = createPlaybackQueue({
      max_queue_depth: 0,
      allow_sensitive_content: false,
      metadata_only: true,
    });

    expect(malformedConfig.enqueue(queueItem())).toMatchObject({
      ok: false,
      reasons: ["malformed_config"],
    });

    const queue = createPlaybackQueue();
    expect(queue.enqueue(null)).toMatchObject({
      ok: false,
      reasons: ["malformed_item"],
    });
    expect(queue.enqueue({ ...queueItem(), duration_ms: -1 })).toMatchObject({
      ok: false,
      reasons: ["malformed_item"],
    });
  });

  it("returns defensive-copy metadata-only snapshots", () => {
    const queue = createPlaybackQueue();
    const item = queueItem();
    queue.enqueue(item);

    const snapshot = queue.snapshot();
    expect(snapshot).toEqual({
      items: [item],
      depth: 1,
      max_queue_depth: 8,
      metadata_only: true,
    });

    (snapshot.items as PlaybackQueueItem[]).push(
      queueItem({ item_id: "mutated", chunk_id: "mutated" }),
    );
    expect(queue.snapshot()).toEqual({
      items: [item],
      depth: 1,
      max_queue_depth: 8,
      metadata_only: true,
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response|RIFF|base64/i,
    );
  });

  it("clears all queued items without retaining content", () => {
    const queue = createPlaybackQueue();
    queue.enqueue(queueItem());
    queue.enqueue(
      queueItem({ item_id: "playback-item-2", chunk_id: "chunk-2" }),
    );

    expect(queue.clear("interrupted")).toEqual({
      ok: true,
      item: null,
      snapshot: {
        items: [],
        depth: 0,
        max_queue_depth: 8,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
  });

  it("does not introduce speaker playback APIs, TTS/STT execution, runtime, persistence, cloud, or UI wiring", () => {
    const source = playbackQueueSource();

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(|from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
    );
    expect(source).not.toMatch(
      /createPiperTtsProvider|synthesize\s*\(|createFasterWhisperSttProvider|transcribe\s*\(|faster_whisper|piper/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(/autoplay|auto.?play/i);
  });
});
