import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildObsidianVaultIndex,
  ObsidianVaultPathError,
  type ObsidianVaultIndex,
} from "../src/lib/obsidian";

export interface ObsidianIndexCliDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly buildIndex?: typeof buildObsidianVaultIndex;
  readonly writeLine?: (line: string) => void;
}

export type ObsidianIndexCliReport =
  | {
      readonly status: "ok";
      readonly index: ObsidianVaultIndex;
    }
  | {
      readonly status: "failed";
      readonly reason: string;
    };

export async function runObsidianIndexCli(
  dependencies: ObsidianIndexCliDependencies = {},
): Promise<ObsidianIndexCliReport> {
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const buildIndex = dependencies.buildIndex ?? buildObsidianVaultIndex;

  writeLine("JARVIS Obsidian pull index");

  try {
    const index = await buildIndex({ env: dependencies.env ?? process.env });
    writeLine("status: ok");
    writeLine(`vault_hash: ${hashValue(index.vault_path)}`);
    writeLine(`notes: ${index.notes.length}`);
    writeLine(`folders: ${index.folders.length}`);
    writeLine(`metadata_only: ${String(index.telemetry.metadata_only)}`);
    writeLine(`body_bytes_indexed: ${index.body_bytes_indexed}`);
    writeLine(
      "retrieval: metadata and bounded snippets are available in memory",
    );
    writeLine("vault_mutated: false");
    return {
      status: "ok",
      index,
    };
  } catch (error) {
    const reason =
      error instanceof ObsidianVaultPathError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown Obsidian index failure.";
    writeLine("status: failed");
    writeLine(`reason: ${reason}`);
    writeLine(
      "enablement: set OBSIDIAN_VAULT_PATH to an existing Obsidian vault directory and rerun npm run obsidian:index",
    );
    writeLine("vault_mutated: false");
    return {
      status: "failed",
      reason,
    };
  }
}

async function runCli(): Promise<void> {
  const report = await runObsidianIndexCli();
  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

function hashValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("obsidian-index.ts");
}

if (isDirectCliInvocation()) {
  void runCli();
}
