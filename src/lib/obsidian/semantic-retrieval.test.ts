import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider } from "../memory/embedding-providers";
import { buildObsidianVaultIndex } from "./pull-indexer";
import {
  countObsidianVectors,
  OBSIDIAN_SEMANTIC_METADATA_TABLE,
  populateObsidianVectors,
  searchObsidianSemantic,
  type ObsidianSemanticConfig,
} from "./semantic-retrieval";

let vaultRoot: string;
let db: Database.Database;

const semanticConfig: ObsidianSemanticConfig = {
  model: "nomic-embed-text",
  dimension: 3,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  timeoutMs: 1_000,
};

beforeEach(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), "jarvis-obsidian-vector-"));
  db = new Database(":memory:");
});

afterEach(async () => {
  db.close();
  await rm(vaultRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("P0.2.b Obsidian sqlite-vec population", () => {
  it("generates local embeddings and stores vectors in sqlite-vec without raw body telemetry", async () => {
    await writeNote(
      "Projects/Alpha.md",
      [
        "---",
        "title: Alpha Frontmatter",
        "tags: [alpha]",
        "---",
        "# Alpha",
        "alpha semantic body secret",
      ].join("\n"),
    );
    await writeNote("Projects/Beta.md", "# Beta\nbeta semantic body secret");
    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const provider = fakeLocalProvider();

    const report = await populateObsidianVectors({
      db,
      index,
      config: semanticConfig,
      provider,
      now: () => 500,
    });

    expect(report).toMatchObject({
      status: "ok",
      model: "nomic-embed-text",
      dimension: 3,
      notes_seen: 2,
      vectors_created: 2,
      vectors_reused: 0,
      vector_store: "sqlite-vec",
      metadata_only: true,
      vault_mutated: false,
    });
    expect(countObsidianVectors(db, 3)).toBe(2);
    expect(provider.inputs).toEqual([
      "# Alpha\nalpha semantic body secret",
      "# Beta\nbeta semantic body secret",
    ]);

    const metadataRows = db
      .prepare(`SELECT * FROM ${OBSIDIAN_SEMANTIC_METADATA_TABLE}`)
      .all();
    const serializedDbMetadata = JSON.stringify(metadataRows);
    expect(serializedDbMetadata).not.toContain("semantic body secret");
    expect(JSON.stringify(report.telemetry)).not.toContain(
      "semantic body secret",
    );
    expect(report.telemetry.embeddings_in_telemetry).toBe(false);
    expect(report.telemetry.raw_body_in_telemetry).toBe(false);
  });

  it("reuses unchanged sqlite-vec rows deterministically", async () => {
    await writeNote("Alpha.md", "# Alpha\nalpha text");
    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const provider = fakeLocalProvider();

    await populateObsidianVectors({
      db,
      index,
      config: semanticConfig,
      provider,
    });
    const second = await populateObsidianVectors({
      db,
      index,
      config: semanticConfig,
      provider,
    });

    expect(second.vectors_created).toBe(0);
    expect(second.vectors_reused).toBe(1);
    expect(provider.inputs).toEqual(["# Alpha\nalpha text"]);
    expect(countObsidianVectors(db, 3)).toBe(1);
  });

  it("returns semantic matches ordered by sqlite-vec distance", async () => {
    await writeNote("Alpha.md", "# Alpha\nalpha launch plan");
    await writeNote("Beta.md", "# Beta\nbeta archive");
    await writeNote("Gamma.md", "# Gamma\ngamma reference");
    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const provider = fakeLocalProvider();
    await populateObsidianVectors({
      db,
      index,
      config: semanticConfig,
      provider,
    });

    const result = await searchObsidianSemantic({
      db,
      index,
      query: "alpha roadmap",
      topK: 2,
      includeSnippets: true,
      snippetMaxChars: 16,
      config: semanticConfig,
      provider,
    });

    expect(result.status).toBe("ok");
    expect(result.model).toBe("nomic-embed-text");
    expect(result.hits.map((hit) => hit.note.path)).toEqual([
      "Alpha.md",
      "Beta.md",
    ]);
    expect(result.hits[0].distance).toBeLessThan(result.hits[1].distance);
    expect(result.hits[0].score).toBeGreaterThan(result.hits[1].score);
    expect(result.hits[0].snippet?.snippet).toBe("# Alpha\nalpha la");
    expect(result.telemetry.query_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result.telemetry)).not.toContain("alpha roadmap");
    expect(JSON.stringify(result.telemetry)).not.toContain("launch plan");
    expect(result.telemetry.embeddings_in_telemetry).toBe(false);
  });

  it("does not call cloud/network or mutate the vault during population and retrieval", async () => {
    await writeNote("Alpha.md", "# Alpha\nalpha body");
    const before = await snapshotVault(vaultRoot);
    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network forbidden"));
    const provider = fakeLocalProvider();

    await populateObsidianVectors({
      db,
      index,
      config: semanticConfig,
      provider,
    });
    await searchObsidianSemantic({
      db,
      index,
      query: "alpha",
      topK: 1,
      config: semanticConfig,
      provider,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await snapshotVault(vaultRoot)).toEqual(before);
  });

  it("fails closed when the local embedding provider is unavailable", async () => {
    await writeNote("Alpha.md", "# Alpha\nalpha body");
    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const unavailableProvider: EmbeddingProvider = {
      id: "ollama",
      model: "nomic-embed-text",
      dimension: 3,
      embed: async () => {
        throw new Error("local embedding model unavailable");
      },
    };

    await expect(
      populateObsidianVectors({
        db,
        index,
        config: semanticConfig,
        provider: unavailableProvider,
      }),
    ).rejects.toThrow(/unavailable/);
    expect(countObsidianVectors(db, 3)).toBe(0);
  });

  it("keeps semantic modules free of vault writes, watchers, cloud calls, and background indexing", async () => {
    const source = await readFile(
      new URL("./semantic-retrieval.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|WebSocket|OpenAI|Anthropic|@anthropic-ai\/sdk|node:http|node:https)\b/i,
    );
    expect(source).not.toContain("deepseek");
    expect(source).not.toContain("memory.note");
    expect(source).not.toContain("ensureVaultScaffold");
    expect(source).not.toContain("writeVaultFileAtomically");
  });
});

function fakeLocalProvider(): EmbeddingProvider & { inputs: string[] } {
  const inputs: string[] = [];
  return {
    id: "ollama",
    model: "nomic-embed-text",
    dimension: 3,
    inputs,
    async embed(input) {
      inputs.push(input.text);
      const normalized = input.text.toLowerCase();
      if (normalized.includes("alpha")) {
        return {
          embedding: [1, 0, 0],
          model: "nomic-embed-text",
          dimension: 3,
          provider: "ollama",
        };
      }
      if (normalized.includes("beta")) {
        return {
          embedding: [0.5, 0, 0],
          model: "nomic-embed-text",
          dimension: 3,
          provider: "ollama",
        };
      }
      return {
        embedding: [0, 0, 1],
        model: "nomic-embed-text",
        dimension: 3,
        provider: "ollama",
      };
    },
  };
}

async function writeNote(relativePath: string, body: string): Promise<void> {
  const absolutePath = join(vaultRoot, ...relativePath.split("/"));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body, "utf8");
}

async function snapshotVault(
  root: string,
): Promise<
  Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  >
> {
  const snapshot: Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  > = {};
  await snapshotDirectory(root, root, snapshot);
  return snapshot;
}

async function snapshotDirectory(
  root: string,
  current: string,
  snapshot: Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  >,
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      await snapshotDirectory(root, absolutePath, snapshot);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolutePath);
    const body = await readFile(absolutePath);
    const relativePath = absolutePath
      .slice(root.length + 1)
      .replace(/\\/g, "/");
    snapshot[relativePath] = {
      hash: createHash("sha256").update(body).digest("hex"),
      mtime_ms: info.mtimeMs,
      size: info.size,
    };
  }
}
