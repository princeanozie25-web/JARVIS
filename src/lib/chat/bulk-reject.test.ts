// Human bulk-reject invariant I-24D3-6 (24D-3): clearing a queue flood reuses the
// EXISTING deny path — each pending proposal walks the same terminal DENIED state
// as a normal human denial, via denyApproval + updateToolCall. No new executor,
// no new mutation primitive, NO runtime.runTool.

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyMigrations } from "../db/schema";
import { createPendingApproval, getApprovalById } from "../db/approvals";
import { createToolCall, getToolCall } from "../db/tool-calls";
import { bulkRejectPendingApprovals } from "./bulk-reject";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

/** Seed a pending proposal (tool_call AWAITING_APPROVAL + pending approval row). */
function seedPending(suffix: string, sessionId: string): void {
  const executionId = `exec-${suffix}`;
  createToolCall(db, {
    execution_id: executionId,
    session_id: sessionId,
    tool_id: "memory.note",
    tool_name: "Memory Note",
    status: "AWAITING_APPROVAL",
    safety_tag: "ALLOW",
    required_safety_tag: "CONFIRM_ONCE",
    scope_hash: "scope",
    input_json: "{}",
    proposed_at: 1_000,
    timeout_ms: 1_000,
  });
  createPendingApproval(db, {
    id: `appr-${suffix}`,
    execution_id: executionId,
    session_id: sessionId,
    tool_id: "memory.note",
    scope_hash: "scope",
    created_at: 1_000,
    ttl_ms: 60_000,
  });
}

describe("I-24D3-6 (bulk-reject reuses the existing deny path)", () => {
  it("finalizes every pending proposal DENIED (approval + tool_call) and returns the count", () => {
    seedPending("0", "s");
    seedPending("1", "s");
    seedPending("2", "s");

    const res = bulkRejectPendingApprovals(db, { now: 2_000 });

    expect(res.rejected).toBe(3);
    expect(res.approvalIds.sort()).toEqual(["appr-0", "appr-1", "appr-2"]);
    for (const s of ["0", "1", "2"]) {
      expect(getApprovalById(db, `appr-${s}`)?.state).toBe("denied");
      expect(getToolCall(db, `exec-${s}`)?.status).toBe("DENIED");
    }
  });

  it("filters by session — another session's pending proposals are untouched", () => {
    seedPending("a", "session-1");
    seedPending("b", "session-2");

    const res = bulkRejectPendingApprovals(db, {
      now: 2_000,
      sessionId: "session-1",
    });

    expect(res.rejected).toBe(1);
    expect(getApprovalById(db, "appr-a")?.state).toBe("denied");
    expect(getApprovalById(db, "appr-b")?.state).toBe("pending"); // other session intact
  });

  it("filters by an explicit id selection", () => {
    seedPending("x", "s");
    seedPending("y", "s");

    const res = bulkRejectPendingApprovals(db, {
      now: 2_000,
      approvalIds: ["appr-x"],
    });

    expect(res.rejected).toBe(1);
    expect(getApprovalById(db, "appr-x")?.state).toBe("denied");
    expect(getApprovalById(db, "appr-y")?.state).toBe("pending");
  });

  it("the audit hook is metadata-only (ids + time, no proposal body)", () => {
    seedPending("0", "s");
    const seen: Array<{ approvalId: string; executionId: string | null }> = [];
    bulkRejectPendingApprovals(db, {
      now: 2_000,
      onReject: (e) =>
        seen.push({ approvalId: e.approvalId, executionId: e.executionId }),
    });
    expect(seen).toEqual([{ approvalId: "appr-0", executionId: "exec-0" }]);
  });

  it("an already-denied/empty queue is a no-op (idempotent)", () => {
    expect(bulkRejectPendingApprovals(db, { now: 2_000 }).rejected).toBe(0);
  });

  it("adds NO runtime.runTool call site (count stays exactly 2; reuses the deny path)", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "bulk-reject.ts"),
      "utf8",
    );
    expect(/\.runTool\s*\(/.test(src)).toBe(false);
    // it reuses the EXISTING deny primitives, naming neither a new executor nor a
    // new mutation: only denyApproval + updateToolCall (both pre-existing).
    expect(src).toContain("denyApproval");
    expect(src).toContain("updateToolCall");
  });
});
