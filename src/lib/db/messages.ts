import type DatabaseType from "better-sqlite3";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

export function appendMessage(
  db: DatabaseType.Database,
  row: MessageRow,
): void {
  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.id, row.session_id, row.role, row.content, row.created_at);
}

export function insertMessageIfMissing(
  db: DatabaseType.Database,
  row: MessageRow,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.id, row.session_id, row.role, row.content, row.created_at);
}

export function listMessages(
  db: DatabaseType.Database,
  sessionId: string,
): MessageRow[] {
  return db
    .prepare(
      `SELECT id, session_id, role, content, created_at
       FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
    )
    .all(sessionId) as MessageRow[];
}
