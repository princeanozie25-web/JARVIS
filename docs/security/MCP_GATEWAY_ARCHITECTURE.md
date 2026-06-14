# MCP Gateway — Architecture

- **Phase:** 24A (companion to MCP_GATEWAY_THREAT_MODEL.md v2)
- **Date:** 2026-06-14
- **Status:** Architecture COMPLETE (gates 24B). This is the _boundary design_ —
  the threat model is the _threat analysis_. Read them together.
- **The rule:** No MCP-originated request reaches `runtime.runTool` except
  through `resumeApproval` after a human decision. Every control below serves
  this. If a design weakens it, kill the design, not the rule.

---

## 1. The shape of the boundary

```
  EXTERNAL (untrusted)              │  THE BOUNDARY  │      JARVIS (governed)
                                    │                │
  MCP client (Claude Code/Desktop)  │                │
    │                               │                │
    │ 1. authenticate (token) ──────┼──> FC-3 ───────┼──> client_id (server-derived)
    │                               │   allowlist    │     reject if not allowlisted
    │                               │                │
    │ 2a. READ request ─────────────┼──> exposure ───┼──> read projection ONLY
    │     (pipeline / status)       │    matrix +    │     (sanitizer chain, redacted)
    │                               │    read-scope  │     NEVER a payload, NEVER cross-client
    │                               │                │
    │ 2b. PROPOSE request ──────────┼──> enqueue ────┼──> server canonicalizes (FC-1)
    │     {tool, args}              │    needle's    │     → hash-freeze (FC-2)
    │     (untrusted intent)        │    eye (GATE-5) │     → provenance-stamp (EoP-5)
    │                               │                │     → ENQUEUE to approval queue
    │                               │                │           │
    │                               │                │           ▼
    │                               │                │     [ pending — awaits HUMAN ]
    │                               │                │           │
    │                               │                │   human reviews CANONICAL effect
    │                               │                │   (not client framing — FC-1)
    │                               │                │   approves a specific HASH (FC-2)
    │                               │                │           │
    │                               │                │   re-validate at approval time
    │                               │                │   (expiry/scope/hash — FC-2)
    │                               │                │           │
    │                               │                │           ▼
    │                               │                │     resumeApproval → runtime.runTool
    │                               │                │     (THE single mutation path — frozen)
```

**The MCP server is a PRODUCER of proposals and a READER of projections. It is
never an executor.** It cannot reach `runtime.runTool`, any mutator, or the
approval-decision path (EoP-6 transitive import allowlist + EoP-12 human-session
marker). The human is the only thing that moves a proposal from `pending` to
executed — unchanged from frozen Phase 18.

---

## 2. The proposal-over-MCP contract

### What the client sends (untrusted intent)

```
{
  tool: string,        // a tool identifier the server will validate against its registry
  args: object         // arguments the server will validate against the tool's schema
}
```

