import { describe, expect, it, vi } from "vitest";

import {
  MLX_AUDIO_ENGINE_MODELS,
  MlxAudioEngineError,
  createMlxAudioSynthesisEngine,
  synthesizeOverEngineChain,
  wavDurationMs,
  type MlxAudioCue,
  type VoiceSynthesisEngine,
} from "@/lib/voice/tts-engine";

// E-040 — the REAL Apple-native TTS engine (mlx-audio) on the E-011 seam:
// kokoro default, chatterbox expressive, Piper terminal. Metadata-only, and
// an mlx-audio-DOWN drill that proves the failover chain reaches the terminal.

const AUDIO_LEAK = /audio_bytes|waveform|pcm|base64|"[A-Za-z0-9+/]{200}/;

/** A 24 kHz mono 16-bit WAV header + `ms` of silence. */
function silentWav(ms: number): Uint8Array<ArrayBuffer> {
  const sr = 24000;
  const dataBytes = Math.round((sr * 2 * ms) / 1000);
  const buf = new Uint8Array(new ArrayBuffer(44 + dataBytes));
  const v = new DataView(buf.buffer);
  v.setUint32(0, 0x52494646, false); // RIFF
  v.setUint32(4, 36 + dataBytes, true);
  v.setUint32(8, 0x57415645, false); // WAVE
  v.setUint32(12, 0x666d7420, false); // fmt
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false); // data
  v.setUint32(40, dataBytes, true);
  return buf;
}

function okFetch(bytes: Uint8Array<ArrayBuffer>) {
  return vi.fn(async (url: string) =>
    url.endsWith("/v1/audio/speech")
      ? new Response(new Blob([bytes]), { status: 200 })
      : new Response("ok", { status: 200 }),
  );
}

function makeKokoro(fetchImpl: typeof fetch, writes: string[]) {
  return createMlxAudioSynthesisEngine({
    providerId: "kokoro",
    priority: 0,
    model: MLX_AUDIO_ENGINE_MODELS.kokoro,
    voiceId: "af_heart",
    fetchImpl,
    writeAudio: (path) => writes.push(path),
    now: () => 1000,
  });
}

describe("E-040 mlx-audio TTS engine", () => {
  it("synthesizes to a metadata-only cue: file ref + size + parsed duration, no raw audio", async () => {
    const writes: string[] = [];
    const wav = silentWav(500);
    const engine = makeKokoro(okFetch(wav) as unknown as typeof fetch, writes);
    const cue = (await engine.synthesize!({
      id: "u1",
      text: "hello",
    })) as MlxAudioCue;
    expect(cue.provider_id).toBe("kokoro");
    expect(cue.model).toBe(MLX_AUDIO_ENGINE_MODELS.kokoro);
    expect(cue.size_bytes).toBe(wav.length);
    expect(cue.duration_ms).toBe(500);
    expect(cue.output_ref).toBe(writes[0]);
    expect(cue.metadata_only).toBe(true);
    expect(JSON.stringify(cue)).not.toMatch(AUDIO_LEAK);
  });

  it("health is ok on a 200 and degraded when the server is down", async () => {
    const up = makeKokoro(
      okFetch(silentWav(10)) as unknown as typeof fetch,
      [],
    );
    expect((await up.health()).ok).toBe(true);
    const down = createMlxAudioSynthesisEngine({
      providerId: "kokoro",
      priority: 0,
      model: MLX_AUDIO_ENGINE_MODELS.kokoro,
      voiceId: "af_heart",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
      now: () => 1000,
    });
    const h = await down.health();
    expect(h.ok).toBe(false);
    expect(h.degraded).toBe(true);
  });

  it("fails closed: unreachable, server error, and empty audio each throw a typed error", async () => {
    const unreachable = createMlxAudioSynthesisEngine({
      providerId: "kokoro",
      priority: 0,
      model: "m",
      voiceId: "v",
      fetchImpl: (async () => {
        throw new Error("nope");
      }) as unknown as typeof fetch,
    });
    await expect(
      unreachable.synthesize!({ id: "1", text: "x" }),
    ).rejects.toMatchObject({ reason: "unreachable" });
    const err500 = createMlxAudioSynthesisEngine({
      providerId: "kokoro",
      priority: 0,
      model: "m",
      voiceId: "v",
      fetchImpl: (async () =>
        new Response("boom", { status: 500 })) as unknown as typeof fetch,
    });
    await expect(
      err500.synthesize!({ id: "1", text: "x" }),
    ).rejects.toBeInstanceOf(MlxAudioEngineError);
    const empty = createMlxAudioSynthesisEngine({
      providerId: "kokoro",
      priority: 0,
      model: "m",
      voiceId: "v",
      fetchImpl: (async () =>
        new Response(new Uint8Array(0), {
          status: 200,
        })) as unknown as typeof fetch,
      writeAudio: () => {},
    });
    await expect(
      empty.synthesize!({ id: "1", text: "x" }),
    ).rejects.toMatchObject({ reason: "empty_audio" });
  });

  it("KILL-DRILL: mlx-audio down -> the failover chain advances kokoro -> chatterbox -> Piper terminal", async () => {
    const down = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const kokoro = createMlxAudioSynthesisEngine({
      providerId: "kokoro",
      priority: 0,
      model: "k",
      voiceId: "af_heart",
      fetchImpl: down,
    });
    const chatterbox = createMlxAudioSynthesisEngine({
      providerId: "chatterbox-tts-server",
      priority: 1,
      model: "c",
      voiceId: "default",
      fetchImpl: down,
    });
    // Piper terminal stub: healthy, synthesizes captions.
    const piper: VoiceSynthesisEngine<
      { id: string; text: string },
      MlxAudioCue
    > = {
      provider_id: "existing-local-fallback",
      priority: 2,
      health: async () => ({
        provider_id: "existing-local-fallback",
        ok: true,
        degraded: false,
        checked_at_ms: 1,
        metadata_only: true,
      }),
      synthesize: async (line) => ({
        chunk_id: `piper-${line.id}`,
        provider_id: "existing-local-fallback",
        output_ref: "/tmp/piper.wav",
        size_bytes: 1,
        duration_ms: 1,
        model: "piper",
        voice_id: "en_US-lessac-medium",
        degraded: false,
        metadata_only: true,
      }),
    };
    const failovers: string[] = [];
    const selected: string[] = [];
    const outcome = await synthesizeOverEngineChain(
      [kokoro, chatterbox, piper],
      [{ id: "u1", text: "Jarvis online." }],
      {
        now: () => 1000,
        telemetry: {
          recordFailover: (i) =>
            failovers.push(
              `${i.from_provider_id}->${i.to_provider_id}:${i.reason}`,
            ),
          recordSelected: (i) => selected.push(i.provider_id),
        },
      },
    );
    // both mlx-audio engines fail their health probe; the terminal Piper is selected.
    expect(failovers).toEqual([
      "kokoro->chatterbox-tts-server:health_probe_failed",
      "chatterbox-tts-server->existing-local-fallback:health_probe_failed",
    ]);
    expect(selected).toEqual(["existing-local-fallback"]);
    expect(outcome.engine.provider_id).toBe("existing-local-fallback");
    expect(outcome.exhausted).toBe(false);
  });

  it("wavDurationMs parses a header and returns 0 for non-WAV bytes", () => {
    expect(wavDurationMs(silentWav(1000))).toBe(1000);
    expect(wavDurationMs(new Uint8Array([1, 2, 3]))).toBe(0);
    expect(
      wavDurationMs(new TextEncoder().encode("not a wav at all........")),
    ).toBe(0);
  });
});
