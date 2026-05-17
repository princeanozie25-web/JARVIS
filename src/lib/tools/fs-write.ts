import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { recordRollback } from "../db/rollbacks";
import {
  isProtectedPath,
  resolveSafePath,
  SafePathError,
} from "./fs-safe-path";
import { assertPathDirectChild, executionPathSegment } from "./safe-filenames";
import type { Tool, ToolResult } from "./types";

const WRITE_TIMEOUT_MS = 5_000;
const MAX_CREATE_FILE_BYTES = 1024 * 1024;
const MAX_WRITE_FILE_BYTES = 1024 * 1024;
const MAX_APPEND_FILE_BYTES = 1024 * 1024;
const INLINE_ROLLBACK_CONTENT_BYTES = 64 * 1024;

const CreateFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(MAX_CREATE_FILE_BYTES),
});

const WriteFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(MAX_WRITE_FILE_BYTES),
});

const AppendFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(MAX_APPEND_FILE_BYTES),
});

const MkdirInputSchema = z.object({
  path: z.string().min(1),
});

const RenameInputSchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
});

export type CreateFileInput = z.infer<typeof CreateFileInputSchema>;
export type WriteFileInput = z.infer<typeof WriteFileInputSchema>;
export type AppendFileInput = z.infer<typeof AppendFileInputSchema>;
export type MkdirInput = z.infer<typeof MkdirInputSchema>;
export type RenameInput = z.infer<typeof RenameInputSchema>;

class ToolDeniedError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "ToolDeniedError";
  }
}

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

