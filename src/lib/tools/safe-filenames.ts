import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { SafePathError } from "./fs-safe-path";

export const SAFE_FILENAME_SEGMENT_MAX_LENGTH = 120;

export function executionPathSegment(untrustedId: string): string {
  const raw = String(untrustedId);
  const hash = createHash("sha256")
    .update(raw)
    .digest("base64url")
    .slice(0, 12);
  const sanitized = raw
    .replace(/\0/g, "_")
    .replace(/[\\/:\s]+/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefix = "exec_";
  const suffix = `_${hash}`;
  const maxCoreLength =
    SAFE_FILENAME_SEGMENT_MAX_LENGTH - prefix.length - suffix.length;
  const core = (sanitized || "id").slice(0, Math.max(1, maxCoreLength));

  return `${prefix}${core}${suffix}`;
}

export function isPathInsideDirectory(
  root: string,
  candidate: string,
): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const rel = relative(resolvedRoot, resolvedCandidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function assertPathInsideDirectory(
  root: string,
  candidate: string,
  message = "Path escapes the expected directory.",
): void {
  if (!isPathInsideDirectory(root, candidate)) {
    throw new SafePathError(message, "path_escape");
  }
}

export function assertPathDirectChild(
  parent: string,
  candidate: string,
  message = "Path escapes the expected parent directory.",
): void {
  const resolvedParent = resolve(parent);
  const resolvedCandidate = resolve(candidate);
  if (
    dirname(resolvedCandidate) !== resolvedParent ||
    !isPathInsideDirectory(resolvedParent, resolvedCandidate)
  ) {
    throw new SafePathError(message, "path_escape");
  }
}
