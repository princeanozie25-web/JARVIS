import { randomUUID } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { requireConsent, type ConsentGateResult } from "../consent";
import {
  getSessionSummary,
  listMemoryCandidates,
  listSessionSummaries,
  type MemoryCandidateRow,
  type SessionSummaryRow,
} from "../db/node";
import { insertTelemetryEvent } from "../db/telemetry";

export const CURATOR_ACTION_TYPES = [
  "curator_action",
  "curator_merge",
  "curator_split",
  "curator_archive",
  "curator_delete",
] as const;

export const CURATOR_TARGET_TYPES = [
  "summary",
  "candidate",
  "curator_record",
  "mixed",
] as const;

export type CuratorActionType = (typeof CURATOR_ACTION_TYPES)[number];
export type CuratorTargetType = (typeof CURATOR_TARGET_TYPES)[number];
export type CuratorRecordType = "merged_summary" | "manual_note";
export type CuratorRecordStatus = "active" | "archived" | "deleted";
export type CuratorManualAction = "mark_important" | "demote";

export interface CuratorRecordRow {
  id: string;
  record_type: CuratorRecordType;
  title: string;
  content: string;
  source_type: CuratorTargetType;
  source_ids_json: string;
  derived_from_ids_json: string;
  source_session_id: string | null;
  status: CuratorRecordStatus;
  created_at: number;
}

export interface CuratorAuditRow {
  id: string;
  action_type: CuratorActionType;
  target_type: CuratorTargetType;
  target_ids_json: string;
  derived_record_ids_json: string;
  source_session_id: string | null;
  provenance_json: string;
  notes: string;
  created_at: number;
  created_by: "user";
}

export interface CuratorReadModel {
  summaries: SessionSummaryRow[];
  candidates: MemoryCandidateRow[];
  records: CuratorRecordRow[];
  audit: CuratorAuditRow[];
}

export interface CuratorOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
}

export type CuratorBlockedResult = Extract<ConsentGateResult, { ok: false }>;
export type CuratorResult<T> = { ok: true; value: T } | CuratorBlockedResult;

function requireCuratorConsent(
  db: DatabaseType.Database,
  input: CuratorOptions = {},
): ConsentGateResult {
  return requireConsent("conversation_curator", {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 50;
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeIds(ids: string[], label: string): string[] {
  const normalized = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean)),
  );
  if (normalized.length === 0) throw new Error(`${label} is required`);
  return normalized;
}

function jsonString(value: unknown): string {
  return JSON.stringify(value);
}

function sourceSessionIdForSummary(
  db: DatabaseType.Database,
  summaryHash: string,
): string | null {
  return getSessionSummary(db, summaryHash)?.session_id ?? null;
}

function sourceSessionIdForCandidate(
  db: DatabaseType.Database,
  candidateId: string,
): string | null {
  const row = db
    .prepare("SELECT session_id FROM memory_candidates WHERE id = ?")
    .get(candidateId) as { session_id: string } | undefined;
  return row?.session_id ?? null;
}

function sourceSessionIdForTarget(
  db: DatabaseType.Database,
  targetType: CuratorTargetType,
  ids: string[],
): string | null {
  if (targetType === "summary" && ids.length === 1) {
    return sourceSessionIdForSummary(db, ids[0]!);
  }
  if (targetType === "candidate" && ids.length === 1) {
    return sourceSessionIdForCandidate(db, ids[0]!);
  }
  return null;
}

