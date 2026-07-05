import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createNarrationFailoverTelemetrySink,
  DEMO_SCRIPT_RECRUITER,
  findForbiddenTelemetryField,
  prepareDemoNarration,
  selectNarrationProvider,
  type DemoNarrationAudioCue,
  type DemoNarrationProvider,
  type DemoNarrationProviderId,
} from "@/lib/demo-director";
import { createRuntimeNarrationProviders } from "@/lib/demo-director/chatterbox";
import { DEMO_NARRATION_PROVIDER_IDS } from "@/lib/demo-director/narration";
import type { TelemetryEvent } from "@/lib/telemetry";
import {
  CANONICAL_TERMINAL_ENGINE_ID,
  CANONICAL_TTS_ENGINE_IDS,
  CANONICAL_TTS_ENGINE_PRIORITIES,
} from "@/lib/voice/tts-engine";
import {
  createPlaybackQueue,
  createVoiceRuntimeBridge,
  type SttProvider,
  type TtsProvider,
  type TtsProviderHealth,
  type TtsSynthesisResult,
  type VoicePlaybackRequestInput,
} from "@/lib/voice-runtime";

// E-011 — TTS consolidation invariants. ONE canonical engine-selection +
// failover layer (src/lib/voice/tts-engine) is consumed by BOTH voice
// subsystems; each subsystem keeps its own authority wrapper. The Phase 23
// Piper failover drill itself lives UNCHANGED in
// tests/demo-director/piper-fallback.test.ts and
// tests/video-extraction/phase-23-closeout.test.ts — this file asserts the
// consolidation around it.

const SHARED_LAYER_FILES = [
  "src/lib/voice/tts-engine/types.ts",
  "src/lib/voice/tts-engine/failover.ts",
  "src/lib/voice/tts-engine/registry.ts",
  "src/lib/voice/tts-engine/index.ts",
] as const;

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function narrationStub(
  provider_id: DemoNarrationProviderId,
  priority: number,
  ok: boolean,
  synthesizes: boolean,
): DemoNarrationProvider {
  const provider: DemoNarrationProvider = {
    provider_id,
    priority,
    health: async () => ({
      provider_id,
      ok,
      degraded: !ok,
      checked_at_ms: 1,
      metadata_only: true,
    }),
  };
  if (synthesizes) {
    provider.synthesize = async (line): Promise<DemoNarrationAudioCue> => ({
      audio_id: `audio:${line.line_id}`,
      line_id: line.line_id,
      provider_id,
      duration_ms: 1000,
      mime_type: "audio/wav",
      byte_length: 64,
      local_ref: `memory:${line.line_id}`,
      metadata_only: true,
      no_auto_play: true,
      no_voice_authority: true,
    });
  }
  return provider;
}

