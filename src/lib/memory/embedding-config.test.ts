import { describe, expect, it } from "vitest";
import { embeddingConfigFromEnv } from "./embedding-config";

describe("embeddingConfigFromEnv", () => {
  it("loads disabled local Ollama defaults", () => {
    expect(embeddingConfigFromEnv({} as NodeJS.ProcessEnv)).toMatchObject({
      enabled: false,
      provider: "ollama",
      model: "nomic-embed-text-v1.5",
      dimension: 768,
      timeoutMs: 10_000,
      ollamaBaseUrl: "http://127.0.0.1:11434",
      fallbackProvider: "transformers",
      fallbackModel: "all-MiniLM-L6-v2",
      fallbackDimension: 384,
    });
  });

  it("loads explicit transformers config", () => {
    expect(
      embeddingConfigFromEnv({
        JARVIS_MEMORY_EMBEDDINGS_ENABLED: "true",
        JARVIS_MEMORY_EMBEDDING_PROVIDER: "transformers",
        JARVIS_MEMORY_EMBEDDING_MODEL: "custom-mini",
        JARVIS_MEMORY_EMBEDDING_DIMENSION: "123",
        JARVIS_MEMORY_EMBEDDING_TIMEOUT_MS: "2500",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({
      enabled: true,
      provider: "transformers",
      model: "custom-mini",
      dimension: 123,
      timeoutMs: 2_500,
    });
  });
});