function insertAudit(
  db: DatabaseType.Database,
  input: {
    id?: string;
    actionType: CuratorActionType;
    targetType: CuratorTargetType;
    targetIds: string[];
    derivedRecordIds?: string[];
    sourceSessionId?: string | null;
    provenance: unknown;
    notes: string;
    createdAt: number;
  },
): CuratorAuditRow {
  const row: CuratorAuditRow = {
    id: input.id ?? randomUUID(),
    action_type: input.actionType,
    target_type: input.targetType,
    target_ids_json: jsonString(input.targetIds),
    derived_record_ids_json: jsonString(input.derivedRecordIds ?? []),
    source_session_id: input.sourceSessionId ?? null,
    provenance_json: jsonString(input.provenance),
    notes: input.notes,
    created_at: input.createdAt,
    created_by: "user",
  };

  db.prepare(
    `INSERT INTO curator_audit_records (
       id, action_type, target_type, target_ids_json, derived_record_ids_json,
       source_session_id, provenance_json, notes, created_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.action_type,
    row.target_type,
    row.target_ids_json,
    row.derived_record_ids_json,
    row.source_session_id,
    row.provenance_json,
    row.notes,
    row.created_at,
    row.created_by,
  );

  insertTelemetryEvent(db, {
    timestamp: row.created_at,
    event_type: row.action_type,
    success: true,
    session_id: row.source_session_id ?? undefined,
    notes: `audit_id=${row.id} target_type=${row.target_type} target_ids=${row.target_ids_json} derived_record_ids=${row.derived_record_ids_json}`,
  });

  return row;
}

function insertRecord(
  db: DatabaseType.Database,
  input: {
    id?: string;
    recordType: CuratorRecordType;
    title: string;
    content: string;
    sourceType: CuratorTargetType;
    sourceIds: string[];
    derivedFromIds: string[];
    sourceSessionId?: string | null;
    createdAt: number;
  },
): CuratorRecordRow {
  const row: CuratorRecordRow = {
    id: input.id ?? randomUUID(),
    record_type: input.recordType,
    title: requireTrimmed(input.title, "title"),
    content: requireTrimmed(input.content, "content"),
    source_type: input.sourceType,
    source_ids_json: jsonString(input.sourceIds),
    derived_from_ids_json: jsonString(input.derivedFromIds),
    source_session_id: input.sourceSessionId ?? null,
    status: "active",
    created_at: input.createdAt,
  };

  db.prepare(
    `INSERT INTO curator_records (
       id, record_type, title, content, source_type, source_ids_json,
       derived_from_ids_json, source_session_id, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.record_type,
    row.title,
    row.content,
    row.source_type,
    row.source_ids_json,
    row.derived_from_ids_json,
    row.source_session_id,
    row.status,
    row.created_at,
  );

  return row;
}

export function readCuratorWorkspace(
  db: DatabaseType.Database,
  input: CuratorOptions & { limit?: number } = {},
): CuratorResult<CuratorReadModel> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const limit = normalizeLimit(input.limit);

  return {
    ok: true,
    value: {
      summaries: listSessionSummaries(db, { limit }),
      candidates: listMemoryCandidates(db, { limit }),
      records: listCuratorRecords(db, { limit }),
      audit: listCuratorAuditRecords(db, { limit }),
    },
  };
}

export function listCuratorRecords(
  db: DatabaseType.Database,
  input: { limit?: number } = {},
): CuratorRecordRow[] {
  return db
    .prepare(
      `SELECT *
       FROM curator_records
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(normalizeLimit(input.limit)) as CuratorRecordRow[];
}

export function listCuratorAuditRecords(
  db: DatabaseType.Database,
  input: { limit?: number } = {},
): CuratorAuditRow[] {
  return db
    .prepare(
      `SELECT *
       FROM curator_audit_records
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(normalizeLimit(input.limit)) as CuratorAuditRow[];
}

export function applyCuratorAction(
  db: DatabaseType.Database,
  input: CuratorOptions & {
    action: CuratorManualAction;
    targetType: Exclude<CuratorTargetType, "mixed">;
    targetId: string;
    auditId?: string;
  },
): CuratorResult<CuratorAuditRow> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const at = input.now?.() ?? Date.now();
  const targetId = requireTrimmed(input.targetId, "targetId");

  return {
    ok: true,
    value: insertAudit(db, {
      id: input.auditId,
      actionType: "curator_action",
      targetType: input.targetType,
      targetIds: [targetId],
      sourceSessionId: sourceSessionIdForTarget(db, input.targetType, [
        targetId,
      ]),
      provenance: {
        manual_action: input.action,
        original_ids_preserved: true,
      },
      notes: `manual curation: ${input.action}`,
      createdAt: at,
    }),
  };
}

export function archiveCuratorTarget(
  db: DatabaseType.Database,
  input: CuratorOptions & {
    targetType: Exclude<CuratorTargetType, "mixed">;
    targetId: string;
    auditId?: string;
  },
): CuratorResult<CuratorAuditRow> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const at = input.now?.() ?? Date.now();
  const targetId = requireTrimmed(input.targetId, "targetId");
  if (input.targetType === "curator_record") {
    db.prepare(
      "UPDATE curator_records SET status = 'archived' WHERE id = ?",
    ).run(targetId);
  }

  return {
    ok: true,
    value: insertAudit(db, {
      id: input.auditId,
      actionType: "curator_archive",
      targetType: input.targetType,
      targetIds: [targetId],
      sourceSessionId: sourceSessionIdForTarget(db, input.targetType, [
        targetId,
      ]),
      provenance: {
        archive_mode:
          input.targetType === "curator_record"
            ? "derived_record_status_update"
            : "audit_only_source_preserved",
        original_ids_preserved: true,
      },
      notes: "manual curation: archive",
      createdAt: at,
    }),
  };
}

