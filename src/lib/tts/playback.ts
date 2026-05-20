import { evaluateSpeechSafetyPolicy } from "./safety-policy";
import type {
  PlaybackItem,
  PlaybackSource,
  PlaybackState,
  PlaybackTelemetryEvent,
  SpeechAudioResult,
  SpeechQueueItem,
  SpeechSynthesisInput,
  SpeechSynthesisRefusalReason,
} from "./types";

export type PlaybackRejectionReason =
  | SpeechSynthesisRefusalReason
  | "audio_source_blocked"
  | "active_playback_exists"
  | "empty_audio";

export type PlaybackItemResult =
  | { ok: true; item: PlaybackItem }
  | { ok: false; reason: PlaybackRejectionReason };

type PlaybackValidationResult =
  | { ok: true }
  | { ok: false; reason: PlaybackRejectionReason };

export interface PlaybackManagerOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (event: PlaybackTelemetryEvent) => void;
}

interface StoredPlayback {
  item: PlaybackItem;
  audio: SpeechAudioResult | null;
}

const ACTIVE_PLAYBACK_STATES = new Set<PlaybackState>([
  "loading",
  "ready",
  "playing",
  "paused",
]);

export class InMemoryPlaybackManager {
  private active: StoredPlayback | null = null;

  constructor(private readonly opts: PlaybackManagerOptions = {}) {}

  createFromAudio(
    audio: SpeechAudioResult,
    safetyInput?: SpeechSynthesisInput,
  ): PlaybackItemResult {
    if (this.active && ACTIVE_PLAYBACK_STATES.has(this.active.item.status)) {
      return { ok: false, reason: "active_playback_exists" };
    }
    const validation = validatePlaybackAudio(audio, safetyInput);
    if (!validation.ok) return validation;

    const item: PlaybackItem = {
      id: this.newId(),
      audioId: audio.id,
      chunkId: audio.chunkId,
      source: "local_tts",
      status: "ready",
      createdAt: this.now(),
      mimeType: audio.mimeType,
      byteLength: audio.byteLength,
      durationMs: audio.durationMs,
      sampleRate: audio.sampleRate,
    };
    this.active = { item, audio };
    this.emit({
      eventType: "tts_playback_ready",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: true,
    });
    return { ok: true, item: copyPlaybackItem(item) };
  }

  createFromReadyQueueItem(
    audio: SpeechAudioResult,
    queueItem: SpeechQueueItem,
  ): PlaybackItemResult {
    if (queueItem.status !== "ready" || queueItem.chunkId !== audio.chunkId) {
      return { ok: false, reason: "audio_source_blocked" };
    }
    return this.createFromAudio(audio, {
      text: queueItem.text,
      source: "assistant_prose",
      chunkId: queueItem.chunkId,
    });
  }

  markPlaying(itemId: string): PlaybackItem | null {
    const item = this.getMutableActiveItem(itemId);
    if (!item || item.status !== "ready")
      return item ? copyPlaybackItem(item) : null;
    item.status = "playing";
    item.startedAt = this.now();
    this.emit({
      eventType: "tts_playback_started",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: true,
    });
    return copyPlaybackItem(item);
  }

  stop(itemId: string): PlaybackItem | null {
    const item = this.getMutableActiveItem(itemId);
    if (!item) return null;
    item.status = "completed";
    item.completedAt = this.now();
    this.emit({
      eventType: "tts_playback_stopped",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: true,
      durationMs: playbackDuration(item),
    });
    const snapshot = copyPlaybackItem(item);
    this.releaseActiveAudio(itemId);
    return snapshot;
  }

  complete(itemId: string): PlaybackItem | null {
    const item = this.getMutableActiveItem(itemId);
    if (!item) return null;
    item.status = "completed";
    item.completedAt = this.now();
    this.emit({
      eventType: "tts_playback_completed",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: true,
      durationMs: playbackDuration(item),
    });
    const snapshot = copyPlaybackItem(item);
    this.releaseActiveAudio(itemId);
    return snapshot;
  }

  fail(itemId: string, error: string): PlaybackItem | null {
    const item = this.getMutableActiveItem(itemId);
    if (!item) return null;
    item.status = "failed";
    item.completedAt = this.now();
    item.error = sanitizePlaybackError(error);
    this.emit({
      eventType: "tts_playback_failed",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: false,
      error: item.error,
    });
    const snapshot = copyPlaybackItem(item);
    this.releaseActiveAudio(itemId);
    return snapshot;
  }

