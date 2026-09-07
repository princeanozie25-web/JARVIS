// Self Model (E-050) — the typed frontend projection.
//
// A stable, UI-agnostic shape for Astra's surfaces (a "Self" panel, a
// status chip, a capability list). Pure data: no styling, no copy beyond
// the claims' own statements, no routes. The schema is exported so the
// frontend can validate what it receives and tests can pin the shape.
import { z } from "zod";
import {
  SELF_MODEL_CONTRACT_VERSION,
  SelfClaimStatusSchema,
  SelfFreshnessStateSchema,
  SelfTrustClassSchema,
  type SelfClaim,
  type SelfSnapshot,
} from "./contracts";
import { assertNoSelfLeak } from "./redaction";
import { freshnessOf } from "./reconcile";

export const SelfProjectionItemSchema = z.strictObject({
  claim_id: z.string(),
  subject: z.string(),
  label: z.string().max(120),
  statement: z.string().max(400),
  status: SelfClaimStatusSchema,
  trust_class: SelfTrustClassSchema,
  freshness: SelfFreshnessStateSchema,
  observed_at: z.string(),
  evidence_count: z.number().int().nonnegative(),
  contradiction_count: z.number().int().nonnegative(),
});

export const SELF_PROJECTION_SECTION_IDS = [
  "identity",
  "runtime",
  "capabilities",
  "experience",
  "limits",
  "repository",
] as const;

export const SelfProjectionSectionSchema = z.strictObject({
  id: z.enum(SELF_PROJECTION_SECTION_IDS),
  title: z.string().max(60),
  items: z.array(SelfProjectionItemSchema),
});

export const SelfProjectionSchema = z.strictObject({
  contract_version: z.literal(SELF_MODEL_CONTRACT_VERSION),
  projection_version: z.literal("SM.1-projection"),
  generated_at: z.string(),
  headline: z.enum(["operational", "degraded", "offline", "unknown"]),
  identity: z.strictObject({
    name: z.string().max(40),
    role: z.string().max(160),
    owner_label: z.string().max(80),
  }),
  counts: z.strictObject({
    claims: z.number().int().nonnegative(),
    by_status: z.record(z.string(), z.number().int().nonnegative()),
    stale: z.number().int().nonnegative(),
    contradictions: z.number().int().nonnegative(),
  }),
  sections: z.array(SelfProjectionSectionSchema),
  warnings: z.array(z.string().max(320)),
  metadata_only: z.literal(true),
  secret_material_included: z.literal(false),
});
export type SelfProjection = z.infer<typeof SelfProjectionSchema>;
export type SelfProjectionItem = z.infer<typeof SelfProjectionItemSchema>;

function label(c: SelfClaim): string {
  const s = c.subject;
  const i = s.indexOf(":");
  return (i >= 0 ? s.slice(i + 1) : s).slice(0, 120);
}

function item(c: SelfClaim, nowMs: number): SelfProjectionItem {
  return {
    claim_id: c.claim_id,
    subject: c.subject,
    label: label(c),
    statement: c.statement,
    status: c.status,
    trust_class: c.trust_class,
    freshness: freshnessOf(c, nowMs),
    observed_at: c.observed_at,
    evidence_count: c.evidence.length,
    contradiction_count: c.contradictions.length,
  };
}

export function buildSelfProjection(
  snapshot: SelfSnapshot,
  input: { now_ms: number; headline: SelfProjection["headline"] },
): SelfProjection {
  const nowMs = input.now_ms;
  const identityClaim = snapshot.claims.find(
    (c) => c.claim_id === "self:identity",
  );
  const m = identityClaim
    ? /^I am ([^,]+), (.+?) for (.+?)\.$/.exec(identityClaim.statement)
    : null;
  const by = (pred: (c: SelfClaim) => boolean) =>
    snapshot.claims.filter(pred).map((c) => item(c, nowMs));
  const byStatus: Record<string, number> = {};
  let stale = 0;
  let contradictions = 0;
  for (const c of snapshot.claims) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (freshnessOf(c, nowMs) === "stale") stale += 1;
    contradictions += c.contradictions.length;
  }
  const projection = SelfProjectionSchema.parse({
    contract_version: SELF_MODEL_CONTRACT_VERSION,
    projection_version: "SM.1-projection",
    generated_at: snapshot.generated_at,
    headline: input.headline,
    identity: {
      name: m?.[1] ?? "unknown",
      role: m?.[2] ?? "identity unavailable",
      owner_label: m?.[3] ?? "unknown",
    },
    counts: {
      claims: snapshot.claims.length,
      by_status: byStatus,
      stale,
      contradictions,
    },
    sections: [
      {
        id: "identity",
        title: "Identity",
        items: by((c) => c.category === "identity"),
      },
      {
        id: "runtime",
        title: "Runtime",
        items: by((c) => c.category === "runtime" || c.category === "node"),
      },
      {
        id: "capabilities",
        title: "Capabilities",
        items: by((c) => c.category === "capability"),
      },
      {
        id: "experience",
        title: "Experience",
        items: by((c) => c.category === "experience"),
      },
      {
        id: "limits",
        title: "Limits & constitution",
        items: by(
          (c) => c.category === "limit" || c.category === "constitution",
        ),
      },
      {
        id: "repository",
        title: "Repository",
        items: by(
          (c) => c.category === "repository" || c.category === "enhancement",
        ),
      },
    ],
    warnings: snapshot.warnings,
    metadata_only: true,
    secret_material_included: false,
  });
  return assertNoSelfLeak(projection);
}