export function safeDeleteCuratorTarget(
  db: DatabaseType.Database,
  input: CuratorOptions & {
    targetType: Exclude<CuratorTargetType, "mixed">;
    targetId: string;
    auditId?: string;
  },
): CuratorResult<CuratorAuditRow> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const at = input.now?.() ?? Date.now();
  const targetId = requireTrimmed(input.targetId, "targetId");
  if (input.targetType === "curator_record") {
    db.prepare(
      "UPDATE curator_records SET status = 'deleted' WHERE id = ?",
    ).run(targetId);
  }

  return {
    ok: true,
    value: insertAudit(db, {
      id: input.auditId,
      actionType: "curator_delete",
      targetType: input.targetType,
      targetIds: [targetId],
      sourceSessionId: sourceSessionIdForTarget(db, input.targetType, [
        targetId,
      ]),
      provenance: {
        delete_mode:
          input.targetType === "curator_record"
            ? "derived_record_tombstone"
            : "audit_tombstone_no_source_delete",
        original_ids_preserved: true,
      },
      notes: "manual curation: safe delete tombstone",
      createdAt: at,
    }),
  };
}

export function mergeSummaries(
  db: DatabaseType.Database,
  input: CuratorOptions & {
    summaryHashes: string[];
    title: string;
    mergedText: string;
    recordId?: string;
    auditId?: string;
  },
): CuratorResult<{ record: CuratorRecordRow; audit: CuratorAuditRow }> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const at = input.now?.() ?? Date.now();
  const sourceIds = normalizeIds(input.summaryHashes, "summaryHashes");
  const summaries = sourceIds
    .map((id) => getSessionSummary(db, id))
    .filter((row): row is SessionSummaryRow => row !== undefined);
  const sourceSessionId =
    summaries.length === 1 ? summaries[0]!.session_id : null;

  const record = insertRecord(db, {
    id: input.recordId,
    recordType: "merged_summary",
    title: input.title,
    content: input.mergedText,
    sourceType: "summary",
    sourceIds,
    derivedFromIds: sourceIds,
    sourceSessionId,
    createdAt: at,
  });
  const audit = insertAudit(db, {
    id: input.auditId,
    actionType: "curator_merge",
    targetType: "summary",
    targetIds: sourceIds,
    derivedRecordIds: [record.id],
    sourceSessionId,
    provenance: {
      derived_from_ids: sourceIds,
      original_ids_preserved: true,
      source_count: sourceIds.length,
    },
    notes: "manual curation: merge summaries",
    createdAt: at,
  });

  return { ok: true, value: { record, audit } };
}

export function splitSummaryIntoManualNotes(
  db: DatabaseType.Database,
  input: CuratorOptions & {
    summaryHash: string;
    notes: Array<{ title: string; content: string; id?: string }>;
    auditId?: string;
  },
): CuratorResult<{ records: CuratorRecordRow[]; audit: CuratorAuditRow }> {
  const gate = requireCuratorConsent(db, input);
  if (!gate.ok) return gate;
  const at = input.now?.() ?? Date.now();
  const summaryHash = requireTrimmed(input.summaryHash, "summaryHash");
  if (input.notes.length === 0) throw new Error("notes are required");
  const sourceSessionId = sourceSessionIdForSummary(db, summaryHash);
  const records = input.notes.map((note) =>
    insertRecord(db, {
      id: note.id,
      recordType: "manual_note",
      title: note.title,
      content: note.content,
      sourceType: "summary",
      sourceIds: [summaryHash],
      derivedFromIds: [summaryHash],
      sourceSessionId,
      createdAt: at,
    }),
  );
  const audit = insertAudit(db, {
    id: input.auditId,
    actionType: "curator_split",
    targetType: "summary",
    targetIds: [summaryHash],
    derivedRecordIds: records.map((record) => record.id),
    sourceSessionId,
    provenance: {
      derived_from_ids: [summaryHash],
      original_ids_preserved: true,
      note_count: records.length,
    },
    notes: "manual curation: split summary into manual notes",
    createdAt: at,
  });

  return { ok: true, value: { records, audit } };
}
