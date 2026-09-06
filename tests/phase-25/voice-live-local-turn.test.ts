import { describe, expect, it } from "vitest";

import type { SttProvider } from "../../src/lib/voice-runtime/stt/provider";
import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
} from "../../src/lib/voice/live/contract";
import {
  LOCAL_TURN_DESCRIPTOR,
  createLocalTurnProvider,
  type VoiceLiveBrain,
  type VoiceLiveBrainMessage,
} from "../../src/lib/voice/live/local-turn-provider";

// Voice bake-off — the existing local stack behind the live contract, with
// fakes for STT / brain / TTS / WAV I/O. Proves the turn flow, the Gate-only
// tool path, the epoch-guarded interrupt, and the honest capability claims.

class FakeSink implements VoiceLiveAudioSink {
  bytes = 0;
  rate = 0;
  cancels = 0;
  flushes = 0;
  write(pcm16: Uint8Array, sampleRateHz: number): void {
    this.bytes += pcm16.byteLength;
    this.rate = sampleRateHz;
  }
  flush(): void {
    this.flushes += 1;
  }
  cancel(): void {
    this.cancels += 1;
  }
}

function fakeStt(
  transcript: string,
  delayMs = 0,
): SttProvider & { calls: number } {
  const stt = {
    id: "fake-stt",
    kind: "local" as const,
    config: {} as SttProvider["config"],
    metadata_only: true as const,
    calls: 0,
    transcribe: async () => {
      stt.calls += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return { transcript } as Awaited<ReturnType<SttProvider["transcribe"]>>;
    },
    cancel: async () => {},
    health: async () =>
      ({ ok: true, degraded: false }) as Awaited<
        ReturnType<SttProvider["health"]>
      >,
  };
  return stt;
}

function fakeBrain(
  script: (messages: readonly VoiceLiveBrainMessage[]) => {
    text: string;
    tool?: { name: string; args: string };
  },
): VoiceLiveBrain & { seen: VoiceLiveBrainMessage[][] } {
  const brain = {
    seen: [] as VoiceLiveBrainMessage[][],
    generate: async (messages: readonly VoiceLiveBrainMessage[]) => {
      brain.seen.push([...messages]);
      const out = script(messages);
      return {
        text: out.text,
        tool_calls: out.tool
          ? [
              {
                call_id: "call_1",
                name: out.tool.name,
                arguments_json: out.tool.args,
              },
            ]
          : [],
        input_tokens: 10,
        output_tokens: 5,
        cost_usd: 0,
      };
    },
  };
  return brain;
}

const fakeTts = (durationMs = 1500) => ({
  synthesize: async (line: { id: string; text: string }) => ({
    output_ref: `mem://${line.id}`,
    duration_ms: durationMs,
  }),
});

const settle = async (rounds = 8) => {
  for (let i = 0; i < rounds; i += 1)
    await new Promise((r) => setTimeout(r, 0));
};

