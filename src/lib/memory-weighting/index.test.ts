import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  createMemoryCandidate,
  createSession,
  insertLongTermMemory,
  listTelemetryEvents,
} from "../db/node";
import { applyMigrations } from "../db/schema";
import { insertTelemetryEvent } from "../db/telemetry";
import { MemoryRetriever } from "../memory/retriever";
import { readPassiveMemoryWeighting } from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function enableMemoryWeighting() {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId: "memory_weighting",
    enabled: true,
    now: () => 1_000,
  });
}

function insertMemory(input: {
  id: string;
  content: string;
  createdAt: number;
}): void {
  insertLongTermMemory(db, {
    id: input.id,
    category: "fact",
    content: input.content,
    source: "user",
    source_id: "session-1",
    tags_json: "[]",
    sensitivity: "personal",
    created_at: input.createdAt,
    updated_at: input.createdAt,
    hash: hash(input.content),
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-memory-weighting-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("passive memory weighting", () => {
  it("blocks weighting reads when memory_weighting consent is disabled", () => {
    expect(readPassiveMemoryWeighting(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "memory_weighting",
      reason: "consent_disabled",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("computes deterministic recency, default pin, default usage, and final weight", () => {
    enableMemoryWeighting();
    insertMemory({
      id: "mem-recent",
      content: "Recent passive weighting memory.",
      createdAt: 2_000,
    });

    const result = readPassiveMemoryWeighting(db, {
      manifestPath,
      now: () => 2_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("weighting read blocked");
    expect(result.weights[0]).toMatchObject({
      item_id: "mem-recent",
      item_type: "long_term_memory",
      base_score: 1,
      recency_score: 1,
      pin_score: 0,
      usage_score: 0,
      final_weight: 2,
    });
    expect(result.weights[0]?.explanation).toContain(
      "preview only / not applied to retrieval",
    );
    expect(result.weights[0]?.explanation).toContain("pinned=false");
    expect(result.weights[0]?.explanation).toContain("usage_count=0");
  });

  it("uses retrieval and surfacing telemetry counts when available", () => {
    enableMemoryWeighting();
    insertMemory({
      id: "mem-used",
      content: "Used memory.",
      createdAt: 2_000,
    });
    insertTelemetryEvent(db, {
      timestamp: 3_000,
      event_type: "memory_surfaced",
      success: true,
      notes: 'mode=hybrid result_ids=["mem-used"]',
    });
    insertTelemetryEvent(db, {
      timestamp: 4_000,
      event_type: "memory_read",
      success: true,
      notes: 'mode=keyword_only result_ids=["mem-used"]',
    });

    const result = readPassiveMemoryWeighting(db, {
      manifestPath,
      now: () => 2_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("weighting read blocked");
    expect(result.weights[0]).toMatchObject({
      item_id: "mem-used",
      recency_score: 1,
      usage_score: 0.2,
      final_weight: 2.2,
    });
  });

  it("projects memory candidates without mutating source records", () => {
    enableMemoryWeighting();
    const candidate = createMemoryCandidate(db, {
      id: "cand-1",
      sessionId: "session-1",
      sourceMessageIds: ["m1"],
      proposedCategory: "decision",
      proposedContent: "Candidate weighting preview.",
      proposedTags: [],
      proposedSensitivity: "personal",
      rationale: "Test candidate.",
      createdAt: 2_000,
    });
    const before = db
      .prepare("SELECT * FROM memory_candidates WHERE id = ?")
      .get("cand-1");

    const result = readPassiveMemoryWeighting(db, {
      manifestPath,
      itemType: "memory_candidate",
      now: () => 2_000,
    });
    const after = db
      .prepare("SELECT * FROM memory_candidates WHERE id = ?")
      .get("cand-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("weighting read blocked");
    expect(result.weights[0]).toMatchObject({
      item_id: candidate.id,
      item_type: "memory_candidate",
      base_score: 0.75,
      recency_score: 1,
      pin_score: 0,
      usage_score: 0,
      final_weight: 1.75,
    });
    expect(after).toEqual(before);
  });

  it("does not change MemoryRetriever ranking behavior", async () => {
    enableMemoryWeighting();
    insertMemory({
      id: "mem-new",
      content: "alpha ranking memory.",
      createdAt: 3_000,
    });
    insertMemory({
      id: "mem-old",
      content: "alpha ranking memory older.",
      createdAt: 2_000,
    });
    const retriever = new MemoryRetriever(db, {
      embeddingConfig: {
        enabled: false,
        provider: "ollama",
        model: "test",
        dimension: 3,
        timeoutMs: 1_000,
        ollamaBaseUrl: "http://127.0.0.1:11434",
        fallbackProvider: "transformers",
        fallbackModel: "fallback",
        fallbackDimension: 3,
      },
    });

    const before = await retriever.retrieve({ query: "alpha ranking" });
    readPassiveMemoryWeighting(db, {
      manifestPath,
      now: () => 4_000,
    });
    const after = await retriever.retrieve({ query: "alpha ranking" });

    expect(after.results.map((row) => row.id)).toEqual(
      before.results.map((row) => row.id),
    );
    expect(after.results.map((row) => row.score)).toEqual(
      before.results.map((row) => row.score),
    );
  });

  it("emits memory weighting telemetry", () => {
    enableMemoryWeighting();
    readPassiveMemoryWeighting(db, {
      manifestPath,
      now: () => 5_000,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "memory_weighting_read",
        "memory_weighting_projected",
      ]),
    );
  });
});
