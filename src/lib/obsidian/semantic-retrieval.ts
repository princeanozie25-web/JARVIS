import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import type DatabaseType from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import {
  OllamaEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "../memory/embedding-providers";
import { embeddingVectorToBlob } from "../memory/embeddings";
import {
  getObsidianNoteSnippet,
  OBSIDIAN_INDEX_MAX_NOTE_BYTES,
  ObsidianVaultPathError,
  type ObsidianNoteMetadata,
  type ObsidianSnippet,
  type ObsidianVaultIndex,
} from "./pull-indexer";

export const OBSIDIAN_SEMANTIC_MODEL_ID = "nomic-embed-text";
export const OBSIDIAN_SEMANTIC_DIMENSION = 768;
export const OBSIDIAN_SEMANTIC_METADATA_TABLE = "obsidian_note_vectors";
export const OBSIDIAN_SEMANTIC_DEFAULT_TOP_K = 5;
export const OBSIDIAN_SEMANTIC_MAX_TOP_K = 25;

export interface ObsidianSemanticConfig {
  readonly model: string;
  readonly dimension: number;
  readonly ollamaBaseUrl: string;
  readonly timeoutMs: number;
}

export interface PopulateObsidianVectorsInput {
  readonly db: DatabaseType.Database;
  readonly index: ObsidianVaultIndex;
  readonly config?: ObsidianSemanticConfig;
  readonly provider?: EmbeddingProvider;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
}

export interface ObsidianVectorPopulationReport {
  readonly status: "ok";
  readonly model: string;
  readonly dimension: number;
  readonly notes_seen: number;
  readonly vectors_created: number;
  readonly vectors_reused: number;
  readonly vector_store: "sqlite-vec";
  readonly metadata_only: true;
  readonly vault_mutated: false;
  readonly telemetry: {
    readonly metadata_only: true;
    readonly note_count: number;
    readonly vector_count: number;
    readonly embedding_model: string;
    readonly dimension: number;
    readonly embeddings_in_telemetry: false;
    readonly raw_body_in_telemetry: false;
  };
}

export interface ObsidianSemanticSearchInput {
  readonly db: DatabaseType.Database;
  readonly index: ObsidianVaultIndex;
  readonly query: string;
  readonly topK?: number;
  readonly includeSnippets?: boolean;
  readonly snippetMaxChars?: number;
  readonly config?: ObsidianSemanticConfig;
  readonly provider?: EmbeddingProvider;
  readonly signal?: AbortSignal;
}

export interface ObsidianSemanticHit {
  readonly note: ObsidianNoteMetadata;
  readonly score: number;
  readonly distance: number;
  readonly rank: number;
  readonly model: string;
  readonly dimension: number;
  readonly snippet?: ObsidianSnippet;
}

export interface ObsidianSemanticSearchResult {
  readonly status: "ok";
  readonly query_hash: string;
  readonly top_k: number;
  readonly model: string;
  readonly dimension: number;
  readonly hits: readonly ObsidianSemanticHit[];
  readonly telemetry: {
    readonly metadata_only: true;
    readonly query_hash: string;
    readonly result_count: number;
    readonly result_note_ids: readonly string[];
    readonly embedding_model: string;
    readonly dimension: number;
    readonly embeddings_in_telemetry: false;
    readonly raw_body_in_telemetry: false;
  };
}

interface ObsidianVectorMetadataRow {
  readonly rowid: number;
  readonly note_id: string;
  readonly path: string;
  readonly title: string;
  readonly tags_json: string;
  readonly content_hash: string;
  readonly model: string;
  readonly dim: number;
  readonly created_at: number;
  readonly updated_at: number;
}

interface SqliteVecSearchRow {
  readonly rowid: number;
  readonly distance: number;
}

export function obsidianSemanticConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ObsidianSemanticConfig {
  return {
    model: env.OBSIDIAN_EMBEDDING_MODEL?.trim() || OBSIDIAN_SEMANTIC_MODEL_ID,
    dimension: positiveInteger(
      env.OBSIDIAN_EMBEDDING_DIMENSION,
      OBSIDIAN_SEMANTIC_DIMENSION,
    ),
    ollamaBaseUrl:
      env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    timeoutMs: positiveInteger(env.OBSIDIAN_EMBEDDING_TIMEOUT_MS, 30_000),
  };
}

export function createObsidianLocalEmbeddingProvider(
  config: ObsidianSemanticConfig,
): EmbeddingProvider {
  return new OllamaEmbeddingProvider(config.model, config.dimension, {
    baseUrl: config.ollamaBaseUrl,
    timeoutMs: config.timeoutMs,
  });
}

export async function populateObsidianVectors(
  input: PopulateObsidianVectorsInput,
): Promise<ObsidianVectorPopulationReport> {
  const config = input.config ?? obsidianSemanticConfigFromEnv();
  const provider =
    input.provider ?? createObsidianLocalEmbeddingProvider(config);
  const now = input.now ?? Date.now;
  initializeObsidianVectorSchema(input.db, config.dimension);

  let vectorsCreated = 0;
  let vectorsReused = 0;

  for (const note of input.index.notes) {
    const text = await readEmbeddingText(input.index, note);
    const contentHash = hashValue(text);
    const existing = getVectorMetadata(input.db, note.id);

    if (
      existing &&
      existing.content_hash === contentHash &&
      existing.model === config.model &&
      existing.dim === config.dimension &&
      vectorRowExists(input.db, config.dimension, existing.rowid)
    ) {
      vectorsReused += 1;
      continue;
    }

    const embedding = await provider.embed({
      text,
      signal: input.signal,
    });
    assertEmbeddingResult(embedding, config);
    upsertObsidianVector(input.db, {
      note,
      contentHash,
      embedding: embedding.embedding,
      model: embedding.model,
      dimension: embedding.dimension,
      timestamp: now(),
    });
    vectorsCreated += 1;
  }

  return {
    status: "ok",
    model: config.model,
    dimension: config.dimension,
    notes_seen: input.index.notes.length,
    vectors_created: vectorsCreated,
    vectors_reused: vectorsReused,
    vector_store: "sqlite-vec",
    metadata_only: true,
    vault_mutated: false,
    telemetry: {
      metadata_only: true,
      note_count: input.index.notes.length,
      vector_count: vectorsCreated + vectorsReused,
      embedding_model: config.model,
      dimension: config.dimension,
      embeddings_in_telemetry: false,
      raw_body_in_telemetry: false,
    },
  };
}

export async function searchObsidianSemantic(
  input: ObsidianSemanticSearchInput,
): Promise<ObsidianSemanticSearchResult> {
  const config = input.config ?? obsidianSemanticConfigFromEnv();
  const provider =
    input.provider ?? createObsidianLocalEmbeddingProvider(config);
  const query = input.query.trim();
  if (!query) {
    throw new ObsidianVaultPathError(
      "Obsidian semantic query must be non-empty.",
      "filesystem_error",
    );
  }
  initializeObsidianVectorSchema(input.db, config.dimension);

  const queryEmbedding = await provider.embed({
    text: query,
    signal: input.signal,
  });
  assertEmbeddingResult(queryEmbedding, config);

  const topK = clampTopK(input.topK);
  const rows = searchVectorRows(
    input.db,
    config.dimension,
    queryEmbedding.embedding,
    topK * 2,
  );
  const notesById = new Map(input.index.notes.map((note) => [note.id, note]));
  const hits: ObsidianSemanticHit[] = [];

  for (const row of rows) {
    const metadata = getVectorMetadataByRowid(input.db, row.rowid);
    if (!metadata) continue;
    const note = notesById.get(metadata.note_id);
    if (!note) continue;
    const hit: ObsidianSemanticHit = {
      note,
      score: distanceToScore(row.distance),
      distance: row.distance,
      rank: hits.length + 1,
      model: config.model,
      dimension: config.dimension,
      snippet: input.includeSnippets
        ? ((await getObsidianNoteSnippet(input.index, {
            id: note.id,
            maxChars: input.snippetMaxChars,
          })) ?? undefined)
        : undefined,
    };
    hits.push(hit);
    if (hits.length >= topK) break;
  }

  const queryHash = hashValue(query);
  return {
    status: "ok",
    query_hash: queryHash,
    top_k: topK,
    model: config.model,
    dimension: config.dimension,
    hits,
    telemetry: {
      metadata_only: true,
      query_hash: queryHash,
      result_count: hits.length,
      result_note_ids: hits.map((hit) => hit.note.id),
      embedding_model: config.model,
      dimension: config.dimension,
      embeddings_in_telemetry: false,
      raw_body_in_telemetry: false,
    },
  };
}

export function initializeObsidianVectorSchema(
  db: DatabaseType.Database,
  dimension = OBSIDIAN_SEMANTIC_DIMENSION,
): void {
  sqliteVec.load(db);
  db.exec(`
CREATE TABLE IF NOT EXISTS ${OBSIDIAN_SEMANTIC_METADATA_TABLE} (
  rowid        INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id      TEXT NOT NULL UNIQUE,
  path         TEXT NOT NULL,
  title        TEXT NOT NULL,
  tags_json    TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  model        TEXT NOT NULL,
  dim          INTEGER NOT NULL CHECK (dim > 0),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_obsidian_note_vectors_model_dim
  ON ${OBSIDIAN_SEMANTIC_METADATA_TABLE} (model, dim);
`);
  db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS ${vectorTableName(dimension)}
USING vec0(
  note_rowid INTEGER PRIMARY KEY,
  embedding float[${dimension}]
);
`);
}

export function countObsidianVectors(
  db: DatabaseType.Database,
  dimension = OBSIDIAN_SEMANTIC_DIMENSION,
): number {
  initializeObsidianVectorSchema(db, dimension);
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${vectorTableName(dimension)}`)
    .get() as { count: number };
  return row.count;
}

