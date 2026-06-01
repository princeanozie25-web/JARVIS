# JARVIS

A governed, local-first AI operating environment. Built in phases. Architecture-first.

![Tests](https://img.shields.io/badge/tests-4200%2B%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## What This Is

JARVIS is a personal AI operating environment with governance, memory, tools, voice, project intelligence, environment state, vision contracts, scheduled assistance, approval-gated execution contracts, read-only observability, and architecture visibility built into one TypeScript runtime.

It is not a chatbot wrapper, not a LangChain demo, and not a prompt-in-response-out project. The core idea is governance first: every capability is routed through safety, approval, privacy, telemetry, redaction, cost, and authority boundaries before it can matter.

## Current Status

| Built / Frozen / In Progress                                    | Deliberately Not Enabled                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Governance architecture                                         | Cloud wake word or pre-wake audio buffering/storage                            |
| Runtime governance                                              | Always-listening or background capture                                         |
| Safety enforcement                                              | Autonomous execution                                                           |
| Tool orchestration contracts                                    | Background camera                                                              |
| Persistent memory architecture                                  | Auto-approval of any action                                                    |
| Project continuity and registry layers                          | T2/T3 voice-only approval                                                      |
| Voice orchestration and streaming boundaries                    | Unapproved device actions                                                      |
| STT/TTS provider contracts and queues                           | Cloud providers by default                                                     |
| Runtime command governance                                      | Remote/public dashboard                                                        |
| Environmental/smart-room scaffolding                            | Graph-driven execution                                                         |
| Vision layer contracts                                          | Architecture graph UI                                                          |
| Scheduled self-audit contracts                                  | React Flow/D3 graph rendering                                                  |
| Observability Command Center contracts                          | Runtime dependency observers                                                   |
| Phase 18 Approval Runtime foundation                            | Source import parsing for graph                                                |
| Phase 19 architecture graph contracts and static registry       | Database/telemetry-backed graph ingestion                                      |
| Phase 20 final integration, hardening, packaging, and readiness | Packaging/install automation, authority expansion, or expansion-era completion |

The disabled list is not a gap. It is the architecture. Governance first, capability second. Expansion Era voice work may add local-only wake/conversation mode and tiered voice authority, but cloud wake word, pre-wake audio storage, auto-approval, destructive voice approval, public dashboards, and unapproved device actions remain forbidden.

## Phase Status

JARVIS has moved beyond the original nine-phase governance substrate into the operationalization roadmap described in [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md).

Completed or contract-frozen highlights:

- Phases 1-9: governance, providers, streaming, memory, project continuity, runtime safety, terminal governance, voice scaffolding, and Command Center contracts.
- Phases 10-17: Room OS substrate, local persistence/event-store contracts, Command Center realization contracts, model runtime, voice runtime, vision runtime, room adapter runtime, and scheduled assistance runtime foundations.
- Phase 18: Approval-Gated Execution Layer. This is metadata-only and frozen as the governed lifecycle foundation: proposal, review, decision record, inert authority token metadata, execution plan metadata, verification metadata, compensation metadata, and integrated lifecycle closeout. It proves there is no unapproved execution path.
- Phase 19 architecture graph foundation and static registry: typed, read-only graph contracts for nodes, edges, layers, health, discrepancies, governance boundaries, validation, designed subsystem relationships, and inert forbidden/tripwire edges.
- Phase 20 — Final Integration, Hardening, Packaging & Readiness. This is one public phase made up of implementation slices, not separate public phases. It closes the roadmap with typed, deterministic, metadata-only readiness contracts, audits, reports, and closeout declarations.
  - Final system status registry, final readiness report, final disabled-feature matrix, final authority surface inventory, final governance readiness summary, and final readiness closeout.
  - Bootstrap readiness contract, doctor check registry, doctor result contract, doctor dry-run evaluator, doctor report generator, safe local doctor runtime, doctor CLI adapter, and bootstrap readiness closeout.
  - Onboarding readiness contract, onboarding step registry, onboarding progress model, onboarding report generator, move-in readiness checklist, and onboarding readiness closeout.
  - Portfolio readiness contract, recruiter narrative registry, demo surface registry, demo flow registry, portfolio report generator, and portfolio readiness closeout.
  - Cross-phase audit contract, evidence registry, result model, evaluator, governance audit, disabled-feature audit, authority-surface audit, audit report, and audit closeout.
  - Final hardening contract, failure mode registry, hardening result model, hardening evaluator, recovery/fallback audit, authority regression audit, governance integrity audit, demo/portfolio readiness audit, system completion audit, and final hardening closeout.
  - Final documentation readiness, onboarding/runbook readiness, documentation closeout, final project readiness audit, master roadmap closeout report, and final project declaration.
  - All Phase 20 slices preserve read-only, metadata-only, deterministic boundaries unless explicitly documented as the safe local doctor runtime/CLI adapter; they do not create new authority surfaces, bypass approvals, enable disabled features, expose raw/source material, or add expansion-era capabilities.

## Architecture

The full architecture is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), with the operationalization roadmap in [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md).

