import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { deleteLongTermMemory, insertLongTermMemory } from "../db/memory";
import { recordRollbackForToolCall } from "../db/rollbacks";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  LONG_TERM_MEMORY_CATEGORIES,
  MEMORY_NOTE_SOURCES,
  MEMORY_SENSITIVITY_TIERS,
  type LongTermMemoryCategory,
  type MemorySensitivity,
} from "../memory/types";
import {
  ensureVaultScaffold,
  slugifyNoteTitle,
  slugifyPathSegment,
  vaultRootFromEnv,
  writeVaultFileAtomically,
} from "../memory/vault";
import type { Tool, ToolResult } from "./types";

const MEMORY_NOTE_TIMEOUT_MS = 5_000;
const MAX_MEMORY_NOTE_CONTENT_BYTES = 128 * 1024;

const MemoryNoteInputSchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(MAX_MEMORY_NOTE_CONTENT_BYTES),
  category: z.enum(LONG_TERM_MEMORY_CATEGORIES),
  sensitivity: z.enum(MEMORY_SENSITIVITY_TIERS),
  source: z.enum(MEMORY_NOTE_SOURCES).default("user"),
  sourceId: z.string().min(1).max(200).optional(),
  project: z.string().min(1).max(120).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).default([]),
});

export type MemoryNoteInput = z.infer<typeof MemoryNoteInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function contentHashForScope(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function normaliseTag(tag: string): string {
  const trimmed = tag.trim().replace(/^#+/, "");
  const safe = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe ? `#${safe}` : "#memory";
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(normaliseTag))).slice(0, 20);
}

function isoDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function yamlList(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function noteRelativePath(input: {
  title: string;
  category: LongTermMemoryCategory;
  project?: string;
  createdAt: number;
  id: string;
}): string {
  const date = new Date(input.createdAt).toISOString().slice(0, 10);
  const filename = `${date}-${slugifyNoteTitle(input.title)}-${input.id.slice(
    0,
    8,
  )}.md`;

  if (input.category === "decision" && input.project) {
    return `20-projects/${slugifyPathSegment(input.project)}/decisions/${filename}`;
  }

  return `50-ideas/${filename}`;
}

function renderMarkdown(input: {
  id: string;
  title: string;
  content: string;
  category: LongTermMemoryCategory;
  sensitivity: MemorySensitivity;
  source: string;
  sourceId?: string;
  project?: string;
  tags: string[];
  createdAt: number;
  hash: string;
}): string {
  const createdAt = isoDate(input.createdAt);
  const frontmatter = [
    "---",
    `type: ${input.category === "decision" ? "decision" : "idea"}`,
    `id: ${input.id}`,
    `created_at: ${createdAt}`,
    `updated_at: ${createdAt}`,
    input.sourceId ? `session_id: ${JSON.stringify(input.sourceId)}` : null,
    input.project ? `project: ${JSON.stringify(input.project)}` : null,
    `tags: ${yamlList(input.tags)}`,
    "people: []",
    "places: []",
    `sensitivity: ${input.sensitivity}`,
    "emotional_valence: neutral",
    "status: active",
    "links_in: []",
    "links_out: []",
    `hash: ${input.hash}`,
    "indexed: false",
    "embedding_version: 0",
    "---",
  ].filter(Boolean);

  return `${frontmatter.join("\n")}\n\n# ${input.title.trim()}\n\n${input.content.trim()}\n`;
}

function assertWritableSensitivity(
  sensitivity: MemorySensitivity,
): ToolResult | null {
  if (sensitivity === "sensitive") {
    return denied(
      "Sensitive memory writes require encrypted storage, which is deferred beyond Phase 3A.",
      "sensitive_requires_encryption",
    );
  }
  if (sensitivity === "restricted") {
    return denied(
      "Restricted memory writes require encrypted storage and passphrase recall, which are deferred beyond Phase 3A.",
      "restricted_requires_encryption",
    );
  }
  return null;
}

export function memoryNoteScopeOf(input: MemoryNoteInput): string {
  return [
    "memory.note",
    input.category,
    input.sensitivity,
    input.project ? slugifyPathSegment(input.project) : "no_project",
    slugifyNoteTitle(input.title),
    `content_sha256:${contentHashForScope(input.content)}`,
  ].join(":");
}

export const memoryNoteTool: Tool<MemoryNoteInput> = {
  id: "memory.note",
  name: "Memory Note",
  description:
    "Write an approved long-term memory note into the local Obsidian vault and register it in SQLite.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: MemoryNoteInputSchema,
  scopeOf: memoryNoteScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: MEMORY_NOTE_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied("Memory database is unavailable.", "db_unavailable");
    }

    const sensitivityDenied = assertWritableSensitivity(input.sensitivity);
    if (sensitivityDenied) return sensitivityDenied;

    const id = randomUUID();
    const createdAt = Date.now();
    const tags = uniqueTags(input.tags);
    const hash = hashContent(input.content);
    const vaultRoot = await ensureVaultScaffold(vaultRootFromEnv());
    const obsidianPath = noteRelativePath({
      title: input.title,
      category: input.category,
      project: input.project,
      createdAt,
      id,
    });
    const markdown = renderMarkdown({
      id,
      title: input.title,
      content: input.content,
      category: input.category,
      sensitivity: input.sensitivity,
      source: input.source,
      sourceId: input.sourceId ?? context.sessionId,
      project: input.project,
      tags,
      createdAt,
      hash,
    });

    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    let fileWritten = false;
    try {
      await writeVaultFileAtomically({
        vaultRoot,
        relativePath: obsidianPath,
        content: markdown,
        executionId: context.executionId,
      });
      fileWritten = true;

      insertLongTermMemory(context.db, {
        id,
        category: input.category,
        content: input.content,
        source: input.source,
        source_id: input.sourceId ?? context.sessionId,
        project: input.project ?? null,
        tags_json: JSON.stringify(tags),
        sensitivity: input.sensitivity,
        created_at: createdAt,
        updated_at: createdAt,
        obsidian_path: obsidianPath,
        hash,
        status: "active",
      });

      recordRollbackForToolCall(context.db, {
        id: randomUUID(),
        execution_id: context.executionId,
        session_id: context.sessionId,
        kind: "memory_delete_created",
        payload_json: JSON.stringify({ memoryId: id, path: obsidianPath }),
        created_at: createdAt,
      });

      insertTelemetryEvent(context.db, {
        timestamp: Date.now(),
        event_type: "memory_write",
        success: true,
        session_id: context.sessionId,
        execution_id: context.executionId,
        tool_name: "memory.note",
        intent: context.decision.intent.intent,
        safety_tag: context.decision.safety.safetyTag,
        tier: context.decision.capability.tier,
        model_id: context.decision.selection.model.modelName,
        notes: `memory_id=${id} category=${input.category} sensitivity=${input.sensitivity} source=${input.source} path=${obsidianPath}`,
      });

      return {
        ok: true,
        status: "COMPLETED",
        message: "Memory note written.",
        data: {
          memoryId: id,
          obsidianPath,
          sensitivity: input.sensitivity,
          category: input.category,
        },
      };
    } catch (error) {
      deleteLongTermMemory(context.db, id);
      if (fileWritten) {
        await rm(resolve(vaultRoot, obsidianPath), { force: true });
      }
      return {
        ok: false,
        status: "ERROR",
        message:
          error instanceof Error ? error.message : "Memory note write failed.",
        data: { reason: "memory_write_failed" },
      };
    }
  },
};

export { MAX_MEMORY_NOTE_CONTENT_BYTES, MEMORY_NOTE_TIMEOUT_MS };
