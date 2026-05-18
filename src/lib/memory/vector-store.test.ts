import { describe, expect, it } from "vitest";
import {
  DisabledVectorStore,
  LanceDbVectorStore,
  vectorStoreFromConfig,
  type VectorStore,
} from "./vector-store";

const enabledConfig = {
  enabled: true,
  provider: "lancedb" as const,
  path: "C:\\vectors",
  tableName: "memory_embeddings",
  dimension: 3,
};

describe("VectorStore interface", () => {
  it("supports deterministic implementations", async () => {
    const store: VectorStore = {
      id: "fake",
      enabled: true,
      async upsert() {
        return undefined;
      },
      async search() {
        return [{ memoryId: "mem-1", score: 0.9 }];
      },
    };

    await expect(store.search([1, 0, 0])).resolves.toEqual([
      { memoryId: "mem-1", score: 0.9 },
    ]);
  });

  it("returns disabled store when vector config is disabled", async () => {
    const store = vectorStoreFromConfig({ ...enabledConfig, enabled: false });

    expect(store).toBeInstanceOf(DisabledVectorStore);
    expect(store.enabled).toBe(false);
    await expect(store.search([1, 0, 0])).rejects.toThrow(
      "Vector store is disabled.",
    );
  });

  it("adapts LanceDB upsert and search calls behind the interface", async () => {
    const added: unknown[] = [];
    const table = {
      async add(records: unknown[]) {
        added.push(...records);
      },
      search(vector: number[]) {
        expect(vector).toEqual([1, 0, 0]);
        return {
          limit(count: number) {
            expect(count).toBe(1);
            return {
              async toArray() {
                return [
                  {
                    memory_id: "mem-lance",
                    vector: [1, 0, 0],
                    category: "long_term_memory",
                    model: "test",
                    dim: 3,
                    created_at: 1_000,
                    _distance: 0.25,
                  },
                ];
              },
            };
          },
        };
      },
    };
    const store = new LanceDbVectorStore(enabledConfig, async () => ({
      async connect() {
        return {
          async openTable() {
            return table;
          },
          async createTable() {
            return table;
          },
        };
      },
    }));

    await store.upsert([
      {
        memoryId: "mem-lance",
        category: "long_term_memory",
        vector: [1, 0, 0],
        model: "test",
        dimension: 3,
        createdAt: 1_000,
      },
    ]);
    await expect(
      store.search([1, 0, 0], { maxResults: 1, dimension: 3 }),
    ).resolves.toEqual([
      {
        memoryId: "mem-lance",
        score: 0.8,
        distance: 0.25,
        model: "test",
        dimension: 3,
      },
    ]);
    expect(added).toHaveLength(1);
  });
});
