import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { SttProvider } from "./provider";
import { validateSttTranscriptionRequest } from "./provider";
import type { FasterWhisperProviderConfig } from "./faster-whisper-contract";
import { validateFasterWhisperProviderConfig } from "./faster-whisper-contract";
import type {
  SttCancellationReason,
  SttConfidenceBand,
  SttExecutionDiagnostics,
  SttProviderConfig,
  SttProviderHealth,
  SttTranscriptionOptions,
  SttTranscriptionRequest,
  SttTranscriptionResult,
} from "./types";

const DIAGNOSTIC_LIMIT = 512;
const TRANSCRIPT_LIMIT = 4_000;
const TRACEBACK_WITHHELD = "[python traceback withheld]";
const FASTER_WHISPER_PYTHON_HELPER = [
  "import argparse,json,time",
  "from faster_whisper import WhisperModel",
  "parser=argparse.ArgumentParser()",
  "parser.add_argument('audio_ref')",
  "parser.add_argument('--model_path',required=True)",
  "parser.add_argument('--model_name',required=True)",
  "parser.add_argument('--beam_size',type=int,required=True)",
  "parser.add_argument('--language')",
  "parser.add_argument('--vad_filter',choices=['true','false'],default='false')",
  "args=parser.parse_args()",
  "started=time.perf_counter()",
  "model=WhisperModel(args.model_path)",
  "segments,info=model.transcribe(args.audio_ref,beam_size=args.beam_size,language=args.language or None,vad_filter=args.vad_filter=='true')",
  "transcript=''.join(segment.text for segment in segments).strip()",
  "language=getattr(info,'language',None) or args.language or 'unknown'",
  "latency_ms=int((time.perf_counter()-started)*1000)",
  "print(json.dumps({'transcript':transcript,'language':language,'latency_ms':latency_ms,'confidence_band':'unknown','degraded':False}),flush=True)",
].join("\n");

export interface FasterWhisperSpawnOptions {
  readonly shell: false;
  readonly windowsHide: true;
  readonly stdio: "pipe";
}

export interface FasterWhisperSpawnedProcess {
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

export interface FasterWhisperProcessRunner {
  readonly spawn: (
    executablePath: string,
    args: readonly string[],
    options: FasterWhisperSpawnOptions,
  ) => FasterWhisperSpawnedProcess;
  readonly now_ms: () => number;
}

export interface FasterWhisperSttProviderOptions {
  readonly config: FasterWhisperProviderConfig;
  readonly runner?: Partial<FasterWhisperProcessRunner>;
}

export class FasterWhisperSttProviderError extends Error {
  readonly reason: SttCancellationReason | "provider_error";
  readonly diagnostics?: SttExecutionDiagnostics;
  readonly metadata_only = true;

