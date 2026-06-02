import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_DETECT_CLI_VERSION,
  ObsidianVaultPathError,
  planKnowledgeDetectionFromIndex,
  printKnowledgeDetectReport,
  runKnowledgeDetectCli,
} from "./index";
import type { ObsidianNoteMetadata, ObsidianVaultIndex } from "./pull-indexer";

const NOW = new Date("2026-06-02T15:00:00.000Z");
const OLD = new Date("2025-10-01T15:00:00.000Z");
const RECENT = new Date("2026-05-15T15:00:00.000Z");

function note(
  path: string,
  overrides: Partial<ObsidianNoteMetadata> = {},
): ObsidianNoteMetadata {
  const idSlug = path
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `obsidian:${idSlug}`,
    title: path.split("/").at(-1)?.replace(/\.md$/, "") ?? path,
    path,
    size_bytes: 1_200,
    created_at_ms: OLD.getTime(),
    modified_at_ms: OLD.getTime(),
    tags: [],
    ...overrides,
  };
}

function index(notes: readonly ObsidianNoteMetadata[]): ObsidianVaultIndex {
  return {
    vault_path: "C:/vault",
    indexed_at_ms: NOW.getTime(),
    notes,
    folders: [],
    by_id: new Map(notes.map((entry) => [entry.id, entry])),
    by_path: new Map(notes.map((entry) => [entry.path, entry])),
    body_bytes_indexed: 0,
    telemetry: {
      metadata_only: true,
      note_count: notes.length,
      folder_count: 0,
      body_retained: false,
      vault_mutated: false,
    },
  };
}

function fixtureIndex(): ObsidianVaultIndex {
  return index([
    note("10-wiki/hubs/sparse-hub.md", {
      id: "obsidian:hub-sparse",
      title: "Sparse Hub",
      size_bytes: 360,
      modified_at_ms: RECENT.getTime(),
      tags: ["alpha"],
    }),
    note("10-wiki/concepts/alpha-concept.md", {
      id: "obsidian:alpha-concept",
      title: "Alpha Concept",
      size_bytes: 900,
      tags: ["alpha", "fragment"],
    }),
    note("10-wiki/concepts/alpha-copy.md", {
      id: "obsidian:alpha-copy",
      title: "Alpha Concept",
      size_bytes: 1_800,
      modified_at_ms: RECENT.getTime(),
      tags: ["alpha"],
    }),
    note("10-wiki/concepts/alpha-part-two.md", {
      id: "obsidian:alpha-part-two",
      title: "Alpha Part Two",
      size_bytes: 1_200,
      tags: ["fragment"],
    }),
    note("10-wiki/concepts/alpha-part-three.md", {
      id: "obsidian:alpha-part-three",
      title: "Alpha Part Three",
      size_bytes: 1_200,
      tags: ["fragment"],
    }),
    note("10-wiki/concepts/alpha-part-four.md", {
      id: "obsidian:alpha-part-four",
      title: "Alpha Part Four",
      size_bytes: 1_200,
      tags: ["fragment"],
    }),
    note("10-wiki/systems/jarvis-system.md", {
      id: "obsidian:jarvis-system",
      title: "JARVIS System",
      size_bytes: 2_400,
      modified_at_ms: RECENT.getTime(),
      tags: ["system"],
    }),
    note("30-research/raw-source.md", {
      id: "obsidian:raw-source",
      title: "Raw Source",
      size_bytes: 2_000,
      modified_at_ms: RECENT.getTime(),
      tags: ["alpha"],
    }),
  ]);
}

describe("Phase 21 Knowledge Compounding detection CLI logic", () => {
  it("handles empty or tiny vault indexes as a safe successful no-op", async () => {
    const lines: string[] = [];
    const report = await runKnowledgeDetectCli({
      buildIndex: async () =>
        index([
          note("10-wiki/concepts/tiny.md", {
            id: "obsidian:tiny",
            title: "Tiny",
          }),
        ]),
      now: () => NOW,
      writeLine: (line) => lines.push(line),
    });

    expect(report).toMatchObject({
      cli_version: KNOWLEDGE_DETECT_CLI_VERSION,
      status: "ok",
      reason: "insufficient_knowledge_graph",
      total_notes_scanned: 1,
      wiki_pages_scanned: 1,
      candidate_count: 0,
      write_attempted: false,
      vault_mutated: false,
    });
    expect(lines).toContain("candidate_count: 0");
    expect(lines).toContain("write_attempted: false");
    expect(lines).toContain("vault_mutated: false");
  });

  it("skips safely when OBSIDIAN_VAULT_PATH is not configured", async () => {
    const report = await runKnowledgeDetectCli({
      buildIndex: async () => {
        throw new ObsidianVaultPathError(
          "OBSIDIAN_VAULT_PATH is required.",
          "missing_env",
        );
      },
      writeLine: () => undefined,
    });

    expect(report).toMatchObject({
      status: "skipped",
      reason: "vault_not_configured",
      candidate_count: 0,
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("detects candidates from fixture metadata and plans bridge recommendations", () => {
    const report = planKnowledgeDetectionFromIndex(fixtureIndex(), () => NOW);

    expect(report).toMatchObject({
      status: "ok",
      reason: "detected",
      total_notes_scanned: 8,
      wiki_pages_scanned: 7,
      source_notes_scanned: 1,
      write_attempted: false,
      vault_mutated: false,
    });
    expect(report.candidate_count).toBeGreaterThan(0);
    expect([
      ...new Set(report.candidates.map((entry) => entry.candidate_type)),
    ]).toEqual(
      expect.arrayContaining([
        "sparse_hub",
        "fragmented_concept",
        "duplicate_concept",
        "stale_wiki_page",
        "underlinked_system",
      ]),
    );
    expect(
      report.bridge_recommendations.map((entry) => entry.wiki_action),
    ).toEqual(
      expect.arrayContaining([
        "update_hub",
        "merge_pages",
        "refresh_stale_page",
        "create_backlinks",
      ]),
    );
    expect(report.candidates[0]).toMatchObject({
      affected_pages: expect.any(Array),
      supporting_sources: expect.any(Array),
      supporting_source_paths: expect.any(Array),
      write_attempted: false,
    });
  });

  it("prints metadata only and does not expose raw body text", () => {
    const lines: string[] = [];
    const report = planKnowledgeDetectionFromIndex(fixtureIndex(), () => NOW);

    printKnowledgeDetectReport(report, (line) => lines.push(line));

    const output = lines.join("\n");
    expect(output).toContain("candidate_count:");
    expect(output).toContain("write_attempted: false");
    expect(output).toContain("vault_mutated: false");
    expect(output).not.toContain("Secret body");
    expect(output).not.toContain("raw_body");
    expect(output).not.toContain("markdown_body");
  });
});

describe("Phase 21 Knowledge Compounding detection CLI governance tripwires", () => {
  it("contains no model, network, write, scheduler, watcher, or execution path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/knowledge-detect-cli.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|fetch|WebSocket|Worker|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
    expect(source).not.toMatch(
      /from ["'](?:openai|@anthropic|ollama|deepseek)|new OpenAI|chat\.completions|responses\.create|generateText|runAgent|autonomousAgent/i,
    );
  });
});
