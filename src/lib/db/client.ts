import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { applyMigrations } from "./schema";

let cached: Database.Database | null = null;

function dbPath(): string {
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return join(dir, "jarvis.db");
}

export function getDb(): Database.Database {
  if (cached) return cached;
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  cached = db;
  return cached;
}

export function closeDb(): void {
  cached?.close();
  cached = null;
}
