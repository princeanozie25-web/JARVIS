import type DatabaseType from "better-sqlite3";
import { updateRuntimeCommandCallStatus } from "../db/runtime-command-calls";
import { insertTelemetryEvent } from "../db/telemetry";

export type RuntimeCancellationSource =
  | "timeout"
  | "user"
  | "global_shutdown"
  | null;

export interface RuntimeExecutionContext {
  command_call_id: string;
  timeoutMs: number;
  signal: AbortSignal;
  created_at: number;
  cancellation_source: RuntimeCancellationSource;
}

export interface CreateRuntimeExecutionContextInput {
  commandCallId: string;
  timeoutMs: number;
  db?: DatabaseType.Database;
  now?: () => number;
  parentSignal?: AbortSignal;
}

export interface RuntimeCancellationInput {
  commandCallId: string;
  db?: DatabaseType.Database;
  now?: () => number;
}

export interface RuntimeGlobalCancellationInput {
  db?: DatabaseType.Database;
  now?: () => number;
}

interface ManagedRuntimeExecutionContext extends RuntimeExecutionContext {
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
  db?: DatabaseType.Database;
  now?: () => number;
}

function emitRuntimeAbortTelemetry(
  db: DatabaseType.Database | undefined,
  input: {
    eventType:
      | "runtime_command_cancelled"
      | "runtime_command_timeout"
      | "runtime_command_abort_signal_created";
    success: boolean;
    commandCallId: string;
    timestamp: number;
    source?: RuntimeCancellationSource;
  },
): void {
  if (!db) return;
  insertTelemetryEvent(db, {
    timestamp: input.timestamp,
    event_type: input.eventType,
    success: input.success,
    execution_id: input.commandCallId,
    notes: [
      `call_id=${input.commandCallId}`,
      input.source ? `cancellation_source=${input.source}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export class RuntimeExecutionController {
  private contexts = new Map<string, ManagedRuntimeExecutionContext>();

  createContext(
    input: CreateRuntimeExecutionContextInput,
  ): RuntimeExecutionContext {
    if (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0) {
      throw new Error("Runtime command timeoutMs must be positive");
    }
    const existing = this.contexts.get(input.commandCallId);
    if (existing) return existing;

    const controller = new AbortController();
    const createdAt = input.now?.() ?? Date.now();
    const context: ManagedRuntimeExecutionContext = {
      command_call_id: input.commandCallId,
      timeoutMs: input.timeoutMs,
      signal: controller.signal,
      created_at: createdAt,
      cancellation_source: null,
      controller,
      timeout: setTimeout(() => {
        this.abortContext(input.commandCallId, "timeout", {
          db: input.db,
          now: input.now,
        });
      }, input.timeoutMs),
      db: input.db,
      now: input.now,
    };

    input.parentSignal?.addEventListener(
      "abort",
      () => {
        this.abortContext(input.commandCallId, "user", {
          db: input.db,
          now: input.now,
        });
      },
      { once: true },
    );

    this.contexts.set(input.commandCallId, context);
    emitRuntimeAbortTelemetry(input.db, {
      eventType: "runtime_command_abort_signal_created",
      success: true,
      commandCallId: input.commandCallId,
      timestamp: createdAt,
    });
    return context;
  }

  getContext(commandCallId: string): RuntimeExecutionContext | undefined {
    return this.contexts.get(commandCallId);
  }

  cancel(
    commandCallId: string,
    input: { db?: DatabaseType.Database; now?: () => number } = {},
  ): RuntimeExecutionContext | undefined {
    return this.abortContext(commandCallId, "user", input);
  }

  cancelAll(
    input: { db?: DatabaseType.Database; now?: () => number } = {},
  ): RuntimeExecutionContext[] {
    return Array.from(this.contexts.keys())
      .map((commandCallId) =>
        this.abortContext(commandCallId, "global_shutdown", input),
      )
      .filter((context): context is RuntimeExecutionContext => !!context);
  }

  size(): number {
    return this.contexts.size;
  }

  clear(): void {
    for (const context of this.contexts.values()) {
      clearTimeout(context.timeout);
    }
    this.contexts.clear();
  }

  private abortContext(
    commandCallId: string,
    source: Exclude<RuntimeCancellationSource, null>,
    input: { db?: DatabaseType.Database; now?: () => number } = {},
  ): RuntimeExecutionContext | undefined {
    const context = this.contexts.get(commandCallId);
    if (!context) return undefined;
    if (context.signal.aborted) return context;

    const db = input.db ?? context.db;
    const now = input.now ?? context.now;
    const timestamp = now?.() ?? Date.now();
    context.cancellation_source = source;
    clearTimeout(context.timeout);
    context.controller.abort(source);
    if (db) {
      updateRuntimeCommandCallStatus(db, commandCallId, {
        status: source === "timeout" ? "timeout" : "cancelled",
        at: timestamp,
        errorClass:
          source === "timeout"
            ? "RuntimeCommandTimeout"
            : "RuntimeCommandCancelled",
        errorMessage:
          source === "timeout"
            ? "Runtime command timed out before execution completed."
            : "Runtime command cancellation requested.",
      });
    }
    emitRuntimeAbortTelemetry(db, {
      eventType:
        source === "timeout"
          ? "runtime_command_timeout"
          : "runtime_command_cancelled",
      success: true,
      commandCallId,
      timestamp,
      source,
    });
    return context;
  }
}

export const runtimeExecutionController = new RuntimeExecutionController();

export function cancelRuntimeCommandCall(
  input: RuntimeCancellationInput & {
    controller?: RuntimeExecutionController;
  },
): RuntimeExecutionContext | undefined {
  return (input.controller ?? runtimeExecutionController).cancel(
    input.commandCallId,
    input,
  );
}

export function cancelAllRuntimeCommands(
  input: RuntimeGlobalCancellationInput & {
    controller?: RuntimeExecutionController;
  } = {},
): RuntimeExecutionContext[] {
  return (input.controller ?? runtimeExecutionController).cancelAll(input);
}