async function until(
  events: VoiceLiveEvent[],
  type: VoiceLiveEvent["type"],
  tries = 50,
): Promise<VoiceLiveEvent> {
  for (let i = 0; i < tries; i += 1) {
    const hit = events.find((e) => e.type === type);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error(
    `event ${type} never arrived: ${events.map((e) => e.type).join(",")}`,
  );
}

function harness(
  opts: {
    transcript?: string;
    brain?: VoiceLiveBrain;
    sttDelayMs?: number;
  } = {},
) {
  const events: VoiceLiveEvent[] = [];
  const sink = new FakeSink();
  const stt = fakeStt(
    opts.transcript ?? "Jarvis, check the build.",
    opts.sttDelayMs,
  );
  const brain =
    opts.brain ?? fakeBrain(() => ({ text: "The build is green." }));
  const written: string[] = [];
  const provider = createLocalTurnProvider({
    stt,
    brain,
    tts: fakeTts(),
    tmpDir: "/tmp",
    nowMs: () => 5_000,
    readWav: () => ({ pcm16: new Uint8Array(48_000), sample_rate_hz: 24_000 }),
    writeWav: (path) => {
      written.push(path);
    },
  });
  const start = () =>
    provider.startSession({
      session_id: "local-1",
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
  return { provider, start, events, sink, stt, written };
}

describe("local turn provider — descriptor honesty", () => {
  it("is local, free, cannot execute tools, and does NOT claim barge_in", () => {
    expect(LOCAL_TURN_DESCRIPTOR.privacy_class).toBe("local_audio");
    expect(LOCAL_TURN_DESCRIPTOR.cost_class).toBe("free_local");
    expect(LOCAL_TURN_DESCRIPTOR.tool_execution_allowed).toBe(false);
    expect(LOCAL_TURN_DESCRIPTOR.capabilities).toContain("offline_capable");
    expect(LOCAL_TURN_DESCRIPTOR.capabilities).not.toContain("barge_in");
    expect(LOCAL_TURN_DESCRIPTOR.capabilities).not.toContain("cloud");
  });
});

describe("local turn provider — the turn", () => {
  it("commit -> STT -> brain -> TTS -> sink, with transcripts and $0 usage", async () => {
    const h = harness();
    const session = await h.start();
    expect(h.events[0]).toMatchObject({ type: "session_started" });
    session.ingestAudio(new Uint8Array(24_000)); // 500 ms
    session.ingestAudio(new Uint8Array(24_000));
    session.commitAudio();
    await until(h.events, "assistant_audio_done");
    expect(h.written.length).toBe(1);
    expect(h.stt.calls).toBe(1);
    expect(
      h.events.find((e) => e.type === "transcript" && e.role === "user"),
    ).toMatchObject({ text: "Jarvis, check the build.", final: true });
    expect(
      h.events.find((e) => e.type === "transcript" && e.role === "assistant"),
    ).toMatchObject({ text: "The build is green." });
    expect(h.sink.bytes).toBe(48_000);
    expect(h.sink.rate).toBe(24_000);
    expect(h.sink.flushes).toBe(1);
    const snap = session.snapshot();
    expect(snap.responses).toBe(1);
    expect(snap.usage.estimated_usd).toBe(0);
    expect(snap.usage.input_tokens).toBe(10);
    expect(snap.assistant_speaking).toBe(false);
  });

  it("ignores empty commits and audio while muted", async () => {
    const h = harness();
    const session = await h.start();
    session.commitAudio();
    session.mute();
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    await settle();
    expect(h.stt.calls).toBe(0);
    session.unmute();
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    await until(h.events, "assistant_audio_done");
    expect(h.stt.calls).toBe(1);
  });
});

describe("local turn provider — tool calls go through the Gate only (§5)", () => {
  it("emits tool_call, waits for submitToolResult, then answers with the result in context", async () => {
    const brain = fakeBrain((messages) => {
      const hasToolResult = messages.some((m) => m.role === "tool");
      return hasToolResult
        ? { text: "The build passed with 664 files." }
        : {
            text: "",
            tool: { name: "check_build", args: '{"target":"main"}' },
          };
    });
    const h = harness({ brain });
    const session = await h.start();
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    const call = await until(h.events, "tool_call");
    expect(call).toMatchObject({
      call_id: "call_1",
      name: "check_build",
      arguments_json: '{"target":"main"}',
    });
    // No answer yet — the provider is waiting on the Gate.
    await settle();
    expect(h.events.some((e) => e.type === "assistant_audio_started")).toBe(
      false,
    );
    session.submitToolResult("call_1", '{"status":"green","files":664}');
    await until(h.events, "assistant_audio_done");
    expect(
      h.events.find((e) => e.type === "transcript" && e.role === "assistant"),
    ).toMatchObject({ text: "The build passed with 664 files." });
    const second = brain.seen[1]!;
    expect(
      second.some(
        (m) =>
          m.role === "tool" &&
          m.tool_call_id === "call_1" &&
          m.content.includes("green"),
      ),
    ).toBe(true);
    expect(session.snapshot().tool_calls).toBe(1);
  });
});

describe("local turn provider — interrupt is an epoch guard", () => {
  it("interrupt() during a slow turn cancels the sink and the turn never speaks", async () => {
    const h = harness({ sttDelayMs: 30 });
    const session = await h.start();
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    await new Promise((r) => setTimeout(r, 5));
    await session.interrupt();
    expect(h.sink.cancels).toBe(1);
    expect(h.events.find((e) => e.type === "interrupted")).toMatchObject({
      source: "orchestrator",
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(h.events.some((e) => e.type === "assistant_audio_started")).toBe(
      false,
    );
    expect(h.sink.bytes).toBe(0);
    expect(session.snapshot().interruptions).toBe(1);
    // The session stays usable for the next turn.
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    await until(h.events, "assistant_audio_done", 200);
  });

  it("stop() closes the session and cancels playback", async () => {
    const h = harness();
    const session = await h.start();
    await session.stop("user_stopped");
    expect(session.snapshot().state).toBe("closed");
    expect(h.sink.cancels).toBe(1);
    expect(h.events.at(-1)).toMatchObject({
      type: "session_ended",
      reason: "user_stopped",
    });
    session.ingestAudio(new Uint8Array(1000));
    session.commitAudio();
    await settle();
    expect(h.stt.calls).toBe(0);
  });
});
