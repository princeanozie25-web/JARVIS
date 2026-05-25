import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { TtsProvider } from "./provider";
import { validateTtsSynthesisRequest } from "./provider";
import type { PiperProviderConfig } from "./piper-contract";
import { validatePiperProviderConfig } from "./piper-contract";
import type {
  TtsCancellationReason,
  TtsExecutionDiagnostics,
  TtsProviderConfig,
  TtsProviderHealth,
  TtsSynthesisOptions,
  TtsSynthesisRequest,
} from "./types";

const DIAGNOSTIC_LIMIT = 512;

export interface PiperSpawnOptions {
  readonly shell: false;
  readonly windowsHide: true;
  readonly stdio: "pipe";
}

export interface PiperSpawnedProcess {
  readonly stdin: {
    write(chunk: string): boolean;
    end(): void;
  };
  readonly stdout: {
    on(event: "data", listener: (chunk: Buffer | string) => void): void;
  };
  readonly stderr: {
    on(event: "data", listener: (chunk: Buffer | string) => void): void;
  };
  on(event: "error", listener: (error: Error) => void): void;
  on(
    event: "close",
    listener: (code: number | null, signal: string | null) => void,
  ): void;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface PiperProcessRunner {
  readonly spawn: (
    executablePath: string,
    args: readonly string[],
    options: PiperSpawnOptions,
  ) => PiperSpawnedProcess;
  readonly mkdir: (path: string) => Promise<void>;
  readonly stat: (path: string) => Promise<{ readonly size: number }>;
  readonly now_ms: () => number;
}

export interface PiperTtsProviderOptions {
  readonly config: PiperProviderConfig;
  readonly runner?: Partial<PiperProcessRunner>;
}

export class PiperTtsProviderError extends Error {
  readonly reason: TtsCancellationReason | "provider_error";
  readonly diagnostics?: TtsExecutionDiagnostics;
  readonly metadata_only = true;

