import type DatabaseType from "better-sqlite3";

const MIGRATION_IDS = [
  "001_initial_schema",
  "002_telemetry_execution_id",
  "003_approval_lifecycle",
  "004_memory_foundation",
] as const;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session
  ON messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp                INTEGER NOT NULL,
  session_id               TEXT,
  event_type               TEXT NOT NULL,
  success                  INTEGER NOT NULL,
  intent                   TEXT,
  safety_tag               TEXT,
  tier                     TEXT,
  model_id                 TEXT,
  tool_name                TEXT,
  execution_id             TEXT,
  input_tokens             INTEGER,
  output_tokens            INTEGER,
  latency_ms               INTEGER,
  time_to_first_token_ms   INTEGER,
  cost_usd                 REAL,
  error_class              TEXT,
  user_rating              INTEGER,
  notes                    TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp
  ON telemetry_events (timestamp);

CREATE TABLE IF NOT EXISTS tool_calls (
  execution_id         TEXT PRIMARY KEY,
  session_id           TEXT NOT NULL,
  tool_id              TEXT NOT NULL,
  tool_name            TEXT NOT NULL,
  status               TEXT NOT NULL,
  safety_tag           TEXT NOT NULL,
  required_safety_tag  TEXT NOT NULL,
  scope_hash           TEXT NOT NULL,
  input_json           TEXT NOT NULL,
  output_json          TEXT,
  error_message        TEXT,
  proposed_at          INTEGER NOT NULL,
  started_at           INTEGER,
  completed_at         INTEGER,
  timeout_ms           INTEGER NOT NULL,
  rollback_id          TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session
  ON tool_calls (session_id, proposed_at);

CREATE INDEX IF NOT EXISTS idx_tool_calls_tool
  ON tool_calls (tool_id);

CREATE INDEX IF NOT EXISTS idx_tool_calls_status
  ON tool_calls (status);

CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT PRIMARY KEY,
  execution_id  TEXT,
  session_id    TEXT NOT NULL,
  tool_id       TEXT NOT NULL,
  scope_hash    TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'pending',
  token_hash    TEXT,
  decision      TEXT NOT NULL,
  decided_at    INTEGER NOT NULL,
  expires_at    INTEGER,
  consumed_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_approvals_lookup
  ON approvals (session_id, tool_id, scope_hash, state);

CREATE TABLE IF NOT EXISTS rollbacks (
  id             TEXT PRIMARY KEY,
  execution_id   TEXT NOT NULL,
  session_id     TEXT NOT NULL,
  kind           TEXT NOT NULL,
  payload_json   TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  applied_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rollbacks_session
  ON rollbacks (session_id, created_at);

CREATE TABLE IF NOT EXISTS eval_runs (
  id            TEXT PRIMARY KEY,
  label         TEXT,
  created_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  case_count    INTEGER NOT NULL,
  target_count  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_results (
  id                       TEXT PRIMARY KEY,
  run_id                   TEXT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id                  TEXT NOT NULL,
  case_label               TEXT,
  provider_id              TEXT NOT NULL,
  model_id                 TEXT NOT NULL,
  model_name               TEXT NOT NULL,
  output                   TEXT NOT NULL,
  latency_ms               INTEGER NOT NULL,
  time_to_first_token_ms   INTEGER,
  input_tokens             INTEGER,
  output_tokens            INTEGER,
  cost_usd                 REAL NOT NULL,
  success                  INTEGER NOT NULL,
  error_message            TEXT,
  created_at               INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run
  ON eval_results (run_id);

CREATE TABLE IF NOT EXISTS long_term_memory (
  id             TEXT PRIMARY KEY,
  category       TEXT NOT NULL CHECK (category IN ('fact', 'preference', 'event', 'decision')),
  content        TEXT NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('distilled', 'user', 'tool')),
  source_id      TEXT,
  project        TEXT,
  tags_json      TEXT NOT NULL,
  sensitivity    TEXT NOT NULL CHECK (sensitivity IN ('public', 'personal', 'sensitive', 'restricted')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  obsidian_path  TEXT,
  hash           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft'))
);

CREATE INDEX IF NOT EXISTS idx_long_term_memory_created_at
  ON long_term_memory (created_at);

CREATE INDEX IF NOT EXISTS idx_long_term_memory_sensitivity
  ON long_term_memory (sensitivity);

CREATE INDEX IF NOT EXISTS idx_long_term_memory_category
  ON long_term_memory (category);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id                TEXT PRIMARY KEY,
  subject           TEXT NOT NULL,
  predicate         TEXT NOT NULL,
  object            TEXT NOT NULL,
  confidence        REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  derived_from      TEXT NOT NULL,
  first_seen_at     INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  occurrence_count  INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1)
);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_subject
  ON semantic_memory (subject);

CREATE TABLE IF NOT EXISTS reflective_memory (
  id                   TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL CHECK (kind IN ('pattern', 'lesson', 'tendency')),
  content              TEXT NOT NULL,
  window_start         INTEGER NOT NULL,
  window_end           INTEGER NOT NULL,
  evidence_ids         TEXT NOT NULL,
  surfaced_count       INTEGER NOT NULL DEFAULT 0 CHECK (surfaced_count >= 0),
  last_surfaced_at     INTEGER,
  user_acknowledged    INTEGER NOT NULL DEFAULT 0 CHECK (user_acknowledged IN (0, 1)),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_reflective_memory_status
  ON reflective_memory (status);

CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id   TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  embedding   BLOB NOT NULL,
  model       TEXT NOT NULL,
  dim         INTEGER NOT NULL CHECK (dim > 0),
  created_at  INTEGER NOT NULL
);
`;

function hasColumn(
  db: DatabaseType.Database,
  tableName: string,
  columnName: string,
): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === columnName);
}

export function applyMigrations(db: DatabaseType.Database): void {
  db.exec(SCHEMA_SQL);
  const appliedAt = Date.now();
  for (const id of MIGRATION_IDS) {
    db.prepare(
      "INSERT OR IGNORE INTO _schema_migrations (id, applied_at) VALUES (?, ?)",
    ).run(id, appliedAt);
  }
  if (!hasColumn(db, "telemetry_events", "execution_id")) {
    db.exec("ALTER TABLE telemetry_events ADD COLUMN execution_id TEXT");
    db.prepare(
      "INSERT OR IGNORE INTO _schema_migrations (id, applied_at) VALUES (?, ?)",
    ).run("002_telemetry_execution_id", Date.now());
  }
  if (!hasColumn(db, "approvals", "state")) {
    db.exec(
      "ALTER TABLE approvals ADD COLUMN state TEXT NOT NULL DEFAULT 'pending'",
    );
    db.prepare(
      "INSERT OR IGNORE INTO _schema_migrations (id, applied_at) VALUES (?, ?)",
    ).run("003_approval_lifecycle", Date.now());
  }
  if (!hasColumn(db, "approvals", "token_hash")) {
    db.exec("ALTER TABLE approvals ADD COLUMN token_hash TEXT");
    db.prepare(
      "INSERT OR IGNORE INTO _schema_migrations (id, applied_at) VALUES (?, ?)",
    ).run("003_approval_lifecycle", Date.now());
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_execution_id
      ON telemetry_events (execution_id);
  `);
}

export interface SchemaMigrationRow {
  id: string;
  applied_at: number;
}

export function listSchemaMigrations(
  db: DatabaseType.Database,
): SchemaMigrationRow[] {
  return db
    .prepare("SELECT id, applied_at FROM _schema_migrations ORDER BY id ASC")
    .all() as SchemaMigrationRow[];
}
