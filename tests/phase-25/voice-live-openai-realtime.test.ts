import { describe, expect, it } from "vitest";

import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
} from "../../src/lib/voice/live/contract";
import {
  OPENAI_REALTIME_DESCRIPTOR,
  OpenAiRealtimeError,
  createOpenAiRealtimeProvider,
  type RealtimeSocket,
} from "../../src/lib/voice/live/openai-realtime-engine";
import { estimateRealtimeUsd } from "../../src/lib/voice/live/pricing";

// Voice bake-off — OpenAI Realtime engine conformance + kill-drills, run with
// a fake socket: NO network, NO key on disk. Proves the governance and privacy
// invariants of the live contract before any live test happens.

const FAKE_KEY = "sk-test-DO-NOT-LEAK-0123456789";

class FakeSocket implements RealtimeSocket {
  readonly sent: Record<string, unknown>[] = [];
  readonly url: string;
  readonly protocols: readonly string[];
  closed: { code?: number; reason?: string } | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((data: string) => void) | null = null;
  onerror: ((message: string) => void) | null = null;
  onclose: ((code: number, reason: string) => void) | null = null;
  constructor(
    url: string,
    protocols: readonly string[],
    private readonly mode: "open" | "error" | "close" = "open",
  ) {
    this.url = url;
    this.protocols = protocols;
    setTimeout(() => {
      if (this.mode === "open") this.onopen?.();
      else if (this.mode === "error") this.onerror?.("boom");
      else this.onclose?.(1006, "gone");
    }, 0);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }
  server(event: Record<string, unknown>): void {
    this.onmessage?.(JSON.stringify(event));
  }
}

class FakeSink implements VoiceLiveAudioSink {
  bytes = 0;
  writes = 0;
  cancels = 0;
  flushes = 0;
  rate = 0;
  write(pcm16: Uint8Array, sampleRateHz: number): void {
    this.bytes += pcm16.byteLength;
    this.writes += 1;
    this.rate = sampleRateHz;
  }
  flush(): void {
    this.flushes += 1;
  }
  cancel(): void {
    this.cancels += 1;
  }
}

function harness(mode: "open" | "error" | "close" = "open") {
  let socket: FakeSocket | null = null;
  const events: VoiceLiveEvent[] = [];
  const sink = new FakeSink();
  let now = 1_000;
  const provider = createOpenAiRealtimeProvider({
    env: { OPENAI_API_KEY: FAKE_KEY },
    socketFactory: (url, protocols) => {
      socket = new FakeSocket(url, protocols, mode);
      return socket;
    },
    nowMs: () => now,
  });
  const start = () =>
    provider.startSession({
      session_id: "s1",
      instructions: "You are JARVIS.",
      tools: [
        {
          name: "check_build",
          description: "Check the build",
          parameters: { type: "object", properties: {} },
        },
      ],
      audio_sink: sink,
      on_event: (e) => events.push(e),
    });
  return {
    provider,
    start,
    events,
    sink,
    socket: () => socket!,
    tick: (ms: number) => (now += ms),
  };
}

const audioB64 = (bytes: number) => Buffer.alloc(bytes, 1).toString("base64");

describe("OpenAI Realtime engine — credentials and kill switches", () => {
  it("is a cloud, metered provider that can never execute tools", () => {
    expect(OPENAI_REALTIME_DESCRIPTOR.privacy_class).toBe("cloud_audio");
    expect(OPENAI_REALTIME_DESCRIPTOR.cost_class).toBe("metered_cloud");
    expect(OPENAI_REALTIME_DESCRIPTOR.tool_execution_allowed).toBe(false);
    expect(OPENAI_REALTIME_DESCRIPTOR.capabilities).toContain("barge_in");
  });

  it("fails closed with credential_missing when OPENAI_API_KEY is absent (§23)", async () => {
    const provider = createOpenAiRealtimeProvider({ env: {} });
    expect(await provider.health()).toMatchObject({
      ok: false,
      error_class: "credential_missing",
    });
    await expect(
      provider.startSession({
        session_id: "s",
        audio_sink: new FakeSink(),
        on_event: () => {},
      }),
    ).rejects.toMatchObject({ error_class: "credential_missing" });
  });

  it("honours the JARVIS_OPENAI_REALTIME_ENABLED=false kill switch", async () => {
    const provider = createOpenAiRealtimeProvider({
      env: {
        OPENAI_API_KEY: FAKE_KEY,
        JARVIS_OPENAI_REALTIME_ENABLED: "false",
      },
    });
    expect(await provider.health()).toMatchObject({
      ok: false,
      error_class: "disabled",
    });
  });

  it("fails closed on a socket error or close before open", async () => {
    await expect(harness("error").start()).rejects.toBeInstanceOf(
      OpenAiRealtimeError,
    );
    await expect(harness("close").start()).rejects.toMatchObject({
      error_class: "network_error",
    });
  });
});

