import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryCandidate,
  listMemoryCandidates,
  updateMemoryCandidateStatus,
} from "./memory-candidates";
import { applyMigrations } from "./schema";
import { createSession } from "./sessions";
import { listTelemetryEvents } from "./telemetry";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("memory candidate persistence", () => {
  it("creates and lists draft candidates", () => {
    const created = createMemoryCandidate(db, {
      id: "cand-1",
      sessionId: "session-1",
      sourceMessageIds: ["m1", "m2"],
      proposedCategory: "decision",
      proposedContent: "Phase 3C.6 adds draft memory candidates only.",
      proposedTags: ["#phase3", "#memory"],
      proposedSensitivity: "personal",
      rationale: "The user explicitly requested this implementation boundary.",
      now: () => 2_000,
    });

    expect(created).toMatchObject({
      id: "cand-1",
      session_id: "session-1",
      proposed_category: "decision",
      proposed_sensitivity: "personal",
      status: "draft",
      created_at: 2_000,
      reviewed_at: null,
    });
    expect(JSON.parse(created.source_message_ids_json)).toEqual(["m1", "m2"]);
    expect(JSON.parse(created.proposed_tags_json)).toEqual([
      "#phase3",
      "#memory",
    ]);
    expect(listMemoryCandidates(db, { sessionId: "session-1" })).toEqual([
      created,
    ]);
  });

  it("updates review status and emits telemetry", () => {
    createMemoryCandidate(db, {
      id: "cand-1",
      sessionId: "session-1",
      sourceMessageIds: ["m1"],
      proposedCategory: "fact",
      proposedContent: "A candidate can be rejected safely.",
      proposedTags: [],
      proposedSensitivity: "personal",
      rationale: "Review action test.",
      now: () => 2_000,
    });

    const reviewed = updateMemoryCandidateStatus(db, "cand-1", "rejected", {
      now: () => 3_000,
    });

    expect(reviewed?.status).toBe("rejected");
    expect(reviewed?.reviewed_at).toBe(3_000);
    expect(listMemoryCandidates(db, { status: "rejected" })).toHaveLength(1);
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual([
      "memory_candidate_rejected",
      "memory_candidate_reviewed",
      "memory_candidate_generated",
    ]);
  });
});
