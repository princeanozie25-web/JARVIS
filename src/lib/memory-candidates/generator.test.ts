import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listMemoryCandidates } from "../db/memory-candidates";
import { appendMessage } from "../db/messages";
import { applyMigrations } from "../db/schema";
import { createSession } from "../db/sessions";
import { listTelemetryEvents } from "../db/telemetry";
import type {
  ChatProvider,
  GenerateResult,
  ProviderId,
  StreamResult,
} from "../providers";
import {
  generateMemoryCandidates,
  type MemoryCandidateProviderRegistry,
} from "./generator";

class FakeProvider implements ChatProvider {
  readonly id: ProviderId = "openai";

  constructor(
    private readonly content: string,
    private readonly fail = false,
  ) {}

  async generate(): Promise<GenerateResult> {
    if (this.fail) throw new Error("provider failed");
    return {
      content: this.content,
      modelId: "fake-model",
      costUsd: 0,
      latencyMs: 10,
    };
  }

  async stream(): Promise<StreamResult> {
    throw new Error("not used");
  }
}

function registryFor(provider: FakeProvider): MemoryCandidateProviderRegistry {
  return {
    get: () => provider,
  };
}

function candidate(index: number) {
  return {
    source_message_ids: [`m${index}`],
    proposed_category: "fact",
    proposed_content: `Candidate ${index}`,
    proposed_tags: ["#phase3"],
    proposed_sensitivity: "personal",
    rationale: `Rationale ${index}`,
  };
}

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("generateMemoryCandidates", () => {
  it("creates draft candidates from strict JSON provider output", async () => {
    appendMessage(db, {
      id: "m1",
      session_id: "session-1",
      role: "user",
      content: "Remember that Phase 3C.6 is candidate-only.",
      created_at: 1_001,
    });

    const result = await generateMemoryCandidates({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(
        new FakeProvider(JSON.stringify({ candidates: [candidate(1)] })),
      ),
      idFactory: () => "cand-1",
      now: () => 2_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      id: "cand-1",
      status: "draft",
      proposed_content: "Candidate 1",
    });
    expect(listMemoryCandidates(db, { sessionId: "session-1" })).toHaveLength(
      1,
    );
  });

  it("caps persisted candidates at five per run", async () => {
    appendMessage(db, {
      id: "m1",
      session_id: "session-1",
      role: "user",
      content: "Generate several candidates.",
      created_at: 1_001,
    });
    let nextId = 0;

    const result = await generateMemoryCandidates({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(
        new FakeProvider(
          JSON.stringify({
            candidates: [1, 2, 3, 4, 5, 6].map(candidate),
          }),
        ),
      ),
      idFactory: () => `cand-${(nextId += 1)}`,
      now: () => 2_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates).toHaveLength(5);
    expect(listMemoryCandidates(db)).toHaveLength(5);
    expect(result.candidates.every((row) => row.status === "draft")).toBe(true);
  });

  it("handles strict JSON parse failures without creating candidates", async () => {
    appendMessage(db, {
      id: "m1",
      session_id: "session-1",
      role: "user",
      content: "Bad JSON should not create drafts.",
      created_at: 1_001,
    });

    const result = await generateMemoryCandidates({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(new FakeProvider("not json")),
      now: () => 2_000,
    });

    expect(result).toMatchObject({ ok: false, status: "parse_error" });
    expect(listMemoryCandidates(db)).toEqual([]);
    expect(
      listTelemetryEvents(db).some(
        (event) =>
          event.event_type === "memory_candidate_generated" &&
          event.success === 0,
      ),
    ).toBe(true);
  });

  it("rejects empty sessions", async () => {
    const result = await generateMemoryCandidates({
      db,
      sessionId: "session-1",
      requestedProvider: "openai",
      registry: registryFor(
        new FakeProvider(JSON.stringify({ candidates: [candidate(1)] })),
      ),
    });

    expect(result).toEqual({
      ok: false,
      status: "empty_session",
      reason: "session_has_no_messages_or_summary",
    });
  });
});
