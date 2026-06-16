import type DatabaseType from "better-sqlite3";
import {
  createPendingApproval,
  decideApprovalByExecution,
  expirePendingApprovals,
  getRegisteredProject,
  getProjectTask,
  getToolCall,
  updateToolCall,
  type ApiApprovalDecision,
  type ApprovalVerificationStatus,
  type ToolCallRow,
} from "../db/node";
import type { RouterDecision, SafetyTag } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { persistToolOutput } from "../tools/persist-output";
import type { ToolCallStatus } from "../db/tool-calls";
import type { ToolRuntime } from "../tools/types";
import { revalidateGatewayProposal } from "./approval-revalidation";

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
  approvalToken: string;
}

export interface ResumeApprovalResult {
  httpStatus: number;
  body: {
    ok: boolean;
    executionId: string;
    decision: ApiApprovalDecision;
    status?: ToolCallStatus;
    message?: string;
    reason?: string;
  };
}

export function safeToolInputSummary(
  input: unknown,
  db?: DatabaseType.Database,
): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    const projectSummary = projectRegisterSummary(record);
    if (projectSummary) return projectSummary;
    const projectPromoteTaskSummary = projectPromoteTaskSummaryFromInput(
      record,
      db,
    );
    if (projectPromoteTaskSummary) return projectPromoteTaskSummary;
    const projectStatusSummary = projectStatusSummaryFromInput(record, db);
    if (projectStatusSummary) return projectStatusSummary;
    const projectSourceSummary = projectSourceSummaryFromInput(record);
    if (projectSourceSummary) return projectSourceSummary;
    const projectIndexSummary = projectIndexSummaryFromInput(record);
    if (projectIndexSummary) return projectIndexSummary;
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

function projectStatusSummaryFromInput(
  record: Record<string, unknown>,
  db?: DatabaseType.Database,
): string | null {
  if (
    typeof record.projectId !== "string" ||
    typeof record.status !== "string"
  ) {
    return null;
  }

  const project = db
    ? getRegisteredProject(db, { id: record.projectId })
    : undefined;
  if (project) {
    return truncateSummary(
      [
        `project_id: ${project.id}`,
        `slug: ${project.slug}`,
        `display_name: ${project.display_name}`,
        `current_status: ${project.status}`,
        `requested_status: ${record.status}`,
      ].join("; "),
    );
  }

  return truncateSummary(
    [
      `project_id: ${record.projectId}`,
      `requested_status: ${record.status}`,
    ].join("; "),
  );
}

function projectPromoteTaskSummaryFromInput(
  record: Record<string, unknown>,
  db?: DatabaseType.Database,
): string | null {
  if (
    typeof record.projectId !== "string" ||
    typeof record.taskId !== "string"
  ) {
    return null;
  }

  const task = db ? getProjectTask(db, record.taskId) : undefined;
  if (task && task.project_id === record.projectId) {
    return truncateSummary(
      [
        `project_id: ${record.projectId}`,
        `task_id: ${record.taskId}`,
        `task_title: ${task.title}`,
        `current_status: ${task.status}`,
        `confidence: ${task.confidence}`,
      ].join("; "),
    );
  }

  return truncateSummary(
    [`project_id: ${record.projectId}`, `task_id: ${record.taskId}`].join("; "),
  );
}

function projectIndexSummaryFromInput(
  record: Record<string, unknown>,
): string | null {
  if (typeof record.projectId !== "string") return null;
  const triggeredBy =
    typeof record.triggeredBy === "string" ? record.triggeredBy : "manual";
  return truncateSummary(
    [
      `project_id: ${record.projectId}`,
      `triggered_by: ${triggeredBy}`,
      "mode: deterministic_markers",
      "file_sources_only: true",
    ].join("; "),
  );
}

function projectSourceSummaryFromInput(
  record: Record<string, unknown>,
): string | null {
  if (
    typeof record.projectId !== "string" ||
    typeof record.kind !== "string" ||
    typeof record.ref !== "string"
  ) {
    return null;
  }

  return truncateSummary(
    [
      `project_id: ${record.projectId}`,
      `kind: ${record.kind}`,
      `ref: ${record.ref}`,
      "indexes_now: false",
    ].join("; "),
  );
}

