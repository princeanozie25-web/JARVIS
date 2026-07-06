import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_TO_DISPLAY_PROVIDER_ID,
  loadCockpitVoiceView,
} from "../../src/app/working/voice-health";
import { syntheticCockpitVoiceView } from "../../src/components/working/voice-view";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import { PIPER_FALLBACK_PROVIDER_ID } from "../../src/lib/demo-director/piper-fallback";
import {
  SYSTEM_VOICE_PROVIDER_IDS,
  defaultSystemVoiceHealth,
} from "../../src/lib/voice-operating-mode/voice-stack";
import {
  CANONICAL_TERMINAL_ENGINE_ID,
  CANONICAL_TTS_ENGINE_IDS,
  snapshotVoiceEngineHealth,
  type VoiceSynthesisEngine,
} from "../../src/lib/voice/tts-engine";

// E-020 — the voice-pill live-health wire. The pill shows the REAL canonical
// engine picture (post-E-011) via a read-only snapshot, honestly labelled,
// with the Phase 22 display id and the Phase 23 drilled chain id kept
// explicitly distinct (the id-trap).

const HEALTH_SNAPSHOT_SOURCE = readFileSync(
  "src/lib/voice/tts-engine/health-snapshot.ts",
  "utf8",
);
const VOICE_HEALTH_SOURCE = readFileSync(
  "src/app/working/voice-health.ts",
  "utf8",
);
const COCKPIT_SOURCE = readFileSync(
  "src/components/working/WorkingCockpit.tsx",
  "utf8",
);

function fakeEngine(
  provider_id: string,
  priority: number,
  ok: boolean,
): VoiceSynthesisEngine<never, unknown> & {
  synthesize: ReturnType<typeof vi.fn>;
} {
  return {
    provider_id,
    priority,
    health: async () => ({
      provider_id,
      ok,
      degraded: !ok,
      checked_at_ms: 1,
      metadata_only: true,
    }),
    synthesize: vi.fn(async () => {
      throw new Error("display path must NEVER synthesize");
    }),
  };
}

function chain(states: {
  chatterbox: boolean;
  kokoro: boolean;
  piper: boolean;
}) {
  return [
    fakeEngine("chatterbox-tts-server", 0, states.chatterbox),
    fakeEngine("kokoro", 1, states.kokoro),
    fakeEngine("existing-local-fallback", 2, states.piper),
  ];
}

describe("I-E020-1 — the pill renders REAL health, not the hardcoded default", () => {
  it("healthy primary: the live view selects Chatterbox (default said local terminal)", async () => {
    const view = await loadCockpitVoiceView({
      engines: chain({ chatterbox: true, kokoro: true, piper: true }),
      now: () => 7,
    });
    expect(view.provenance).toBe("live");
    expect(view.selected_provider).toBe("chatterbox-tts-server");
    expect(view.failed_over).toBe(false);
    // The old hardcoded default picture said the opposite:
    expect(defaultSystemVoiceHealth()[0]?.ok).toBe(false);

    const html = renderToStaticMarkup(<WorkingCockpit voiceView={view} />);
    expect(html).toContain('data-voice-tts-provider="chatterbox-tts-server"');
    expect(html).toContain('data-voice-tts-provenance="live"');
    expect(html).toContain("TTS - LIVE");
  });

  it("primary + kokoro down: the pill shows the terminal with an explicit failover marker", async () => {
    const view = await loadCockpitVoiceView({
      engines: chain({ chatterbox: false, kokoro: false, piper: true }),
      now: () => 7,
    });
    expect(view.provenance).toBe("live");
    expect(view.selected_provider).toBe("existing-local-runtime");
    expect(view.failed_over).toBe(true);

    const html = renderToStaticMarkup(<WorkingCockpit voiceView={view} />);
    expect(html).toContain("existing-local-runtime (failover)");
    expect(html).toContain('data-voice-tts-failed-over="true"');
  });
});

