import { createHash } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "./telemetry";

export interface SessionSummaryRow {
  session_id: string;
  summary_text: string;
  previous_summary_hash: string | null;
  summary_hash: string;
  covered_message_count: number;
  created_at: number;
  updated_at: number;
}

export interface CreateSessionSummaryInput {
  sessionId: string;
  summaryText: string;
  previousSummaryHash?: string | null;
  coveredMessageCount: number;
  createdAt: number;
  updatedAt?: number;
  summaryHash?: string;
}

export interface UpdateSessionSummaryInput {
  summaryText?: string;
  coveredMessageCount?: number;
  updatedAt: number;
  summaryHash?: string;
}

export interface SaveSessionSummaryInput {
  sessionId: string;
  summaryText: string;
  coveredMessageCount: number;
  now?: () => number;
}

export function computeSessionSummaryHash(input: {
  sessionId: string;
  summaryText: string;
  previousSummaryHash?: string | null;
  coveredMessageCount: number;
}): string {
  const canonical = JSON.stringify({
    session_id: input.sessionId,
    summary_text: input.summaryText,
    previous_summary_hash: input.previousSummaryHash ?? null,
    covered_message_count: input.coveredMessageCount,
  });
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function rowFromInput(input: CreateSessionSummaryInput): SessionSummaryRow {
  const previousSummaryHash = input.previousSummaryHash ?? null;
  return {
    session_id: input.sessionId,
    summary_text: input.summaryText,
    previous_summary_hash: previousSummaryHash,
    summary_hash:
      input.summaryHash ??
      computeSessionSummaryHash({
        sessionId: input.sessionId,
        summaryText: input.summaryText,
        previousSummaryHash,
        coveredMessageCount: input.coveredMessageCount,
      }),
    covered_message_count: input.coveredMessageCount,
    created_at: input.createdAt,
    updated_at: input.updatedAt ?? input.createdAt,
  };
}

export function createSessionSummary(
  db: DatabaseType.Database,
  input: CreateSessionSummaryInput,
): SessionSummaryRow {
  const row = rowFromInput(input);
  db.prepare(
    `INSERT INTO session_summaries (
       session_id, summary_text, previous_summary_hash, summary_hash,
       covered_message_count, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.session_id,
    row.summary_text,
    row.previous_summary_hash,
    row.summary_hash,
    row.covered_message_count,
    row.created_at,
    row.updated_at,
  );
  return row;
}

export function getSessionSummary(
  db: DatabaseType.Database,
  summaryHash: string,
): SessionSummaryRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM session_summaries
       WHERE summary_hash = ?`,
    )
    .get(summaryHash) as SessionSummaryRow | undefined;
}

export function getLatestSessionSummary(
  db: DatabaseType.Database,
  sessionId: string,
): SessionSummaryRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM session_summaries
       WHERE session_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    )
    .get(sessionId) as SessionSummaryRow | undefined;
}

export function listSessionSummaries(
  db: DatabaseType.Database,
  input: { sessionId?: string; limit?: number } = {},
): SessionSummaryRow[] {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 500);
  if (input.sessionId) {
    return db
      .prepare(
        `SELECT *
         FROM session_summaries
         WHERE session_id = ?
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ?`,
      )
      .all(input.sessionId, limit) as SessionSummaryRow[];
  }

  return db
    .prepare(
      `SELECT *
       FROM session_summaries
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    )
    .all(limit) as SessionSummaryRow[];
}

export function updateSessionSummary(
  db: DatabaseType.Database,
  summaryHash: string,
  input: UpdateSessionSummaryInput,
): SessionSummaryRow | undefined {
  const current = getSessionSummary(db, summaryHash);
  if (!current) return undefined;
  const summaryText = input.summaryText ?? current.summary_text;
  const coveredMessageCount =
    input.coveredMessageCount ?? current.covered_message_count;
  const nextSummaryHash =
    input.summaryHash ??
    computeSessionSummaryHash({
      sessionId: current.session_id,
      summaryText,
      previousSummaryHash: current.previous_summary_hash,
      coveredMessageCount,
    });

  db.prepare(
    `UPDATE session_summaries
     SET summary_text = ?,
         summary_hash = ?,
         covered_message_count = ?,
         updated_at = ?
     WHERE summary_hash = ?`,
  ).run(
    summaryText,
    nextSummaryHash,
    coveredMessageCount,
    input.updatedAt,
    summaryHash,
  );

  return getSessionSummary(db, nextSummaryHash);
}

export function deleteSessionSummary(
  db: DatabaseType.Database,
  summaryHash: string,
): boolean {
  const result = db
    .prepare("DELETE FROM session_summaries WHERE summary_hash = ?")
    .run(summaryHash);
  return result.changes > 0;
}

export function saveSessionSummary(
  db: DatabaseType.Database,
  input: SaveSessionSummaryInput,
): SessionSummaryRow {
  const at = input.now?.() ?? Date.now();
  const previous = getLatestSessionSummary(db, input.sessionId);
  const row = createSessionSummary(db, {
    sessionId: input.sessionId,
    summaryText: input.summaryText,
    previousSummaryHash: previous?.summary_hash ?? null,
    coveredMessageCount: input.coveredMessageCount,
    createdAt: at,
    updatedAt: at,
  });

  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "session_summary_saved",
    success: true,
    session_id: input.sessionId,
    notes: `summary_hash=${row.summary_hash} previous_summary_hash=${row.previous_summary_hash ?? "none"} covered_message_count=${row.covered_message_count}`,
  });

  return row;
}
