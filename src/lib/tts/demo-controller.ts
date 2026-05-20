import { chunkAssistantProseText } from "./chunker";
import { synthesizeQueuedSpeechItem } from "./local-synthesis-provider";
import { InMemoryPlaybackManager } from "./playback";
import {
  InMemorySpeechQueueManager,
  type SpeechQueueRejectionReason,
} from "./queue";
import { evaluateSpeechSafetyPolicy } from "./safety-policy";
import type {
  ManualTtsDemoTelemetryEvent,
  PlaybackItem,
  SpeechAudioResult,
  SpeechChunk,
  SpeechProvider,
  SpeechQueueItem,
} from "./types";

export type ManualTtsDemoPrepareResult =
  | {
      ok: true;
      chunk: SpeechChunk;
      queueItem: SpeechQueueItem;
      audio: SpeechAudioResult;
      playbackItem: PlaybackItem;
    }
  | {
      ok: false;
      reason: ManualTtsDemoPrepareFailureReason;
    };

export type ManualTtsDemoPrepareFailureReason =
  | SpeechQueueRejectionReason
  | "queue_active"
  | "synthesis_failed"
  | "playback_rejected";

export interface ManualTtsDemoControllerOptions {
  provider: SpeechProvider;
  queueManager?: InMemorySpeechQueueManager;
  playbackManager?: InMemoryPlaybackManager;
  minChunkChars?: number;
  emitTelemetry?: (event: ManualTtsDemoTelemetryEvent) => void;
}

export interface ManualTtsDemoPrepareOptions {
  signal?: AbortSignal;
}

export class ManualTtsDemoController {
  private readonly queueManager: InMemorySpeechQueueManager;
  private readonly playbackManager: InMemoryPlaybackManager;

  constructor(private readonly opts: ManualTtsDemoControllerOptions) {
    this.queueManager = opts.queueManager ?? new InMemorySpeechQueueManager();
    this.playbackManager =
      opts.playbackManager ?? new InMemoryPlaybackManager();
  }

  async prepareSpeech(
    text: string,
    options: ManualTtsDemoPrepareOptions = {},
  ): Promise<ManualTtsDemoPrepareResult> {
    this.emit({ eventType: "demo_tts_prepare_started", success: true });

    const safety = evaluateSpeechSafetyPolicy({
      text,
      source: "assistant_prose",
    });
    if (!safety.allowed) {
      return this.fail(safety.reason ?? "assistant_prose_required");
    }

    const chunked = chunkAssistantProseText(text, {
      minChunkChars: this.opts.minChunkChars,
    });
    if (chunked.blocked) {
      return this.fail(chunked.decision.reason ?? "assistant_prose_required");
    }

    const chunk = chunked.chunks[0];
    if (!chunk) {
      return this.fail("empty_text");
    }

    const enqueued = this.queueManager.enqueue(chunk);
    if (!enqueued.ok) {
      return this.fail(enqueued.reason, { chunkId: chunk.id });
    }

    const active = this.queueManager.startNext();
    if (!active) {
      this.queueManager.cancelItem(enqueued.item.id);
      return this.fail("queue_active", {
        chunkId: chunk.id,
        queueItemId: enqueued.item.id,
      });
    }

    const synthesized = await synthesizeQueuedSpeechItem({
      provider: this.opts.provider,
      item: active,
      markReady: (itemId) => this.queueManager.markReady(itemId),
      fail: (itemId, error) => this.queueManager.fail(itemId, error),
      signal: options.signal,
    });

    if (
      synthesized.result.status !== "completed" ||
      !synthesized.result.audio
    ) {
      return this.fail("synthesis_failed", {
        chunkId: chunk.id,
        queueItemId: active.id,
      });
    }

    const playback = this.playbackManager.createFromReadyQueueItem(
      synthesized.result.audio,
      synthesized.item,
    );
    if (!playback.ok) {
      return this.fail("playback_rejected", {
        chunkId: chunk.id,
        queueItemId: active.id,
        audioId: synthesized.result.audio.id,
      });
    }

    this.emit({
      eventType: "demo_tts_prepare_completed",
      success: true,
      chunkId: chunk.id,
      queueItemId: active.id,
      playbackItemId: playback.item.id,
      audioId: synthesized.result.audio.id,
      byteLength: synthesized.result.audio.byteLength,
    });

    return {
      ok: true,
      chunk,
      queueItem: synthesized.item,
      audio: synthesized.result.audio,
      playbackItem: playback.item,
    };
  }

  getPlaybackItem(): PlaybackItem | null {
    return this.playbackManager.getActiveItem();
  }

  getPlaybackAudio(): SpeechAudioResult | null {
    return this.playbackManager.getActiveAudio();
  }

  private fail(
    reason: ManualTtsDemoPrepareFailureReason,
    ids: {
      chunkId?: string;
      queueItemId?: string;
      audioId?: string;
    } = {},
  ): ManualTtsDemoPrepareResult {
    this.emit({
      eventType: "demo_tts_prepare_failed",
      success: false,
      error: reason,
      ...ids,
    });
    return { ok: false, reason };
  }

  private emit(event: ManualTtsDemoTelemetryEvent): void {
    this.opts.emitTelemetry?.(event);
  }
}
