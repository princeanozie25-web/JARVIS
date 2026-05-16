import type DatabaseType from "better-sqlite3";
import type { ModelEntry } from "../models/types";
import type { ChatProvider, ProviderId } from "../providers/types";
import {
  insertEvalResult,
  insertEvalRun,
  markEvalRunCompleted,
} from "./storage";
import type { EvalCase, EvalResult, EvalRun, EvalTarget } from "./types";

export interface RunEvalOptions {
  db: DatabaseType.Database;
  cases: EvalCase[];
  targets: EvalTarget[];
  label?: string;
  now?: () => number;
  newId?: () => string;
  resolveProvider?: (id: ProviderId) => ChatProvider | Promise<ChatProvider>;
  resolveModel?: (id: string) => ModelEntry | Promise<ModelEntry>;
}

export interface RunEvalOutcome {
  run: EvalRun;
  results: EvalResult[];
}

async function defaultResolveProvider(id: ProviderId): Promise<ChatProvider> {
  const { registry } = await import("../providers");
  return registry.get(id);
}

async function defaultResolveModel(id: string): Promise<ModelEntry> {
  const { models } = await import("../models");
  return models.get(id);
}

export async function runEval(opts: RunEvalOptions): Promise<RunEvalOutcome> {
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const resolveProvider = opts.resolveProvider ?? defaultResolveProvider;
  const resolveModel = opts.resolveModel ?? defaultResolveModel;

  const run: EvalRun = {
    id: newId(),
    label: opts.label,
    createdAt: now(),
    caseCount: opts.cases.length,
    targetCount: opts.targets.length,
  };
  insertEvalRun(opts.db, run);

  const results: EvalResult[] = [];

  for (const target of opts.targets) {
    const modelEntry = await resolveModel(target.modelId);
    const provider = await resolveProvider(target.providerId);

    for (const evalCase of opts.cases) {
      const result = await runOne({
        run,
        evalCase,
        target,
        modelName: modelEntry.modelName,
        provider,
        now,
        newId,
      });
      insertEvalResult(opts.db, result);
      results.push(result);
    }
  }

  const completedAt = now();
  markEvalRunCompleted(opts.db, run.id, completedAt);

  return {
    run: { ...run, completedAt },
    results,
  };
}

interface RunOneInput {
  run: EvalRun;
  evalCase: EvalCase;
  target: EvalTarget;
  modelName: string;
  provider: ChatProvider;
  now: () => number;
  newId: () => string;
}

async function runOne(input: RunOneInput): Promise<EvalResult> {
  const { run, evalCase, target, modelName, provider, now, newId } = input;

  try {
    const stream = await provider.stream(evalCase.messages, {
      model: modelName,
    });

    let finalContent = "";
    let latencyMs = 0;
    let timeToFirstTokenMs: number | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let costUsd = 0;
    let success = true;
    let errorMessage: string | undefined;

    for await (const event of stream.events) {
      if (event.type === "done") {
        const r = event.result;
        finalContent = r.content;
        latencyMs = r.latencyMs;
        timeToFirstTokenMs = r.timeToFirstTokenMs;
        inputTokens = r.inputTokens;
        outputTokens = r.outputTokens;
        costUsd = r.costUsd;
      } else if (event.type === "error") {
        success = false;
        errorMessage = event.message;
      }
    }

    return {
      id: newId(),
      runId: run.id,
      caseId: evalCase.id,
      caseLabel: evalCase.label,
      providerId: target.providerId,
      modelId: target.modelId,
      modelName,
      output: finalContent,
      latencyMs,
      timeToFirstTokenMs,
      inputTokens,
      outputTokens,
      costUsd,
      success,
      errorMessage,
      createdAt: now(),
    };
  } catch (err) {
    return {
      id: newId(),
      runId: run.id,
      caseId: evalCase.id,
      caseLabel: evalCase.label,
      providerId: target.providerId,
      modelId: target.modelId,
      modelName,
      output: "",
      latencyMs: 0,
      costUsd: 0,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      createdAt: now(),
    };
  }
}
