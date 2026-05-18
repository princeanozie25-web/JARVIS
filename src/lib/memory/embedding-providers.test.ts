import { describe, expect, it } from "vitest";
import {
  FallbackEmbeddingProvider,
  OllamaEmbeddingProvider,
  type EmbeddingProvider,
} from "./embedding-providers";

describe("EmbeddingProvider interface", () => {
  it("supports deterministic provider implementations", async () => {
    const provider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimension: 2,
      async embed() {
        return {
          embedding: [0.1, 0.2],
          model: "fake-model",
          dimension: 2,
          provider: "fake",
        };
      },
    };

    await expect(provider.embed({ text: "hello" })).resolves.toMatchObject({
      embedding: [0.1, 0.2],
      model: "fake-model",
      dimension: 2,
      provider: "fake",
    });
  });

  it("calls Ollama embedding endpoint and validates the vector", async () => {
    const calls: unknown[] = [];
    const provider = new OllamaEmbeddingProvider("nomic-embed-text-v1.5", 3, {
      baseUrl: "http://ollama.test",
      fetchImpl: (async (url, init) => {
        calls.push({ url, init });
        return Response.json({ embedding: [1, 2, 3] });
      }) as typeof fetch,
    });

    await expect(provider.embed({ text: "memory" })).resolves.toEqual({
      embedding: [1, 2, 3],
      model: "nomic-embed-text-v1.5",
      dimension: 3,
      provider: "ollama",
    });
    expect(calls).toHaveLength(1);
  });

  it("falls back when the primary provider is unavailable", async () => {
    const primary: EmbeddingProvider = {
      id: "primary",
      model: "primary-model",
      dimension: 2,
      async embed() {
        throw new Error("offline");
      },
    };
    const fallback: EmbeddingProvider = {
      id: "fallback",
      model: "fallback-model",
      dimension: 2,
      async embed() {
        return {
          embedding: [3, 4],
          model: "fallback-model",
          dimension: 2,
          provider: "fallback",
        };
      },
    };

    await expect(
      new FallbackEmbeddingProvider(primary, fallback).embed({ text: "x" }),
    ).resolves.toMatchObject({
      embedding: [3, 4],
      provider: "fallback",
    });
  });
});
