import type DatabaseType from "better-sqlite3";
import type { EvalResult, EvalRun } from "./types";

export interface EvalRunRow {
  id: string;
  label: string | null;
  created_at: number;
  completed_at: number | null;
  case_count: number;
  target_count: number;
}

export interface EvalResultRow {
  id: string;
  run_id: string;
  case_id: string;
  case_label: string | null;
  provider_id: string;
  model_id: string;
  model_name: string;
  output: string;
  latency_ms: number;
  time_to_first_token_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number;
  success: number;
  error_message: string | null;
  created_at: number;
}

export function insertEvalRun(db: DatabaseType.Database, run: EvalRun): void {
  db.prepare(
    `INSERT INTO eval_runs (
       id, label, created_at, completed_at, case_count, target_count
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    run.id,
    run.label ?? null,
    run.createdAt,
    run.completedAt ?? null,
    run.caseCount,
    run.targetCount,
  );
}

export function markEvalRunCompleted(
  db: DatabaseType.Database,
  runId: string,
  at: number,
): void {
  db.prepare("UPDATE eval_runs SET completed_at = ? WHERE id = ?").run(
    at,
    runId,
  );
}

export function insertEvalResult(
  db: DatabaseType.Database,
  result: EvalResult,
): void {
  db.prepare(
    `INSERT INTO eval_results (
       id, run_id, case_id, case_label, provider_id, model_id, model_name,
       output, latency_ms, time_to_first_token_ms, input_tokens, output_tokens,
       cost_usd, success, error_message, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    result.id,
    result.runId,
    result.caseId,
    result.caseLabel,
    result.providerId,
    result.modelId,
    result.modelName,
    result.output,
    result.latencyMs,
    result.timeToFirstTokenMs ?? null,
    result.inputTokens ?? null,
    result.outputTokens ?? null,
    result.costUsd,
    result.success ? 1 : 0,
    result.errorMessage ?? null,
    result.createdAt,
  );
}

export function getEvalRun(
  db: DatabaseType.Database,
  runId: string,
): EvalRunRow | undefined {
  return db.prepare("SELECT * FROM eval_runs WHERE id = ?").get(runId) as
    | EvalRunRow
    | undefined;
}

export function listEvalRuns(
  db: DatabaseType.Database,
  limit: number = 50,
): EvalRunRow[] {
  return db
    .prepare("SELECT * FROM eval_runs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as EvalRunRow[];
}

export function listEvalResults(
  db: DatabaseType.Database,
  runId: string,
): EvalResultRow[] {
  return db
    .prepare(
      "SELECT * FROM eval_results WHERE run_id = ? ORDER BY created_at ASC",
    )
    .all(runId) as EvalResultRow[];
}
