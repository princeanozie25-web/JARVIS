import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import type { ModelEntry } from "../models/types";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderId,
  StreamEvent,
  StreamResult,
} from "../providers/types";
import type { Message } from "../types";
import { runEval } from "./runner";
import { listEvalResults } from "./storage";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

function makeStubProvider(id: ProviderId, fixedOutput: string): ChatProvider {
  return {
    id,
    async generate(
      _messages: Message[],
      opts: GenerateOptions,
    ): Promise<GenerateResult> {
      return {
        content: fixedOutput,
        modelId: opts.model,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.0001,
        latencyMs: 100,
      };
    },
    async stream(
      _messages: Message[],
      opts: GenerateOptions,
    ): Promise<StreamResult> {
      const text = fixedOutput;
      async function* events(): AsyncIterable<StreamEvent> {
        yield { type: "text", value: text };
        yield {
          type: "done",
          result: {
            content: text,
            modelId: opts.model,
            inputTokens: 10,
            outputTokens: 5,
            costUsd: 0.0001,
            latencyMs: 100,
            timeToFirstTokenMs: 25,
          },
        };
      }
      return { events: events() };
    },
  };
}

const stubModels: Record<string, ModelEntry> = {
  "stub/openai": {
    id: "stub/openai",
    provider: "openai",
    modelName: "stub-openai-model",
    tier: "T3",
    capabilities: ["text", "stream"],
    enabled: true,
  },
  "stub/anthropic": {
    id: "stub/anthropic",
    provider: "anthropic",
    modelName: "stub-anthropic-model",
    tier: "T3",
    capabilities: ["text", "stream"],
    enabled: true,
  },
};

const stubProviders: Record<ProviderId, ChatProvider> = {
  openai: makeStubProvider("openai", "automotive"),
  anthropic: makeStubProvider("anthropic", "automotive"),
  ollama: makeStubProvider("ollama", "automotive"),
};

describe("runEval", () => {
  it("persists a run and one result per (case × target)", async () => {
    let counter = 0;
    const outcome = await runEval({
      db,
      cases: [
        {
          id: "c1",
          label: "classify",
          messages: [{ role: "user", content: "hello" }],
        },
        {
          id: "c2",
          label: "paraphrase",
          messages: [{ role: "user", content: "hi" }],
        },
      ],
      targets: [
        { providerId: "openai", modelId: "stub/openai" },
        { providerId: "anthropic", modelId: "stub/anthropic" },
      ],
      label: "smoke",
      now: () => 1_000,
      newId: () => `id-${++counter}`,
      resolveProvider: (id) => stubProviders[id],
      resolveModel: (id) => stubModels[id],
    });

    expect(outcome.run.caseCount).toBe(2);
    expect(outcome.run.targetCount).toBe(2);
    expect(outcome.results).toHaveLength(4);

    const rows = listEvalResults(db, outcome.run.id);
    expect(rows).toHaveLength(4);
    const combos = rows.map((r) => `${r.provider_id}:${r.case_id}`).sort();
    expect(combos).toEqual([
      "anthropic:c1",
      "anthropic:c2",
      "openai:c1",
      "openai:c2",
    ]);
    expect(rows.every((r) => r.success === 1)).toBe(true);
    expect(rows[0]?.time_to_first_token_ms).toBe(25);
    expect(rows[0]?.cost_usd).toBeCloseTo(0.0001);
  });

  it("records failure as a non-throwing result when the provider errors mid-stream", async () => {
    const failing: ChatProvider = {
      id: "openai",
      async generate() {
        throw new Error("not used");
      },
      async stream() {
        async function* events(): AsyncIterable<StreamEvent> {
          yield { type: "error", message: "boom", recoverable: false };
        }
        return { events: events() };
      },
    };

    const outcome = await runEval({
      db,
      cases: [
        {
          id: "c1",
          label: "classify",
          messages: [{ role: "user", content: "hello" }],
        },
      ],
      targets: [{ providerId: "openai", modelId: "stub/openai" }],
      now: () => 1_000,
      newId: () => "x",
      resolveProvider: () => failing,
      resolveModel: (id) => stubModels[id],
    });

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.success).toBe(false);
    expect(outcome.results[0]?.errorMessage).toBe("boom");
  });
});
