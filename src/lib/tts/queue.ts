import {
  evaluateSpeechSafetyPolicy,
  type SpeechSafetyPolicyDecision,
} from "./safety-policy";
import type {
  SpeechChunk,
  SpeechQueueItem,
  SpeechQueueItemStatus,
  SpeechQueueTelemetryEvent,
  SpeechSynthesisInputSource,
  SpeechSynthesisRefusalReason,
} from "./types";

export type SpeechQueueRejectionReason =
  | SpeechSynthesisRefusalReason
  | "transcript_blocked";

export interface SpeechQueueManagerOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (event: SpeechQueueTelemetryEvent) => void;
}

export type SpeechQueueEnqueueResult =
  | { ok: true; item: SpeechQueueItem }
  | {
      ok: false;
      reason: SpeechQueueRejectionReason;
      decision?: SpeechSafetyPolicyDecision;
    };

type SpeechQueueValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: SpeechQueueRejectionReason;
      decision?: SpeechSafetyPolicyDecision;
    };

const ACTIVE_STATUSES = new Set<SpeechQueueItemStatus>([
  "synthesizing",
  "ready",
  "playing",
]);

const TERMINAL_STATUSES = new Set<SpeechQueueItemStatus>([
  "completed",
  "failed",
  "cancelled",
]);

export class InMemorySpeechQueueManager {
  private readonly items = new Map<string, SpeechQueueItem>();
  private readonly order: string[] = [];

  constructor(private readonly opts: SpeechQueueManagerOptions = {}) {}

  enqueue(chunk: SpeechChunk): SpeechQueueEnqueueResult {
    const validation = validateSpeechChunk(chunk);
    if (!validation.ok) return validation;

    const item: SpeechQueueItem = {
      id: this.newId(),
      chunkId: chunk.id,
      text: chunk.text,
      status: "queued",
      createdAt: this.now(),
    };
    this.items.set(item.id, item);
    this.order.push(item.id);
    this.emit({
      eventType: "tts_queue_item_enqueued",
      itemId: item.id,
      chunkId: item.chunkId,
      status: item.status,
      success: true,
    });
    return { ok: true, item: copyItem(item) };
  }

  startNext(): SpeechQueueItem | null {
    if (this.getActiveItem()) return null;

    const next = this.findFirstByStatus("queued");
    if (!next) return null;

    next.status = "synthesizing";
    next.startedAt = this.now();
    return copyItem(next);
  }

  complete(itemId: string): SpeechQueueItem | null {
    return this.finishItem(itemId, "completed");
  }

  fail(itemId: string, error: string): SpeechQueueItem | null {
    return this.finishItem(itemId, "failed", sanitizeQueueError(error));
  }

  cancelItem(itemId: string): SpeechQueueItem | null {
    const item = this.items.get(itemId);
    if (!item) return null;
    if (TERMINAL_STATUSES.has(item.status)) return copyItem(item);

    item.status = "cancelled";
    item.completedAt = this.now();
    this.emit({
      eventType: "tts_queue_item_cancelled",
      itemId: item.id,
      chunkId: item.chunkId,
      status: item.status,
      success: false,
      error: "cancelled",
    });
    return copyItem(item);
  }

  cancelAll(): SpeechQueueItem[] {
    const cancelled: SpeechQueueItem[] = [];
    for (const item of this.itemsInOrder()) {
      if (TERMINAL_STATUSES.has(item.status)) continue;
      const result = this.cancelItem(item.id);
      if (result) cancelled.push(result);
    }
    return cancelled;
  }

  clearCompleted(): number {
    const removable = this.itemsInOrder().filter(
      (item) => item.status === "completed",
    );
    for (const item of removable) {
      this.items.delete(item.id);
      const index = this.order.indexOf(item.id);
      if (index >= 0) this.order.splice(index, 1);
    }

    this.emit({
      eventType: "tts_queue_cleared",
      success: true,
      clearedCount: removable.length,
    });
    return removable.length;
  }

  getItem(itemId: string): SpeechQueueItem | null {
    const item = this.items.get(itemId);
    return item ? copyItem(item) : null;
  }

  getActiveItem(): SpeechQueueItem | null {
    const active = this.itemsInOrder().find((item) =>
      ACTIVE_STATUSES.has(item.status),
    );
    return active ? copyItem(active) : null;
  }

  listItems(): SpeechQueueItem[] {
    return this.itemsInOrder().map(copyItem);
  }

  private finishItem(
    itemId: string,
    status: Extract<SpeechQueueItemStatus, "completed" | "failed">,
    error?: string,
  ): SpeechQueueItem | null {
    const item = this.items.get(itemId);
    if (!item) return null;
    if (TERMINAL_STATUSES.has(item.status)) return copyItem(item);

    item.status = status;
    item.completedAt = this.now();
    item.error = error;
    return copyItem(item);
  }

  private findFirstByStatus(
    status: SpeechQueueItemStatus,
  ): SpeechQueueItem | null {
    return this.itemsInOrder().find((item) => item.status === status) ?? null;
  }

  private itemsInOrder(): SpeechQueueItem[] {
    return this.order.flatMap((id) => {
      const item = this.items.get(id);
      return item ? [item] : [];
    });
  }

  private emit(event: SpeechQueueTelemetryEvent): void {
    this.opts.emitTelemetry?.(event);
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

function validateSpeechChunk(chunk: SpeechChunk): SpeechQueueValidationResult {
  if (!chunk.text.trim()) {
    return { ok: false, reason: "empty_text" };
  }
  if (containsTranscriptTag(chunk.text)) {
    return { ok: false, reason: "transcript_blocked" };
  }

  const source = chunk.source as SpeechSynthesisInputSource;
  const decision = evaluateSpeechSafetyPolicy({
    text: chunk.text,
    source,
  });
  if (!decision.allowed) {
    return {
      ok: false,
      reason: decision.reason ?? "assistant_prose_required",
      decision,
    };
  }

  return { ok: true };
}

function containsTranscriptTag(text: string): boolean {
  return /<\/?transcript\b|voice_transcript:|transcript:/i.test(text);
}

function sanitizeQueueError(error: string): string {
  return error ? "queue_item_failed" : "queue_item_failed";
}

function copyItem(item: SpeechQueueItem): SpeechQueueItem {
  return { ...item };
}
