import type DatabaseType from "better-sqlite3";
import {
  findCachedEmbeddingByContentHash,
  getLongTermMemory,
  getMemoryEmbedding,
  upsertMemoryEmbedding,
} from "../db/memory";
import { insertTelemetryEvent } from "../db/telemetry";
import type { MemorySensitivity } from "./types";
import {
  embeddingConfigFromEnv,
  type EmbeddingConfig,
} from "./embedding-config";
import {
  embeddingProviderFromConfig,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "./embedding-providers";

export type EmbedMemoryResult =
  | {
      ok: true;
      status: "created" | "cache_hit";
      memoryId: string;
      model: string;
      dimension: number;
      provider: string;
      cached: boolean;
    }
  | {
      ok: false;
      status: "disabled" | "denied" | "missing" | "error";
      reason: string;
    };

export interface EmbedLongTermMemoryInput {
  db: DatabaseType.Database;
  memoryId: string;
  config?: EmbeddingConfig;
  provider?: EmbeddingProvider;
  now?: () => number;
  sessionId?: string;
  executionId?: string;
  signal?: AbortSignal;
}

export function embeddingVectorToBlob(vector: number[]): Buffer {
  const buffer = Buffer.alloc(vector.length * 4);
  vector.forEach((value, index) => {
    buffer.writeFloatLE(value, index * 4);
  });
  return buffer;
}

export function embeddingBlobToVector(blob: Buffer): number[] {
  const vector: number[] = [];
  for (let index = 0; index < blob.byteLength; index += 4) {
    vector.push(blob.readFloatLE(index));
  }
  return vector;
}

function isEmbeddableSensitivity(sensitivity: MemorySensitivity): boolean {
  return sensitivity === "public" || sensitivity === "personal";
}

function modelKey(result: EmbeddingResult): {
  model: string;
  dimension: number;
  provider: string;
} {
  return {
    model: result.model,
    dimension: result.dimension,
    provider: result.provider,
  };
}

function emitEmbeddingCreated(
  input: EmbedLongTermMemoryInput,
  event: {
    memoryId: string;
    model: string;
    dimension: number;
    provider: string;
    cached: boolean;
  },
): void {
  insertTelemetryEvent(input.db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "memory_embedding_created",
    success: true,
    session_id: input.sessionId,
    execution_id: input.executionId,
    tool_name: "memory.embedding",
    notes: `memory_id=${event.memoryId} model=${event.model} dim=${event.dimension} provider=${event.provider} cache=${event.cached ? "hit" : "miss"}`,
  });
}

function embedWithTimeout(input: {
  provider: EmbeddingProvider;
  text: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<EmbeddingResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("Embedding generation timed out."));
  }, input.timeoutMs);
  const abortFromParent = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", abortFromParent, { once: true });

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        reject(
          controller.signal.reason instanceof Error
            ? controller.signal.reason
            : new Error("Embedding generation aborted."),
        );
      },
      { once: true },
    );
  });

  const embedPromise = input.provider.embed({
    text: input.text,
    signal: controller.signal,
  });

  return Promise.race([embedPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromParent);
  });
}

export async function embedLongTermMemory(
  input: EmbedLongTermMemoryInput,
): Promise<EmbedMemoryResult> {
  const config = input.config ?? embeddingConfigFromEnv();
  if (!config.enabled) {
    return {
      ok: false,
      status: "disabled",
      reason: "embeddings_disabled",
    };
  }

  const memory = getLongTermMemory(input.db, input.memoryId);
  if (!memory) {
    return { ok: false, status: "missing", reason: "memory_missing" };
  }
  if (!isEmbeddableSensitivity(memory.sensitivity)) {
    return {
      ok: false,
      status: "denied",
      reason: "memory_sensitivity_not_embeddable",
    };
  }

  const existing = getMemoryEmbedding(input.db, {
    memoryId: memory.id,
    model: config.model,
    dim: config.dimension,
  });
  if (existing) {
    return {
      ok: true,
      status: "cache_hit",
      memoryId: memory.id,
      model: existing.model,
      dimension: existing.dim,
      provider: "cache",
      cached: true,
    };
  }

  const cached = findCachedEmbeddingByContentHash(input.db, {
    contentHash: memory.hash,
    model: config.model,
    dim: config.dimension,
    excludeMemoryId: memory.id,
  });
  if (cached) {
    upsertMemoryEmbedding(input.db, {
      memoryId: memory.id,
      category: "long_term_memory",
      embedding: cached.embedding,
      model: cached.model,
      dim: cached.dim,
      createdAt: input.now?.() ?? Date.now(),
    });
    emitEmbeddingCreated(input, {
      memoryId: memory.id,
      model: cached.model,
      dimension: cached.dim,
      provider: "cache",
      cached: true,
    });
    return {
      ok: true,
      status: "created",
      memoryId: memory.id,
      model: cached.model,
      dimension: cached.dim,
      provider: "cache",
      cached: true,
    };
  }

  try {
    const provider = input.provider ?? embeddingProviderFromConfig(config);
    const result = await embedWithTimeout({
      provider,
      text: memory.content,
      timeoutMs: config.timeoutMs,
      signal: input.signal,
    });
    const key = modelKey(result);
    upsertMemoryEmbedding(input.db, {
      memoryId: memory.id,
      category: "long_term_memory",
      embedding: embeddingVectorToBlob(result.embedding),
      model: key.model,
      dim: key.dimension,
      createdAt: input.now?.() ?? Date.now(),
    });
    emitEmbeddingCreated(input, {
      memoryId: memory.id,
      model: key.model,
      dimension: key.dimension,
      provider: key.provider,
      cached: false,
    });
    return {
      ok: true,
      status: "created",
      memoryId: memory.id,
      model: key.model,
      dimension: key.dimension,
      provider: key.provider,
      cached: false,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
