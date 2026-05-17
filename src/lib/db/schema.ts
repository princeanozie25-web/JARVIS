import type DatabaseType from "better-sqlite3";

export const SCHEMA_SQL = `
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
  decision      TEXT NOT NULL,
  decided_at    INTEGER NOT NULL,
  expires_at    INTEGER,
  consumed_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_approvals_lookup
  ON approvals (session_id, tool_id, scope_hash, decision);

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
  if (!hasColumn(db, "telemetry_events", "execution_id")) {
    db.exec("ALTER TABLE telemetry_events ADD COLUMN execution_id TEXT");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_execution_id
      ON telemetry_events (execution_id);
  `);
}
