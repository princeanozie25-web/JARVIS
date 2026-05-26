import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createLocalPlaybackAdapter,
  createLocalPlaybackDriver,
  createPlaybackSupervisor,
  type LocalPlaybackCommandResult,
  type LocalPlaybackAdapter,
  type PlaybackDriver,
  type PlaybackQueueItem,
  type PlaybackSupervisor,
} from "../../src/lib/voice-runtime";

export const PLAYBACK_SMOKE_AUDIO_REF_ENV = "JARVIS_PLAYBACK_SMOKE_AUDIO_REF";
export const PLAYBACK_SMOKE_DURATION_MS_ENV =
  "JARVIS_PLAYBACK_SMOKE_DURATION_MS";

export class PlaybackSmokeError extends Error {
  readonly error_class?: string;
  readonly exit_code?: number | null;
  readonly stderr_preview?: string;
  readonly command_metadata?: NonNullable<
    LocalPlaybackCommandResult["command_metadata"]
  >;
  readonly metadata_only = true;

  constructor(message: string, diagnostics?: PlaybackSmokeFailureDiagnostics) {
    super(message);
    this.name = "PlaybackSmokeError";
    this.error_class = diagnostics?.error_class;
    this.exit_code = diagnostics?.exit_code;
    this.stderr_preview = diagnostics?.stderr_preview;
    this.command_metadata = diagnostics?.command_metadata;
  }
}

export interface PlaybackSmokeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly statAudio?: (audioRef: string) => Promise<{ readonly size: number }>;
  readonly createDriver?: () => PlaybackDriver;
  readonly createAdapter?: (driver: PlaybackDriver) => LocalPlaybackAdapter;
  readonly createSupervisor?: (
    adapter: LocalPlaybackAdapter,
  ) => PlaybackSupervisor;
  readonly writeLine?: (line: string) => void;
}

export interface PlaybackSmokeReport {
  readonly status: "ok";
  readonly audio_ref: string;
  readonly provider_id: string;
  readonly voice_id: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly playback_state: string;
  readonly metadata_only: true;
}

export interface PlaybackSmokeFailureDiagnostics {
  readonly error_class: string;
  readonly exit_code?: number | null;
  readonly stderr_preview?: string;
  readonly command_metadata?: NonNullable<
    LocalPlaybackCommandResult["command_metadata"]
  >;
}

export async function runPlaybackSmoke(
  dependencies: PlaybackSmokeDependencies = {},
): Promise<PlaybackSmokeReport> {
  const env = dependencies.env ?? process.env;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const audioRef = requiredEnv(env[PLAYBACK_SMOKE_AUDIO_REF_ENV]);
  if (!audioRef) {
    throw new PlaybackSmokeError(
      "Set JARVIS_PLAYBACK_SMOKE_AUDIO_REF to an explicit local WAV file path. No playback was attempted.",
    );
  }

  const statAudio = dependencies.statAudio ?? stat;
  const audioStats = await statAudio(audioRef);
  if (!Number.isFinite(audioStats.size) || audioStats.size <= 0) {
    throw new PlaybackSmokeError(
      "Playback smoke audio metadata failed closed.",
    );
  }

  const durationMs =
    parseNonNegativeInteger(env[PLAYBACK_SMOKE_DURATION_MS_ENV]) ?? 0;
  const createDriver =
    dependencies.createDriver ?? (() => createLocalPlaybackDriver());
  const createAdapter =
    dependencies.createAdapter ??
    ((driver: PlaybackDriver) => createLocalPlaybackAdapter({ driver }));
  const createSupervisor =
    dependencies.createSupervisor ??
    ((adapter: LocalPlaybackAdapter) => createPlaybackSupervisor({ adapter }));

  const diagnosticsRef: { current?: PlaybackSmokeFailureDiagnostics } = {};
  const driver = capturePlaybackDiagnostics(createDriver(), diagnosticsRef);
  const adapter = createAdapter(driver);
  const supervisor = createSupervisor(adapter);
  const item = playbackSmokeItem({
    audio_ref: audioRef,
    duration_ms: durationMs,
    size_bytes: audioStats.size,
  });

  const enqueue = supervisor.enqueue(item);
  if (!enqueue.ok) {
    throw new PlaybackSmokeError(
      `Playback smoke enqueue failed closed: ${enqueue.reasons.join(",")}.`,
    );
  }
  const load = await supervisor.loadNext();
  if (!load.ok) {
    throw new PlaybackSmokeError(
      `Playback smoke load failed closed: ${load.reasons.join(",")}.`,
    );
  }
  const playback = await supervisor.beginPlayback();
  if (!playback.ok) {
    const diagnostics =
      diagnosticsRef.current ??
      ({
        error_class: playback.reasons[0] ?? "driver_error",
      } satisfies PlaybackSmokeFailureDiagnostics);
    writeLine("JARVIS local playback smoke");
    writeLine("status: failed");
    writeLine(`provider_id: ${item.provider_id}`);
    writeLine(`playback_state: ${playback.snapshot.playback_state}`);
    writeLine(`error_class: ${diagnostics.error_class}`);
    if (diagnostics.exit_code !== undefined) {
      writeLine(`exit_code: ${String(diagnostics.exit_code)}`);
    }
    if (diagnostics.stderr_preview) {
      writeLine(`stderr_preview: ${diagnostics.stderr_preview}`);
    }
    if (diagnostics.command_metadata) {
      writeLine(`command: ${diagnostics.command_metadata.command}`);
      writeLine(`arg_count: ${String(diagnostics.command_metadata.arg_count)}`);
      writeLine(`shell: ${String(diagnostics.command_metadata.shell)}`);
    }
    throw new PlaybackSmokeError(
      `Playback smoke play failed closed: ${playback.reasons.join(",")}.`,
      diagnostics,
    );
  }
  const completed = await supervisor.complete();
  const finalSnapshot = completed.snapshot;

  const report: PlaybackSmokeReport = {
    status: "ok",
    audio_ref: audioRef,
    provider_id: item.provider_id,
    voice_id: item.voice_id,
    duration_ms: durationMs,
    size_bytes: audioStats.size,
    playback_state: finalSnapshot.playback_state,
    metadata_only: true,
  };

  writeLine("JARVIS local playback smoke");
  writeLine("status: ok");
  writeLine(`audio_ref: ${report.audio_ref}`);
  writeLine(`provider_id: ${report.provider_id}`);
  writeLine(`voice_id: ${report.voice_id}`);
  writeLine(`duration_ms: ${String(report.duration_ms)}`);
  writeLine(`size_bytes: ${String(report.size_bytes)}`);
  writeLine(`playback_state: ${report.playback_state}`);

  return report;
}