async function readEmbeddingText(
  index: ObsidianVaultIndex,
  note: ObsidianNoteMetadata,
): Promise<string> {
  const absolutePath = resolve(index.vault_path, note.path);
  assertInsideVault(index.vault_path, absolutePath);
  const realNotePath = await realpath(absolutePath);
  assertInsideVault(index.vault_path, realNotePath);
  const info = await stat(realNotePath);
  if (!info.isFile() || info.size > OBSIDIAN_INDEX_MAX_NOTE_BYTES) {
    throw new ObsidianVaultPathError(
      "Obsidian note is unavailable for local embedding.",
      "filesystem_error",
    );
  }
  return stripFrontmatter(decodeMarkdown(await readFile(realNotePath))).trim();
}

function upsertObsidianVector(
  db: DatabaseType.Database,
  input: {
    readonly note: ObsidianNoteMetadata;
    readonly contentHash: string;
    readonly embedding: readonly number[];
    readonly model: string;
    readonly dimension: number;
    readonly timestamp: number;
  },
): void {
  const existing = getVectorMetadata(db, input.note.id);
  if (existing) {
    db.prepare(
      `UPDATE ${OBSIDIAN_SEMANTIC_METADATA_TABLE}
       SET path = ?,
           title = ?,
           tags_json = ?,
           content_hash = ?,
           model = ?,
           dim = ?,
           updated_at = ?
       WHERE note_id = ?`,
    ).run(
      input.note.path,
      input.note.title,
      JSON.stringify(input.note.tags),
      input.contentHash,
      input.model,
      input.dimension,
      input.timestamp,
      input.note.id,
    );
  } else {
    db.prepare(
      `INSERT INTO ${OBSIDIAN_SEMANTIC_METADATA_TABLE} (
         note_id, path, title, tags_json, content_hash, model, dim, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.note.id,
      input.note.path,
      input.note.title,
      JSON.stringify(input.note.tags),
      input.contentHash,
      input.model,
      input.dimension,
      input.timestamp,
      input.timestamp,
    );
  }

  const row = getVectorMetadata(db, input.note.id);
  if (!row) {
    throw new Error("Obsidian vector metadata write failed.");
  }
  const table = vectorTableName(input.dimension);
  db.prepare(`DELETE FROM ${table} WHERE note_rowid = ?`).run(
    BigInt(row.rowid),
  );
  db.prepare(`INSERT INTO ${table} (note_rowid, embedding) VALUES (?, ?)`).run(
    BigInt(row.rowid),
    vectorToBlob(input.embedding),
  );
}

function getVectorMetadata(
  db: DatabaseType.Database,
  noteId: string,
): ObsidianVectorMetadataRow | undefined {
  return db
    .prepare(
      `SELECT rowid, *
       FROM ${OBSIDIAN_SEMANTIC_METADATA_TABLE}
       WHERE note_id = ?`,
    )
    .get(noteId) as ObsidianVectorMetadataRow | undefined;
}

function getVectorMetadataByRowid(
  db: DatabaseType.Database,
  rowid: number,
): ObsidianVectorMetadataRow | undefined {
  return db
    .prepare(
      `SELECT rowid, *
       FROM ${OBSIDIAN_SEMANTIC_METADATA_TABLE}
       WHERE rowid = ?`,
    )
    .get(rowid) as ObsidianVectorMetadataRow | undefined;
}

function vectorRowExists(
  db: DatabaseType.Database,
  dimension: number,
  rowid: number,
): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM ${vectorTableName(dimension)}
       WHERE note_rowid = ?`,
    )
    .get(BigInt(rowid)) as { count: number };
  return row.count > 0;
}

function searchVectorRows(
  db: DatabaseType.Database,
  dimension: number,
  embedding: readonly number[],
  topK: number,
): SqliteVecSearchRow[] {
  return db
    .prepare(
      `SELECT note_rowid AS rowid, distance
       FROM ${vectorTableName(dimension)}
       WHERE embedding MATCH ? AND k = ?
       ORDER BY distance ASC`,
    )
    .all(vectorToBlob(embedding), BigInt(topK)) as SqliteVecSearchRow[];
}

function vectorTableName(dimension: number): string {
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error("Obsidian vector dimension must be a positive integer.");
  }
  return `obsidian_note_vec_${dimension}`;
}

