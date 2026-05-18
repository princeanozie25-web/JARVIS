import type { VectorStoreConfig } from "./vector-config";

export interface VectorStoreRecord {
  memoryId: string;
  category: string;
  vector: number[];
  model: string;
  dimension: number;
  createdAt: number;
}

export interface VectorSearchOptions {
  maxResults?: number;
  model?: string;
  dimension?: number;
}

export interface VectorSearchResult {
  memoryId: string;
  score: number;
  distance?: number;
  model?: string;
  dimension?: number;
}

export interface VectorStore {
  readonly id: string;
  readonly enabled: boolean;
  upsert(records: VectorStoreRecord[]): Promise<void>;
  search(
    vector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;
}

export class DisabledVectorStore implements VectorStore {
  readonly id = "disabled";
  readonly enabled = false;

  async upsert(): Promise<void> {
    throw new Error("Vector store is disabled.");
  }

  async search(): Promise<VectorSearchResult[]> {
    throw new Error("Vector store is disabled.");
  }
}

type LanceDbModule = {
  connect: (path: string) => Promise<LanceDbConnection>;
};

type LanceDbConnection = {
  openTable: (name: string) => Promise<LanceDbTable>;
  createTable: (
    name: string,
    records: LanceDbStoredRecord[],
  ) => Promise<LanceDbTable>;
};

type LanceDbTable = {
  add: (records: LanceDbStoredRecord[]) => Promise<unknown>;
  search: (vector: number[]) => {
    limit: (count: number) => {
      toArray: () => Promise<LanceDbSearchRow[]>;
    };
  };
};

interface LanceDbStoredRecord {
  memory_id: string;
  vector: number[];
  category: string;
  model: string;
  dim: number;
  created_at: number;
}

interface LanceDbSearchRow extends LanceDbStoredRecord {
  _distance?: number;
  score?: number;
}

async function loadLanceDb(): Promise<LanceDbModule> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<LanceDbModule>;
  return dynamicImport("@lancedb/lancedb");
}

function toStoredRecord(record: VectorStoreRecord): LanceDbStoredRecord {
  return {
    memory_id: record.memoryId,
    vector: record.vector,
    category: record.category,
    model: record.model,
    dim: record.dimension,
    created_at: record.createdAt,
  };
}

function assertVectorDimension(vector: number[], dimension: number): void {
  if (vector.length !== dimension) {
    throw new Error(
      `Vector dimension mismatch: expected ${dimension}, received ${vector.length}.`,
    );
  }
}

export class LanceDbVectorStore implements VectorStore {
  readonly id = "lancedb";
  readonly enabled = true;
  private tablePromise?: Promise<LanceDbTable>;

  constructor(
    private readonly config: VectorStoreConfig,
    private readonly loader: () => Promise<LanceDbModule> = loadLanceDb,
  ) {}

  async upsert(records: VectorStoreRecord[]): Promise<void> {
    if (records.length === 0) return;
    for (const record of records) {
      assertVectorDimension(record.vector, this.config.dimension);
    }
    const table = await this.table(records.map(toStoredRecord));
    await table.add(records.map(toStoredRecord));
  }

  async search(
    vector: number[],
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchResult[]> {
    assertVectorDimension(vector, options.dimension ?? this.config.dimension);
    const limit = Math.min(
      Math.max(Math.trunc(options.maxResults ?? 8), 1),
      20,
    );
    const table = await this.table([]);
    const rows = await table.search(vector).limit(limit).toArray();
    return rows
      .filter((row) => !options.model || row.model === options.model)
      .filter((row) => !options.dimension || row.dim === options.dimension)
      .slice(0, limit)
      .map((row) => ({
        memoryId: row.memory_id,
        score:
          typeof row.score === "number"
            ? row.score
            : typeof row._distance === "number"
              ? 1 / (1 + row._distance)
              : 0,
        distance: row._distance,
        model: row.model,
        dimension: row.dim,
      }));
  }

  private table(seedRecords: LanceDbStoredRecord[]): Promise<LanceDbTable> {
    this.tablePromise ??= this.loader().then(async (lancedb) => {
      const db = await lancedb.connect(this.config.path);
      try {
        return await db.openTable(this.config.tableName);
      } catch {
        return db.createTable(this.config.tableName, seedRecords);
      }
    });
    return this.tablePromise;
  }
}

export function vectorStoreFromConfig(config: VectorStoreConfig): VectorStore {
  if (!config.enabled) return new DisabledVectorStore();
  return new LanceDbVectorStore(config);
}

export { assertVectorDimension };
