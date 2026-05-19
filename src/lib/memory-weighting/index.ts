import type DatabaseType from "better-sqlite3";
import { requireConsent, type ConsentGateResult } from "../consent";
import type { MemoryCandidateRow } from "../db/memory-candidates";
import type { LongTermMemoryRow } from "../memory/types";
import { insertTelemetryEvent } from "../db/telemetry";

export type MemoryWeightingItemType = "long_term_memory" | "memory_candidate";

export interface MemoryWeightingInput {
  itemType?: MemoryWeightingItemType;
  limit?: number;
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
}

export interface MemoryWeightingProjection {
  item_id: string;
  item_type: MemoryWeightingItemType;
  base_score: number;
  recency_score: number;
  pin_score: number;
  usage_score: number;
  final_weight: number;
  explanation: string;
}

export type MemoryWeightingResult =
  | { ok: true; weights: MemoryWeightingProjection[] }
  | Extract<ConsentGateResult, { ok: false }>;

interface SourceItem {
  id: string;
  itemType: MemoryWeightingItemType;
  timestamp: number;
  pinned: boolean;
}

const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
const LONG_TERM_BASE_SCORE = 1;
const CANDIDATE_BASE_SCORE = 0.75;
const PIN_SCORE = 1;
const USAGE_SCORE_STEP = 0.1;
const MAX_USAGE_SCORE = 1;

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function roundScore(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pinnedFlag(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const record = row as Record<string, unknown>;
  return record.pinned === true || record.pin === true;
}

function recencyScore(timestamp: number, now: number): number {
  if (timestamp >= now) return 1;
  const age = Math.max(now - timestamp, 0);
  return roundScore(Math.max(0, 1 - age / RECENCY_WINDOW_MS));
}

function usageScore(count: number): number {
  return roundScore(Math.min(count * USAGE_SCORE_STEP, MAX_USAGE_SCORE));
}

function finalWeight(input: {
  baseScore: number;
  recency: number;
  pin: number;
  usage: number;
}): number {
  return roundScore(input.baseScore + input.recency + input.pin + input.usage);
}

function listLongTermItems(
  db: DatabaseType.Database,
  limit: number,
): SourceItem[] {
  const rows = db
    .prepare(
      `SELECT *
       FROM long_term_memory
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    )
    .all(limit) as LongTermMemoryRow[];

  return rows.map((row) => ({
    id: row.id,
    itemType: "long_term_memory",
    timestamp: row.updated_at,
    pinned: pinnedFlag(row),
  }));
}

function listCandidateItems(
  db: DatabaseType.Database,
  limit: number,
): SourceItem[] {
  const rows = db
    .prepare(
      `SELECT *
       FROM memory_candidates
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as MemoryCandidateRow[];

  return rows.map((row) => ({
    id: row.id,
    itemType: "memory_candidate",
    timestamp: row.reviewed_at ?? row.created_at,
    pinned: pinnedFlag(row),
  }));
}

function parseResultIds(notes: string | null): string[] {
  if (!notes) return [];
  const match = notes.match(/result_ids=(\[[^\]]*\])/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function usageCounts(db: DatabaseType.Database): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT notes
       FROM telemetry_events
       WHERE event_type IN ('memory_read', 'memory_surfaced')`,
    )
    .all() as Array<{ notes: string | null }>;
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const id of parseResultIds(row.notes)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function projectWeight(
  item: SourceItem,
  input: { now: number; usageCount: number },
): MemoryWeightingProjection {
  const baseScore =
    item.itemType === "long_term_memory"
      ? LONG_TERM_BASE_SCORE
      : CANDIDATE_BASE_SCORE;
  const recency = recencyScore(item.timestamp, input.now);
  const pin = item.pinned ? PIN_SCORE : 0;
  const usage = usageScore(input.usageCount);
  const final = finalWeight({
    baseScore,
    recency,
    pin,
    usage,
  });

  return {
    item_id: item.id,
    item_type: item.itemType,
    base_score: baseScore,
    recency_score: recency,
    pin_score: pin,
    usage_score: usage,
    final_weight: final,
    explanation: `preview only / not applied to retrieval; base=${baseScore} recency=${recency} pinned=${item.pinned ? "true" : "false"} usage_count=${input.usageCount}`,
  };
}

export function readPassiveMemoryWeighting(
  db: DatabaseType.Database,
  input: MemoryWeightingInput = {},
): MemoryWeightingResult {
  const gate = requireConsent("memory_weighting", {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
  if (!gate.ok) return gate;

  const limit = normalizeLimit(input.limit);
  const now = input.now?.() ?? Date.now();
  const items: SourceItem[] = [];

  if (!input.itemType || input.itemType === "long_term_memory") {
    items.push(...listLongTermItems(db, limit));
  }
  if (!input.itemType || input.itemType === "memory_candidate") {
    items.push(...listCandidateItems(db, limit));
  }

  const counts = usageCounts(db);
  const weights = items
    .map((item) =>
      projectWeight(item, {
        now,
        usageCount: counts.get(item.id) ?? 0,
      }),
    )
    .sort((left, right) => {
      const weightDelta = right.final_weight - left.final_weight;
      if (weightDelta !== 0) return weightDelta;
      return left.item_id.localeCompare(right.item_id);
    })
    .slice(0, limit);

  insertTelemetryEvent(db, {
    timestamp: now,
    event_type: "memory_weighting_projected",
    success: true,
    notes: `rows=${weights.length}`,
  });
  insertTelemetryEvent(db, {
    timestamp: now,
    event_type: "memory_weighting_read",
    success: true,
    notes: `rows=${weights.length}`,
  });

  return { ok: true, weights };
}
