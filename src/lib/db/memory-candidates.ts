import type DatabaseType from "better-sqlite3";
import type {
  LongTermMemoryCategory,
  MemorySensitivity,
} from "../memory/types";
import { insertTelemetryEvent } from "./telemetry";

export const MEMORY_CANDIDATE_STATUSES = [
  "draft",
  "accepted",
  "rejected",
  "edited",
] as const;

export type MemoryCandidateStatus = (typeof MEMORY_CANDIDATE_STATUSES)[number];

export interface MemoryCandidateRow {
  id: string;
  session_id: string;
  source_message_ids_json: string;
  proposed_category: LongTermMemoryCategory;
  proposed_content: string;
  proposed_tags_json: string;
  proposed_sensitivity: MemorySensitivity;
  rationale: string;
  status: MemoryCandidateStatus;
  created_at: number;
  reviewed_at: number | null;
}

export interface CreateMemoryCandidateInput {
  id: string;
  sessionId: string;
  sourceMessageIds: string[];
  proposedCategory: LongTermMemoryCategory;
  proposedContent: string;
  proposedTags: string[];
  proposedSensitivity: MemorySensitivity;
  rationale: string;
  createdAt?: number;
  now?: () => number;
}

export interface ListMemoryCandidatesInput {
  sessionId?: string;
  status?: MemoryCandidateStatus;
  limit?: number;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function createMemoryCandidate(
  db: DatabaseType.Database,
  input: CreateMemoryCandidateInput,
): MemoryCandidateRow {
  const createdAt = input.createdAt ?? input.now?.() ?? Date.now();
  const row: MemoryCandidateRow = {
    id: requireTrimmed(input.id, "id"),
    session_id: requireTrimmed(input.sessionId, "sessionId"),
    source_message_ids_json: JSON.stringify(
      normalizeStringList(input.sourceMessageIds),
    ),
    proposed_category: input.proposedCategory,
    proposed_content: requireTrimmed(input.proposedContent, "proposedContent"),
    proposed_tags_json: JSON.stringify(normalizeStringList(input.proposedTags)),
    proposed_sensitivity: input.proposedSensitivity,
    rationale: requireTrimmed(input.rationale, "rationale"),
    status: "draft",
    created_at: createdAt,
    reviewed_at: null,
  };

  db.prepare(
    `INSERT INTO memory_candidates (
       id, session_id, source_message_ids_json, proposed_category,
       proposed_content, proposed_tags_json, proposed_sensitivity,
       rationale, status, created_at, reviewed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.session_id,
    row.source_message_ids_json,
    row.proposed_category,
    row.proposed_content,
    row.proposed_tags_json,
    row.proposed_sensitivity,
    row.rationale,
    row.status,
    row.created_at,
    row.reviewed_at,
  );

  insertTelemetryEvent(db, {
    timestamp: createdAt,
    event_type: "memory_candidate_generated",
    success: true,
    session_id: row.session_id,
    notes: `candidate_id=${row.id} category=${row.proposed_category} sensitivity=${row.proposed_sensitivity}`,
  });

  return row;
}

export function listMemoryCandidates(
  db: DatabaseType.Database,
  input: ListMemoryCandidatesInput = {},
): MemoryCandidateRow[] {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 500);
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.sessionId?.trim()) {
    where.push("session_id = ?");
    params.push(input.sessionId.trim());
  }
  if (input.status) {
    where.push("status = ?");
    params.push(input.status);
  }

  params.push(limit);
  return db
    .prepare(
      `SELECT *
       FROM memory_candidates
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(...params) as MemoryCandidateRow[];
}

export function updateMemoryCandidateStatus(
  db: DatabaseType.Database,
  id: string,
  status: MemoryCandidateStatus,
  input: { reviewedAt?: number; now?: () => number } = {},
): MemoryCandidateRow | undefined {
  const reviewedAt = input.reviewedAt ?? input.now?.() ?? Date.now();
  db.prepare(
    `UPDATE memory_candidates
     SET status = ?, reviewed_at = ?
     WHERE id = ?`,
  ).run(status, reviewedAt, id);

  const row = db
    .prepare("SELECT * FROM memory_candidates WHERE id = ?")
    .get(id) as MemoryCandidateRow | undefined;
  if (!row) return undefined;

  insertTelemetryEvent(db, {
    timestamp: reviewedAt,
    event_type: "memory_candidate_reviewed",
    success: true,
    session_id: row.session_id,
    notes: `candidate_id=${row.id} status=${row.status}`,
  });
  if (status === "rejected") {
    insertTelemetryEvent(db, {
      timestamp: reviewedAt,
      event_type: "memory_candidate_rejected",
      success: true,
      session_id: row.session_id,
      notes: `candidate_id=${row.id}`,
    });
  }

  return row;
}
