// E-050 — Self Model smoke against the LIVE install: real registries, real
// loopback probes (Ollama, mlx-audio), the real audit database, the real
// repository. Prints the answers to the brief's questions, a leak scan and
// timings. Read-only except the typed snapshot event (disable with
// JARVIS_EVENT_STORE_ENABLED=false).
//
//   npx tsx scripts/self-model-smoke.ts [--json] [--no-persist]
import { getDb } from "../src/lib/db/client-node";
import { tools } from "../src/lib/tools";
import {
  buildSelfContext,
  buildSelfProjection,
  explainClaim,
  findSelfLeak,
} from "../src/lib/self-model";
import { createDefaultSelfModel } from "../src/lib/self-model/default";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const persist = !args.includes("--no-persist");

const QUESTIONS: Array<[string, string[]]> = [
  ["What are you?", ["self:identity", "self:identity.role"]],
  ["What can you do (headline)?", ["self:capability.tools", "voice:live"]],
  [
    "What can't you do?",
    [
      "self:limit.self-modification",
      "self:limit.authority-escalation",
      "self:limit.secrets",
    ],
  ],
  [
    "Which models are available right now?",
    [
      "provider:ollama",
      "model:ollama/qwen3.5-9b-mlx",
      "model:ollama/qwen3.5-27b-mlx",
    ],
  ],
  ["Which tools are enabled?", ["self:capability.tools"]],
  ["Which nodes exist?", ["node:local", "node:topology"]],
  [
    "Current runtime status?",
    [
      "self:runtime.build",
      "self:runtime.doctor",
      "self:runtime.db",
      "voice:tts-server",
    ],
  ],
  [
    "Verified vs planned?",
    ["voice:barge-in", "voice:cloud-realtime", "voice:wake-word"],
  ],
  ["Are you allowed to modify yourself?", ["self:limit.self-modification"]],
  [
    "What memory do you have?",
    ["self:runtime.db", "authority-surface:memory-bridge"],
  ],
  ["Recent changes?", ["self:repository.enhancements", "enhancement:E-049"]],
  [
    "Experience / track record?",
    ["self:experience.summary", "voice:failover-history"],
  ],
  ["What do you know about your test suite?", ["self:repository.test-suite"]],
];

async function main(): Promise<void> {
  const t0 = Date.now();
  const model = createDefaultSelfModel({
    db: getDb(),
    tools: tools.list(),
    persistSnapshots: persist,
  });
  const snapshot = await model.snapshot({ force: true });
  const tSnap = Date.now() - t0;
  const status = await model.status();
  const nowMs = Date.parse(snapshot.generated_at);
  const ctx = buildSelfContext(snapshot, { task_kind: "chat", now_ms: nowMs });
  const projection = buildSelfProjection(snapshot, {
    now_ms: nowMs,
    headline: status.headline,
  });

  // Leak scan over everything that could leave the model, plus a direct
  // check that no env value with a secret-looking name appears anywhere.
  const everything = { snapshot, status, ctx, projection };
  const leak = findSelfLeak(everything);
  const json = JSON.stringify(everything);
  const envHits = Object.entries(process.env)
    .filter(
      ([k, v]) => v && v.length >= 8 && /(KEY|TOKEN|SECRET|PASSWORD)/i.test(k),
    )
    .filter(([, v]) => json.includes(v!))
    .map(([k]) => k);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          status,
          snapshot_ms: tSnap,
          leak,
          env_hits: envHits,
          ctx,
          projection_counts: projection.counts,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `\n== JARVIS Self Model smoke (${snapshot.generated_at}) — snapshot ${tSnap} ms, ${snapshot.claims.length} claims, headline ${status.headline}`,
    );
    console.log(
      `   sources: ${snapshot.sources.map((s) => `${s.source_id}${s.ok ? "" : "(FAILED)"}=${s.claim_count}`).join("  ")}`,
    );
    console.log(
      `   by status: ${Object.entries(status.counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(
          ", ",
        )}; stale ${status.stale}; contradictions ${status.contradictions}`,
    );
    if (snapshot.warnings.length)
      console.log(`   warnings: ${snapshot.warnings.join(" | ")}`);
    for (const [q, keys] of QUESTIONS) {
      console.log(`\n? ${q}`);
      for (const k of keys) {
        const c = await model.find(k);
        if (!c) {
          console.log(`   - ${k}: (no claim)`);
          continue;
        }
        console.log(
          `   - [${c.status}/${c.trust_class}${c.contradictions.length ? ` ⚡${c.contradictions.length}` : ""}] ${c.statement}`,
        );
      }
    }
    const ex = await model.find("model:ollama/qwen3.5-9b-mlx");
    if (ex) {
      const why = explainClaim(ex, nowMs);
      console.log(
        `\n? Why do you say ${ex.subject} is ${ex.status}?\n   ${why.because}`,
      );
      for (const e of why.evidence)
        console.log(
          `   evidence: ${e.kind} ${e.ref}${e.detail ? ` — ${e.detail}` : ""} → verify: ${e.how_to_verify}`,
        );
      for (const c of why.contradictions)
        console.log(
          `   overruled: ${c.trust_class} said ${c.status} (${c.ref})`,
        );
    }
    console.log(
      `\n== Reasoning context (chat, ${ctx.char_count} chars${ctx.truncated ? ", truncated" : ""}):\n${ctx.text}`,
    );
    console.log(
      `\n== Projection: ${projection.sections.map((s) => `${s.id} ${s.items.length}`).join(", ")}`,
    );
    console.log(
      `\n== Leak scan: ${leak ? `FAIL ${leak.reason} at ${leak.path}` : "clean"}; env-value hits: ${envHits.length ? envHits.join(",") : "none"}`,
    );
    console.log(
      `== Persisted snapshot event: ${persist ? "yes (event store, self.snapshot_recorded)" : "no (--no-persist)"}`,
    );
  }
  if (leak || envHits.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `[self-model] FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exitCode = 1;
});
