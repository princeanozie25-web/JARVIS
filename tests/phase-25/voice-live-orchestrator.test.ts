import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  sanitizeVoiceTelemetryEvent,
  type VoiceTelemetryEvent,
} from "../../src/lib/voice-runtime/telemetry";
import { loadVoiceLiveConfig } from "../../src/lib/voice/live/config";
import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
  VoiceLiveProvider,
  VoiceLiveSession,
  VoiceLiveSessionOptions,
  VoiceLiveStopReason,
} from "../../src/lib/voice/live/contract";
import { VoiceLiveOrchestrator } from "../../src/lib/voice/live/orchestrator";

// Voice bake-off — orchestrator kill-drills: the wake-word boundary, automatic
// cloud->local fallback, the persisted budget cap, private mode, telemetry.

class FakeSession implements VoiceLiveSession {
  readonly session_id: string;
  stopped: VoiceLiveStopReason | null = null;
  ingested = 0;
  constructor(
    readonly provider_id: string,
    private readonly opts: VoiceLiveSessionOptions,
  ) {
    this.session_id = opts.session_id;
  }
  emit(event: VoiceLiveEvent): void {
    this.opts.on_event(event);
  }
  inputSampleRateHz(): number {
    return 24_000;
  }
  ingestAudio(pcm16: Uint8Array): void {
    this.ingested += pcm16.byteLength;
  }
  commitAudio(): void {}
  async interrupt(): Promise<void> {}
  submitToolResult(): void {}
  mute(): void {}
  unmute(): void {}
  async stop(reason: VoiceLiveStopReason): Promise<void> {
    this.stopped = reason;
    this.emit({ type: "session_ended", reason, at_ms: 1 });
  }
  snapshot() {
    return {
      session_id: this.session_id,
      provider_id: this.provider_id,
      state: this.stopped ? ("closed" as const) : ("open" as const),
      assistant_speaking: false,
      muted: false,
      interruptions: 0,
      tool_calls: 0,
      responses: 0,
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

function fakeProvider(
  id: string,
  privacy: "local_audio" | "cloud_audio",
  healthy = true,
) {
  const sessions: FakeSession[] = [];
  const provider: VoiceLiveProvider & { sessions: FakeSession[] } = {
    sessions,
    descriptor: {
      provider_id: id,
      display_name: id,
      privacy_class: privacy,
      cost_class: privacy === "cloud_audio" ? "metered_cloud" : "free_local",
      capabilities:
        privacy === "cloud_audio"
          ? ["speech_to_speech", "barge_in", "cloud"]
          : ["local", "offline_capable"],
      tool_execution_allowed: false,
      metadata_only: true,
    },
    health: async () => ({
      ok: healthy,
      degraded: false,
      ...(healthy ? {} : { error_class: "unavailable" as const }),
      metadata_only: true as const,
    }),
    startSession: async (opts) => {
      const s = new FakeSession(id, opts);
      sessions.push(s);
      s.emit({ type: "session_started", at_ms: 1 });
      return s;
    },
  };
  return provider;
}

const sink: VoiceLiveAudioSink = { write() {}, flush() {}, cancel() {} };
const tick = () => new Promise((r) => setTimeout(r, 0));

function build(
  env: Record<string, string> = {},
  budgetPath: string | null = null,
  cloudHealthy = true,
) {
  const local = fakeProvider("local-mlx-turn", "local_audio");
  const cloud = fakeProvider("openai-realtime", "cloud_audio", cloudHealthy);
  const telemetry: VoiceTelemetryEvent[] = [];
  const orch = new VoiceLiveOrchestrator({
    config: loadVoiceLiveConfig(env),
    providers: [local, cloud],
    telemetry: (e) => telemetry.push(e),
    budgetPath,
    now: () => new Date("2026-09-06T12:00:00Z"),
  });
  return { orch, local, cloud, telemetry };
}

describe("orchestrator — activate() is the provider-agnostic wake-word boundary", () => {
  it("returns one session handle and routes to local by default", async () => {
    const h = build();
    const events: VoiceLiveEvent[] = [];
    const a = await h.orch.activate({
      session_id: "s1",
      audio_sink: sink,
      on_event: (e) => events.push(e),
    });
    expect(a.provider_id).toBe("local-mlx-turn");
    expect(a.decision.reason).toBe("default_local");
    expect(a.session.provider_id).toBe("local-mlx-turn");
    expect(events[0]).toMatchObject({ type: "session_started" });
    a.session.ingestAudio(new Uint8Array(10));
    expect(h.local.sessions[0]!.ingested).toBe(10);
    expect(h.telemetry.map((e) => e.event_type)).toEqual([
      "voice_live.route.default_local",
      "voice_live.session_started",
    ]);
  });

  it("premium mode selects cloud; private mode never does", async () => {
    const h = build();
    const a = await h.orch.activate({
      session_id: "s2",
      audio_sink: sink,
      on_event: () => {},
      mode: "premium",
    });
    expect(a.provider_id).toBe("openai-realtime");
    const p = build({ JARVIS_VOICE_PRIVATE_MODE: "true" });
    const b = await p.orch.activate({
      session_id: "s3",
      audio_sink: sink,
      on_event: () => {},
      mode: "premium",
    });
    expect(b.provider_id).toBe("local-mlx-turn");
    expect(b.decision.reason).toBe("privacy_local_only");
    expect(p.cloud.sessions.length).toBe(0);
  });
});

describe("orchestrator — automatic cloud -> local fallback keeps the caller's handle", () => {
  it("swaps the engine under the same session on a transport error", async () => {
    const h = build();
    const events: VoiceLiveEvent[] = [];
    const a = await h.orch.activate({
      session_id: "s4",
      audio_sink: sink,
      on_event: (e) => events.push(e),
      mode: "premium",
    });
    expect(a.session.provider_id).toBe("openai-realtime");
    h.cloud.sessions[0]!.emit({
      type: "error",
      error_class: "network_error",
      message: "socket dropped",
    });
    await tick();
    await tick();
    expect(h.cloud.sessions[0]!.stopped).toBe("fallback");
    expect(h.local.sessions.length).toBe(1);
    expect(a.session.provider_id).toBe("local-mlx-turn");
    a.session.ingestAudio(new Uint8Array(7));
    expect(h.local.sessions[0]!.ingested).toBe(7);
    const types = h.telemetry.map((e) => e.event_type);
    expect(types).toContain("voice_live.error");
    expect(types).toContain("voice_live.fallback");
    expect(events.map((e) => e.type)).toEqual([
      "session_started",
      "error",
      "session_ended",
      "session_started",
    ]);
  });

  it("does not fall back on a local error, and only once for cloud", async () => {
    const h = build();
    const a = await h.orch.activate({
      session_id: "s5",
      audio_sink: sink,
      on_event: () => {},
    });
    h.local.sessions[0]!.emit({
      type: "error",
      error_class: "provider_error",
      message: "x",
    });
    await tick();
    expect(h.local.sessions.length).toBe(1);
    expect(a.session.provider_id).toBe("local-mlx-turn");
  });
});

describe("orchestrator — budget window persists and trips the hard cap", () => {
  it("accumulates cloud usage, survives a restart, and routes premium to local at the cap", async () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "jarvis-budget-")),
      "budget.json",
    );
    const h = build(
      {
        JARVIS_VOICE_LIVE_BUDGET_WARN_USD: "1",
        JARVIS_VOICE_LIVE_BUDGET_HARD_USD: "2",
      },
      path,
    );
    await h.orch.activate({
      session_id: "s6",
      audio_sink: sink,
      on_event: () => {},
      mode: "premium",
    });
    h.cloud.sessions[0]!.emit({
      type: "usage",
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        input_text_tokens: 0,
        input_audio_tokens: 0,
        cached_input_tokens: 0,
        output_text_tokens: 0,
        output_audio_tokens: 0,
        estimated_usd: 1.5,
      },
    });
    expect(h.orch.budget.read()).toMatchObject({
      window: "2026-09",
      usd: 1.5,
      sessions: 1,
    });

    // "restart": a fresh orchestrator over the same file sees the spend
    const r = build(
      {
        JARVIS_VOICE_LIVE_BUDGET_WARN_USD: "1",
        JARVIS_VOICE_LIVE_BUDGET_HARD_USD: "2",
      },
      path,
    );
    expect(r.orch.budget.read().usd).toBe(1.5);
    const warn = await r.orch.route("s7", "premium");
    expect(warn).toMatchObject({
      provider_id: "openai-realtime",
      budget_warning: true,
    });
    expect(r.cloud.sessions.length).toBe(0); // route() alone never starts a session
    r.orch.budget.add(0.6);
    const capped = await r.orch.route("s8", "premium");
    expect(capped).toMatchObject({
      provider_id: "local-mlx-turn",
      reason: "budget_hard_cap",
    });
  });
});

