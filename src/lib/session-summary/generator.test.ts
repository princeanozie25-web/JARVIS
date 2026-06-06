import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMessage } from "../db/messages";
import { applyMigrations } from "../db/schema";
import { getLatestSessionSummary } from "../db/session-summaries";
import { createSession } from "../db/sessions";
import { listTelemetryEvents } from "../db/telemetry";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  StreamResult,
} from "../providers";
import type { Message } from "../types";
import {
  generateSessionSummary,
  SESSION_SUMMARY_MAX_CHARS,
  type SessionSummaryProviderRegistry,
} from "./generator";

let db: Database.Database;

class FakeProvider implements ChatProvider {
  readonly id = "openai";
  seenMessages: Message[][] = [];

  constructor(
    private readonly output: string,
    private readonly shouldFail = false,
  ) {}

  async generate(
    messages: Message[],
    opts: GenerateOptions,
  ): Promise<GenerateResult> {
    this.seenMessages.push(messages);
    if (this.shouldFail) {
      throw new Error("provider offline");
    }
    return {
      content: this.output,
      modelId: opts.model,
      inputTokens: 100,
      outputTokens: 20,
      costUsd: 0.0001,
      latencyMs: 25,
    };
  }

  async stream(): Promise<StreamResult> {
    throw new Error("unused");
  }
}

function registryFor(provider: FakeProvider): SessionSummaryProviderRegistry {
  return {
    get() {
      return provider;
    },
  };
}

function addMessage(input: {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}): void {
  appendMessage(db, {
    id: input.id,
    session_id: "session-1",
    role: input.role,
    content: input.content,
    created_at: input.createdAt,
  });
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

describe("generateSessionSummary", () => {
  it("reads session messages and sends them through the routed provider", async () => {
    addMessage({
      id: "m1",
      role: "user",
      content: "We started Phase 3C.2.",
      createdAt: 1_001,
    });
    addMessage({
      id: "m2",
      role: "assistant",
      content: "Manual summaries should stay on demand.",
      createdAt: 1_002,
    });
    const provider = new FakeProvider("Phase 3C.2 manual summary planned.");

    const result = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(provider),
      now: () => 2_000,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "generated",
      coveredMessageCount: 2,
    });
    const sent = provider.seenMessages[0]!;
    expect(sent[0]?.role).toBe("system");
    expect(sent[1]?.content).toContain("We started Phase 3C.2.");
    expect(sent[1]?.content).toContain(
      "Manual summaries should stay on demand.",
    );
  });

  it("rejects empty sessions without calling a provider", async () => {
    const provider = new FakeProvider("unused");

    await expect(
      generateSessionSummary({
        db,
        sessionId: "session-1",
        requestedProvider: "openai",
        registry: registryFor(provider),
      }),
    ).resolves.toEqual({
      ok: false,
      status: "empty_session",
      reason: "session_has_no_messages",
    });
    expect(provider.seenMessages).toEqual([]);
  });

  it("enforces the strict summary budget before saving", async () => {
    addMessage({
      id: "m1",
      role: "user",
      content: "Summarize this.",
      createdAt: 1_001,
    });
    const provider = new FakeProvider("x".repeat(2_000));

    const result = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(provider),
      now: () => 2_000,
    });

    expect(result.ok).toBe(true);
    const latest = getLatestSessionSummary(db, "session-1");
    expect(latest?.summary_text).toHaveLength(SESSION_SUMMARY_MAX_CHARS);
  });

  it("saves via saveSessionSummary and records lineage", async () => {
    addMessage({
      id: "m1",
      role: "user",
      content: "First summary source.",
      createdAt: 1_001,
    });
    const firstProvider = new FakeProvider("First concise summary.");
    const first = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(firstProvider),
      now: () => 2_000,
    });
    const secondProvider = new FakeProvider("Second concise summary.");
    const second = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(secondProvider),
      now: () => 3_000,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.summary.previous_summary_hash).toBe(
      first.summary.summary_hash,
    );
    expect(getLatestSessionSummary(db, "session-1")).toEqual(second.summary);
    expect(
      listTelemetryEvents(db).some(
        (event) => event.event_type === "session_summary_saved",
      ),
    ).toBe(true);
  });

  it("emits session_summary_generated telemetry without raw summary text", async () => {
    addMessage({
      id: "m1",
      role: "user",
      content: "Telemetry source.",
      createdAt: 1_001,
    });
    const provider = new FakeProvider("Do not log this generated summary.");

    const result = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(provider),
      now: () => 4_000,
    });

    expect(result.ok).toBe(true);
    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "session_summary_generated",
    );
    expect(event).toMatchObject({
      timestamp: 4_000,
      success: 1,
      session_id: "session-1",
      model_id: "claude-haiku-summary-aux",
      input_tokens: 100,
      output_tokens: 20,
      latency_ms: 25,
      cost_usd: 0.0001,
    });
    expect(event?.notes).toContain("summary_hash=");
    expect(event?.notes).toContain("aux_task_kind=summary");
    expect(event?.notes).toContain("covered_message_count=1");
    expect(event?.notes).not.toContain("Do not log this");
  });

  it("handles provider failure without saving a summary", async () => {
    addMessage({
      id: "m1",
      role: "user",
      content: "Provider will fail.",
      createdAt: 1_001,
    });
    const provider = new FakeProvider("unused", true);

    const result = await generateSessionSummary({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(provider),
      now: () => 5_000,
    });

    expect(result).toEqual({
      ok: false,
      status: "provider_error",
      reason: "provider offline",
    });
    expect(getLatestSessionSummary(db, "session-1")).toBeUndefined();
    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "session_summary_generated",
    );
    expect(event).toMatchObject({
      timestamp: 5_000,
      success: 0,
      session_id: "session-1",
      error_class: "Error",
    });
    expect(event?.notes).toContain("reason=provider_error");
  });
});
