import type DatabaseType from "better-sqlite3";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type ApprovalLifecycleState =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "cancelled";

export type ApprovalDecision =
  | "PENDING"
  | "APPROVED_ONCE"
  | "APPROVED_SESSION"
  | "DENIED"
  | "EXPIRED"
  | "CANCELLED";

export interface ApprovalRow {
  id: string;
  execution_id: string | null;
  session_id: string;
  tool_id: string;
  scope_hash: string;
  state: ApprovalLifecycleState;
  token_hash: string | null;
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
  state?: ApprovalLifecycleState;
  token_hash?: string | null;
  expires_at?: number | null;
  consumed_at?: number | null;
}

export interface CreatePendingApprovalInput {
  id?: string;
  execution_id: string;
  session_id: string;
  tool_id: string;
  scope_hash: string;
  created_at: number;
  ttl_ms: number;
  token?: string;
  newId?: () => string;
}

export interface PendingApproval {
  id: string;
  token: string;
  tokenHash: string;
  expiresAt: number;
}

export type ApiApprovalDecision =
  | "APPROVED_ONCE"
  | "APPROVED_SESSION"
  | "DENIED";

export type ApprovalVerificationStatus =
  | "granted"
  | "required"
  | "denied"
  | "expired"
  | "cancelled"
  | "replayed"
  | "invalid_token"
  | "session_not_allowed"
  | "missing";

