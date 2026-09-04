// E-039 — end-to-end STT latency on ONE local utterance through the REAL
// providers behind the SttProvider seam. Loopback-free, network-free (models
// must already be in the HF cache). Prints a metadata-only table.
// Usage (run through the repo's TS loader): stt-mlx-smoke <wav> [mlx-python] [fw-python]
import { statSync } from "node:fs";

import {
  createFasterWhisperSttProvider,
  createMlxWhisperSttProvider,
  createParakeetMlxSttProvider,
  type SttProvider,
} from "../../src/lib/voice-runtime";

const wav = process.argv[2];
const mlxPython =
  process.argv[3] ??
  process.env.JARVIS_STT_MLX_PYTHON_COMMAND ??
  ".venv-mlx/bin/python";
const fwPython =
  process.argv[4] ??
  process.env.JARVIS_STT_PYTHON_COMMAND ??
  ".venv/bin/python";
if (!wav) {
  console.error("usage: stt-mlx-smoke <wav> [mlx-python] [fw-python]");
  process.exit(2);
}
const size = statSync(wav).size;
// 16 kHz / 16-bit / mono PCM: (bytes - 44-byte header) / 32 ≈ ms. A positive
// duration is required by the request envelope validator; the real duration is
// read from the file by the Python helper, so this estimate only shapes metadata.
const durationMs = Math.max(1, Math.round((size - 44) / 32));
const request = {
  request_id: "smoke",
  session_id: "smoke",
  turn_id: "t1",
  audio: {
    audio_ref: wav,
    mime_type: "audio/wav",
    duration_ms: durationMs,
    size_bytes: size,
    sample_rate_hz: 16000,
    metadata_only: true as const,
  },
  metadata_only: true as const,
};

async function run(name: string, provider: SttProvider): Promise<void> {
  const partials: string[] = [];
  void partials;
  const t0 = performance.now();
  try {
    const result = await provider.transcribe(request, { metadata_only: true });
    console.log(
      JSON.stringify({
        provider: name,
        wall_ms: Math.round(performance.now() - t0),
        engine_ms: result.latency_ms,
        language: result.language,
        transcript: result.transcript,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        provider: name,
        wall_ms: Math.round(performance.now() - t0),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function main(): Promise<void> {
  await run(
    "parakeet-mlx",
    createParakeetMlxSttProvider({
      pythonCommand: mlxPython,
      onPartial: (p) => console.log(JSON.stringify({ partial: p })),
    }),
  );
  await run(
    "mlx-whisper",
    createMlxWhisperSttProvider({ pythonCommand: mlxPython, language: "en" }),
  );
  await run(
    "faster-whisper",
    createFasterWhisperSttProvider({
      config: {
        pythonCommand: fwPython,
        modelName: process.env.JARVIS_STT_MODEL_NAME ?? "base.en",
        modelPath: "",
        language: "en",
        beamSize: 5,
        vadEnabled: true,
        timeoutMs: 120_000,
        maxAudioBytes: 25_000_000,
        providerId: "faster-whisper",
        metadata_only: true,
      },
    }),
  );
}
main();
