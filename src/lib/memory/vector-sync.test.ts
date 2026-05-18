import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory, upsertMemoryEmbedding } from "../db/memory";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import { embeddingVectorToBlob } from "./embeddings";
import {
  manualVectorSimilaritySearch,
  syncMemoryEmbeddingsToVectorStore,
} from "./vector-sync";
import type { VectorStore, VectorStoreRecord } from "./vector-store";

const enabledConfig = {
  enabled: true,
  provider: "lancedb" as const,
  path: "C:\\vectors",
  tableName: "memory_embeddings",
  dimension: 3,
};

let db: Database.Database;

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function insertMemory(input: {
  id: string;
  content: string;
  sensitivity?: "public" | "personal" | "sensitive" | "restricted";
}): void {
  insertLongTermMemory(db, {
    id: input.id,
    category: "fact",
    content: input.content,
    source: "user",
    source_id: "session-1",
    tags_json: "[]",
    sensitivity: input.sensitivity ?? "personal",
    created_at: 1_000,
    updated_at: 1_000,
    hash: hash(input.content),
  });
}

function insertEmbedding(memoryId: string, vector: number[]): void {
  upsertMemoryEmbedding(db, {
    memoryId,
    category: "long_term_memory",
    embedding: embeddingVectorToBlob(vector),
    model: "test-embed",
    dim: 3,
    createdAt: 2_000,
  });
}

function mockStore(): VectorStore & { records: VectorStoreRecord[] } {
  const store = {
    id: "mock",
    enabled: true,
    records: [] as VectorStoreRecord[],
    async upsert(records: VectorStoreRecord[]) {
      store.records.push(...records);
    },
    async search(vector: number[]) {
      return store.records
        .map((record) => ({
          memoryId: record.memoryId,
          score: dot(record.vector, vector),
          model: record.model,
          dimension: record.dimension,
        }))
        .sort((left, right) => right.score - left.score);
    },
  };
  return store;
}

function dot(left: number[], right: number[]): number {
  return left.reduce(
    (sum, value, index) => sum + value * (right[index] ?? 0),
    0,
  );
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("syncMemoryEmbeddingsToVectorStore", () => {
  it("returns disabled when LanceDB vector store is disabled", async () => {
    await expect(
      syncMemoryEmbeddingsToVectorStore({
        db,
        config: { ...enabledConfig, enabled: false },
      }),
    ).resolves.toEqual({
      ok: false,
      status: "disabled",
      reason: "vector_store_disabled",
    });
  });

  it("syncs public and personal memory embeddings only", async () => {
    insertMemory({
      id: "mem-public",
      content: "public",
      sensitivity: "public",
    });
    insertMemory({
      id: "mem-personal",
      content: "personal",
      sensitivity: "personal",
    });
    insertMemory({
      id: "mem-sensitive",
      content: "sensitive",
      sensitivity: "sensitive",
    });
    insertEmbedding("mem-public", [1, 0, 0]);
    insertEmbedding("mem-personal", [0, 1, 0]);
    insertEmbedding("mem-sensitive", [0, 0, 1]);
    const store = mockStore();

    await expect(
      syncMemoryEmbeddingsToVectorStore({
        db,
        config: enabledConfig,
        store,
      }),
    ).resolves.toEqual({
      ok: true,
      status: "synced",
      count: 2,
    });
    expect(store.records.map((record) => record.memoryId).sort()).toEqual([
      "mem-personal",
      "mem-public",
    ]);
  });
});

describe("manualVectorSimilaritySearch", () => {
  it("runs manual similarity search using a vector store", async () => {
    const store = mockStore();
    await store.upsert([
      {
        memoryId: "mem-a",
        category: "long_term_memory",
        vector: [1, 0, 0],
        model: "test-embed",
        dimension: 3,
        createdAt: 1_000,
      },
      {
        memoryId: "mem-b",
        category: "long_term_memory",
        vector: [0, 1, 0],
        model: "test-embed",
        dimension: 3,
        createdAt: 1_000,
      },
    ]);

    await expect(
      manualVectorSimilaritySearch({
        db,
        config: enabledConfig,
        store,
        vector: [1, 0, 0],
        maxResults: 2,
        now: () => 3_000,
        sessionId: "session-1",
        executionId: "vector-search",
      }),
    ).resolves.toMatchObject([
      { memoryId: "mem-a", score: 1 },
      { memoryId: "mem-b", score: 0 },
    ]);

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "memory_vector_search",
    );
    expect(event).toMatchObject({
      timestamp: 3_000,
      success: 1,
      session_id: "session-1",
      execution_id: "vector-search",
      tool_name: "memory.vector_search",
    });
    expect(event?.notes).toContain('result_ids=["mem-a","mem-b"]');
  });
});
