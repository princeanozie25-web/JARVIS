import type DatabaseType from "better-sqlite3";

export type RollbackKind =
  | "fs_restore_content"
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