  constructor(
    reason: TtsCancellationReason | "provider_error",
    diagnostics?: TtsExecutionDiagnostics,
  ) {
    super(`Piper TTS provider failed closed: ${reason}`);
    this.name = "PiperTtsProviderError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

export function createPiperTtsProvider(
  options: PiperTtsProviderOptions,
): TtsProvider {
  const validation = validatePiperProviderConfig(options.config);
  const config = validation.ok ? validation.config : options.config;
  const providerConfig: TtsProviderConfig = {
    provider_id: config.providerId,
    provider_kind: "local",
    voice_id: config.voiceId,
    max_input_chars: config.maxInputChars,
    timeout_ms: config.timeoutMs,
    metadata_only: true,
  };
  const runner = createRunner(options.runner);
  let inFlight: PiperSpawnedProcess | null = null;
  let cancelledReason: TtsCancellationReason | null = null;
  let lastErrorClass: TtsCancellationReason | "provider_error" | undefined =
    validation.ok ? undefined : "provider_error";

  return {
    id: providerConfig.provider_id,
    kind: "local",
    config: providerConfig,
    metadata_only: true,
    synthesize: async (
      request: TtsSynthesisRequest,
      synthOptions: TtsSynthesisOptions,
    ) => {
      if (!validation.ok) {
        lastErrorClass = "provider_error";
        throw new PiperTtsProviderError("provider_error");
      }
      if (cancelledReason) {
        lastErrorClass = cancelledReason;
        throw new PiperTtsProviderError(cancelledReason);
      }
      if (synthOptions.abort_signal?.aborted) {
        lastErrorClass = "abort_signal";
        throw new PiperTtsProviderError("abort_signal");
      }

      const requestValidation = validateTtsSynthesisRequest(
        request,
        providerConfig,
      );
      if (!requestValidation.ok) {
        lastErrorClass = requestValidation.reasons.includes(
          "sensitive_content_blocked",
        )
          ? "policy_blocked"
          : "provider_error";
        throw new PiperTtsProviderError(lastErrorClass);
      }

      const startedAt = runner.now_ms();
      const chunkId = deterministicChunkId(request, providerConfig);
      const filename = safeOutputFilename(request, chunkId);
      const outputPath = join(config.outputDirectory, filename);
      const args = buildPiperArgs(config, outputPath);

      await runner.mkdir(config.outputDirectory);
      const execution = await runPiperProcess({
        args,
        config,
        outputPath,
        processRunner: runner,
        request,
        signal: synthOptions.abort_signal,
        timeoutMs: synthOptions.timeout_ms ?? config.timeoutMs,
        onProcess: (process) => {
          inFlight = process;
        },
      }).finally(() => {
        inFlight = null;
      });

      if (!execution.ok) {
        lastErrorClass = execution.reason;
        throw new PiperTtsProviderError(
          execution.reason,
          execution.diagnostics,
        );
      }

      const file = await runner.stat(outputPath).catch(() => ({ size: 0 }));
      return {
        request_id: request.request_id,
        chunk: {
          chunk_id: chunkId,
          provider_id: providerConfig.provider_id,
          voice_id: providerConfig.voice_id,
          duration_ms: estimateDurationMs(request.text),
          size_bytes: file.size,
          degraded: false,
          output_ref: outputPath,
          metadata_only: true,
        },
        latency_ms: Math.max(0, runner.now_ms() - startedAt),
        degraded: false,
        diagnostics: execution.diagnostics,
        metadata_only: true,
      };
    },
    cancel: async (reason: TtsCancellationReason) => {
      cancelledReason = reason;
      lastErrorClass = reason;
      inFlight?.kill("SIGTERM");
    },
    health: async (): Promise<TtsProviderHealth> => ({
      provider_id: providerConfig.provider_id,
      ok: validation.ok && cancelledReason === null,
      provider_kind: "local",
      checked_at_ms: runner.now_ms(),
      degraded: !validation.ok || cancelledReason !== null,
      ...(lastErrorClass === undefined
        ? {}
        : { last_error_class: lastErrorClass }),
      metadata_only: true,
    }),
  };
}

export function buildPiperArgs(
  config: PiperProviderConfig,
  outputPath: string,
): readonly string[] {
  return [
    "--model",
    config.voiceModelPath,
    "--config",
    config.voiceConfigPath,
    "--output_file",
    outputPath,
  ];
}

interface RunPiperProcessInput {
  readonly args: readonly string[];
  readonly config: PiperProviderConfig;
  readonly outputPath: string;
  readonly processRunner: PiperProcessRunner;
  readonly request: TtsSynthesisRequest;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly onProcess: (process: PiperSpawnedProcess) => void;
}

type PiperExecutionResult =
  | {
      readonly ok: true;
      readonly diagnostics: TtsExecutionDiagnostics;
    }
  | {
      readonly ok: false;
      readonly reason: TtsCancellationReason | "provider_error";
      readonly diagnostics: TtsExecutionDiagnostics;
    };

function runPiperProcess(
  input: RunPiperProcessInput,
): Promise<PiperExecutionResult> {
  return new Promise((resolve) => {
    const process = input.processRunner.spawn(
      input.config.piperExecutablePath,
      input.args,
      {
        shell: false,
        stdio: "pipe",
        windowsHide: true,
      },
    );
    input.onProcess(process);
    const stdout = createBoundedCollector();
    const stderr = createBoundedCollector();
    let settled = false;

    const settle = (result: PiperExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      process.kill("SIGTERM");
      settle({
        ok: false,
        reason: "timeout",
        diagnostics: diagnostics(stdout, stderr, null, "SIGTERM"),
      });
    }, input.timeoutMs);
    const abort = () => {
      process.kill("SIGTERM");
      settle({
        ok: false,
        reason: "abort_signal",
        diagnostics: diagnostics(stdout, stderr, null, "SIGTERM"),
      });
    };

    process.stdout.on("data", stdout.push);
    process.stderr.on("data", stderr.push);
    process.on("error", () => {
      settle({
        ok: false,
        reason: "provider_error",
        diagnostics: diagnostics(stdout, stderr, null, null),
      });
    });
    process.on("close", (code, signal) => {
      const processDiagnostics = diagnostics(stdout, stderr, code, signal);
      settle(
        code === 0
          ? {
              ok: true,
              diagnostics: processDiagnostics,
            }
          : {
              ok: false,
              reason: "provider_error",
              diagnostics: processDiagnostics,
            },
      );
    });
    input.signal?.addEventListener("abort", abort, { once: true });
    process.stdin.write(
      input.request.text.slice(0, input.config.maxInputChars),
    );
    process.stdin.end();
  });
}

function createRunner(
  runner?: Partial<PiperProcessRunner>,
): PiperProcessRunner {
  return {
    spawn:
      runner?.spawn ??
      ((executablePath, args, options) =>
        spawn(
          executablePath,
          [...args],
          options,
        ) as ChildProcessWithoutNullStreams),
    mkdir: runner?.mkdir ?? ((path) => mkdir(path, { recursive: true }).then()),
    stat: runner?.stat ?? ((path) => stat(path)),
    now_ms: runner?.now_ms ?? (() => Date.now()),
  };
}

function safeOutputFilename(
  request: TtsSynthesisRequest,
  chunkId: string,
): string {
  return `${safeSegment(request.session_id)}-${safeSegment(
    request.turn_id,
  )}-${chunkId}.wav`;
}

function safeSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return normalized.length === 0 ? "voice" : normalized;
}

function deterministicChunkId(
  request: TtsSynthesisRequest,
  config: TtsProviderConfig,
): string {
  return `piper-${stableHash(
    [
      config.provider_id,
      request.request_id,
      request.session_id,
      request.turn_id,
      request.requested_voice_id,
    ].join("|"),
  )}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function estimateDurationMs(text: string): number {
  return Math.max(250, text.length * 35);
}

function createBoundedCollector() {
  let value = "";
  let truncated = false;
  return {
    push: (chunk: Buffer | string) => {
      if (value.length >= DIAGNOSTIC_LIMIT) {
        truncated = true;
        return;
      }
      const next = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      value = `${value}${next}`.slice(0, DIAGNOSTIC_LIMIT);
      truncated = truncated || next.length + value.length > DIAGNOSTIC_LIMIT;
    },
    preview: () => value,
    truncated: () => truncated,
  };
}

function diagnostics(
  stdout: ReturnType<typeof createBoundedCollector>,
  stderr: ReturnType<typeof createBoundedCollector>,
  exitCode: number | null,
  signal: string | null,
): TtsExecutionDiagnostics {
  return {
    ...(stdout.preview().length === 0
      ? {}
      : { stdout_preview: stdout.preview() }),
    ...(stderr.preview().length === 0
      ? {}
      : { stderr_preview: stderr.preview() }),
    exit_code: exitCode,
    signal,
    truncated: stdout.truncated() || stderr.truncated(),
    metadata_only: true,
  };
}
