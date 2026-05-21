import type DatabaseType from "better-sqlite3";

const MIGRATION_IDS = [
  "001_initial_schema",
  "002_telemetry_execution_id",
  "003_approval_lifecycle",
  "004_memory_foundation",
  "005_memory_fts",
  "006_session_summaries",
  "007_project_state",
  "008_memory_candidates",
  "009_preferences",
  "010_goals",
  "011_conversation_curator",
  "012_human_review_queue",
  "013_runtime_command_calls",
  "014_project_registry",
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

CREATE TABLE IF NOT EXISTS session_summaries (
  session_id             TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary_text           TEXT NOT NULL,
  previous_summary_hash  TEXT REFERENCES session_summaries(summary_hash) ON UPDATE CASCADE ON DELETE SET NULL,
  summary_hash           TEXT PRIMARY KEY,
  covered_message_count  INTEGER NOT NULL CHECK (covered_message_count >= 0),
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_session
  ON session_summaries (session_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_summaries_previous
  ON session_summaries (previous_summary_hash);

CREATE TABLE IF NOT EXISTS project_state (
  project_id            TEXT PRIMARY KEY,
  project_name          TEXT NOT NULL,
  last_session_id       TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  last_action_summary   TEXT NOT NULL,
  open_threads_json     TEXT NOT NULL,
  next_intended_step    TEXT,
  updated_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_state_updated_at
  ON project_state (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_state_name
  ON project_state (project_name);

CREATE TABLE IF NOT EXISTS memory_candidates (
  id                       TEXT PRIMARY KEY,
  session_id               TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_message_ids_json  TEXT NOT NULL,
  proposed_category        TEXT NOT NULL CHECK (proposed_category IN ('fact', 'preference', 'event', 'decision')),
  proposed_content         TEXT NOT NULL,
  proposed_tags_json       TEXT NOT NULL,
  proposed_sensitivity     TEXT NOT NULL CHECK (proposed_sensitivity IN ('public', 'personal', 'sensitive', 'restricted')),
  rationale                TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'rejected', 'edited')),
  created_at               INTEGER NOT NULL,
  reviewed_at              INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_candidates_session
  ON memory_candidates (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_candidates_status
  ON memory_candidates (status, created_at DESC);

CREATE TABLE IF NOT EXISTS preferences (
  id             TEXT PRIMARY KEY,
  key            TEXT NOT NULL,
  value          TEXT NOT NULL,
  category       TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'user' CHECK (source = 'user'),
  effective_from INTEGER NOT NULL,
  supersedes_id  TEXT REFERENCES preferences(id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preferences_key_effective
  ON preferences (key, effective_from DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_preferences_supersedes
  ON preferences (supersedes_id);

CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('active', 'met', 'missed', 'abandoned')),
  parent_id     TEXT REFERENCES goals(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL,
  last_touched  INTEGER NOT NULL,
  completed_at  INTEGER,
  source        TEXT NOT NULL DEFAULT 'user' CHECK (source = 'user')
);

CREATE INDEX IF NOT EXISTS idx_goals_status
  ON goals (status, last_touched DESC);

CREATE INDEX IF NOT EXISTS idx_goals_parent
  ON goals (parent_id);

CREATE TABLE IF NOT EXISTS curator_records (
  id                     TEXT PRIMARY KEY,
  record_type            TEXT NOT NULL CHECK (record_type IN ('merged_summary', 'manual_note')),
  title                  TEXT NOT NULL,
  content                TEXT NOT NULL,
  source_type            TEXT NOT NULL CHECK (source_type IN ('summary', 'candidate', 'curator_record', 'mixed')),
  source_ids_json        TEXT NOT NULL,
  derived_from_ids_json  TEXT NOT NULL,
  source_session_id      TEXT,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_curator_records_created_at
  ON curator_records (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_records_status
  ON curator_records (status);

CREATE TABLE IF NOT EXISTS curator_audit_records (
  id                       TEXT PRIMARY KEY,
  action_type              TEXT NOT NULL CHECK (action_type IN ('curator_action', 'curator_merge', 'curator_split', 'curator_archive', 'curator_delete')),
  target_type              TEXT NOT NULL CHECK (target_type IN ('summary', 'candidate', 'curator_record', 'mixed')),
  target_ids_json          TEXT NOT NULL,
  derived_record_ids_json  TEXT NOT NULL,
  source_session_id        TEXT,
  provenance_json          TEXT NOT NULL,
  notes                    TEXT NOT NULL,
  created_at               INTEGER NOT NULL,
  created_by               TEXT NOT NULL DEFAULT 'user' CHECK (created_by = 'user')
);

CREATE INDEX IF NOT EXISTS idx_curator_audit_created_at
  ON curator_audit_records (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_audit_action
  ON curator_audit_records (action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS human_review_queue (
  id               TEXT PRIMARY KEY,
  source_id        TEXT NOT NULL,
  source_type      TEXT NOT NULL CHECK (source_type IN ('memory_candidate', 'curator_audit', 'goal', 'memory_weighting')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
  decision_reason  TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  UNIQUE(source_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_human_review_queue_status
  ON human_review_queue (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_human_review_queue_source
  ON human_review_queue (source_type, source_id);

CREATE TABLE IF NOT EXISTS runtime_command_calls (
  id                    TEXT PRIMARY KEY,
  session_id            TEXT NOT NULL,
  command_id            TEXT NOT NULL,
  command               TEXT NOT NULL,
  argv_json             TEXT NOT NULL,
  working_directory     TEXT NOT NULL,
  required_safety_tag   TEXT NOT NULL,
  reversibility_class   TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
  proposed_at           INTEGER NOT NULL,
  approved_at           INTEGER,
  started_at            INTEGER,
  completed_at          INTEGER,
  stdout_ref            TEXT,
  stderr_ref            TEXT,
  exit_code             INTEGER,
  error_class           TEXT,
  error_message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_command_calls_session
  ON runtime_command_calls (session_id, proposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_command_calls_command
  ON runtime_command_calls (command_id, proposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_command_calls_status
  ON runtime_command_calls (status, proposed_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  root_kind     TEXT NOT NULL CHECK (root_kind IN ('fs', 'memory', 'obsidian', 'virtual')),
  root_ref      TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  archived_at   INTEGER,
  status        TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status, display_name ASC);

CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON projects (created_at DESC);

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

CREATE VIRTUAL TABLE IF NOT EXISTS long_term_memory_fts
  USING fts5(
    memory_id UNINDEXED,
    content,
    tags,
    category UNINDEXED,
    project UNINDEXED,
    sensitivity UNINDEXED,
    tokenize = 'unicode61'
  );

CREATE TRIGGER IF NOT EXISTS long_term_memory_ai
AFTER INSERT ON long_term_memory
BEGIN
  INSERT INTO long_term_memory_fts (
    rowid, memory_id, content, tags, category, project, sensitivity
  ) VALUES (
    new.rowid,
    new.id,
    new.content,
    new.tags_json,
    new.category,
    coalesce(new.project, ''),
    new.sensitivity
  );
END;

CREATE TRIGGER IF NOT EXISTS long_term_memory_ad
AFTER DELETE ON long_term_memory
BEGIN
  DELETE FROM long_term_memory_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS long_term_memory_au
AFTER UPDATE ON long_term_memory
BEGIN
  DELETE FROM long_term_memory_fts WHERE rowid = old.rowid;
  INSERT INTO long_term_memory_fts (
    rowid, memory_id, content, tags, category, project, sensitivity
  ) VALUES (
    new.rowid,
    new.id,
    new.content,
    new.tags_json,
    new.category,
    coalesce(new.project, ''),
    new.sensitivity
  );
END;
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
  db.exec(`
    DELETE FROM long_term_memory_fts;
    INSERT INTO long_term_memory_fts (
      rowid, memory_id, content, tags, category, project, sensitivity
    )
    SELECT
      rowid, id, content, tags_json, category, coalesce(project, ''), sensitivity
    FROM long_term_memory;
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
