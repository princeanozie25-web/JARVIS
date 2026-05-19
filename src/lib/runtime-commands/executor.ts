import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import type DatabaseType from "better-sqlite3";
import {
  attachRuntimeCommandOutputRefs,
  getRuntimeCommandCall,
  updateRuntimeCommandCallStatus,
  type RuntimeCommandCallRow,
} from "../db/runtime-command-calls";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  RuntimeExecutionController,
  runtimeExecutionController,
} from "./execution-controller";
import {
  runtimeCommandRegistry,
  type RuntimeCommandRegistry,
  type RuntimeCommandSpec,
} from "./index";

export const RUNTIME_COMMAND_OUTPUT_LIMIT_BYTES = 16_384;

export interface RuntimeChildProcess {
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: "close", listener: (code: number | null) => void): this;
  once(event: "error", listener: (error: Error) => void): this;
}

export type RuntimeCommandSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => RuntimeChildProcess;

export interface ExecuteRuntimeCommandInput {
  callId: string;
  repoRoot?: string;
  registry?: RuntimeCommandRegistry;
  controller?: RuntimeExecutionController;
  spawnCommand?: RuntimeCommandSpawn;
  outputLimitBytes?: number;
  now?: () => number;
}

export interface RuntimeCommandCapturedOutput {
  text: string;
  bytes: number;
  truncated: boolean;
  ref: string | null;
}

export type RuntimeCommandExecutionResult =
  | {
      ok: true;
      status: "completed";
      call: RuntimeCommandCallRow;
      stdout: RuntimeCommandCapturedOutput;
      stderr: RuntimeCommandCapturedOutput;
      exitCode: number;
    }
  | {
      ok: false;
      status:
        | "not_found"
        | "not_approved"
        | "invalid"
        | "failed"
        | "timeout"
        | "cancelled";
      reason: string;
      call?: RuntimeCommandCallRow;
      stdout?: RuntimeCommandCapturedOutput;
      stderr?: RuntimeCommandCapturedOutput;
      exitCode?: number | null;
    };

class BoundedOutputCapture {
  private chunks: Buffer[] = [];
  private capturedBytes = 0;
  private observedBytes = 0;
  truncated = false;

  constructor(private readonly limitBytes: number) {}

  append(chunk: unknown): void {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(String(chunk), "utf8");
    this.observedBytes += buffer.byteLength;
    const remaining = this.limitBytes - this.capturedBytes;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    if (buffer.byteLength > remaining) {
      this.chunks.push(buffer.subarray(0, remaining));
      this.capturedBytes += remaining;
      this.truncated = true;
      return;
    }
    this.chunks.push(buffer);
    this.capturedBytes += buffer.byteLength;
  }

  toOutput(ref: string | null): RuntimeCommandCapturedOutput {
    return {
      text: Buffer.concat(this.chunks).toString("utf8"),
      bytes: this.observedBytes,
      truncated: this.truncated,
      ref,
    };
  }
}

function parseArgv(argvJson: string): string[] {
  const parsed = JSON.parse(argvJson) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new Error("Runtime command argv_json must contain a string array");
  }
  return parsed;
}

