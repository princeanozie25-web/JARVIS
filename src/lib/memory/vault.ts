import { mkdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { assertPathDirectChild } from "../tools/safe-filenames";

export const VAULT_SCAFFOLD_DIRS = [
  "00-meta",
  "10-daily",
  "20-projects",
  "30-people",
  "40-places",
  "50-ideas",
  "60-lessons",
  "70-references",
  "80-reviews",
  "90-archive",
  "_attachments",
] as const;

export function vaultRootFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.JARVIS_OBSIDIAN_VAULT_ROOT?.trim() || "~/jarvis-vault";
  if (raw === "~") return homedir();
  if (raw.startsWith(`~${sep}`) || raw.startsWith("~/")) {
    return resolve(join(homedir(), raw.slice(2)));
  }
  return resolve(raw);
}

function isFilesystemRoot(path: string): boolean {
  const resolved = resolve(path);
  return dirname(resolved) === resolved;
}

function stripTrailingSeparator(path: string): string {
  return path.endsWith(sep) ? path.slice(0, -1) : path;
}

export function assertSafeVaultRoot(vaultRoot: string): void {
  if (!isAbsolute(vaultRoot)) {
    throw new Error("Vault root must resolve to an absolute path.");
  }
  if (isFilesystemRoot(vaultRoot)) {
    throw new Error("Vault root cannot be the filesystem root.");
  }
}

export async function ensureVaultScaffold(
  vaultRoot: string = vaultRootFromEnv(),
): Promise<string> {
  assertSafeVaultRoot(vaultRoot);
  await mkdir(vaultRoot, { recursive: true });
  const info = await stat(vaultRoot);
  if (!info.isDirectory()) {
    throw new Error("Vault root exists but is not a directory.");
  }

  const realRoot = stripTrailingSeparator(await realpath(vaultRoot));
  for (const dir of VAULT_SCAFFOLD_DIRS) {
    await mkdir(resolve(realRoot, dir), { recursive: true });
  }
  return realRoot;
}

export function slugifyNoteTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/\0/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "untitled";
}

export function slugifyPathSegment(value: string): string {
  return slugifyNoteTitle(value).replace(/-+/g, "-") || "general";
}

export function relativeVaultPath(vaultRoot: string, filePath: string): string {
  const rel = relative(vaultRoot, filePath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Vault path escapes the vault root.");
  }
  return rel.replace(/\\/g, "/");
}

export async function writeVaultFileAtomically(input: {
  vaultRoot: string;
  relativePath: string;
  content: string;
  executionId: string;
}): Promise<string> {
  const targetPath = resolve(input.vaultRoot, input.relativePath);
  const rel = relative(input.vaultRoot, targetPath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Vault path escapes the vault root.");
  }

  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = resolve(
    dirname(targetPath),
    `.${basename(targetPath)}.${slugifyPathSegment(input.executionId)}.tmp`,
  );
  assertPathDirectChild(dirname(targetPath), tempPath);

  try {
    await writeFile(tempPath, input.content, { encoding: "utf8", flag: "wx" });
    await writeFile(targetPath, input.content, {
      encoding: "utf8",
      flag: "wx",
    });
  } finally {
    await rm(tempPath, { force: true });
  }

  return targetPath;
}
