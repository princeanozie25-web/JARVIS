import { readdir, readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import {
  isProtectedPath,
  resolveSafePath,
  SafePathError,
  workspaceRootFromEnv,
} from "./fs-safe-path";
import type { Tool, ToolContext, ToolResult } from "./types";

const MAX_DIR_ENTRIES = 1000;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const READ_TIMEOUT_MS = 5_000;

const PathInputSchema = z.object({
  path: z.string().min(1).default("."),
});

export type FsPathInput = z.infer<typeof PathInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function ensureNotAborted(context: ToolContext): ToolResult | null {
  if (!context.signal.aborted) return null;
  return denied("Tool execution aborted.", "aborted");
}

function safeError(error: unknown): ToolResult {
  if (error instanceof SafePathError) {
    return denied(error.message, error.reason);
  }
  return denied(
    error instanceof Error ? error.message : String(error),
    "filesystem_error",
  );
}

function decodeText(buffer: Buffer): string | null {
  if (buffer.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

function scopeOf(input: FsPathInput): string {
  return input.path;
}

export const fsListDirTool: Tool<FsPathInput> = {
  id: "fs.list_dir",
  name: "List Directory",
  description: "List entries in a directory inside the configured workspace.",
  requiredSafetyTag: "ALLOW",
  inputSchema: PathInputSchema,
  scopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: READ_TIMEOUT_MS,
  async execute(input, context) {
    const aborted = ensureNotAborted(context);
    if (aborted) return aborted;

    try {
      const safePath = await resolveSafePath(input.path);
      const info = await stat(safePath.resolvedPath);
      if (!info.isDirectory()) {
        return denied("Path is not a directory.", "not_directory");
      }

      const entries = await readdir(safePath.resolvedPath, {
        withFileTypes: true,
      });
      const visible = entries
        .filter((entry) => !isProtectedPath(entry.name))
        .slice(0, MAX_DIR_ENTRIES)
        .map((entry) => ({
          name: entry.name,
          type: entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : entry.isSymbolicLink()
                ? "symlink"
                : "other",
        }));

      return {
        ok: true,
        message: "Directory listed.",
        data: {
          path: relative(safePath.workspaceRoot, safePath.resolvedPath) || ".",
          entries: visible,
          truncated: entries.length > MAX_DIR_ENTRIES,
          maxEntries: MAX_DIR_ENTRIES,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const fsReadFileTool: Tool<FsPathInput> = {
  id: "fs.read_file",
  name: "Read File",
  description: "Read a UTF-8 text file inside the configured workspace.",
  requiredSafetyTag: "ALLOW",
  inputSchema: PathInputSchema,
  scopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: READ_TIMEOUT_MS,
  async execute(input, context) {
    const aborted = ensureNotAborted(context);
    if (aborted) return aborted;

    try {
      const safePath = await resolveSafePath(input.path);
      const info = await stat(safePath.resolvedPath);
      if (!info.isFile()) {
        return denied("Path is not a file.", "not_file");
      }
      if (info.size > MAX_TEXT_FILE_BYTES) {
        return denied("File exceeds 1 MB read limit.", "file_too_large");
      }

      const buffer = await readFile(safePath.resolvedPath);
      const text = decodeText(buffer);
      if (text === null) {
        return denied("Binary files are not supported.", "binary_file");
      }

      return {
        ok: true,
        message: "File read.",
        data: {
          path: relative(safePath.workspaceRoot, safePath.resolvedPath) || ".",
          bytes: buffer.byteLength,
          content: text,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const fsStatTool: Tool<FsPathInput> = {
  id: "fs.stat",
  name: "Stat Path",
  description: "Return metadata for a path inside the configured workspace.",
  requiredSafetyTag: "ALLOW",
  inputSchema: PathInputSchema,
  scopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: READ_TIMEOUT_MS,
  async execute(input, context) {
    const aborted = ensureNotAborted(context);
    if (aborted) return aborted;

    try {
      const safePath = await resolveSafePath(input.path);
      const info = await stat(safePath.resolvedPath);
      return {
        ok: true,
        message: "Path metadata read.",
        data: {
          path: relative(safePath.workspaceRoot, safePath.resolvedPath) || ".",
          type: info.isDirectory()
            ? "directory"
            : info.isFile()
              ? "file"
              : info.isSymbolicLink()
                ? "symlink"
                : "other",
          size: info.size,
          modifiedAt: info.mtimeMs,
          createdAt: info.birthtimeMs,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const readOnlyFsTools = [fsListDirTool, fsReadFileTool, fsStatTool];

export { MAX_DIR_ENTRIES, MAX_TEXT_FILE_BYTES, workspaceRootFromEnv };
