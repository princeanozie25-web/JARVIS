import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveApproval,
  cancelApproval,
  createPendingApproval,
  denyApproval,
  verifyToolApproval,
} from "./approvals";
import { applyMigrations } from "./schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

function createPending(
  overrides: Partial<Parameters<typeof createPendingApproval>[1]> = {},
) {
  return createPendingApproval(db, {
    id: "approval-1",
    execution_id: "exec-1",
    session_id: "session-1",
    tool_id: "mock.status",
    scope_hash: "scope-1",
    created_at: 1_000,
    ttl_ms: 1_000,
    token: "token-1",
    ...overrides,
  });
}

describe("approval lifecycle", () => {
  it("grants and consumes a valid approval", () => {
    const pending = createPending();

    expect(
      approveApproval(db, {
        id: pending.id,
        token: pending.token,
        approved_at: 1_100,
      }),
    ).toMatchObject({ status: "granted" });

    expect(
      verifyToolApproval(db, {
        sessionId: "session-1",
        toolId: "mock.status",
        scopeHash: "scope-1",
        at: 1_200,
      }),
    ).toMatchObject({ status: "granted" });
  });

  it("rejects expired approvals", () => {
    const pending = createPending();

    expect(
      approveApproval(db, {
        id: pending.id,
        token: pending.token,
        approved_at: 2_001,
      }),
    ).toMatchObject({ status: "expired" });

    expect(
      verifyToolApproval(db, {
        sessionId: "session-1",
        toolId: "mock.status",
        scopeHash: "scope-1",
        at: 2_100,
      }),
    ).toMatchObject({ status: "expired" });
  });

  it("detects replay attempts after a one-time approval is consumed", () => {
    const pending = createPending();
    approveApproval(db, {
      id: pending.id,
      token: pending.token,
      approved_at: 1_100,
    });

    verifyToolApproval(db, {
      sessionId: "session-1",
      toolId: "mock.status",
      scopeHash: "scope-1",
      at: 1_200,
    });

    expect(
      verifyToolApproval(db, {
        sessionId: "session-1",
        toolId: "mock.status",
        scopeHash: "scope-1",
        at: 1_300,
      }),
    ).toMatchObject({ status: "replayed" });
  });

  it("returns denied approval state", () => {
    const pending = createPending();
    denyApproval(db, { id: pending.id, denied_at: 1_100 });

    expect(
      verifyToolApproval(db, {
        sessionId: "session-1",
        toolId: "mock.status",
        scopeHash: "scope-1",
        at: 1_200,
      }),
    ).toMatchObject({ status: "denied" });
  });

  it("returns cancelled approval state", () => {
    const pending = createPending();
    cancelApproval(db, { id: pending.id, cancelled_at: 1_100 });

    expect(
      verifyToolApproval(db, {
        sessionId: "session-1",
        toolId: "mock.status",
        scopeHash: "scope-1",
        at: 1_200,
      }),
    ).toMatchObject({ status: "cancelled" });
  });
});
