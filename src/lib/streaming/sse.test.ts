import { describe, expect, it } from "vitest";
import { encodeSseEvent, parseSseEvents } from "./sse";
import type { StreamEvent } from "../providers";

describe("SSE stream protocol", () => {
  it("round-trips text, usage, error, done, and tool-call placeholder events", () => {
    const events: StreamEvent[] = [
      { type: "text", value: "hello" },
      { type: "usage", inputTokens: 10, outputTokens: 5 },
      {
        type: "tool_proposed",
        executionId: "exec-1",
        toolId: "fs.stat",
        toolName: "Stat Path",
        summary: "path: README.md",
      },
      {
        type: "tool_executed",
        executionId: "exec-1",
        toolId: "fs.stat",
        toolName: "Stat Path",
      },
      {
        type: "tool_completed",
        executionId: "exec-1",
        toolId: "fs.stat",
        toolName: "Stat Path",
        ok: true,
        status: "COMPLETED",
        message: "Path metadata read.",
      },
      {
        type: "tool_pending",
        executionId: "exec-1",
        toolId: "fs.read_file",
        toolName: "Read File",
        scopeHash: "README.md",
        requiredSafetyTag: "CONFIRM_ONCE",
        safetyTag: "ALLOW",
        summary: "path: README.md",
        approvalExpiresAt: 1_000,
        approvalToken: "approval-token",
      },
      { type: "tool_call_start", id: "tool-1", name: "lookup" },
      { type: "tool_call_delta", id: "tool-1", argsJsonChunk: '{"q"' },
      {
        type: "tool_call_complete",
        id: "tool-1",
        name: "lookup",
        argsJson: '{"q":"jarvis"}',
      },
      {
        type: "tool_call_error",
        id: "tool-2",
        message: "bad args",
        recoverable: true,
      },
      { type: "error", message: "temporary", recoverable: true },
      {
        type: "done",
        result: {
          content: "hello",
          modelId: "gpt-4o-mini",
          inputTokens: 10,
          outputTokens: 5,
          costUsd: 0.00001,
          latencyMs: 100,
          timeToFirstTokenMs: 25,
        },
      },
    ];

    const encoded = events.map(encodeSseEvent).join("");
    expect(parseSseEvents(encoded)).toEqual({ events, remaining: "" });
  });

  it("keeps incomplete frames in the remaining buffer", () => {
    const first = encodeSseEvent({ type: "text", value: "hello" });
    const partial = 'data: {"type":"text","value":"wor';

    const parsed = parseSseEvents(first + partial);

    expect(parsed.events).toEqual([{ type: "text", value: "hello" }]);
    expect(parsed.remaining).toBe(partial);
  });

  it("serializes the StreamEvent type as the SSE event name", () => {
    expect(encodeSseEvent({ type: "text", value: "hello" })).toBe(
      'event: text\ndata: {"type":"text","value":"hello"}\n\n',
    );
  });

  it("ignores malformed frames without dropping later valid frames", () => {
    const valid = { type: "text", value: "safe" } as const;
    const encoded = `data: nope\n\n${encodeSseEvent(valid)}`;

    expect(parseSseEvents(encoded)).toEqual({
      events: [valid],
      remaining: "",
    });
  });

  it("ignores SSE heartbeat comment frames", () => {
    const valid = { type: "text", value: "awake" } as const;

    expect(parseSseEvents(`: ping\n\n${encodeSseEvent(valid)}`)).toEqual({
      events: [valid],
      remaining: "",
    });
  });
});
