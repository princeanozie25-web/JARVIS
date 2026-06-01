import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  extname,
  isAbsolute,
  parse,
  relative,
  resolve,
} from "node:path";
import { TextDecoder } from "node:util";

export const OBSIDIAN_VAULT_PATH_ENV = "OBSIDIAN_VAULT_PATH";
export const OBSIDIAN_INDEX_MAX_NOTE_BYTES = 1024 * 1024;
export const OBSIDIAN_SNIPPET_DEFAULT_CHARS = 600;
export const OBSIDIAN_SNIPPET_MAX_CHARS = 4_000;

export type ObsidianVaultPathErrorReason =
  | "missing_env"
  | "path_not_found"
  | "not_directory"
  | "path_escape"
  | "filesystem_error";

export class ObsidianVaultPathError extends Error {
  constructor(
    message: string,
    readonly reason: ObsidianVaultPathErrorReason,
  ) {
    super(message);
    this.name = "ObsidianVaultPathError";
  }
}

export interface ObsidianVaultConfig {
  readonly vaultPath: string;
  readonly envName: typeof OBSIDIAN_VAULT_PATH_ENV;
}

export interface ObsidianFolderMetadata {
  readonly path: string;
  readonly note_count: number;
}

export interface ObsidianNoteMetadata {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly size_bytes: number;
  readonly created_at_ms: number;
  readonly modified_at_ms: number;
  readonly tags: readonly string[];
}

export interface ObsidianVaultIndex {
  readonly vault_path: string;
  readonly indexed_at_ms: number;
  readonly notes: readonly ObsidianNoteMetadata[];
  readonly folders: readonly ObsidianFolderMetadata[];
  readonly by_id: ReadonlyMap<string, ObsidianNoteMetadata>;
  readonly by_path: ReadonlyMap<string, ObsidianNoteMetadata>;
  readonly body_bytes_indexed: 0;
  readonly telemetry: {
    readonly metadata_only: true;
    readonly note_count: number;
    readonly folder_count: number;
    readonly body_retained: false;
    readonly vault_mutated: false;
  };
}

export interface BuildObsidianVaultIndexOptions {
  readonly vaultPath?: string;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => number;
}

export interface ObsidianSnippet {
  readonly note: ObsidianNoteMetadata;
  readonly snippet: string;
  readonly truncated: boolean;
  readonly max_chars: number;
}

export interface ObsidianLookupInput {
  readonly id?: string;
  readonly path?: string;
}

export interface ObsidianSnippetInput extends ObsidianLookupInput {
  readonly maxChars?: number;
}

interface NoteReadResult {
  readonly metadata: ObsidianNoteMetadata;
  readonly folder: string;
}

export async function loadObsidianVaultConfig(
  env: Record<string, string | undefined> = process.env,
): Promise<ObsidianVaultConfig> {
  const raw = env[OBSIDIAN_VAULT_PATH_ENV]?.trim();
  if (!raw) {
    throw new ObsidianVaultPathError(
      "OBSIDIAN_VAULT_PATH is required for pull-only vault indexing.",
      "missing_env",
    );
  }
  return {
    vaultPath: await validateObsidianVaultPath(raw),
    envName: OBSIDIAN_VAULT_PATH_ENV,
  };
}

export async function validateObsidianVaultPath(path: string): Promise<string> {
  const candidate = path.trim();
  if (!candidate || candidate.includes("\0")) {
    throw new ObsidianVaultPathError(
      "OBSIDIAN_VAULT_PATH must be a non-empty filesystem path.",
      "missing_env",
    );
  }
  try {
    const resolved = resolve(expandHome(candidate));
    const real = await realpath(resolved);
    if (real === parse(real).root) {
      throw new ObsidianVaultPathError(
        "OBSIDIAN_VAULT_PATH must not point at a filesystem root.",
        "not_directory",
      );
    }
    const info = await stat(real);
    if (!info.isDirectory()) {
      throw new ObsidianVaultPathError(
        "OBSIDIAN_VAULT_PATH must point to a directory.",
        "not_directory",
      );
    }
    return real;
  } catch (error) {
    if (error instanceof ObsidianVaultPathError) throw error;
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "ENOENT") {
      throw new ObsidianVaultPathError(
        "OBSIDIAN_VAULT_PATH does not exist.",
        "path_not_found",
      );
    }
    throw new ObsidianVaultPathError(
      error instanceof Error
        ? `Could not validate OBSIDIAN_VAULT_PATH: ${error.message}`
        : "Could not validate OBSIDIAN_VAULT_PATH.",
      "filesystem_error",
    );
  }
}

