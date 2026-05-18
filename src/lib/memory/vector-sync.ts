import type DatabaseType from "better-sqlite3";
import { listMemoryEmbeddingsForVectorSync } from "../db/memory";
import { insertTelemetryEvent } from "../db/telemetry";
import { embeddingBlobToVector } from "./embeddings";
import {
  vectorStoreConfigFromEnv,
  type VectorStoreConfig,
} from "./vector-config";
import {
  vectorStoreFromConfig,
  type VectorSearchResult,
  type VectorStore,
  type VectorStoreRecord,
} from "./vector-store";

export type VectorSyncResult =
  | {
      ok: true;
      status: "synced";
      count: number;
    }
  | {
      ok: false;
      status: "disabled" | "error";
      reason: string;
    };

export interface SyncMemoryEmbeddingsToVectorStoreInput {
  db: DatabaseType.Database;
  config?: VectorStoreConfig;
  store?: VectorStore;
  model?: string;
  limit?: number;
}

export interface ManualVectorSearchInput {
  db: DatabaseType.Database;
  vector: number[];
  config?: VectorStoreConfig;
  store?: VectorStore;
  model?: string;
  maxResults?: number;
  now?: () => number;
  sessionId?: string;
  executionId?: string;
}

function rowToRecord(row: {
  memory_id: string;
  category: string;
  embedding: Buffer;
  model: string;
  dim: number;
  created_at: number;
}): VectorStoreRecord {
  return {
    memoryId: row.memory_id,
    category: row.category,
    vector: embeddingBlobToVector(row.embedding),
    model: row.model,
    dimension: row.dim,
    createdAt: row.created_at,
  };
}

function normalizeMaxResults(maxResults?: number): number {
  if (!Number.isFinite(maxResults)) return 8;
  return Math.min(Math.max(Math.trunc(maxResults ?? 8), 1), 20);
}

export async function syncMemoryEmbeddingsToVectorStore(
  input: SyncMemoryEmbeddingsToVectorStoreInput,
): Promise<VectorSyncResult> {
  const config = input.config ?? vectorStoreConfigFromEnv();
  const store = input.store ?? vectorStoreFromConfig(config);
  if (!config.enabled || !store.enabled) {
    return {
      ok: false,
      status: "disabled",
      reason: "vector_store_disabled",
    };
  }

  try {
    const rows = listMemoryEmbeddingsForVectorSync(input.db, {
      dimension: config.dimension,
      model: input.model,
      limit: input.limit,
    });
    await store.upsert(rows.map(rowToRecord));
    return {
      ok: true,
      status: "synced",
      count: rows.length,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function manualVectorSimilaritySearch(
  input: ManualVectorSearchInput,
): Promise<VectorSearchResult[]> {
  const config = input.config ?? vectorStoreConfigFromEnv();
  const store = input.store ?? vectorStoreFromConfig(config);
  if (!config.enabled || !store.enabled) {
    throw new Error("Vector store is disabled.");
  }

  const maxResults = normalizeMaxResults(input.maxResults);
  const results = await store.search(input.vector, {
    maxResults,
    model: input.model,
    dimension: config.dimension,
  });
  insertTelemetryEvent(input.db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "memory_vector_search",
    success: true,
    session_id: input.sessionId,
    execution_id: input.executionId,
    tool_name: "memory.vector_search",
    notes: `dim=${config.dimension} model=${input.model ?? "any"} max_results=${maxResults} result_ids=${JSON.stringify(results.map((result) => result.memoryId))}`,
  });
  return results;
}
