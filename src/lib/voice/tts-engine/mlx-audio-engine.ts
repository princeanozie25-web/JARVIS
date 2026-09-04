import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { VoiceEngineHealth, VoiceSynthesisEngine } from "./types";

// E-040 (Phase 25D part 2) — the REAL Apple-native TTS engine: an mlx-audio
// server (one loopback service) synthesizes for kokoro (default), chatterbox-
// turbo (expressive) and qwen3-tts (non-default) by passing a different
// `model`. Speaks the OpenAI-compatible POST /v1/audio/speech; a WAV is
// written to disk and only its METADATA (path, size, duration) rides back —
// never raw audio (I2). This is one VoiceSynthesisEngine on the E-011 seam,
// so the same failover mechanism selects it and falls through to Piper
// (existing-local-fallback) → captions when the server is down.
//
// Kill switches: JARVIS_MLX_AUDIO_URL (point elsewhere / off), the request
// AbortSignal, a hard timeout. A dead server → health false and synthesize
// throwing, so the chain advances. Nothing here grants execution authority.

export const MLX_AUDIO_DEFAULT_URL = "http://127.0.0.1:8004";
export const MLX_AUDIO_DEFAULT_TIMEOUT_MS = 30_000;

// Measured warm on the M1 Max (2026-09-04, 12-word sentence, 3 runs):
//   kokoro-bf16 TTFA ~160 ms  · chatterbox-turbo-4bit ~911 ms · qwen3-tts ~1485 ms.
// Default = kokoro (lowest warm TTFA); expressive = chatterbox-turbo.
export const MLX_AUDIO_ENGINE_MODELS = {
  kokoro: "mlx-community/Kokoro-82M-bf16",
  "chatterbox-turbo": "mlx-community/chatterbox-turbo-4bit",
  "qwen3-tts": "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit",
} as const;

export type MlxAudioEngineKey = keyof typeof MLX_AUDIO_ENGINE_MODELS;

export interface MlxAudioLine {
  readonly id: string;
  readonly text: string;
}

export interface MlxAudioCue {
  readonly chunk_id: string;
  readonly provider_id: string;
  readonly output_ref: string;
  readonly size_bytes: number;
  readonly duration_ms: number;
  readonly model: string;
  readonly voice_id: string;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface MlxAudioEngineOptions {
  readonly providerId: string;
  readonly priority: number;
  readonly model: string;
  readonly voiceId: string;
  readonly baseUrl?: string;
  readonly outputDir?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  /** Test seam: default writes the WAV to disk (metadata-only result). */
  readonly writeAudio?: (path: string, bytes: Uint8Array) => void;
  readonly now?: () => number;
}

export class MlxAudioEngineError extends Error {
  readonly reason: "unreachable" | "server_error" | "empty_audio";
  readonly metadata_only = true;
  constructor(providerId: string, reason: MlxAudioEngineError["reason"]) {
    super(`${providerId} mlx-audio engine failed closed: ${reason}`);
    this.name = "MlxAudioEngineError";
    this.reason = reason;
  }
}

function defaultWrite(path: string, bytes: Uint8Array): void {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (slash > 0) mkdirSync(path.slice(0, slash), { recursive: true });
  writeFileSync(path, bytes);
}

/** Duration from a RIFF/WAVE header (fmt sampleRate + data chunk size); 0 if
 *  the bytes are not a parseable WAV. Never returns audio, only a number. */
export function wavDurationMs(bytes: Uint8Array): number {
  if (bytes.length < 44) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, false) !== 0x52494646) return 0; // "RIFF"
  if (view.getUint32(8, false) !== 0x57415645) return 0; // "WAVE"
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let bytesPerSample = 2;
  let dataBytes = 0;
  while (offset + 8 <= bytes.length) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x666d7420) {
      channels = view.getUint16(offset + 10, true) || 1;
      sampleRate = view.getUint32(offset + 12, true) || 0;
      bytesPerSample = (view.getUint16(offset + 22, true) || 16) / 8 || 2;
    } else if (id === 0x64617461) {
      dataBytes = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  const frameBytes = sampleRate * channels * bytesPerSample;
  return frameBytes > 0 ? Math.round((dataBytes / frameBytes) * 1000) : 0;
}

export function createMlxAudioSynthesisEngine(
  options: MlxAudioEngineOptions,
): VoiceSynthesisEngine<MlxAudioLine, MlxAudioCue> {
  const baseUrl = (options.baseUrl ?? MLX_AUDIO_DEFAULT_URL).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? MLX_AUDIO_DEFAULT_TIMEOUT_MS;
  const outputDir = options.outputDir ?? join(process.cwd(), "data", "tts");
  const write = options.writeAudio ?? defaultWrite;
  const now = options.now ?? (() => Date.now());

  async function post(path: string, body: unknown, method = "POST") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    provider_id: options.providerId,
    priority: options.priority,
    async health(): Promise<VoiceEngineHealth> {
      let ok = false;
      try {
        const response = await post("/", undefined, "GET");
        ok = response.ok;
      } catch {
        ok = false;
      }
      return {
        provider_id: options.providerId,
        ok,
        degraded: !ok,
        checked_at_ms: now(),
        metadata_only: true,
      };
    },
    async synthesize(line: MlxAudioLine): Promise<MlxAudioCue> {
      let response: Response;
      try {
        response = await post("/v1/audio/speech", {
          model: options.model,
          input: line.text,
          voice: options.voiceId,
          response_format: "wav",
        });
      } catch {
        throw new MlxAudioEngineError(options.providerId, "unreachable");
      }
      if (!response.ok) {
        throw new MlxAudioEngineError(options.providerId, "server_error");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        throw new MlxAudioEngineError(options.providerId, "empty_audio");
      }
      const chunkId = `${options.providerId}-${line.id}`;
      const outputRef = join(outputDir, `${chunkId}.wav`);
      write(outputRef, bytes);
      return {
        chunk_id: chunkId,
        provider_id: options.providerId,
        output_ref: outputRef,
        size_bytes: bytes.length,
        duration_ms: wavDurationMs(bytes),
        model: options.model,
        voice_id: options.voiceId,
        degraded: false,
        metadata_only: true,
      };
    },
  };
}