describe("orchestrator — telemetry is frozen-contract safe and carries no content", () => {
  it("every emitted event passes the Phase 14 sanitizer and never includes transcript text", async () => {
    const h = build();
    await h.orch.activate({
      session_id: "s9",
      audio_sink: sink,
      on_event: () => {},
      mode: "premium",
    });
    const s = h.cloud.sessions[0]!;
    s.emit({
      type: "transcript",
      role: "user",
      text: "SECRET PHRASE",
      final: true,
    });
    s.emit({
      type: "assistant_audio_started",
      response_id: "r",
      first_audio_latency_ms: 420,
    });
    s.emit({
      type: "interrupted",
      response_id: "r",
      audio_played_ms: 900,
      source: "user_barge_in",
    });
    s.emit({
      type: "tool_call",
      call_id: "c",
      name: "check_build",
      arguments_json: "{}",
    });
    await s.stop("user_stopped");
    for (const e of h.telemetry)
      expect(sanitizeVoiceTelemetryEvent(e).ok).toBe(true);
    expect(JSON.stringify(h.telemetry)).not.toContain("SECRET PHRASE");
    expect(
      h.telemetry.find((e) => e.event_type === "voice_live.first_audio"),
    ).toMatchObject({ latency_ms: 420, provider_id: "openai-realtime" });
    expect(
      h.telemetry.find((e) => e.event_type === "voice_live.interrupted"),
    ).toMatchObject({ cancellation_reason: "barge_in", duration_ms: 900 });
    expect(
      h.telemetry.find((e) => e.event_type === "voice_live.session_ended"),
    ).toBeTruthy();
  });

  it("reports no_provider_available when nothing is healthy instead of picking cloud silently", async () => {
    const h = build({ JARVIS_VOICE_PRIVATE_MODE: "true" });
    const dead = fakeProvider("local-mlx-turn", "local_audio", false);
    const orch = new VoiceLiveOrchestrator({
      config: loadVoiceLiveConfig({ JARVIS_VOICE_PRIVATE_MODE: "true" }),
      providers: [dead, h.cloud],
      budgetPath: null,
    });
    await expect(
      orch.activate({
        session_id: "s10",
        audio_sink: sink,
        on_event: () => {},
      }),
    ).rejects.toThrow(/no_provider_available/);
  });
});
