import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildObsidianVaultIndex,
  getObsidianNoteMetadata,
  getObsidianNoteSnippet,
  loadObsidianVaultConfig,
  validateObsidianVaultPath,
} from "./pull-indexer";

let vaultRoot: string;

beforeEach(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), "jarvis-obsidian-"));
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe("P0.2.a Obsidian pull-only vault path", () => {
  it("fails closed when OBSIDIAN_VAULT_PATH is missing, absent, or not a directory", async () => {
    await expect(loadObsidianVaultConfig({})).rejects.toMatchObject({
      reason: "missing_env",
    });

    await expect(
      validateObsidianVaultPath(join(vaultRoot, "missing")),
    ).rejects.toMatchObject({
      reason: "path_not_found",
    });

    const filePath = join(vaultRoot, "not-a-vault.md");
    await writeFile(filePath, "# Not a vault\n", "utf8");
    await expect(validateObsidianVaultPath(filePath)).rejects.toMatchObject({
      reason: "not_directory",
    });
  });

  it("loads the configured vault path without creating scaffold folders", async () => {
    const config = await loadObsidianVaultConfig({
      OBSIDIAN_VAULT_PATH: vaultRoot,
    });

    expect(config.envName).toBe("OBSIDIAN_VAULT_PATH");
    expect(config.vaultPath).toBe(await validateObsidianVaultPath(vaultRoot));
    await expect(stat(join(vaultRoot, "00-inbox"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

describe("P0.2.a Obsidian pull-only indexer", () => {
  it("builds a deterministic metadata-only index from markdown notes", async () => {
    await writeNote(
      "Notes/Alpha.md",
      [
        "---",
        "title: Alpha Plan",
        "tags:",
        "  - Jarvis",
        "  - phase/p0-2",
        "---",
        "# Ignored Heading",
        "body-secret-alpha #inline-tag",
      ].join("\n"),
    );
    await writeNote("Plain.md", "# Plain Heading\nplain-body-secret #loose");
    await writeNote("Projects/Beta.md", "No heading body-secret-beta");
    await writeNote(".obsidian/config.md", "hidden-body-secret");
    await writeNote(".env.md", "credential-body-secret");
    await writeNote("Notes/readme.txt", "not markdown");
    await mkdir(join(vaultRoot, "Archive"), { recursive: true });

    const index = await buildObsidianVaultIndex({
      vaultPath: vaultRoot,
      now: () => 123,
    });

    expect(index.indexed_at_ms).toBe(123);
    expect(index.body_bytes_indexed).toBe(0);
    expect(index.telemetry).toEqual({
      metadata_only: true,
      note_count: 3,
      folder_count: 4,
      body_retained: false,
      vault_mutated: false,
    });
    expect(index.notes.map((note) => note.path)).toEqual([
      "Notes/Alpha.md",
      "Plain.md",
      "Projects/Beta.md",
    ]);
    expect(index.folders.map((folder) => folder.path)).toEqual([
      ".",
      "Archive",
      "Notes",
      "Projects",
    ]);

    const alpha = getObsidianNoteMetadata(index, { path: "Notes/Alpha.md" });
    expect(alpha).toMatchObject({
      title: "Alpha Plan",
      path: "Notes/Alpha.md",
      tags: ["inline-tag", "jarvis", "phase/p0-2"],
    });
    expect(alpha?.id).toMatch(/^obsidian:[a-f0-9]{24}$/);

    const serialized = JSON.stringify(index);
    expect(serialized).not.toContain("body-secret-alpha");
    expect(serialized).not.toContain("hidden-body-secret");
    expect(serialized).not.toContain("credential-body-secret");
  });

  it("retrieves metadata and bounded snippets by id or relative path", async () => {
    await writeNote(
      "Research/Deep Note.md",
      [
        "---",
        "title: Private Frontmatter",
        "tags: [Research]",
        "---",
        "# Visible Heading",
        "bounded snippet body that can be returned directly",
      ].join("\n"),
    );

    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const metadata = getObsidianNoteMetadata(index, {
      path: "Research/Deep Note.md",
    });

    expect(metadata?.title).toBe("Private Frontmatter");
    expect(getObsidianNoteMetadata(index, { id: metadata?.id })).toBe(metadata);
    await expect(() =>
      getObsidianNoteMetadata(index, { path: "../Deep Note.md" }),
    ).toThrowError(/escapes/);

    const snippet = await getObsidianNoteSnippet(index, {
      id: metadata?.id,
      maxChars: 24,
    });

    expect(snippet).toMatchObject({
      note: metadata,
      snippet: "# Visible Heading\nbounde",
      truncated: true,
      max_chars: 24,
    });
    expect(snippet?.snippet).not.toContain("Private Frontmatter");
    expect(snippet?.snippet.length).toBeLessThanOrEqual(24);
  });

  it("does not mutate vault files during indexing or snippet retrieval", async () => {
    await writeNote(
      "Daily/Today.md",
      "# Today\nmutation sentinel should stay exactly on disk",
    );
    await writeNote("Ideas/Later.md", "# Later\nunchanged");
    const before = await snapshotVault(vaultRoot);

    const index = await buildObsidianVaultIndex({ vaultPath: vaultRoot });
    const today = getObsidianNoteMetadata(index, { path: "Daily/Today.md" });
    await getObsidianNoteSnippet(index, { id: today?.id });

    expect(await snapshotVault(vaultRoot)).toEqual(before);
  });

  it("keeps the implementation free of writes, watchers, network, and embeddings", async () => {
    const source = await readFile(
      new URL("./pull-indexer.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|OpenAI|Anthropic|embedding|vector)\b/i,
    );
    expect(source).not.toContain("ensureVaultScaffold");
    expect(source).not.toContain("writeVaultFileAtomically");
    expect(source).not.toContain("memory.note");
  });
});

async function writeNote(relativePath: string, body: string): Promise<void> {
  const absolutePath = join(vaultRoot, ...relativePath.split("/"));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body, "utf8");
}

async function snapshotVault(
  root: string,
): Promise<
  Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  >
> {
  const snapshot: Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  > = {};
  await snapshotDirectory(root, root, snapshot);
  return snapshot;
}

async function snapshotDirectory(
  root: string,
  current: string,
  snapshot: Record<
    string,
    { readonly hash: string; readonly mtime_ms: number; readonly size: number }
  >,
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      await snapshotDirectory(root, absolutePath, snapshot);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolutePath);
    const body = await readFile(absolutePath);
    const relativePath = absolutePath
      .slice(root.length + 1)
      .replace(/\\/g, "/");
    snapshot[relativePath] = {
      hash: createHash("sha256").update(body).digest("hex"),
      mtime_ms: info.mtimeMs,
      size: info.size,
    };
  }
}
