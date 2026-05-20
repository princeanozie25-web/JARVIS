import { describe, expect, it } from "vitest";
import {
  InMemorySpeechQueueManager,
  type SpeechQueueEnqueueResult,
} from "./queue";
import type { SpeechChunk, SpeechQueueTelemetryEvent } from "./types";

function chunk(id: string, text = `Assistant prose for ${id}.`): SpeechChunk {
  return {
    id,
    text,
    index: Number(id.replace(/\D/g, "")) || 0,
    createdAt: 100,
    source: "assistant_prose",
  };
}

function expectEnqueued(result: SpeechQueueEnqueueResult) {
  expect(result.ok).toBe(true);
  if (!result.ok)
    throw new Error(`Expected enqueue to succeed: ${result.reason}`);
  return result.item;
}

function createManager() {
  let id = 0;
  let now = 1_000;
  const telemetry: SpeechQueueTelemetryEvent[] = [];
  return {
    telemetry,
    manager: new InMemorySpeechQueueManager({
      newId: () => `queue-${++id}`,
      now: () => now++,
      emitTelemetry: (event) => telemetry.push(event),
    }),
  };
}

describe("InMemorySpeechQueueManager", () => {
  it("enqueues chunks in order", () => {
    const { manager } = createManager();

    expectEnqueued(manager.enqueue(chunk("chunk-1", "First.")));
    expectEnqueued(manager.enqueue(chunk("chunk-2", "Second.")));

    expect(manager.listItems().map((item) => item.id)).toEqual([
      "queue-1",
      "queue-2",
    ]);
    expect(manager.listItems().map((item) => item.chunkId)).toEqual([
      "chunk-1",
      "chunk-2",
    ]);
    expect(manager.listItems().map((item) => item.status)).toEqual([
      "queued",
      "queued",
    ]);
  });

  it("allows only one active item", () => {
    const { manager } = createManager();
    expectEnqueued(manager.enqueue(chunk("chunk-1")));
    expectEnqueued(manager.enqueue(chunk("chunk-2")));

    expect(manager.startNext()).toMatchObject({
      id: "queue-1",
      status: "synthesizing",
      startedAt: 1_002,
    });
    expect(manager.startNext()).toBeNull();
    expect(manager.getActiveItem()).toMatchObject({
      id: "queue-1",
      status: "synthesizing",
    });
  });

  it("cancels an item", () => {
    const { manager, telemetry } = createManager();
    const item = expectEnqueued(
      manager.enqueue(chunk("chunk-1", "Cancel me.")),
    );

    expect(manager.cancelItem(item.id)).toMatchObject({
      id: item.id,
      status: "cancelled",
      completedAt: 1_001,
    });

    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "tts_queue_item_cancelled",
        itemId: item.id,
        chunkId: "chunk-1",
        status: "cancelled",
        success: false,
      }),
    );
  });

  it("cancels all non-terminal items", () => {
    const { manager } = createManager();
    expectEnqueued(manager.enqueue(chunk("chunk-1")));
    expectEnqueued(manager.enqueue(chunk("chunk-2")));
    manager.startNext();

    expect(manager.cancelAll().map((item) => item.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(manager.listItems().map((item) => item.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
  });

  it("clears completed items", () => {
    const { manager, telemetry } = createManager();
    const completed = expectEnqueued(manager.enqueue(chunk("chunk-1")));
    const cancelled = expectEnqueued(manager.enqueue(chunk("chunk-2")));
    const queued = expectEnqueued(manager.enqueue(chunk("chunk-3")));

    manager.startNext();
    manager.complete(completed.id);
    manager.cancelItem(cancelled.id);

    expect(manager.clearCompleted()).toBe(1);
    expect(manager.listItems()).toEqual([
      expect.objectContaining({ id: cancelled.id, status: "cancelled" }),
      expect.objectContaining({ id: queued.id, status: "queued" }),
    ]);
    expect(telemetry).toContainEqual({
      eventType: "tts_queue_cleared",
      success: true,
      clearedCount: 1,
    });
  });

  it("rejects empty and blocked content", () => {
    const { manager } = createManager();

    expect(manager.enqueue(chunk("empty", "   "))).toEqual({
      ok: false,
      reason: "empty_text",
    });
    expect(
      manager.enqueue(chunk("code", "```ts\nconsole.log('no')\n```")),
    ).toEqual({
      ok: false,
      reason: "code_block_blocked",
      decision: { allowed: false, reason: "code_block_blocked" },
    });
    expect(
      manager.enqueue(
        chunk("personal", "<personal_context>Private.</personal_context>"),
      ),
    ).toEqual({
      ok: false,
      reason: "personal_context_blocked",
      decision: { allowed: false, reason: "personal_context_blocked" },
    });
    expect(manager.enqueue(chunk("transcript", "transcript: hello"))).toEqual({
      ok: false,
      reason: "transcript_blocked",
    });
    expect(
      manager.enqueue({
        ...chunk("tool", "Tool output."),
        source: "tool_output",
      } as unknown as SpeechChunk),
    ).toEqual({
      ok: false,
      reason: "tool_output_blocked",
      decision: { allowed: false, reason: "tool_output_blocked" },
    });
    expect(
      manager.enqueue({
        ...chunk("audit", "Audit output."),
        source: "audit_runtime_output",
      } as unknown as SpeechChunk),
    ).toEqual({
      ok: false,
      reason: "audit_runtime_output_blocked",
      decision: { allowed: false, reason: "audit_runtime_output_blocked" },
    });
    expect(manager.listItems()).toEqual([]);
  });

  it("keeps queued text out of telemetry", () => {
    const { manager, telemetry } = createManager();
    const secretText = "This assistant prose must not appear in telemetry.";
    const item = expectEnqueued(manager.enqueue(chunk("chunk-1", secretText)));

    manager.cancelItem(item.id);
    manager.clearCompleted();

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("tts_queue_item_enqueued");
    expect(serialized).toContain("tts_queue_item_cancelled");
    expect(serialized).toContain("tts_queue_cleared");
    expect(serialized).not.toContain(secretText);
    expect(serialized).not.toContain("Assistant prose");
  });

  it("does not create audio buffers or playback payloads", () => {
    const { manager } = createManager();
    const item = expectEnqueued(manager.enqueue(chunk("chunk-1")));

    expect(item).not.toHaveProperty("audio");
    expect(item).not.toHaveProperty("audioBuffer");
    expect(item).not.toHaveProperty("playback");
  });
});
