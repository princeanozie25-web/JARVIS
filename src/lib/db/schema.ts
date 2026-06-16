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
  "015_project_source_ledger",
  "016_project_index_snapshot",
  "017_project_artifacts",
  "018_environment_registry",
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

CREATE TABLE IF NOT EXISTS project_source (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('file', 'memory_slug', 'obsidian_note', 'thread')),
  ref              TEXT NOT NULL,
  last_indexed_at  INTEGER,
  source_hash      TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_source_project
  ON project_source (project_id, kind);

CREATE INDEX IF NOT EXISTS idx_project_source_kind
  ON project_source (kind);

CREATE TABLE IF NOT EXISTS project_index_snapshot (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at           INTEGER NOT NULL,
  finished_at          INTEGER,
  sources_seen         INTEGER NOT NULL CHECK (sources_seen >= 0),
  artifacts_extracted  INTEGER NOT NULL CHECK (artifacts_extracted >= 0),
  triggered_by         TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_project_index_snapshot_project
  ON project_index_snapshot (project_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_index_snapshot_status
  ON project_index_snapshot (status, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_index_snapshot_active_project
  ON project_index_snapshot (project_id)
  WHERE status IN ('pending', 'running');

CREATE TABLE IF NOT EXISTS project_thread (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'stale')),
  first_seen_at   INTEGER NOT NULL,
  last_active_at  INTEGER NOT NULL,
  origin_ref      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_thread_project
  ON project_thread (project_id, status, last_active_at DESC);

CREATE TABLE IF NOT EXISTS project_task (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id   TEXT REFERENCES project_thread(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('extracted', 'open', 'in_progress', 'blocked', 'done', 'dismissed')),
  confidence  REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  promoted    INTEGER NOT NULL DEFAULT 0 CHECK (promoted IN (0, 1)),
  origin_ref  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_task_project
  ON project_task (project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_task_thread
  ON project_task (thread_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_task_origin
  ON project_task (project_id, origin_ref);

CREATE TABLE IF NOT EXISTS project_blocker (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id      TEXT REFERENCES project_task(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('open', 'cleared')),
  origin_ref   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_blocker_project
  ON project_blocker (project_id, status);

CREATE INDEX IF NOT EXISTS idx_project_blocker_task
  ON project_blocker (task_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_blocker_origin
  ON project_blocker (project_id, origin_ref);

CREATE TABLE IF NOT EXISTS project_decision (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary     TEXT NOT NULL,
  decided_at  INTEGER,
  origin_ref  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_decision_project
  ON project_decision (project_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS environment_registry_metadata (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS environment_room (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  kind          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environment_trust_class (
  id                 TEXT PRIMARY KEY CHECK (id IN ('observe-only', 'safe-mutate', 'restricted-mutate', 'forbidden')),
  can_observe        INTEGER NOT NULL CHECK (can_observe IN (0, 1)),
  can_mutate         INTEGER NOT NULL CHECK (can_mutate IN (0, 1)),
  requires_approval  INTEGER NOT NULL CHECK (requires_approval IN (0, 1)),
  notes              TEXT
);

CREATE TABLE IF NOT EXISTS environment_capability (
  id            TEXT PRIMARY KEY CHECK (id IN ('state.observe', 'power.observe', 'light.observe', 'climate.observe', 'media.observe', 'lock.observe', 'environment.observe', 'automation.plan')),
  display_name  TEXT NOT NULL,
  description   TEXT,
  trust_class   TEXT NOT NULL REFERENCES environment_trust_class(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS environment_device (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  room_id       TEXT NOT NULL REFERENCES environment_room(id) ON DELETE RESTRICT,
  manufacturer  TEXT,
  model         TEXT,
  trust_class   TEXT NOT NULL DEFAULT 'observe-only' REFERENCES environment_trust_class(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_environment_device_room
  ON environment_device (room_id, display_name ASC);

CREATE INDEX IF NOT EXISTS idx_environment_device_trust
  ON environment_device (trust_class, display_name ASC);

CREATE TABLE IF NOT EXISTS environment_device_capability (
  device_id      TEXT NOT NULL REFERENCES environment_device(id) ON DELETE CASCADE,
  capability_id  TEXT NOT NULL REFERENCES environment_capability(id) ON DELETE RESTRICT,
  PRIMARY KEY (device_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_environment_device_capability_capability
  ON environment_device_capability (capability_id);

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
  // Additive (24C-2, per GATE-1): FC-2 server-computed canonical-effect + scope
  // snapshot hashes on a pending proposal. Idempotent ADD COLUMN; intentionally
  // NOT recorded as a new _schema_migrations row (hasColumn already guarantees
  // idempotency, and the migration-id list is pinned by schema.test.ts).
  if (!hasColumn(db, "approvals", "canonical_effect_hash")) {
    db.exec("ALTER TABLE approvals ADD COLUMN canonical_effect_hash TEXT");
  }
  if (!hasColumn(db, "approvals", "scope_snapshot_hash")) {
    db.exec("ALTER TABLE approvals ADD COLUMN scope_snapshot_hash TEXT");
  }
  // Additive (24C-2b): the exact stable serialization the FC-2 hash was computed
  // over, so the approval-time guard can recompute + compare it without a gateway
  // dependency. Idempotent ADD COLUMN; not recorded as a new migration row.
  if (!hasColumn(db, "approvals", "canonical_effect_json")) {
    db.exec("ALTER TABLE approvals ADD COLUMN canonical_effect_json TEXT");
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
