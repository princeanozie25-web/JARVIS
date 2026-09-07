// Self Model (E-050) — the compact reasoning context and explainability.
//
// `buildSelfContext` renders a snapshot into a short block a router,
// orchestrator or system-prompt assembler can prepend: identity, what is
// verified working NOW, what is degraded/offline, standing limits, and a
// freshness line. It is bounded (chars, not vibes) and task-shaped.
// `explainClaim` answers "why do you say that?" with the evidence trail.
import {
  SelfContextTaskKindSchema,
  type SelfClaim,
  type SelfContextTaskKind,
  type SelfFreshnessState,
  type SelfSnapshot,
} from "./contracts";
import { assertNoSelfLeak } from "./redaction";
import { freshnessOf } from "./reconcile";

export interface SelfContextOptions {
  task_kind: SelfContextTaskKind;
  now_ms: number;
  max_chars?: number;
}

export interface SelfContext {
  task_kind: SelfContextTaskKind;
  text: string;
  claim_ids: string[];
  char_count: number;
  generated_at: string;
  truncated: boolean;
}

export const SELF_CONTEXT_DEFAULT_MAX_CHARS = 2400;

const VERIFY_HINT: Record<SelfClaim["evidence"][number]["kind"], string> = {
  runtime_probe:
    "re-run the probe (self.status forces a fresh snapshot after the cache TTL)",
  test_run: "re-run the referenced test",
  registry: "open the referenced registry module",
  config: "open the referenced config/prompt file",
  policy:
    "open the referenced policy module; it is the source, not a paraphrase",
  db_aggregate: "query the referenced table for the same window",
  architecture_graph: "inspect the architecture graph projection",
  enhancement_registry: "open the referenced REGISTRY.md row",
  roadmap_document:
    "open the roadmap section; a roadmap claim is a plan, not a state",
  unavailable: "no evidence exists yet; nothing to verify",
};

function pick(
  snapshot: SelfSnapshot,
  pred: (c: SelfClaim) => boolean,
  limit: number,
): SelfClaim[] {
  return snapshot.claims.filter(pred).slice(0, limit);
}

export function buildSelfContext(
  snapshot: SelfSnapshot,
  options: SelfContextOptions,
): SelfContext {
  const taskKind = SelfContextTaskKindSchema.parse(options.task_kind);
  const max = options.max_chars ?? SELF_CONTEXT_DEFAULT_MAX_CHARS;
  const nowMs = options.now_ms;
  const used: string[] = [];
  const lines: string[] = [];
  const add = (c: SelfClaim, prefix = "- ") => {
    lines.push(`${prefix}${c.statement}`);
    used.push(c.claim_id);
  };

  const identity = snapshot.claims.find((c) => c.claim_id === "self:identity");
  const role = snapshot.claims.find((c) => c.claim_id === "self:identity.role");
  lines.push(
    "SELF (evidence-backed; statuses are claims with provenance, not assurances):",
  );
  if (identity) add(identity, "");
  if (role && taskKind !== "tool_use") add(role, "");

  const live = (c: SelfClaim) =>
    c.trust_class === "current_verified_runtime" &&
    freshnessOf(c, nowMs) === "fresh";
  // Inference first (what a turn depends on), then voice, then the rest.
  const rank = (c: SelfClaim) =>
    c.subject === "provider:ollama"
      ? 0
      : c.subject.startsWith("model:")
        ? 1
        : c.subject.startsWith("voice:")
          ? 2
          : 3;
  const verifiedNow = snapshot.claims
    .filter((c) => live(c) && c.status === "operational")
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, taskKind === "introspection" ? 8 : 5);
  if (verifiedNow.length) {
    lines.push("Verified now:");
    verifiedNow.forEach((c) => add(c));
  }
  const notNow = pick(
    snapshot,
    (c) =>
      c.trust_class === "current_verified_runtime" &&
      (c.status === "offline" || c.status === "degraded"),
    6,
  );
  if (notNow.length) {
    lines.push("Degraded / offline now:");
    notNow.forEach((c) => add(c));
  }

  if (
    taskKind === "tool_use" ||
    taskKind === "planning" ||
    taskKind === "introspection"
  ) {
    const rated = pick(
      snapshot,
      (c) =>
        c.category === "experience" &&
        c.status !== "unknown" &&
        c.subject.startsWith("tool:"),
      4,
    );
    if (rated.length) {
      lines.push("Track record:");
      rated.forEach((c) => add(c));
    }
  }
  if (taskKind === "voice") {
    const voice = pick(
      snapshot,
      (c) => c.subject.startsWith("voice:") && c.category !== "experience",
      4,
    );
    if (voice.length) {
      lines.push("Voice:");
      voice.forEach((c) => add(c));
    }
  }

  const limits = pick(
    snapshot,
    (c) =>
      c.claim_id.startsWith("self:limit.") &&
      c.category === "limit" &&
      !c.subject.startsWith("disabled-feature"),
    taskKind === "chat" ? 3 : 5,
  );
  if (limits.length) {
    lines.push("Standing limits:");
    limits.forEach((c) => add(c));
  }

  const unknown = snapshot.claims.filter((c) => c.status === "unknown").length;
  const stale = snapshot.claims.filter(
    (c) => freshnessOf(c, nowMs) === "stale",
  ).length;
  const contradictions = snapshot.claims.reduce(
    (n, c) => n + c.contradictions.length,
    0,
  );
  lines.push(
    `Self-knowledge as of ${snapshot.generated_at}: ${snapshot.claims.length} claims, ${unknown} unknown, ${stale} stale, ${contradictions} source contradictions (runtime evidence wins). Ask self.explain <claim> for provenance.`,
  );

  let text = lines.join("\n");
  let truncated = false;
  if (text.length > max) {
    text = `${text.slice(0, max - 1)}…`;
    truncated = true;
  }
  return assertNoSelfLeak({
    task_kind: taskKind,
    text,
    claim_ids: used,
    char_count: text.length,
    generated_at: snapshot.generated_at,
    truncated,
  });
}

export interface SelfExplanation {
  claim: SelfClaim;
  freshness: SelfFreshnessState;
  because: string;
  evidence: Array<{
    kind: string;
    ref: string;
    observed_at: string;
    detail?: string;
    how_to_verify: string;
  }>;
  contradictions: Array<{
    status: string;
    trust_class: string;
    ref: string;
    why_overruled: string;
  }>;
}

export function explainClaim(claim: SelfClaim, nowMs: number): SelfExplanation {
  const freshness = freshnessOf(claim, nowMs);
  const because =
    claim.evidence[0]!.kind === "unavailable"
      ? "I say 'unknown' because no source produced evidence for this subject."
      : `I say '${claim.status}' because the highest-precedence source for this subject (${claim.trust_class}) reported it${claim.ttl_ms === null ? " as a standing fact" : ` at ${claim.observed_at} (${freshness})`}.`;
  return assertNoSelfLeak({
    claim,
    freshness,
    because,
    evidence: claim.evidence.map((e) => ({
      ...e,
      how_to_verify: VERIFY_HINT[e.kind],
    })),
    contradictions: claim.contradictions.map((x) => ({
      ...x,
      why_overruled: `${x.trust_class} ranks below ${claim.trust_class} in the precedence order (runtime > test > config/registry > architecture docs > roadmap).`,
    })),
  });
}
