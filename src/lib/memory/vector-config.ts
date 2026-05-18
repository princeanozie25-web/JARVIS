import { join } from "node:path";

export type VectorStoreProviderName = "lancedb";

export interface VectorStoreConfig {
  enabled: boolean;
  provider: VectorStoreProviderName;
  path: string;
  tableName: string;
  dimension: number;
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

export function vectorStoreConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): VectorStoreConfig {
  return {
    enabled: booleanEnv(env.JARVIS_MEMORY_VECTOR_STORE_ENABLED, false),
    provider: "lancedb",
    path:
      env.JARVIS_MEMORY_VECTOR_STORE_PATH?.trim() ||
      join(cwd, "data", "lancedb"),
    tableName:
      env.JARVIS_MEMORY_VECTOR_STORE_TABLE?.trim() || "memory_embeddings",
    dimension: integerEnv(env.JARVIS_MEMORY_VECTOR_STORE_DIMENSION, 768),
  };
}
