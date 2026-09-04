import { describe, expect, it, vi } from "vitest";

import { OllamaProvider } from "./ollama";
import type { StreamEvent } from "./types";

// E-037 — the local chat provider: fake-first conformance. No network.

vi.mock("../runtime/config", () => ({
  config: {
    ollama: { baseUrl: "http://127.0.0.1:11434" },
    openai: { apiKey: "" },
    anthropic: { apiKey: "" },
  },
}));

function ndjson(lines: object[]): Response {
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  });
}

async function collect(
  events: AsyncIterable<StreamEvent>,
): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

describe("OllamaProvider (E-037)", () => {
  it("streams text, usage and a zero-cost done result from NDJSON", async () => {
    const fetchImpl = vi.fn(async () =>
      ndjson([
        {
          model: "qwen3.5:9b-mlx",
          message: { role: "assistant", content: "Hel" },
          done: false,
        },
        {
          model: "qwen3.5:9b-mlx",
          message: { role: "assistant", content: "lo" },
          done: false,
        },
        {
          model: "qwen3.5:9b-mlx",
          message: { role: "assistant", content: "" },
          done: true,
          prompt_eval_count: 12,
          eval_count: 2,
        },
      ]),
    );
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { events } = await provider.stream(
      [{ role: "user", content: "hi" }],
      { model: "qwen3.5:9b-mlx" },
    );
    const out = await collect(events);
    expect(
      out
        .filter((e) => e.type === "text")
        .map((e) => (e as { value: string }).value),
    ).toEqual(["Hel", "lo"]);
    expect(out.find((e) => e.type === "usage")).toMatchObject({
      inputTokens: 12,
      outputTokens: 2,
    });
    const done = out.find((e) => e.type === "done") as Extract<
      StreamEvent,
      { type: "done" }
    >;
    expect(done.result.content).toBe("Hello");
    expect(done.result.modelId).toBe("qwen3.5:9b-mlx");
    expect(done.result.costUsd).toBe(0); // local is free, never the $0.001 fallback
    expect(typeof done.result.timeToFirstTokenMs).toBe("number");
    // request shape: loopback /api/chat, streaming, no secrets
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "qwen3.5:9b-mlx",
      stream: true,
    });
    expect(JSON.stringify(init.headers)).not.toMatch(
      /authorization|api[-_]?key/i,
    );
  });

  it("emits the same tool-call event triple the OpenAI provider does", async () => {
    const fetchImpl = vi.fn(async () =>
      ndjson([
        {
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              { function: { name: "fs.read", arguments: { path: "a.md" } } },
            ],
          },
          done: false,
        },
        {
          message: { role: "assistant", content: "" },
          done: true,
          prompt_eval_count: 5,
          eval_count: 1,
        },
      ]),
    );
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { events } = await provider.stream(
      [{ role: "user", content: "read a.md" }],
      {
        model: "qwen3.5:9b-mlx",
        tools: [
          {
            id: "fs.read",
            name: "fs.read",
            description: "read",
            inputSchema: { type: "object" },
          },
        ],
      },
    );
    const types = (await collect(events)).map((e) => e.type);
    expect(types).toEqual([
      "tool_call_start",
      "tool_call_delta",
      "tool_call_complete",
      "usage",
      "done",
    ]);
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ) as { tools: unknown[] };
    expect(body.tools).toHaveLength(1);
  });

  it("KILL-DRILL: an unreachable runtime yields one honest error event, no fallback, no fake reply", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: "http://127.0.0.1:1",
    });
    const { events } = await provider.stream(
      [{ role: "user", content: "hi" }],
      { model: "qwen3.5:9b-mlx" },
    );
    const out = await collect(events);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "error", recoverable: false });
    expect((out[0] as { message: string }).message).toContain(
      "ollama unreachable",
    );
    await expect(
      provider.generate([{ role: "user", content: "hi" }], { model: "x" }),
    ).rejects.toThrow(/unreachable/);
  });

  it("surfaces a runtime error line (e.g. model not found) as an error event", async () => {
    const fetchImpl = vi.fn(async () =>
      ndjson([{ error: "model 'nope' not found" }]),
    );
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { events } = await provider.stream(
      [{ role: "user", content: "hi" }],
      { model: "nope" },
    );
    const out = await collect(events);
    expect(out).toEqual([
      {
        type: "error",
        message: "ollama: model 'nope' not found",
        recoverable: false,
      },
    ]);
  });

  it("honours the caller's AbortSignal as a recoverable stop", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      void init;
      throw err;
    });
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const { events } = await provider.stream(
      [{ role: "user", content: "hi" }],
      { model: "x", signal: controller.signal },
    );
    const out = await collect(events);
    expect(out[0]).toMatchObject({ type: "error", recoverable: true });
  });
});
