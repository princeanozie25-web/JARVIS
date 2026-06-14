# MCP Gateway — Threat Model (v2)

- **Phase:** 24A (the load-bearing deliverable; code in 24B–24E demonstrates this holds)
- **Date:** 2026-06-14
- **Status:** **Threat-model COMPLETE. Security sign-off NOT GIVEN.** These are
  different claims and were conflated in v1. The document is complete and
  strong enough to gate 24B. The gateway is **not safe yet** — most foundational
  controls are AMBER-PLANNED (designed, not built, not drilled). Safety is
  earned at the 24E drill, not asserted here.
- **v2 correction:** v1 labelled unbuilt controls **GREEN**. That is the same
  aspirational-claim error the project doctrine forbids (a control is real when
  drilled, not when designed). v2 introduces an honest three-state taxonomy and
  relabels every unbuilt control AMBER-PLANNED.
- **Scope:** JARVIS exposed as a local (stdio) MCP server. External clients
  (Claude Code/Desktop, other local agents) may READ governed surfaces and
  PROPOSE into the approval queue. They may NEVER cross the Human Gate.
- **Method:** STRIDE. Each threat: attack → existing control → new control →
  status.

## Status taxonomy (the v2 correction)

- **GREEN** — control is BUILT and DRILLED, or is an existing frozen control
  already proven in Phases 1–23.
- **AMBER-PLANNED** — control is designed and assigned to a slice, but NOT yet
  built or drilled. The risk is **not closed**. Calling this GREEN tricks
  future-you into thinking it is.
- **RED** — no control assigned. Blocks the phase.
  A threat is only GREEN when its control has been exercised against a real
  attack. Design is necessary but not sufficient.

---

## The two foundational controls (everything depends on these — both AMBER until 24C/24E)

If either is weak, every other control is cosmetic. **Both are AMBER-PLANNED**
until built (24C) and drilled (24E).

### FC-1 — Server-derived canonical effect [AMBER-PLANNED]

The client submits **untrusted requested intent**, never truth. The server
canonicalizes the request against JARVIS's own tool registry and **derives**:
risk class, target, tool capability, mutation type, scope requirement,
approval tier, side-effect summary. The human approves the **server's
canonical proposal**, never the client's framing.

```
client request  {tool, args}            ← untrusted intent
   ↓
server canonicalizes against tool registry
   ↓
server-DERIVED canonical effect          ← the truth
   {capability, mutation_type, target, risk_class, approval_tier,
    scope_required, side_effect_summary}
   ↓
server freezes canonical proposal (FC-2)
   ↓
human approves the frozen canonical proposal only
```

A client claiming `risk: low` is ignored; risk is computed from what the tool
_actually does_. **Drill (24E):** submit a proposal claiming low risk for a
high-risk tool; assert the server-derived effect shows the true high risk.

### FC-2 — Hash-frozen canonical proposal + approval-time re-validation [AMBER-PLANNED]

```
canonical proposal = {
  proposal_id, client_id (from token, FC-3),
  canonical_effect_json,        ← server-derived (FC-1)
  canonical_effect_hash,        ← server-computed hash; a CLIENT-supplied hash is rejected
  scope_snapshot,               ← client's scope AT proposal time
  created_at_ms, expires_at_ms
}
```

- Human approves a **specific hash**. Executor runs **only** that hash.
- **At approval time** (not just submission) the gate re-checks: not expired,
  client still active, scope still valid, tool still allowed, target still
  allowed, hash unchanged. Any failure → approval invalid, proposal re-created.
- **GATE-1 (blocks 24B close):** FC-2 is intended as an ADDITIVE wrapper around
  the frozen Phase 18 lifecycle — the hash + re-validation gate the existing
  `resumeApproval`, adding NO lifecycle state. **24B's FIRST task is to PROVE
  this wraps cleanly. If it cannot wrap without a new lifecycle state, 24B
  STOPS** — that reopens Phase 18 and becomes an Enhancement-Registry
  architecture decision, not a casual continuation. No assuming.

---

## Identity (FC-3) — bound from token, never request body [AMBER-PLANNED]

