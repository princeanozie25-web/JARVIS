import type DatabaseType from "better-sqlite3";
import {
  createPendingApproval,
  decideApprovalByExecution,
  expirePendingApprovals,
  getApprovalByExecution,
  getToolCall,
  updateToolCall,
  type ApiApprovalDecision,
  type ToolCallRow,
} from "../db/node";
import type { RouterDecision, SafetyTag } from "../router";
import type { TelemetryEvent } from "../telemetry";
import type { ToolResult, ToolRuntime } from "../tools/types";

export const PENDING_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const SESSION_APPROVAL_TTL_MS = 30 * 60 * 1000;

export interface ToolPendingPayload {
  executionId: string;
  toolId: string;
  toolName: string;
  scopeHash: string;
  requiredSafetyTag: SafetyTag;
  safetyTag: SafetyTag;
  summary: string;
  approvalExpiresAt: number;
}

export interface ResumeApprovalResult {
  httpStatus: number;
  body: {
    ok: boolean;
    executionId: string;
    decision: ApiApprovalDecision;
    result?: ToolResult;
    message?: string;
    reason?: string;
  };
}

export function safeToolInputSummary(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    if (typeof record.path === "string") {
      return truncateSummary(`path: ${record.path}`);
    }
    const keys = Object.keys(record);
    if (keys.length === 0) return "empty input";
    return truncateSummary(`fields: ${keys.slice(0, 8).join(", ")}`);
  }
  if (typeof input === "string") return truncateSummary(input);
  if (input === null || input === undefined) return "empty input";
  return truncateSummary(typeof input);
}

export function parseToolInput(argsJson: string): unknown {
  if (!argsJson.trim()) return {};
  return JSON.parse(argsJson) as unknown;
}

export function ensurePendingToolApproval(input: {
  db: DatabaseType.Database;
  executionId: string;
  sessionId: string;
  toolId: string;
  toolName: string;
  scopeHash: string;
  requiredSafetyTag: SafetyTag;
  safetyTag: SafetyTag;
  toolInput: unknown;
  now?: number;
  ttlMs?: number;
}): ToolPendingPayload {
  const now = input.now ?? Date.now();
  const existing = getApprovalByExecution(input.db, input.executionId);
  const pending =
    existing?.state === "pending" && existing.expires_at !== null
      ? { id: existing.id, expiresAt: existing.expires_at }
      : createPendingApproval(input.db, {
          execution_id: input.executionId,
          session_id: input.sessionId,
          tool_id: input.toolId,
          scope_hash: input.scopeHash,
          created_at: now,
          ttl_ms: input.ttlMs ?? PENDING_APPROVAL_TTL_MS,
        });

  return {
    executionId: input.executionId,
    toolId: input.toolId,
    toolName: input.toolName,
    scopeHash: input.scopeHash,
    requiredSafetyTag: input.requiredSafetyTag,
    safetyTag: input.safetyTag,
    summary: safeToolInputSummary(input.toolInput),
    approvalExpiresAt: pending.expiresAt,
  };
}

export async function resumeApproval(input: {
  db: DatabaseType.Database;
  runtime: ToolRuntime;
  executionId: string;
  decision: ApiApprovalDecision;
  now?: number;
  sessionTtlMs?: number;
  signal?: AbortSignal;
  recordEvent?: (
    event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
  ) => void;
}): Promise<ResumeApprovalResult> {
  const now = input.now ?? Date.now();
  expirePendingApprovals(input.db, now);

  const row = getToolCall(input.db, input.executionId);
  if (!row) {
    return {
      httpStatus: 404,
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        reason: "tool_call_missing",
        message: "Tool call was not found.",
      },
    };
  }

  const approval = decideApprovalByExecution(input.db, {
    executionId: input.executionId,
    decision: input.decision,
    decidedAt: now,
    sessionTtlMs: input.sessionTtlMs ?? SESSION_APPROVAL_TTL_MS,
  });

  if (input.decision === "DENIED") {
    const result = syntheticDeniedResult(input.executionId);
    updateToolCall(input.db, input.executionId, {
      status: "DENIED",
      output_json: JSON.stringify(result.data ?? null),
      error_message: result.message,
      completed_at: now,
    });
    input.recordEvent?.({
      ...telemetryFromRow(row),
      timestamp: now,
      event_type: "tool_denied",
      success: false,
      error_class: "UserDeniedApproval",
      notes: "approval_decision=DENIED",
    });
    return {
      httpStatus: 200,
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        result,
      },
    };
  }

  if (approval.status !== "granted") {
    updateToolCall(input.db, input.executionId, {
      status: "DENIED",
      error_message: `Tool approval ${approval.status}.`,
      completed_at: now,
    });
    return {
      httpStatus: approval.status === "expired" ? 410 : 409,
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        reason: `approval_${approval.status}`,
        message: `Tool approval ${approval.status}.`,
      },
    };
  }

  input.recordEvent?.({
    ...telemetryFromRow(row),
    timestamp: now,
    event_type: "tool_approved",
    success: true,
    notes: `approval_decision=${input.decision}`,
  });

  const result = await input.runtime.runTool({
    toolId: row.tool_id,
    input: JSON.parse(row.input_json) as unknown,
    sessionId: row.session_id,
    executionId: row.execution_id,
    decision: decisionFromToolCall(row),
    signal: input.signal,
  });

  return {
    httpStatus: 200,
    body: {
      ok: result.ok,
      executionId: input.executionId,
      decision: input.decision,
      result,
    },
  };
}

function syntheticDeniedResult(executionId: string): ToolResult {
  return {
    ok: false,
    status: "DENIED",
    message: "Tool execution denied by user.",
    data: { reason: "approval_denied", executionId },
  };
}

function decisionFromToolCall(row: ToolCallRow): RouterDecision {
  const safetyTag = row.safety_tag as SafetyTag;
  return {
    intent: {
      intent: "DETERMINISTIC_COMMAND",
      reason: "resumed approved tool execution",
    },
    safety: {
      safetyTag,
      reason: "resumed from approval",
    },
    capability: {
      tier: "T3",
      requiredCapabilities: ["tools"],
      reason: "resumed from approval",
    },
    selection: {
      providerId: "openai",
      model: {
        id: "approval-resume",
        provider: "openai",
        modelName: "approval-resume",
        tier: "T3",
        capabilities: ["tools"],
        enabled: true,
      },
      reason: "resumed from approval",
    },
  };
}

function telemetryFromRow(
  row: ToolCallRow,
): Pick<
  TelemetryEvent,
  | "execution_id"
  | "session_id"
  | "tool_name"
  | "safety_tag"
  | "tier"
  | "model_id"
> {
  return {
    execution_id: row.execution_id,
    session_id: row.session_id,
    tool_name: row.tool_id,
    safety_tag: row.safety_tag,
    tier: "T3",
    model_id: "approval-resume",
  };
}

function truncateSummary(value: string): string {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}