Key decisions:

- Governance-before-capability doctrine: safety gates are substrate, not decoration.
- Approval lifecycle as the only path to side effects.
- No graph-driven execution: replay, dependency, architecture, and governance graphs are read-only viewers.
- Mock-first / provider-later pattern: providers and devices prove contracts before real integrations land.
- Adapter-first hardware strategy: real devices plug into governed adapter slots, not shortcuts.
- Read-only observability: Command Center and architecture graph surfaces can inspect, replay, and explain, but cannot mutate.
- Local-first by default, with cloud routes explicitly opt-in, budget-gated, consent-gated, and audited.
- Redaction-first telemetry/UI: raw frames, transcripts, prompts, model outputs, project bodies, memory contents, and secrets remain forbidden from observability surfaces.
- Expansion Era voice authority is tier-bound: T0 read-only voice actions may run without approval, T1 low-risk reversible actions require standing consent, T2 may be initiated by voice but needs UI confirmation, and T3 remains manual-only.
- Wake/conversation mode is planned as local-only: no cloud wake word, no pre-wake audio buffering or storage, timeout-based conversation sessions, and explicit sleep commands.

## Tech Stack

| Layer                    | Choice                             | Why                                                                                                                                                                              |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                 | Next.js 16 + React 19 + TypeScript | Current app runtime and UI layer, with strict typed contracts across client and server.                                                                                          |
| Styling                  | Tailwind CSS 4                     | Current styling layer for fast UI iteration without a separate component framework.                                                                                              |
| Testing                  | Vitest                             | Current test runner for colocated unit, boundary, contract, and closeout tests.                                                                                                  |
| Providers                | OpenAI SDK + Anthropic SDK         | Cloud provider wrappers behind a shared provider interface, disabled unless explicitly routed.                                                                                   |
| Database                 | SQLite via `better-sqlite3`        | Local persistence foundation and operationalization store substrate.                                                                                                             |
| Validation               | Zod                                | Runtime contract schemas for governance, graph, approval, runtime, voice, vision, and project metadata.                                                                          |
| Desktop shell            | Tauri                              | Planned/contracted local desktop packaging with loopback-only exposure and OS permissions under governance.                                                                      |
| Voice operationalization | Local STT/TTS stack                | Current voice remains local-first. Expansion Era target: Chatterbox-TTS-Server as primary local TTS, Kokoro/Piper as local fallbacks, and cloud STT/TTS only as opt-in fallback. |
| Local models             | Ollama                             | Planned local model runtime behind the existing registry/router pattern.                                                                                                         |
| Architecture graph UI    | React Flow or D3 later             | Deferred. Current Phase 19 graph work is contracts and static registry only.                                                                                                     |

## Project Structure

