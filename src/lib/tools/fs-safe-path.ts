import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const PROTECTED_FILE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /\.crt$/i,
  /^secrets(?:\.|$)/i,
  /^id_rsa/i,
] as const;

const PROTECTED_DIR_NAMES = new Set([".ssh", ".gnupg"]);

export interface SafePathResult {
  workspaceRoot: string;
  requestedPath: string;
  resolvedPath: string;
}

export class SafePathError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "path_escape"
      | "protected_path"
      | "not_found"
      | "workspace_unavailable",
  ) {
    super(message);
    this.name = "SafePathError";
  }
}

export function workspaceRootFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.JARVIS_WORKSPACE_ROOT ?? join(homedir(), "jarvis-workspace");
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function hasProtectedSegment(path: string): boolean {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.some((part) => PROTECTED_DIR_NAMES.has(part.toLowerCase()));
}

export function isProtectedPath(path: string): boolean {
  if (hasProtectedSegment(path)) return true;
  const name = basename(path);
  return PROTECTED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

export async function resolveSafePath(
  inputPath: string,
  workspaceRoot: string = workspaceRootFromEnv(),
): Promise<SafePathResult> {
  let realRoot: string;
  try {
    realRoot = await realpath(workspaceRoot);
  } catch (error) {
    throw new SafePathError(
      `Workspace root is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "workspace_unavailable",
    );
  }

  const requestedPath = resolve(realRoot, inputPath || ".");
  if (!isInside(realRoot, requestedPath)) {
    throw new SafePathError("Path escapes the workspace root.", "path_escape");
  }
  if (isProtectedPath(requestedPath)) {
    throw new SafePathError("Path is protected.", "protected_path");
  }

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(requestedPath);
  } catch (error) {
    throw new SafePathError(
      `Path does not exist: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "not_found",
    );
  }

  if (!isInside(realRoot, resolvedPath)) {
    throw new SafePathError("Path escapes the workspace root.", "path_escape");
  }
  if (isProtectedPath(resolvedPath)) {
    throw new SafePathError("Path is protected.", "protected_path");
  }

  return {
    workspaceRoot: realRoot.endsWith(sep) ? realRoot.slice(0, -1) : realRoot,
    requestedPath,
    resolvedPath,
  };
}
