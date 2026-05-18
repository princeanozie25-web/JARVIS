import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory, searchLongTermMemory } from "../db/memory";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import type { RouterDecision } from "../router";
import { InProcessToolRuntime, tools } from ".";

const allowDecision: RouterDecision = {
  intent: { intent: "INFORMATION_REQUEST", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["tools"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, { db });
}

function insertMemory(input: {
  id: string;
  content: string;
  category?: "fact" | "preference" | "event" | "decision";
  project?: string | null;
  tags?: string[];
  sensitivity?: "public" | "personal" | "sensitive" | "restricted";
  createdAt?: number;
}): void {
  insertLongTermMemory(db, {
    id: input.id,
    category: input.category ?? "fact",
    content: input.content,
    source: "user",
    source_id: "session-1",
    project: input.project ?? null,
    tags_json: JSON.stringify(input.tags ?? []),
    sensitivity: input.sensitivity ?? "personal",
    created_at: input.createdAt ?? 1_000,
    updated_at: input.createdAt ?? 1_000,
    obsidian_path: `50-ideas/${input.id}.md`,
    hash: `sha256:${input.id}`,
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("memory FTS search", () => {
  it("creates and syncs the FTS table through migration triggers", () => {
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         ORDER BY name`,
      )
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain("long_term_memory_fts");

    insertMemory({
      id: "mem-fts",
      content: "SQLite FTS keeps keyword recall local.",
    });

    expect(
      searchLongTermMemory(db, { query: "keyword recall" }).map(
        (row) => row.id,
      ),
    ).toEqual(["mem-fts"]);
  });
});

describe("memory.recall", () => {
  it("returns relevant keyword results with optional filters", async () => {
    insertMemory({
      id: "mem-jarvis",
      content: "JARVIS stores memory in an Obsidian vault.",
      category: "decision",
      project: "jarvis",
      tags: ["#phase3", "#memory"],
      sensitivity: "personal",
      createdAt: 2_000,
    });
    insertMemory({
      id: "mem-other",
      content: "Garden notes mention a different vault.",
      category: "fact",
      project: "garden",
      tags: ["#outside"],
      sensitivity: "personal",
      createdAt: 3_000,
    });

    const result = await runtime().runTool({
      toolId: "memory.recall",
      input: {
        query: "Obsidian vault",
        category: "decision",
        project: "jarvis",
        tag: "phase3",
        maxResults: 5,
      },
      sessionId: "session-1",
      executionId: "exec-recall",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        count: 1,
        maxResults: 5,
        retrievalMode: "keyword_only",
        sensitivityCeiling: "personal",
      },
    });
    expect(
      (result.data as { results: Array<{ id: string }> }).results.map(
        (row) => row.id,
      ),
    ).toEqual(["mem-jarvis"]);
  });

  it("applies the default personal sensitivity ceiling", async () => {
    insertMemory({
      id: "mem-public",
      content: "Passport keyword appears in a public placeholder.",
      sensitivity: "public",
    });
    insertMemory({
      id: "mem-sensitive",
      content: "Passport keyword appears in a sensitive memory.",
      sensitivity: "sensitive",
      createdAt: 2_000,
    });
    insertMemory({
      id: "mem-restricted",
      content: "Passport keyword appears in a restricted memory.",
      sensitivity: "restricted",
      createdAt: 3_000,
    });

    const result = await runtime().runTool({
      toolId: "memory.recall",
      input: { query: "passport keyword", maxResults: 10 },
      sessionId: "session-1",
      executionId: "exec-sensitive",
      decision: allowDecision,
    });

    expect(
      (result.data as { results: Array<{ id: string }> }).results.map(
        (row) => row.id,
      ),
    ).toEqual(["mem-public"]);
  });

  it("enforces max result bounds", async () => {
    for (let index = 0; index < 5; index += 1) {
      insertMemory({
        id: `mem-${index}`,
        content: "Repeated recall bound keyword.",
        createdAt: 1_000 + index,
      });
    }

    await expect(
      runtime().runTool({
        toolId: "memory.recall",
        input: { query: "recall bound", maxResults: 2 },
        sessionId: "session-1",
        executionId: "exec-bound",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { count: 2, maxResults: 2 },
    });

    await expect(
      runtime().runTool({
        toolId: "memory.recall",
        input: { query: "recall bound", maxResults: 99 },
        sessionId: "session-1",
        executionId: "exec-over-bound",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_tool_input" },
    });
  });

  it("emits memory_read telemetry without raw query text", async () => {
    insertMemory({
      id: "mem-telemetry",
      content: "Telemetry recall note for JARVIS memory search.",
    });

    await runtime().runTool({
      toolId: "memory.recall",
      input: { query: "Telemetry recall" },
      sessionId: "session-1",
      executionId: "exec-telemetry",
      decision: allowDecision,
    });

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "memory_read",
    );
    expect(event).toMatchObject({
      success: 1,
      session_id: "session-1",
      execution_id: "exec-telemetry",
      tool_name: "memory.recall",
    });
    expect(event?.notes).toContain("query_sha256=");
    expect(event?.notes).toContain("mode=keyword_only");
    expect(event?.notes).toContain('result_ids=["mem-telemetry"]');
    expect(event?.notes).not.toContain("Telemetry recall");
  });
});
