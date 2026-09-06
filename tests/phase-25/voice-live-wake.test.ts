import { describe, expect, it } from "vitest";

import { isWakeWordProviderDetectionResult } from "../../src/lib/voice-runtime/wake-word/provider";
import { loadVoiceLiveConfig } from "../../src/lib/voice/live/config";
import type {
  VoiceLiveAudioSink,
  VoiceLiveProvider,
  VoiceLiveSession,
  VoiceLiveSessionOptions,
  VoiceLiveStopReason,
} from "../../src/lib/voice/live/contract";
import { VoiceLiveOrchestrator } from "../../src/lib/voice/live/orchestrator";
import {
  WakeActivationLoop,
  rmsPcm16,
  upsample16kTo24k,
  type WakeLoopEvent,
  type WakeMicSource,
} from "../../src/lib/voice/live/wake-activation";
import {
  OPENWAKEWORD_PROVIDER_ID,
  createOpenWakeWordProvider,
  type DetectorHandle,
} from "../../src/lib/voice/live/wake-word-openwakeword";

// Voice bake-off §20 — wake word against the frozen Phase 14 seam, with a
// fake detector process and a fake microphone: no python, no mic, no audio.

class FakeDetector implements DetectorHandle {
  frames = 0;
  killed = false;
  private line: ((l: string) => void) | null = null;
  private exit: ((c: number | null) => void) | null = null;
  constructor(private readonly fireAfterFrames: number | null = null) {}
  write(): void {
    this.frames += 1;
    if (this.fireAfterFrames !== null && this.frames === this.fireAfterFrames) {
      this.line?.(
        JSON.stringify({
          detected: true,
          score: 0.91,
          model: "hey_jarvis_v0.1",
          latency_ms: 4.2,
        }),
      );
    }
  }
  onLine(cb: (l: string) => void): void {
    this.line = cb;
    setTimeout(
      () =>
        this.line?.(JSON.stringify({ ready: true, model: "hey_jarvis_v0.1" })),
      0,
    );
  }
  onExit(cb: (c: number | null) => void): void {
    this.exit = cb;
  }
  kill(): void {
    this.killed = true;
    this.exit?.(null);
  }
  say(obj: Record<string, unknown>): void {
    this.line?.(JSON.stringify(obj));
  }
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const frame = (amplitude: number, samples = 1280): Uint8Array => {
  const out = new Uint8Array(samples * 2);
  const v = new DataView(out.buffer);
  for (let i = 0; i < samples; i += 1)
    v.setInt16(i * 2, i % 2 === 0 ? amplitude : -amplitude, true);
  return out;
};

describe("openWakeWord provider — frozen seam conformance and kill-drills", () => {
  it("arms a local detector, feeds frames, and resolves a metadata-only detection", async () => {
    let det: FakeDetector | null = null;
    const states: string[] = [];
    const wake = createOpenWakeWordProvider({
      spawnDetector: () => (det = new FakeDetector(3)),
      onState: (s) => states.push(s),
      nowMs: () => 1000,
    });
    expect(wake.id).toBe(OPENWAKEWORD_PROVIDER_ID);
    expect(wake.kind).toBe("local");
    await wake.arm();
    await tick();
    expect(states).toEqual(["standby"]);
    const pending = wake.detect({ metadata_only: true });
    wake.feed(frame(0));
    wake.feed(frame(0));
    wake.feed(frame(0));
    const result = await pending;
    expect(isWakeWordProviderDetectionResult(result)).toBe(true);
    expect(result).toMatchObject({
      provider_id: OPENWAKEWORD_PROVIDER_ID,
      wake_detected: true,
      confidence_band: "high",
      latency_ms: 4,
      degraded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/audio|pcm|waveform/);
    expect(states.at(-1)).toBe("active");
    await wake.disarm();
    expect(det!.killed).toBe(true);
    expect(wake.isArmed()).toBe(false);
  });

  it("refuses to detect when not armed, times out to wake_detected:false, and fails closed on detector errors", async () => {
    let det: FakeDetector | null = null;
    const wake = createOpenWakeWordProvider({
      spawnDetector: () => (det = new FakeDetector()),
      nowMs: () => 5,
    });
    await expect(wake.detect({ metadata_only: true })).rejects.toThrow(
      /not armed/,
    );
    await wake.arm();
    const timedOut = await wake.detect({ metadata_only: true, timeout_ms: 10 });
    expect(timedOut).toMatchObject({
      wake_detected: false,
      confidence_band: "low",
    });
    const pending = wake.detect({ metadata_only: true });
    det!.say({ error: "wake model not found" });
    await expect(pending).rejects.toThrow(/wake model not found/);
    expect((await wake.health()).ok).toBe(false);
    await wake.disarm();
  });

  it("disarm rejects a pending detect and cancel clears it", async () => {
    const wake = createOpenWakeWordProvider({
      spawnDetector: () => new FakeDetector(),
    });
    await wake.arm();
    const p = wake.detect({ metadata_only: true });
    await wake.disarm();
    await expect(p).rejects.toThrow(/disarmed/);
  });
});

describe("wake activation helpers", () => {
  it("upsamples 16k -> 24k by 1.5x and measures RMS", () => {
    const f = frame(1000, 160); // 10 ms
    expect(upsample16kTo24k(f).byteLength).toBe(240 * 2);
    expect(Math.round(rmsPcm16(f))).toBe(1000);
    expect(rmsPcm16(frame(0, 160))).toBe(0);
  });
});

// ---- the loop ---------------------------------------------------------------

class FakeSession implements VoiceLiveSession {
  readonly session_id: string;
  ingested = 0;
  commits = 0;
  stopped: VoiceLiveStopReason | null = null;
  constructor(
    readonly provider_id: string,
    private readonly opts: VoiceLiveSessionOptions,
  ) {
    this.session_id = opts.session_id;
  }
  inputSampleRateHz(): number {
    return 24_000;
  }
  ingestAudio(pcm16: Uint8Array): void {
    this.ingested += pcm16.byteLength;
  }
  commitAudio(): void {
    this.commits += 1;
    setTimeout(() => {
      this.opts.on_event({
        type: "transcript",
        role: "user",
        text: "check the build",
        final: true,
      });
      this.opts.on_event({
        type: "assistant_audio_started",
        response_id: "r1",
        first_audio_latency_ms: 50,
      });
      this.opts.on_event({
        type: "assistant_audio_done",
        response_id: "r1",
        audio_ms: 100,
      });
    }, 5);
  }
  async interrupt(): Promise<void> {}
  submitToolResult(): void {}
  mute(): void {}
  unmute(): void {}
  async stop(reason: VoiceLiveStopReason): Promise<void> {
    this.stopped = reason;
    this.opts.on_event({ type: "session_ended", reason, at_ms: 1 });
  }
  snapshot() {
    return {
      session_id: this.session_id,
      provider_id: this.provider_id,
      state: (this.stopped ? "closed" : "open") as "open" | "closed",
      assistant_speaking: false,
      muted: false,
      interruptions: 0,
      tool_calls: 0,
      responses: this.commits,
      started_at_ms: 0,
      ended_at_ms: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        input_text_tokens: 0,
        input_audio_tokens: 0,
        cached_input_tokens: 0,
        output_text_tokens: 0,
        output_audio_tokens: 0,
        estimated_usd: 0,
      },
      metadata_only: true as const,
    };
  }
}

function localProvider() {
  const sessions: FakeSession[] = [];
  const p: VoiceLiveProvider & { sessions: FakeSession[] } = {
    sessions,
    descriptor: {
      provider_id: "local-mlx-turn",
      display_name: "local",
      privacy_class: "local_audio",
      cost_class: "free_local",
      capabilities: ["local", "offline_capable"],
      tool_execution_allowed: false,
      metadata_only: true,
    },
    health: async () => ({ ok: true, degraded: false, metadata_only: true }),
    startSession: async (opts) => {
      const s = new FakeSession("local-mlx-turn", opts);
      sessions.push(s);
      opts.on_event({ type: "session_started", at_ms: 1 });
      return s;
    },
  };
  return p;
}

// quiet -> (detector fires on 3rd quiet frame) -> loud speech -> silence -> quiet forever
function fakeMic(): WakeMicSource & { stopped: boolean } {
  const src = {
    stopped: false,
    frames: async function* () {
      for (let i = 0; i < 4 && !src.stopped; i += 1) {
        yield frame(0);
        await tick(5);
      }
      await tick(30); // let activate() resolve and the phase become "listening"
      for (let i = 0; i < 6 && !src.stopped; i += 1) {
        yield frame(2000);
        await tick(5);
      } // 480 ms speech
      for (let i = 0; i < 14 && !src.stopped; i += 1) {
        yield frame(0);
        await tick(5);
      } // 1120 ms silence -> commit
      while (!src.stopped) {
        yield frame(0);
        await tick(20);
      }
    },
    stop: () => {
      src.stopped = true;
    },
  };
  return src;
}

const sink: VoiceLiveAudioSink = { write() {}, flush() {}, cancel() {} };

describe("wake activation loop — §20 flow with the frozen seam, fail-closed", () => {
  it("refuses to open the microphone when wake word is disabled (config default)", async () => {
    const orchestrator = new VoiceLiveOrchestrator({
      config: loadVoiceLiveConfig({}),
      providers: [localProvider()],
      budgetPath: null,
    });
    const loop = new WakeActivationLoop({
      config: loadVoiceLiveConfig({}),
      wake: createOpenWakeWordProvider({
        spawnDetector: () => new FakeDetector(),
      }),
      orchestrator,
      mic: fakeMic(),
      audio_sink: sink,
    });
    await expect(loop.start()).rejects.toThrow(/disabled/);
  });

  it("wake -> activate (routed, local) -> mic frames to the session -> end-of-turn commit -> answer -> follow-up idle -> session sleeps -> stopped", async () => {
    const config = loadVoiceLiveConfig({ JARVIS_WAKE_WORD_ENABLED: "true" });
    const local = localProvider();
    const orchestrator = new VoiceLiveOrchestrator({
      config,
      providers: [local],
      budgetPath: null,
    });
    const det = new FakeDetector(3);
    const wake = createOpenWakeWordProvider({ spawnDetector: () => det });
    const mic = fakeMic();
    const events: WakeLoopEvent[] = [];
    const loop = new WakeActivationLoop({
      config,
      wake,
      orchestrator,
      mic,
      audio_sink: sink,
      once: true,
      onEvent: (e) => events.push(e),
      endOfTurn: {
        rmsThreshold: 600,
        minSpeechMs: 250,
        silenceMs: 800,
        maxTurnMs: 12_000,
      },
      followUpWindowMs: 150,
    });
    await loop.start();
    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(["standby", "wake", "activated"]);
    expect(types).toContain("turn_committed");
    expect(types).toContain("session_ended");
    expect(types.at(-1)).toBe("stopped");
    expect(events.find((e) => e.type === "activated")).toMatchObject({
      provider_id: "local-mlx-turn",
      reason: "default_local",
    });
    const s = local.sessions[0]!;
    expect(s.commits).toBe(1);
    expect(s.ingested).toBeGreaterThan(0);
    expect(s.stopped).toBe("wake_sleep");
    expect(det.killed).toBe(true);
    expect(mic.stopped).toBe(true);
  });

  it("emergency stop ends the session, closes the mic, and disarms", async () => {
    const config = loadVoiceLiveConfig({ JARVIS_WAKE_WORD_ENABLED: "true" });
    const local = localProvider();
    const orchestrator = new VoiceLiveOrchestrator({
      config,
      providers: [local],
      budgetPath: null,
    });
    const det = new FakeDetector();
    const mic = fakeMic();
    const loop = new WakeActivationLoop({
      config,
      wake: createOpenWakeWordProvider({ spawnDetector: () => det }),
      orchestrator,
      mic,
      audio_sink: sink,
    });
    const run = loop.start();
    await tick(20);
    await loop.stop();
    await run;
    expect(mic.stopped).toBe(true);
    expect(det.killed).toBe(true);
    expect(loop.snapshot().running).toBe(false);
  });
});
