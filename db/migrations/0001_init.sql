CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL CHECK (occurred_at_ms >= 0),
  source TEXT NOT NULL,
  aggregate_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  payload_json TEXT,
  local_only INTEGER NOT NULL DEFAULT 1 CHECK (local_only = 1),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
);

CREATE TABLE room_events (
  room_event_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  room_id TEXT,
  profile_id TEXT,
  adapter_id TEXT,
  device_id TEXT,
  sensor_id TEXT,
  capability TEXT,
  failure_class TEXT,
  metadata_only INTEGER NOT NULL DEFAULT 1 CHECK (metadata_only = 1)
);

CREATE TABLE telemetry_events (
  telemetry_event_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  telemetry_scope TEXT NOT NULL,
  severity TEXT NOT NULL,
  metadata_only INTEGER NOT NULL DEFAULT 1 CHECK (metadata_only = 1)
);

CREATE TABLE replay_traces (
  replay_trace_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  trace_kind TEXT NOT NULL,
  replay_metadata_json TEXT NOT NULL DEFAULT '{}',
  raw_payload_retained INTEGER NOT NULL DEFAULT 0 CHECK (raw_payload_retained = 0)
);

CREATE TABLE runtime_executions (
  runtime_execution_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  runtime_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  authority_surface TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE approval_lifecycle (
  approval_event_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  approval_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  auto_approval INTEGER NOT NULL DEFAULT 0 CHECK (auto_approval = 0)
);

CREATE TABLE routine_suggestions (
  routine_suggestion_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  suggestion_status TEXT NOT NULL,
  executes_action INTEGER NOT NULL DEFAULT 0 CHECK (executes_action = 0)
);

CREATE TABLE model_calls (
  model_call_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cloud_call INTEGER NOT NULL DEFAULT 0 CHECK (cloud_call = 0),
  prompt_payload_retained INTEGER NOT NULL DEFAULT 0 CHECK (prompt_payload_retained = 0)
);

CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER room_events_no_update BEFORE UPDATE ON room_events BEGIN
  SELECT RAISE(ABORT, 'room_events are append-only');
END;

CREATE TRIGGER room_events_no_delete BEFORE DELETE ON room_events BEGIN
  SELECT RAISE(ABORT, 'room_events are append-only');
END;

CREATE TRIGGER telemetry_events_no_update BEFORE UPDATE ON telemetry_events BEGIN
  SELECT RAISE(ABORT, 'telemetry_events are append-only');
END;

CREATE TRIGGER telemetry_events_no_delete BEFORE DELETE ON telemetry_events BEGIN
  SELECT RAISE(ABORT, 'telemetry_events are append-only');
END;

CREATE TRIGGER replay_traces_no_update BEFORE UPDATE ON replay_traces BEGIN
  SELECT RAISE(ABORT, 'replay_traces are append-only');
END;

CREATE TRIGGER replay_traces_no_delete BEFORE DELETE ON replay_traces BEGIN
  SELECT RAISE(ABORT, 'replay_traces are append-only');
END;

CREATE TRIGGER runtime_executions_no_update BEFORE UPDATE ON runtime_executions BEGIN
  SELECT RAISE(ABORT, 'runtime_executions are append-only');
END;

CREATE TRIGGER runtime_executions_no_delete BEFORE DELETE ON runtime_executions BEGIN
  SELECT RAISE(ABORT, 'runtime_executions are append-only');
END;

CREATE TRIGGER approval_lifecycle_no_update BEFORE UPDATE ON approval_lifecycle BEGIN
  SELECT RAISE(ABORT, 'approval_lifecycle is append-only');
END;

CREATE TRIGGER approval_lifecycle_no_delete BEFORE DELETE ON approval_lifecycle BEGIN
  SELECT RAISE(ABORT, 'approval_lifecycle is append-only');
END;

CREATE TRIGGER routine_suggestions_no_update BEFORE UPDATE ON routine_suggestions BEGIN
  SELECT RAISE(ABORT, 'routine_suggestions are append-only');
END;

CREATE TRIGGER routine_suggestions_no_delete BEFORE DELETE ON routine_suggestions BEGIN
  SELECT RAISE(ABORT, 'routine_suggestions are append-only');
END;

CREATE TRIGGER model_calls_no_update BEFORE UPDATE ON model_calls BEGIN
  SELECT RAISE(ABORT, 'model_calls are append-only');
END;

CREATE TRIGGER model_calls_no_delete BEFORE DELETE ON model_calls BEGIN
  SELECT RAISE(ABORT, 'model_calls are append-only');
END;
