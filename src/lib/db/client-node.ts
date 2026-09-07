import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyMigrations } from "./schema";

let cached: Database.Database | null = null;

// Phase 25G (G1): a packaged .app is read-only and its cwd is not writable,
// so the data dir is overridable. Unset = the historical <cwd>/data.
export function resolveDataDir(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.JARVIS_DATA_DIR?.trim();
  return configured ? resolve(configured) : join(process.cwd(), "data");
}

function dbPath(): string {
  const dir = resolveDataDir();
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
