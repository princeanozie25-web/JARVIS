import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory } from "../db/memory";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import type { EmbeddingProvider } from "./embedding-providers";
import { MemoryRetriever, reciprocalRankFusionScore, RRF_K } from "./retriever";
import type { MemorySensitivity } from "./types";
import type { VectorStore } from "./vector-store";

const enabledEmbeddingConfig = {
  enabled: true,
  provider: "ollama" as const,
  model: "test-embed",
  dimension: 3,
  timeoutMs: 1_000,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  fallbackProvider: "transformers" as const,
  fallbackModel: "fallback",
  fallbackDimension: 3,
};

const disabledEmbeddingConfig = {
  ...enabledEmbeddingConfig,
  enabled: false,
};

const enabledVectorConfig = {
  enabled: true,
  provider: "lancedb" as const,
  path: "C:\\vectors",
  tableName: "memory_embeddings",
  dimension: 3,
};

const disabledVectorConfig = {
  ...enabledVectorConfig,
  enabled: false,
};

let db: Database.Database;

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function insertMemory(input: {
  id: string;
  content: string;
  category?: "fact" | "preference" | "event" | "decision";
  project?: string | null;
  tags?: string[];
  sensitivity?: MemorySensitivity;
  createdAt?: number;
}): void {
  insertLongTermMemory(db, {
    id: input.id,
    category: input.category ?? "fact",
    content: input.content,
    source: "user",
    source_id: "session-1",
    project: input.project ?? null,
    tags_json: JSON.stringify(input.tags ?? []),
    sensitivity: input.sensitivity ?? "personal",
    created_at: input.createdAt ?? 1_000,
    updated_at: input.createdAt ?? 1_000,
    obsidian_path: `50-ideas/${input.id}.md`,
    hash: hash(input.content),
  });
}

function fakeProvider(): EmbeddingProvider {
  return {
    id: "fake",
    model: "test-embed",
    dimension: 3,
    async embed() {
      return {
        embedding: [1, 0, 0],
        model: "test-embed",
        dimension: 3,
        provider: "fake",
      };
    },
  };
}

function fakeStore(
  results: Array<{ memoryId: string; score: number }>,
): VectorStore {
  return {
    id: "fake",
    enabled: true,
    async upsert() {},
    async search() {
      return results.map((result) => ({
        memoryId: result.memoryId,
        score: result.score,
        model: "test-embed",
        dimension: 3,
      }));
    },
  };
}