describe("OpenAI Realtime engine — session wire protocol", () => {
  it("opens, configures the session, and never leaks the key into events or snapshots", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    expect(s.url).toContain("model=gpt-realtime-mini");
    expect(s.protocols).toEqual([
      "realtime",
      `openai-insecure-api-key.${FAKE_KEY}`,
    ]);
    const update = s.sent.find((e) => e.type === "session.update")!;
    expect(update).toBeTruthy();
    const sess = update.session as Record<string, unknown>;
    expect(sess.output_modalities).toEqual(["audio"]);
    expect((sess.tools as unknown[]).length).toBe(1);
    expect(h.events[0]).toMatchObject({ type: "session_started" });
    // The key must not appear anywhere observable.
    expect(JSON.stringify(h.events)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(session.snapshot())).not.toContain(FAKE_KEY);
    expect(session.inputSampleRateHz()).toBe(24_000);
  });

  it("streams audio to the sink, reports first-audio latency, and books usage at real prices", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    s.server({ type: "input_audio_buffer.speech_stopped" });
    h.tick(300);
    s.server({ type: "response.created", response: { id: "resp_1" } });
    s.server({
      type: "response.output_item.added",
      item: { id: "item_1", type: "message" },
    });
    s.server({
      type: "response.output_audio.delta",
      response_id: "resp_1",
      delta: audioB64(48_000),
    });
    s.server({
      type: "response.output_audio.delta",
      response_id: "resp_1",
      delta: audioB64(24_000),
    });
    expect(h.sink.bytes).toBe(72_000);
    expect(h.sink.rate).toBe(24_000);
    const started = h.events.find((e) => e.type === "assistant_audio_started");
    expect(started).toMatchObject({
      response_id: "resp_1",
      first_audio_latency_ms: 300,
    });

    s.server({
      type: "response.done",
      response: {
        id: "resp_1",
        usage: {
          input_token_details: {
            text_tokens: 100,
            audio_tokens: 1000,
            cached_tokens_details: { text_tokens: 0, audio_tokens: 0 },
          },
          output_token_details: { text_tokens: 50, audio_tokens: 2000 },
        },
      },
    });
    const done = h.events.find((e) => e.type === "assistant_audio_done");
    expect(done).toMatchObject({ response_id: "resp_1", audio_ms: 1500 });
    const usage = h.events.find((e) => e.type === "usage");
    const expectedUsd = estimateRealtimeUsd(
      {
        input_text_tokens: 100,
        input_audio_tokens: 1000,
        cached_text_tokens: 0,
        cached_audio_tokens: 0,
        output_text_tokens: 50,
        output_audio_tokens: 2000,
      },
      "gpt-realtime-mini",
    );
    expect(usage).toMatchObject({
      usage: {
        input_audio_tokens: 1000,
        output_audio_tokens: 2000,
        estimated_usd: expectedUsd,
      },
    });
    // (100*0.6 + 1000*10 + 50*2.4 + 2000*20)/1e6 = 0.05018
    expect(expectedUsd).toBeCloseTo(0.05018, 5);
    expect(session.snapshot().usage.estimated_usd).toBeCloseTo(0.05018, 5);
    expect(h.sink.flushes).toBe(1);
  });

  it("user barge-in (server VAD) cancels local playback and records audio already played", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    s.server({ type: "response.created", response: { id: "resp_2" } });
    s.server({
      type: "response.output_item.added",
      item: { id: "item_2", type: "message" },
    });
    s.server({ type: "response.output_audio.delta", delta: audioB64(48_000) }); // 1000 ms
    s.server({ type: "input_audio_buffer.speech_started" });
    expect(h.sink.cancels).toBe(1);
    const interrupted = h.events.find((e) => e.type === "interrupted");
    expect(interrupted).toMatchObject({
      response_id: "resp_2",
      audio_played_ms: 1000,
      source: "user_barge_in",
    });
    expect(session.snapshot().interruptions).toBe(1);
    expect(session.snapshot().assistant_speaking).toBe(false);
  });

  it("orchestrator interrupt() sends response.cancel + item.truncate at the played offset", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    s.server({ type: "response.created", response: { id: "resp_3" } });
    s.server({
      type: "response.output_item.added",
      item: { id: "item_3", type: "message" },
    });
    s.server({ type: "response.output_audio.delta", delta: audioB64(24_000) }); // 500 ms
    await session.interrupt();
    expect(s.sent.some((e) => e.type === "response.cancel")).toBe(true);
    expect(
      s.sent.find((e) => e.type === "conversation.item.truncate"),
    ).toMatchObject({
      item_id: "item_3",
      content_index: 0,
      audio_end_ms: 500,
    });
    expect(h.sink.cancels).toBe(1);
  });

  it("surfaces tool calls as events and NEVER executes them; only submitToolResult answers (§5)", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    s.server({
      type: "response.function_call_arguments.done",
      call_id: "call_9",
      name: "check_build",
      arguments: '{"target":"main"}',
    });
    const call = h.events.find((e) => e.type === "tool_call");
    expect(call).toMatchObject({
      call_id: "call_9",
      name: "check_build",
      arguments_json: '{"target":"main"}',
    });
    // Nothing was sent back on its own — the Gate decides.
    expect(s.sent.some((e) => e.type === "conversation.item.create")).toBe(
      false,
    );
    session.submitToolResult("call_9", '{"status":"green"}');
    expect(
      s.sent.find((e) => e.type === "conversation.item.create"),
    ).toMatchObject({
      item: {
        type: "function_call_output",
        call_id: "call_9",
        output: '{"status":"green"}',
      },
    });
    expect(s.sent.filter((e) => e.type === "response.create").length).toBe(1);
    expect(session.snapshot().tool_calls).toBe(1);
  });

  it("ingests PCM16 as base64 appends, drops audio while muted, and stops cleanly", async () => {
    const h = harness();
    const session = await h.start();
    const s = h.socket();
    session.ingestAudio(new Uint8Array([1, 2, 3, 4]));
    const append = s.sent.find((e) => e.type === "input_audio_buffer.append")!;
    expect(Buffer.from(append.audio as string, "base64")).toEqual(
      Buffer.from([1, 2, 3, 4]),
    );
    session.mute();
    session.ingestAudio(new Uint8Array([9, 9]));
    expect(
      s.sent.filter((e) => e.type === "input_audio_buffer.append").length,
    ).toBe(1);
    await session.stop("user_stopped");
    expect(session.snapshot().state).toBe("closed");
    expect(s.closed).toMatchObject({ code: 1000 });
    expect(h.events.at(-1)).toMatchObject({
      type: "session_ended",
      reason: "user_stopped",
    });
    expect(h.sink.cancels).toBe(1);
  });

  it("reports provider errors as bounded, secret-free events", async () => {
    const h = harness();
    await h.start();
    h.socket().server({
      type: "error",
      error: {
        type: "invalid_request_error",
        code: "x",
        message: `bad ${FAKE_KEY} ${"y".repeat(500)}`,
      },
    });
    const err = h.events.find((e) => e.type === "error")!;
    expect(err).toMatchObject({ error_class: "provider_error" });
    const message = (err as { message: string }).message;
    expect(message).not.toContain(FAKE_KEY);
    expect(message.length).toBeLessThanOrEqual(200);
  });
});
