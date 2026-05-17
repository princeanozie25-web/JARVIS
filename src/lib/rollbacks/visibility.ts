import type { RollbackRow } from "../db/rollbacks";
import { isProtectedPath } from "../tools/fs-safe-path";
import { ROLLBACK_TTL_MS } from "../tools/fs-undo";

export type RollbackExpiryStatus = "available" | "applied" | "expired";

export interface RollbackSummary {
  id: string;
  kind: RollbackRow["kind"];
  created_at: number;
  applied_at: number | null;
  expires_at: number;
  expiry_status: RollbackExpiryStatus;
  available: boolean;
  path_summary: string;
  source_tool_call_id: string;
}

interface RollbackPayload {
  path?: unknown;
}

export function summarizeRollback(
  row: RollbackRow,
  now: number = Date.now(),
): RollbackSummary {
  const expiresAt = row.created_at + ROLLBACK_TTL_MS;
  const expiryStatus: RollbackExpiryStatus =
    row.applied_at !== null
      ? "applied"
      : expiresAt <= now
        ? "expired"
        : "available";

  return {
    id: row.id,
    kind: row.kind,
    created_at: row.created_at,
    applied_at: row.applied_at,
    expires_at: expiresAt,
    expiry_status: expiryStatus,
    available: expiryStatus === "available",
    path_summary: safePathSummary(row.payload_json),
    source_tool_call_id: row.execution_id,
  };
}

export function latestAvailableRollback(
  rows: RollbackRow[],
  now: number = Date.now(),
): RollbackSummary | null {
  for (const row of rows) {
    const summary = summarizeRollback(row, now);
    if (summary.available) return summary;
  }
  return null;
}

function safePathSummary(payloadJson: string): string {
  let payload: RollbackPayload;
  try {
    payload = JSON.parse(payloadJson) as RollbackPayload;
  } catch {
    return "[invalid rollback payload]";
  }

  if (typeof payload.path !== "string") return "[unknown path]";
  if (payload.path.includes("..")) return "[unsafe path]";
  if (isProtectedPath(payload.path)) return "[protected path]";

  return payload.path;
}
