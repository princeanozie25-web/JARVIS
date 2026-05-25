import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createPiperTtsProvider,
  loadPiperTtsLocalConfig,
  type PiperProviderConfig,
  type TtsProvider,
  type TtsSynthesisResult,
} from "../../src/lib/voice-runtime";

export const TTS_SMOKE_TEXT = "Good evening. All systems are operational.";
const TTS_SMOKE_TIMEOUT_MS = 30_000;

export class TtsSmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsSmokeError";
  }
}

export interface TtsSmokeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly loadConfig?: (
    env: Record<string, string | undefined>,
  ) => ReturnType<typeof loadPiperTtsLocalConfig>;
  readonly createProvider?: (config: PiperProviderConfig) => TtsProvider;
  readonly writeLine?: (line: string) => void;
}

export interface TtsSmokeReport {
  readonly provider_id: string;
  readonly voice_id: string;
  readonly output_ref: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly degraded: boolean;
  readonly result: TtsSynthesisResult;
}

export async function runTtsSmoke(
  dependencies: TtsSmokeDependencies = {},
): Promise<TtsSmokeReport> {
  const env = dependencies.env ?? process.env;
  const loadConfig = dependencies.loadConfig ?? loadPiperTtsLocalConfig;
  const createProvider =
    dependencies.createProvider ??
    ((config: PiperProviderConfig) => createPiperTtsProvider({ config }));
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const configResult = loadConfig(env);

  if (!configResult.ok) {
    throw new TtsSmokeError(
      [
        `Piper TTS smoke config is invalid: ${configResult.reasons.join(",")}.`,
        "Set JARVIS_PIPER_EXECUTABLE, JARVIS_PIPER_MODEL, JARVIS_PIPER_MODEL_CONFIG, JARVIS_TTS_OUTPUT_DIR, JARVIS_TTS_PROVIDER_ID, and JARVIS_TTS_VOICE_ID.",
        "No playback, telemetry persistence, event store writes, model routing, or cloud fallback was attempted.",
      ].join(" "),
    );
  }

  const provider = createProvider(configResult.config);
  const result = await provider.synthesize(
    {
      request_id: "voice-tts-smoke",
      text: TTS_SMOKE_TEXT,
      content_class: "assistant_prose",
      turn_id: "tts-smoke-turn",
      session_id: "tts-smoke-session",
      requested_voice_id: configResult.config.voiceId,
      allow_sensitive_content: false,
      metadata_only: true,
    },
    {
      timeout_ms: configResult.config.timeoutMs || TTS_SMOKE_TIMEOUT_MS,
      metadata_only: true,
    },
  );

  const report = {
    provider_id: result.chunk.provider_id,
    voice_id: result.chunk.voice_id,
    output_ref: result.chunk.output_ref,
    duration_ms: result.chunk.duration_ms,
    size_bytes: result.chunk.size_bytes,
    degraded: result.degraded,
    result,
  };

  writeLine("JARVIS Piper TTS smoke");
  writeLine("status: ok");
  writeLine(`provider_id: ${report.provider_id}`);
  writeLine(`voice_id: ${report.voice_id}`);
  writeLine(`output_ref: ${report.output_ref}`);
  writeLine(`duration_ms: ${String(report.duration_ms)}`);
  writeLine(`size_bytes: ${String(report.size_bytes)}`);
  writeLine(`degraded: ${String(report.degraded)}`);

  return report;
}

export async function runTtsSmokeCli(): Promise<void> {
  try {
    await runTtsSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Piper TTS smoke failed closed with an unknown error.";
    console.error(`JARVIS Piper TTS smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("tts-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runTtsSmokeCli();
}
