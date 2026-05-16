import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import {
  getEvalRun,
  insertEvalResult,
  insertEvalRun,
  listEvalResults,
  listEvalRuns,
  markEvalRunCompleted,
} from "./storage";
import type { EvalResult, EvalRun } from "./types";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

const sampleRun: EvalRun = {
  id: "run-1",
  label: "smoke",
  createdAt: 1_000,
  caseCount: 1,
  targetCount: 1,
};

const sampleResult: EvalResult = {
  id: "res-1",
  runId: "run-1",
  caseId: "classify-domain",
  caseLabel: "Intent classification",
  providerId: "openai",
  modelId: "openai/gpt-4o-mini",
  modelName: "gpt-4o-mini",
  output: "automotive",
  latencyMs: 220,
  timeToFirstTokenMs: 80,
  inputTokens: 35,
  outputTokens: 2,
  costUsd: 0.0000071,
  success: true,
  createdAt: 1_050,
};

describe("eval storage", () => {
  it("inserts and retrieves an eval run", () => {
    insertEvalRun(db, sampleRun);
    const row = getEvalRun(db, "run-1");
    expect(row).toMatchObject({
      id: "run-1",
      label: "smoke",
      created_at: 1_000,
      completed_at: null,
      case_count: 1,
      target_count: 1,
    });
  });

  it("marks runs completed", () => {
    insertEvalRun(db, sampleRun);
    markEvalRunCompleted(db, "run-1", 2_000);
    expect(getEvalRun(db, "run-1")?.completed_at).toBe(2_000);
  });

  it("inserts and lists eval results for a run", () => {
    insertEvalRun(db, sampleRun);
    insertEvalResult(db, sampleResult);
    insertEvalResult(db, {
      ...sampleResult,
      id: "res-2",
      providerId: "anthropic",
      modelId: "anthropic/claude-haiku-4-5",
      modelName: "claude-haiku-4-5-20251001",
      output: "automotive",
      latencyMs: 330,
      createdAt: 1_100,
    });

    const rows = listEvalResults(db, "run-1");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.provider_id).toBe("openai");
    expect(rows[1]?.provider_id).toBe("anthropic");
    expect(rows[0]?.success).toBe(1);
    expect(rows[0]?.time_to_first_token_ms).toBe(80);
  });

  it("cascades delete of results when the run is removed", () => {
    insertEvalRun(db, sampleRun);
    insertEvalResult(db, sampleResult);
    db.prepare("DELETE FROM eval_runs WHERE id = ?").run("run-1");
    expect(listEvalResults(db, "run-1")).toEqual([]);
  });

  it("lists eval runs newest first", () => {
    insertEvalRun(db, { ...sampleRun, id: "old", createdAt: 1_000 });
    insertEvalRun(db, { ...sampleRun, id: "new", createdAt: 2_000 });
    expect(listEvalRuns(db).map((r) => r.id)).toEqual(["new", "old"]);
  });
});
