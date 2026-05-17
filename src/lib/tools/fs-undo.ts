import { constants } from "node:fs";
import {
  access,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import {
  getLatestRollbackForSession,
  getLatestUnappliedRollbackForSession,
  markRollbackApplied,
  type RollbackKind,
  type RollbackRow,
} from "../db/rollbacks";
import {
  isProtectedPath,
  resolveSafePath,
  SafePathError,
} from "./fs-safe-path";
import { assertPathDirectChild, executionPathSegment } from "./safe-filenames";
import type { Tool, ToolResult } from "./types";

const UNDO_TIMEOUT_MS = 5_000;
const ROLLBACK_TTL_MS = 24 * 60 * 60 * 1000;

const UndoInputSchema = z.object({});

export type UndoInput = z.infer<typeof UndoInputSchema>;

interface RestorePayload {
  path?: unknown;
  previousContent?: unknown;
  backupPath?: unknown;
  previousLength?: unknown;
}

interface UnlinkCreatedPayload {
  path?: unknown;
}

interface TruncatePayload {
  path?: unknown;
  previousLength?: unknown;
}

interface RmdirEmptyPayload {
  path?: unknown;
}

interface MoveBackPayload {
  fromPath?: unknown;
  toPath?: unknown;
}

interface SafeTarget {
  workspaceRoot: string;
  targetPath: string;
  exists: boolean;
}

class RollbackDeniedError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "RollbackDeniedError";
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
  if (error instanceof RollbackDeniedError) {
    return denied(error.message, error.reason);
  }
  return denied(
    error instanceof Error ? error.message : String(error),
    "rollback_error",
  );
}

function parsePayload<T>(row: RollbackRow): T | null {
  try {
    return JSON.parse(row.payload_json) as T;
  } catch {
    return null;
  }
}

async function resolveExistingSafeTarget(path: string): Promise<SafeTarget> {
  const safePath = await resolveSafePath(path);
  return {
    workspaceRoot: safePath.workspaceRoot,
    targetPath: safePath.resolvedPath,
    exists: true,
  };
}

async function resolveMaybeMissingSafeTarget(
  path: string,
): Promise<SafeTarget> {
  try {
    return await resolveExistingSafeTarget(path);
  } catch (error) {
    if (!(error instanceof SafePathError) || error.reason !== "not_found") {
      throw error;
    }

    const parent = await resolveSafePath(dirname(path) || ".");
    const leaf = basename(path);
    if (!leaf || leaf === "." || leaf === "..") {
      throw new SafePathError("Invalid rollback path.", "path_escape");
    }
    const targetPath = resolve(parent.resolvedPath, leaf);
    if (!isInside(parent.workspaceRoot, targetPath)) {
      throw new SafePathError(
        "Path escapes the workspace root.",
        "path_escape",
      );
    }
    if (isProtectedPath(targetPath)) {
      throw new SafePathError("Path is protected.", "protected_path");
    }
    return {
      workspaceRoot: parent.workspaceRoot,
      targetPath,
      exists: false,
    };
  }
}