function fakeSttProvider(): SttProvider {
  return {
    id: "fake-local-stt",
    kind: "local",
    config: {
      provider_id: "fake-local-stt",
      provider_kind: "local",
      model_id: "fake-stt",
      max_audio_bytes: 1_000_000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    transcribe: vi.fn(async () => {
      throw new Error("not used in this suite");
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => ({
      provider_id: "fake-local-stt",
      ok: true,
      provider_kind: "local" as const,
      checked_at_ms: 0,
      degraded: false,
      metadata_only: true as const,
    })),
  };
}

function fakeTtsProvider(
  options: {
    readonly ok?: boolean;
    readonly synthesizeFails?: boolean;
  } = {},
): TtsProvider {
  const health: TtsProviderHealth = {
    provider_id: "fake-local-tts",
    ok: options.ok ?? true,
    provider_kind: "local",
    checked_at_ms: 0,
    degraded: false,
    metadata_only: true,
  };
  const result: TtsSynthesisResult = {
    request_id: "voice-playback-request-1",
    chunk: {
      chunk_id: "tts-chunk-1",
      provider_id: "fake-local-tts",
      voice_id: "fake-voice",
      duration_ms: 1100,
      size_bytes: 24000,
      degraded: false,
      output_ref: "C:/tmp/jarvis-tts.wav",
      metadata_only: true,
    },
    latency_ms: 5,
    degraded: false,
    metadata_only: true,
  };
  return {
    id: "fake-local-tts",
    kind: "local",
    config: {
      provider_id: "fake-local-tts",
      provider_kind: "local",
      voice_id: "fake-voice",
      max_input_chars: 1000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    synthesize: vi.fn(async () => {
      if (options.synthesizeFails) throw new Error("tts failed");
      return result;
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function createBridge(tts: TtsProvider) {
  const playbackQueue = createPlaybackQueue({
    max_queue_depth: 4,
    allow_sensitive_content: false,
    metadata_only: true,
  });
  return {
    playbackQueue,
    bridge: createVoiceRuntimeBridge({
      stt_provider: fakeSttProvider(),
      tts_provider: tts,
      playback_queue: playbackQueue,
      now_ms: () => 1000,
    }),
  };
}

function playbackInput(
  overrides: Partial<VoicePlaybackRequestInput> = {},
): VoicePlaybackRequestInput {
  return {
    request_id: "voice-playback-request-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    text: "Acknowledged. Local voice bridge is standing by.",
    content_class: "assistant_prose",
    requested_voice_id: "fake-voice",
    metadata_only: true,
    ...overrides,
  };
}

describe("I-E011-2 — one shared engine layer, both subsystems consume it", () => {
  it("demo narration and the PTT runtime-bridge both import the canonical layer", () => {
    expect(source("src/lib/demo-director/narration.ts")).toContain(
      "@/lib/voice/tts-engine",
    );
    expect(source("src/lib/voice-runtime/runtime-bridge.ts")).toContain(
      "@/lib/voice/tts-engine",
    );
  });

  it("no second engine-selection path remains in either subsystem", () => {
    const prioritySort = ".priority - right.priority";
    const narration = source("src/lib/demo-director/narration.ts");
    const bridge = source("src/lib/voice-runtime/runtime-bridge.ts");
    // The health-ordered chain walk lives ONLY in the shared failover module.
    expect(narration).not.toContain(prioritySort);
    expect(bridge).not.toContain(prioritySort);
    expect(source("src/lib/voice/tts-engine/failover.ts")).toContain(
      prioritySort,
    );
    // The bridge no longer runs its own inline health-gate/synth invocation.
    expect(bridge).not.toContain("options.tts_provider.health()");
    expect(bridge).not.toContain("options.tts_provider.synthesize(");
    expect(bridge).toContain("synthesizeOverEngineChain");
  });

  it("the engine registry (ids, order, priorities) is declared once and shared", () => {
    expect(DEMO_NARRATION_PROVIDER_IDS).toBe(CANONICAL_TTS_ENGINE_IDS);
    expect([...CANONICAL_TTS_ENGINE_IDS]).toEqual([
      "chatterbox-tts-server",
      "kokoro",
      "existing-local-fallback",
    ]);
    const providers = createRuntimeNarrationProviders();
    expect(providers.map((p) => p.provider_id)).toEqual([
      ...CANONICAL_TTS_ENGINE_IDS,
    ]);
    for (const provider of providers) {
      expect(provider.priority).toBe(
        CANONICAL_TTS_ENGINE_PRIORITIES[provider.provider_id],
      );
    }
  });
});

describe("I-E011-1 — Phase 23 drilled failover behaviour carried by the shared layer", () => {
  it("Chatterbox death falls through Kokoro to the Piper terminal slot, which synthesizes", async () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
    });
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        narrationStub("chatterbox-tts-server", 0, false, false),
        narrationStub("kokoro", 1, false, false),
        narrationStub(CANONICAL_TERMINAL_ENGINE_ID, 2, true, true),
      ],
      telemetry: sink,
    });

    expect(track.provider_id).toBe("existing-local-fallback");
    expect(track.audio_cues.length).toBe(track.lines.length);
    expect(track.audio_cues.length).toBeGreaterThan(0);
    expect(
      events
        .filter((e) => e.event_type === "voice_provider_failover")
        .map((e) => e.tool_name),
    ).toEqual(["chatterbox-tts-server", "kokoro"]);
    expect(
      events.find((e) => e.event_type === "voice_provider_selected")?.tool_name,
    ).toBe("existing-local-fallback");
  });

  it("still selects Chatterbox first when it is healthy (run-1 path unchanged)", async () => {
    const selected = await selectNarrationProvider([
      narrationStub("chatterbox-tts-server", 0, true, true),
      narrationStub("kokoro", 1, true, true),
      narrationStub(CANONICAL_TERMINAL_ENGINE_ID, 2, true, true),
    ]);
    expect(selected.provider.provider_id).toBe("chatterbox-tts-server");
    expect(selected.health).toHaveLength(1);
  });
});

describe("I-E011-3 — demo path still produces voice (and captions when all engines are down)", () => {
  it("returns the terminal provider with ZERO audio cues when every engine is down", async () => {
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        narrationStub("chatterbox-tts-server", 0, false, false),
        narrationStub("kokoro", 1, false, false),
        narrationStub(CANONICAL_TERMINAL_ENGINE_ID, 2, false, true),
      ],
    });
    expect(track.provider_id).toBe("existing-local-fallback");
    expect(track.audio_cues).toEqual([]);
    // Lines survive for the caption rendering path — no silent hard failure.
    expect(track.lines.length).toBeGreaterThan(0);
  });
});

