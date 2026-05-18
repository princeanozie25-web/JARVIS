import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MAX_MEMORY_SEARCH_RESULTS,
  normalizeMemorySearchLimit,
} from "../db/memory";
import {
  MemoryRetriever,
  memoryRetrievalResultToToolData,
} from "../memory/retriever";
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
    "Search approved public/personal long-term memory rows using the local MemoryRetriever.",
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

    const retriever = new MemoryRetriever(context.db);
    const retrieval = await retriever.retrieve({
      query: input.query,
      category: input.category,
      project: input.project,
      tag: input.tag,
      maxResults: input.maxResults,
      sensitivityCeiling: input.sensitivityCeiling,
      sessionId: context.sessionId,
      executionId: context.executionId,
      signal: context.signal,
      intent: context.decision.intent.intent,
      safetyTag: context.decision.safety.safetyTag,
      tier: context.decision.capability.tier,
      modelId: context.decision.selection.model.modelName,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message:
        retrieval.results.length === 0
          ? "No matching memories found."
          : "Matching memories found.",
      data: {
        results: retrieval.results.map(memoryRetrievalResultToToolData),
        count: retrieval.results.length,
        maxResults: normalizeMemorySearchLimit(input.maxResults),
        sensitivityCeiling: input.sensitivityCeiling,
        retrievalMode: retrieval.mode,
      },
    };
  },
};

export { MEMORY_RECALL_TIMEOUT_MS };
