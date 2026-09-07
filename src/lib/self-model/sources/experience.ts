// Self Model (E-050) — the EXPERIENCE / competence self.
//
// "How well have I done X?" is answered ONLY from recorded executions:
// tool_calls rows (Phase 3 audit) and telemetry_events (model calls, voice
// failovers). Under `minSamples` the answer is "unknown — insufficient
// evidence", never a guess. Trust is RECENT_VERIFIED_TEST: these are real
// runs, but history, so a live probe still outranks them.
import {
  claim,
  evidence,
  type SelfClaim,
  type SelfClaimStatus,
} from "../contracts";

export interface ExperienceToolCallRow {
  tool_id: string;
  tool_name: string;
  status: string; // PROPOSED | APPROVED | RUNNING | COMPLETED | ERROR | TIMEOUT | DENIED | CANCELLED …
  proposed_at: number;
  completed_at: number | null;
}

export interface ExperienceTelemetryRow {
  timestamp: number;
  event_type: string;
  success: number;
  model_id: string | null;
  tool_name: string | null;
  latency_ms: number | null;
  error_class: string | null;
}

export interface ExperienceSourceInput {
  now: string;
  nowMs: number;
  windowMs?: number;
  minSamples?: number;
  toolCalls: readonly ExperienceToolCallRow[];
  telemetry: readonly ExperienceTelemetryRow[];
}

export const EXPERIENCE_DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60_000;
export const EXPERIENCE_DEFAULT_MIN_SAMPLES = 5;

interface Tally {
  n: number;
  ok: number;
  failed: number;
  denied: number;
  latencies: number[];
  last: number;
}

