/**
 * Dev CLI: run the eval suite against every enabled model in the registry.
 *
 * Usage:
 *   npm run eval
 *
 * Requires OPENAI_API_KEY and ANTHROPIC_API_KEY in the environment.
 * On Node 20+, `npm run eval` invokes via `node --env-file=.env.local` so the
 * local env file is honoured even when the shell has not exported the keys.
 */

import { getDb } from "../src/lib/db/node";
import { DEFAULT_EVAL_CASES, runEval } from "../src/lib/evals";
import { models } from "../src/lib/models";

async function main(): Promise<void> {
  const enabled = models.list((m) => m.enabled);
  if (enabled.length === 0) {
    console.error("No enabled models in the registry.");
    process.exit(1);
  }

  const targets = enabled.map((m) => ({
    providerId: m.provider,
    modelId: m.id,
  }));

  const db = getDb();
  const label = `cli-${new Date().toISOString().slice(0, 16).replace("T", "_")}`;

  console.log(
    `Running ${DEFAULT_EVAL_CASES.length} cases × ${targets.length} targets (label: ${label})...\n`,
  );

  const outcome = await runEval({
    db,
    cases: DEFAULT_EVAL_CASES,
    targets,
    label,
  });

  const elapsedMs =
    (outcome.run.completedAt ?? Date.now()) - outcome.run.createdAt;
  console.log(`Run ${outcome.run.id} complete in ${elapsedMs}ms\n`);

  for (const c of DEFAULT_EVAL_CASES) {
    console.log(`case: ${c.id}  (${c.label})`);
    const caseResults = outcome.results.filter((r) => r.caseId === c.id);
    for (const r of caseResults) {
      const ttft =
        r.timeToFirstTokenMs !== undefined ? `${r.timeToFirstTokenMs}ms` : "—";
      const status = r.success ? "ok" : `FAIL: ${r.errorMessage ?? "?"}`;
      const out = r.output.length > 60 ? r.output.slice(0, 57) + "…" : r.output;
      console.log(
        `  ${r.modelId.padEnd(34)}  ${String(r.latencyMs).padStart(5)}ms  ttft=${ttft.padEnd(8)}  $${r.costUsd.toFixed(6)}  ${status.padEnd(15)}  ${JSON.stringify(out)}`,
      );
    }
    console.log();
  }

  console.log("Summary by model:");
  const byModel = new Map<
    string,
    { latency: number; cost: number; count: number; failures: number }
  >();
  for (const r of outcome.results) {
    const agg = byModel.get(r.modelId) ?? {
      latency: 0,
      cost: 0,
      count: 0,
      failures: 0,
    };
    agg.latency += r.latencyMs;
    agg.cost += r.costUsd;
    agg.count += 1;
    if (!r.success) agg.failures += 1;
    byModel.set(r.modelId, agg);
  }
  for (const [model, agg] of byModel) {
    console.log(
      `  ${model.padEnd(34)}  avg latency ${Math.round(agg.latency / agg.count)}ms, total cost $${agg.cost.toFixed(6)}, ${agg.failures} failures`,
    );
  }
}

main().catch((err) => {
  console.error("eval failed:", err);
  process.exit(1);
});