export async function buildObsidianVaultIndex(
  options: BuildObsidianVaultIndexOptions = {},
): Promise<ObsidianVaultIndex> {
  const vaultPath = options.vaultPath
    ? await validateObsidianVaultPath(options.vaultPath)
    : (await loadObsidianVaultConfig(options.env)).vaultPath;
  const notes: NoteReadResult[] = [];
  const folderCounts = new Map<string, number>();

  await traverseVault({
    vaultPath,
    currentPath: vaultPath,
    notes,
    folderCounts,
  });

  const noteMetadata = notes
    .map((note) => note.metadata)
    .sort((left, right) => left.path.localeCompare(right.path));
  const folders = Array.from(folderCounts.entries())
    .map(([path, note_count]) => ({ path, note_count }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const byId = new Map(noteMetadata.map((note) => [note.id, note] as const));
  const byPath = new Map(
    noteMetadata.map((note) => [note.path, note] as const),
  );

  return {
    vault_path: vaultPath,
    indexed_at_ms: options.now?.() ?? Date.now(),
    notes: noteMetadata,
    folders,
    by_id: byId,
    by_path: byPath,
    body_bytes_indexed: 0,
    telemetry: {
      metadata_only: true,
      note_count: noteMetadata.length,
      folder_count: folders.length,
      body_retained: false,
      vault_mutated: false,
    },
  };
}

export function getObsidianNoteMetadata(
  index: ObsidianVaultIndex,
  input: ObsidianLookupInput,
): ObsidianNoteMetadata | null {
  if (input.id?.trim()) return index.by_id.get(input.id.trim()) ?? null;
  if (input.path?.trim()) {
    return index.by_path.get(normalizeRelativeVaultPath(input.path)) ?? null;
  }
  return null;
}

export async function getObsidianNoteSnippet(
  index: ObsidianVaultIndex,
  input: ObsidianSnippetInput,
): Promise<ObsidianSnippet | null> {
  const note = getObsidianNoteMetadata(index, input);
  if (!note) return null;
  const maxChars = clampSnippetChars(input.maxChars);
  const absolutePath = resolve(index.vault_path, note.path);
  assertInsideVault(index.vault_path, absolutePath);
  const realNotePath = await realpath(absolutePath);
  assertInsideVault(index.vault_path, realNotePath);
  const info = await stat(realNotePath);
  if (!info.isFile() || info.size > OBSIDIAN_INDEX_MAX_NOTE_BYTES) {
    throw new ObsidianVaultPathError(
      "Obsidian note is unavailable for snippet retrieval.",
      "filesystem_error",
    );
  }
  const body = decodeMarkdown(await readFile(realNotePath));
  const snippetSource = stripFrontmatter(body).trim();
  const snippet = snippetSource.slice(0, maxChars);
  return {
    note,
    snippet,
    truncated: snippet.length < snippetSource.length,
    max_chars: maxChars,
  };
}

async function traverseVault(input: {
  readonly vaultPath: string;
  readonly currentPath: string;
  readonly notes: NoteReadResult[];
  readonly folderCounts: Map<string, number>;
}) {
  const entries = await readdir(input.currentPath, { withFileTypes: true });
  const sorted = entries
    .filter((entry) => !shouldSkipEntry(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sorted) {
    const entryPath = resolve(input.currentPath, entry.name);
    assertInsideVault(input.vaultPath, entryPath);

    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      const folderPath = normalizeRelativeVaultPath(
        relative(input.vaultPath, entryPath),
      );
      input.folderCounts.set(
        folderPath,
        input.folderCounts.get(folderPath) ?? 0,
      );
      await traverseVault({
        ...input,
        currentPath: entryPath,
      });
      continue;
    }

    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") {
      continue;
    }

    const note = await readNoteMetadata(input.vaultPath, entryPath);
    input.notes.push(note);
    input.folderCounts.set(
      note.folder,
      (input.folderCounts.get(note.folder) ?? 0) + 1,
    );
  }
}

async function readNoteMetadata(
  vaultPath: string,
  notePath: string,
): Promise<NoteReadResult> {
  const realNotePath = await realpath(notePath);
  assertInsideVault(vaultPath, realNotePath);
  const info = await stat(realNotePath);
  if (!info.isFile() || info.size > OBSIDIAN_INDEX_MAX_NOTE_BYTES) {
    throw new ObsidianVaultPathError(
      "Obsidian markdown note exceeds the pull-only indexing size limit.",
      "filesystem_error",
    );
  }
  const relativePath = normalizeRelativeVaultPath(
    relative(vaultPath, realNotePath),
  );
  const body = decodeMarkdown(await readFile(realNotePath));
  const parsed = parseMarkdownMetadata(body, relativePath);
  return {
    folder: folderPathFor(relativePath),
    metadata: {
      id: noteId(relativePath),
      title: parsed.title,
      path: relativePath,
      size_bytes: info.size,
      created_at_ms: info.birthtimeMs,
      modified_at_ms: info.mtimeMs,
      tags: parsed.tags,
    },
  };
}

function parseMarkdownMetadata(
  body: string,
  relativePath: string,
): { readonly title: string; readonly tags: readonly string[] } {
  const frontmatter = frontmatterBlock(body);
  const title =
    frontmatterTitle(frontmatter) ??
    firstMarkdownHeading(body) ??
    basename(relativePath, ".md");
  const tags = uniqueTags([
    ...frontmatterTags(frontmatter),
    ...inlineTags(stripFrontmatter(body)),
  ]);
  return { title, tags };
}

function frontmatterBlock(body: string): string | null {
  if (!body.startsWith("---\n") && !body.startsWith("---\r\n")) return null;
  const normalized = body.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return null;
  return normalized.slice(4, end);
}

function stripFrontmatter(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return body;
  const end = normalized.indexOf("\n---\n", 4);
  return end === -1 ? body : normalized.slice(end + "\n---\n".length);
}

function frontmatterTitle(frontmatter: string | null): string | null {
  if (!frontmatter) return null;
  const match = /^title:\s*(.+)$/im.exec(frontmatter);
  return match ? unquoteScalar(match[1]) : null;
}

function frontmatterTags(frontmatter: string | null): string[] {
  if (!frontmatter) return [];
  const inline = /^tags:\s*\[(.*)]\s*$/im.exec(frontmatter);
  if (inline) {
    return inline[1]
      .split(",")
      .map((tag) => unquoteScalar(tag))
      .filter(Boolean);
  }

  const lines = frontmatter.split(/\r?\n/);
  const tags: string[] = [];
  let inTags = false;
  for (const line of lines) {
    if (/^\w/.test(line) && !/^tags:\s*$/i.test(line)) inTags = false;
    if (/^tags:\s*$/i.test(line)) {
      inTags = true;
      continue;
    }
    if (inTags) {
      const match = /^\s*-\s*(.+)$/.exec(line);
      if (match) tags.push(unquoteScalar(match[1]));
    }
  }
  return tags;
}

function inlineTags(body: string): string[] {
  return Array.from(body.matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/g)).map(
    (match) => match[2],
  );
}

