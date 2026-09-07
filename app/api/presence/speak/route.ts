// Presence · speak — text in, Lewis out (kokoro on mlx-audio, chatterbox as
// the fallback). Local same-origin only. Returns the WAV bytes; nothing is
// stored beyond the engine's temp file, which is removed after the response.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isLocalPresenceRequest } from "@/lib/presence/local-request";
import { loadVoiceLiveConfig } from "@/lib/voice/live/config";
import {
  createMlxAudioSynthesisEngine,
  MLX_AUDIO_ENGINE_MODELS,
  synthesizeOverEngineChain,
} from "@/lib/voice/tts-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 2400;

export async function POST(req: Request): Promise<Response> {
  if (!isLocalPresenceRequest(req))
    return new Response("Local only", { status: 403 });
  if (process.env.JARVIS_UI_VOICE_ENABLED === "false")
    return new Response("Voice off", { status: 503 });
  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!text || text.length > MAX_CHARS)
    return new Response("Text required", { status: 400 });
  const baseUrl =
    process.env.JARVIS_MLX_AUDIO_URL?.trim() || "http://127.0.0.1:8004";
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseUrl).hostname)
  ) {
    return new Response("Local speech only", { status: 403 });
  }
  const dir = await mkdtemp(join(tmpdir(), "jarvis-presence-"));
  try {
    const config = loadVoiceLiveConfig();
    const primary =
      config.local_tts === "chatterbox-turbo" ? "chatterbox-turbo" : "kokoro";
    const keys = [
      primary,
      primary === "kokoro" ? "chatterbox-turbo" : "kokoro",
    ] as const;
    const engines = keys.map((key, i) =>
      createMlxAudioSynthesisEngine({
        providerId: key,
        priority: i,
        model: MLX_AUDIO_ENGINE_MODELS[key],
        voiceId: config.local_voice_id,
        baseUrl,
        outputDir: dir,
        timeoutMs: 30_000,
      }),
    );
    const outcome = await synthesizeOverEngineChain(engines, [
      { id: crypto.randomUUID(), text: text.replace(/\bJARVIS\b/g, "Jarvis") },
    ]);
    const cue = outcome.cues[0] as { output_ref?: string } | undefined;
    if (outcome.exhausted || !cue?.output_ref || req.signal.aborted) {
      return new Response("Speech unavailable", { status: 503 });
    }
    const bytes = await readFile(cue.output_ref);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "audio/wav", "cache-control": "no-store" },
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
