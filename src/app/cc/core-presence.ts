import type DatabaseType from "better-sqlite3";

import { getDb } from "@/lib/db/node";
import {
  readPendingApprovalCount,
  resolveCoreState,
  type CorePresence,
} from "@/lib/core";

// Program U.3 (E-030) — the server-side READ that feeds the Core. Mirrors
// the E-019 pattern (workflowbox-live.ts): the route passes nothing and gets
// the app database; tests inject a db. An unreachable store is reported as
// such — the Core shows "Cannot reach the approval store", it never guesses.

export function loadCorePresence(db?: DatabaseType.Database): CorePresence {
  let handle: DatabaseType.Database | null = null;
  try {
    handle = db ?? getDb();
  } catch {
    return resolveCoreState({ pendingCount: 0, provenance: "unreachable" });
  }
  return resolveCoreState(readPendingApprovalCount(handle));
}
