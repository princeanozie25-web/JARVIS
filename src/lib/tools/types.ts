import type { z } from "zod";
import type { ToolCallStatus } from "../db/tool-calls";
import type { RouterDecision, SafetyTag } from "../router";

export type ReversibilityClass =
  | "NO_SIDE_EFFECT"
  | "PURE_READ"
  | "REVERSIBLE_WRITE"
  | "IRREVERSIBLE";

export interface ToolContext {
  executionId: string;
  sessionId: string;
  signal: AbortSignal;
  timeoutMs: number;
  decision: RouterDecision;
}

export interface ToolResult {
  ok: boolean;
  status?: ToolCallStatus;
  message: string;
  data?: unknown;
}

export interface Tool<Input = unknown> {
  id: string;
  name: string;
  description: string;
  requiredSafetyTag: SafetyTag;
  inputSchema: z.ZodType<Input>;
  scopeOf(input: Input): string;
  reversibilityClass: ReversibilityClass;
  timeoutMs: number;
  // Runner-only: callers must go through ToolRuntime.runTool so validation,
  // approval checks, audit rows, telemetry, timeout, and cancellation run.
  execute(input: Input, context: ToolContext): Promise<ToolResult>;
}

export interface RunToolOptions {
  toolId: string;
  input: unknown;
  sessionId: string;
  decision: RouterDecision;
  executionId?: string;
  messageId?: string;
  signal?: AbortSignal;
}

export interface ToolRuntime {
  runTool(options: RunToolOptions): Promise<ToolResult>;
}
