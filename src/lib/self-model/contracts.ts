// Self Model (E-050) — typed contracts.
//
// JARVIS's picture of itself is a set of CLAIMS. Every claim carries its
// provenance (where the evidence came from), a trust class (which decides
// who wins when sources disagree), a status (operational / degraded / ...)
// and a freshness window. Nothing here is prose the model wrote about
// itself: a claim exists only because a registry, a policy, a probe or a
// database aggregate produced it.
import { z } from "zod";

export const SELF_MODEL_CONTRACT_VERSION = "SM.1" as const;

export const SELF_CLAIM_STATUSES = [
  "operational",
  "degraded",
  "offline",
  "experimental",
  "planned",
  "unsupported",
  "unknown",
] as const;
export type SelfClaimStatus = (typeof SELF_CLAIM_STATUSES)[number];

// Contradiction precedence, highest first (the brief's ordering):
// CURRENT VERIFIED RUNTIME > RECENT VERIFIED TEST > CONFIG/REGISTRY >
// ARCHITECTURE DOCS > ROADMAP.
export const SELF_TRUST_CLASSES = [
  "current_verified_runtime",
  "recent_verified_test",
  "config_registry",
  "architecture_docs",
  "roadmap",
] as const;
export type SelfTrustClass = (typeof SELF_TRUST_CLASSES)[number];

export const SELF_TRUST_PRECEDENCE: Readonly<Record<SelfTrustClass, number>> = {
  current_verified_runtime: 5,
  recent_verified_test: 4,
  config_registry: 3,
  architecture_docs: 2,
  roadmap: 1,
};

export const SELF_CLAIM_CATEGORIES = [
  "identity",
  "constitution",
  "limit",
  "capability",
  "runtime",
  "node",
  "experience",
  "repository",
  "enhancement",
] as const;
export type SelfClaimCategory = (typeof SELF_CLAIM_CATEGORIES)[number];

export const SELF_EVIDENCE_KINDS = [
  "runtime_probe",
  "test_run",
  "registry",
  "config",
  "policy",
  "db_aggregate",
  "architecture_graph",
  "enhancement_registry",
  "roadmap_document",
  "unavailable",
] as const;
export type SelfEvidenceKind = (typeof SELF_EVIDENCE_KINDS)[number];

export const SELF_FRESHNESS_STATES = [
  "fresh",
  "stale",
  "static",
  "unknown",
] as const;
export type SelfFreshnessState = (typeof SELF_FRESHNESS_STATES)[number];

export const SelfClaimStatusSchema = z.enum(SELF_CLAIM_STATUSES);
export const SelfTrustClassSchema = z.enum(SELF_TRUST_CLASSES);
export const SelfClaimCategorySchema = z.enum(SELF_CLAIM_CATEGORIES);
export const SelfEvidenceKindSchema = z.enum(SELF_EVIDENCE_KINDS);
export const SelfFreshnessStateSchema = z.enum(SELF_FRESHNESS_STATES);

export const SelfEvidenceSchema = z.strictObject({
  kind: SelfEvidenceKindSchema,
  // A pointer a human can follow: a file path, a registry id, a table name,
  // a URL host — never a value copied out of the thing it points at.
  ref: z.string().trim().min(1).max(200),
  observed_at: z.string().trim().min(1).max(40),
  detail: z.string().trim().max(320).optional(),
});
export type SelfEvidence = z.infer<typeof SelfEvidenceSchema>;

export const SelfContradictionSchema = z.strictObject({
  status: SelfClaimStatusSchema,
  trust_class: SelfTrustClassSchema,
  ref: z.string().trim().min(1).max(200),
});
export type SelfContradiction = z.infer<typeof SelfContradictionSchema>;

export const SelfClaimSchema = z.strictObject({
  claim_id: z
    .string()
    .trim()
    .regex(/^self:[a-z0-9._/:-]+$/),
  category: SelfClaimCategorySchema,
  // The thing the claim is about ("model:ollama/qwen3.5-9b-mlx",
  // "tool:fs.read_file"). Claims about the same subject are reconciled.
  subject: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(400),
  status: SelfClaimStatusSchema,
  trust_class: SelfTrustClassSchema,
  observed_at: z.string().trim().min(1).max(40),
  // null = static truth (a policy, a version); otherwise how long a probe
  // result may be treated as current.
  ttl_ms: z.number().int().nonnegative().nullable(),
  evidence: z.array(SelfEvidenceSchema).min(1).max(12),
  contradictions: z.array(SelfContradictionSchema).max(12),
  metadata_only: z.literal(true),
  secret_material_included: z.literal(false),
});
export type SelfClaim = z.infer<typeof SelfClaimSchema>;

export const SelfSourceRecordSchema = z.strictObject({
  source_id: z.string().trim().min(1).max(80),
  ok: z.boolean(),
  observed_at: z.string().trim().min(1).max(40),
  claim_count: z.number().int().nonnegative(),
  note: z.string().trim().max(320).optional(),
});
export type SelfSourceRecord = z.infer<typeof SelfSourceRecordSchema>;

export const SelfSnapshotSchema = z.strictObject({
  contract_version: z.literal(SELF_MODEL_CONTRACT_VERSION),
  generated_at: z.string().trim().min(1).max(40),
  claims: z.array(SelfClaimSchema),
  sources: z.array(SelfSourceRecordSchema),
  warnings: z.array(z.string().trim().max(320)).max(64),
  metadata_only: z.literal(true),
  secret_material_included: z.literal(false),
});
export type SelfSnapshot = z.infer<typeof SelfSnapshotSchema>;

export const SELF_CONTEXT_TASK_KINDS = [
  "chat",
  "voice",
  "planning",
  "tool_use",
  "introspection",
] as const;
export type SelfContextTaskKind = (typeof SELF_CONTEXT_TASK_KINDS)[number];
export const SelfContextTaskKindSchema = z.enum(SELF_CONTEXT_TASK_KINDS);

export interface ClaimInput {
  claim_id: string;
  category: SelfClaimCategory;
  subject: string;
  statement: string;
  status: SelfClaimStatus;
  trust_class: SelfTrustClass;
  observed_at: string;
  ttl_ms: number | null;
  evidence: SelfEvidence[];
}

/** The only way sources mint claims: validated, contradiction-free, marked. */
export function claim(input: ClaimInput): SelfClaim {
  return SelfClaimSchema.parse({
    ...input,
    statement: clip(input.statement, 400),
    contradictions: [],
    metadata_only: true,
    secret_material_included: false,
  });
}

export function evidence(
  kind: SelfEvidenceKind,
  ref: string,
  observed_at: string,
  detail?: string,
): SelfEvidence {
  return SelfEvidenceSchema.parse({
    kind,
    ref: clip(ref, 200),
    observed_at,
    ...(detail ? { detail: clip(detail, 320) } : {}),
  });
}

export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