export async function runPlaybackSmokeCli(): Promise<void> {
  try {
    await runPlaybackSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Playback smoke failed closed with an unknown error.";
    console.error(`JARVIS local playback smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function playbackSmokeItem(input: {
  readonly audio_ref: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
}): PlaybackQueueItem {
  return {
    item_id: "playback-smoke-item",
    session_id: "playback-smoke-session",
    turn_id: "playback-smoke-turn",
    chunk_id: "playback-smoke-chunk",
    provider_id: "manual-playback-smoke",
    voice_id: "local-wav",
    audio_ref: input.audio_ref,
    duration_ms: input.duration_ms,
    size_bytes: input.size_bytes,
    content_class: "assistant_prose",
    created_at: "2026-05-26T00:00:00.000Z",
    metadata_only: true,
  };
}

function requiredEnv(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseNonNegativeInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function capturePlaybackDiagnostics(
  driver: PlaybackDriver,
  diagnosticsRef: { current?: PlaybackSmokeFailureDiagnostics },
): PlaybackDriver {
  return {
    loadAudioRef: async (audioRef) => driver.loadAudioRef(audioRef),
    playLoaded: async () => {
      try {
        await driver.playLoaded();
      } catch (error) {
        diagnosticsRef.current = extractPlaybackFailureDiagnostics(error);
        throw error;
      }
    },
    stop: async () => driver.stop(),
    health: async () => driver.health(),
  };
}

function extractPlaybackFailureDiagnostics(
  error: unknown,
): PlaybackSmokeFailureDiagnostics {
  const record =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const diagnostics = isCommandResult(record.diagnostics)
    ? record.diagnostics
    : undefined;
  return {
    error_class:
      readString(diagnostics?.error_class) ??
      readString(record.reason) ??
      "driver_error",
    ...(diagnostics?.exit_code === undefined
      ? {}
      : { exit_code: diagnostics.exit_code }),
    ...(diagnostics?.stderr_preview === undefined
      ? {}
      : { stderr_preview: safeDiagnosticPreview(diagnostics.stderr_preview) }),
    ...(diagnostics?.command_metadata === undefined
      ? {}
      : { command_metadata: diagnostics.command_metadata }),
  };
}

function isCommandResult(value: unknown): value is LocalPlaybackCommandResult {
  return Boolean(value && typeof value === "object");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeDiagnosticPreview(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !isTracebackFrame(line.trim()))
    .join("\n")
    .slice(0, 512);
}

function isTracebackFrame(line: string): boolean {
  return (
    line === "Traceback (most recent call last):" ||
    /^File\s+["'][^"']+["'],\s+line\s+\d+/i.test(line) ||
    /^at\s+.+\(.+:\d+:\d+\)$/i.test(line) ||
    /^~+\^*$/.test(line)
  );
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("playback-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runPlaybackSmokeCli();
}
