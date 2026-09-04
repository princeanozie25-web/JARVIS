import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { validateSttTranscriptionRequest, type SttProvider } from "./provider";
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

// Phase 25D part 2 (E-039) — the SHARED MECHANISM for Python-backed STT
// engines behind the frozen SttProvider seam: spawn an interpreter with an
// inline helper, bound stdout/stderr, honour timeout + abort + cancel, parse
// ONE final JSON line (and optional `{"partial": …}` lines before it), and
// return the same SttTranscriptionResult the Phase 14 faster-whisper provider
// returns. The frozen faster-whisper provider is untouched (it keeps its own
// copy of this machinery); parakeet-mlx and mlx-whisper are built on this
// one. Shared mechanism, not shared authority: nothing here grants execution.

const DIAGNOSTIC_LIMIT = 512;
const TRANSCRIPT_LIMIT = 4_000;
const TRACEBACK_WITHHELD = "[python traceback withheld]";

export interface PythonSttSpawnOptions {
  readonly shell: false;
  readonly windowsHide: true;
  readonly stdio: "pipe";
}

export interface PythonSttSpawnedProcess {
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

export interface PythonSttProcessRunner {
  readonly spawn: (
    executablePath: string,
    args: readonly string[],
    options: PythonSttSpawnOptions,
  ) => PythonSttSpawnedProcess;
  readonly now_ms: () => number;
}

export interface PythonSttEngineConfig {
  readonly providerId: string;
  readonly modelId: string;
  /** The interpreter (a venv python). Empty → provider fails closed. */
  readonly pythonCommand: string;
  /** The inline helper passed via `-c`; it must print one final JSON line. */
  readonly helperScript: string;
  /** Extra argv after `--audio-ref <ref>`. */
  readonly extraArgs?: readonly string[];
  readonly language?: string;
  readonly timeoutMs: number;
  readonly maxAudioBytes: number;
}

export interface PythonSttProviderOptions {
  readonly config: PythonSttEngineConfig;
  readonly runner?: Partial<PythonSttProcessRunner>;
  /** Streaming partials (parakeet emits them per sentence). Metadata: text only. */
  readonly onPartial?: (partial: string) => void;
}

export class PythonSttProviderError extends Error {
  readonly reason: SttCancellationReason | "provider_error";
  readonly diagnostics?: SttExecutionDiagnostics;
  readonly metadata_only = true;

