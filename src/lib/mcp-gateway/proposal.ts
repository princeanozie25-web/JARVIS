// MCP gateway — FC-2: the hash-frozen proposal (24C-2).
//
// FC-1 (canonicalize.ts) turns an untrusted {tool, args} into a SERVER-DERIVED
// canonical_effect. FC-2 freezes that effect into a proposal whose identity is a
// SERVER-COMPUTED hash over a stable serialization of the effect. The human will
// later approve THIS frozen artifact; the 24C-2b executor guard re-validates the
// hash at decision time. A client cannot author the hash, the id, or the
// timestamps — every field here is server-built.
//
// GATE-2: imports only node:crypto (allowlisted hashing primitive) + zod + the
// local canonical effect type/sanitizer. No db / approval-runtime import — the
// enqueue happens through an injected boundary (see enqueue.ts).

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { CanonicalEffect } from "./canonicalize";

/** A `hash:`-shaped content reference (mirrors the Phase-18 contract vocabulary
 * — source_ref_hash/subject_ref_hash are the same shape). */
const HASH_REF = z
  .string()
  .trim()
  .regex(/^hash:[a-z0-9._:-]+$/);

/**
 * Deterministic, key-sorted serialization. The hash MUST be stable regardless of
 * property insertion order, so we recursively sort object keys. (JSON.stringify
 * alone is insertion-order sensitive.)
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function sha256Ref(value: unknown): string {
  return `hash:sha256:${createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`;
}

/** SERVER-computed hash over the canonical effect. Same effect -> same hash;
 * different effect -> different hash. The client never supplies this. */
export function computeCanonicalEffectHash(effect: CanonicalEffect): string {
  return sha256Ref(effect);
}

/** Hash of the metadata-only scope snapshot (the scope/target the effect needs).
 * Carried as scope_snapshot_ref_hash; never the raw scope value. */
export function computeScopeSnapshotHash(effect: CanonicalEffect): string {
  return sha256Ref({
    scope_required: effect.scope_required,
    target: effect.target,
    mutation_type: effect.mutation_type,
  });
}

/** Server-generated proposal id (proposal:<hex>), shaped to the Phase-18
 * ProposalId grammar. */
export function generateProposalId(): string {
  return `proposal:${randomBytes(12).toString("hex")}`;
}

/** The FC-2 hash-frozen proposal — entirely server-built. */
export interface CanonicalProposal {
  proposal_id: string;
  /** Server-derived provenance (from the identity seam), never a client field. */
  client_id: string;
  canonical_effect: CanonicalEffect;
  /** The exact stable serialization that was hashed (reproducibility). */
  canonical_effect_json: string;
  canonical_effect_hash: string;
  scope_snapshot_ref_hash: string;
  created_at_ms: number;
  expires_at_ms: number;
}

/** Strict schema for the canonical effect — rejects any client-injected effect
 * field at the enqueue boundary (GATE-5). Mirrors canonicalize.ts CanonicalEffect. */
export const CanonicalEffectSchema = z.strictObject({
  tool_id: z.string(),
  capability: z.string(),
  mutation_type: z.enum([
    "none",
    "read",
    "reversible_write",
    "irreversible_write",
  ]),
  target: z.string(),
  risk_class: z.enum(["low", "medium", "high", "critical"]),
  approval_tier: z.enum(["auto", "confirm_once", "confirm_always", "elevated"]),
  scope_required: z.string(),
  side_effect_summary: z.string(),
  server_derived: z.literal(true),
  metadata_only: z.literal(true),
});

/** Strict schema for the whole proposal — the GATE-5 needle's eye parses input
 * through this, so any extra top-level field (status, approval, decision,
 * arbitrary metadata, a client hash beyond the exact shape) is REJECTED. */
export const CanonicalProposalSchema = z.strictObject({
  proposal_id: z
    .string()
    .trim()
    .regex(/^proposal:[a-z0-9._:-]+$/),
  // present (key required) but may be blank — the enqueue boundary turns a
  // blank client_id into an explicit no_provenance rejection (EoP-5).
  client_id: z.string().trim(),
  canonical_effect: CanonicalEffectSchema,
  canonical_effect_json: z.string(),
  canonical_effect_hash: HASH_REF,
  scope_snapshot_ref_hash: HASH_REF,
  created_at_ms: z.number().int().nonnegative(),
  expires_at_ms: z.number().int().nonnegative(),
});

/**
 * Build the hash-frozen proposal from a server-derived canonical effect. The
 * hash, id, scope-snapshot hash, and timestamps are all server-computed here.
 * `client_id` is the server-derived provenance, passed by the caller from the
 * identity seam (never read from a client body).
 */
export function buildCanonicalProposal(input: {
  canonical_effect: CanonicalEffect;
  client_id: string;
  now_ms: number;
  ttl_ms: number;
  /** Injectable for deterministic tests; defaults to a random server id. */
  proposal_id?: string;
}): CanonicalProposal {
  const canonical_effect_json = stableStringify(input.canonical_effect);
  return {
    proposal_id: input.proposal_id ?? generateProposalId(),
    client_id: input.client_id,
    canonical_effect: input.canonical_effect,
    canonical_effect_json,
    canonical_effect_hash: computeCanonicalEffectHash(input.canonical_effect),
    scope_snapshot_ref_hash: computeScopeSnapshotHash(input.canonical_effect),
    created_at_ms: input.now_ms,
    expires_at_ms: input.now_ms + input.ttl_ms,
  };
}
