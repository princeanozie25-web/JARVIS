import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  createMemoryCandidate,
  createSession,
  listTelemetryEvents,
} from "../db/node";
import { applyMigrations } from "../db/schema";
import { applyCuratorAction } from "../curator";
import {
  dismissReviewItem,
  listReviewItems,
  updateReviewItemStatus,
  type HumanReviewResult,
} from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function enable(featureId: "human_review_queue" | "conversation_curator") {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId,
    enabled: true,
    now: () => 1_000,
  });
}

function expectOk<T>(result: HumanReviewResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected human review result");
  return result.value;
}

function seedCandidate(id = "cand-1") {
  createSession(db, "session-1", 1_000);
  return createMemoryCandidate(db, {
    id,
    sessionId: "session-1",
    sourceMessageIds: ["m1"],
    proposedCategory: "decision",
    proposedContent: "Use the manual review queue for candidate triage.",
    proposedTags: ["phase-3d"],
    proposedSensitivity: "personal",
    rationale: "Stable implementation decision.",
    createdAt: 2_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-review-queue-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("human review queue", () => {
  it("blocks reads and writes when human review queue consent is disabled", () => {
    expect(listReviewItems(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "human_review_queue",
      reason: "consent_disabled",
    });
    expect(
      updateReviewItemStatus(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
        status: "accepted",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(
      dismissReviewItem(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("lists draft memory candidates as pending review items with provenance", () => {
    enable("human_review_queue");
    seedCandidate();

    const items = expectOk(listReviewItems(db, { manifestPath, limit: 10 }));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "memory_candidate:cand-1",
      item_type: "memory_candidate",
      title: "Memory candidate: decision",
      summary: "Use the manual review queue for candidate triage.",
      status: "pending",
      source_id: "cand-1",
      source_type: "memory_candidate",
    });
    expect(items[0]?.provenance).toMatchObject({
      session_id: "session-1",
      source_message_ids: ["m1"],
      proposed_tags: ["phase-3d"],
      proposed_sensitivity: "personal",
      rationale: "Stable implementation decision.",
    });
  });

  it("lists curator audit records without requiring curator actions to affect prompts", () => {
    enable("conversation_curator");
    enable("human_review_queue");
    seedCandidate();
    const audit = expectOk(
      applyCuratorAction(db, {
        manifestPath,
        action: "mark_important",
        targetType: "candidate",
        targetId: "cand-1",
        auditId: "audit-1",
        now: () => 3_000,
      }),
    );

    const items = expectOk(listReviewItems(db, { manifestPath, limit: 10 }));
    expect(items.map((item) => item.id)).toContain(`curator_audit:${audit.id}`);
    const curatorItem = items.find(
      (item) => item.id === "curator_audit:audit-1",
    );
    expect(curatorItem?.provenance).toMatchObject({
      source_session_id: "session-1",
      target_type: "candidate",
      target_ids: ["cand-1"],
      created_by: "user",
    });
  });

  it("updates review status without mutating source candidates", () => {
    enable("human_review_queue");
    seedCandidate();

    const row = expectOk(
      updateReviewItemStatus(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
        status: "accepted",
        decisionReason: "Reviewed manually.",
        now: () => 4_000,
      }),
    );

    expect(row).toMatchObject({
      id: "memory_candidate:cand-1",
      source_id: "cand-1",
      source_type: "memory_candidate",
      status: "accepted",
      decision_reason: "Reviewed manually.",
    });
    expect(
      db
        .prepare("SELECT status FROM memory_candidates WHERE id = ?")
        .get("cand-1"),
    ).toEqual({ status: "draft" });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM long_term_memory").get(),
    ).toEqual({ count: 0 });
  });

  it("dismisses items using queue-specific state only", () => {
    enable("human_review_queue");
    seedCandidate();

    const row = expectOk(
      dismissReviewItem(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
        decisionReason: "Not needed in inbox.",
        now: () => 5_000,
      }),
    );
    expect(row.status).toBe("dismissed");

    const items = expectOk(listReviewItems(db, { manifestPath }));
    expect(items[0]).toMatchObject({
      id: "memory_candidate:cand-1",
      status: "dismissed",
      decision_reason: "Not needed in inbox.",
    });
  });

  it("does not auto-approve or create queue decisions during listing", () => {
    enable("human_review_queue");
    seedCandidate();

    expectOk(listReviewItems(db, { manifestPath }));

    expect(
      db.prepare("SELECT COUNT(*) AS count FROM human_review_queue").get(),
    ).toEqual({ count: 0 });
    expect(
      db
        .prepare("SELECT status FROM memory_candidates WHERE id = ?")
        .get("cand-1"),
    ).toEqual({ status: "draft" });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM long_term_memory").get(),
    ).toEqual({ count: 0 });
  });

  it("emits review queue telemetry", () => {
    enable("human_review_queue");
    seedCandidate();

    expectOk(listReviewItems(db, { manifestPath, now: () => 6_000 }));
    expectOk(
      updateReviewItemStatus(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
        status: "rejected",
        now: () => 7_000,
      }),
    );
    expectOk(
      dismissReviewItem(db, {
        manifestPath,
        id: "memory_candidate:cand-1",
        now: () => 8_000,
      }),
    );

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "review_queue_read",
        "review_item_updated",
        "review_item_dismissed",
      ]),
    );
  });
});
