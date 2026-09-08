# JARVIS Parked State — 2026-09-08

## Why development is parked

Active development of this monolithic implementation is parked, not abandoned. Much of the
infrastructure JARVIS built or planned overlaps with mature open source, in particular
**OpenBot** (https://github.com/CopilotKit/OpenBot) and **Hermes Agent**
(https://github.com/NousResearch/hermes-agent). Future work uses ADOPT → ADAPT → CLIP → INTEGRATE:
only what makes JARVIS _unique_ stays ours to build.

**Future work must first compare OpenBot and Hermes against JARVIS before implementing equivalent
functionality again.** That comparison has not been made yet. Nothing in this repository has been
migrated, and neither upstream has been modified.

## Current branch and commit

- Remote: `https://github.com/princeanozie25-web/JARVIS.git`
- Working branch at freeze: `phase-25/opener`, also fast-forwarded to `main`
- Last feature commit: `8794f29` (E-059, the Apple+Grok presence)
- Astra's parked Program U work: branch `astra/program-u-parked-u5-wip` (`a7f6747`), pushed. It was
  a stash on main; it is now a real branch so it survives deletion of this working tree.
- Freeze commit: the commit that adds this document.

## What is operational

Verified live on this Mac, not from fixtures:

- **Presence UI** (`src/components/presence`, `app/page.tsx`): the single screen. Sidebar with
  threads that reopen and continue, thread with a heterogeneous transcript, inline "needs you" card,
  activity panel, standing brief at rest (`app/api/presence/brief`). System font, system light/dark.
- **Chat with tools** over SSE (`app/api/chat`, `src/lib/chat`, `src/lib/tools`), against local
  Ollama. `runtime.runTool` has exactly two production call sites; that invariant held to the end.
- **Operator decision path** (`src/lib/approvals`): process-local operator token store, view-bound
  single-use decision tokens, decisions entering the frozen `resumeApproval` through a server action.
- **Self Model** (`src/lib/self-model`, 10 source files, 7 read-only `self.*` tools): evidence-backed
  introspection with trust classes, TTL freshness decay and a leak guard. Proven at ~153 claims.
- **Voice**: parakeet-mlx STT and kokoro TTS through a managed mlx-audio server; hold-to-talk,
  spoken replies, interruption. openWakeWord wake loop proven on a real mic (E-049).
- **Packaged macOS app** (`scripts/package/build-mac.ts`, `src-tauri`): Tauri shell + bundled Node
  sidecar on 127.0.0.1:3117, data under `~/Library/Application Support/dev.princeanozie.jarvis`,
  managed Python voice sidecar, loopback `/api/health`. Installed at
  `~/Applications/JARVIS Command Center.app`, 177 MB, cold launch and voice round-trip proven.
- **Memory, projects, event store, telemetry, doctor** (`src/lib/{memory,projects,telemetry}`,
  `src/store`).
- **MCP gateway read-server** (`src/lib/mcp-gateway`, 15 source files): two read exposures, frozen.

## What is foundation-only

Real code and real tests, but never wired to a running loop or a live device:

- **Routines** (`src/lib/routines`, 31 source files): registry, trust classes, kill switch, run
  leases, eligibility, a `foreground-scheduler` and tick sources. Nothing schedules JARVIS's own
  work in the shipped app; the presence brief has no scheduled items to report because no scheduler
  runs.
- **Morning brief** (`src/lib/morning-brief`, 13 files): contract, sections, governance, composer.
  Not connected to a scheduler or to the presence.
- **Room / spatial** (`tests/room`, Phase 16): adapters and conformance fixtures only. No device,
  no live room.
- **Observability panels** (`src/lib/observability/panels`): registries and types kept alive after
  the cockpit was retired; no UI consumes them.
- **Council** (`src/lib/council`, 3 files plus audit consumers): contracts, not a live deliberation.

## What remains experimental

`src/lib/{video-extraction,vision,vision-runtime,demo-director,workflowbox,red-team-sandbox,
architecture-graph,final-hardening,portfolio-readiness}`. Camera capture is unit-verified but was
never proven on real hardware (23F-CAMERA-PROOF, pending-hardware).

## Current UI state

One screen (the presence) plus `/api`. The Phase 12–21 cockpit was deleted in E-058 (~18k lines,
45 UI tests). The presence was redrawn twice: E-057 (editorial, serif, brass — rejected) and E-059
(Apple + Grok: iMessage shape, system font, monochrome, no mascot, rest page is a standing brief
built from real state). Design authority: `docs/design/PRESENCE_THESIS.md`. The only design skills
are the VibeCurb set under `.claude/skills/`.

## Self Model state

Complete and coherent at its strongest point. Claims carry status and trust class with a fixed
precedence (current_verified_runtime > recent_verified_test > config_registry > architecture_docs >
roadmap), stale claims decay to unknown, and a redaction guard throws on forbidden keys or
secret-shaped values. Seven `self.*` tools are read-only and are exposed to the chat model.
Tests: `tests/self-model/{self-model,tools}.test.ts`. Nothing is half-finished here.

## Capabilities likely to survive future clipping

| Capability                                                                                                                                                                           | Reality in this repo                                                                                                                                                                                                                                      | Class                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Self Model (evidence-backed introspection, trust classes, leak guard)                                                                                                                | Implemented, tested, live                                                                                                                                                                                                                                 | **LIKELY KEEP**                                                                       |
| JARVIS identity / singular presence (one relationship, one screen, standing brief)                                                                                                   | Implemented                                                                                                                                                                                                                                               | **LIKELY KEEP**                                                                       |
| T0–T3 voice authority + standing consent                                                                                                                                             | Implemented, enforced on the live path                                                                                                                                                                                                                    | **LIKELY KEEP**                                                                       |
| Human decision model ("needs you", single-use view-bound tokens, fail-closed)                                                                                                        | Implemented                                                                                                                                                                                                                                               | **LIKELY ADAPT** (OpenBot has its own gateway/boundaries)                             |
| Evidence / provenance discipline                                                                                                                                                     | 40 source files touch it                                                                                                                                                                                                                                  | **LIKELY ADAPT**                                                                      |
| Memory + promotion discipline                                                                                                                                                        | `memory`, `memory-candidates`, `working-memory` implemented; the "promotion firewall" name exists only in planning                                                                                                                                        | **LIKELY ADAPT**                                                                      |
| Voice stack (local STT/TTS, wake word, failover chain)                                                                                                                               | Implemented and proven                                                                                                                                                                                                                                    | **LIKELY ADAPT** (Hermes has voice/provider plumbing)                                 |
| Routines / scheduled assistance                                                                                                                                                      | Foundation only                                                                                                                                                                                                                                           | **LIKELY REPLACE** (Hermes cron)                                                      |
| Action gateway semantics                                                                                                                                                             | One source file; the concept lives in docs                                                                                                                                                                                                                | **LIKELY REPLACE** (OpenBot gateway)                                                  |
| Tool runtime, MCP, delegation, messaging gateway                                                                                                                                     | Ours is narrow; both upstreams are broader                                                                                                                                                                                                                | **LIKELY REPLACE**                                                                    |
| Packaging / desktop shell                                                                                                                                                            | Works, but OpenBot ships Docker + desktop                                                                                                                                                                                                                 | **LIKELY REPLACE**                                                                    |
| Council semantics                                                                                                                                                                    | Contracts only                                                                                                                                                                                                                                            | **UNDECIDED**                                                                         |
| Shadow, Savepoint / reversible execution, Intent Contract, verified outcome model, world/spatial model, node identity, privacy canaries, affective qualification, gauntlet contracts | **Not implemented.** Grep finds these only in planning documents (savepoint 0 source files, intent contract 0, promotion firewall 0, canary 0, world model 0, node identity 0, affective 0). `rollbacks` (1 file) is the nearest real thing to Savepoint. | **UNDECIDED** — decide whether they are worth building at all, and on which substrate |

## Important architectural invariants

- `runtime.runTool` has exactly two production call sites. Repo guards grep source for the literal
  text; never write it in prose or a comment.
- Approvals fail closed. A pending row whose operator token did not survive a restart can only
  expire; tokens are never re-mintable.
- Loopback only. Presence and health routes refuse non-local hosts and cross-site fetches.
- The Self Model never emits secrets: forbidden keys and secret-shaped values throw.
- Frozen phases (1–24) are not edited without a registry row.
- Every change is a registry row in `docs/enhancements/REGISTRY.md` (E-001 … E-059).
- Commits are trailer-free on this project. `--no-verify` is never used; the pre-commit hook runs
  eslint and the full vitest suite against the working tree.

## Governance that must survive

The vocabulary stays off the screen, but the mechanism matters: one interruption with a plain
question, decisions bound to the view that raised them, single use, fail closed, and an audited
record of what was decided. Any substrate that replaces this must preserve those four properties.

## Shadow / Savepoint status

Neither exists in code. Shadow appears only in design-token and design-language files (naming, not a
subsystem). Savepoint has no implementation; `src/lib/rollbacks` (1 file) and the file-undo tool are
the only reversibility present.

## Voice status

Operational and local-first: parakeet-mlx STT, kokoro TTS (voice `bm_lewis`, "Lewis") over a managed
mlx-audio server, openWakeWord `hey_jarvis` proven on a real mic with the phantom re-wake fixed,
failover chain drilled and audited. Cloud voices (ElevenLabs, OpenAI Realtime) remain a deliberate
opt-in and were never made the default; OpenAI live trials halt at a missing credential.

## Memory status

Operational for notes, recall, projects and sessions, with the event store behind it. The larger
"promotion firewall" design was never built.

## Spatial status

Not real. Phase 16 room work is fixtures, adapters and conformance tests. No device integration.

## Current tests

At the freeze commit, the pre-commit hook ran the full suite green:
**609 files, 5,565 passed, 9 skipped** (the skips are Windows real-spawn variants, off-platform by
design). `git diff --check` is clean. Lint is clean apart from 18 pre-existing unused-symbol
warnings.

## Known defects

- The packaged app's brief reported "My voice is patchy right now" on a cold start, because the
  managed voice sidecar is still warming when the first health probe runs. Cosmetic, self-resolving.
- Camera capture has never been proven on hardware (23F).
- `E-009` remains PROPOSED; Phase 25B items #11–#13 (propose-over-stdio) are deferred with their own
  threat model; 25F and 25H never started.
- Program U (the UI capstone) is void; its parked working tree lives on
  `astra/program-u-parked-u5-wip`.

## Future substrate strategy

ADOPT what exists (OpenBot's channels, gateway, computers, audit; Hermes's runtime, tools, skills,
memory substrate, cron, messaging gateway, delegation, model routing) → ADAPT what nearly fits →
CLIP only the unique JARVIS layer (identity/presence, Self Model, authority model, evidence
discipline) → INTEGRATE. A candidate shape, explicitly a hypothesis and not a decision:
OpenBot experience on top, JARVIS identity layer in the middle, Hermes runtime underneath.

## Resume instructions

```sh
git clone https://github.com/princeanozie25-web/JARVIS.git
cd JARVIS
git checkout phase-25/opener        # or main; both point at the freeze
nvm use 24 && npm install
cp .env.example .env.local          # local secrets are NOT in the repo
npx vitest run                      # full suite
npm run dev                         # or: npx tsx scripts/package/build-mac.ts --install
```

Local state that was **not** in Git and is gone with the working tree: `data/` (the SQLite database
and event store), `.env.local`, `.venv` and `.venv-mlx`, `dist/`, `.next/`, `src-tauri/target`.
The packaged app keeps its own data under `~/Library/Application Support/dev.princeanozie.jarvis`,
which was not deleted. Voice requires re-creating the MLX virtualenv from
`runtimes/requirements-mlx.txt` (see `docs/runbooks/macos-bringup.md`).

Read `docs/enhancements/REGISTRY.md` before touching anything: every change since Phase 20 is a row
there, and the freeze is E-059.
