// MCP gateway — FC-1: server-derived canonical effect (24C-1).
//
// THE THREAT (EoP-7): a client submits requested INTENT, never truth. If the
// client could frame its own risk/target/effect, every downstream control would
// inherit the client's lie. So the server DERIVES the canonical effect from its
// OWN tool registry — capability, mutation_type, target, risk_class,
// approval_tier, scope_required — and the human ultimately approves the SERVER's
// canonical effect (24C-2 + the FC-2 guard), never the client's words. The
// client may submit ONLY { tool, args }; both are INPUT to derivation, not the
// effect itself.
//
// GATE-3 (begins here): the canonical effect cannot be client-forged. The client
// request schema is a z.strictObject — ANY extra top-level field (risk_class,
// target, canonical_effect, canonical_effect_hash, scope, approval_tier, …) is
// REJECTED, not silently stripped, so a forging attempt is visible. Nothing the
// client can put in `args` authors the effect: the effect comes from registry
// metadata + server policy only.
//
// EoP-13 (default-deny): an unknown tool id, or a tool not classified
// proposal-exposable, is REJECTED. Absence of an exposable classification ⇒ NOT
// exposable.
//
// GATE-2: this module imports ONLY zod, the local leaf sanitizer, and the
// canonical-policy leaf (@/lib/canonical-policy — a pure, mutator-free module).
// It does NOT import the tool registry (tools/ pulls router + db — denied trees).
// Registry metadata enters through an INJECTED lookup (the narrow-projection /
// injected-source template from 24B-2): the host builds a ToolMetadata projection
// from the real registry OUTSIDE the gateway import graph and passes it in. The
// small registry vocab + derivation (mirroring tools/types.ts ReversibilityClass
// + router SafetyTag + approval-runtime risk classes) come from the canonical-
// policy leaf, which the executor also depends on — so neither imports the other.
//
// THIS SLICE DERIVES AND STOPS. There is no enqueue, no approval, no execution,
// no runtime.runTool. 24C-2 builds the enqueue behind the GATE-5 needle's eye.

import { z } from "zod";

import { findForbiddenFields } from "./sanitizer";
import {
  approvalTierOf,
  mutationTypeOf,
  riskClassOf,
  summarizeTarget,
  type ApprovalTier,
  type MutationType,
  type ReversibilityClass,
  type RiskClass,
  type SafetyTag,
} from "@/lib/canonical-policy";

// --- registry vocab, from the shared canonical-policy leaf (24D-2b) ----------
// The vocab + derivation now live in @/lib/canonical-policy — a pure, mutator-
// free leaf BOTH the gateway and the executor (chat/) depend DOWN onto, so the
// executor can re-check the same policy at the decision point WITHOUT importing
// the gateway and vice-versa (no cycle; closes E-016). These aliases preserve
// the gateway's local vocab names so nothing downstream of this file changes.
export type GatewayReversibilityClass = ReversibilityClass;
export type GatewaySafetyTag = SafetyTag;
export type CanonicalMutationType = MutationType;
export type CanonicalRiskClass = RiskClass;
export type CanonicalApprovalTier = ApprovalTier;

// --- the injected registry projection (narrow, read-only) --------------------
/**
 * The per-tool metadata the canonicalizer needs — a NARROW projection of the
 * real `Tool`. The host builds this from the registry OUTSIDE the gateway graph
 * (capability+reversibilityClass+requiredSafetyTag are projected fields;
 * validateArgs wraps the tool's zod inputSchema; deriveTarget wraps the tool's
 * scopeOf). `proposalExposable` is a GATEWAY policy decision, default-deny.
 */
export interface ToolMetadata {
  /** A stable capability identifier (the host typically passes the tool id). */
  capability: string;
  reversibilityClass: GatewayReversibilityClass;
  requiredSafetyTag: GatewaySafetyTag;
  /** Gateway policy: may this tool be proposed over MCP at all? Default-deny. */
  proposalExposable: boolean;
  /** Validate args against the tool's own schema (wraps inputSchema.safeParse). */
  validateArgs(args: unknown): { ok: true } | { ok: false };
  /** Derive the raw target/scope per the tool's own rules (wraps scopeOf). The
   * raw value may be sensitive (e.g. a filesystem path); the canonicalizer
   * structurally summarizes it before it enters the metadata-only effect. */
  deriveTarget(args: unknown): string;
}

/** Injected registry lookup. Returns null for an unknown tool (⇒ default-deny). */
export type ToolMetadataLookup = (toolId: string) => ToolMetadata | null;