```text
jarvis/
  app/                         Next.js App Router and API route surfaces
  src/
    components/                React panels for approvals, voice, memory, projects, review queues
    lib/
      approval-runtime/        Phase 18 approval lifecycle metadata contracts and closeout guards
      architecture-graph/      Phase 19 read-only architecture graph contracts and static registry
      bootstrap-readiness/     Phase 20 bootstrap prerequisite, doctor, report, runtime, and closeout metadata
      final-system-status/     Phase 20 status, readiness, disabled-feature, authority, governance, and closeout metadata
      onboarding-readiness/    Phase 20 onboarding and move-in readiness metadata
      portfolio-readiness/     Phase 20 portfolio and demo readiness metadata
      command-center/          Rest / Working / Audit contracts, replay, governance, demo mode
      voice-streaming/         Push-to-talk orchestration, barge-in, privacy, cloud routing guards
      stt/ and tts/            Local voice provider contracts, disabled providers, queues, safety policy
      tools/                   Tool registry, read/write guards, approvals, local path safety
      runtime-commands/        Approval-gated terminal/runtime command lifecycle
      memory/                  Vault, retrieval, vectors, embeddings, surfaced telemetry
      projects/                Project registry, marker extraction, context assembly, closeout guard
      environment/             Device registry, trust classes, action planning, execution contracts
      vision/                  Session, OCR/object-detection contracts, failure replay, privacy manifest
      routines/                Scheduled self-audit, suggestions, kill switch, closeout guards
      db/                      SQLite schema and data access modules
      router/                  Intent, safety, capability, enforcement, selection
      telemetry/               Runtime telemetry types and sinks
  docs/                        Architecture and operationalization plans
  prompts/                     Versioned system prompts
  scripts/                     Eval and audit utility scripts
  models/                      Model/provider assets and registry-adjacent files
  next.config.ts               Next.js config
  vitest.config.ts             Vitest config
  package.json                 Scripts, dependencies, lint-staged config
```

## Phase 18 Approval Runtime

Phase 18 is complete and frozen as a metadata-only approval lifecycle foundation. It defines the intended future path to side effects without creating approvals, granting authority, executing tools, verifying state, compensating, rolling back, persisting, or wiring runtime behavior.

The lifecycle model is:

```text
Proposal
-> Review
-> Decision Record
-> Authority Token Metadata
-> Execution Plan Metadata
-> Verification Metadata
-> Compensation Metadata
-> Audit Preview Metadata
```

The final closeout proves Phase 18 remains approval-gated, metadata-safe, replay-safe, redaction-safe, non-authoritative, non-executing, non-dispatching, non-persistent, and has no unapproved execution path.

## Phase 19 Architecture Graph

Phase 19 adds the Fortress architecture-visibility layer as read-only metadata.

Implemented so far:

- `src/lib/architecture-graph/contracts.ts`: graph/node/edge/layer/kind/health/activity/discrepancy/governance-boundary schemas and metadata-only validation.
- `src/lib/architecture-graph/fixtures.ts`: deterministic sample graph fixture.
- `src/lib/architecture-graph/static-registry.ts`: deterministic static registry for completed JARVIS subsystems and designed dependency edges.
- `src/lib/architecture-graph/index.ts`: safe exports for read-only graph contracts and registry helpers.

The static registry includes Phase 10 through Phase 19 nodes, core runtime/module nodes, designed dependency edges, and forbidden/tripwire edges such as "Voice Runtime must not approve actions" and "Architecture Graph must not execute traces." These are metadata tripwires only, not executable behavior.

Deferred:

- No UI.
- No React Flow or D3.
- No source import parsing.
- No filesystem reads.
- No database reads.
- No telemetry ingestion.
- No runtime observers.
- No graph-driven execution.

## Phase 20 — Final Integration, Hardening, Packaging & Readiness

Phase 20 is one unified public phase. Internally it was delivered as implementation slices, but those slice labels are not separate product phases. The goal was to make the completed JARVIS OS reproducible, auditable, demo-ready, move-in-ready, and safe to hand off without adding new runtime authority.

Completed Phase 20 implementation slices include:

- Final system status registry
- Final readiness report
- Final disabled-feature matrix
- Final authority surface inventory
- Final governance readiness summary
- Final readiness closeout
- Bootstrap readiness contract
- Doctor check registry
- Doctor result contract
- Doctor dry-run evaluator
- Doctor report generator
- Safe local doctor runtime and CLI adapter
- Bootstrap readiness closeout
- Onboarding readiness contract, step registry, progress model, report generator, move-in checklist, and onboarding closeout
- Portfolio readiness contract, recruiter narrative registry, demo surface registry, demo flow registry, portfolio report, and portfolio closeout
- Cross-phase audit contract, evidence registry, result model, evaluator, governance audit, disabled-feature audit, authority-surface audit, audit report, and audit closeout
- Final hardening contract, failure mode registry, hardening result model, evaluator, recovery/fallback audit, authority regression audit, governance integrity audit, demo/portfolio audit, system completion audit, and hardening closeout
- Final documentation readiness, onboarding/runbook readiness, documentation closeout, final project readiness audit, master roadmap closeout report, and final project declaration

