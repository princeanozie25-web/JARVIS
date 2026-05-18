import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertPathInsideDirectory,
  executionPathSegment,
} from "./safe-filenames";

export const INLINE_OUTPUT_BYTE_LIMIT = 64 * 1024;

export interface PersistToolOutputResult {
  outputJson: string;
  byteSize: number;
  truncated: boolean;
  externalPath?: string;
  externalAbsolutePath?: string;
}

export interface PersistToolOutputOptions {
  dataDir?: string;
  inlineByteLimit?: number;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

export function defaultToolOutputDir(): string {
  return join("data", "tool-outputs");
}

export function persistToolOutput(
  executionId: string,
  data: unknown,
  opts: PersistToolOutputOptions = {},
): PersistToolOutputResult {
  const serialized = safeJson(data);
  const byteSize = Buffer.byteLength(serialized, "utf8");
  const limit = opts.inlineByteLimit ?? INLINE_OUTPUT_BYTE_LIMIT;

  if (byteSize <= limit) {
    return { outputJson: serialized, byteSize, truncated: false };
  }

  const dataDir = resolve(opts.dataDir ?? defaultToolOutputDir());
  mkdirSync(dataDir, { recursive: true });

  const filename = `${executionPathSegment(executionId)}.json`;
  const fullPath = resolve(dataDir, filename);
  assertPathInsideDirectory(
    dataDir,
    fullPath,
    "Tool output path escapes tool-outputs directory.",
  );

  writeFileSync(fullPath, serialized, { encoding: "utf8" });

  const pointer = {
    truncated: true,
    externalPath: filename,
    byteSize,
  };

  return {
    outputJson: JSON.stringify(pointer),
    byteSize,
    truncated: true,
    externalPath: filename,
    externalAbsolutePath: fullPath,
  };
}
