import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory } from "../db/memory";
import { appendMessage } from "../db/messages";
import { applyMigrations } from "../db/schema";
import { saveSessionSummary } from "../db/session-summaries";
import { createSession } from "../db/sessions";
import { listTelemetryEvents } from "../db/telemetry";
import type {
  MemoryRetrievalResult,
  MemoryRetrieverResult,
} from "../memory/retriever";
import {
  WorkingMemoryAssembler,
  type WorkingMemoryRetriever,
} from "./assembler";
import { workingMemoryConfigFromEnv } from "./config";

let db: Database.Database;

function addMessage(index: number, content = `message ${index}`): void {
  appendMessage(db, {
    id: `m${index}`,
    session_id: "session-1",
    role: index % 2 === 0 ? "user" : "assistant",
    content,
    created_at: 1_000 + index,
  });
}

function fakeMemory(id: string, content: string): MemoryRetrievalResult {
  return {
    id,
    category: "fact",
    content,
    source: "user",
    source_id: "session-1",
    project: "jarvis",
    tags_json: JSON.stringify(["#phase3"]),
    sensitivity: "personal",
    created_at: 1_000,
    updated_at: 1_000,
    obsidian_path: null,
    hash: `sha256:${id}`,
    status: "active",
    score: {
      keywordRank: 1,
      vectorRank: null,
      fusedScore: 0.1,
      sourceType: "keyword",
    },
  };
}

function fakeRetriever(
  results: MemoryRetrievalResult[],
): WorkingMemoryRetriever {
  return {
    async retrieve(input): Promise<MemoryRetrieverResult> {
      return {
        mode: "keyword_only",
        results: results.slice(0, input.maxResults),
      };
    },
  };
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("WorkingMemoryAssembler", () => {
  it("assembles summary, recent messages, retrieved memories, and budget metadata", async () => {
    addMessage(0, "User asked about Phase 3C.4.");
    addMessage(1, "Assistant described the scaffold.");
    saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Session summary is available.",
      coveredMessageCount: 2,
      now: () => 2_000,
    });

    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 20,
        maxRetrievedMemories: 8,
        maxChars: 12_000,
      },
      retriever: fakeRetriever([
        fakeMemory("mem-1", "Memory recall uses the retriever."),
      ]),
      now: () => 3_000,
    }).assemble({
      sessionId: "session-1",
      queryText: "memory recall",
      systemPrompt: { hash: "prompt-hash", name: "JARVIS system prompt" },
    });

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") return;
    expect(result.context.systemPrompt).toEqual({
      hash: "prompt-hash",
      name: "JARVIS system prompt",
    });
    expect(result.context.latestSessionSummary?.summaryText).toBe(
      "Session summary is available.",
    );
    expect(result.context.recentMessages).toHaveLength(2);
    expect(result.context.retrievedMemories).toHaveLength(1);
    expect(result.context.budget.usedChars).toBeGreaterThan(0);
  });

  it("returns disabled context when config is disabled", async () => {
    let called = false;
    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: false,
        maxRecentMessages: 20,
        maxRetrievedMemories: 8,
        maxChars: 12_000,
      },
      retriever: {
        async retrieve() {
          called = true;
          return { mode: "keyword_only", results: [] };
        },
      },
    }).assemble({ sessionId: "session-1", queryText: "unused" });

    expect(result).toMatchObject({
      ok: true,
      status: "disabled",
      context: null,
    });
    expect(called).toBe(false);
  });

  it("trims retrieved memories before recent messages", async () => {
    addMessage(0, "short message");
    const long = "x".repeat(250);

    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 5,
        maxRetrievedMemories: 3,
        maxChars: 450,
      },
      retriever: fakeRetriever([
        fakeMemory("mem-1", long),
        fakeMemory("mem-2", long),
        fakeMemory("mem-3", long),
      ]),
      now: () => 3_000,
    }).assemble({
      sessionId: "session-1",
      queryText: "long",
      systemPrompt: { hash: "prompt-hash" },
    });

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") return;
    expect(result.context.budget.trimmedRetrievedMemories).toBeGreaterThan(0);
    expect(result.context.budget.trimmedRecentMessages).toBe(0);
    expect(result.context.recentMessages).toHaveLength(1);
  });

  it("enforces max recent messages", async () => {
    for (let index = 0; index < 5; index += 1) addMessage(index);

    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 2,
        maxRetrievedMemories: 8,
        maxChars: 12_000,
      },
    }).assemble({ sessionId: "session-1" });

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") return;
    expect(result.context.recentMessages.map((message) => message.id)).toEqual([
      "m3",
      "m4",
    ]);
  });

  it("enforces max retrieved memories", async () => {
    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 20,
        maxRetrievedMemories: 2,
        maxChars: 12_000,
      },
      retriever: fakeRetriever([
        fakeMemory("mem-1", "one"),
        fakeMemory("mem-2", "two"),
        fakeMemory("mem-3", "three"),
      ]),
    }).assemble({ sessionId: "session-1", queryText: "memory" });

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") return;
    expect(result.context.retrievedMemories.map((memory) => memory.id)).toEqual(
      ["mem-1", "mem-2"],
    );
  });

  it("emits assembly and budget telemetry", async () => {
    addMessage(0, "y".repeat(500));

    await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 20,
        maxRetrievedMemories: 1,
        maxChars: 80,
      },
      now: () => 4_000,
    }).assemble({
      sessionId: "session-1",
      systemPrompt: { hash: "prompt-hash" },
    });

    const events = listTelemetryEvents(db);
    expect(events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "working_memory_assembled",
        "context_budget_breach",
      ]),
    );
    expect(
      events.find((event) => event.event_type === "working_memory_assembled"),
    ).toMatchObject({
      timestamp: 4_000,
      session_id: "session-1",
      success: 1,
    });
  });

  it("does not change live prompt behavior by default", () => {
    expect(
      workingMemoryConfigFromEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv)
        .enabled,
    ).toBe(false);
  });

  it("can use the real MemoryRetriever for internal recall", async () => {
    insertLongTermMemory(db, {
      id: "mem-real",
      category: "fact",
      content: "Working memory can pull keyword memories internally.",
      source: "user",
      source_id: "session-1",
      tags_json: "[]",
      sensitivity: "personal",
      created_at: 1_000,
      updated_at: 1_000,
      hash: "sha256:real",
    });

    const result = await new WorkingMemoryAssembler(db, {
      config: {
        enabled: true,
        maxRecentMessages: 20,
        maxRetrievedMemories: 8,
        maxChars: 12_000,
      },
    }).assemble({
      sessionId: "session-1",
      queryText: "keyword memories",
    });

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") return;
    expect(result.context.retrievedMemories.map((memory) => memory.id)).toEqual(
      ["mem-real"],
    );
  });
});
