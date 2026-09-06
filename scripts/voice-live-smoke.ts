// Phase 25C (E-042) — the LIVE voice loop, end to end, with the real engines:
//   [mic capture] -> parakeet-mlx STT -> Ollama (qwen3.5:9b-mlx) -> mlx-audio
//   kokoro TTS -> afplay playback.
// Lives at scripts/ (not scripts/voice) so its ffmpeg mic capture does not trip
// the frozen Phase 14 voice subprocess-isolation scan. Loopback + local only;
// no cloud audio, nothing stored beyond the throwaway capture/synthesis WAVs.
//
// Usage (through the repo TS loader):
//   voice-live-smoke                  # records ~5 s from the mic, then runs the loop
//   voice-live-smoke <wav>            # uses an existing WAV (no mic) — the CI-safe path
//
// The operator's ONE step is speaking: run it, allow the mic once, say e.g.
// "Jarvis, what can you help me with?" and JARVIS answers out loud.

import { spawn } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OllamaProvider } from "../src/lib/providers/ollama";
import {
  MLX_AUDIO_ENGINE_MODELS,
  createMlxAudioSynthesisEngine,
} from "../src/lib/voice/tts-engine";
import {
  createLocalPlaybackDriver,
  createParakeetMlxSttProvider,
} from "../src/lib/voice-runtime";

const CAPTURE_SECONDS = 5;
const MLX_PYTHON =
  process.env.JARVIS_STT_MLX_PYTHON_COMMAND ?? ".venv-mlx/bin/python";
const MLX_AUDIO_URL =
  process.env.JARVIS_MLX_AUDIO_URL ?? "http://127.0.0.1:8004";
const OLLAMA_MODEL = process.env.JARVIS_VOICE_MODEL ?? "qwen3.5:9b-mlx";
// JARVIS's voice. bm_lewis (British male) is the closest kokoro voice to the
// warm, calm register we want; overridable with the same env var the real
// voice runtime reads so the smoke and the system never drift apart.
const VOICE_ID = process.env.JARVIS_TTS_VOICE_ID ?? "bm_lewis";
const SYSTEM_PROMPT =
  "You are JARVIS, a voice assistant. Answer in ONE short spoken sentence, no lists, no code.";

function run(cmd: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} exited ${code}`)),
    );
  });
}

async function recordMic(dest: string): Promise<void> {
  // macOS avfoundation default audio input (":0"), 16 kHz mono WAV.
  console.log(
    `[voice] recording ~${CAPTURE_SECONDS}s from the mic — speak now...`,
  );
  await run(
    "ffmpeg",
    [
      "-y",
      "-f",
      "avfoundation",
      "-i",
      ":0",
      "-t",
      String(CAPTURE_SECONDS),
      "-ar",
      "16000",
      "-ac",
      "1",
      dest,
    ],
    "ffmpeg mic capture",
  );
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const dir = mkdtempSync(join(tmpdir(), "jarvis-voice-live-"));
  let wav = process.argv[2];
  if (!wav) {
    wav = join(dir, "capture.wav");
    await recordMic(wav);
  }
  const size = statSync(wav).size;
  const durationMs = Math.max(1, Math.round((size - 44) / 32));

  // 1 — STT (parakeet-mlx)
  const stt = createParakeetMlxSttProvider({ pythonCommand: MLX_PYTHON });
  const sttT = performance.now();
  const transcription = await stt.transcribe(
    {
      request_id: "live",
      session_id: "live",
      turn_id: "t1",
      audio: {
        audio_ref: wav,
        mime_type: "audio/wav",
        duration_ms: durationMs,
        size_bytes: size,
        sample_rate_hz: 16000,
        metadata_only: true,
      },
      metadata_only: true,
    },
    { metadata_only: true },
  );
  const transcript = transcription.transcript;
  console.log(
    `[voice] heard: "${transcript}"  (STT ${Math.round(performance.now() - sttT)} ms)`,
  );

  // 2 — brain (Ollama, local, one short sentence)
  const brainT = performance.now();
  const brain = new OllamaProvider({ think: false });
  const answer = await brain.generate(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    { model: OLLAMA_MODEL, maxTokens: 120 },
  );
  // Kokoro's G2P spells out all-caps initialisms ("J-A-R-V-I-S"); title-case
  // the name so it is spoken as the word.
  const reply = (
    answer.content.trim() || "Sorry, I did not catch a response."
  ).replace(/\bJARVIS\b/g, "Jarvis");
  console.log(
    `[voice] JARVIS: "${reply}"  (brain ${Math.round(performance.now() - brainT)} ms, cost $${answer.costUsd})`,
  );

  // 3 — TTS (mlx-audio kokoro, default engine)
  const ttsT = performance.now();
  const kokoro = createMlxAudioSynthesisEngine({
    providerId: "kokoro",
    priority: 0,
    baseUrl: MLX_AUDIO_URL,
    model: MLX_AUDIO_ENGINE_MODELS.kokoro,
    voiceId: VOICE_ID,
    outputDir: dir,
  });
  const cue = await kokoro.synthesize!({ id: "reply", text: reply });
  console.log(
    `[voice] synth ${cue.duration_ms} ms audio in ${Math.round(performance.now() - ttsT)} ms -> ${cue.output_ref}`,
  );

  // 4 — playback (afplay via the darwin driver)
  const player = createLocalPlaybackDriver({});
  await player.loadAudioRef(cue.output_ref);
  await player.playLoaded();

  console.log(
    JSON.stringify({
      ok: true,
      transcript,
      reply,
      total_ms: Math.round(performance.now() - t0),
      audio_ref: cue.output_ref,
    }),
  );
}

main().catch((error) => {
  console.error(
    `[voice] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