export interface ApprovalVerificationResult {
  status: ApprovalVerificationStatus;
  row?: ApprovalRow;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashApprovalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(token: string, hash: string | null): boolean {
  if (!hash) return false;
  const left = Buffer.from(hashApprovalToken(token), "hex");
  const right = Buffer.from(hash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function stateFromDecision(decision: ApprovalDecision): ApprovalLifecycleState {
  if (decision === "APPROVED_ONCE" || decision === "APPROVED_SESSION") {
    return "approved";
  }
  if (decision === "DENIED") return "denied";
  if (decision === "EXPIRED") return "expired";
  if (decision === "CANCELLED") return "cancelled";
  return "pending";
}

function normalizeRow(row: ApprovalRow | undefined): ApprovalRow | undefined {
  if (!row) return undefined;
  return {
    ...row,
    state: row.state ?? stateFromDecision(row.decision),
    token_hash: row.token_hash ?? null,
  };
}

export function getApprovalById(
  db: DatabaseType.Database,
  id: string,
): ApprovalRow | undefined {
  return normalizeRow(
    db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as
      | ApprovalRow
      | undefined,
  );
}

export function getApprovalByExecution(
  db: DatabaseType.Database,
  executionId: string,
): ApprovalRow | undefined {
  return normalizeRow(
    db
      .prepare(
        `SELECT *
         FROM approvals
         WHERE execution_id = ?
         ORDER BY decided_at DESC
         LIMIT 1`,
      )
      .get(executionId) as ApprovalRow | undefined,
  );
}

function expireApproval(
  db: DatabaseType.Database,
  id: string,
  at: number,
): void {
  db.prepare(
    "UPDATE approvals SET state = 'expired', decision = 'EXPIRED', decided_at = ? WHERE id = ?",
  ).run(at, id);
}

export function expirePendingApprovals(
  db: DatabaseType.Database,
  at: number = Date.now(),
): number {
  const result = db
    .prepare(
      `UPDATE approvals
       SET state = 'expired', decision = 'EXPIRED', decided_at = ?
       WHERE state = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at <= ?`,
    )
    .run(at, at);
  return result.changes;
}

export function recordApproval(
  db: DatabaseType.Database,
  input: RecordApprovalInput,
): void {
  db.prepare(
    `INSERT INTO approvals (
       id, execution_id, session_id, tool_id, scope_hash, state, token_hash,
       decision, decided_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.execution_id ?? null,
    input.session_id,
    input.tool_id,
    input.scope_hash,
    input.state ?? stateFromDecision(input.decision),
    input.token_hash ?? null,
    input.decision,
    input.decided_at,
    input.expires_at ?? null,
    input.consumed_at ?? null,
  );
}

export function createPendingApproval(
  db: DatabaseType.Database,
  input: CreatePendingApprovalInput,
): PendingApproval {
  const id = input.id ?? input.newId?.() ?? newId();
  const token = input.token ?? newToken();
  const tokenHash = hashApprovalToken(token);
  const expiresAt = input.created_at + input.ttl_ms;

  recordApproval(db, {
    id,
    execution_id: input.execution_id,
    session_id: input.session_id,
    tool_id: input.tool_id,
    scope_hash: input.scope_hash,
    state: "pending",
    token_hash: tokenHash,
    decision: "PENDING",
    decided_at: input.created_at,
    expires_at: expiresAt,
  });

  return { id, token, tokenHash, expiresAt };
}

export function approveApproval(
  db: DatabaseType.Database,
  input: { id: string; token: string; approved_at: number },
): ApprovalVerificationResult {
  const row = getApprovalById(db, input.id);
  if (!row) return { status: "missing" };
  if (row.state === "denied") return { status: "denied", row };
  if (row.state === "cancelled") return { status: "cancelled", row };
  if (row.state === "expired") return { status: "expired", row };
  if (row.consumed_at !== null) return { status: "replayed", row };
  if (row.expires_at !== null && row.expires_at <= input.approved_at) {
    expireApproval(db, row.id, input.approved_at);
    return { status: "expired", row: getApprovalById(db, row.id) };
  }
  if (!tokensMatch(input.token, row.token_hash)) {
    return { status: "invalid_token", row };
  }

  db.prepare(
    `UPDATE approvals
     SET state = 'approved', decision = 'APPROVED_ONCE', decided_at = ?
     WHERE id = ?`,
  ).run(input.approved_at, row.id);

  return { status: "granted", row: getApprovalById(db, row.id) };
}

export function denyApproval(
  db: DatabaseType.Database,
  input: { id: string; denied_at: number },
): ApprovalVerificationResult {
  const row = getApprovalById(db, input.id);
  if (!row) return { status: "missing" };
  db.prepare(
    `UPDATE approvals
     SET state = 'denied', decision = 'DENIED', decided_at = ?
     WHERE id = ?`,
  ).run(input.denied_at, row.id);
  return { status: "denied", row: getApprovalById(db, row.id) };
}

export function decideApprovalByExecution(
  db: DatabaseType.Database,
  input: {
    executionId: string;
    decision: ApiApprovalDecision;
    token?: string;
    decidedAt: number;
    sessionTtlMs: number;
    allowSession?: boolean;
  },
): ApprovalVerificationResult {
  const row = getApprovalByExecution(db, input.executionId);
  if (!row) return { status: "missing" };
  if (!input.token || !tokensMatch(input.token, row.token_hash)) {
    return { status: "invalid_token", row };
  }
  if (row.expires_at !== null && row.expires_at <= input.decidedAt) {
    expireApproval(db, row.id, input.decidedAt);
    return { status: "expired", row: getApprovalById(db, row.id) };
  }
  if (row.state === "denied") return { status: "denied", row };
  if (row.state === "cancelled") return { status: "cancelled", row };
  if (row.state === "expired") return { status: "expired", row };
  if (row.state === "approved" || row.consumed_at !== null) {
    return { status: "replayed", row };
  }
  if (row.state !== "pending") return { status: "missing", row };

  if (input.decision === "DENIED") {
    return denyApproval(db, { id: row.id, denied_at: input.decidedAt });
  }
  if (input.decision === "APPROVED_SESSION" && input.allowSession === false) {
    return { status: "session_not_allowed", row };
  }

  db.prepare(
    `UPDATE approvals
     SET state = 'approved',
         decision = ?,
         decided_at = ?,
         expires_at = ?
     WHERE id = ?`,
  ).run(
    input.decision,
    input.decidedAt,
    input.decision === "APPROVED_SESSION"
      ? input.decidedAt + input.sessionTtlMs
      : row.expires_at,
    row.id,
  );

  return { status: "granted", row: getApprovalById(db, row.id) };
}

export function cancelApproval(
  db: DatabaseType.Database,
  input: { id: string; cancelled_at: number },
): ApprovalVerificationResult {
  const row = getApprovalById(db, input.id);
  if (!row) return { status: "missing" };
  db.prepare(
    `UPDATE approvals
     SET state = 'cancelled', decision = 'CANCELLED', decided_at = ?
     WHERE id = ?`,
  ).run(input.cancelled_at, row.id);
  return { status: "cancelled", row: getApprovalById(db, row.id) };
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
  return normalizeRow(
    db
      .prepare(
        `SELECT *
       FROM approvals
       WHERE session_id = ?
         AND tool_id = ?
         AND scope_hash = ?
         AND state = 'approved'
         AND (consumed_at IS NULL OR decision = 'APPROVED_SESSION')
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY decided_at DESC
       LIMIT 1`,
      )
      .get(input.sessionId, input.toolId, input.scopeHash, at) as
      | ApprovalRow
      | undefined,
  );
}

export function verifyToolApproval(
  db: DatabaseType.Database,
  input: {
    sessionId: string;
    toolId: string;
    scopeHash: string;
    at?: number;
    consume?: boolean;
  },
): ApprovalVerificationResult {
  const at = input.at ?? Date.now();
  const row = normalizeRow(
    db
      .prepare(
        `SELECT *
         FROM approvals
         WHERE session_id = ?
           AND tool_id = ?
           AND scope_hash = ?
         ORDER BY decided_at DESC
         LIMIT 1`,
      )
      .get(input.sessionId, input.toolId, input.scopeHash) as
      | ApprovalRow
      | undefined,
  );

  if (!row) return { status: "required" };
  if (row.state === "denied") return { status: "denied", row };
  if (row.state === "cancelled") return { status: "cancelled", row };
  if (row.state === "expired") return { status: "expired", row };
  if (row.expires_at !== null && row.expires_at <= at) {
    expireApproval(db, row.id, at);
    return { status: "expired", row: getApprovalById(db, row.id) };
  }
  if (row.state === "pending") return { status: "required", row };
  if (row.consumed_at !== null && row.decision !== "APPROVED_SESSION") {
    return { status: "replayed", row };
  }

  if (input.consume !== false) {
    consumeApproval(db, row.id, at);
  }

  return { status: "granted", row: getApprovalById(db, row.id) };
}

export function consumeApproval(
  db: DatabaseType.Database,
  id: string,
  consumedAt: number = Date.now(),
): void {
  db.prepare(
    `UPDATE approvals
     SET consumed_at = ?
     WHERE id = ? AND decision = 'APPROVED_ONCE' AND consumed_at IS NULL`,
  ).run(consumedAt, id);
}
