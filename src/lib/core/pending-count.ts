import type DatabaseType from "better-sqlite3";

import type { CorePresenceInput } from "./core-state";

// Program U.3 (E-030) — the ONE read the Core makes: how many approvals are
// pending right now. A raw COUNT over the approvals table, deliberately NOT
// through the approvals module (which carries the mutators the executor
// uses) — this file must never be able to decide, consume, or expire a row.
// Unexpired pending rows only; expiry is enforced upstream at decision time
// (FC-2), so a stale row counts here for at most its own TTL and is never
// silently mutated by a read surface.

export interface PendingCountRead {
  readonly pendingCount: number;
  readonly provenance: CorePresenceInput["provenance"];
}

export function readPendingApprovalCount(
  db: DatabaseType.Database,
  now: number = Date.now(),
): PendingCountRead {
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM approvals
         WHERE state = 'pending'
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(now) as { n: number } | undefined;
    return { pendingCount: row?.n ?? 0, provenance: "live" };
  } catch {
    return { pendingCount: 0, provenance: "unreachable" };
  }
}