function projectRegisterSummary(
  record: Record<string, unknown>,
): string | null {
  if (
    typeof record.slug !== "string" ||
    typeof record.displayName !== "string" ||
    typeof record.rootKind !== "string" ||
    typeof record.rootRef !== "string"
  ) {
    return null;
  }

  const status = typeof record.status === "string" ? record.status : "active";
  return truncateSummary(
    [
      `slug: ${record.slug}`,
      `display_name: ${record.displayName}`,
      `root_kind: ${record.rootKind}`,
      `root_ref: ${record.rootRef}`,
      `status: ${status}`,
    ].join("; "),
  );
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
  const pending = createPendingApproval(input.db, {
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
    summary: safeToolInputSummary(input.toolInput, input.db),
    approvalExpiresAt: pending.expiresAt,
    approvalToken: pending.token,
  };
}

export async function resumeApproval(input: {
  db: DatabaseType.Database;
  runtime: ToolRuntime;
  executionId: string;
  decision: ApiApprovalDecision;
  approvalToken?: string;
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
    token: input.approvalToken,
    decidedAt: now,
    sessionTtlMs: input.sessionTtlMs ?? SESSION_APPROVAL_TTL_MS,
    allowSession: row.required_safety_tag !== "CONFIRM_ALWAYS",
  });

  if (input.decision === "DENIED") {
    const deniedMessage = "Tool execution denied by user.";
    const persisted = persistToolOutput(
      input.executionId,
      syntheticDeniedData(input.executionId),
    );
    updateToolCall(input.db, input.executionId, {
      status: "DENIED",
      output_json: persisted.outputJson,
      error_message: deniedMessage,
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
        status: "DENIED",
        message: deniedMessage,
      },
    };
  }

  if (approval.status !== "granted") {
    if (shouldFinalizeToolCallForApprovalFailure(approval.status)) {
      updateToolCall(input.db, input.executionId, {
        status: "DENIED",
        error_message: `Tool approval ${approval.status}.`,
        completed_at: now,
      });
    }
    input.recordEvent?.({
      ...telemetryFromRow(row),
      timestamp: now,
      event_type: "tool_denied",
      success: false,
      error_class: errorClassForApprovalStatus(approval.status),
      notes: `approval_status=${approval.status} approval_decision=${input.decision}`,
    });
    return {
      httpStatus: httpStatusForApprovalStatus(approval.status),
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        reason: `approval_${approval.status}`,
        message: `Tool approval ${approval.status}.`,
      },
    };
  }

  // FC-2 (24C-2b): re-validate a gateway-originated proposal at the decision
  // point, BEFORE execution. ONLY applies when the approval carries a
  // canonical_effect_hash — legacy chat approvals (no hash) return "legacy" and
  // fall through UNCHANGED. On drift/expiry/missing-hash this mirrors the
  // existing DENIED finalization above and returns WITHOUT calling runTool.
  const revalidation = revalidateGatewayProposal(
    {
      canonical_effect_hash: approval.row?.canonical_effect_hash ?? null,
      canonical_effect_json: approval.row?.canonical_effect_json ?? null,
      expires_at: approval.row?.expires_at ?? null,
    },
    now,
  );
  if (revalidation.kind === "deny") {
    updateToolCall(input.db, input.executionId, {
      status: "DENIED",
      error_message: `Tool approval revalidation failed: ${revalidation.reason}.`,
      completed_at: now,
    });
    input.recordEvent?.({
      ...telemetryFromRow(row),
      timestamp: now,
      event_type: "tool_denied",
      success: false,
      error_class: "ApprovalRevalidationFailed",
      notes: `revalidation=${revalidation.reason} approval_decision=${input.decision}`,
    });
    return {
      httpStatus: 409,
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        reason: `revalidation_${revalidation.reason}`,
        message: "Tool approval is no longer valid; re-create required.",
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
      status: result.status,
      message: result.message,
    },
  };
}

function shouldFinalizeToolCallForApprovalFailure(
  status: ApprovalVerificationStatus,
): boolean {
  return status === "expired" || status === "denied" || status === "cancelled";
}

function httpStatusForApprovalStatus(
  status: ApprovalVerificationStatus,
): number {
  if (status === "expired") return 410;
  if (status === "invalid_token") return 401;
  if (status === "missing") return 404;
  return 409;
}

function errorClassForApprovalStatus(
  status: ApprovalVerificationStatus,
): string {
  if (status === "invalid_token") return "ApprovalInvalidToken";
  if (status === "expired") return "ApprovalExpired";
  if (status === "replayed") return "ApprovalReplayed";
  if (status === "session_not_allowed") return "ApprovalSessionNotAllowed";
  if (status === "denied") return "ApprovalDenied";
  if (status === "cancelled") return "ApprovalCancelled";
  return "ApprovalNotGranted";
}

function syntheticDeniedData(executionId: string): {
  reason: string;
  executionId: string;
} {
  return { reason: "approval_denied", executionId };
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