function emitRuntimeExecutionTelemetry(
  db: DatabaseType.Database,
  input: {
    eventType:
      | "runtime_command_started"
      | "runtime_command_completed"
      | "runtime_command_failed"
      | "runtime_command_output_truncated";
    timestamp: number;
    success: boolean;
    callId: string;
    commandId: string;
    notes?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.timestamp,
    event_type: input.eventType,
    success: input.success,
    execution_id: input.callId,
    tool_name: input.commandId,
    notes: [
      `call_id=${input.callId}`,
      `command_id=${input.commandId}`,
      input.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

function isReadOnlyRuntimeCommand(spec: RuntimeCommandSpec): boolean {
  return (
    spec.enabled &&
    spec.requiredSafetyTag === "ALLOW" &&
    spec.reversibilityClass === "PURE_READ"
  );
}

function resolveWorkingDirectory(
  call: RuntimeCommandCallRow,
  spec: RuntimeCommandSpec,
  repoRoot: string,
): string | undefined {
  if (spec.workingDirectoryPolicy.type === "none") return undefined;
  if (
    call.working_directory !== "repo_root" &&
    call.working_directory !== repoRoot
  ) {
    throw new Error("Runtime command working directory violates policy");
  }
  return repoRoot;
}

function buildEnvironment(spec: RuntimeCommandSpec): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of spec.environmentPolicy.allowedEnv) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function outputRef(
  callId: string,
  stream: "stdout" | "stderr",
  output: BoundedOutputCapture,
): string | null {
  const rendered = output.toOutput(null);
  if (!rendered.text && !rendered.truncated) return null;
  return `runtime-inline://${callId}/${stream}`;
}

export class RuntimeCommandExecutor {
  constructor(private readonly db: DatabaseType.Database) {}

  async runApproved(
    input: ExecuteRuntimeCommandInput,
  ): Promise<RuntimeCommandExecutionResult> {
    const registry = input.registry ?? runtimeCommandRegistry;
    const controller = input.controller ?? runtimeExecutionController;
    const spawnCommand = input.spawnCommand ?? (spawn as RuntimeCommandSpawn);
    const outputLimitBytes =
      input.outputLimitBytes ?? RUNTIME_COMMAND_OUTPUT_LIMIT_BYTES;
    const call = getRuntimeCommandCall(this.db, input.callId);
    if (!call) {
      return { ok: false, status: "not_found", reason: "not_found" };
    }
    if (call.status !== "approved") {
      return {
        ok: false,
        status: "not_approved",
        reason: "Runtime command call must be approved before execution.",
        call,
      };
    }

    let argv: string[];
    let spec: RuntimeCommandSpec;
    try {
      argv = parseArgv(call.argv_json);
      const validated = registry.validateInput(
        { id: call.command_id, args: argv },
        { db: this.db, now: input.now },
      );
      if (!validated.ok) {
        return {
          ok: false,
          status: "invalid",
          reason: validated.reason,
          call,
        };
      }
      spec = validated.spec;
      if (!isReadOnlyRuntimeCommand(spec)) {
        return {
          ok: false,
          status: "invalid",
          reason: "Runtime command spec is not enabled read-only metadata.",
          call,
        };
      }
      if (call.command !== spec.command) {
        return {
          ok: false,
          status: "invalid",
          reason: "Runtime command call does not match registry command.",
          call,
        };
      }
    } catch (error) {
      return {
        ok: false,
        status: "invalid",
        reason: error instanceof Error ? error.message : "invalid",
        call,
      };
    }

    const startedAt = input.now?.() ?? Date.now();
    const running = updateRuntimeCommandCallStatus(this.db, call.id, {
      status: "running",
      at: startedAt,
    });
    if (!running) {
      return { ok: false, status: "not_found", reason: "not_found" };
    }
    emitRuntimeExecutionTelemetry(this.db, {
      eventType: "runtime_command_started",
      timestamp: startedAt,
      success: true,
      callId: call.id,
      commandId: call.command_id,
      notes: `shell=false`,
    });

    const context = controller.createContext({
      commandCallId: call.id,
      timeoutMs: spec.timeoutMs,
      db: this.db,
      now: input.now,
    });
    const stdout = new BoundedOutputCapture(outputLimitBytes);
    const stderr = new BoundedOutputCapture(outputLimitBytes);

    return new Promise<RuntimeCommandExecutionResult>((resolve) => {
      let settled = false;
      let child: RuntimeChildProcess | undefined;

      const settle = (result: RuntimeCommandExecutionResult): void => {
        if (settled) return;
        settled = true;
        controller.release(call.id);
        resolve(result);
      };

      const finishCancelled = (): void => {
        const latest = getRuntimeCommandCall(this.db, call.id);
        const status =
          context.cancellation_source === "timeout" ||
          latest?.status === "timeout"
            ? "timeout"
            : "cancelled";
        settle({
          ok: false,
          status,
          reason:
            status === "timeout"
              ? "Runtime command timed out."
              : "Runtime command cancelled.",
          call: latest,
          stdout: stdout.toOutput(outputRef(call.id, "stdout", stdout)),
          stderr: stderr.toOutput(outputRef(call.id, "stderr", stderr)),
          exitCode: null,
        });
      };

      context.signal.addEventListener(
        "abort",
        () => {
          child?.kill("SIGTERM");
          finishCancelled();
        },
        { once: true },
      );

      try {
        const cwd = resolveWorkingDirectory(
          call,
          spec,
          input.repoRoot ?? process.cwd(),
        );
        child = spawnCommand(spec.command, argv, {
          cwd,
          env: buildEnvironment(spec) as NodeJS.ProcessEnv,
          shell: false,
          windowsHide: true,
        });
      } catch (error) {
        const failedAt = input.now?.() ?? Date.now();
        const failed = updateRuntimeCommandCallStatus(this.db, call.id, {
          status: "failed",
          at: failedAt,
          errorClass: "RuntimeCommandSpawnFailed",
          errorMessage:
            error instanceof Error ? error.message : "Runtime spawn failed.",
        });
        emitRuntimeExecutionTelemetry(this.db, {
          eventType: "runtime_command_failed",
          timestamp: failedAt,
          success: false,
          callId: call.id,
          commandId: call.command_id,
          notes: "error_class=RuntimeCommandSpawnFailed",
        });
        settle({
          ok: false,
          status: "failed",
          reason:
            error instanceof Error ? error.message : "Runtime spawn failed.",
          call: failed,
          stdout: stdout.toOutput(null),
          stderr: stderr.toOutput(null),
          exitCode: null,
        });
        return;
      }

      child.stdout?.on("data", (chunk) => stdout.append(chunk));
      child.stderr?.on("data", (chunk) => stderr.append(chunk));
      child.once("error", (error) => {
        if (context.signal.aborted) {
          finishCancelled();
          return;
        }
        const failedAt = input.now?.() ?? Date.now();
        const failed = updateRuntimeCommandCallStatus(this.db, call.id, {
          status: "failed",
          at: failedAt,
          errorClass: "RuntimeCommandProcessError",
          errorMessage: error.message,
        });
        emitRuntimeExecutionTelemetry(this.db, {
          eventType: "runtime_command_failed",
          timestamp: failedAt,
          success: false,
          callId: call.id,
          commandId: call.command_id,
          notes: "error_class=RuntimeCommandProcessError",
        });
        settle({
          ok: false,
          status: "failed",
          reason: error.message,
          call: failed,
          stdout: stdout.toOutput(outputRef(call.id, "stdout", stdout)),
          stderr: stderr.toOutput(outputRef(call.id, "stderr", stderr)),
          exitCode: null,
        });
      });
      child.once("close", (code) => {
        if (context.signal.aborted) {
          finishCancelled();
          return;
        }
        const stdoutRef = outputRef(call.id, "stdout", stdout);
        const stderrRef = outputRef(call.id, "stderr", stderr);
        attachRuntimeCommandOutputRefs(this.db, call.id, {
          stdoutRef,
          stderrRef,
        });
        if (stdout.truncated || stderr.truncated) {
          emitRuntimeExecutionTelemetry(this.db, {
            eventType: "runtime_command_output_truncated",
            timestamp: input.now?.() ?? Date.now(),
            success: true,
            callId: call.id,
            commandId: call.command_id,
            notes: `stdout_truncated=${stdout.truncated} stderr_truncated=${stderr.truncated}`,
          });
        }
        const exitCode = code ?? 1;
        const completedAt = input.now?.() ?? Date.now();
        if (exitCode === 0) {
          const completed = updateRuntimeCommandCallStatus(this.db, call.id, {
            status: "completed",
            at: completedAt,
            exitCode,
          });
          emitRuntimeExecutionTelemetry(this.db, {
            eventType: "runtime_command_completed",
            timestamp: completedAt,
            success: true,
            callId: call.id,
            commandId: call.command_id,
            notes: `exit_code=${exitCode}`,
          });
          settle({
            ok: true,
            status: "completed",
            call: completed ?? running,
            stdout: stdout.toOutput(stdoutRef),
            stderr: stderr.toOutput(stderrRef),
            exitCode,
          });
          return;
        }

        const failed = updateRuntimeCommandCallStatus(this.db, call.id, {
          status: "failed",
          at: completedAt,
          exitCode,
          errorClass: "RuntimeCommandNonZeroExit",
          errorMessage: `Runtime command exited with code ${exitCode}.`,
        });
        emitRuntimeExecutionTelemetry(this.db, {
          eventType: "runtime_command_failed",
          timestamp: completedAt,
          success: false,
          callId: call.id,
          commandId: call.command_id,
          notes: `exit_code=${exitCode}`,
        });
        settle({
          ok: false,
          status: "failed",
          reason: `Runtime command exited with code ${exitCode}.`,
          call: failed,
          stdout: stdout.toOutput(stdoutRef),
          stderr: stderr.toOutput(stderrRef),
          exitCode,
        });
      });
    });
  }
}

export function executeRuntimeCommand(
  db: DatabaseType.Database,
  input: ExecuteRuntimeCommandInput,
): Promise<RuntimeCommandExecutionResult> {
  return new RuntimeCommandExecutor(db).runApproved(input);
}
