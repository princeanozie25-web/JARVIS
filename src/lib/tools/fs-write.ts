import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { recordRollback } from "../db/rollbacks";
import {
  isProtectedPath,
  resolveSafePath,
  SafePathError,
} from "./fs-safe-path";
import type { Tool, ToolResult } from "./types";

const WRITE_TIMEOUT_MS = 5_000;
const MAX_CREATE_FILE_BYTES = 1024 * 1024;

const CreateFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(MAX_CREATE_FILE_BYTES),
});

export type CreateFileInput = z.infer<typeof CreateFileInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
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

function scopeOf(input: CreateFileInput): string {
  return `create:${input.path}`;
}

export const fsCreateFileTool: Tool<CreateFileInput> = {
  id: "fs.create_file",
  name: "Create File",
  description:
    "Create a new UTF-8 text file inside the configured workspace without overwriting existing files.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: CreateFileInputSchema,
  scopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: WRITE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    const leaf = basename(input.path);
    if (!leaf || leaf === "." || leaf === "..") {
      return denied("Invalid file path.", "invalid_path");
    }

    try {
      const parent = await resolveSafePath(dirname(input.path) || ".");
      const targetPath = resolve(parent.resolvedPath, leaf);
      if (!isInside(parent.workspaceRoot, targetPath)) {
        return denied("Path escapes the workspace root.", "path_escape");
      }
      if (isProtectedPath(targetPath)) {
        return denied("Path is protected.", "protected_path");
      }
      if (await exists(targetPath)) {
        return denied("File already exists.", "file_exists");
      }

      const tempPath = resolve(
        parent.resolvedPath,
        `.${leaf}.${context.executionId}.tmp`,
      );

      try {
        await writeFile(tempPath, input.content, {
          encoding: "utf8",
          flag: "wx",
        });
        if (context.signal.aborted) {
          await rm(tempPath, { force: true });
          return denied("Tool execution aborted.", "aborted");
        }
        await copyFile(tempPath, targetPath, constants.COPYFILE_EXCL);
        await rm(tempPath, { force: true }).catch(() => undefined);
      } catch (error) {
        await rm(tempPath, { force: true });
        throw error;
      }

      const relativePath = relative(parent.workspaceRoot, targetPath) || ".";
      if (context.db) {
        recordRollback(context.db, {
          id: randomUUID(),
          execution_id: context.executionId,
          session_id: context.sessionId,
          kind: "fs_unlink_created",
          payload_json: JSON.stringify({ path: relativePath }),
          created_at: Date.now(),
        });
      }

      return {
        ok: true,
        status: "COMPLETED",
        message: "File created.",
        data: {
          path: relativePath,
          bytes: Buffer.byteLength(input.content, "utf8"),
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const writeFsTools = [fsCreateFileTool];

export { MAX_CREATE_FILE_BYTES };