function safeError(error: unknown): ToolResult {
  if (error instanceof SafePathError) {
    return denied(error.message, error.reason);
  }
  if (error instanceof ToolDeniedError) {
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

function createScopeOf(input: CreateFileInput): string {
  return `create:${input.path}`;
}

function writeScopeOf(input: WriteFileInput): string {
  return `write:${input.path}`;
}

function appendScopeOf(input: AppendFileInput): string {
  return `append:${input.path}`;
}

function mkdirScopeOf(input: MkdirInput): string {
  return `mkdir:${input.path}`;
}

function renameScopeOf(input: RenameInput): string {
  return `rename:${input.fromPath}->${input.toPath}`;
}

async function resolveMissingDestination(path: string): Promise<{
  workspaceRoot: string;
  targetPath: string;
}> {
  try {
    await resolveSafePath(path);
    throw new ToolDeniedError(
      "Destination already exists.",
      "destination_exists",
    );
  } catch (error) {
    if (error instanceof ToolDeniedError) {
      throw error;
    }
    if (!(error instanceof SafePathError) || error.reason !== "not_found") {
      throw error;
    }
  }

  const leaf = basename(path);
  if (!leaf || leaf === "." || leaf === "..") {
    throw new SafePathError("Invalid destination path.", "path_escape");
  }

  const parent = await resolveSafePath(dirname(path) || ".");
  const targetPath = resolve(parent.resolvedPath, leaf);
  if (!isInside(parent.workspaceRoot, targetPath)) {
    throw new SafePathError("Path escapes the workspace root.", "path_escape");
  }
  if (isProtectedPath(targetPath)) {
    throw new SafePathError("Path is protected.", "protected_path");
  }
  if (await exists(targetPath)) {
    throw new ToolDeniedError(
      "Destination already exists.",
      "destination_exists",
    );
  }

  return {
    workspaceRoot: parent.workspaceRoot,
    targetPath,
  };
}

export const fsCreateFileTool: Tool<CreateFileInput> = {
  id: "fs.create_file",
  name: "Create File",
  description:
    "Create a new UTF-8 text file inside the configured workspace without overwriting existing files.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: CreateFileInputSchema,
  scopeOf: createScopeOf,
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
        `.${leaf}.${executionPathSegment(context.executionId)}.tmp`,
      );
      assertPathDirectChild(parent.resolvedPath, tempPath);

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

export const fsWriteFileTool: Tool<WriteFileInput> = {
  id: "fs.write_file",
  name: "Write File",
  description:
    "Overwrite an existing UTF-8 text file inside the configured workspace.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: WriteFileInputSchema,
  scopeOf: writeScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: WRITE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    if (Buffer.byteLength(input.content, "utf8") > MAX_WRITE_FILE_BYTES) {
      return denied("Content exceeds 1 MB write limit.", "content_too_large");
    }

    try {
      const safePath = await resolveSafePath(input.path);
      const info = await stat(safePath.resolvedPath);
      if (!info.isFile()) {
        return denied("Path is not a file.", "not_file");
      }

      const previousBuffer = await readFile(safePath.resolvedPath);
      const previousContent = decodeText(previousBuffer);
      if (previousContent === null) {
        return denied("Binary files are not supported.", "binary_file");
      }

      const dir = dirname(safePath.resolvedPath);
      const leaf = basename(safePath.resolvedPath);
      const tempPath = resolve(
        dir,
        `.${leaf}.${executionPathSegment(context.executionId)}.tmp`,
      );
      assertPathDirectChild(dir, tempPath);
      const relativePath =
        relative(safePath.workspaceRoot, safePath.resolvedPath) || ".";
      const rollback = await rollbackPayload({
        workspaceRoot: safePath.workspaceRoot,
        relativePath,
        previousContent,
        previousLength: previousBuffer.byteLength,
        executionId: context.executionId,
      });

      try {
        await writeFile(tempPath, input.content, {
          encoding: "utf8",
          flag: "wx",
        });
        if (context.signal.aborted) {
          await rm(tempPath, { force: true });
          return denied("Tool execution aborted.", "aborted");
        }
        await rename(tempPath, safePath.resolvedPath);
      } catch (error) {
        await rm(tempPath, { force: true });
        throw error;
      }

      if (context.db) {
        recordRollback(context.db, {
          id: randomUUID(),
          execution_id: context.executionId,
          session_id: context.sessionId,
          kind: "fs_restore_content",
          payload_json: JSON.stringify(rollback),
          created_at: Date.now(),
        });
      }

      return {
        ok: true,
        status: "COMPLETED",
        message: "File overwritten.",
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

export const fsAppendFileTool: Tool<AppendFileInput> = {
  id: "fs.append_file",
  name: "Append File",
  description:
    "Append UTF-8 text to an existing text file inside the configured workspace.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: AppendFileInputSchema,
  scopeOf: appendScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: WRITE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    const appendedBytes = Buffer.byteLength(input.content, "utf8");
    if (appendedBytes > MAX_APPEND_FILE_BYTES) {
      return denied("Content exceeds 1 MB append limit.", "content_too_large");
    }

    try {
      const safePath = await resolveSafePath(input.path);
      const info = await stat(safePath.resolvedPath);
      if (!info.isFile()) {
        return denied("Path is not a file.", "not_file");
      }

      const previousBuffer = await readFile(safePath.resolvedPath);
      if (decodeText(previousBuffer) === null) {
        return denied("Binary files are not supported.", "binary_file");
      }

      if (context.signal.aborted) {
        return denied("Tool execution aborted.", "aborted");
      }

      await appendFile(safePath.resolvedPath, input.content, {
        encoding: "utf8",
      });

      const relativePath =
        relative(safePath.workspaceRoot, safePath.resolvedPath) || ".";
      if (context.db) {
        recordRollback(context.db, {
          id: randomUUID(),
          execution_id: context.executionId,
          session_id: context.sessionId,
          kind: "fs_truncate_to_length",
          payload_json: JSON.stringify({
            path: relativePath,
            previousLength: previousBuffer.byteLength,
          }),
          created_at: Date.now(),
        });
      }

      return {
        ok: true,
        status: "COMPLETED",
        message: "File appended.",
        data: {
          path: relativePath,
          bytes: appendedBytes,
          previousLength: previousBuffer.byteLength,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const fsMkdirTool: Tool<MkdirInput> = {
  id: "fs.mkdir",
  name: "Make Directory",
  description:
    "Create a new directory inside the configured workspace when its parent already exists.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: MkdirInputSchema,
  scopeOf: mkdirScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: WRITE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    const leaf = basename(input.path);
    if (!leaf || leaf === "." || leaf === "..") {
      return denied("Invalid directory path.", "invalid_path");
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
        return denied("Path already exists.", "path_exists");
      }

      if (context.signal.aborted) {
        return denied("Tool execution aborted.", "aborted");
      }

      await mkdir(targetPath, { recursive: false });

      const relativePath = relative(parent.workspaceRoot, targetPath) || ".";
      if (context.db) {
        recordRollback(context.db, {
          id: randomUUID(),
          execution_id: context.executionId,
          session_id: context.sessionId,
          kind: "fs_rmdir_empty",
          payload_json: JSON.stringify({ path: relativePath }),
          created_at: Date.now(),
        });
      }

      return {
        ok: true,
        status: "COMPLETED",
        message: "Directory created.",
        data: {
          path: relativePath,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const fsRenameTool: Tool<RenameInput> = {
  id: "fs.rename",
  name: "Rename Path",
  description:
    "Rename or move a file or empty directory inside the configured workspace without overwriting.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: RenameInputSchema,
  scopeOf: renameScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: WRITE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    try {
      const source = await resolveSafePath(input.fromPath);
      const destination = await resolveMissingDestination(input.toPath);
      if (source.workspaceRoot !== destination.workspaceRoot) {
        return denied("Path escapes the workspace root.", "path_escape");
      }
      if (isProtectedPath(source.resolvedPath)) {
        return denied("Path is protected.", "protected_path");
      }

      const info = await stat(source.resolvedPath);
      if (info.isDirectory()) {
        if ((await readdir(source.resolvedPath)).length > 0) {
          return denied("Directory is not empty.", "directory_not_empty");
        }
      } else if (!info.isFile()) {
        return denied("Path type is not supported.", "unsupported_path_type");
      }

      if (context.signal.aborted) {
        return denied("Tool execution aborted.", "aborted");
      }

      await rename(source.resolvedPath, destination.targetPath);

      const fromPath =
        relative(source.workspaceRoot, source.resolvedPath) || ".";
      const toPath =
        relative(destination.workspaceRoot, destination.targetPath) || ".";
      if (context.db) {
        recordRollback(context.db, {
          id: randomUUID(),
          execution_id: context.executionId,
          session_id: context.sessionId,
          kind: "fs_move_back",
          payload_json: JSON.stringify({ fromPath, toPath }),
          created_at: Date.now(),
        });
      }

      return {
        ok: true,
        status: "COMPLETED",
        message: "Path renamed.",
        data: {
          fromPath,
          toPath,
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

async function rollbackPayload(input: {
  workspaceRoot: string;
  relativePath: string;
  previousContent: string;
  previousLength: number;
  executionId: string;
}): Promise<Record<string, unknown>> {
  if (input.previousLength <= INLINE_ROLLBACK_CONTENT_BYTES) {
    return {
      path: input.relativePath,
      previousContent: input.previousContent,
      previousLength: input.previousLength,
    };
  }

  const backupRelativePath = `.jarvis-trash/backups/${executionPathSegment(
    input.executionId,
  )}`;
  const backupPath = resolve(input.workspaceRoot, backupRelativePath);
  const backupRoot = resolve(input.workspaceRoot, ".jarvis-trash/backups");
  assertPathDirectChild(backupRoot, backupPath);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, input.previousContent, {
    encoding: "utf8",
    flag: "wx",
  });

  return {
    path: input.relativePath,
    backupPath: backupRelativePath,
    previousLength: input.previousLength,
  };
}

export const writeFsTools = [
  fsCreateFileTool,
  fsWriteFileTool,
  fsAppendFileTool,
  fsMkdirTool,
  fsRenameTool,
];

export {
  INLINE_ROLLBACK_CONTENT_BYTES,
  MAX_APPEND_FILE_BYTES,
  MAX_CREATE_FILE_BYTES,
  MAX_WRITE_FILE_BYTES,
};