  constructor(
    reason: SttCancellationReason | "provider_error",
    diagnostics?: SttExecutionDiagnostics,
  ) {
    super(`faster-whisper STT provider failed closed: ${reason}`);
    this.name = "FasterWhisperSttProviderError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

export function createFasterWhisperSttProvider(
  options: FasterWhisperSttProviderOptions,
): SttProvider {
  const validation = validateFasterWhisperProviderConfig(options.config);
  const config = validation.ok ? validation.config : options.config;
  const providerConfig: SttProviderConfig = {
    provider_id: config.providerId,
    provider_kind: "local",
    model_id: config.modelName,
    ...(config.language === undefined ? {} : { language: config.language }),
    max_audio_bytes: config.maxAudioBytes,
    timeout_ms: config.timeoutMs,
    metadata_only: true,
  };
  const runner = createRunner(options.runner);
  let inFlight: FasterWhisperSpawnedProcess | null = null;
  let cancelledReason: SttCancellationReason | null = null;
  let lastErrorClass: SttCancellationReason | "provider_error" | undefined =
    validation.ok ? undefined : "provider_error";

  return {
    id: providerConfig.provider_id,
    kind: "local",
    config: providerConfig,
    metadata_only: true,
    transcribe: async (
      request: SttTranscriptionRequest,
      transcribeOptions: SttTranscriptionOptions,
    ) => {
      if (!validation.ok) {
        lastErrorClass = "provider_error";
        throw new FasterWhisperSttProviderError("provider_error");
      }
      if (cancelledReason) {
        lastErrorClass = cancelledReason;
        throw new FasterWhisperSttProviderError(cancelledReason);
      }
      if (transcribeOptions.abort_signal?.aborted) {
        lastErrorClass = "abort_signal";
        throw new FasterWhisperSttProviderError("abort_signal");
      }

      const requestValidation = validateSttTranscriptionRequest(
        request,
        providerConfig,
      );
      if (!requestValidation.ok) {
        lastErrorClass = requestValidation.reasons.includes("audio_too_large")
          ? "policy_blocked"
          : "provider_error";
        throw new FasterWhisperSttProviderError(lastErrorClass);
      }

      const startedAt = runner.now_ms();
      const command = buildFasterWhisperCommand(
        config,
        request.audio.audio_ref,
      );
      const execution = await runFasterWhisperProcess({
        args: command.args,
        executablePath: command.executablePath,
        processRunner: runner,
        signal: transcribeOptions.abort_signal,
        timeoutMs: transcribeOptions.timeout_ms ?? config.timeoutMs,
        onProcess: (process) => {
          inFlight = process;
        },
      }).finally(() => {
        inFlight = null;
      });

      if (!execution.ok) {
        lastErrorClass = execution.reason;
        throw new FasterWhisperSttProviderError(
          execution.reason,
          execution.diagnostics,
        );
      }

      const parsed = parseFasterWhisperJson(execution.stdout);
      if (!parsed.ok) {
        lastErrorClass = "provider_error";
        throw new FasterWhisperSttProviderError(
          "provider_error",
          withErrorClass(execution.diagnostics, "provider_error"),
        );
      }

      return {
        request_id: request.request_id,
        provider_id: providerConfig.provider_id,
        transcript: parsed.output.transcript.slice(0, TRANSCRIPT_LIMIT),
        language: parsed.output.language,
        latency_ms:
          parsed.output.latency_ms ?? Math.max(0, runner.now_ms() - startedAt),
        degraded: parsed.output.degraded,
        confidence_band: parsed.output.confidence_band,
        diagnostics: execution.diagnostics,
        metadata_only: true,
      } satisfies SttTranscriptionResult;
    },
    cancel: async (reason: SttCancellationReason) => {
      cancelledReason = reason;
      lastErrorClass = reason;
      inFlight?.kill("SIGTERM");
    },
    health: async (): Promise<SttProviderHealth> => ({
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

export function buildFasterWhisperArgs(
  config: FasterWhisperProviderConfig,
  audioRef: string,
): readonly string[] {
  if (config.pythonCommand !== undefined) {
    return [
      "-c",
      FASTER_WHISPER_PYTHON_HELPER,
      audioRef,
      "--model_path",
      config.modelPath,
      "--model_name",
      config.modelName,
      "--beam_size",
      String(config.beamSize),
      ...(config.language === undefined ? [] : ["--language", config.language]),
      "--vad_filter",
      config.vadEnabled ? "true" : "false",
    ];
  }

  return [
    audioRef,
    "--model",
    config.modelName,
    "--model_dir",
    config.modelPath,
    "--beam_size",
    String(config.beamSize),
    "--output_format",
    "json",
    ...(config.language === undefined ? [] : ["--language", config.language]),
    ...(config.vadEnabled ? ["--vad_filter", "true"] : []),
  ];
}

interface FasterWhisperCommand {
  readonly executablePath: string;
  readonly args: readonly string[];
}

function buildFasterWhisperCommand(
  config: FasterWhisperProviderConfig,
  audioRef: string,
): FasterWhisperCommand {
  const executablePath = config.pythonCommand ?? config.executablePath;
  if (!executablePath) {
    return {
      executablePath: "",
      args: [],
    };
  }
  return {
    executablePath,
    args: buildFasterWhisperArgs(config, audioRef),
  };
}

interface RunFasterWhisperProcessInput {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly processRunner: FasterWhisperProcessRunner;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly onProcess: (process: FasterWhisperSpawnedProcess) => void;
}

type FasterWhisperExecutionResult =
  | {
      readonly ok: true;
      readonly stdout: string;
      readonly diagnostics: SttExecutionDiagnostics;
    }
  | {
      readonly ok: false;
      readonly reason: SttCancellationReason | "provider_error";
      readonly stdout: string;
      readonly diagnostics: SttExecutionDiagnostics;
    };

function runFasterWhisperProcess(
  input: RunFasterWhisperProcessInput,
): Promise<FasterWhisperExecutionResult> {
  return new Promise((resolve) => {
    const process = input.processRunner.spawn(
      input.executablePath,
      input.args,
      {
        shell: false,
        stdio: "pipe",
        windowsHide: true,
      },
    );
    input.onProcess(process);
    const stdout = createBoundedCollector(TRANSCRIPT_LIMIT + DIAGNOSTIC_LIMIT);
    const stderr = createBoundedCollector(DIAGNOSTIC_LIMIT);
    let settled = false;

    const settle = (result: FasterWhisperExecutionResult) => {
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
        stdout: stdout.preview(),
        diagnostics: diagnostics("timeout", stdout, stderr, null, "SIGTERM"),
      });
    }, input.timeoutMs);
    const abort = () => {
      process.kill("SIGTERM");
      settle({
        ok: false,
        reason: "abort_signal",
        stdout: stdout.preview(),
        diagnostics: diagnostics(
          "abort_signal",
          stdout,
          stderr,
          null,
          "SIGTERM",
        ),
      });
    };

    process.stdout.on("data", stdout.push);
    process.stderr.on("data", stderr.push);
    process.on("error", () => {
      settle({
        ok: false,
        reason: "provider_error",
        stdout: stdout.preview(),
        diagnostics: diagnostics("provider_error", stdout, stderr, null, null),
      });
    });
    process.on("close", (code, signal) => {
      const errorClass = code === 0 ? undefined : "provider_error";
      const processDiagnostics = diagnostics(
        errorClass,
        stdout,
        stderr,
        code,
        signal,
      );
      settle(
        code === 0
          ? {
              ok: true,
              stdout: stdout.preview(),
              diagnostics: processDiagnostics,
            }
          : {
              ok: false,
              reason: "provider_error",
              stdout: stdout.preview(),
              diagnostics: processDiagnostics,
            },
      );
    });
    input.signal?.addEventListener("abort", abort, { once: true });
  });
}

function createRunner(
  runner?: Partial<FasterWhisperProcessRunner>,
): FasterWhisperProcessRunner {
  return {
    spawn:
      runner?.spawn ??
      ((executablePath, args, options) =>
        spawn(
          executablePath,
          [...args],
          options,
        ) as ChildProcessWithoutNullStreams),
    now_ms: runner?.now_ms ?? (() => Date.now()),
  };
}

type ParsedFasterWhisperOutput =
  | {
      readonly ok: true;
      readonly output: {
        readonly transcript: string;
        readonly language: string;
        readonly latency_ms?: number;
        readonly confidence_band: SttConfidenceBand;
        readonly degraded: boolean;
      };
    }
  | {
      readonly ok: false;
    };

function parseFasterWhisperJson(stdout: string): ParsedFasterWhisperOutput {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (!isNonemptyString(parsed.transcript)) return { ok: false };
    if (!isNonemptyString(parsed.language)) return { ok: false };
    if (
      parsed.latency_ms !== undefined &&
      !isNonnegativeNumber(parsed.latency_ms)
    ) {
      return { ok: false };
    }
    if (!isConfidenceBand(parsed.confidence_band)) return { ok: false };
    if (typeof parsed.degraded !== "boolean") return { ok: false };
    return {
      ok: true,
      output: {
        transcript: parsed.transcript,
        language: parsed.language,
        ...(parsed.latency_ms === undefined
          ? {}
          : { latency_ms: parsed.latency_ms }),
        confidence_band: parsed.confidence_band,
        degraded: parsed.degraded,
      },
    };
  } catch {
    return { ok: false };
  }
}

function createBoundedCollector(limit: number) {
  let value = "";
  let truncated = false;
  return {
    push: (chunk: Buffer | string) => {
      if (value.length >= limit) {
        truncated = true;
        return;
      }
      const next = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const combined = `${value}${next}`;
      value = combined.slice(0, limit);
      truncated = truncated || combined.length > limit;
    },
    preview: () => value,
    truncated: () => truncated,
  };
}

function diagnostics(
  errorClass: SttCancellationReason | "provider_error" | undefined,
  stdout: ReturnType<typeof createBoundedCollector>,
  stderr: ReturnType<typeof createBoundedCollector>,
  exitCode: number | null,
  signal: string | null,
): SttExecutionDiagnostics {
  const sanitizedStderr = sanitizeDiagnosticPreview(stderr.preview());
  return {
    ...(errorClass === undefined ? {} : { error_class: errorClass }),
    ...(sanitizedStderr.length === 0
      ? {}
      : { stderr_preview: sanitizedStderr }),
    exit_code: exitCode,
    signal,
    truncated: stdout.truncated() || stderr.truncated(),
    metadata_only: true,
  };
}

function withErrorClass(
  diagnostics: SttExecutionDiagnostics,
  errorClass: SttCancellationReason | "provider_error",
): SttExecutionDiagnostics {
  return {
    ...diagnostics,
    error_class: errorClass,
    metadata_only: true,
  };
}

function sanitizeDiagnosticPreview(value: string): string {
  if (value.length === 0) return "";
  const lines = value.split(/\r?\n/);
  const sanitized: string[] = [];
  let withheldTraceback = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (isTracebackFrame(trimmed)) {
      if (!withheldTraceback) {
        sanitized.push(TRACEBACK_WITHHELD);
        withheldTraceback = true;
      }
      continue;
    }
    sanitized.push(line);
  }
  return sanitized.join("\n").slice(0, DIAGNOSTIC_LIMIT);
}

function isTracebackFrame(line: string): boolean {
  return (
    line === "Traceback (most recent call last):" ||
    /^File\s+["'][^"']+["'],\s+line\s+\d+/i.test(line) ||
    /^~+\^*$/.test(line)
  );
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isConfidenceBand(value: unknown): value is SttConfidenceBand {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "unknown"
  );
}