describe("I-E020-2 — honest provenance in both branches", () => {
  it("probes ran + everything down => honest live-(down), never fake all-healthy", async () => {
    const view = await loadCockpitVoiceView({
      engines: chain({ chatterbox: false, kokoro: false, piper: false }),
      now: () => 7,
    });
    expect(view.provenance).toBe("live");
    expect(view.providers.every((entry) => !entry.ok)).toBe(true);

    const html = renderToStaticMarkup(<WorkingCockpit voiceView={view} />);
    expect(html).toContain("(down)");
    expect(html).toContain("TTS - LIVE");
  });

  it("probe path unavailable => labelled synthetic default (fail-closed)", async () => {
    const throwingEngines = new Proxy(
      [] as VoiceSynthesisEngine<never, unknown>[],
      {
        get() {
          throw new Error("engine construction unavailable");
        },
      },
    );
    const view = await loadCockpitVoiceView({ engines: throwingEngines });
    expect(view.provenance).toBe("synthetic");
    expect(view).toEqual(syntheticCockpitVoiceView());
  });

  it("the default render (no reader) is labelled SYNTHETIC, not presented as probed", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain("TTS - SYNTHETIC");
    expect(html).toContain('data-voice-tts-provenance="synthetic"');
    expect(html).toContain('data-voice-tts-provider="existing-local-runtime"');
  });
});

describe("I-E020-3 — the id-trap stays intact", () => {
  it("both terminal ids keep their own contracts, distinct", () => {
    expect(CANONICAL_TERMINAL_ENGINE_ID).toBe("existing-local-fallback");
    expect(PIPER_FALLBACK_PROVIDER_ID).toBe("existing-local-fallback");
    expect(SYSTEM_VOICE_PROVIDER_IDS).toContain("existing-local-runtime");
    expect(SYSTEM_VOICE_PROVIDER_IDS).not.toContain("existing-local-fallback");
    expect(CANONICAL_TTS_ENGINE_IDS).not.toContain("existing-local-runtime");
  });

  it("the display translation is explicit and total over the canonical ids", () => {
    expect(CANONICAL_TO_DISPLAY_PROVIDER_ID["existing-local-fallback"]).toBe(
      "existing-local-runtime",
    );
    for (const id of CANONICAL_TTS_ENGINE_IDS) {
      expect(CANONICAL_TO_DISPLAY_PROVIDER_ID[id]).toBeDefined();
    }
  });
});

describe("I-E020-4 — read-only: no synthesis in the health path", () => {
  it("reading health never invokes synthesize on any engine", async () => {
    const engines = chain({ chatterbox: false, kokoro: true, piper: true });
    await loadCockpitVoiceView({ engines, now: () => 7 });
    await snapshotVoiceEngineHealth(engines, { now: () => 7 });
    for (const engine of engines) {
      expect(engine.synthesize).not.toHaveBeenCalled();
    }
  });

  it("the health-read sources contain no synthesis or telemetry call", () => {
    for (const source of [HEALTH_SNAPSHOT_SOURCE, VOICE_HEALTH_SOURCE]) {
      expect(source).not.toMatch(/\.synthesize\(/);
      expect(source).not.toMatch(/recordSelected|recordFailover/);
      expect(source).not.toContain("runTool");
    }
    // The snapshot accessor is mechanism-only: no subsystem imports.
    expect(HEALTH_SNAPSHOT_SOURCE).not.toContain('from "@/lib/');
  });
});

describe("I-E020-5 — display only: no authority gained", () => {
  it("the cockpit's voice surface reads status and controls nothing", () => {
    expect(COCKPIT_SOURCE).not.toMatch(/\.synthesize\(|runtime-bridge|barge/i);
    // The reader is a data fetch; the pill renders a value, not a control.
    expect(COCKPIT_SOURCE).toContain("voiceHealthReader");
    expect(COCKPIT_SOURCE).not.toMatch(/onClick=\{[^}]*voice/i);
  });
});
