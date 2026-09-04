import { spawn } from "node:child_process";
import { extname, isAbsolute } from "node:path";

import type { PlaybackDriver, PlaybackDriverHealth } from "./adapter";

export const LOCAL_PLAYBACK_DEFAULT_COMMAND = "powershell.exe";
// E-024 (runway R.2): the macOS playback command. `afplay` ships with macOS,
// needs no permission grant, takes the WAV path as a single argv element, and
// exits non-zero on failure. Selected by platform at construction; the Windows
// path above is unchanged.
export const LOCAL_PLAYBACK_DARWIN_COMMAND = "afplay";
export const LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS = 120_000;

export type LocalPlaybackPlatform = "win32" | "darwin";

function buildWindowsPlaybackScript(audioRef: string): string {
  // powershell.exe -Command does not populate $args from trailing argv;
  // any trailing tokens get concatenated into the script text and cause a
  // parser error. Embed the validated path inline as a single-quoted
  // PowerShell string literal with single quotes doubled for escaping.
  // isSafeLocalAudioRef already restricts audioRef to absolute local .wav
  // paths, so the only injection vector is single quotes.
  const escaped = audioRef.replace(/'/g, "''");
  return [
    `$player = New-Object System.Media.SoundPlayer('${escaped}')`,
    "$player.Load()",
    "$player.PlaySync()",
  ].join("; ");
}

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
  // E-024: which platform's command/argv shape to use. Defaults to the running
  // platform; non-darwin platforms keep the original Windows shape so the
  // Windows path is byte-for-byte the pre-E-024 behaviour.
  readonly platform?: NodeJS.Platform;
  // E-024: optional cancellation. Abort -> runner.stop() -> SIGTERM to the
  // playback child. Never starts playback; only ends it.
  readonly signal?: AbortSignal;
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

export function resolveLocalPlaybackPlatform(
  platform: NodeJS.Platform = process.platform,
): LocalPlaybackPlatform {
  return platform === "darwin" ? "darwin" : "win32";
}

export function defaultLocalPlaybackCommand(
  platform: NodeJS.Platform = process.platform,
): string {
  return resolveLocalPlaybackPlatform(platform) === "darwin"
    ? LOCAL_PLAYBACK_DARWIN_COMMAND
    : LOCAL_PLAYBACK_DEFAULT_COMMAND;
}

export function buildLocalPlaybackArgs(
  audioRef: string,
  platform: NodeJS.Platform = process.platform,
): readonly string[] {
  return resolveLocalPlaybackPlatform(platform) === "darwin"
    ? buildDarwinPlaybackArgs(audioRef)
    : buildWindowsPlaybackArgs(audioRef);
}

export function createLocalPlaybackDriver(
  options: LocalPlaybackDriverOptions = {},
): PlaybackDriver {
  const platform = options.platform ?? process.platform;
  const command = options.command ?? defaultLocalPlaybackCommand(platform);
  const runner = options.runner ?? createNodePlaybackCommandRunner();
  const timeoutMs = options.timeout_ms ?? LOCAL_PLAYBACK_DEFAULT_TIMEOUT_MS;
  let loadedAudioRef: string | null = null;
  let degraded = false;
  let lastError: PlaybackDriverHealth["error_class"];

  options.signal?.addEventListener(
    "abort",
    () => {
      void runner.stop().catch(() => undefined);
    },
    { once: true },
  );

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
        buildLocalPlaybackArgs(loadedAudioRef, platform),
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
          withCommandDiagnostics(result, command, timeoutMs, platform),
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
    buildWindowsPlaybackScript(audioRef),
  ];
}

// E-024: afplay takes the file path as ONE argv element (no shell, no script
// text), so there is nothing to escape — isSafeLocalAudioRef has already
// bounded the value to an absolute local .wav path.
export function buildDarwinPlaybackArgs(audioRef: string): readonly string[] {
  return [audioRef];
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
          // Default signal is SIGTERM on POSIX; on Windows kill() terminates.
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
  platform: NodeJS.Platform,
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
      commandMetadata(command, buildLocalPlaybackArgs("", platform).length, {
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
