import type DatabaseType from "better-sqlite3";
import { requireConsent, type ConsentGateResult } from "../consent";
import { readConsentManifest } from "../consent/manifest";
import { listCuratorAuditRecords, type CuratorAuditRow } from "../curator";
import {
  listMemoryCandidates,
  type MemoryCandidateRow,
} from "../db/memory-candidates";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  readPassiveMemoryWeighting,
  type MemoryWeightingProjection,
} from "../memory-weighting";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
  requireRuntimeWriteAllowed,
  type RuntimeWriteContext,
} from "../personal-context";

export const HUMAN_REVIEW_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "dismissed",
] as const;

export const HUMAN_REVIEW_SOURCE_TYPES = [
  "memory_candidate",
  "curator_audit",
  "goal",
  "memory_weighting",
] as const;

export type HumanReviewStatus = (typeof HUMAN_REVIEW_STATUSES)[number];
export type HumanReviewSourceType = (typeof HUMAN_REVIEW_SOURCE_TYPES)[number];

export interface HumanReviewQueueRow {
  id: string;
  source_id: string;
  source_type: HumanReviewSourceType;
  status: HumanReviewStatus;
  decision_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface HumanReviewItem {
  id: string;
  item_type: HumanReviewSourceType;
  title: string;
  summary: string;
  source_id: string;
  source_type: HumanReviewSourceType;
  status: HumanReviewStatus;
  created_at: number;
  updated_at: number;
  provenance: Record<string, unknown>;
  decision_reason?: string | null;
}

export interface HumanReviewOptions {
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  accessContext?: PersonalContextAccessContext;
  writeContext?: RuntimeWriteContext;
}

export interface ListReviewItemsInput extends HumanReviewOptions {
  status?: HumanReviewStatus;
  limit?: number;
}

export interface UpdateReviewItemStatusInput extends HumanReviewOptions {
  id: string;
  status: HumanReviewStatus;
  decisionReason?: string | null;
}

export interface DismissReviewItemInput extends HumanReviewOptions {
  id: string;
  decisionReason?: string | null;
}

export type HumanReviewBlockedResult = Extract<
  ConsentGateResult,
  { ok: false }
>;
export type HumanReviewResult<T> =
  | { ok: true; value: T }
  | HumanReviewBlockedResult;

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function requireHumanReviewConsent(
  db: DatabaseType.Database,
  input: HumanReviewOptions = {},
): ConsentGateResult {
  return requireConsent("human_review_queue", {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
}

function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sourceKey(
  sourceType: HumanReviewSourceType,
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

function sourceFromId(id: string): {
  sourceType: HumanReviewSourceType;
  sourceId: string;
} {
  const [sourceType, ...rest] = id.split(":");
  const sourceId = rest.join(":").trim();
  if (
    !HUMAN_REVIEW_SOURCE_TYPES.includes(sourceType as HumanReviewSourceType) ||
    !sourceId
  ) {
    throw new Error("review item id must be source_type:source_id");
  }
  return {
    sourceType: sourceType as HumanReviewSourceType,
    sourceId,
  };
}

function loadQueueRows(
  db: DatabaseType.Database,
  limit: number,
): Map<string, HumanReviewQueueRow> {
  const rows = db
    .prepare(
      `SELECT *
       FROM human_review_queue
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as HumanReviewQueueRow[];
  return new Map(
    rows.map((row) => [sourceKey(row.source_type, row.source_id), row]),
  );
}

function itemWithQueueState(
  base: Omit<HumanReviewItem, "status" | "updated_at" | "decision_reason">,
  queueRows: Map<string, HumanReviewQueueRow>,
): HumanReviewItem {
  const queue = queueRows.get(sourceKey(base.source_type, base.source_id));
  return {
    ...base,
    status: queue?.status ?? "pending",
    updated_at: queue?.updated_at ?? base.created_at,
    decision_reason: queue?.decision_reason ?? null,
  };
}

function memoryCandidateItem(
  candidate: MemoryCandidateRow,
  queueRows: Map<string, HumanReviewQueueRow>,
): HumanReviewItem {
  return itemWithQueueState(
    {
      id: sourceKey("memory_candidate", candidate.id),
      item_type: "memory_candidate",
      title: `Memory candidate: ${candidate.proposed_category}`,
      summary: candidate.proposed_content,
      source_id: candidate.id,
      source_type: "memory_candidate",
      created_at: candidate.created_at,
      provenance: {
        session_id: candidate.session_id,
        source_message_ids: parseJsonList(candidate.source_message_ids_json),
        proposed_tags: parseJsonList(candidate.proposed_tags_json),
        proposed_sensitivity: candidate.proposed_sensitivity,
        rationale: candidate.rationale,
        source_status: candidate.status,
      },
    },
    queueRows,
  );
}

function curatorAuditItem(
  audit: CuratorAuditRow,
  queueRows: Map<string, HumanReviewQueueRow>,
): HumanReviewItem {
  return itemWithQueueState(
    {
      id: sourceKey("curator_audit", audit.id),
      item_type: "curator_audit",
      title: `Curator action: ${audit.action_type}`,
      summary: audit.notes,
      source_id: audit.id,
      source_type: "curator_audit",
      created_at: audit.created_at,
      provenance: {
        source_session_id: audit.source_session_id,
        target_type: audit.target_type,
        target_ids: parseJsonList(audit.target_ids_json),
        derived_record_ids: parseJsonList(audit.derived_record_ids_json),
        audit_provenance: parseJsonObject(audit.provenance_json),
        created_by: audit.created_by,
      },
    },
    queueRows,
  );
}

function weightingItem(
  projection: MemoryWeightingProjection,
  queueRows: Map<string, HumanReviewQueueRow>,
  createdAt: number,
): HumanReviewItem {
  const sourceId = `${projection.item_type}:${projection.item_id}`;
  return itemWithQueueState(
    {
      id: sourceKey("memory_weighting", sourceId),
      item_type: "memory_weighting",
      title: `Memory weighting preview: ${projection.item_type}`,
      summary: projection.explanation,
      source_id: sourceId,
      source_type: "memory_weighting",
      created_at: createdAt,
      provenance: {
        item_id: projection.item_id,
        item_type: projection.item_type,
        base_score: projection.base_score,
        recency_score: projection.recency_score,
        pin_score: projection.pin_score,
        usage_score: projection.usage_score,
        final_weight: projection.final_weight,
        preview_only: true,
      },
    },
    queueRows,
  );
}

function memoryWeightingEnabled(
  db: DatabaseType.Database,
  input: HumanReviewOptions,
): boolean {
  const manifest = readConsentManifest({
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
  return (
    manifest.records.find((record) => record.feature_id === "memory_weighting")
      ?.enabled ?? false
  );
}

export function listReviewItems(
  db: DatabaseType.Database,
  input: ListReviewItemsInput = {},
): HumanReviewResult<HumanReviewItem[]> {
  const gate = requirePersonalContextAccess(
    db,
    "human_review_queue",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;

  const limit = normalizeLimit(input.limit);
  const queueRows = loadQueueRows(db, limit);
  const items: HumanReviewItem[] = [
    ...listMemoryCandidates(db, { status: "draft", limit }).map((candidate) =>
      memoryCandidateItem(candidate, queueRows),
    ),
    ...listCuratorAuditRecords(db, { limit }).map((audit) =>
      curatorAuditItem(audit, queueRows),
    ),
  ];

  if (memoryWeightingEnabled(db, input)) {
    const weighting = readPassiveMemoryWeighting(db, {
      manifestPath: input.manifestPath,
      env: input.env,
      now: input.now,
      limit: Math.min(limit, 20),
    });
    if (weighting.ok) {
      items.push(
        ...weighting.weights.map((projection) =>
          weightingItem(projection, queueRows, input.now?.() ?? Date.now()),
        ),
      );
    }
  }

  const filtered = input.status
    ? items.filter((item) => item.status === input.status)
    : items;
  const value = filtered
    .sort((left, right) => {
      const timeDelta = right.updated_at - left.updated_at;
      if (timeDelta !== 0) return timeDelta;
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);

  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "review_queue_read",
    success: true,
    notes: `rows=${value.length}`,
  });

  return { ok: true, value };
}

function upsertReviewStatus(
  db: DatabaseType.Database,
  input: UpdateReviewItemStatusInput,
): HumanReviewQueueRow {
  const { sourceType, sourceId } = sourceFromId(input.id);
  const at = input.now?.() ?? Date.now();
  const existing = db
    .prepare("SELECT * FROM human_review_queue WHERE id = ?")
    .get(input.id) as HumanReviewQueueRow | undefined;

  const row: HumanReviewQueueRow = {
    id: input.id,
    source_id: sourceId,
    source_type: sourceType,
    status: input.status,
    decision_reason: input.decisionReason?.trim() || null,
    created_at: existing?.created_at ?? at,
    updated_at: at,
  };

  db.prepare(
    `INSERT INTO human_review_queue (
       id, source_id, source_type, status, decision_reason, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_id, source_type) DO UPDATE SET
       status = excluded.status,
       decision_reason = excluded.decision_reason,
       updated_at = excluded.updated_at`,
  ).run(
    row.id,
    row.source_id,
    row.source_type,
    row.status,
    row.decision_reason,
    row.created_at,
    row.updated_at,
  );

  return db
    .prepare(
      "SELECT * FROM human_review_queue WHERE source_id = ? AND source_type = ?",
    )
    .get(row.source_id, row.source_type) as HumanReviewQueueRow;
}

export function updateReviewItemStatus(
  db: DatabaseType.Database,
  input: UpdateReviewItemStatusInput,
): HumanReviewResult<HumanReviewQueueRow> {
  requireRuntimeWriteAllowed(
    db,
    "human_review_queue",
    input.writeContext,
    input,
  );

  const gate = requireHumanReviewConsent(db, input);
  if (!gate.ok) return gate;
  const row = upsertReviewStatus(db, input);
  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "review_item_updated",
    success: true,
    notes: `review_item_id=${row.id} status=${row.status} source_type=${row.source_type}`,
  });
  return { ok: true, value: row };
}

export function dismissReviewItem(
  db: DatabaseType.Database,
  input: DismissReviewItemInput,
): HumanReviewResult<HumanReviewQueueRow> {
  requireRuntimeWriteAllowed(
    db,
    "human_review_queue",
    input.writeContext,
    input,
  );

  const gate = requireHumanReviewConsent(db, input);
  if (!gate.ok) return gate;
  const row = upsertReviewStatus(db, {
    ...input,
    status: "dismissed",
  });
  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "review_item_dismissed",
    success: true,
    notes: `review_item_id=${row.id} source_type=${row.source_type}`,
  });
  return { ok: true, value: row };
}
