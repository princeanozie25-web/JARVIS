# Phase 24C slice 24C-1 — FC-1: Server-Derived Canonical Effect — BUILD PROMPT

> Saved verbatim before execution (per instruction, 2026-06-16). This is the
> build brief, not a closeout artifact. Not part of the 24C-1 code commit.

ROLE: Phase 24C slice 24C-1 — FC-1: SERVER-DERIVED CANONICAL EFFECT. Build
the server-side canonicalization that turns an UNTRUSTED client {tool,
args} request into a server-DERIVED canonical effect, computed from
JARVIS's OWN tool registry — never from the client's framing. This slice
ONLY derives + validates the canonical effect; it does NOT enqueue and
does NOT execute (those are 24C-2 and are GATE-protected). Work in the
jarvis-main worktree. Commits under standing authority. Builds on the
FROZEN 24B read-server (d6e763b).

SINGLE AGENT. NO SUBAGENTS. NO Agent-tool fan-out. Every read and edit is
yours. Boundary work — no safe fan-out.

WHY THIS IS THE FOUNDATION (FC-1, from the threat model):
A client submits requested INTENT, never truth. If the client could frame
its own risk/target/effect, every downstream control inherits the client's
lie (EoP-7). So the server must DERIVE the canonical effect from its own
tool registry: capability, mutation_type, target, risk_class,
approval_tier, scope_required, side_effect_summary. The human ultimately
approves the SERVER's canonical effect (24C-2 + the FC-2 guard), never the
client's words. This slice builds and proves that derivation.

This slice also begins discharging GATE-3 (canonical proposal cannot be
client-forged): the canonicalizer must REJECT any client-supplied
canonical/risk/target/hash/effect field — the client may submit ONLY
{tool, args}.

## STEP 0 — READ-ONLY RECON

1. Locate JARVIS's TOOL REGISTRY: the authoritative source describing
   tools and their properties — what each tool does, its capability,
   whether it mutates, its risk/tier, its argument schema. This is what
   the Phase 18 approval lifecycle + tool runtime consult. Identify the
   exact module + the shape that holds per-tool metadata (mutation-ness,
   risk, tier, target semantics, arg schema). NOTE: it likely lives in or
   near a GATE-2 DENIED tree (tools/, runtime, chat) — so the gateway must
   read tool METADATA without importing a mutator tree (use the narrow-
   projection / injected-source template from 24B-2: a read-only metadata
   projection or an injected registry-lookup function, NEVER importing the
   executor).
2. Locate the FROZEN proposal contract: ApprovalProposalContractSchema
   (contracts.ts) and the additive fields GATE-1 specified
   (canonical_effect_hash, scope_snapshot_ref_hash, expires_at_ms). Read
   the GATE-1 findings (GATE1_RECON_FINDINGS.md, 256048c) for the exact
   canonical-effect field set FC-1 must produce.
3. Re-read 24B's GATE-2 allowlist + leaf sanitizer so the extension is
   surgical.

## YES — what to build (derivation ONLY)

1. A canonicalizer in the gateway (e.g. src/lib/mcp-gateway/
   canonicalize.ts) that takes an UNTRUSTED client request {tool, args}
   and produces a server-DERIVED canonical effect:
   canonical_effect {
   capability, // from the registry, by tool id
   mutation_type, // from the registry (read/create/update/…)
   target, // DERIVED from args per the tool's target rules
   risk_class, // from the registry — NOT from the client
   approval_tier, // from the registry
   scope_required, // from the registry
   side_effect_summary // a server-composed, metadata-only summary
   }
   Derivation source = the tool registry metadata (via narrow projection /
   injected lookup). The client's {tool, args} are INPUT to derivation, not
   the effect itself.