function tally(): Tally {
  return { n: 0, ok: 0, failed: 0, denied: 0, latencies: [], last: 0 };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function competence(
  t: Tally,
  min: number,
): { status: SelfClaimStatus; rate: number | null } {
  const decided = t.ok + t.failed;
  if (decided < min) return { status: "unknown", rate: null };
  const rate = t.ok / decided;
  if (rate >= 0.9) return { status: "operational", rate };
  if (rate >= 0.5) return { status: "degraded", rate };
  return { status: "degraded", rate };
}

const FAILED = new Set(["ERROR", "TIMEOUT", "FAILED"]);
const DENIED = new Set(["DENIED", "REJECTED", "CANCELLED"]);

export function buildExperienceClaims(
  input: ExperienceSourceInput,
): SelfClaim[] {
  const now = input.now;
  const windowMs = input.windowMs ?? EXPERIENCE_DEFAULT_WINDOW_MS;
  const min = input.minSamples ?? EXPERIENCE_DEFAULT_MIN_SAMPLES;
  const since = input.nowMs - windowMs;
  const days = Math.round(windowMs / 86_400_000);
  const claims: SelfClaim[] = [];

  const byTool = new Map<string, Tally>();
  let toolTotal = 0;
  for (const r of input.toolCalls) {
    if (r.proposed_at < since) continue;
    const t = byTool.get(r.tool_id) ?? tally();
    t.n += 1;
    toolTotal += 1;
    if (r.status === "COMPLETED") t.ok += 1;
    else if (FAILED.has(r.status)) t.failed += 1;
    else if (DENIED.has(r.status)) t.denied += 1;
    if (r.completed_at && r.proposed_at)
      t.latencies.push(r.completed_at - r.proposed_at);
    t.last = Math.max(t.last, r.completed_at ?? r.proposed_at);
    byTool.set(r.tool_id, t);
  }
  for (const [toolId, t] of byTool) {
    const c = competence(t, min);
    const med = median(t.latencies);
    claims.push(
      claim({
        claim_id: `self:experience.tool.${toolId}`,
        category: "experience",
        subject: `tool:${toolId}`,
        statement:
          c.status === "unknown"
            ? `${toolId}: ${t.n} recorded runs in ${days} days (${t.ok} completed, ${t.failed} failed, ${t.denied} denied) — below the ${min}-sample bar, so I do not rate my competence with it yet.`
            : `${toolId}: ${Math.round((c.rate ?? 0) * 100)}% of ${t.ok + t.failed} decided runs completed in the last ${days} days (${t.failed} failed, ${t.denied} denied${med !== null ? `, median ${med} ms` : ""}).`,
        status: c.status,
        trust_class: "recent_verified_test",
        observed_at: now,
        ttl_ms: windowMs,
        evidence: [
          evidence(
            "db_aggregate",
            "tool_calls",
            now,
            `n=${t.n} window=${days}d`,
          ),
        ],
      }),
    );
  }

  const byModel = new Map<string, Tally>();
  let failovers = 0;
  let failoverLast = 0;
  let modelTotal = 0;
  for (const e of input.telemetry) {
    if (e.timestamp < since) continue;
    if (e.event_type === "model_call" && e.model_id) {
      const t = byModel.get(e.model_id) ?? tally();
      t.n += 1;
      modelTotal += 1;
      if (e.success) t.ok += 1;
      else t.failed += 1;
      if (e.latency_ms !== null) t.latencies.push(e.latency_ms);
      t.last = Math.max(t.last, e.timestamp);
      byModel.set(e.model_id, t);
    } else if (e.event_type === "voice_provider_failover") {
      failovers += 1;
      failoverLast = Math.max(failoverLast, e.timestamp);
    }
  }
  for (const [modelId, t] of byModel) {
    const c = competence(t, min);
    const med = median(t.latencies);
    claims.push(
      claim({
        claim_id: `self:experience.model.${modelId.replace(/[^a-z0-9._-]/gi, "-").toLowerCase()}`,
        category: "experience",
        subject: `model:${modelId}`,
        statement:
          c.status === "unknown"
            ? `${modelId}: ${t.n} recorded calls in ${days} days — below the ${min}-sample bar for a competence rating.`
            : `${modelId}: ${Math.round((c.rate ?? 0) * 100)}% of ${t.n} calls succeeded in the last ${days} days${med !== null ? `, median latency ${med} ms` : ""}.`,
        status: c.status,
        trust_class: "recent_verified_test",
        observed_at: now,
        ttl_ms: windowMs,
        evidence: [
          evidence(
            "db_aggregate",
            "telemetry_events(model_call)",
            now,
            `n=${t.n} window=${days}d`,
          ),
        ],
      }),
    );
  }

  claims.push(
    claim({
      claim_id: "self:experience.voice-failover",
      category: "experience",
      subject: "voice:failover-history",
      statement:
        failovers === 0
          ? `No voice provider failovers recorded in the last ${days} days.`
          : `${failovers} voice provider failover(s) recorded in the last ${days} days (last ${new Date(failoverLast).toISOString()}); the chain worked, the primary did not.`,
      status: failovers === 0 ? "operational" : "degraded",
      trust_class: "recent_verified_test",
      observed_at: now,
      ttl_ms: windowMs,
      evidence: [
        evidence(
          "db_aggregate",
          "telemetry_events(voice_provider_failover)",
          now,
          `n=${failovers}`,
        ),
      ],
    }),
  );

  claims.push(
    claim({
      claim_id: "self:experience.summary",
      category: "experience",
      subject: "experience.summary",
      statement:
        toolTotal + modelTotal === 0
          ? `I have no recorded tool runs or model calls in the last ${days} days; I cannot rate my competence from experience yet.`
          : `In the last ${days} days I recorded ${toolTotal} tool runs across ${byTool.size} tools and ${modelTotal} model calls across ${byModel.size} models. Ratings exist only where ≥${min} decided samples exist.`,
      status: toolTotal + modelTotal === 0 ? "unknown" : "operational",
      trust_class: "recent_verified_test",
      observed_at: now,
      ttl_ms: windowMs,
      evidence: [
        toolTotal + modelTotal === 0
          ? evidence(
              "unavailable",
              "tool_calls, telemetry_events",
              now,
              "no rows in window",
            )
          : evidence("db_aggregate", "tool_calls, telemetry_events", now),
      ],
    }),
  );

  return claims;
}
