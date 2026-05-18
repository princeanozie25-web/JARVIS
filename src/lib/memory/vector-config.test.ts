import { describe, expect, it } from "vitest";
import { vectorStoreConfigFromEnv } from "./vector-config";

describe("vectorStoreConfigFromEnv", () => {
  it("loads disabled LanceDB defaults", () => {
    expect(
      vectorStoreConfigFromEnv({} as NodeJS.ProcessEnv, "C:\\jarvis"),
    ).toEqual({
      enabled: false,
      provider: "lancedb",
      path: "C:\\jarvis\\data\\lancedb",
      tableName: "memory_embeddings",
      dimension: 768,
    });
  });

  it("loads explicit vector store config", () => {
    expect(
      vectorStoreConfigFromEnv({
        JARVIS_MEMORY_VECTOR_STORE_ENABLED: "true",
        JARVIS_MEMORY_VECTOR_STORE_PATH: "D:\\vectors",
        JARVIS_MEMORY_VECTOR_STORE_TABLE: "jarvis_memory",
        JARVIS_MEMORY_VECTOR_STORE_DIMENSION: "384",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      enabled: true,
      provider: "lancedb",
      path: "D:\\vectors",
      tableName: "jarvis_memory",
      dimension: 384,
    });
  });
});
