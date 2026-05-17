import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listRollbacks, recordRollback } from "../db/rollbacks";
import { applyMigrations } from "../db/schema";
import { ROLLBACK_TTL_MS } from "../tools/fs-undo";
import { latestAvailableRollback, summarizeRollback } from "./visibility";

let db: Database.Database;
let now: number;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  now = 10_000;
});

afterEach(() => {
  db.close();
});

function addRollback(input: {
  id: string;
  sessionId?: string;
  payload?: unknown;
  createdAt?: number;
  appliedAt?: number | null;
}) {
  recordRollback(db, {
    id: input.id,
    execution_id: `exec-${input.id}`,
    session_id: input.sessionId ?? "session-1",
    kind: "fs_restore_content",
    payload_json: JSON.stringify(
      input.payload ?? {
        path: "hello.txt",
        previousContent: "secret previous content",
        previousLength: 23,
      },
    ),
    created_at: input.createdAt ?? now - 1_000,
    applied_at: input.appliedAt,
  });
}

describe("rollback visibility", () => {
  it("lists current session rollbacks only", () => {
    addRollback({ id: "one", sessionId: "session-1" });
    addRollback({ id: "two", sessionId: "session-2" });

    expect(
      listRollbacks(db, { sessionId: "session-1" }).map((row) => row.id),
    ).toEqual(["one"]);
  });

  it("latest returns the most recent unapplied available rollback", () => {
    addRollback({ id: "older", createdAt: now - 2_000 });
    addRollback({ id: "newer", createdAt: now - 1_000 });

    expect(
      latestAvailableRollback(
        listRollbacks(db, { sessionId: "session-1" }),
        now,
      ),
    ).toMatchObject({
      id: "newer",
      available: true,
      path_summary: "hello.txt",
    });
  });

  it("excludes applied and expired rollbacks from latest", () => {
    addRollback({
      id: "applied",
      createdAt: now - 1_000,
      appliedAt: now - 500,
    });
    addRollback({
      id: "expired",
      createdAt: now - ROLLBACK_TTL_MS - 1,
    });

    expect(
      latestAvailableRollback(
        listRollbacks(db, { sessionId: "session-1" }),
        now,
      ),
    ).toBeNull();
    expect(
      listRollbacks(db, { sessionId: "session-1" }).map((row) =>
        summarizeRollback(row, now),
      ),
    ).toMatchObject([
      { id: "applied", expiry_status: "applied", available: false },
      { id: "expired", expiry_status: "expired", available: false },
    ]);
  });

  it("does not expose raw previousContent or backup file contents", () => {
    addRollback({ id: "inline" });
    addRollback({
      id: "backup",
      payload: {
        path: "large.txt",
        backupPath: ".jarvis-trash/backups/exec-backup",
        previousLength: 70_000,
      },
    });

    const summaries = listRollbacks(db, { sessionId: "session-1" }).map((row) =>
      summarizeRollback(row, now),
    );
    const serialized = JSON.stringify(summaries);

    expect(serialized).not.toContain("secret previous content");
    expect(serialized).not.toContain("backupPath");
    expect(serialized).not.toContain(".jarvis-trash");
    expect(summaries.map((summary) => summary.path_summary)).toEqual([
      "large.txt",
      "hello.txt",
    ]);
  });

  it("redacts unsafe and protected rollback paths", () => {
    addRollback({
      id: "unsafe",
      payload: { path: "../escape.txt" },
      createdAt: now - 2_000,
    });
    addRollback({
      id: "protected",
      payload: { path: ".env.local" },
      createdAt: now - 1_000,
    });

    expect(
      listRollbacks(db, { sessionId: "session-1" }).map(
        (row) => summarizeRollback(row, now).path_summary,
      ),
    ).toEqual(["[protected path]", "[unsafe path]"]);
  });
});