async function writeViaTemp(input: {
  targetPath: string;
  content: string;
  executionId: string;
}): Promise<void> {
  const dir = dirname(input.targetPath);
  const leaf = basename(input.targetPath);
  const tempPath = resolve(
    dir,
    `.${leaf}.${executionPathSegment(input.executionId)}.rollback.tmp`,
  );
  assertPathDirectChild(dir, tempPath);
  try {
    await writeFile(tempPath, input.content, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(tempPath, input.targetPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function restoreContent(
  row: RollbackRow,
): Promise<{ path: string; kind: RollbackKind }> {
  const payload = parsePayload<RestorePayload>(row);
  if (!payload || typeof payload.path !== "string") {
    throw new Error("Rollback payload is invalid.");
  }

  const target = await resolveExistingSafeTarget(payload.path);
  let content: string;
  if (typeof payload.previousContent === "string") {
    content = payload.previousContent;
  } else if (typeof payload.backupPath === "string") {
    const backup = await resolveExistingSafeTarget(payload.backupPath);
    content = await readFile(backup.targetPath, "utf8");
  } else {
    throw new Error("Rollback payload has no restore content.");
  }

  await writeViaTemp({
    targetPath: target.targetPath,
    content,
    executionId: row.execution_id,
  });

  return { path: payload.path, kind: row.kind };
}

async function unlinkCreated(
  row: RollbackRow,
): Promise<{ path: string; kind: RollbackKind }> {
  const payload = parsePayload<UnlinkCreatedPayload>(row);
  if (!payload || typeof payload.path !== "string") {
    throw new Error("Rollback payload is invalid.");
  }

  const target = await resolveMaybeMissingSafeTarget(payload.path);
  if (target.exists && (await exists(target.targetPath))) {
    await rm(target.targetPath, { force: false });
  }

  return { path: payload.path, kind: row.kind };
}

async function truncateToLength(
  row: RollbackRow,
): Promise<{ path: string; kind: RollbackKind }> {
  const payload = parsePayload<TruncatePayload>(row);
  if (
    !payload ||
    typeof payload.path !== "string" ||
    typeof payload.previousLength !== "number" ||
    !Number.isInteger(payload.previousLength) ||
    payload.previousLength < 0
  ) {
    throw new Error("Rollback payload is invalid.");
  }

  const target = await resolveExistingSafeTarget(payload.path);
  await truncate(target.targetPath, payload.previousLength);

  return { path: payload.path, kind: row.kind };
}

async function rmdirEmpty(
  row: RollbackRow,
): Promise<{ path: string; kind: RollbackKind }> {
  const payload = parsePayload<RmdirEmptyPayload>(row);
  if (!payload || typeof payload.path !== "string") {
    throw new Error("Rollback payload is invalid.");
  }

  const target = await resolveExistingSafeTarget(payload.path);
  const info = await stat(target.targetPath);
  if (!info.isDirectory()) {
    throw new RollbackDeniedError(
      "Rollback target is not a directory.",
      "not_directory",
    );
  }

  if ((await readdir(target.targetPath)).length > 0) {
    throw new RollbackDeniedError(
      "Directory is not empty.",
      "directory_not_empty",
    );
  }

  await rmdir(target.targetPath);

  return { path: payload.path, kind: row.kind };
}

async function moveBack(
  row: RollbackRow,
): Promise<{ path: string; kind: RollbackKind }> {
  const payload = parsePayload<MoveBackPayload>(row);
  if (
    !payload ||
    typeof payload.fromPath !== "string" ||
    typeof payload.toPath !== "string"
  ) {
    throw new Error("Rollback payload is invalid.");
  }

  const destination = await resolveExistingSafeTarget(payload.toPath);
  const source = await resolveMaybeMissingSafeTarget(payload.fromPath);
  if (destination.workspaceRoot !== source.workspaceRoot) {
    throw new SafePathError("Path escapes the workspace root.", "path_escape");
  }
  if (source.exists && (await exists(source.targetPath))) {
    throw new RollbackDeniedError(
      "Original source path is occupied.",
      "source_path_occupied",
    );
  }

  const info = await stat(destination.targetPath);
  if (
    info.isDirectory() &&
    (await readdir(destination.targetPath)).length > 0
  ) {
    throw new RollbackDeniedError(
      "Directory is not empty.",
      "directory_not_empty",
    );
  }

  await rename(destination.targetPath, source.targetPath);

  return {
    path: `${payload.toPath}->${payload.fromPath}`,
    kind: row.kind,
  };
}

export async function executeRollback(input: {
  row: RollbackRow;
  now: number;
}): Promise<ToolResult> {
  if (input.row.applied_at !== null) {
    return denied("Rollback was already applied.", "rollback_already_applied");
  }
  if (input.now - input.row.created_at > ROLLBACK_TTL_MS) {
    return denied("Rollback has expired.", "rollback_expired");
  }

  try {
    const result =
      input.row.kind === "fs_restore_content"
        ? await restoreContent(input.row)
        : input.row.kind === "fs_unlink_created"
          ? await unlinkCreated(input.row)
          : input.row.kind === "fs_truncate_to_length"
            ? await truncateToLength(input.row)
            : input.row.kind === "fs_rmdir_empty"
              ? await rmdirEmpty(input.row)
              : input.row.kind === "fs_move_back"
                ? await moveBack(input.row)
                : null;

    if (!result) {
      return denied("Rollback kind is not supported.", "unsupported_rollback");
    }

    return {
      ok: true,
      status: "COMPLETED",
      message: "Rollback applied.",
      data: {
        rollbackId: input.row.id,
        originalExecutionId: input.row.execution_id,
        kind: result.kind,
        path: result.path,
      },
    };
  } catch (error) {
    return safeError(error);
  }
}

export const fsUndoTool: Tool<UndoInput> = {
  id: "fs.undo",
  name: "Undo Last File Change",
  description:
    "Undo the most recent unapplied filesystem rollback for this session.",
  requiredSafetyTag: "ALLOW",
  inputSchema: UndoInputSchema,
  scopeOf() {
    return "session:last_rollback";
  },
  reversibilityClass: "PURE_READ",
  timeoutMs: UNDO_TIMEOUT_MS,
  async execute(_input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied("Rollback database is unavailable.", "db_unavailable");
    }

    const latest = getLatestRollbackForSession(context.db, context.sessionId);
    if (!latest) {
      return denied("No rollback is available.", "rollback_missing");
    }
    if (latest.applied_at !== null) {
      return denied(
        "Rollback was already applied.",
        "rollback_already_applied",
      );
    }

    const rollback = getLatestUnappliedRollbackForSession(
      context.db,
      context.sessionId,
    );
    if (!rollback) {
      return denied("No unapplied rollback is available.", "rollback_missing");
    }

    const outcome = await executeRollback({ row: rollback, now: Date.now() });
    if (outcome.ok) {
      markRollbackApplied(context.db, rollback.id, Date.now());
    }
    return outcome;
  },
};

export { ROLLBACK_TTL_MS, UNDO_TIMEOUT_MS };
