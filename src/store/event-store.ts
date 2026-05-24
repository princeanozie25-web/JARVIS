import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import Database from "better-sqlite3";

export interface EventStoreMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface AppliedMigration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly applied_at_ms: number;
}

export interface EventStoreOptions {
  readonly databasePath: string;
  readonly migrations?: readonly EventStoreMigration[];
}

export interface EventStoreSchemaSummary {
  readonly tables: readonly string[];
  readonly triggers: readonly string[];
  readonly journalMode: string;
  readonly userVersion: number;
}

export interface AppendScaffoldEventInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAtMs: number;
  readonly source: string;
  readonly aggregateId?: string | null;
  readonly metadataJson?: string;
}

export interface EventStore {
  appendEvent(input: AppendScaffoldEventInput): void;
  inspectMigrations(): AppliedMigration[];
  inspectSchema(): EventStoreSchemaSummary;
  close(): void;
}

export const EVENT_STORE_SCHEMA_VERSION = 1;

export const EXPECTED_EVENT_STORE_TABLES = [
  "approval_lifecycle",
  "events",
  "model_calls",
  "replay_traces",
  "room_events",
  "routine_suggestions",
  "runtime_executions",
  "schema_migrations",
  "telemetry_events",
] as const;

export function loadDefaultEventStoreMigrations(): EventStoreMigration[] {
  return [
    migrationFromFile(resolve(process.cwd(), "db/migrations/0001_init.sql")),
  ];
}

export function initializeEventStore(options: EventStoreOptions): EventStore {
  const migrations = validateMigrationOrdering(
    options.migrations ?? loadDefaultEventStoreMigrations(),
  );
  const db = new Database(options.databasePath);
  db.pragma("foreign_keys = ON");
  const journalMode = readJournalMode(db.pragma("journal_mode = WAL"));
  if (journalMode !== "wal") {
    db.close();
    throw new Error(`Event store requires WAL mode; received ${journalMode}.`);
  }

  try {
    applyMigrations(db, migrations);
    db.pragma(`user_version = ${EVENT_STORE_SCHEMA_VERSION}`);
  } catch (error) {
    db.close();
    throw error;
  }

  return {
    appendEvent: (input) => appendEvent(db, input),
    inspectMigrations: () => inspectMigrations(db),
    inspectSchema: () => inspectSchema(db),
    close: () => db.close(),
  };
}

export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(normalizeSql(sql)).digest("hex");
}

function applyMigrations(
  db: Database.Database,
  migrations: readonly EventStoreMigration[],
): void {
  ensureMetadataIsNotMissing(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at_ms INTEGER NOT NULL CHECK (applied_at_ms >= 0)
    );
  `);

  const applied = inspectMigrations(db);
  const knownVersions = new Set(
    migrations.map((migration) => migration.version),
  );
  for (const row of applied) {
    if (!knownVersions.has(row.version)) {
      throw new Error(`Unknown event-store migration version ${row.version}.`);
    }
  }

  const transaction = db.transaction(() => {
    for (const migration of migrations) {
      const checksum = migrationChecksum(migration.sql);
      const existing = applied.find((row) => row.version === migration.version);
      if (existing) {
        if (
          existing.name !== migration.name ||
          existing.checksum !== checksum
        ) {
          throw new Error(
            `Event-store migration ${migration.version} metadata mismatch.`,
          );
        }
        continue;
      }

      db.exec(migration.sql);
      db.prepare(
        `
          INSERT INTO schema_migrations (
            version,
            name,
            checksum,
            applied_at_ms
          ) VALUES (?, ?, ?, ?)
        `,
      ).run(migration.version, migration.name, checksum, migration.version);
    }
  });

  transaction();
}

function appendEvent(
  db: Database.Database,
  input: AppendScaffoldEventInput,
): void {
  db.prepare(
    `
      INSERT INTO events (
        event_id,
        event_type,
        occurred_at_ms,
        source,
        aggregate_id,
        metadata_json,
        payload_json,
        local_only,
        created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?)
    `,
  ).run(
    input.eventId,
    input.eventType,
    input.occurredAtMs,
    input.source,
    input.aggregateId ?? null,
    input.metadataJson ?? "{}",
    input.occurredAtMs,
  );
}

function inspectMigrations(db: Database.Database): AppliedMigration[] {
  if (!tableExists(db, "schema_migrations")) return [];
  return db
    .prepare(
      `
        SELECT version, name, checksum, applied_at_ms
        FROM schema_migrations
        ORDER BY version ASC
      `,
    )
    .all() as AppliedMigration[];
}

function inspectSchema(db: Database.Database): EventStoreSchemaSummary {
  const tables = db
    .prepare(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC
      `,
    )
    .all()
    .map((row) => (row as { name: string }).name);
  const triggers = db
    .prepare(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'trigger'
        ORDER BY name ASC
      `,
    )
    .all()
    .map((row) => (row as { name: string }).name);

  return {
    tables,
    triggers,
    journalMode: readJournalMode(db.pragma("journal_mode")),
    userVersion: Number(db.pragma("user_version", { simple: true })),
  };
}

function ensureMetadataIsNotMissing(db: Database.Database): void {
  if (tableExists(db, "schema_migrations")) return;
  const userTables = db
    .prepare(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `,
    )
    .all();
  if (userTables.length > 0) {
    throw new Error("Event-store migration metadata is missing.");
  }
}

function validateMigrationOrdering(
  migrations: readonly EventStoreMigration[],
): readonly EventStoreMigration[] {
  if (migrations.length === 0) {
    throw new Error("Event store requires at least one migration.");
  }
  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw new Error(
        `Event-store migrations must be contiguous and ordered; expected ${expectedVersion}.`,
      );
    }
  });
  return migrations;
}

function migrationFromFile(path: string): EventStoreMigration {
  const name = basename(path);
  const match = /^(\d{4})_(.+)\.sql$/.exec(name);
  if (!match) {
    throw new Error(`Invalid event-store migration filename: ${name}.`);
  }
  return {
    version: Number(match[1]),
    name,
    sql: readFileSync(path, "utf8"),
  };
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table'
          AND name = ?
      `,
    )
    .get(tableName);
  return row !== undefined;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\r\n/g, "\n").trim();
}

function readJournalMode(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as { journal_mode?: string };
    if (typeof first.journal_mode === "string") {
      return first.journal_mode.toLowerCase();
    }
  }
  return "unknown";
}
