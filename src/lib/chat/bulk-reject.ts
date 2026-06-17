// Human bulk-reject — clear a queue flood in one operator action (24D-3).
//
// EoP-10: even with rate/quota/depth/mute at the boundary, a flood that ALREADY
// landed (e.g. queued before a client was muted) must be clearable in one action,
// or the human drowns in per-proposal denials (alert fatigue). This is that path.
//
// It is NOT a new mutator and NOT a new executor: it REUSES the existing deny
// primitives — denyApproval (the by-id, token-less admin deny in db/approvals)
// and updateToolCall(status: DENIED) (the same finalization resumeApproval's deny
// branch performs). It NEVER calls runtime.runTool: a denial executes nothing, so
// the sole-executor count (exactly 2, in tool-approvals.ts / tool-continuation.ts)
// is unchanged. Each rejected proposal walks the SAME terminal DENIED state as a
// normal human denial.
//
// SCOPE NOTE: the approvals table carries no client_id (the frozen canonical
// effect is client-agnostic by FC-1 design), so "reject all from client X" is not
// expressible at the DB layer this slice. The available groupings are: ALL
// pending, one session's pending, or an explicit id selection — which cover the
// flood-clearing need. (Per-client linkage is the E-017 / 24D-4 concern.)

import type DatabaseType from "better-sqlite3";

import { denyApproval, updateToolCall } from "../db/node";

export interface BulkRejectOptions {
  /** Decision timestamp stamped on every rejected row. */
  now: number;
  /** Restrict to one session's pending proposals. Omit => ALL pending. */
  sessionId?: string;
  /** Restrict to an explicit set of approval ids (operator selection). When set,
   * only pending rows whose id is in this list are rejected. */
  approvalIds?: string[];
  /** Optional METADATA-ONLY audit hook — receives ids + time, never a proposal
   * body/target (there is none to pass; this clears, it does not inspect). */
  onReject?: (entry: {
    approvalId: string;
    executionId: string | null;
    atMs: number;
  }) => void;
}

export interface BulkRejectResult {
  rejected: number;
  approvalIds: string[];
  executionIds: string[];
}

interface PendingApprovalRef {
  id: string;
  execution_id: string | null;
}

/** Select the PENDING approval rows in scope (all / by session / by id set). */
function selectPendingApprovals(
  db: DatabaseType.Database,
  sessionId?: string,
  approvalIds?: string[],
): PendingApprovalRef[] {
  // An empty explicit id list selects nothing (operator selected nothing).
  if (approvalIds && approvalIds.length === 0) return [];

  let sql = "SELECT id, execution_id FROM approvals WHERE state = 'pending'";
  const params: unknown[] = [];
  if (sessionId !== undefined) {
    sql += " AND session_id = ?";
    params.push(sessionId);
  }
  if (approvalIds && approvalIds.length > 0) {
    sql += ` AND id IN (${approvalIds.map(() => "?").join(", ")})`;
    params.push(...approvalIds);
  }
  return db.prepare(sql).all(...params) as PendingApprovalRef[];
}

/**
 * Bulk-reject pending proposals via the EXISTING deny path. For each pending row:
 *   1. denyApproval(db, { id, denied_at })       — the existing by-id admin deny
 *   2. updateToolCall(execution_id, DENIED)      — the same terminal finalization
 *                                                  resumeApproval's deny branch does
 * No runtime.runTool, no new mutation primitive, no new executor. Returns the
 * counts + ids affected so the operator gets one summary instead of N alerts.
 */
export function bulkRejectPendingApprovals(
  db: DatabaseType.Database,
  options: BulkRejectOptions,
): BulkRejectResult {
  const rows = selectPendingApprovals(
    db,
    options.sessionId,
    options.approvalIds,
  );

  const approvalIds: string[] = [];
  const executionIds: string[] = [];
  for (const row of rows) {
    denyApproval(db, { id: row.id, denied_at: options.now });
    if (row.execution_id) {
      updateToolCall(db, row.execution_id, {
        status: "DENIED",
        error_message: "Bulk-rejected by operator (queue flood mitigation).",
        completed_at: options.now,
      });
      executionIds.push(row.execution_id);
    }
    approvalIds.push(row.id);
    options.onReject?.({
      approvalId: row.id,
      executionId: row.execution_id,
      atMs: options.now,
    });
  }

  return { rejected: approvalIds.length, approvalIds, executionIds };
}
