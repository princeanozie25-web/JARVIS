import type DatabaseType from "better-sqlite3";
import type { LongTermMemoryRow } from "../memory/types";

export interface InsertLongTermMemoryInput {
  id: string;
  category: LongTermMemoryRow["category"];
  content: string;
  source: LongTermMemoryRow["source"];
  source_id?: string | null;
  project?: string | null;
  tags_json: string;
  sensitivity: LongTermMemoryRow["sensitivity"];
  created_at: number;
  updated_at: number;
  obsidian_path?: string | null;
  hash: string;
  status?: LongTermMemoryRow["status"];
}

export function insertLongTermMemory(
  db: DatabaseType.Database,
  input: InsertLongTermMemoryInput,
): void {
  db.prepare(
    `INSERT INTO long_term_memory (
       id, category, content, source, source_id, project, tags_json,
       sensitivity, created_at, updated_at, obsidian_path, hash, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.category,
    input.content,
    input.source,
    input.source_id ?? null,
    input.project ?? null,
    input.tags_json,
    input.sensitivity,
    input.created_at,
    input.updated_at,
    input.obsidian_path ?? null,
    input.hash,
    input.status ?? "active",
  );
}

export function deleteLongTermMemory(
  db: DatabaseType.Database,
  id: string,
): void {
  db.prepare("DELETE FROM long_term_memory WHERE id = ?").run(id);
}

export function listLongTermMemory(
  db: DatabaseType.Database,
  limit: number = 100,
): LongTermMemoryRow[] {
  return db
    .prepare(
      `SELECT *
       FROM long_term_memory
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as LongTermMemoryRow[];
}
