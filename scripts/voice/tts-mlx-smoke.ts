// E-040 — real TTS through the mlx-audio engine against a running server.
// Usage (through the repo's TS loader): tts-mlx-smoke [base-url]
// Requires the mlx-audio server up (scripts/voice/mlx-audio-server.sh) and the
// models cached. Prints a metadata-only line per engine (no raw audio).
import {
  MLX_AUDIO_ENGINE_MODELS,
  createMlxAudioSynthesisEngine,
} from "../../src/lib/voice/tts-engine";

const baseUrl =
  process.argv[2] ??
  process.env.JARVIS_MLX_AUDIO_URL ??
  "http://127.0.0.1:8004";
const TEXT =
  "Jarvis, please read the room temperature and remind me about the deadline.";
const ENGINES = [
  { key: "kokoro", providerId: "kokoro", voice: "af_heart" },
  {
    key: "chatterbox-turbo",
    providerId: "chatterbox-tts-server",
    voice: "default",
  },
  { key: "qwen3-tts", providerId: "qwen3-tts", voice: "ryan" },
] as const;

async function main(): Promise<void> {
  for (const e of ENGINES) {
    const engine = createMlxAudioSynthesisEngine({
      providerId: e.providerId,
      priority: 0,
      model: MLX_AUDIO_ENGINE_MODELS[e.key],
      voiceId: e.voice,
      baseUrl,
      outputDir: "/tmp/jarvis-voice/tts-smoke",
      timeoutMs: 120_000,
    });
    // one warmup then a timed warm run
    try {
      await engine.synthesize!({ id: "warmup", text: TEXT });
      const t0 = performance.now();
      const cue = await engine.synthesize!({ id: "warm", text: TEXT });
      console.log(
        JSON.stringify({
          engine: e.key,
          wall_ms: Math.round(performance.now() - t0),
          duration_ms: cue.duration_ms,
          size_bytes: cue.size_bytes,
          output_ref: cue.output_ref,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          engine: e.key,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
main();
