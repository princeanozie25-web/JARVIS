import type DatabaseType from "better-sqlite3";
import {
  createToolCall,
  getDb,
  insertTelemetryEvent,
  updateToolCall,
  type ToolCallStatus,
} from "../db/node";
import type { SafetyTag } from "../router";
import type { TelemetryEvent } from "../telemetry/types";
import { ToolRegistry, tools } from "./registry";
import type { RunToolOptions, ToolResult, ToolRuntime } from "./types";

const safetyRank: Record<SafetyTag, number> = {
  ALLOW: 0,
  CONFIRM_ONCE: 1,
  CONFIRM_ALWAYS: 2,
  BLOCK: 3,
};

export interface InProcessToolRuntimeDeps {
  db?: DatabaseType.Database;
  now?: () => number;
  newId?: () => string;
  recordEvent?: (
    event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
  ) => void;
}

function hasSufficientSafety(actual: SafetyTag, required: SafetyTag): boolean {
  if (actual === "BLOCK") return false;
  return safetyRank[actual] >= safetyRank[required];
}

function result(
  status: ToolCallStatus,
  ok: boolean,
  message: string,
  data?: unknown,
): ToolResult {
  return { ok, status, message, data };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class InProcessToolRuntime implements ToolRuntime {
  constructor(
    private readonly registry: ToolRegistry = tools,
    private readonly deps: InProcessToolRuntimeDeps = {},
  ) {}

  async runTool(options: RunToolOptions): Promise<ToolResult> {
    const tool = this.registry.get(options.toolId);
    const executionId = options.executionId ?? this.newId();
    const proposedAt = this.now();
    const parsed = tool.inputSchema.safeParse(options.input);
    const inputJson = safeJson(options.input);
    const actualSafetyTag = options.decision.safety.safetyTag;
    const baseTelemetry = {
      execution_id: executionId,
      session_id: options.sessionId,
      tool_name: tool.id,
      intent: options.decision.intent.intent,
      safety_tag: actualSafetyTag,
      tier: options.decision.capability.tier,
      model_id: options.decision.selection.model.modelName,
    };

    if (!parsed.success) {
      this.createCall({
        executionId,
        sessionId: options.sessionId,
        toolId: tool.id,
        toolName: tool.name,
        status: "DENIED",
        safetyTag: actualSafetyTag,
        requiredSafetyTag: tool.requiredSafetyTag,
        scopeHash: "invalid_input",
        inputJson,
        proposedAt,
        completedAt: proposedAt,
        timeoutMs: tool.timeoutMs,
        errorMessage: "Tool input failed validation.",
      });
      this.emit({
        ...baseTelemetry,
        event_type: "tool_denied",
        success: false,
        error_class: "InvalidToolInput",
        notes: "reason=invalid_tool_input",
      });
      return result("DENIED", false, "Tool input failed validation.", {
        reason: "invalid_tool_input",
        issues: parsed.error.issues,
      });
    }

    const scopeHash = tool.scopeOf(parsed.data);

    if (!hasSufficientSafety(actualSafetyTag, tool.requiredSafetyTag)) {
      this.createCall({
        executionId,
        sessionId: options.sessionId,
        toolId: tool.id,
        toolName: tool.name,
        status: "DENIED",
        safetyTag: actualSafetyTag,
        requiredSafetyTag: tool.requiredSafetyTag,
        scopeHash,
        inputJson,
        proposedAt,
        completedAt: proposedAt,
        timeoutMs: tool.timeoutMs,
        errorMessage: "Tool denied by safety policy.",
      });
      this.emit({
        ...baseTelemetry,
        event_type: "tool_denied",
        success: false,
        error_class: "InsufficientSafety",
        notes: `required=${tool.requiredSafetyTag} actual=${actualSafetyTag}`,
      });
      return result("DENIED", false, "Tool denied by safety policy.", {
        reason: "insufficient_safety",
        requiredSafetyTag: tool.requiredSafetyTag,
        actualSafetyTag,
      });
    }

    this.createCall({
      executionId,
      sessionId: options.sessionId,
      toolId: tool.id,
      toolName: tool.name,
      status: "PENDING",
      safetyTag: actualSafetyTag,
      requiredSafetyTag: tool.requiredSafetyTag,
      scopeHash,
      inputJson,
      proposedAt,
      timeoutMs: tool.timeoutMs,
    });

    if (options.signal?.aborted) {
      return this.finish({
        executionId,
        status: "CANCELLED",
        ok: false,
        message: "Tool execution aborted.",
        data: { reason: "aborted" },
        telemetry: {
          ...baseTelemetry,
          event_type: "tool_cancelled",
          success: false,
          error_class: "AbortError",
        },
      });
    }

    const startedAt = this.now();
    this.updateCall(executionId, {
      status: "EXECUTING",
      started_at: startedAt,
    });
    this.emit({
      ...baseTelemetry,
      event_type: "tool_executed",
      success: true,
    });

    const controller = new AbortController();
    let abortReason: "aborted" | "timeout" = "aborted";

    const abortFromParent = () => {
      abortReason = "aborted";
      controller.abort(options.signal?.reason);
    };

    options.signal?.addEventListener("abort", abortFromParent, {
      once: true,
    });

    const timeout = setTimeout(() => {
      abortReason = "timeout";
      controller.abort(new Error("Tool execution timed out."));
    }, tool.timeoutMs);

    const abortResult = new Promise<ToolResult>((resolve) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          const isTimeout = abortReason === "timeout";
          resolve(
            result(
              isTimeout ? "TIMEOUT" : "CANCELLED",
              false,
              isTimeout
                ? "Tool execution timed out."
                : "Tool execution aborted.",
              { reason: abortReason },
            ),
          );
        },
        { once: true },
      );
    });

    const toolPromise = tool
      .execute(parsed.data, {
        executionId,
        sessionId: options.sessionId,
        signal: controller.signal,
        timeoutMs: tool.timeoutMs,
        decision: options.decision,
      })
      .catch((error: unknown) =>
        result("ERROR", false, "Tool execution failed.", {
          reason: "error",
          error: errorMessage(error),
        }),
      );

    try {
      const outcome = await Promise.race([toolPromise, abortResult]);
      if (outcome.status === "TIMEOUT") {
        return this.finish({
          executionId,
          status: "TIMEOUT",
          ok: false,
          message: outcome.message,
          data: outcome.data,
          telemetry: {
            ...baseTelemetry,
            event_type: "tool_timeout",
            success: false,
            latency_ms: this.now() - startedAt,
            error_class: "TimeoutError",
          },
        });
      }

      if (outcome.status === "CANCELLED") {
        return this.finish({
          executionId,
          status: "CANCELLED",
          ok: false,
          message: outcome.message,
          data: outcome.data,
          telemetry: {
            ...baseTelemetry,
            event_type: "tool_cancelled",
            success: false,
            latency_ms: this.now() - startedAt,
            error_class: "AbortError",
          },
        });
      }

      if (outcome.status === "ERROR") {
        return this.finish({
          executionId,
          status: "ERROR",
          ok: false,
          message: outcome.message,
          data: outcome.data,
          telemetry: {
            ...baseTelemetry,
            event_type: "tool_completed",
            success: false,
            latency_ms: this.now() - startedAt,
            error_class: "ToolExecutionError",
            notes:
              typeof outcome.data === "object" && outcome.data !== null
                ? safeJson(outcome.data)
                : undefined,
          },
        });
      }

      return this.finish({
        executionId,
        status: "COMPLETED",
        ok: outcome.ok,
        message: outcome.message,
        data: outcome.data,
        telemetry: {
          ...baseTelemetry,
          event_type: "tool_completed",
          success: outcome.ok,
          latency_ms: this.now() - startedAt,
        },
      });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromParent);
    }
  }

  private finish(input: {
    executionId: string;
    status: ToolCallStatus;
    ok: boolean;
    message: string;
    data?: unknown;
    telemetry: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number };
  }): ToolResult {
    this.updateCall(input.executionId, {
      status: input.status,
      output_json: safeJson(input.data ?? null),
      error_message: input.ok ? null : input.message,
      completed_at: this.now(),
    });
    this.emit(input.telemetry);
    return result(input.status, input.ok, input.message, input.data);
  }

  private createCall(input: {
    executionId: string;
    sessionId: string;
    toolId: string;
    toolName: string;
    status: ToolCallStatus;
    safetyTag: string;
    requiredSafetyTag: string;
    scopeHash: string;
    inputJson: string;
    proposedAt: number;
    timeoutMs: number;
    completedAt?: number;
    errorMessage?: string;
  }): void {
    const db = this.db();
    if (!db) return;
    createToolCall(db, {
      execution_id: input.executionId,
      session_id: input.sessionId,
      tool_id: input.toolId,
      tool_name: input.toolName,
      status: input.status,
      safety_tag: input.safetyTag,
      required_safety_tag: input.requiredSafetyTag,
      scope_hash: input.scopeHash,
      input_json: input.inputJson,
      proposed_at: input.proposedAt,
      completed_at: input.completedAt,
      error_message: input.errorMessage,
      timeout_ms: input.timeoutMs,
    });
  }

  private updateCall(
    executionId: string,
    input: Parameters<typeof updateToolCall>[2],
  ): void {
    const db = this.db();
    if (!db) return;
    updateToolCall(db, executionId, input);
  }

  private emit(
    event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
  ): void {
    if (this.deps.recordEvent) {
      this.deps.recordEvent(event);
      return;
    }

    const db = this.db();
    if (!db) return;
    insertTelemetryEvent(db, {
      timestamp: event.timestamp ?? this.now(),
      ...event,
    });
  }

  private db(): DatabaseType.Database | undefined {
    if (this.deps.db) return this.deps.db;
    try {
      return getDb();
    } catch (error) {
      console.warn(
        "[tools/runtime] failed to open db",
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.deps.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

export const toolRuntime: ToolRuntime = new InProcessToolRuntime();
