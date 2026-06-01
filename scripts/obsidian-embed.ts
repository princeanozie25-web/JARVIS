import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getDb } from "../src/lib/db/node";
import {
  buildObsidianVaultIndex,
  obsidianSemanticConfigFromEnv,
  populateObsidianVectors,
  searchObsidianSemantic,
} from "../src/lib/obsidian";

export interface ObsidianEmbedCliDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly writeLine?: (line: string) => void;
}

export async function runObsidianEmbedCli(
  dependencies: ObsidianEmbedCliDependencies = {},
): Promise<"ok" | "failed"> {
  const env = dependencies.env ?? process.env;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  writeLine("JARVIS Obsidian local vector population");

  try {
    const config = obsidianSemanticConfigFromEnv(env);
    const index = await buildObsidianVaultIndex({ env });
    const db = getDb();
    const report = await populateObsidianVectors({
      db,
      index,
      config,
    });

    writeLine("status: ok");
    writeLine(`model: ${report.model}`);
    writeLine(`dimension: ${report.dimension}`);
    writeLine(`notes_seen: ${report.notes_seen}`);
    writeLine(`vectors_created: ${report.vectors_created}`);
    writeLine(`vectors_reused: ${report.vectors_reused}`);
    writeLine("vector_store: sqlite-vec");
    writeLine("metadata_only: true");
    writeLine("vault_mutated: false");

    const query = env.OBSIDIAN_SEMANTIC_QUERY?.trim();
    if (query) {
      const result = await searchObsidianSemantic({
        db,
        index,
        query,
        topK: 3,
        config,
      });
      writeLine(`semantic_query_hash: ${result.query_hash.slice(0, 16)}`);
      writeLine(`semantic_result_count: ${result.hits.length}`);
      for (const hit of result.hits) {
        writeLine(
          `hit: rank=${hit.rank} note_id=${hit.note.id} score=${hit.score.toFixed(6)} distance=${hit.distance.toFixed(6)}`,
        );
      }
    }
    return "ok";
  } catch (error) {
    writeLine("status: failed");
    writeLine(
      `reason: ${error instanceof Error ? error.message : String(error)}`,
    );
    writeLine(
      "enablement: set OBSIDIAN_VAULT_PATH and ensure local Ollama has nomic-embed-text available",
    );
    writeLine("metadata_only: true");
    writeLine("vault_mutated: false");
    return "failed";
  }
}

async function runCli(): Promise<void> {
  const status = await runObsidianEmbedCli();
  if (status === "failed") {
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("obsidian-embed.ts");
}

if (isDirectCliInvocation()) {
  void runCli();
}
