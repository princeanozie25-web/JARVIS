import type DatabaseType from "better-sqlite3";
import { setToolCallRollbackId } from "./tool-calls";

export type RollbackKind =
  | "fs_restore_content"
  | "fs_truncate_to_length"
  | "fs_unlink_created"
  | "fs_move_back"
  | "fs_untrash"
  | "fs_rmdir_empty";

export interface RollbackRow {
  id: string;
  execution_id: string;
  session_id: string;
  kind: RollbackKind;
  payload_json: string;
  created_at: number;
  applied_at: number | null;
}

export interface RecordRollbackInput {
  id: string;
  execution_id: string;
  session_id: string;
  kind: RollbackKind;
  payload_json: string;
  created_at: number;
  applied_at?: number | null;
}

export function recordRollback(
  db: DatabaseType.Database,
  input: RecordRollbackInput,
): void {
  db.prepare(
    `INSERT INTO rollbacks (
       id, execution_id, session_id, kind, payload_json, created_at, applied_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.execution_id,
    input.session_id,
    input.kind,
    input.payload_json,
    input.created_at,
    input.applied_at ?? null,
  );
}

export function recordRollbackForToolCall(
  db: DatabaseType.Database,
  input: RecordRollbackInput,
): void {
  const insert = db.prepare(
    `INSERT INTO rollbacks (
       id, execution_id, session_id, kind, payload_json, created_at, applied_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const transaction = db.transaction(() => {
    insert.run(
      input.id,
      input.execution_id,
      input.session_id,
      input.kind,
      input.payload_json,
      input.created_at,
      input.applied_at ?? null,
    );
    setToolCallRollbackId(db, input.execution_id, input.id);
  });
  transaction();
}

export function getRollback(
  db: DatabaseType.Database,
  id: string,
): RollbackRow | undefined {
  return db.prepare("SELECT * FROM rollbacks WHERE id = ?").get(id) as
    | RollbackRow
    | undefined;
}

export function getLatestRollbackForSession(
  db: DatabaseType.Database,
  sessionId: string,
): RollbackRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM rollbacks
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(sessionId) as RollbackRow | undefined;
}

export function getLatestUnappliedRollbackForSession(
  db: DatabaseType.Database,
  sessionId: string,
): RollbackRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM rollbacks
       WHERE session_id = ?
         AND applied_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(sessionId) as RollbackRow | undefined;
}

export function getLatestAvailableRollbackForSession(
  db: DatabaseType.Database,
  input: { sessionId: string; now: number; ttlMs: number },
): RollbackRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM rollbacks
       WHERE session_id = ?
         AND applied_at IS NULL
         AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(input.sessionId, input.now - input.ttlMs) as RollbackRow | undefined;
}

export function markRollbackApplied(
  db: DatabaseType.Database,
  id: string,
  appliedAt: number,
): void {
  db.prepare(
    `UPDATE rollbacks
     SET applied_at = ?
     WHERE id = ? AND applied_at IS NULL`,
  ).run(appliedAt, id);
}

export function listRollbacks(
  db: DatabaseType.Database,
  opts: { sessionId?: string; limit?: number } = {},
): RollbackRow[] {
  const limit = opts.limit ?? 200;
  if (opts.sessionId) {
    return db
      .prepare(
        `SELECT *
         FROM rollbacks
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(opts.sessionId, limit) as RollbackRow[];
  }

  return db
    .prepare(`SELECT * FROM rollbacks ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as RollbackRow[];
}
