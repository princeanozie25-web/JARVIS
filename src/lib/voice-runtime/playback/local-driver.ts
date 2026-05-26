import { spawn } from "node:child_process";
import { extname, isAbsolute } from "node:path";

import type { PlaybackDriver, PlaybackDriverHealth } from "./adapter";

export const LOCAL_PLAYBACK_DEFAULT_COMMAND = "powershell.exe";
export const LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS = 120_000;

const WINDOWS_WAV_PLAYBACK_SCRIPT = [
  "$audioRef = $args[0]",
  "$player = New-Object System.Media.SoundPlayer($audioRef)",
  "$player.Load()",
  "$player.PlaySync()",
].join("; ");

export type LocalPlaybackDriverFailureReason =
  | "invalid_audio_ref"
  | "not_loaded"
  | "playback_failed"
  | "stop_failed";

export interface LocalPlaybackCommandOptions {
  readonly shell: false;
  readonly timeout_ms: number;
  readonly metadata_only: true;
}

export interface LocalPlaybackCommandMetadata {
  readonly command: string;
  readonly arg_count: number;
  readonly shell: false;
  readonly timeout_ms: number;
  readonly metadata_only: true;
}

export interface LocalPlaybackCommandResult {
  readonly error_class?: PlaybackDriverHealth["error_class"];
  readonly exit_code: number | null;
  readonly signal: string | null;
  readonly stderr_preview?: string;
  readonly command_metadata?: LocalPlaybackCommandMetadata;
  readonly metadata_only: true;
}

export interface LocalPlaybackCommandRunner {
  run(
    command: string,
    args: readonly string[],
    options: LocalPlaybackCommandOptions,
  ): Promise<LocalPlaybackCommandResult>;
  stop(): Promise<void>;
}

export interface LocalPlaybackDriverOptions {
  readonly command?: string;
  readonly runner?: LocalPlaybackCommandRunner;
  readonly timeout_ms?: number;
}

export class LocalPlaybackDriverError extends Error {
  readonly reason: LocalPlaybackDriverFailureReason;
  readonly diagnostics?: LocalPlaybackCommandResult;
  readonly metadata_only = true;

  constructor(
    reason: LocalPlaybackDriverFailureReason,
    diagnostics?: LocalPlaybackCommandResult,
  ) {
    super(reason);
    this.name = "LocalPlaybackDriverError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

export function createLocalPlaybackDriver(
  options: LocalPlaybackDriverOptions = {},
): PlaybackDriver {
  const command = options.command ?? LOCAL_PLAYBACK_DEFAULT_COMMAND;
  const runner = options.runner ?? createNodePlaybackCommandRunner();
  const timeoutMs = options.timeout_ms ?? LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS;
  let loadedAudioRef: string | null = null;
  let degraded = false;
  let lastError: PlaybackDriverHealth["error_class"];

  return {
    loadAudioRef: async (audioRef) => {
      if (!isSafeLocalAudioRef(audioRef)) {
        lastError = "driver_error";
        throw new LocalPlaybackDriverError("invalid_audio_ref");
      }
      loadedAudioRef = audioRef;
    },
    playLoaded: async () => {
      if (!loadedAudioRef) {
        lastError = "driver_error";
        throw new LocalPlaybackDriverError("not_loaded");
      }

      const result = await runner.run(
        command,
        buildWindowsPlaybackArgs(loadedAudioRef),
        {
          shell: false,
          timeout_ms: timeoutMs,
          metadata_only: true,
        },
      );
      if (result.exit_code !== 0) {
        lastError = "driver_error";
        degraded = true;
        throw new LocalPlaybackDriverError(
          "playback_failed",
          withCommandDiagnostics(result, command, timeoutMs),
        );
      }
    },
    stop: async () => {
      try {
        await runner.stop();
      } catch {
        lastError = "driver_error";
        degraded = true;
        throw new LocalPlaybackDriverError("stop_failed");
      }
    },
    health: async () => ({
      ok: lastError === undefined,
      degraded,
      ...(lastError === undefined ? {} : { error_class: lastError }),
      metadata_only: true,
    }),
  };
}

export function buildWindowsPlaybackArgs(audioRef: string): readonly string[] {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    WINDOWS_WAV_PLAYBACK_SCRIPT,
    audioRef,
  ];
}

export function isSafeLocalAudioRef(audioRef: unknown): audioRef is string {
  if (typeof audioRef !== "string") return false;
  const trimmed = audioRef.trim();
  if (trimmed.length === 0) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
  if (!isAbsolute(trimmed)) return false;
  return extname(trimmed).toLowerCase() === ".wav";
}

export function createNodePlaybackCommandRunner(): LocalPlaybackCommandRunner {
  let active: {
    readonly kill: () => void;
  } | null = null;

  return {
    run: (command, args, options) =>
      new Promise<LocalPlaybackCommandResult>((resolve) => {
        const child = spawn(command, [...args], {
          shell: options.shell,
          windowsHide: true,
        });
        active = {
          kill: () => child.kill(),
        };
        let stderr = "";
        const timeout = setTimeout(() => {
          child.kill();
        }, options.timeout_ms);

        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        child.on("error", () => {
          clearTimeout(timeout);
          active = null;
          resolve({
            error_class: "unavailable",
            exit_code: null,
            signal: null,
            stderr_preview: "playback command unavailable",
            command_metadata: commandMetadata(command, args.length, options),
            metadata_only: true,
          });
        });
        child.on("close", (exitCode, signal) => {
          clearTimeout(timeout);
          active = null;
          resolve({
            ...(exitCode === 0 ? {} : { error_class: "driver_error" }),
            exit_code: exitCode,
            signal,
            ...(stderr.length === 0
              ? {}
              : { stderr_preview: safeDiagnosticPreview(stderr) }),
            command_metadata: commandMetadata(command, args.length, options),
            metadata_only: true,
          });
        });
      }),
    stop: async () => {
      active?.kill();
      active = null;
    },
  };
}

function withCommandDiagnostics(
  result: LocalPlaybackCommandResult,
  command: string,
  timeoutMs: number,
): LocalPlaybackCommandResult {
  return {
    error_class: result.error_class ?? "driver_error",
    exit_code: result.exit_code,
    signal: result.signal,
    ...(result.stderr_preview === undefined
      ? {}
      : { stderr_preview: safeDiagnosticPreview(result.stderr_preview) }),
    command_metadata:
      result.command_metadata ??
      commandMetadata(command, buildWindowsPlaybackArgs("").length, {
        shell: false,
        timeout_ms: timeoutMs,
        metadata_only: true,
      }),
    metadata_only: true,
  };
}

function commandMetadata(
  command: string,
  argCount: number,
  options: LocalPlaybackCommandOptions,
): LocalPlaybackCommandMetadata {
  return {
    command: command.slice(0, 80),
    arg_count: argCount,
    shell: options.shell,
    timeout_ms: options.timeout_ms,
    metadata_only: true,
  };
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
