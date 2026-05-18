import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MAX_MEMORY_SEARCH_RESULTS,
  normalizeMemorySearchLimit,
  searchLongTermMemory,
} from "../db/memory";
import { insertTelemetryEvent } from "../db/telemetry";
import { LONG_TERM_MEMORY_CATEGORIES } from "../memory/types";
import type { Tool, ToolResult } from "./types";

const MEMORY_RECALL_TIMEOUT_MS = 5_000;

const MemoryRecallInputSchema = z.object({
  query: z.string().min(1).max(500),
  category: z.enum(LONG_TERM_MEMORY_CATEGORIES).optional(),
  project: z.string().min(1).max(120).optional(),
  tag: z.string().min(1).max(64).optional(),
  maxResults: z.number().int().min(1).max(MAX_MEMORY_SEARCH_RESULTS).default(8),
  sensitivityCeiling: z.enum(["public", "personal"]).default("personal"),
});

export type MemoryRecallInput = z.infer<typeof MemoryRecallInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function memoryRecallScopeOf(input: MemoryRecallInput): string {
  return [
    "memory.recall",
    `query_sha256:${sha256(input.query)}`,
    input.category ? `category:${input.category}` : "category:any",
    input.project ? `project_sha256:${sha256(input.project)}` : "project:any",
    input.tag ? `tag_sha256:${sha256(input.tag)}` : "tag:any",
    `max:${normalizeMemorySearchLimit(input.maxResults)}`,
    `sensitivity:${input.sensitivityCeiling ?? "personal"}`,
  ].join(":");
}

export const memoryRecallTool: Tool<MemoryRecallInput> = {
  id: "memory.recall",
  name: "Recall Memory",
  description:
    "Search approved public/personal long-term memory rows using local keyword search.",
  requiredSafetyTag: "ALLOW",
  inputSchema: MemoryRecallInputSchema,
  scopeOf: memoryRecallScopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: MEMORY_RECALL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied("Memory database is unavailable.", "db_unavailable");
    }

    const results = searchLongTermMemory(context.db, {
      query: input.query,
      category: input.category,
      project: input.project,
      tag: input.tag,
      maxResults: input.maxResults,
      sensitivityCeiling: input.sensitivityCeiling,
    });
    const resultIds = results.map((row) => row.id);

    insertTelemetryEvent(context.db, {
      timestamp: Date.now(),
      event_type: "memory_read",
      success: true,
      session_id: context.sessionId,
      execution_id: context.executionId,
      tool_name: "memory.recall",
      intent: context.decision.intent.intent,
      safety_tag: context.decision.safety.safetyTag,
      tier: context.decision.capability.tier,
      model_id: context.decision.selection.model.modelName,
      notes: `query_sha256=${sha256(input.query)} category=${input.category ?? "any"} project=${input.project ? "set" : "any"} tag=${input.tag ? "set" : "any"} sensitivity_ceiling=${input.sensitivityCeiling} result_ids=${JSON.stringify(resultIds)}`,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message:
        results.length === 0
          ? "No matching memories found."
          : "Matching memories found.",
      data: {
        results: results.map((row) => ({
          id: row.id,
          category: row.category,
          content: row.content,
          source: row.source,
          sourceId: row.source_id,
          project: row.project,
          tags: parseTags(row.tags_json),
          sensitivity: row.sensitivity,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          obsidianPath: row.obsidian_path,
          rank: row.rank,
        })),
        count: results.length,
        maxResults: normalizeMemorySearchLimit(input.maxResults),
        sensitivityCeiling: input.sensitivityCeiling,
      },
    };
  },
};

export { MEMORY_RECALL_TIMEOUT_MS };
