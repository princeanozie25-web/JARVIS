import type DatabaseType from "better-sqlite3";
import type { TelemetryEvent } from "../telemetry";

export interface TelemetryRow {
  id: number;
  timestamp: number;
  session_id: string | null;
  event_type: string;
  success: number;
  intent: string | null;
  safety_tag: string | null;
  tier: string | null;
  model_id: string | null;
  tool_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  time_to_first_token_ms: number | null;
  cost_usd: number | null;
  error_class: string | null;
  user_rating: number | null;
  notes: string | null;
}

export function insertTelemetryEvent(
  db: DatabaseType.Database,
  event: TelemetryEvent,
): void {
  db.prepare(
    `INSERT INTO telemetry_events (
       timestamp, session_id, event_type, success, intent, safety_tag, tier,
       model_id, tool_name, input_tokens, output_tokens, latency_ms,
       time_to_first_token_ms, cost_usd, error_class, user_rating, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.timestamp,
    event.session_id ?? null,
    event.event_type,
    event.success ? 1 : 0,
    event.intent ?? null,
    event.safety_tag ?? null,
    event.tier ?? null,
    event.model_id ?? null,
    event.tool_name ?? null,
    event.input_tokens ?? null,
    event.output_tokens ?? null,
    event.latency_ms ?? null,
    event.time_to_first_token_ms ?? null,
    event.cost_usd ?? null,
    event.error_class ?? null,
    event.user_rating ?? null,
    event.notes ?? null,
  );
}

export function listTelemetryEvents(
  db: DatabaseType.Database,
  limit: number = 200,
): TelemetryRow[] {
  return db
    .prepare(`SELECT * FROM telemetry_events ORDER BY id DESC LIMIT ?`)
    .all(limit) as TelemetryRow[];
}