`client_id` is derived **server-side** from a token-hash lookup. The request
body's `client_id` is ignored/rejected. A client can never choose its identity.
(Underpins attribution and scope.) AMBER until built (24D) + drilled (24E).

### Token lifecycle (operational discipline — without this, tokens become long-lived local root to the queue)

- **Storage:** token **hashes** stored outside the repo and outside committed
  config (e.g. a gitignored local secrets store); the plaintext token exists
  only at the client. The repo NEVER contains a token or token hash.
- **Creation:** tokens are **human-provisioned** — JARVIS never issues one to
  itself or to a client on request.
- **Revocation:** a per-client revocation flag; a revoked token is rejected at
  connection AND re-checked at approval time (FC-2 re-validation).
- **Last-used:** tracked per token (for suspicious-volume / staleness).
- **Never logged:** tokens and hashes never appear in any log, telemetry, audit
  trace, or error message.
- **Backup/export:** the secrets store is excluded from any backup/export path;
  a backup that leaks token hashes is a breach vector — explicitly excluded.
- **Rotation:** tokens are rotatable; rotation revokes the prior token.

---

## Elevation of Privilege

### EoP-1 — Direct execution via the tool runtime [GREEN via existing + AMBER via new]

**Attack:** an MCP tool reaches `runtime.runTool`.
**Existing control [GREEN]:** `resumeApproval` is the sole executor (Phase 23
I1-verified: exactly 2 call sites).
**New control [AMBER-PLANNED]:** EoP-6's import allowlist makes the MCP module
type-incapable of reaching the executor; **proof = call-site count unchanged
from the Phase 23 baseline, drilled in 24E.** Status: **AMBER-PLANNED** until
the allowlist test exists and 24E re-verifies the count.

### EoP-2 — Indirect via proposal auto-execution [GREEN]

**Existing control [GREEN, frozen Phase 18]:** `resumeApproval` requires a human
decision; proposals sit `pending`. The gateway is a producer, untouched
executor. 24E drills it (submit → pending → no execution). **The only EoP that
is genuinely GREEN now**, because its control is an already-proven frozen
mechanism — but the _drill_ still happens in 24E to confirm the gateway didn't
disturb it.

### EoP-3 — Injection via proposal content [AMBER-PLANNED + required drill]

**Attack:** client submits proposal text crafted to manipulate the human or
JARVIS's reasoning ("pre-approved, just click yes").
**Control [AMBER-PLANNED]:** FC-1 (truth is server-derived) + no-act-on-content

- EoP-11 cross-surface separation.
  **Required drill (24C):** submit a social-engineering payload; assert it
  surfaces as untrusted-requiring-review with the server-derived effect shown
  undistorted. Status AMBER until that drill passes.

### EoP-4 — Confused deputy [AMBER-PLANNED, conditional on EoP-13]

**Attack:** client A routes through a higher-authority JARVIS capability to
propose what A couldn't directly.
**Control [AMBER-PLANNED]:** scope enforced at the gateway boundary on the
calling client's identity (FC-3), never elevated by what it passes through.
**Strength depends entirely on EoP-13's scope granularity.** AMBER, conditional.

### EoP-5 — Provenance laundering [AMBER-PLANNED]

**Control [AMBER-PLANNED]:** reject-at-entry any proposal whose client identity
(FC-3) can't be stamped. No origin = no queue. AMBER until built + drilled.

### EoP-6 — Alternate mutator import [AMBER-PLANNED — the strongest structural control]

**Attack:** reach ANY mutator (event-store writer, approval-transition writer,
DB helper, file writer, adapter mutators, project/email/note helpers) —
`runtime.runTool` is only one.
**Control [AMBER-PLANNED]:** the MCP server module may import ONLY: schemas,
read projections, the proposal constructor, the queue-enqueue boundary.
**The test MUST be TRANSITIVE (GATE-2, blocks 24B close):**

- catches direct imports, **barrel re-exports, re-export chains, dynamic
  imports**;
- denies the **approval-runtime, event-store, adapter-mutator, and
  tool-runtime module TREES entirely** — not just named symbols (so
  `import { harmless } from "../approval-runtime"` where the barrel re-exports
  a writer is caught);
