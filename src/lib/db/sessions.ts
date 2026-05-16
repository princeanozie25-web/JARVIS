import type DatabaseType from "better-sqlite3";

export interface SessionRow {
  id: string;
  created_at: number;
  updated_at: number;
}

export function createSession(
  db: DatabaseType.Database,
  id: string,
  at: number = Date.now(),
): SessionRow {
  db.prepare(
    "INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)",
  ).run(id, at, at);
  return { id, created_at: at, updated_at: at };
}

export function createSessionIfMissing(
  db: DatabaseType.Database,
  id: string,
  at: number = Date.now(),
): SessionRow {
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, created_at, updated_at)
     VALUES (?, ?, ?)`,
  ).run(id, at, at);
  touchSession(db, id, at);
  const row = getSession(db, id);
  if (!row) {
    throw new Error(`Failed to create session: ${id}`);
  }
  return row;
}

export function touchSession(
  db: DatabaseType.Database,
  id: string,
  at: number = Date.now(),
): void {
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(at, id);
}

export function getSession(
  db: DatabaseType.Database,
  id: string,
): SessionRow | undefined {
  return db
    .prepare("SELECT id, created_at, updated_at FROM sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
}

export function listSessions(
  db: DatabaseType.Database,
  limit: number = 50,
): SessionRow[] {
  return db
    .prepare(
      "SELECT id, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?",
    )
    .all(limit) as SessionRow[];
}
