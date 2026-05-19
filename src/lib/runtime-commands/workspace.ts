import type DatabaseType from "better-sqlite3";
import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { insertTelemetryEvent } from "../db/telemetry";

const PROTECTED_RUNTIME_CWD_NAMES = new Set([".git", ".next", "node_modules"]);

export interface RuntimeWorkspaceConfig {
  workspaceRoot: string;
}

export interface ResolveRuntimeWorkingDirectoryInput {
  requestedCwd?: string | null;
  workspaceRoot?: string;
  db?: DatabaseType.Database;
  now?: () => number;
  commandId?: string;
  callId?: string;
}

export type ResolveRuntimeWorkingDirectoryResult =
  | {
      ok: true;
      workspaceRoot: string;
      resolvedCwd: string;
      relativeCwd: string;
    }
  | {
      ok: false;
      workspaceRoot: string;
      reason: string;
    };

function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith(`~${path.sep}`)) {
    return path.join(homedir(), value.slice(2));
  }
  return value;
}

function emitRuntimeWorkspaceTelemetry(
  input: ResolveRuntimeWorkingDirectoryInput & {
    eventType: "runtime_workspace_resolved" | "runtime_workspace_denied";
    success: boolean;
    reason?: string;
    workspaceRoot: string;
    relativeCwd?: string;
  },
): void {
  if (!input.db) return;
  insertTelemetryEvent(input.db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: input.eventType,
    success: input.success,
    execution_id: input.callId,
    tool_name: input.commandId,
    notes: [
      `workspace_root=${input.workspaceRoot}`,
      input.relativeCwd ? `relative_cwd=${input.relativeCwd}` : undefined,
      input.reason ? `reason=${input.reason}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export function getRuntimeWorkspaceConfig(
  input: {
    env?: Record<string, string | undefined>;
    cwd?: string;
    home?: string;
  } = {},
): RuntimeWorkspaceConfig {
  const env = input.env ?? process.env;
  const configured =
    env.JARVIS_RUNTIME_WORKSPACE_ROOT?.trim() ||
    env.JARVIS_WORKSPACE_ROOT?.trim() ||
    input.cwd?.trim();
  if (configured) {
    return {
      workspaceRoot: path.resolve(
        /*turbopackIgnore: true*/ expandHome(configured),
      ),
    };
  }

  return {
    workspaceRoot: path.resolve(
      /*turbopackIgnore: true*/ input.home ?? homedir(),
      "jarvis-workspace",
    ),
  };
}

function deny(
  input: ResolveRuntimeWorkingDirectoryInput,
  workspaceRoot: string,
  reason: string,
): ResolveRuntimeWorkingDirectoryResult {
  emitRuntimeWorkspaceTelemetry({
    ...input,
    eventType: "runtime_workspace_denied",
    success: false,
    workspaceRoot,
    reason,
  });
  return { ok: false, workspaceRoot, reason };
}

function containsTraversal(raw: string): boolean {
  return raw
    .split(/[\\/]+/)
    .filter(Boolean)
    .some((segment) => segment === "..");
}

function containsProtectedSegment(raw: string): boolean {
  return raw
    .split(/[\\/]+/)
    .filter(Boolean)
    .some((segment) => PROTECTED_RUNTIME_CWD_NAMES.has(segment));
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizeRequestedCwd(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === "repo_root" ||
    trimmed === "none"
  ) {
    return ".";
  }
  return trimmed;
}

export function resolveRuntimeWorkingDirectory(
  input: ResolveRuntimeWorkingDirectoryInput = {},
): ResolveRuntimeWorkingDirectoryResult {
  const workspaceRoot = path.resolve(
    /*turbopackIgnore: true*/
    input.workspaceRoot ?? getRuntimeWorkspaceConfig().workspaceRoot,
  );
  if (!existsSync(workspaceRoot)) {
    return deny(input, workspaceRoot, "workspace_root_missing");
  }

  let realWorkspaceRoot: string;
  try {
    realWorkspaceRoot = realpathSync.native(workspaceRoot);
    if (!statSync(realWorkspaceRoot).isDirectory()) {
      return deny(input, workspaceRoot, "workspace_root_not_directory");
    }
  } catch {
    return deny(input, workspaceRoot, "workspace_root_unresolvable");
  }

  const requested = normalizeRequestedCwd(input.requestedCwd);
  if (/^[a-zA-Z]:(?![\\/])/.test(requested)) {
    return deny(input, realWorkspaceRoot, "windows_drive_relative_rejected");
  }
  if (containsTraversal(requested)) {
    return deny(input, realWorkspaceRoot, "path_traversal_rejected");
  }
  if (containsProtectedSegment(requested)) {
    return deny(input, realWorkspaceRoot, "protected_directory_rejected");
  }

  const candidate = path.isAbsolute(requested)
    ? path.resolve(/*turbopackIgnore: true*/ requested)
    : path.resolve(/*turbopackIgnore: true*/ realWorkspaceRoot, requested);
  if (!isInside(realWorkspaceRoot, candidate)) {
    return deny(input, realWorkspaceRoot, "outside_workspace_rejected");
  }
  if (!existsSync(candidate)) {
    return deny(input, realWorkspaceRoot, "working_directory_missing");
  }

  try {
    if (!statSync(candidate).isDirectory()) {
      return deny(input, realWorkspaceRoot, "working_directory_not_directory");
    }
    if (lstatSync(candidate).isSymbolicLink()) {
      const realCandidate = realpathSync.native(candidate);
      if (!isInside(realWorkspaceRoot, realCandidate)) {
        return deny(input, realWorkspaceRoot, "symlink_escape_rejected");
      }
    }
    const realCandidate = realpathSync.native(candidate);
    if (!isInside(realWorkspaceRoot, realCandidate)) {
      return deny(input, realWorkspaceRoot, "symlink_escape_rejected");
    }
    const relativeCwd = path.relative(realWorkspaceRoot, realCandidate) || ".";
    emitRuntimeWorkspaceTelemetry({
      ...input,
      eventType: "runtime_workspace_resolved",
      success: true,
      workspaceRoot: realWorkspaceRoot,
      relativeCwd,
    });
    return {
      ok: true,
      workspaceRoot: realWorkspaceRoot,
      resolvedCwd: realCandidate,
      relativeCwd,
    };
  } catch {
    return deny(input, realWorkspaceRoot, "working_directory_unresolvable");
  }
}