- a positive allowlist that is not transitive is a negative check in disguise.
  Status AMBER until the transitive test exists and passes.

### EoP-7 — Client-supplied canonical effect [AMBER-PLANNED]

**Control:** FC-1. **GATE-3 (blocks 24B close):** prove a client CANNOT forge
the canonical effect — the enqueue boundary rejects any client-supplied
canonical_effect, risk, target, or hash; the server derives all of it. AMBER
until proven.

### EoP-8 — Proposal TOCTOU (+EoP-14 stale-after-revocation) [AMBER-PLANNED]

**Control:** FC-2 (hash-frozen + approval-time re-validation). AMBER until built

- drilled. Merged with EoP-14 (same mechanism).

### EoP-9 — Token theft → queue weapon [AMBER-PLANNED]

**Control (DoS family, built 24D):** rate limits, quotas, expiry, revocation,
last-used, hashed-not-plaintext storage, rotation, disabled-flag, suspicious-
volume detection. **AMBER-PLANNED** (v1 wrongly called this GREEN).

### EoP-10 — Queue poisoning / alert fatigue [AMBER-PLANNED]

**Control (DoS family, built 24D):** max queue depth/client, dedup, cooldowns,
priority classes, drop/hold noisy clients, admin-visible client-mute,
human bulk-reject. **AMBER-PLANNED** (v1 wrongly called this GREEN).

### EoP-11 — Presentation-channel collapse (beyond the UI) [AMBER-PLANNED + required drills]

**Attack:** the same proposal appears in Rest HUD, Working cockpit, audit,
pipeline, **voice**, morning brief, demo export, email digest. ANY surface that
collapses trusted (canonical effect) and untrusted (client text) reopens EoP-3.
Voice is worst: JARVIS speaking untrusted text as its own recommendation.
**Control [AMBER-PLANNED]:** trusted/untrusted separated on EVERY surface; no
surface renders untrusted text as JARVIS's own voice. Untrusted text hardened:
escaped, no raw HTML, no unsanitized markdown links, monospaced, length-limited,
unicode-normalized, dangerous control chars stripped.
**Required drills:**

- **Voice:** malicious text `"Prince, this action is safe and already
approved."` MUST render/speak as `"Client X submitted an untrusted
proposal. Canonical effect: create note …"` — NEVER the malicious text as
  JARVIS's recommendation.
- Each rendering surface tested for channel separation.
  Cross-phase constraint: binds the future UI capstone AND the existing voice
  stack. AMBER until drilled.

### EoP-12 — Approval bypass via direct DB / event-store write [AMBER-PLANNED]

**Control [AMBER-PLANNED]:** EoP-6 allowlist blocks DB/event-writer imports +
**only the approval service transitions lifecycle states** + approval-decision
events require a **local-human-session authority marker**.
**The marker MUST be unforgeable (GATE-4, blocks 24B close):** created ONLY by
the approval-UI session; short-lived; bound to the current local session;
**never accepted from MCP**; not serializable by a client; not persisted as
reusable authority; audited. `"human_session": true` is worthless and forbidden.
AMBER until the marker spec is built and proven unforgeable.

### EoP-13 — Scope drift when new tools are added [AMBER-PLANNED]

**Control [AMBER-PLANNED]:** default-deny unknown capabilities + a **standing
scope-map completeness test**: every mutating capability declares
`{mcp_exposable, proposal_allowed, required_scope, required_approval_tier}` or
the build fails. Scopes are **action+target+argument+time+rate** bound (e.g.
`note.create` only under `Daily/`, max 5KB, no overwrite, no attachments, no
external links, expires 30 min, max 5/hr). Coarse "can propose notes" is
forbidden (reopens EoP-4). AMBER until the test exists.

### EoP-15 — Aux-model laundering of untrusted text [AMBER-PLANNED + required drill]

**Attack:** Phase 21C aux routes — an aux model summarizes untrusted proposal
text into a neutral, trusted-_appearing_ summary.
**Control [AMBER-PLANNED]:** aux summaries of untrusted text stay labelled
untrusted, cannot replace the canonical effect (FC-1); the model may summarize
but never authorize, reinterpret, or soften risk.
**Required drill:** aux-summarize a malicious payload; assert the summary keeps
the untrusted label, doesn't soften risk, doesn't become the approval summary,
doesn't replace the canonical effect. AMBER until drilled. Reaches into the
already-built 21C subsystem.