function retrieverWithVectors(
  vectorResults: Array<{ memoryId: string; score: number }>,
): MemoryRetriever {
  return new MemoryRetriever(db, {
    embeddingConfig: enabledEmbeddingConfig,
    embeddingProvider: fakeProvider(),
    vectorConfig: enabledVectorConfig,
    vectorStore: fakeStore(vectorResults),
    now: () => 5_000,
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("MemoryRetriever", () => {
  it("uses RRF with k=60 for fusion scoring", () => {
    expect(RRF_K).toBe(60);
    expect(reciprocalRankFusionScore(1, 2)).toBeCloseTo(1 / 61 + 1 / 62);
    expect(reciprocalRankFusionScore(null, 1)).toBeCloseTo(1 / 61);
  });

  it("orders hybrid keyword and vector results by fused score", async () => {
    insertMemory({
      id: "mem-both",
      content: "alpha retrieval anchor appears here.",
      createdAt: 3_000,
    });
    insertMemory({
      id: "mem-keyword",
      content: "alpha retrieval keyword-only note.",
      createdAt: 2_000,
    });
    insertMemory({
      id: "mem-vector",
      content: "semantic neighbor without exact query words.",
      createdAt: 1_000,
    });

    const result = await retrieverWithVectors([
      { memoryId: "mem-vector", score: 0.99 },
      { memoryId: "mem-both", score: 0.9 },
    ]).retrieve({
      query: "alpha retrieval",
      maxResults: 5,
    });

    expect(result.mode).toBe("hybrid");
    expect(result.results.map((row) => row.id)).toEqual([
      "mem-both",
      "mem-vector",
      "mem-keyword",
    ]);
    expect(result.results[0]?.score).toMatchObject({
      keywordRank: 1,
      vectorRank: 2,
      sourceType: "hybrid",
    });
  });

  it("falls back to keyword-only retrieval when embeddings are disabled", async () => {
    insertMemory({
      id: "mem-keyword",
      content: "fallback keyword recall remains available.",
    });
    const result = await new MemoryRetriever(db, {
      embeddingConfig: disabledEmbeddingConfig,
      vectorConfig: enabledVectorConfig,
    }).retrieve({ query: "fallback keyword" });

    expect(result.mode).toBe("keyword_only");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.score).toMatchObject({
      keywordRank: 1,
      vectorRank: null,
      sourceType: "keyword",
    });
  });

  it("falls back to keyword-only retrieval when the vector store is disabled", async () => {
    insertMemory({
      id: "mem-keyword",
      content: "disabled vector store keyword recall.",
    });
    const result = await new MemoryRetriever(db, {
      embeddingConfig: enabledEmbeddingConfig,
      embeddingProvider: fakeProvider(),
      vectorConfig: disabledVectorConfig,
    }).retrieve({ query: "keyword recall" });

    expect(result.mode).toBe("keyword_only");
    expect(result.results.map((row) => row.id)).toEqual(["mem-keyword"]);
  });

  it("enforces the sensitivity ceiling across keyword and vector candidates", async () => {
    insertMemory({
      id: "mem-public",
      content: "passport keyword public placeholder.",
      sensitivity: "public",
    });
    insertMemory({
      id: "mem-sensitive",
      content: "passport keyword sensitive detail.",
      sensitivity: "sensitive",
      createdAt: 2_000,
    });
    insertMemory({
      id: "mem-restricted",
      content: "vector-only restricted memory.",
      sensitivity: "restricted",
      createdAt: 3_000,
    });

    const result = await retrieverWithVectors([
      { memoryId: "mem-restricted", score: 1 },
      { memoryId: "mem-sensitive", score: 0.9 },
      { memoryId: "mem-public", score: 0.8 },
    ]).retrieve({
      query: "passport keyword",
      maxResults: 10,
      sensitivityCeiling: "personal",
    });

    expect(result.results.map((row) => row.id)).toEqual(["mem-public"]);
    expect(
      result.results.every((row) =>
        ["public", "personal"].includes(row.sensitivity),
      ),
    ).toBe(true);
  });

  it("applies category, project, and tag filters to keyword and vector results", async () => {
    insertMemory({
      id: "mem-match",
      content: "filtered memory phase retrieval.",
      category: "decision",
      project: "jarvis",
      tags: ["#phase3"],
    });
    insertMemory({
      id: "mem-project-miss",
      content: "filtered memory phase retrieval.",
      category: "decision",
      project: "garden",
      tags: ["#phase3"],
    });
    insertMemory({
      id: "mem-vector-miss",
      content: "semantic neighbor outside the requested project.",
      category: "decision",
      project: "garden",
      tags: ["#phase3"],
    });

    const result = await retrieverWithVectors([
      { memoryId: "mem-vector-miss", score: 1 },
      { memoryId: "mem-match", score: 0.9 },
    ]).retrieve({
      query: "filtered memory",
      category: "decision",
      project: "jarvis",
      tag: "phase3",
      maxResults: 10,
    });

    expect(result.results.map((row) => row.id)).toEqual(["mem-match"]);
  });

  it("emits memory_read telemetry with the retrieval mode and no raw query", async () => {
    insertMemory({
      id: "mem-telemetry",
      content: "telemetry hybrid recall keyword.",
    });

    await retrieverWithVectors([
      { memoryId: "mem-telemetry", score: 1 },
    ]).retrieve({
      query: "telemetry hybrid",
      sessionId: "session-1",
      executionId: "exec-hybrid",
      intent: "INFORMATION_REQUEST",
      safetyTag: "ALLOW",
      tier: "T3",
      modelId: "gpt-4o-mini",
    });

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "memory_read",
    );
    expect(event).toMatchObject({
      timestamp: 5_000,
      success: 1,
      session_id: "session-1",
      execution_id: "exec-hybrid",
      tool_name: "memory.recall",
      intent: "INFORMATION_REQUEST",
      safety_tag: "ALLOW",
      tier: "T3",
      model_id: "gpt-4o-mini",
    });
    expect(event?.notes).toContain("mode=hybrid");
    expect(event?.notes).toContain("query_sha256=");
    expect(event?.notes).toContain('result_ids=["mem-telemetry"]');
    expect(event?.notes).not.toContain("telemetry hybrid");
  });
});