describe("I-E011-4 — PTT path still produces voice through the shared layer", () => {
  it("synthesizes and queues playback when the local provider is healthy", async () => {
    const { bridge, playbackQueue } = createBridge(fakeTtsProvider());
    await expect(
      bridge.createVoicePlaybackRequest(playbackInput()),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: { tts_status: "queued_for_playback" },
    });
    expect(playbackQueue.snapshot().depth).toBe(1);
  });

  it("maps an unhealthy provider to tts_unavailable (unchanged failure surface)", async () => {
    const { bridge } = createBridge(fakeTtsProvider({ ok: false }));
    await expect(
      bridge.createVoicePlaybackRequest(playbackInput()),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["tts_unavailable"],
      snapshot: { tts_status: "failed" },
    });
  });

  it("maps a synthesis error to tts_failed (unchanged failure surface)", async () => {
    const { bridge } = createBridge(fakeTtsProvider({ synthesizeFails: true }));
    await expect(
      bridge.createVoicePlaybackRequest(playbackInput()),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["tts_failed"],
      snapshot: { tts_status: "failed" },
    });
  });
});

describe("I-E011-5 — authority stays in the subsystems; the engine layer carries none", () => {
  it("the shared layer never references consent, wake word, conversation mode, or playback policy", () => {
    const forbidden =
      /consent|wake[_-]?word|conversation|barge[_-]?in|auto[_-]?play|approval|human[_-]?gate/i;
    for (const file of SHARED_LAYER_FILES) {
      expect(source(file)).not.toMatch(forbidden);
    }
  });

  it("the shared layer imports from NO subsystem (mechanism only)", () => {
    for (const file of SHARED_LAYER_FILES) {
      const text = source(file);
      expect(text).not.toContain('from "@/lib/demo-director');
      expect(text).not.toContain('from "@/lib/voice-runtime');
      expect(text).not.toContain('from "@/lib/voice-operating-mode');
      expect(text).not.toContain('from "@/lib/voice-streaming');
      expect(text).not.toContain('from "@/lib/chat');
    }
  });

  it("the demo track keeps its recording-only flags after consolidation", async () => {
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [narrationStub(CANONICAL_TERMINAL_ENGINE_ID, 2, true, true)],
    });
    expect(track).toMatchObject({
      read_only: true,
      no_wake_word: true,
      no_conversation_mode: true,
      no_voice_authority: true,
      auto_play_enabled: false,
    });
    for (const cue of track.audio_cues) {
      expect(cue.no_auto_play).toBe(true);
      expect(cue.no_voice_authority).toBe(true);
    }
  });

  it("the PTT bridge still blocks autoplay at its own gate", async () => {
    const { bridge } = createBridge(fakeTtsProvider());
    await expect(
      bridge.createVoicePlaybackRequest(
        playbackInput({ allow_autoplay: true }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["autoplay_blocked"],
    });
  });
});

describe("I-E011-6 — failover telemetry stays metadata-only through the shared layer", () => {
  it("emits only id/reason/position events with no forbidden raw-content fields", async () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
    });
    await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        narrationStub("chatterbox-tts-server", 0, false, false),
        narrationStub("kokoro", 1, false, false),
        narrationStub(CANONICAL_TERMINAL_ENGINE_ID, 2, true, true),
      ],
      telemetry: sink,
    });
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(["voice_provider_failover", "voice_provider_selected"]).toContain(
        event.event_type,
      );
      expect(
        findForbiddenTelemetryField(
          event as unknown as Record<string, unknown>,
        ),
      ).toBeNull();
    }
  });
});

describe("I-E011-7 — no new mutation surface", () => {
  it("neither the shared layer nor the PTT engine adapter references runTool", () => {
    for (const file of [
      ...SHARED_LAYER_FILES,
      "src/lib/voice-runtime/tts/engine-adapter.ts",
    ]) {
      expect(source(file)).not.toContain("runTool");
    }
  });
});