---

## Information Disclosure — the exposure matrix

**Read-only is NOT automatically safe.** A read leaks the _data_ AND the _shape_
of the data. A client polling an innocuous "status" endpoint builds a
surveillance feed without reading a payload. Three questions per surface:

1. Exposed at all? Default **NEVER-EXPOSED** (fail-closed).
2. Payload redaction.
3. **Shape leakage** — what the structure reveals.

### ID-0 — Default

A surface not in this matrix is NEVER-EXPOSED. New readable surfaces default
NEVER-EXPOSED and **fail the build if unclassified** (completeness test, like
EoP-13). [AMBER-PLANNED until the test exists.]

### The matrix

| Surface                                               | Class                       | Rationale                                                                                                 |
| ----------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pipeline view-model (**static topology only**)        | EXPOSED-READONLY            | Structural, identical for every user, no per-session data — IF static (ID-4).                             |
| Approval-queue **status** (counts/states only)        | EXPOSED-READONLY (redacted) | ID-1 redaction.                                                                                           |
| Approval-queue **bodies**                             | NEVER-EXPOSED               | Leaks owner activity + cross-client.                                                                      |
| Telemetry / event store                               | NEVER-EXPOSED               | Behavioral feed.                                                                                          |
| Vision artifacts / frames / transcripts               | NEVER-EXPOSED               | Phase 23 forbidden-field classes.                                                                         |
| Memory / knowledge / council                          | NEVER-EXPOSED               | Richest target.                                                                                           |
| Voice config / consent / allowlists                   | NEVER-EXPOSED               | Authority map.                                                                                            |
| Audit traces / governance internals                   | NEVER-EXPOSED               | Exposes the lock design.                                                                                  |
| Adapter state (gmail/drive/calendar/job-scout)        | NEVER-EXPOSED               | Surveillance crown jewels.                                                                                |
| Config / runtime / model registry                     | NEVER-EXPOSED               | Aids targeted attack.                                                                                     |
| **Connection log** (client id, timestamps, last-used) | NEVER-EXPOSED               | Behavioral feed about the owner's tooling usage — classified explicitly so it isn't an unlisted readable. |

### ID-1 — Queue-status redaction [AMBER-PLANNED]

Returns ONLY: a pending count (integer) + coarse state count. NOTHING else.
WITHHELD by name: proposal bodies/targets, project names, note paths, email
domains, calendar, job applications, which clients are active (cross-client =
breach), per-proposal timestamps, risk classes/tiers.

### ID-2 — Per-client read scope [AMBER-PLANNED]

Read scope per-client (FC-3), fail-closed (EoP-13). read-pipeline ≠
read-status. **No cross-client visibility, ever.**

### ID-3 — Shape/polling-surveillance control [AMBER-PLANNED — hardened from v1's "accepted residual"]

v1 accepted the count-timing leak too casually. Hardened controls:

- **Minimum polling interval / coarse update cadence:** `pending_count` updates
  **at most every 30 s** (not on every change).
- **Coarse buckets** (e.g. none / few / many) rather than an exact live integer,
  optionally.
- **Optional jitter** on the cadence; **optional stale-cache window**.
- Per-client **read rate-limits** (DoS family).
  This turns "watch the owner's work rhythm in near-real-time" into "a coarse
  number that updates slowly." It also defeats the **correlation attack**
  (count-delta × connected-client = deanonymizing) by breaking the timing
  resolution. Residual after hardening: a slow coarse count — bounded, documented,
  not a feed.

### ID-4 — Pipeline view-model static-only [AMBER-PLANNED]

The pipeline view-model exposes **static topology ONLY**. Any live pipeline
state — provider status, current route, recent failures, active clients,
pending phase, model health, cost, latency — requires SEPARATE classification
and is NEVER-EXPOSED by default. **24B recon verifies the view-model is truly
static, not just structurally static.**

### ID-5 — Uniform denial responses (error-channel side channel) [AMBER-PLANNED]

