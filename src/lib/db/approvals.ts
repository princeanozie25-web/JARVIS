import type DatabaseType from "better-sqlite3";

export type ApprovalDecision =
  | "APPROVED_ONCE"
  | "APPROVED_SESSION"
  | "DENIED"
  | "EXPIRED";

export interface ApprovalRow {
  id: string;
  execution_id: string | null;
  session_id: string;
  tool_id: string;
  scope_hash: string;
  decision: ApprovalDecision;
  decided_at: number;
  expires_at: number | null;
  consumed_at: number | null;
}

export interface RecordApprovalInput {
  id: string;
  session_id: string;
  tool_id: string;
  scope_hash: string;
  decision: ApprovalDecision;
  decided_at: number;
  execution_id?: string | null;
  expires_at?: number | null;
  consumed_at?: number | null;
}

export function recordApproval(
  db: DatabaseType.Database,
  input: RecordApprovalInput,
): void {
  db.prepare(
    `INSERT INTO approvals (
       id, execution_id, session_id, tool_id, scope_hash, decision,
       decided_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.execution_id ?? null,
    input.session_id,
    input.tool_id,
    input.scope_hash,
    input.decision,
    input.decided_at,
    input.expires_at ?? null,
    input.consumed_at ?? null,
  );
}

export function getActiveApproval(
  db: DatabaseType.Database,
  input: {
    sessionId: string;
    toolId: string;
    scopeHash: string;
    at?: number;
  },
): ApprovalRow | undefined {
  const at = input.at ?? Date.now();
  return db
    .prepare(
      `SELECT *
       FROM approvals
       WHERE session_id = ?
         AND tool_id = ?
         AND scope_hash = ?
         AND decision IN ('APPROVED_ONCE', 'APPROVED_SESSION')
         AND (consumed_at IS NULL OR decision = 'APPROVED_SESSION')
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY decided_at DESC
       LIMIT 1`,
    )
    .get(input.sessionId, input.toolId, input.scopeHash, at) as
    | ApprovalRow
    | undefined;
}

export function consumeApproval(
  db: DatabaseType.Database,
  id: string,
  consumedAt: number = Date.now(),
): void {
  db.prepare(
    `UPDATE approvals
     SET consumed_at = ?
     WHERE id = ? AND decision = 'APPROVED_ONCE'`,
  ).run(consumedAt, id);
}
