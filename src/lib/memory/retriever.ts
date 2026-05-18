import { createHash } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import {
  listLongTermMemoryByIds,
  normalizeMemorySearchLimit,
  searchLongTermMemory,
} from "../db/memory";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  embeddingConfigFromEnv,
  type EmbeddingConfig,
} from "./embedding-config";
import {
  embeddingProviderFromConfig,
  type EmbeddingProvider,
} from "./embedding-providers";
import {
  vectorStoreConfigFromEnv,
  type VectorStoreConfig,
} from "./vector-config";
import { manualVectorSimilaritySearch } from "./vector-sync";
import { vectorStoreFromConfig, type VectorStore } from "./vector-store";
import type {
  LongTermMemoryCategory,
  LongTermMemoryRow,
  SearchableMemorySensitivity,
} from "./types";

const RRF_K = 60;

export type MemoryRetrievalMode = "keyword_only" | "vector_only" | "hybrid";
export type MemoryRetrievalSourceType = "keyword" | "vector" | "hybrid";

export interface MemoryRetrieverInput {
  query: string;
  category?: LongTermMemoryCategory;
  project?: string;
  tag?: string;
  sensitivityCeiling?: SearchableMemorySensitivity;
  maxResults?: number;
  sessionId?: string;
  executionId?: string;
  signal?: AbortSignal;
  intent?: string;
  safetyTag?: string;
  tier?: string;
  modelId?: string;
}

export interface MemoryRetrievalScore {
  keywordRank: number | null;
  vectorRank: number | null;
  fusedScore: number;
  sourceType: MemoryRetrievalSourceType;
}

export interface MemoryRetrievalResult extends LongTermMemoryRow {
  score: MemoryRetrievalScore;
}

export interface MemoryRetrieverResult {
  mode: MemoryRetrievalMode;
  results: MemoryRetrievalResult[];
}

