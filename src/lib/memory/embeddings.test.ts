import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMemoryEmbedding, insertLongTermMemory } from "../db/memory";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import type { MemorySensitivity } from "./types";
import {
  embedLongTermMemory,
  embeddingBlobToVector,
  type EmbedMemoryResult,
} from "./embeddings";
import type { EmbeddingProvider } from "./embedding-providers";

const enabledConfig = {
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

let db: Database.Database;

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function insertMemory(input: {
  id: string;
  content: string;
  sensitivity?: MemorySensitivity;
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

function fakeProvider(): EmbeddingProvider & { calls: string[] } {
  const provider = {
    id: "fake",
    model: "test-embed",
    dimension: 3,
    calls: [] as string[],
    async embed(input: { text: string }) {
      provider.calls.push(input.text);
      return {
        embedding: [0.25, 0.5, 0.75],
        model: "test-embed",
        dimension: 3,
        provider: "fake",
      };
    },
  };
  return provider;
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("embedLongTermMemory", () => {
  it("stores an embedding row for accepted public/personal memory", async () => {
    insertMemory({
      id: "mem-public",
      content: "Public memory",
      sensitivity: "public",
    });
    const provider = fakeProvider();

    const result = await embedLongTermMemory({
      db,
      memoryId: "mem-public",
      config: enabledConfig,
      provider,
      now: () => 2_000,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "created",
      memoryId: "mem-public",
      cached: false,
    });
    const row = getMemoryEmbedding(db, {
      memoryId: "mem-public",
      model: "test-embed",
      dim: 3,
    });
    expect(row).toMatchObject({
      memory_id: "mem-public",
      category: "long_term_memory",
      model: "test-embed",
      dim: 3,
      created_at: 2_000,
    });
    expect(embeddingBlobToVector(row!.embedding)).toEqual([0.25, 0.5, 0.75]);
  });

  it("uses content-hash cache for duplicate content", async () => {
    insertMemory({ id: "mem-a", content: "Duplicate content" });
    insertMemory({ id: "mem-b", content: "Duplicate content" });
    const provider = fakeProvider();

    await embedLongTermMemory({
      db,
      memoryId: "mem-a",
      config: enabledConfig,
      provider,
      now: () => 2_000,
    });
    const result = await embedLongTermMemory({
      db,
      memoryId: "mem-b",
      config: enabledConfig,
      provider,
      now: () => 3_000,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "created",
      cached: true,
      provider: "cache",
    } satisfies Partial<Extract<EmbedMemoryResult, { ok: true }>>);
    expect(provider.calls).toEqual(["Duplicate content"]);
    expect(
      getMemoryEmbedding(db, {
        memoryId: "mem-b",
        model: "test-embed",
        dim: 3,
      })?.created_at,
    ).toBe(3_000);
  });

  it("refuses sensitive and restricted memory rows", async () => {
    insertMemory({
      id: "mem-sensitive",
      content: "Sensitive content",
      sensitivity: "sensitive",
    });
    insertMemory({
      id: "mem-restricted",
      content: "Restricted content",
      sensitivity: "restricted",
    });
    const provider = fakeProvider();

    await expect(
      embedLongTermMemory({
        db,
        memoryId: "mem-sensitive",
        config: enabledConfig,
        provider,
      }),
    ).resolves.toEqual({
      ok: false,
      status: "denied",
      reason: "memory_sensitivity_not_embeddable",
    });
    await expect(
      embedLongTermMemory({
        db,
        memoryId: "mem-restricted",
        config: enabledConfig,
        provider,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "denied",
    });
    expect(provider.calls).toEqual([]);
  });

  it("emits memory_embedding_created telemetry", async () => {
    insertMemory({ id: "mem-telemetry", content: "Telemetry memory" });

    await embedLongTermMemory({
      db,
      memoryId: "mem-telemetry",
      config: enabledConfig,
      provider: fakeProvider(),
      now: () => 4_000,
      sessionId: "session-1",
      executionId: "manual-embed",
    });

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "memory_embedding_created",
    );
    expect(event).toMatchObject({
      timestamp: 4_000,
      success: 1,
      session_id: "session-1",
      execution_id: "manual-embed",
      tool_name: "memory.embedding",
    });
    expect(event?.notes).toContain("memory_id=mem-telemetry");
    expect(event?.notes).toContain("cache=miss");
  });

  it("does not generate embeddings when disabled", async () => {
    insertMemory({ id: "mem-disabled", content: "Disabled memory" });

    await expect(
      embedLongTermMemory({
        db,
        memoryId: "mem-disabled",
        config: { ...enabledConfig, enabled: false },
        provider: fakeProvider(),
      }),
    ).resolves.toEqual({
      ok: false,
      status: "disabled",
      reason: "embeddings_disabled",
    });
  });
});
