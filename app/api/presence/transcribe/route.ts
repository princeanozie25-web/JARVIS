// Presence · transcribe — 16 kHz mono PCM WAV in (recorded and resampled in
// the page), parakeet-mlx out. Local same-origin only; the clip lives in a
// temp file for the length of the request and is removed afterwards.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isLocalPresenceRequest } from "@/lib/presence/local-request";
import { createParakeetMlxSttProvider } from "@/lib/voice-runtime/stt/mlx-stt-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000; // ~60 s at 16 kHz mono PCM16

function wavInfo(bytes: Uint8Array): {
  ok: boolean;
  sampleRate: number;
  channels: number;
  durationMs: number;
} {
  if (bytes.length < 44)
    return { ok: false, sampleRate: 0, channels: 0, durationMs: 0 };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const wave = String.fromCharCode(
    bytes[8]!,
    bytes[9]!,
    bytes[10]!,
    bytes[11]!,
  );
  if (riff !== "RIFF" || wave !== "WAVE")
    return { ok: false, sampleRate: 0, channels: 0, durationMs: 0 };
  const channels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bits = dv.getUint16(34, true);
  const dataBytes = Math.max(0, bytes.length - 44);
  const bytesPerSec = sampleRate * channels * (bits / 8);
  return {
    ok: bits === 16,
    sampleRate,
    channels,
    durationMs: bytesPerSec ? Math.round((dataBytes / bytesPerSec) * 1000) : 0,
  };
}

export async function POST(req: Request): Promise<Response> {
  if (!isLocalPresenceRequest(req))
    return new Response("Local only", { status: 403 });
  if (process.env.JARVIS_UI_VOICE_ENABLED === "false")
    return new Response("Voice off", { status: 503 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return new Response("Too large", { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES)
    return new Response("Too large", { status: 413 });
  const info = wavInfo(bytes);
  if (
    !info.ok ||
    info.channels !== 1 ||
    info.sampleRate !== 16_000 ||
    info.durationMs < 200
  ) {
    return new Response("16 kHz mono PCM WAV required", { status: 400 });
  }
  const python =
    process.env.JARVIS_STT_MLX_PYTHON_COMMAND?.trim() || ".venv-mlx/bin/python";
  const dir = await mkdtemp(join(tmpdir(), "jarvis-hear-"));
  const path = join(dir, "turn.wav");
  try {
    await writeFile(path, bytes);
    const provider = createParakeetMlxSttProvider({
      pythonCommand: python,
      timeoutMs: 60_000,
    });
    const result = await provider.transcribe(
      {
        request_id: crypto.randomUUID(),
        session_id: "presence",
        turn_id: crypto.randomUUID(),
        audio: {
          audio_ref: path,
          mime_type: "audio/wav",
          duration_ms: info.durationMs,
          size_bytes: bytes.length,
          sample_rate_hz: 16_000,
          metadata_only: true,
        },
        metadata_only: true,
      },
      { timeout_ms: 60_000, abort_signal: req.signal, metadata_only: true },
    );
    return Response.json({
      transcript: result.transcript,
      latency_ms: result.latency_ms,
      degraded: result.degraded,
    });
  } catch (error) {
    return Response.json(
      {
        transcript: "",
        error:
          error instanceof Error
            ? error.message.slice(0, 200)
            : "transcribe failed",
      },
      { status: 502 },
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