export interface MemoryRetrieverDeps {
  embeddingConfig?: EmbeddingConfig;
  embeddingProvider?: EmbeddingProvider;
  vectorConfig?: VectorStoreConfig;
  vectorStore?: VectorStore;
  now?: () => number;
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function reciprocalRankFusionScore(
  keywordRank: number | null,
  vectorRank: number | null,
  k: number = RRF_K,
): number {
  return (
    (keywordRank ? 1 / (k + keywordRank) : 0) +
    (vectorRank ? 1 / (k + vectorRank) : 0)
  );
}

function sourceType(
  keywordRank: number | null,
  vectorRank: number | null,
): MemoryRetrievalSourceType {
  if (keywordRank && vectorRank) return "hybrid";
  return keywordRank ? "keyword" : "vector";
}

function modeFor(input: {
  keywordCount: number;
  vectorCount: number;
}): MemoryRetrievalMode {
  if (input.keywordCount > 0 && input.vectorCount > 0) return "hybrid";
  if (input.vectorCount > 0) return "vector_only";
  return "keyword_only";
}

function normalizeResultLimit(maxResults?: number): number {
  return normalizeMemorySearchLimit(maxResults);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export class MemoryRetriever {
  constructor(
    private readonly db: DatabaseType.Database,
    private readonly deps: MemoryRetrieverDeps = {},
  ) {}

  async retrieve(input: MemoryRetrieverInput): Promise<MemoryRetrieverResult> {
    const limit = normalizeResultLimit(input.maxResults);
    const keywordRows = searchLongTermMemory(this.db, {
      query: input.query,
      category: input.category,
      project: input.project,
      tag: input.tag,
      sensitivityCeiling: input.sensitivityCeiling,
      maxResults: limit,
    });
    const keywordRanks = new Map<string, number>();
    keywordRows.forEach((row, index) => {
      keywordRanks.set(row.id, index + 1);
    });

    const vectorRanks = await this.vectorRanks(input, limit);
    const rowById = new Map<string, LongTermMemoryRow>();
    for (const row of keywordRows) {
      rowById.set(row.id, row);
    }
    if (vectorRanks.size > 0) {
      const vectorRows = listLongTermMemoryByIds(this.db, {
        ids: Array.from(vectorRanks.keys()),
        category: input.category,
        project: input.project,
        tag: input.tag,
        sensitivityCeiling: input.sensitivityCeiling,
      });
      const allowedIds = new Set(vectorRows.map((row) => row.id));
      for (const id of Array.from(vectorRanks.keys())) {
        if (!allowedIds.has(id)) {
          vectorRanks.delete(id);
        }
      }
      for (const row of vectorRows) {
        rowById.set(row.id, row);
      }
    }

    const results = Array.from(rowById.values())
      .map((row) => {
        const keywordRank = keywordRanks.get(row.id) ?? null;
        const vectorRank = vectorRanks.get(row.id) ?? null;
        return {
          ...row,
          score: {
            keywordRank,
            vectorRank,
            fusedScore: reciprocalRankFusionScore(keywordRank, vectorRank),
            sourceType: sourceType(keywordRank, vectorRank),
          },
        };
      })
      .sort((left, right) => {
        const scoreDelta = right.score.fusedScore - left.score.fusedScore;
        if (scoreDelta !== 0) return scoreDelta;
        return right.created_at - left.created_at;
      })
      .slice(0, limit);

    const mode = modeFor({
      keywordCount: keywordRanks.size,
      vectorCount: vectorRanks.size,
    });
    this.emitReadTelemetry(input, mode, results);
    return { mode, results };
  }

  private async vectorRanks(
    input: MemoryRetrieverInput,
    limit: number,
  ): Promise<Map<string, number>> {
    const embeddingConfig =
      this.deps.embeddingConfig ?? embeddingConfigFromEnv();
    const vectorConfig = this.deps.vectorConfig ?? vectorStoreConfigFromEnv();
    if (!embeddingConfig.enabled || !vectorConfig.enabled) {
      return new Map();
    }

    const vectorStore =
      this.deps.vectorStore ?? vectorStoreFromConfig(vectorConfig);
    if (!vectorStore.enabled) return new Map();

    try {
      const provider =
        this.deps.embeddingProvider ??
        embeddingProviderFromConfig(embeddingConfig);
      const embedding = await provider.embed({
        text: input.query,
        signal: input.signal,
      });
      const vectorResults = await manualVectorSimilaritySearch({
        db: this.db,
        vector: embedding.embedding,
        config: vectorConfig,
        store: vectorStore,
        model: embedding.model,
        maxResults: limit,
        now: this.deps.now,
        sessionId: input.sessionId,
        executionId: input.executionId,
      });
      const ranks = new Map<string, number>();
      vectorResults.forEach((result, index) => {
        ranks.set(result.memoryId, index + 1);
      });
      return ranks;
    } catch {
      return new Map();
    }
  }

  private emitReadTelemetry(
    input: MemoryRetrieverInput,
    mode: MemoryRetrievalMode,
    results: MemoryRetrievalResult[],
  ): void {
    insertTelemetryEvent(this.db, {
      timestamp: this.deps.now?.() ?? Date.now(),
      event_type: "memory_read",
      success: true,
      session_id: input.sessionId,
      execution_id: input.executionId,
      tool_name: "memory.recall",
      intent: input.intent,
      safety_tag: input.safetyTag,
      tier: input.tier,
      model_id: input.modelId,
      notes: `mode=${mode} query_sha256=${sha256(input.query)} category=${input.category ?? "any"} project=${input.project ? "set" : "any"} tag=${input.tag ? "set" : "any"} sensitivity_ceiling=${input.sensitivityCeiling ?? "personal"} result_ids=${JSON.stringify(results.map((row) => row.id))}`,
    });
  }
}

export function memoryRetrievalResultToToolData(row: MemoryRetrievalResult) {
  return {
    id: row.id,
    category: row.category,
    content: row.content,
    source: row.source,
    sourceId: row.source_id,
    project: row.project,
    tags: parseTags(row.tags_json),
    sensitivity: row.sensitivity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    obsidianPath: row.obsidian_path,
    score: row.score,
  };
}

export { RRF_K };