  constructor(
    providerId: string,
    reason: SttCancellationReason | "provider_error",
    diagnostics?: SttExecutionDiagnostics,
  ) {
    super(`${providerId} STT provider failed closed: ${reason}`);
    this.name = "PythonSttProviderError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

export function createPythonSttProvider(
  options: PythonSttProviderOptions,
): SttProvider {
  const config = options.config;
  const configured =
    config.pythonCommand.trim().length > 0 &&
    config.helperScript.trim().length > 0 &&
    config.modelId.trim().length > 0;
  const providerConfig: SttProviderConfig = {
    provider_id: config.providerId,
    provider_kind: "local",
    model_id: config.modelId,
    ...(config.language === undefined ? {} : { language: config.language }),
    max_audio_bytes: config.maxAudioBytes,
    timeout_ms: config.timeoutMs,
    metadata_only: true,
  };
  const runner = createRunner(options.runner);
  let inFlight: PythonSttSpawnedProcess | null = null;
  let cancelledReason: SttCancellationReason | null = null;
  let lastErrorClass: SttCancellationReason | "provider_error" | undefined =
    configured ? undefined : "provider_error";

  return {
    id: providerConfig.provider_id,
    kind: "local",
    config: providerConfig,
    metadata_only: true,
    transcribe: async (
      request: SttTranscriptionRequest,
      transcribeOptions: SttTranscriptionOptions,
    ) => {
      const failure = (
        reason: SttCancellationReason | "provider_error",
        diagnostics?: SttExecutionDiagnostics,
      ): PythonSttProviderError => {
        lastErrorClass = reason;
        return new PythonSttProviderError(
          config.providerId,
          reason,
          diagnostics,
        );
      };
      if (!configured) throw failure("provider_error");
      if (cancelledReason) throw failure(cancelledReason);
      if (transcribeOptions.abort_signal?.aborted)
        throw failure("abort_signal");

      const requestValidation = validateSttTranscriptionRequest(
        request,
        providerConfig,
      );
      if (!requestValidation.ok) {
        throw failure(
          requestValidation.reasons.includes("audio_too_large")
            ? "policy_blocked"
            : "provider_error",
        );
      }

      const startedAt = runner.now_ms();
      const execution = await runPythonProcess({
        executablePath: config.pythonCommand,
        args: [
          "-c",
          config.helperScript,
          "--audio-ref",
          request.audio.audio_ref,
          ...(config.language === undefined
            ? []
            : ["--language", config.language]),
          ...(config.extraArgs ?? []),
        ],
        processRunner: runner,
        signal: transcribeOptions.abort_signal,
        timeoutMs: transcribeOptions.timeout_ms ?? config.timeoutMs,
        onProcess: (process) => {
          inFlight = process;
        },
        onLine: (line) => {
          const partial = parsePartialLine(line);
          if (partial !== null) options.onPartial?.(partial);
        },
      }).finally(() => {
        inFlight = null;
      });

      if (!execution.ok) throw failure(execution.reason, execution.diagnostics);

      const parsed = parseFinalJson(execution.stdout);
      if (!parsed.ok) {
        throw failure(
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
      ok: configured && cancelledReason === null,
      provider_kind: "local",
      checked_at_ms: runner.now_ms(),
      degraded: !configured || cancelledReason !== null,
      ...(lastErrorClass === undefined
        ? {}
        : { last_error_class: lastErrorClass }),
      metadata_only: true,
    }),
  };
}

// ---------------------------------------------------------------------------

interface RunInput {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly processRunner: PythonSttProcessRunner;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly onProcess: (process: PythonSttSpawnedProcess) => void;
  readonly onLine: (line: string) => void;
}

type ExecutionResult =
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

function runPythonProcess(input: RunInput): Promise<ExecutionResult> {
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
    let lineBuffer = "";

    const settle = (result: ExecutionResult) => {
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

    process.stdout.on("data", (chunk) => {
      stdout.push(chunk);
      lineBuffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      let newline = lineBuffer.indexOf("\n");
      while (newline >= 0) {
        input.onLine(lineBuffer.slice(0, newline));
        lineBuffer = lineBuffer.slice(newline + 1);
        newline = lineBuffer.indexOf("\n");
      }
    });
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
  runner?: Partial<PythonSttProcessRunner>,
): PythonSttProcessRunner {
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

function parsePartialLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return typeof parsed.partial === "string"
      ? parsed.partial.slice(0, TRANSCRIPT_LIMIT)
      : null;
  } catch {
    return null;
  }
}

type ParsedOutput =
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
  | { readonly ok: false };

const CONFIDENCE_BANDS: readonly SttConfidenceBand[] = [
  "high",
  "medium",
  "low",
  "unknown",
];

/** The LAST JSON line of stdout is the final result (partials precede it). */
export function parseFinalJson(stdout: string): ParsedOutput {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
  const last = lines[lines.length - 1];
  if (!last) return { ok: false };
  try {
    const parsed = JSON.parse(last) as Record<string, unknown>;
    if (typeof parsed.transcript !== "string" || parsed.transcript.length === 0)
      return { ok: false };
    if (typeof parsed.language !== "string" || parsed.language.length === 0)
      return { ok: false };
    if (
      parsed.latency_ms !== undefined &&
      !(
        typeof parsed.latency_ms === "number" &&
        Number.isFinite(parsed.latency_ms) &&
        parsed.latency_ms >= 0
      )
    ) {
      return { ok: false };
    }
    if (!CONFIDENCE_BANDS.includes(parsed.confidence_band as SttConfidenceBand))
      return { ok: false };
    if (typeof parsed.degraded !== "boolean") return { ok: false };
    return {
      ok: true,
      output: {
        transcript: parsed.transcript,
        language: parsed.language,
        ...(parsed.latency_ms === undefined
          ? {}
          : { latency_ms: parsed.latency_ms as number }),
        confidence_band: parsed.confidence_band as SttConfidenceBand,
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
  value: SttExecutionDiagnostics,
  errorClass: SttCancellationReason | "provider_error",
): SttExecutionDiagnostics {
  return { ...value, error_class: errorClass, metadata_only: true };
}

function sanitizeDiagnosticPreview(value: string): string {
  if (value.length === 0) return "";
  const sanitized: string[] = [];
  let withheldTraceback = false;
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      trimmed === "Traceback (most recent call last):" ||
      /^File\s+["'][^"']+["'],\s+line\s+\d+/i.test(trimmed) ||
      /^~+\^*$/.test(trimmed)
    ) {
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