2. VALIDATION (fail-closed):
   - the tool id must exist in the registry AND be marked mcp-exposable /
     proposal-allowed; an unknown or non-exposable tool is REJECTED
     (default-deny, EoP-13). Reuse/define the capability-classification the
     registry carries; if a tool lacks an exposable/proposal classification,
     treat as NOT exposable.
   - args must validate against the tool's arg schema; invalid args
     REJECTED.
   - the derived target must satisfy the (placeholder this slice) scope
     constraints the tool declares (full per-client scope is 24D; here just
     honor the tool's own declared target rules / arg constraints).
3. GATE-3 (begin): the canonicalizer REJECTS a request that carries ANY
   client-supplied canonical/effect/risk/risk_class/target/approval_tier/
   canonical_effect_hash/scope field. The client schema accepts ONLY {tool,
   args}; anything else is a rejected request (not silently stripped —
   rejected, so a forging attempt is visible). Assert this.
4. The canonical effect is METADATA-ONLY: side_effect_summary and all
   fields carry NO raw payload/body/secret; the result passes the leaf
   sanitizer. (raw arg VALUES that are sensitive must not leak into the
   summary — summarize structurally, e.g. "create note at <path-shape>",
   not the note body.)

## NO — hard exclusions

- NO enqueue. NO writing a proposal to the queue. NO approval. NO
  execution. NO runtime.runTool. (24C-2 builds the enqueue via the GATE-5
  needle's eye + the FC-2 hash; 24C-2 is GATE-protected.) This slice
  PRODUCES a canonical_effect object and stops.
- Do NOT pull a mutator tree into the gateway import graph — GATE-2 must
  stay green. Read registry metadata via narrow projection / injected
  lookup ONLY.
- Do NOT let the client author any effect field (GATE-3).
- Do NOT modify the frozen Phase 18 lifecycle, the proposal contract
  schema's EXISTING fields, the pipeline spine, frozen tests, or 21B
  adapters. (Additive optional fields on the contract are allowed ONLY if
  needed to TYPE the canonical effect for later slices — but enqueue/use
  is 24C-2; prefer keeping the canonical_effect as a gateway-internal type
  this slice.)
- NO new exposed MCP method yet that submits proposals (that's 24C-2). If
  you wire a method, it may only DERIVE-AND-RETURN the canonical effect for
  testing, with NO enqueue — but prefer a pure canonicalizer function
  proven by unit tests this slice.

## INVARIANTS (assert as tests)

- I-24C1-1 (server-derived): given {tool, args} for a known tool, the
  canonical effect's risk_class/target/mutation_type/approval_tier match
  the REGISTRY, regardless of what the client might claim.
- I-24C1-2 (client cannot author effect / GATE-3): a request carrying a
  client-supplied risk/target/effect/hash field is REJECTED (not stripped);
  the client schema accepts only {tool, args}.
- I-24C1-3 (unknown/non-exposable rejected / EoP-13): an unknown tool id,
  or a tool not classified proposal-allowed/mcp-exposable, is REJECTED
  (default-deny).
- I-24C1-4 (arg validation): args not matching the tool's schema are
  REJECTED.
- I-24C1-5 (metadata-only): the canonical effect passes the leaf sanitizer;
  side_effect_summary carries no raw arg values/body/secret (structural
  summary only).
- I-24C1-6 (GATE-2 still green — STRUCTURAL): the transitive import
  allowlist holds WITH the canonicalizer added; the gateway reaches NO
  mutator tree (registry metadata via narrow projection / injected lookup).
  Negative control still bites.
- I-24C1-7 (no enqueue/execution): there is NO code path from the
  canonicalizer to enqueue, approval, or runtime.runTool (assert: no such
  import/call reachable; this slice only derives).

## VERIFY

typecheck 0; lint 0e/18w baseline; new + existing gateway tests + frozen
battery green; FULL SUITE count line via tee. Flake dead (E-013+E-015) —
normal commit; report rather than --no-verify on any timeout.

## COMMIT (standing authority — commit IFF all gates green)

Trailer check via git log -1 --format=full. Message:

feat(phase24c): FC-1 server-derived canonical effect (24C-1) — gateway
derives risk/target/mutation/tier/scope from the tool registry (never the
client), rejects client-supplied effect fields (GATE-3 begins) and
unknown/non-exposable tools (EoP-13), metadata-only, GATE-2 still green
via narrow registry projection. No enqueue/execution (24C-2).

Any failure/halt/ambiguity => STAGE ONLY and report. NEVER push.

REPORT: the tool-registry source found + how metadata is read without
breaking GATE-2; the canonical_effect fields + their registry sources; how
GATE-3 rejection works (rejected not stripped); the EoP-13 default-deny;
the seven invariant verdicts incl. GATE-2 result; confirmation no
enqueue/execution path exists; suite line; hash.
