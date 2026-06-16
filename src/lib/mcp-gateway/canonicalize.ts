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
// GATE-2: this module imports ONLY zod + the local leaf sanitizer. It does NOT
// import the tool registry (tools/ pulls router + db — denied trees). Registry
// metadata enters through an INJECTED lookup (the narrow-projection / injected-
// source template from 24B-2): the host builds a ToolMetadata projection from
// the real registry OUTSIDE the gateway import graph and passes it in. The
// gateway re-declares the small registry vocab as local string unions (mirrors
// tools/types.ts ReversibilityClass + router SafetyTag + approval-runtime risk
// classes) so it needs no import from those trees.
//
// THIS SLICE DERIVES AND STOPS. There is no enqueue, no approval, no execution,
// no runtime.runTool. 24C-2 builds the enqueue behind the GATE-5 needle's eye.

import { z } from "zod";

import { findForbiddenFields } from "./sanitizer";

// --- registry vocab, re-declared locally (NO import from tools/router) -------
// Structurally identical to tools/types.ts `ReversibilityClass`, router
// `SafetyTag`, and approval-runtime `APPROVAL_RISK_CLASSES`. Re-declaring keeps
// the gateway import graph free of those denied trees while letting an injected
// projection (typed by the real registry) assign into these unions structurally.
export type GatewayReversibilityClass =
  | "NO_SIDE_EFFECT"
  | "PURE_READ"
  | "REVERSIBLE_WRITE"
  | "IRREVERSIBLE";

export type GatewaySafetyTag =
  | "ALLOW"
  | "CONFIRM_ONCE"
  | "CONFIRM_ALWAYS"
  | "BLOCK";

export type CanonicalMutationType =
  | "none"
  | "read"
  | "reversible_write"
  | "irreversible_write";

/** Mirrors approval-runtime APPROVAL_RISK_CLASSES so the derived risk_class is
 * compatible with the proposal contract a later slice (24C-2) will populate. */
export type CanonicalRiskClass = "low" | "medium" | "high" | "critical";

export type CanonicalApprovalTier =
  | "auto"
  | "confirm_once"
  | "confirm_always"
  | "elevated";

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
  | { ok: true; canonical_effect: CanonicalEffect }
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

// --- derivation policy (pure functions of registry metadata) -----------------
function mutationTypeOf(
  reversibility: GatewayReversibilityClass,
): CanonicalMutationType {
  switch (reversibility) {
    case "NO_SIDE_EFFECT":
      return "none";
    case "PURE_READ":
      return "read";
    case "REVERSIBLE_WRITE":
      return "reversible_write";
    case "IRREVERSIBLE":
      return "irreversible_write";
    default:
      // fail-safe: an unrecognized class is treated as the most dangerous
      return "irreversible_write";
  }
}

const RISK_ORDER: CanonicalRiskClass[] = ["low", "medium", "high", "critical"];

function bumpRisk(risk: CanonicalRiskClass, by: number): CanonicalRiskClass {
  const index = RISK_ORDER.indexOf(risk);
  const next = Math.min(RISK_ORDER.length - 1, Math.max(0, index + by));
  return RISK_ORDER[next];
}

/** risk_class is a pure function of the registry's reversibilityClass +
 * requiredSafetyTag — never the client. CONFIRM_ALWAYS escalates one level;
 * BLOCK (which should already be non-exposable) pins to critical. */
function riskClassOf(
  reversibility: GatewayReversibilityClass,
  safetyTag: GatewaySafetyTag,
): CanonicalRiskClass {
  let base: CanonicalRiskClass;
  switch (reversibility) {
    case "NO_SIDE_EFFECT":
    case "PURE_READ":
      base = "low";
      break;
    case "REVERSIBLE_WRITE":
      base = "medium";
      break;
    case "IRREVERSIBLE":
      base = "high";
      break;
    default:
      base = "critical"; // fail-safe
  }
  if (safetyTag === "BLOCK") return "critical";
  if (safetyTag === "CONFIRM_ALWAYS") return bumpRisk(base, 1);
  return base;
}

/** approval_tier is derived from the registry's requiredSafetyTag (the confirm
 * requirement) + reversibilityClass. A write is never weaker than confirm_once;
 * an irreversible action is never weaker than confirm_always. */
function approvalTierOf(
  reversibility: GatewayReversibilityClass,
  safetyTag: GatewaySafetyTag,
): CanonicalApprovalTier {
  const isWrite =
    reversibility === "REVERSIBLE_WRITE" || reversibility === "IRREVERSIBLE";

  let tier: CanonicalApprovalTier;
  if (safetyTag === "ALLOW") tier = isWrite ? "confirm_once" : "auto";
  else if (safetyTag === "CONFIRM_ONCE") tier = "confirm_once";
  else tier = "confirm_always"; // CONFIRM_ALWAYS or BLOCK

  if (reversibility === "IRREVERSIBLE") {
    tier = tier === "confirm_always" ? "elevated" : "confirm_always";
  }
  return tier;
}

/**
 * Structurally summarize a raw scope/target string so NO raw path/value/secret
 * enters the metadata-only effect. Filesystem paths collapse to
 * "filesystem:<ext-shape>"; scheme-prefixed scopes keep the scheme only
 * ("memory:<target>"); anything else is "opaque:<target>".
 */
function summarizeTarget(rawScope: string): {
  target: string;
  scopeCategory: string;
} {
  const trimmed = rawScope.trim();
  const winDrive = /^[a-zA-Z]:[\\/]/.test(trimmed);
  const pathLike =
    winDrive ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /[\\/]/.test(trimmed);

  if (pathLike) {
    const ext = /\.([a-z0-9]{1,8})$/i.exec(trimmed);
    const shape = ext ? `*.${ext[1].toLowerCase()}` : "path";
    return { target: `filesystem:${shape}`, scopeCategory: "filesystem" };
  }

  const schemeMatch = /^([a-z][a-z0-9_-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    return { target: `${scheme}:<target>`, scopeCategory: scheme };
  }

  return { target: "opaque:<target>", scopeCategory: "opaque" };
}

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

  return { ok: true, canonical_effect: effect };
}