// --- the server-derived canonical effect -------------------------------------
export interface CanonicalEffect {
  tool_id: string;
  capability: string;
  mutation_type: CanonicalMutationType;
  /** A STRUCTURAL summary of the target — never the raw path/value (see
   * summarizeTarget). e.g. "filesystem:*.md", "memory:<target>". */
  target: string;
  risk_class: CanonicalRiskClass;
  approval_tier: CanonicalApprovalTier;
  /** Coarse capability-scope the request needs (24D enforces per-client). */
  scope_required: string;
  /** Server-composed, metadata-only summary. No raw arg values/body/secret. */
  side_effect_summary: string;
  server_derived: true;
  metadata_only: true;
}

export type CanonicalizeRejectionReason =
  | "malformed_request" // failed the strict client schema (GATE-3) or non-object
  | "unknown_tool" // not in the registry (EoP-13)
  | "not_exposable" // not classified proposal-exposable (EoP-13)
  | "invalid_args" // args failed the tool's own schema
  | "target_underivable" // scopeOf produced no usable target
  | "sanitizer_blocked"; // derived effect failed the metadata-only sentinel

export type CanonicalizeResult =
  | {
      ok: true;
      canonical_effect: CanonicalEffect;
      /** The validated tool id + args, and the DERIVED (raw, unmasked) target.
       * Carried for the 24D-2a scope check (target-prefix matching); the
       * canonical_effect itself stays metadata-only (masked target). */
      tool: string;
      args: unknown;
      raw_target: string;
    }
  | { ok: false; reason: CanonicalizeRejectionReason };

/**
 * The UNTRUSTED client request schema. EXACTLY { tool, args } — z.strictObject
 * rejects any other top-level key (GATE-3: the client cannot author a canonical/
 * risk/target/hash/effect/scope/approval_tier field; the attempt is rejected,
 * not stripped). `args` is opaque here; the tool's own schema validates it.
 */
export const ClientProposalRequestSchema = z.strictObject({
  tool: z.string().trim().min(1),
  args: z.unknown(),
});

export type ClientProposalRequest = z.infer<typeof ClientProposalRequestSchema>;

// Derivation (mutationTypeOf, riskClassOf, approvalTierOf, summarizeTarget) is
// imported from the canonical-policy leaf above — same pure functions, one home.

/**
 * FC-1. Turn an UNTRUSTED client request into a server-derived canonical effect.
 * Derives everything from the injected registry metadata + server policy; the
 * client cannot author any effect field. Fail-closed at every step. PRODUCES a
 * canonical_effect and STOPS — no enqueue, no approval, no execution.
 */
export function canonicalizeProposalRequest(
  rawRequest: unknown,
  lookup: ToolMetadataLookup,
): CanonicalizeResult {
  // GATE-3: only { tool, args } is accepted; any extra top-level field rejects.
  const parsed = ClientProposalRequestSchema.safeParse(rawRequest);
  if (!parsed.success) return { ok: false, reason: "malformed_request" };

  const { tool, args } = parsed.data;

  // EoP-13 default-deny: unknown or non-exposable tool is rejected.
  const meta = lookup(tool);
  if (meta === null) return { ok: false, reason: "unknown_tool" };
  if (meta.proposalExposable !== true) {
    return { ok: false, reason: "not_exposable" };
  }

  // args must satisfy the tool's own schema (the registry's truth, not ours).
  if (!meta.validateArgs(args).ok) return { ok: false, reason: "invalid_args" };

  // target is DERIVED from args per the tool's own rules, then masked.
  let rawScope: string;
  try {
    rawScope = meta.deriveTarget(args);
  } catch {
    return { ok: false, reason: "target_underivable" };
  }
  if (typeof rawScope !== "string" || rawScope.trim().length === 0) {
    return { ok: false, reason: "target_underivable" };
  }

  const mutation_type = mutationTypeOf(meta.reversibilityClass);
  const risk_class = riskClassOf(
    meta.reversibilityClass,
    meta.requiredSafetyTag,
  );
  const approval_tier = approvalTierOf(
    meta.reversibilityClass,
    meta.requiredSafetyTag,
  );
  const { target, scopeCategory } = summarizeTarget(rawScope);
  const scope_required = `${scopeCategory}:${mutation_type}`;
  const capability = meta.capability;
  const side_effect_summary = `${mutation_type} on ${target} via capability ${capability} (tier ${approval_tier}, risk ${risk_class})`;

  const effect: CanonicalEffect = {
    tool_id: tool,
    capability,
    mutation_type,
    target,
    risk_class,
    approval_tier,
    scope_required,
    side_effect_summary,
    server_derived: true,
    metadata_only: true,
  };

  // Metadata-only backstop (I-24C1-5): the effect must pass the leaf sanitizer.
  // It is clean by construction (target is masked, no arg values copied), and
  // this proves it — fail-closed if a future change ever leaks a raw value.
  if (findForbiddenFields(effect).length > 0) {
    return { ok: false, reason: "sanitizer_blocked" };
  }

  return {
    ok: true,
    canonical_effect: effect,
    tool,
    args,
    raw_target: rawScope,
  };
}
