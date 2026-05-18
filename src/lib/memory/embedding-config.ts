export type EmbeddingProviderName = "ollama" | "transformers";

export interface EmbeddingConfig {
  enabled: boolean;
  provider: EmbeddingProviderName;
  model: string;
  dimension: number;
  timeoutMs: number;
  ollamaBaseUrl: string;
  fallbackProvider: "transformers";
  fallbackModel: string;
  fallbackDimension: number;
}

function booleanEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function integerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function providerEnv(value: string | undefined): EmbeddingProviderName {
  return value === "transformers" ? "transformers" : "ollama";
}

export function embeddingConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  const provider = providerEnv(env.JARVIS_MEMORY_EMBEDDING_PROVIDER);
  const defaultModel =
    provider === "transformers" ? "all-MiniLM-L6-v2" : "nomic-embed-text-v1.5";
  const defaultDimension = provider === "transformers" ? 384 : 768;

  return {
    enabled: booleanEnv(env.JARVIS_MEMORY_EMBEDDINGS_ENABLED, false),
    provider,
    model: env.JARVIS_MEMORY_EMBEDDING_MODEL?.trim() || defaultModel,
    dimension: integerEnv(
      env.JARVIS_MEMORY_EMBEDDING_DIMENSION,
      defaultDimension,
    ),
    timeoutMs: integerEnv(env.JARVIS_MEMORY_EMBEDDING_TIMEOUT_MS, 10_000),
    ollamaBaseUrl:
      env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    fallbackProvider: "transformers",
    fallbackModel:
      env.JARVIS_MEMORY_EMBEDDING_FALLBACK_MODEL?.trim() || "all-MiniLM-L6-v2",
    fallbackDimension: integerEnv(
      env.JARVIS_MEMORY_EMBEDDING_FALLBACK_DIMENSION,
      384,
    ),
  };
}