Denial responses are **uniform and uninformative**: "request denied", never
"scope insufficient for queue-status" (which leaks that queue-status exists) or
"no such surface" vs "forbidden" (which enumerates the surface map). The error
text must not let an attacker map the surfaces or scopes by probing. AMBER until
built + a probing drill confirms uniform denials.

---

## Remaining STRIDE — consolidation

### Spoofing [AMBER-PLANNED]

FC-3 (identity from token-hash) + token outside repo (hashed) + **explicit
client allowlist** (token not on allowlist rejected) + **reject anonymous stdio
sessions**.

### Tampering [AMBER-PLANNED]

FC-2 (hash-frozen; executor runs only approved hash; approval-time
re-validation).

### Repudiation [AMBER-PLANNED]

EoP-5 (reject no-origin) + **every connection audited** (client id, timestamp,
token-last-used — never the token itself). Proposal AND connection attributable.

### Denial of Service [AMBER-PLANNED]

EoP-9/EoP-10 (proposal flood) + ID-3 (read flood). Built 24D.

### Stdio-local-≠-trusted [AMBER-PLANNED]

A local malicious process can still connect. **Explicit client allowlist**,
**reject anonymous stdio sessions**, **audit every connection**, **token stored
outside repo**. Local-only narrows network surface; it does NOT confer trust.

---

## 24A overall status

- **Threat-model: COMPLETE.** Every threat enumerated, every surface classified,
  every control assigned. No RED.
- **Security sign-off: NOT GIVEN.** Under the honest taxonomy, the foundational
  controls (FC-1, FC-2, FC-3) and nearly all EoP/ID controls are
  **AMBER-PLANNED** — designed, not built, not drilled. Exactly one control is
  genuinely GREEN (EoP-2's frozen-Phase-18 auto-execution block), and even it is
  re-drilled in 24E.
  **24A closes as threat-model-complete and gates 24B. The gateway is NOT safe
  until 24E drills every AMBER to GREEN.**

### The five 24B close-gates (24B cannot freeze until ALL are proven)

- **GATE-1:** FC-2 wraps the frozen Phase 18 lifecycle additively (no new
  state). **If it cannot, 24B STOPS** → Enhancement-Registry decision.
- **GATE-2:** the import allowlist is **transitive** (catches barrels,
  re-exports, dynamic imports; denies mutator module trees entirely).
- **GATE-3:** the canonical proposal cannot be **client-forged** (enqueue
  boundary rejects client-supplied effect/risk/target/hash/status/approval/
  metadata).
- **GATE-4:** the human-session authority marker is **unforgeable** (UI-session-
  only, short-lived, session-bound, never from MCP, non-serializable,
  non-persisted, audited).
- **GATE-5 (the enqueue boundary is a needle's eye):** the queue-enqueue
  boundary — the one write-adjacent capability the allowlist permits — accepts
  ONLY a server-canonicalized proposal and rejects client canonical_effect,
  client hash, body client_id, status fields, approval fields, and arbitrary
  metadata. Otherwise the enqueue boundary becomes the new mutator.

### Required drills before any AMBER → GREEN (24E + slice drills)

- FC-1: low-risk-claim-on-high-risk-tool → true risk shown.
- FC-2: change between review and approval → approval invalidated.
- EoP-3: social-engineering payload → untrusted-requiring-review.
- EoP-6: attempted mutator import (incl. transitive) → test fails the build.
- EoP-11 voice: malicious text → spoken as untrusted proposal, never as
  recommendation.
- EoP-15 aux: malicious text summarized → label preserved, risk not softened.
- ID-5: probe denials → uniform, no surface/scope enumeration.
- The core proof: `runtime.runTool` call-site count unchanged from Phase 23.

### Cross-phase constraints this threat model imposes

- **EoP-11 binds the future UI capstone** (no trusted/untrusted channel
  collapse) **and the existing voice stack** (never speak untrusted text as
  JARVIS's own).
- **EoP-15 binds 21C aux routing.**
- **EoP-13 + ID-0 impose standing completeness tests** (new mutating capability
  → non-exposable by default; new readable surface → NEVER-EXPOSED by default;
  build fails if unclassified).
