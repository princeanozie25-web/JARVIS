# JARVIS — a governed, local-first AI Room OS

JARVIS is a personal AI operating layer for the room you work in: it can see,
hear, reason, and propose actions across your local environment — but it cannot
act on anything that matters without a human saying yes. It is built as a
**security-engineering thesis expressed as architecture**: every capability is
wrapped in a governance substrate first, and turned on second.

The guiding question is not "what can an AI assistant do?" but "**what should an
autonomous system never be allowed to do without permission, and how do you
enforce that structurally rather than hope for it?**"

---

## Security posture (the thesis)

Four properties hold across the whole system, by construction:

- **The Human Gate is the sole mutation path.** Anything that changes state —
  a file write, a project mutation, a room action, a runtime command — can only
  execute by resuming an approved proposal. There is exactly one code path that
  executes a tool, and it runs only after an explicit approval decision. No
  surface — not the dashboards, not the voice layer, not the pipeline views —
  can reach execution by any other route.
- **Fail-closed everywhere.** Every policy config defaults to deny. Missing,
  malformed, or unreadable policy resolves to the most restrictive
  interpretation, never a permissive one. Vision providers, camera capture,
  cloud calls, and source allowlists are all off until explicitly and verifiably
  enabled.
- **Unauditable actions are forbidden.** A silent state change is treated as a
  defect. Where the system fails over, degrades, or selects a path, it emits a
  metadata-only audit event — because an action no one can review is an action
  that should not happen.
- **Authorization before retrieval.** Consent is checked before data is fetched,
  not after. Standing consent is owner-controlled, revocable, and the system can
  never grant consent to itself.

Telemetry is **metadata-only by enforcement**: a three-gate sanitizer chain
(allowlist + forbidden-pattern + safety validation) strips raw frames,
transcripts, OCR text, audio, prompts, and secrets before anything reaches a
sink or a view-model. Perception is **hash-only**: captured frames are
identified by SHA-256, and raw pixels are forbidden by schema. Observations are
**advisory** — the system's "beliefs" never carry execution authority.

---

## The governance model

**The Human Gate.** Proposals are typed, risk-classified, expiring records with
forbidden raw-payload fields. They enter through a suggestion inbox that _cannot
finalize approvals_, surface to the operator, and execute only on an explicit
resume. Approve, deny, roll back — all are first-class, audited lifecycle states.

**Authority tiers.** Actions are graded by how much autonomy they may have:
read-only, standing-consent (pre-authorized low-risk), voice-initiates /
UI-finalizes, and manual-only (never voice-executable). The highest-risk classes
are structurally barred from autonomous and voice paths.

**Read-only surfaces.** The command-center dashboards and pipeline views are
inspection-only by type — no execute, approve, or mutate affordances exist on
them. The places you _watch_ the system are physically separate from the one
place you _authorize_ it.

---

## Core capabilities

- **Governed command center.** Operator cockpits for live status, the approval
  queue, and a calm/idle mode — each a read-only window onto governed state.
- **Approval lifecycle.** The full propose → review → approve/deny → execute →
  audit (→ roll back) loop, with a suggestion inbox that proposes but never
  finalizes.
- **Voice operating mode.** Local speech-to-text (faster-whisper) and
  text-to-speech with a real, proven fallback chain: a primary TTS server, then
  a registered secondary, then a local Piper terminal provider that synthesizes
  real audio when the others are unreachable. Every failover advance and final
  selection emits a metadata-only audit event — verified by a live kill-drill in
  which the primary was killed mid-run and the local fallback produced the full
  narration. Voice never grants execution authority on its own.
- **Vision & sensing pipeline.** Consent-gated media ingest (local files and, by
  allowlist, platform sources via yt-dlp/ffmpeg), hash-only frame sampling,
  confined transcription, and a strict multimodal analysis packet resolved to
  **local models only** by default. A real camera path exists but is
  consent-conditional, indicator-mandatory, single-shot, and off by default.
- **Pipeline visualization.** A byte-frozen six-stage spine
  (capture → classify → route → human gate → execute → audit) with data-driven,
  read-only lanes layered on top — so new sensing chains are shown without ever
  relaxing the core flow's forbidden edges (nothing reaches execute without the
  human gate).
- **Knowledge, council & agent suite.** A model registry with hardware-fit
  scoring and tiered routing, local-first model execution, a knowledge/notes
  integration with pull-only indexing, and governed extraction and narration
  tooling — all behind the same approval and redaction guarantees.

---

## Architecture principles

- **Local-first.** Inference, storage, and capture run on the user's machine;
  cloud is opt-in, consent-gated, budget-guarded, and never the default.
- **Single mutation path.** One executor, one gate. New capabilities plug into
  the existing approval lifecycle rather than opening new execution routes.
- **Additive, not destructive.** Frozen contracts (the pipeline spine, the
  telemetry event union, the redaction allowlists) are extended by adding
  literals, never by reordering or relaxing them — each change recorded in an
  enhancement registry before code.
- **Provable by test.** Governance invariants are enforced by tests —
  forbidden-affordance DOM scans, redaction forbidden-field loops, and per-area
  closeout suites — so the guarantees are checked on every run, not asserted in
  prose.

---

## What's present vs what's next

**Present (governed and proven).** The Human Gate and approval lifecycle; the
command center; the voice operating mode with a live-proven local TTS fallback
and metadata-only failover auditing; the consent-gated vision/sensing pipeline
with local-only analysis; the pipeline visualization; metadata-only telemetry
with a persistent local audit store. The governance substrate is the mature,
tested core.

**Next (honest roadmap).**

- **Productionization** — moving the proven pipelines from drill/fixture
  exercise onto continuous real data, and packaging for one-command setup.
- **Carrying the real voice fallback into the live runtime** — the real fallback
  and audit are proven in the narration chain; wiring them into every production
  voice turn (with server-side persisted audit) is the next step.
- **An MCP gateway** — exposing JARVIS's governed capabilities to other tools
  through the Model Context Protocol, behind the same gate.
- **A written threat model for the Gate** — adversarial analysis of the approval
  boundary itself: confused-deputy paths, consent replay, telemetry
  exfiltration, and capability escalation.
- **Hardware-dependent proofs** — e.g. the real camera path is unit-verified and
  awaits a machine with a camera for live capture proof.

The roadmap is stated honestly because the security posture depends on it: the
value is in what is _enforced today_, not in what is _promised_.

---

## Why this exists

I'm a cybersecurity student, and JARVIS is how I think about the problem that
matters most as AI systems gain autonomy: **the boundary between capability and
authority.** It is easy to build an assistant that can do things. The hard,
interesting, and security-relevant work is building one that _structurally
cannot_ do the wrong things — where "ask a human first," "never act
unauditably," and "fail closed" are properties of the architecture rather than
guidelines in a prompt. JARVIS is that argument, made in code.

---

## Tech stack

Next.js (App Router) · TypeScript (strict) · Zod for schema-enforced contracts ·
better-sqlite3 for the local audit/telemetry store · Vitest · local model
runtimes (Ollama, faster-whisper, Piper TTS) · yt-dlp / ffmpeg for media.

## Getting started

```bash
npm install
npm run dev      # the governed command center
npm test         # the full invariant + closeout suite
```

Local capabilities (models, voice runtimes, media tools) are optional and
documented under `docs/`. Everything ships off-by-default; you enable what you
want, and the system enforces the rest.

---

_Built by Prince Anozie — cybersecurity student. JARVIS is a study in governing
autonomous systems: capability earned through architecture, never assumed._