Phase 20 preserves the architecture boundaries: read-only where required, metadata-only where required, deterministic reports, local-first posture, approval-gated execution, redaction-aware evidence, no approval bypass, no new authority surface, no raw/source-material exposure, and no disabled capability quietly becoming active.

The only bounded runtime added in Phase 20 is the safe local doctor path, which checks local readiness through constrained adapters and never installs, auto-fixes, calls providers, calls the network, executes Ollama/Tauri/voice/vision runtimes, or performs room/device actions.

Expansion-era work remains future-only: Obsidian integration, Graphify overlay, LLM Council, HITNEXUS integration, LLM Wiki, future research systems, and real CAI execution enablement are not shipped capabilities.

## Expansion Era Direction

The Expansion Era is the post-Phase-20 execution era. It turns frozen scaffolds into real integrations without reopening the Phase 1-20 governance substrate.

Planned voice changes are no longer described as outside the roadmap forever. The intended voice overhaul keeps voice local-first: local-only wake word, no pre-wake audio buffering or storage, conversation mode with timeout, and explicit sleep commands such as "Jarvis sleep" or "Goodnight Jarvis." Cloud wake word remains forbidden.

Voice authority moves to a T0-T3 model:

- T0: read-only voice actions need no approval.
- T1: low-risk reversible actions may be voice-authorised with standing consent.
- T2: voice may initiate the proposal, but UI confirmation finalises it.
- T3: manual-only actions cannot be approved by voice.

Still forbidden: T2/T3 voice-only approval, destructive voice approval, governance changes by voice, self-elevating trust classes, auto-approval, public/remote dashboards, unapproved device actions, cloud wake word, pre-wake audio storage, and raw audio/transcript telemetry.

## Getting Started

Prerequisites: Node.js 20+ and pnpm. The repo currently also includes an npm lockfile, so npm equivalents work.

```bash
git clone https://github.com/princeanozie25-web/JARVIS.git
cd JARVIS
pnpm install
pnpm dev
pnpm test
pnpm lint
```

Open `http://localhost:3000` for the current local app surface. There is no standalone `demo` script yet; demo/recruiter mode exists as tested Command Center contracts and view models.

## Testing

Current posture: 4,200+ passing tests, TypeScript strict, lint passing, and closeout guards across governance, voice, runtime, project intelligence, environment, vision, scheduled assistance, approval lifecycle, architecture graph, final hardening, final documentation, and final project declaration contracts.

```bash
pnpm test
pnpm lint
npx tsc --noEmit
```

Useful targeted commands:

```bash
npm test -- final-system-status
npm test -- --run architecture-graph
npm test -- src/lib/approval-runtime
```

Every phase has closeout gates before it is frozen. A feature is not considered done until its tests prove both what works and what must remain disabled.

## For Recruiters / Non-Technical Readers

JARVIS demonstrates architecture-before-features discipline. The builder put safety gates, approval flows, privacy boundaries, telemetry rules, redaction, replay safety, and cost controls in place before chasing impressive demos.

The disabled list matters because most AI projects add features as fast as possible. JARVIS deliberately keeps autonomous execution, background capture, auto-approval, graph-driven execution, public dashboards, unapproved device control, raw telemetry, and destructive voice approval out of the shipped system. Expansion Era voice work is planned, but only through local-only wake/conversation mode and the T0-T3 authority model.

Most student AI projects are prompt in, response out, call it a day. JARVIS has a governance layer, approval lifecycle, cost guards, redaction pipeline, read-only observability, adapter contracts, project continuity, voice boundaries, an architecture graph foundation, and thousands of tests. What separates a good CV from a great one is the discipline behind the code, not the feature count.

The Phase 19 architecture work makes the architecture itself visible. The graph contracts and static registry show how subsystems are designed to relate, where governance gates sit, and which connections are forbidden, without giving the graph any power to execute.

## Related Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - full architecture and delivery roadmap.
- [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md) - Phases 10-20 operationalization plan.

## Author Note

Built by Prince Anozie, MMU final-year Computer Science / Cybersecurity student.
