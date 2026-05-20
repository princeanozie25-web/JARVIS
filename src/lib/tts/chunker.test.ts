import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../providers";
import {
  chunkAssistantProseText,
  TtsSentenceChunker,
  type SpeechChunkerResult,
} from "./chunker";

function expectAllowed(result: SpeechChunkerResult) {
  expect(result.blocked).toBe(false);
  if (result.blocked) throw new Error("Expected chunker result to be allowed");
  return result.chunks;
}

describe("TtsSentenceChunker", () => {
  it("flushes a chunk on terminal punctuation", () => {
    const chunker = new TtsSentenceChunker({ now: () => 1234 });

    const chunks = expectAllowed(chunker.pushText("Hello from JARVIS."));

    expect(chunks).toEqual([
      {
        id: "speech-chunk-0",
        text: "Hello from JARVIS.",
        index: 0,
        createdAt: 1234,
        source: "assistant_prose",
      },
    ]);
  });

  it("waits for the minimum character threshold before flushing", () => {
    const chunker = new TtsSentenceChunker({ minChunkChars: 10 });

    expect(expectAllowed(chunker.pushText("Hi. "))).toEqual([]);
    expect(expectAllowed(chunker.pushText("There friend."))).toEqual([
      {
        id: "speech-chunk-0",
        text: "Hi. There friend.",
        index: 0,
        createdAt: expect.any(Number),
        source: "assistant_prose",
      },
    ]);
  });

  it("flushes remaining prose when the stream finishes", () => {
    const chunker = new TtsSentenceChunker();

    expect(
      expectAllowed(chunker.pushText("No terminal punctuation yet")),
    ).toEqual([]);

    expect(expectAllowed(chunker.finish())).toEqual([
      {
        id: "speech-chunk-0",
        text: "No terminal punctuation yet",
        index: 0,
        createdAt: expect.any(Number),
        source: "assistant_prose",
      },
    ]);
  });

  it("keeps chunk ids monotonic and preserves ordering", () => {
    let now = 100;
    const chunker = new TtsSentenceChunker({
      now: () => now++,
      idPrefix: "tts",
    });

    const chunks = expectAllowed(chunker.pushText("First sentence. Second!"));

    expect(chunks.map((chunk) => chunk.id)).toEqual(["tts-0", "tts-1"]);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1]);
    expect(chunks.map((chunk) => chunk.createdAt)).toEqual([100, 101]);
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "First sentence.",
      "Second!",
    ]);
  });

  it("accepts typed assistant text stream events and ignores non-text events", () => {
    const chunker = new TtsSentenceChunker();
    const usageEvent: StreamEvent = {
      type: "usage",
      inputTokens: 12,
      outputTokens: 4,
    };

    expect(expectAllowed(chunker.pushStreamEvent(usageEvent))).toEqual([]);
    expect(
      expectAllowed(
        chunker.pushStreamEvent({ type: "text", value: "Streamed answer." }),
      ),
    ).toEqual([
      {
        id: "speech-chunk-0",
        text: "Streamed answer.",
        index: 0,
        createdAt: expect.any(Number),
        source: "assistant_prose",
      },
    ]);
  });

  it("preserves split stream text deltas until punctuation completes a chunk", () => {
    const chunker = new TtsSentenceChunker();

    expect(
      expectAllowed(chunker.pushStreamEvent({ type: "text", value: "Split " })),
    ).toEqual([]);
    expect(
      expectAllowed(
        chunker.pushStreamEvent({ type: "text", value: "stream sentence." }),
      ),
    ).toEqual([
      {
        id: "speech-chunk-0",
        text: "Split stream sentence.",
        index: 0,
        createdAt: expect.any(Number),
        source: "assistant_prose",
      },
    ]);
  });

  it("refuses restricted content classes", () => {
    const toolResult = new TtsSentenceChunker({
      source: "tool_output",
    }).pushText("Tool output should stay silent.");
    const runtimeResult = new TtsSentenceChunker({
      source: "audit_runtime_output",
    }).pushText("Runtime audit output should stay silent.");

    expect(toolResult).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "tool_output_blocked" },
    });
    expect(runtimeResult).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "audit_runtime_output_blocked" },
    });
  });

  it("blocks personal_context-tagged text", () => {
    const result = new TtsSentenceChunker().pushText(
      "<personal_context>Private note.</personal_context>",
    );

    expect(result).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "personal_context_blocked" },
    });
  });

  it("blocks code blocks", () => {
    const result = new TtsSentenceChunker().pushText(
      "```ts\nconsole.log('silent')\n```",
    );

    expect(result).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "code_block_blocked" },
    });
  });

  it("keeps refusing after blocked content is detected", () => {
    const chunker = new TtsSentenceChunker();

    expect(chunker.pushText("```ts\nconsole.log('silent')\n```")).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "code_block_blocked" },
    });
    expect(chunker.pushText("Later plain prose.")).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "code_block_blocked" },
    });
    expect(chunker.finish()).toEqual({
      blocked: true,
      decision: { allowed: false, reason: "code_block_blocked" },
    });
  });

  it("outputs speech chunks only without synthesis or playback payloads", () => {
    const result = chunkAssistantProseText("Plain assistant prose.");
    const chunks = expectAllowed(result);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).not.toHaveProperty("audio");
    expect(chunks[0]).not.toHaveProperty("playback");
  });
});
