import { describe, expect, it } from "vitest";
import { vectorStoreConfigFromEnv } from "./vector-config";

describe("vectorStoreConfigFromEnv", () => {
  it("loads disabled LanceDB defaults", () => {
    // E-025: an absolute cwd fixture for the running platform (Windows drive
    // path / POSIX root path); the joined default is asserted for both.
    const cwd = process.platform === "win32" ? "C:\\jarvis" : "/jarvis";
    const expectedPath =
      process.platform === "win32"
        ? "C:\\jarvis\\data\\lancedb"
        : "/jarvis/data/lancedb";
    expect(vectorStoreConfigFromEnv({} as NodeJS.ProcessEnv, cwd)).toEqual({
      enabled: false,
      provider: "lancedb",
      path: expectedPath,
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
