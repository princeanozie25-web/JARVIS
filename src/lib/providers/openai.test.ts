import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "./types";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("../runtime/config", () => ({
  config: {
    openai: { apiKey: "test-openai-key" },
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

async function collect(
  events: AsyncIterable<StreamEvent>,
): Promise<StreamEvent[]> {
  const collected: StreamEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

async function* streamChunks(chunks: unknown[]): AsyncIterable<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("OpenAIProvider streaming", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("emits text, usage, and done events from streamed chat chunks", async () => {
    const { OpenAIProvider } = await import("./openai");
    createMock.mockResolvedValue(
      streamChunks([
        {
          model: "gpt-4o-mini-actual",
          choices: [{ delta: { content: "Hel" } }],
        },
        {
          choices: [{ delta: { content: "lo" } }],
        },
        {
          usage: { prompt_tokens: 11, completion_tokens: 7 },
          choices: [{ delta: {} }],
        },
      ]),
    );

    const provider = new OpenAIProvider("test-key");
    const stream = await provider.stream([{ role: "user", content: "Hi" }], {
      model: "gpt-4o-mini",
    });

    await expect(collect(stream.events)).resolves.toMatchObject([
      { type: "text", value: "Hel" },
      { type: "text", value: "lo" },
      { type: "usage", inputTokens: 11, outputTokens: 7 },
      {
        type: "done",
        result: {
          content: "Hello",
          modelId: "gpt-4o-mini-actual",
          inputTokens: 11,
          outputTokens: 7,
        },
      },
    ]);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        stream_options: { include_usage: true },
      }),
      expect.objectContaining({ signal: undefined }),
    );
  });

  it("emits a recoverable error and stops when the stream is aborted", async () => {
    const { OpenAIProvider } = await import("./openai");
    const ac = new AbortController();
    createMock.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: "first" } }] };
        ac.abort("stop");
        throw new DOMException("The operation was aborted.", "AbortError");
      })(),
    );

    const provider = new OpenAIProvider("test-key");
    const stream = await provider.stream([{ role: "user", content: "Hi" }], {
      model: "gpt-4o-mini",
      signal: ac.signal,
    });

    const events = await collect(stream.events);

    expect(events).toEqual([
      { type: "text", value: "first" },
      {
        type: "error",
        message: "The operation was aborted.",
        recoverable: true,
      },
    ]);
  });
});