function vectorToBlob(vector: readonly number[]): Buffer {
  return embeddingVectorToBlob(Array.from(vector));
}

function assertEmbeddingResult(
  result: EmbeddingResult,
  config: ObsidianSemanticConfig,
): void {
  if (result.model !== config.model || result.dimension !== config.dimension) {
    throw new Error(
      `Obsidian embedding provider returned ${result.model}/${result.dimension}; expected ${config.model}/${config.dimension}.`,
    );
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampTopK(value: number | undefined): number {
  if (value === undefined) return OBSIDIAN_SEMANTIC_DEFAULT_TOP_K;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ObsidianVaultPathError(
      "Obsidian semantic topK must be a positive integer.",
      "filesystem_error",
    );
  }
  return Math.min(value, OBSIDIAN_SEMANTIC_MAX_TOP_K);
}

function distanceToScore(distance: number): number {
  return 1 / (1 + Math.max(0, distance));
}

function hashValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function decodeMarkdown(buffer: Buffer): string {
  if (buffer.includes(0)) {
    throw new ObsidianVaultPathError(
      "Obsidian markdown note was not valid UTF-8 text.",
      "filesystem_error",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ObsidianVaultPathError(
      "Obsidian markdown note was not valid UTF-8 text.",
      "filesystem_error",
    );
  }
}

function stripFrontmatter(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return body;
  const end = normalized.indexOf("\n---\n", 4);
  return end === -1 ? body : normalized.slice(end + "\n---\n".length);
}

function assertInsideVault(vaultPath: string, candidate: string): void {
  const rel = relative(vaultPath, candidate);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new ObsidianVaultPathError(
      "Obsidian path escapes the vault root.",
      "path_escape",
    );
  }
}
