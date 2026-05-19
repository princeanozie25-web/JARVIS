import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  createMemoryCandidate,
  createSession,
  createSessionIfMissing,
  createSessionSummary,
  getSessionSummary,
  listTelemetryEvents,
} from "../db/node";
import { applyMigrations } from "../db/schema";
import {
  applyCuratorAction,
  archiveCuratorTarget,
  mergeSummaries,
  readCuratorWorkspace,
  safeDeleteCuratorTarget,
  splitSummaryIntoManualNotes,
  type CuratorResult,
} from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function enableCurator() {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId: "conversation_curator",
    enabled: true,
    now: () => 1_000,
  });
}

function expectOk<T>(result: CuratorResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected curator result");
  return result.value;
}

function seedSummary(id: string, text: string, at: number) {
  createSessionIfMissing(db, "session-1", 500);
  return createSessionSummary(db, {
    sessionId: "session-1",
    summaryText: text,
    summaryHash: id,
    coveredMessageCount: 5,
    createdAt: at,
    updatedAt: at,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-curator-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("conversation curator", () => {
  it("blocks curator reads and actions when consent is disabled", () => {
    expect(readCuratorWorkspace(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "conversation_curator",
      reason: "consent_disabled",
    });
    expect(
      applyCuratorAction(db, {
        manifestPath,
        action: "mark_important",
        targetType: "summary",
        targetId: "sum-1",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("merges summaries into a derived record while preserving originals", () => {
    enableCurator();
    seedSummary("sum-1", "First summary.", 2_000);
    seedSummary("sum-2", "Second summary.", 3_000);

    const result = expectOk(
      mergeSummaries(db, {
        manifestPath,
        summaryHashes: ["sum-1", "sum-2"],
        title: "Merged manual summary",
        mergedText: "First plus second.",
        recordId: "merge-1",
        auditId: "audit-merge",
        now: () => 4_000,
      }),
    );

    expect(result.record).toMatchObject({
      id: "merge-1",
      record_type: "merged_summary",
      source_type: "summary",
      source_ids_json: '["sum-1","sum-2"]',
      derived_from_ids_json: '["sum-1","sum-2"]',
      status: "active",
    });
    expect(result.audit).toMatchObject({
      action_type: "curator_merge",
      target_type: "summary",
      derived_record_ids_json: '["merge-1"]',
    });
    expect(getSessionSummary(db, "sum-1")?.summary_text).toBe("First summary.");
    expect(getSessionSummary(db, "sum-2")?.summary_text).toBe(
      "Second summary.",
    );
  });

  it("splits a summary into manual notes with provenance", () => {
    enableCurator();
    seedSummary("sum-1", "Summary to split.", 2_000);

    const result = expectOk(
      splitSummaryIntoManualNotes(db, {
        manifestPath,
        summaryHash: "sum-1",
        notes: [{ id: "note-1", title: "Manual note", content: "Split note." }],
        auditId: "audit-split",
        now: () => 3_000,
      }),
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: "note-1",
      record_type: "manual_note",
      source_ids_json: '["sum-1"]',
      derived_from_ids_json: '["sum-1"]',
    });
    expect(result.audit.action_type).toBe("curator_split");
    expect(getSessionSummary(db, "sum-1")?.summary_text).toBe(
      "Summary to split.",
    );
  });

  it("archives source targets through audit and derived records through status", () => {
    enableCurator();
    seedSummary("sum-1", "Summary to archive.", 2_000);
    const audit = expectOk(
      archiveCuratorTarget(db, {
        manifestPath,
        targetType: "summary",
        targetId: "sum-1",
        now: () => 3_000,
      }),
    );

    expect(audit.action_type).toBe("curator_archive");
    expect(JSON.parse(audit.provenance_json)).toMatchObject({
      archive_mode: "audit_only_source_preserved",
    });
    expect(getSessionSummary(db, "sum-1")).toBeDefined();
  });

  it("uses a safe delete tombstone without deleting source rows", () => {
    enableCurator();
    createSession(db, "session-1", 500);
    createMemoryCandidate(db, {
      id: "cand-1",
      sessionId: "session-1",
      sourceMessageIds: ["m1"],
      proposedCategory: "decision",
      proposedContent: "Candidate source.",
      proposedTags: [],
      proposedSensitivity: "personal",
      rationale: "Delete safety test.",
      createdAt: 2_000,
    });

    const audit = expectOk(
      safeDeleteCuratorTarget(db, {
        manifestPath,
        targetType: "candidate",
        targetId: "cand-1",
        now: () => 3_000,
      }),
    );

    expect(audit.action_type).toBe("curator_delete");
    expect(JSON.parse(audit.provenance_json)).toMatchObject({
      delete_mode: "audit_tombstone_no_source_delete",
      original_ids_preserved: true,
    });
    expect(
      db.prepare("SELECT * FROM memory_candidates WHERE id = ?").get("cand-1"),
    ).toBeDefined();
  });

  it("emits curator audit telemetry", () => {
    enableCurator();
    applyCuratorAction(db, {
      manifestPath,
      action: "demote",
      targetType: "summary",
      targetId: "sum-1",
      now: () => 2_000,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "curator_action",
    );
  });
});
