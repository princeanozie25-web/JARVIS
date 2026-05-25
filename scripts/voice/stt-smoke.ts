import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createFasterWhisperSttProvider,
  loadFasterWhisperSttLocalConfig,
  type FasterWhisperProviderConfig,
  type SttProvider,
  type SttTranscriptionResult,
} from "../../src/lib/voice-runtime";

export const STT_SMOKE_AUDIO_REF_ENV = "JARVIS_STT_SMOKE_AUDIO_REF";
export const STT_SMOKE_DURATION_MS_ENV = "JARVIS_STT_SMOKE_DURATION_MS";
export const STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT = 80;
const STT_SMOKE_TIMEOUT_MS = 30_000;

export class SttSmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SttSmokeError";
  }
}

export interface SttSmokeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly loadConfig?: (
    env: Record<string, string | undefined>,
  ) => ReturnType<typeof loadFasterWhisperSttLocalConfig>;
  readonly createProvider?: (
    config: FasterWhisperProviderConfig,
  ) => SttProvider;
  readonly statAudio?: (audioRef: string) => Promise<{ readonly size: number }>;
  readonly writeLine?: (line: string) => void;
}

export interface SttSmokeReport {
  readonly provider_id: string;
  readonly language: string | undefined;
  readonly confidence_band: string;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly transcript_preview: string;
  readonly result: SttTranscriptionResult;
}

export async function runSttSmoke(
  dependencies: SttSmokeDependencies = {},
): Promise<SttSmokeReport> {
  const env = dependencies.env ?? process.env;
  const loadConfig = dependencies.loadConfig ?? loadFasterWhisperSttLocalConfig;
  const createProvider =
    dependencies.createProvider ??
    ((config: FasterWhisperProviderConfig) =>
      createFasterWhisperSttProvider({ config }));
  const statAudio = dependencies.statAudio ?? stat;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const configResult = loadConfig(env);

  if (!configResult.ok) {
    throw new SttSmokeError(
      [
        `faster-whisper STT smoke config is invalid: ${configResult.reasons.join(",")}.`,
        "Set JARVIS_STT_PYTHON_COMMAND or JARVIS_STT_EXECUTABLE, plus JARVIS_STT_MODEL_NAME, JARVIS_STT_MODEL_PATH, and JARVIS_STT_PROVIDER_ID.",
        "No live capture, telemetry persistence, event store writes, model routing, or cloud fallback was attempted.",
      ].join(" "),
    );
  }

  const audioRef = requiredEnv(env[STT_SMOKE_AUDIO_REF_ENV]);
  if (!audioRef) {
    throw new SttSmokeError(
      "Set JARVIS_STT_SMOKE_AUDIO_REF to an explicit local audio file path. No live capture was attempted.",
    );
  }
  const durationMs = parsePositiveInteger(env[STT_SMOKE_DURATION_MS_ENV]);
  if (durationMs === null) {
    throw new SttSmokeError(
      "Set JARVIS_STT_SMOKE_DURATION_MS to positive audio duration metadata. The smoke harness does not inspect audio content.",
    );
  }

  const audioStats = await statAudio(audioRef);
  if (!Number.isFinite(audioStats.size) || audioStats.size <= 0) {
    throw new SttSmokeError("Audio metadata stat failed closed.");
  }

  const provider = createProvider(configResult.config);
  const result = await provider.transcribe(
    {
      request_id: "voice-stt-smoke",
      session_id: "stt-smoke-session",
      turn_id: "stt-smoke-turn",
      audio: {
        audio_ref: audioRef,
        mime_type: mimeTypeForAudioRef(audioRef),
        duration_ms: durationMs,
        size_bytes: audioStats.size,
        metadata_only: true,
      },
      metadata_only: true,
    },
    {
      timeout_ms: configResult.config.timeoutMs || STT_SMOKE_TIMEOUT_MS,
      metadata_only: true,
    },
  );

  const report = {
    provider_id: result.provider_id,
    language: result.language,
    confidence_band: result.confidence_band,
    latency_ms: result.latency_ms,
    degraded: result.degraded,
    transcript_preview: boundedTranscriptPreview(result.transcript),
    result,
  };

  writeLine("JARVIS faster-whisper STT smoke");
  writeLine("status: ok");
  writeLine(`provider_id: ${report.provider_id}`);
  writeLine(`language: ${report.language ?? "unknown"}`);
  writeLine(`confidence_band: ${report.confidence_band}`);
  writeLine(`latency_ms: ${String(report.latency_ms)}`);
  writeLine(`degraded: ${String(report.degraded)}`);
  writeLine(`transcript_preview: ${report.transcript_preview}`);

  return report;
}

export async function runSttSmokeCli(): Promise<void> {
  try {
    await runSttSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "faster-whisper STT smoke failed closed with an unknown error.";
    console.error(`JARVIS faster-whisper STT smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

export function boundedTranscriptPreview(transcript: string): string {
  return transcript.slice(0, STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT);
}

function requiredEnv(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function mimeTypeForAudioRef(audioRef: string): string {
  const extension = extname(audioRef).toLowerCase();
  if (extension === ".wav") return "audio/wav";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".flac") return "audio/flac";
  if (extension === ".ogg") return "audio/ogg";
  return "application/octet-stream";
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("stt-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runSttSmokeCli();
}
