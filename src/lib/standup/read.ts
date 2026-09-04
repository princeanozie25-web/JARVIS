import type DatabaseType from "better-sqlite3";

// Program U.5 (E-032) — Standup's READ. Brief §4 "Today (U)": audit +
// telemetry events rendered as agent messages, grouped by task. The
// telemetry_events table is scalar-only (I2); we still allowlist the fields
// we render and never surface model ids (brief §5: agents have names, models
// do not — on the home surface). Provenance rides every thread.

export type StandupProvenance = "live" | "empty" | "unreachable";

export type StandupVoice = "system" | "agent";

export interface StandupMessage {
  readonly id: string;
  readonly at: number;
  readonly voice: StandupVoice;
  /** The speaking agent's name (tool_name) or "JARVIS". */
  readonly from: string;
  readonly event_type: string;
  readonly success: boolean;
  /** Bounded metadata note (never a prompt/body). */
  readonly note: string | null;
  readonly cost_usd: number | null;
  readonly latency_ms: number | null;
  readonly metadata_only: true;
}

export interface StandupThread {
  readonly id: string;
  readonly task: string;
  readonly state: "working" | "waiting" | "done";
  readonly messages: readonly StandupMessage[];
  readonly cost_usd: number;
  readonly provenance: "live";
}

export interface StandupRead {
  readonly threads: readonly StandupThread[];
  readonly provenance: StandupProvenance;
}

interface TelemetryRowLite {
  id: number;
  timestamp: number;
  event_type: string;
  success: number;
  tool_name: string | null;
  execution_id: string | null;
  cost_usd: number | null;
  latency_ms: number | null;
  notes: string | null;
}

const WAITING = new Set(["tool_proposed", "confirmation_required"]);
const DONE = new Set([
  "tool_completed",
  "tool_denied",
  "tool_cancelled",
  "tool_timeout",
  "tool_rolled_back",
]);

function boundedNote(notes: string | null): string | null {
  if (!notes) return null;
  // metadata lines look like `key=value key=value`; keep them short
  return notes.replace(/\s+/g, " ").slice(0, 160);
}

export function readStandup(
  db: DatabaseType.Database,
  limit: number = 120,
): StandupRead {
  let rows: TelemetryRowLite[];
  try {
    rows = db
      .prepare(
        `SELECT id, timestamp, event_type, success, tool_name, execution_id,
                cost_usd, latency_ms, notes
         FROM telemetry_events
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(limit) as TelemetryRowLite[];
  } catch {
    return { threads: [], provenance: "unreachable" };
  }
  if (rows.length === 0) return { threads: [], provenance: "empty" };

  const byThread = new Map<string, TelemetryRowLite[]>();
  for (const row of rows) {
    const key = row.execution_id ?? `event:${row.event_type}`;
    const list = byThread.get(key) ?? [];
    list.push(row);
    byThread.set(key, list);
  }

  const threads: StandupThread[] = [];
  for (const [key, list] of byThread) {
    const ordered = [...list].sort((a, b) => a.id - b.id);
    const messages: StandupMessage[] = ordered.map((row) => ({
      id: `tel:${row.id}`,
      at: row.timestamp,
      voice: row.tool_name ? "agent" : "system",
      from: row.tool_name ?? "JARVIS",
      event_type: row.event_type,
      success: row.success === 1,
      note: boundedNote(row.notes),
      cost_usd: row.cost_usd,
      latency_ms: row.latency_ms,
      metadata_only: true,
    }));
    const last = ordered[ordered.length - 1];
    const state = DONE.has(last.event_type)
      ? "done"
      : WAITING.has(last.event_type)
        ? "waiting"
        : "working";
    threads.push({
      id: key,
      task: ordered.find((r) => r.tool_name)?.tool_name ?? key.replace(/^event:/, ""),
      state,
      messages,
      cost_usd: ordered.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0),
      provenance: "live",
    });
  }
  // newest thread first (by its last message)
  threads.sort(
    (a, b) => b.messages[b.messages.length - 1].at - a.messages[a.messages.length - 1].at,
  );
  return { threads, provenance: "live" };
}