  cancel(itemId?: string): PlaybackItem | null {
    if (!this.active) return null;
    if (itemId && this.active.item.id !== itemId) return null;
    const item = this.active.item;
    item.status = "cancelled";
    item.completedAt = this.now();
    this.emit({
      eventType: "tts_playback_cancelled",
      itemId: item.id,
      audioId: item.audioId,
      chunkId: item.chunkId,
      source: item.source,
      status: item.status,
      success: false,
      error: "cancelled",
    });
    const snapshot = copyPlaybackItem(item);
    this.releaseActiveAudio(item.id);
    return snapshot;
  }

  cleanup(): void {
    this.active = null;
  }

  getActiveItem(): PlaybackItem | null {
    return this.active ? copyPlaybackItem(this.active.item) : null;
  }

  getActiveAudio(): SpeechAudioResult | null {
    return this.active?.audio ?? null;
  }

  private releaseActiveAudio(itemId: string): void {
    if (this.active?.item.id === itemId) {
      this.active.audio = null;
    }
  }

  private getMutableActiveItem(itemId: string): PlaybackItem | null {
    if (!this.active || this.active.item.id !== itemId) return null;
    return this.active.item;
  }

  private emit(event: PlaybackTelemetryEvent): void {
    this.opts.emitTelemetry?.(event);
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

export interface BrowserAudioElement {
  src: string;
  onended: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  pause(): void;
  play(): Promise<void>;
  removeAttribute(name: string): void;
  load(): void;
}

export interface BrowserPlaybackWrapperOptions {
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  createAudioElement?: () => BrowserAudioElement;
}

export class BrowserPlaybackWrapper {
  private audio: BrowserAudioElement | null = null;
  private objectUrl: string | null = null;
  private userGestureReady = false;

  constructor(private readonly opts: BrowserPlaybackWrapperOptions = {}) {}

  requireUserGesture(): void {
    this.userGestureReady = true;
  }

  load(audio: SpeechAudioResult): void {
    this.cleanup();
    const buffer = audio.data.buffer.slice(
      audio.data.byteOffset,
      audio.data.byteOffset + audio.data.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: audio.mimeType });
    this.objectUrl = this.createObjectUrl(blob);
    this.audio = this.createAudioElement();
    this.audio.src = this.objectUrl;
  }

  async play(): Promise<void> {
    if (!this.userGestureReady) {
      throw new Error("User gesture is required before speech playback.");
    }
    if (!this.audio) {
      throw new Error("No speech playback item is loaded.");
    }
    this.userGestureReady = false;
    await this.audio.play();
  }

  stop(): void {
    this.audio?.pause();
    this.cleanup();
  }

  cancel(): void {
    this.stop();
  }

  cleanup(): void {
    const audio = this.audio;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.onended = null;
      audio.onerror = null;
      this.audio = null;
    }
    if (this.objectUrl) {
      this.revokeObjectUrl(this.objectUrl);
      this.objectUrl = null;
    }
    this.userGestureReady = false;
  }

  setCompletionHandlers(input: {
    onCompleted: () => void;
    onFailed: () => void;
  }): void {
    if (!this.audio) return;
    this.audio.onended = input.onCompleted;
    this.audio.onerror = input.onFailed;
  }

  private createObjectUrl(blob: Blob): string {
    if (this.opts.createObjectUrl) return this.opts.createObjectUrl(blob);
    return URL.createObjectURL(blob);
  }

  private revokeObjectUrl(url: string): void {
    if (this.opts.revokeObjectUrl) {
      this.opts.revokeObjectUrl(url);
      return;
    }
    URL.revokeObjectURL(url);
  }

  private createAudioElement(): BrowserAudioElement {
    if (this.opts.createAudioElement) return this.opts.createAudioElement();
    return new Audio();
  }
}

function validatePlaybackAudio(
  audio: SpeechAudioResult,
  safetyInput?: SpeechSynthesisInput,
): PlaybackValidationResult {
  if (audio.source !== ("local_tts" satisfies PlaybackSource)) {
    return { ok: false, reason: "audio_source_blocked" };
  }
  if (audio.byteLength <= 0 || audio.data.byteLength <= 0) {
    return { ok: false, reason: "empty_audio" };
  }
  if (safetyInput) {
    const decision = evaluateSpeechSafetyPolicy(safetyInput);
    if (!decision.allowed) {
      return {
        ok: false,
        reason: decision.reason ?? "assistant_prose_required",
      };
    }
  }
  return { ok: true };
}

function playbackDuration(item: PlaybackItem): number | undefined {
  if (item.startedAt === undefined || item.completedAt === undefined) {
    return undefined;
  }
  return Math.max(0, item.completedAt - item.startedAt);
}

function sanitizePlaybackError(error: string): string {
  return error ? "playback_failed" : "playback_failed";
}

function copyPlaybackItem(item: PlaybackItem): PlaybackItem {
  return { ...item };
}