That is ALL the client controls. Explicitly NOT accepted from the client
(GATE-5 — the enqueue needle's eye rejects each):

- `canonical_effect` / `effect` — server-derived only (FC-1)
- `risk` / `risk_class` — server-derived only
- `target` — server-derived only
- `canonical_effect_hash` — server-computed only
- `client_id` — server-derived from token (FC-3)
- `status` / any approval/lifecycle field — never client-settable
- arbitrary `metadata` — rejected

### What the server produces (the canonical proposal)

```
canonical_proposal {
  proposal_id,
  client_id,                  // from token (FC-3)
  canonical_effect_json {     // DERIVED from the tool registry (FC-1)
    capability, mutation_type, target, risk_class,
    approval_tier, scope_required, side_effect_summary
  },
  canonical_effect_hash,      // server hash of canonical_effect_json (FC-2)
  scope_snapshot,             // client's scope at proposal time
  created_at_ms, expires_at_ms
}
```

This reuses the **frozen Phase 18 proposal contract**
(`ApprovalProposalContractSchema`). The gateway is a new _producer_ of that
contract — NOT a new proposal _kind_ (unless the exposure matrix later demands
one, via the Enhancement Registry) and NOT a new executor.

### The flow

1. Client authenticates (FC-3) → `client_id`, allowlist-checked.
2. Client sends `{tool, args}` (intent).
3. Server validates `tool` against its registry; rejects unknown/non-exposable
   (EoP-13 default-deny).
4. Server validates `args` against the tool's schema and the client's
   fine-grained scope (action+target+argument+time+rate — EoP-13).
5. Server **derives** `canonical_effect` from the registry (FC-1).
6. Server **hash-freezes** the canonical proposal (FC-2).
7. Server **stamps provenance** (`client_id`) — rejects if it can't (EoP-5).
8. Server **enqueues** to the existing approval queue (GATE-5 needle's eye).
9. Proposal sits `pending`. Human reviews the **canonical effect** (FC-1), sees
   any client free-text in a separate untrusted channel (EoP-11), approves a
   **specific hash** (FC-2).
10. At approval, the gate **re-validates** (expiry, scope-still-valid,
    client-still-active, hash-unchanged — FC-2). Pass → `resumeApproval` → the
    frozen single mutation path. Fail → approval invalid, re-create.

---

## 3. Identity & scope model

- **Authentication:** human-provisioned per-client token. `client_id` derived
  server-side from token-hash (FC-3); request-body `client_id` rejected. Token
  lifecycle per the threat model (hashed, outside repo, never logged,
  revocable, rotatable, backup-excluded).
- **Allowlist:** a token not on the explicit client allowlist is rejected even
  if structurally valid (stdio-local-≠-trusted).
- **Scope (fail-closed, per-client):**
  - **Read scope** — which slice of the EXPOSED-READONLY matrix this client may
    read. Absent = denied. No cross-client visibility ever (ID-2).
  - **Propose scope** — which capabilities, under which targets, with which
    argument constraints, time-bound, rate-bound (EoP-13). Coarse "can propose"
    is forbidden (reopens EoP-4 confused-deputy).
  - **Default-deny:** any capability/surface not explicitly scoped is denied;
    new capabilities/surfaces default non-exposable and fail the completeness
    test if unclassified (EoP-13 + ID-0).

---

## 4. Build obligations (the five close-gates — 24B cannot freeze until proven)

These are the threat model's GATE-1..5, restated as concrete build
requirements. Each must be **proven** (test/drill), not assumed.
| Gate | Obligation | Proven by |
|---|---|---|
| GATE-1 | FC-2 wraps frozen Phase 18 lifecycle additively (no new state). **If it cannot, 24B STOPS** → Enhancement-Registry decision. | 24B recon (FIRST task) — read the Phase 18 contract, prove the hash+revalidation gate `resumeApproval` without adding a lifecycle state. |
| GATE-2 | Import allowlist is **transitive** — catches direct/barrel/re-export/dynamic imports; denies approval-runtime, event-store, adapter-mutator, tool-runtime module trees entirely. | A transitive import test that fails the build on any disallowed reachable import. |
| GATE-3 | Canonical proposal cannot be **client-forged**. | Test: every client-supplied effect/risk/target/hash/status/approval/metadata field is rejected; server derives all. |
| GATE-4 | Human-session authority marker is **unforgeable**. | Spec + test: marker is UI-session-created, short-lived, session-bound, never accepted from MCP, non-serializable, non-persisted, audited. A forged/absent marker is rejected. |
| GATE-5 | Enqueue boundary is a **needle's eye**. | Test: the boundary accepts only a fully server-canonicalized proposal and rejects every client-authored canonical/hash/id/status/approval/metadata field. |

---

## 5. The non-bypass proof obligation (discharged at 24E)

The acceptance test for the _entire phase_. A real external MCP client, against
a running JARVIS, attempts each elevation path; each fails closed. **The phase
does not freeze until all pass.**

1. Read a NEVER-EXPOSED surface → denied (uniform error, ID-5).
2. Submit a proposal → queues, does NOT execute, awaits human (EoP-2).
3. Submit injection-framed proposal text → queues as untrusted-requiring-review,
   true effect shown, NOT auto-handled (EoP-3 drill).
4. Submit a proposal with no traceable origin → rejected (EoP-5).
5. Connect unauthenticated / off-allowlist → denied (FC-3, spoofing).
6. Out-of-scope read or propose → denied (ID-2, EoP-13).
7. Forge canonical effect / hash → rejected (GATE-3, GATE-5).
8. Forge approval-decision event / human-session marker → rejected (GATE-4,
   EoP-12).
9. Attempt a disallowed import (incl. transitive) → build fails (GATE-2).
10. Flood the queue / poll reads at high frequency → rate-limited/capped
    (EoP-9/10, ID-3).
11. Probe denials to map surfaces → uniform, no enumeration (ID-5).
12. **The core proof:** `runtime.runTool` call-site count is **UNCHANGED from
    the Phase 23 frozen baseline** — the gateway added ZERO mutation paths.
    Plus: re-verify I1–I5 (frozen) still hold; every AMBER → GREEN with its drill
    evidenced; every threat-model RED (none currently) GREEN.

---

## 6. Slice plan (restated, single agent throughout)

```
24A  threat model + this architecture doc          ← COMPLETE (gates 24B)
 └─ 24B  GATE-1 recon FIRST (may STOP the phase),
         then read-only server (exposure matrix, EoP-6 transitive allowlist,
         ID-4 static view-model, ID-5 uniform denials)
     └─ 24C  proposal-over-MCP (FC-1 canonicalization, FC-2 hash-freeze,
             GATE-3/GATE-5 enqueue needle's eye, EoP-3/EoP-11/EoP-15 drills)
         └─ 24D  identity + scope (FC-3, token lifecycle, EoP-13 completeness,
                 DoS family EoP-9/10, ID-3 read limits)
             └─ 24E  non-bypass drill (§5) + freeze (every AMBER → GREEN)
```

**No parallel slices. Single agent, no subagents, no Agent-tool fan-out — every
slice. This phase is entirely boundary work; there is no read-only fan-out that
is safe when the whole phase is the Gate.**

## 7. Out of scope

JARVIS _consuming_ external MCP servers (separate). Network transport (stdio
only; HTTP/SSE is a later decision behind a heavier threat model). New mutation
capability. The WorkflowBox surface (separate JARVIS slice). Enterprise Brain.
Productionization (Phase 25, July+).