function firstMarkdownHeading(body: string): string | null {
  const match = /^#\s+(.+)$/m.exec(stripFrontmatter(body));
  return match ? match[1].trim() : null;
}

function uniqueTags(tags: readonly string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => normalizeTag(tag))
        .filter((tag): tag is string => tag !== null),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function normalizeTag(tag: string): string | null {
  const normalized = tag
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

function unquoteScalar(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function decodeMarkdown(buffer: Buffer): string {
  if (buffer.includes(0)) {
    throw new ObsidianVaultPathError(
      "Obsidian markdown note was not valid UTF-8 text.",
      "filesystem_error",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ObsidianVaultPathError(
      "Obsidian markdown note was not valid UTF-8 text.",
      "filesystem_error",
    );
  }
}

function shouldSkipEntry(name: string): boolean {
  return name === ".obsidian" || name === ".git" || name.startsWith(".");
}

function folderPathFor(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index);
}

function noteId(path: string): string {
  return `obsidian:${createHash("sha256")
    .update(path, "utf8")
    .digest("hex")
    .slice(0, 24)}`;
}

function normalizeRelativeVaultPath(path: string): string {
  if (
    path.includes("\0") ||
    isAbsolute(path) ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    /^\\\\/.test(path)
  ) {
    throw new ObsidianVaultPathError(
      "Obsidian note path escapes the vault root.",
      "path_escape",
    );
  }
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..")
  ) {
    throw new ObsidianVaultPathError(
      "Obsidian note path escapes the vault root.",
      "path_escape",
    );
  }
  return normalized;
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return resolve(homedir(), path.slice(2));
  }
  return path;
}

function assertInsideVault(vaultPath: string, candidate: string): void {
  const rel = relative(vaultPath, candidate);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new ObsidianVaultPathError(
      "Obsidian path escapes the vault root.",
      "path_escape",
    );
  }
}

function clampSnippetChars(maxChars: number | undefined): number {
  if (maxChars === undefined) return OBSIDIAN_SNIPPET_DEFAULT_CHARS;
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new ObsidianVaultPathError(
      "Obsidian snippet maxChars must be a positive integer.",
      "filesystem_error",
    );
  }
  return Math.min(maxChars, OBSIDIAN_SNIPPET_MAX_CHARS);
}
