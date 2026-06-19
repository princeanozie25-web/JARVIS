# JARVIS — A Governed, Local-First AI Room OS

JARVIS is a personal AI operating layer for the room you work in: it can see,
hear, reason, and **propose** actions across your local environment — but it
cannot act on anything that matters without a human saying yes. The Human Gate is
the **only** mutation path: every AI action is either a read or a human-approved
proposal, and nothing executes unaudited.

It is built as a **security-engineering thesis expressed as architecture**. The
guiding question is not "what can an AI assistant do?" but:

> **Can a local-first AI system be made provably non-bypassable by its own
> governance layer — even when exposed to external agents over an open
> protocol?**

That question is answered the only way a security claim should be — by a written
**threat model** and an adversarial **drill**, not by assertion. See
[What is verified](#what-is-verified-and-how).

---

## The core invariant

- **The Human Gate is the sole mutation path.** Anything that changes state — a
  file write, a project mutation, a room action, a runtime command — can only
  execute by resuming an approved proposal. There are exactly **2** production
  execution call sites in the codebase
  ([`src/lib/chat/tool-approvals.ts`](src/lib/chat/tool-approvals.ts),
  [`src/lib/chat/tool-continuation.ts`](src/lib/chat/tool-continuation.ts)), both
  behind the approval lifecycle. That count is enforced as a **canary**: a
  non-bypass drill asserts it is unchanged with the entire MCP gateway built, so
  any new surface that opens an execution path fails the suite.
- **Fail-closed everywhere.** Every policy config defaults to deny. Missing,
  malformed, or unreadable policy resolves to the most restrictive
  interpretation, never a permissive one. Vision providers, camera capture, cloud
  calls, and source allowlists are off until explicitly and verifiably enabled.
- **Unauditable actions are forbidden.** A silent state change is treated as a
  defect. Where the system fails over, degrades, or selects a path, it emits a
  metadata-only audit event.
- **Agents propose; humans decide.** A suggestion inbox can surface proposals but
  _cannot finalize approvals_. The place you watch the system is physically
  separate from the one place you authorize it.

Telemetry is **metadata-only by enforcement** (an allowlist + forbidden-pattern +
safety-validation chain strips raw frames, transcripts, OCR text, audio, prompts,
and secrets before anything reaches a sink or view-model). Perception is
**hash-only** — captured frames are identified by SHA-256; raw pixels are
forbidden by schema. Observations are **advisory**: the system's "beliefs" never
carry execution authority.

---

## What is verified (and how)

Claims here are scoped to what is proven by **test or drill**. Items that are
designed but not yet drilled are named, not implied (see
[Honest status](#honest-status-what-is-not-claimed)).

**Test suite.** **644 test files / 5,741 tests pass** via `npm test` (Vitest).
There is no CI service and therefore **no badge to fabricate**: the suite runs
locally and in the **pre-commit hook** (single-worker), which must pass before any
commit lands. The governance invariants are enforced _as tests_ —
forbidden-affordance DOM scans, redaction forbidden-field loops, the
execution-call-site canary, and per-area closeout suites — so the guarantees are
checked on every run, not asserted in prose.

### The MCP Gateway — the security capstone (frozen, zero open residuals)

JARVIS can be exposed as a **local (stdio) MCP server**: external clients (e.g.
Claude Code/Desktop, other local agents) may **read** two governed surfaces and
**propose** into the approval queue. They may **never cross the Human Gate**. The
gateway was threat-modelled, built, and then driven against a real adversary
before being frozen on 2026-06-17.

- **STRIDE threat model with an honest status taxonomy.** A control is **GREEN**
  only when it has been **built and drilled** — never green-by-assertion.
  **AMBER-PLANNED** means designed-and-assigned but _not yet drilled_ (the risk is
  not closed); **RED** means no control (blocks the phase). The taxonomy exists
  specifically so that "designed" is never mistaken for "proven."
  → [`docs/security/MCP_GATEWAY_THREAT_MODEL.md`](docs/security/MCP_GATEWAY_THREAT_MODEL.md)
- **The non-bypass drill.** An external client attempts every elevation path —
  unauthorized reads, forged proposals and hashes, injection-framed proposal text,
  identity spoofing, scope escape, queue flooding, and denial-probing — and each
  **fails closed** (DRILL-1..12).
  → [`tests/mcp-gateway/phase-24e-nonbypass-drill.test.ts`](tests/mcp-gateway/phase-24e-nonbypass-drill.test.ts)
- **The core proof.** With the whole gateway built, the `runtime.runTool`
  call-site count is **still exactly 2**, both in the frozen `chat/` tree, none in
  the gateway. The gateway added **zero** mutation paths (DRILL-12).
- **Server-derived truth (FC-1).** A client submits only `{tool, args}` —
  untrusted intent, never truth. The server canonicalizes the request against its
  own tool registry and **derives** the effect (capability, mutation type, target,
  risk class, approval tier, scope). A client claiming `risk: low` for a high-risk
  tool is ignored; the human approves the **server's** canonical proposal.
- **Hash-frozen proposals + decision-time re-validation (FC-2).** The human
  approves a specific hash; the executor runs **only** that hash. At **approval
  time** (not just submission) the gate re-checks expiry, client liveness, scope,
  tool/target allowance, and hash integrity — closing the TOCTOU window before
  execution.
- **Identity and abuse controls.** `client_id` is bound server-side from a
  token-hash (FC-3); the request body cannot choose an identity. Tokens are
  **human-provisioned, hashed, stored outside the repo, never logged, revocable,
  and rotatable**. Scope is per-client and fine-grained (action + target +
  argument + time + rate). Rate limits, quotas, queue-depth caps, and uniform
  denial responses were built and drilled before freeze.
  → [`docs/security/MCP_GATEWAY_ARCHITECTURE.md`](docs/security/MCP_GATEWAY_ARCHITECTURE.md)
  · [`docs/security/PHASE24_CLOSEOUT.md`](docs/security/PHASE24_CLOSEOUT.md)

**Voice fallback (drilled).** Local speech-to-text (faster-whisper) and a TTS
fallback chain — a primary server, a registered secondary, then a local Piper
terminal provider — were proven by a **live kill-drill**: the primary was killed
mid-run and the local fallback produced the full narration, with every failover
advance and final selection emitting a metadata-only audit event. Voice never
grants execution authority on its own.

---

## Architecture (at a glance)

- **Local-first.** Inference, storage, and capture run on the user's machine;
  cloud is opt-in, consent-gated, budget-guarded, and never the default. A model
  registry scores hardware-fit and routes across tiers, defaulting to local
  models.
- **One executor, one gate.** New capabilities plug into the existing approval
  lifecycle rather than opening new execution routes. The personal-scale project
  model (**WorkflowBox** — a SQLite-backed project graph rendered as a draggable
  lane + mind-map) is display-and-user-tracked only; its AI-execution path is a
  reserved type seam that, when built, would route through the same Human Gate —
  it adds **zero** execution paths today (the canary held when it landed).
- **Auditable by construction.** Read surfaces (command-center cockpits, pipeline
  views) carry structural no-mutation contracts — no execute/approve/mutate
  affordances exist on them. A byte-frozen six-stage spine
  (capture → classify → route → human gate → execute → audit) keeps the forbidden
  edges intact as new sensing chains are layered on as read-only lanes.
- **Additive, not destructive.** Frozen contracts (the pipeline spine, the
  telemetry event union, the redaction allowlists, the schema migration list) are
  extended by adding literals — never reordered or relaxed — with each change
  recorded in an enhancement registry before code.

**Run it:**

```bash
npm install
npm run dev      # the governed command center
npm test         # the full invariant + closeout suite (Vitest)
```

Stack: Next.js (App Router) · TypeScript (strict) · Zod for schema-enforced
contracts · better-sqlite3 for the local audit/telemetry store · Vitest · local
model runtimes (Ollama, faster-whisper, Piper TTS) · yt-dlp / ffmpeg for media.
Local capabilities are optional and **off by default** — you enable what you
want, and the system enforces the rest.

---

## Honest status (what is NOT claimed)

The **governed architecture** is the most complete tier, and the **MCP gateway is
frozen and drilled** with zero open residuals. What is _not_ claimed:

- **Not productionized.** Several pipelines run on synthetic / fixture values **by
  design** — they exercise the fail-closed boundaries pending a real-data audit.
  One-command packaging and an always-on voice runtime are future work.
- **Two named, honestly-tracked carry-overs** (both _outside_ the frozen gateway,
  neither relied on by any drilled gateway control):
  - The **human-session authority marker** (would defend the approval **UI's** own
    decision emission) is a design item for the approval-UI layer; the gateway has
    no path to emit an approval-decision event, so it is **not built and not
    claimed as built**.
  - The **presentation-channel separation** (trusted canonical effect vs untrusted
    client text) is GREEN in the voice and data layers; the future **visual** UI
    must honor the encoded render-hardening requirement — a tracked cross-phase
    constraint, not a closed control.
- **Hardware-dependent proofs** remain unit-verified pending real hardware (e.g.
  the camera path is consent-conditional, indicator-mandatory, and off by default;
  live-capture proof awaits a machine with a camera).

Residuals are tracked, not hidden, and a control is marked GREEN only when
drilled. → [`docs/enhancements/REGISTRY.md`](docs/enhancements/REGISTRY.md)

---

## Broader portfolio (context)

- **Enterprise Brain** — permission-aware organizational intelligence where
  **authorization happens before retrieval**: the model never receives context the
  asking identity isn't entitled to. It is the org-scale expression of the same
  thesis (authority enforced structurally, not by prompt) and is at the
  **architecture stage** — designed, not yet built.

---

JARVIS is a final-year computer-science / cyber-security project. Its argument is
a single one: **authority and accountability should be one auditable event** — an
action is allowed because a human approved a specific, server-derived, hash-frozen
proposal, and the approval and the action are the same recorded fact. The security
claims here are **demonstrated, not asserted**: capability earned through
architecture, never assumed.

_Built by Prince Anozie._
