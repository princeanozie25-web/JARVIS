import type DatabaseType from "better-sqlite3";
import type {
  LongTermMemoryCategory,
  LongTermMemoryRow,
  LongTermMemorySearchRow,
  MemorySensitivity,
  SearchableMemorySensitivity,
} from "../memory/types";

export interface InsertLongTermMemoryInput {
  id: string;
  category: LongTermMemoryRow["category"];
  content: string;
  source: LongTermMemoryRow["source"];
  source_id?: string | null;
  project?: string | null;
  tags_json: string;
  sensitivity: LongTermMemoryRow["sensitivity"];
  created_at: number;
  updated_at: number;
  obsidian_path?: string | null;
  hash: string;
  status?: LongTermMemoryRow["status"];
}

export function insertLongTermMemory(
  db: DatabaseType.Database,
  input: InsertLongTermMemoryInput,
): void {
  db.prepare(
    `INSERT INTO long_term_memory (
       id, category, content, source, source_id, project, tags_json,
       sensitivity, created_at, updated_at, obsidian_path, hash, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.category,
    input.content,
    input.source,
    input.source_id ?? null,
    input.project ?? null,
    input.tags_json,
    input.sensitivity,
    input.created_at,
    input.updated_at,
    input.obsidian_path ?? null,
    input.hash,
    input.status ?? "active",
  );
}

export function deleteLongTermMemory(
  db: DatabaseType.Database,
  id: string,
): void {
  db.prepare("DELETE FROM long_term_memory WHERE id = ?").run(id);
}

export function listLongTermMemory(
  db: DatabaseType.Database,
  limit: number = 100,
): LongTermMemoryRow[] {
  return db
    .prepare(
      `SELECT *
       FROM long_term_memory
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as LongTermMemoryRow[];
}

export function getLongTermMemory(
  db: DatabaseType.Database,
  id: string,
): LongTermMemoryRow | undefined {
  return db.prepare("SELECT * FROM long_term_memory WHERE id = ?").get(id) as
    | LongTermMemoryRow
    | undefined;
}

export const MAX_MEMORY_SEARCH_RESULTS = 20;

export interface SearchLongTermMemoryInput {
  query?: string;
  category?: LongTermMemoryCategory;
  project?: string;
  tag?: string;
  maxResults?: number;
  sensitivityCeiling?: SearchableMemorySensitivity;
}

function normalizeSearchLimit(maxResults?: number): number {
  if (maxResults === undefined) return 8;
  if (!Number.isFinite(maxResults)) return 8;
  return Math.min(
    Math.max(Math.trunc(maxResults), 1),
    MAX_MEMORY_SEARCH_RESULTS,
  );
}

function sensitivitiesForCeiling(
  ceiling: SearchableMemorySensitivity = "personal",
): SearchableMemorySensitivity[] {
  return ceiling === "public" ? ["public"] : ["public", "personal"];
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim().replace(/^#+/, "");
  const safe = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe ? `#${safe}` : "";
}

function ftsQuery(query: string): string | null {
  const tokens = query.match(/[A-Za-z0-9_/-]+/g) ?? [];
  const safeTokens = tokens
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((token) => `"${token.replace(/"/g, '""')}"`);
  return safeTokens.length > 0 ? safeTokens.join(" ") : null;
}

export function searchLongTermMemory(
  db: DatabaseType.Database,
  input: SearchLongTermMemoryInput,
): LongTermMemorySearchRow[] {
  const limit = normalizeSearchLimit(input.maxResults);
  const sensitivities = sensitivitiesForCeiling(input.sensitivityCeiling);
  const query = input.query?.trim() ? ftsQuery(input.query) : null;
  if (input.query?.trim() && !query) return [];

  const where: string[] = [
    "ltm.status = 'active'",
    `ltm.sensitivity IN (${sensitivities.map(() => "?").join(", ")})`,
  ];
  const params: unknown[] = [...sensitivities];

  if (input.category) {
    where.push("ltm.category = ?");
    params.push(input.category);
  }
  if (input.project?.trim()) {
    where.push("ltm.project = ?");
    params.push(input.project.trim());
  }
  if (input.tag?.trim()) {
    const tag = normalizeTag(input.tag);
    if (tag) {
      where.push(
        "EXISTS (SELECT 1 FROM json_each(ltm.tags_json) WHERE value = ?)",
      );
      params.push(tag);
    }
  }

  if (query) {
    return db
      .prepare(
        `SELECT ltm.*, bm25(long_term_memory_fts) AS rank
         FROM long_term_memory_fts
         JOIN long_term_memory ltm ON ltm.id = long_term_memory_fts.memory_id
         WHERE long_term_memory_fts MATCH ?
           AND ${where.join(" AND ")}
         ORDER BY rank ASC, ltm.created_at DESC
         LIMIT ?`,
      )
      .all(query, ...params, limit) as LongTermMemorySearchRow[];
  }

  return db
    .prepare(
      `SELECT ltm.*, NULL AS rank
       FROM long_term_memory ltm
       WHERE ${where.join(" AND ")}
       ORDER BY ltm.created_at DESC
       LIMIT ?`,
    )
    .all(...params, limit) as LongTermMemorySearchRow[];
}

export function normalizeMemorySearchLimit(maxResults?: number): number {
  return normalizeSearchLimit(maxResults);
}

export interface MemoryEmbeddingRow {
  memory_id: string;
  category: string;
  embedding: Buffer;
  model: string;
  dim: number;
  created_at: number;
}

export interface UpsertMemoryEmbeddingInput {
  memoryId: string;
  category: string;
  embedding: Buffer;
  model: string;
  dim: number;
  createdAt: number;
}

export function upsertMemoryEmbedding(
  db: DatabaseType.Database,
  input: UpsertMemoryEmbeddingInput,
): void {
  db.prepare(
    `INSERT INTO memory_embeddings (
       memory_id, category, embedding, model, dim, created_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(memory_id) DO UPDATE SET
       category = excluded.category,
       embedding = excluded.embedding,
       model = excluded.model,
       dim = excluded.dim,
       created_at = excluded.created_at`,
  ).run(
    input.memoryId,
    input.category,
    input.embedding,
    input.model,
    input.dim,
    input.createdAt,
  );
}

export function getMemoryEmbedding(
  db: DatabaseType.Database,
  input: { memoryId: string; model: string; dim: number },
): MemoryEmbeddingRow | undefined {
  return db
    .prepare(
      `SELECT *
       FROM memory_embeddings
       WHERE memory_id = ? AND model = ? AND dim = ?`,
    )
    .get(input.memoryId, input.model, input.dim) as
    | MemoryEmbeddingRow
    | undefined;
}

export function findCachedEmbeddingByContentHash(
  db: DatabaseType.Database,
  input: {
    contentHash: string;
    model: string;
    dim: number;
    excludeMemoryId?: string;
    allowedSensitivities?: MemorySensitivity[];
  },
): MemoryEmbeddingRow | undefined {
  const sensitivities = input.allowedSensitivities ?? ["public", "personal"];
  const params: unknown[] = [
    input.contentHash,
    input.model,
    input.dim,
    ...sensitivities,
  ];
  const excludeClause = input.excludeMemoryId ? "AND ltm.id <> ?" : "";
  if (input.excludeMemoryId) params.push(input.excludeMemoryId);

  return db
    .prepare(
      `SELECT emb.*
       FROM memory_embeddings emb
       JOIN long_term_memory ltm ON ltm.id = emb.memory_id
       WHERE ltm.hash = ?
         AND emb.model = ?
         AND emb.dim = ?
         AND ltm.sensitivity IN (${sensitivities.map(() => "?").join(", ")})
         ${excludeClause}
       ORDER BY emb.created_at DESC
       LIMIT 1`,
    )
    .get(...params) as MemoryEmbeddingRow | undefined;
}

export function listMemoryEmbeddingsForVectorSync(
  db: DatabaseType.Database,
  input: { dimension?: number; model?: string; limit?: number } = {},
): MemoryEmbeddingRow[] {
  const where: string[] = [
    "ltm.status = 'active'",
    "ltm.sensitivity IN ('public', 'personal')",
  ];
  const params: unknown[] = [];

  if (input.dimension) {
    where.push("emb.dim = ?");
    params.push(input.dimension);
  }
  if (input.model) {
    where.push("emb.model = ?");
    params.push(input.model);
  }

  params.push(Math.min(Math.max(Math.trunc(input.limit ?? 500), 1), 5_000));

  return db
    .prepare(
      `SELECT emb.*
       FROM memory_embeddings emb
       JOIN long_term_memory ltm ON ltm.id = emb.memory_id
       WHERE ${where.join(" AND ")}
       ORDER BY emb.created_at ASC
       LIMIT ?`,
    )
    .all(...params) as MemoryEmbeddingRow[];
}
