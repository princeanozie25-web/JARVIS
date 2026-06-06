import { describe, expect, it, vi } from "vitest";

import {
  DEMO_SCRIPT_RECRUITER,
  buildNarrationLines,
  prepareDemoNarration,
  selectNarrationProvider,
  type DemoNarrationProvider,
  type DemoNarrationProviderId,
} from "@/lib/demo-director";

function provider(
  provider_id: DemoNarrationProviderId,
  priority: number,
  ok: boolean,
  synthesizeFails = false,
): DemoNarrationProvider {
  return {
    provider_id,
    priority,
    health: vi.fn().mockResolvedValue({
      provider_id,
      ok,
      degraded: !ok,
      checked_at_ms: 1,
      metadata_only: true,
    }),
    synthesize: vi.fn().mockImplementation((line) =>
      synthesizeFails
        ? Promise.reject(new Error("synthesis failed"))
        : Promise.resolve({
            audio_id: `audio:${line.line_id}`,
            line_id: line.line_id,
            provider_id,
            duration_ms: 1000,
            mime_type: "audio/wav",
            byte_length: 32,
            local_ref: `memory:${line.line_id}`,
            metadata_only: true,
            no_auto_play: true,
            no_voice_authority: true,
          }),
    ),
  };
}

describe("DD.11 narration layer", () => {
  it("selects Chatterbox first when healthy", async () => {
    const selected = await selectNarrationProvider([
      provider("chatterbox-tts-server", 0, true),
      provider("kokoro", 1, true),
      provider("existing-local-fallback", 2, true),
    ]);
    expect(selected.provider.provider_id).toBe("chatterbox-tts-server");
  });

  it("falls back through Kokoro to the existing local provider", async () => {
    const selected = await selectNarrationProvider([
      provider("chatterbox-tts-server", 0, false),
      provider("kokoro", 1, false),
      provider("existing-local-fallback", 2, true),
    ]);
    expect(selected.provider.provider_id).toBe("existing-local-fallback");
    expect(selected.health.map((item) => item.provider_id)).toEqual([
      "chatterbox-tts-server",
      "kokoro",
      "existing-local-fallback",
    ]);
  });

  it("builds audience-specific narration tied to segments and cues", () => {
    const lines = buildNarrationLines(DEMO_SCRIPT_RECRUITER);
    expect(lines[0]?.text).toContain("recruiter-ready proof");
    expect(lines.some((line) => line.segment_id === "segment:assembly")).toBe(
      true,
    );
    expect(lines.some((line) => line.cue_id === "recruiter:aux")).toBe(true);
    expect(lines.every((line) => line.no_voice_control)).toBe(true);
  });

  it("prepares synthesized narration metadata without auto-play or voice authority", async () => {
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [provider("chatterbox-tts-server", 0, true)],
    });
    expect(track.provider_id).toBe("chatterbox-tts-server");
    expect(track.audio_cues.length).toBe(track.lines.length);
    expect(track.auto_play_enabled).toBe(false);
    expect(track.no_wake_word).toBe(true);
    expect(track.no_conversation_mode).toBe(true);
    expect(track.no_voice_authority).toBe(true);
  });

  it("falls back automatically when the healthy primary provider fails synthesis", async () => {
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        provider("chatterbox-tts-server", 0, true, true),
        provider("kokoro", 1, true),
        provider("existing-local-fallback", 2, true),
      ],
    });

    expect(track.provider_id).toBe("kokoro");
    expect(track.audio_cues.length).toBe(track.lines.length);
  });
});
