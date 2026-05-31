# JARVIS

A governed, local-first AI operating environment. Built in phases. Architecture-first.

![Tests](https://img.shields.io/badge/tests-3500%2B%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## What This Is

JARVIS is a personal AI operating environment with governance, memory, tools, voice, project intelligence, environment state, vision contracts, scheduled assistance, approval-gated execution contracts, read-only observability, and architecture visibility built into one TypeScript runtime.

It is not a chatbot wrapper, not a LangChain demo, and not a prompt-in-response-out project. The core idea is governance first: every capability is routed through safety, approval, privacy, telemetry, redaction, cost, and authority boundaries before it can matter.

## Current Status

| Built / Frozen / In Progress                               | Deliberately Not Enabled                     |
| ---------------------------------------------------------- | -------------------------------------------- |
| Governance architecture                                    | Wake word                                    |
| Runtime governance                                         | Always-listening                             |
| Safety enforcement                                         | Autonomous execution                         |
| Tool orchestration contracts                               | Background camera                            |
| Persistent memory architecture                             | Auto-approval of any action                  |
| Project continuity and registry layers                     | Voice-only approval                          |
| Voice orchestration and streaming boundaries               | Unapproved device actions                    |
| STT/TTS provider contracts and queues                      | Cloud providers by default                   |
| Runtime command governance                                 | Remote/public dashboard                      |
| Environmental/smart-room scaffolding                       | Graph-driven execution                       |
| Vision layer contracts                                     | Architecture graph UI                        |
| Scheduled self-audit contracts                             | React Flow/D3 graph rendering                |
| Observability Command Center contracts                     | Runtime dependency observers                 |
| Phase 18 Approval Runtime foundation                       | Source import parsing for graph              |
| Phase 19A architecture graph contracts and static registry | Database/telemetry-backed graph ingestion    |
| Phase 20A.1 final system status registry                   | Phase 20 packaging automation                |
| Phase 20A.2 final readiness report generator               | Runtime final-readiness generation           |
| Phase 20A.3 final disabled-feature matrix                  | Enabling disabled features from prior phases |
| Phase 20A.4 final authority surface inventory              | Reclassifying or enabling authority surfaces |

The disabled list is not a gap. It is the architecture. Governance first, capability second.

## Phase Status

JARVIS has moved beyond the original nine-phase governance substrate into the operationalization roadmap described in [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md).

Completed or contract-frozen highlights:

- Phases 1-9: governance, providers, streaming, memory, project continuity, runtime safety, terminal governance, voice scaffolding, and Command Center contracts.
- Phases 10-17: Room OS substrate, local persistence/event-store contracts, Command Center realization contracts, model runtime, voice runtime, vision runtime, room adapter runtime, and scheduled assistance runtime foundations.
- Phase 18: Approval-Gated Execution Layer. This is metadata-only and frozen as the governed lifecycle foundation: proposal, review, decision record, inert authority token metadata, execution plan metadata, verification metadata, compensation metadata, and integrated lifecycle closeout. It proves there is no unapproved execution path.
- Phase 19A.1: Architecture Graph Foundation. Typed, read-only graph contracts for nodes, edges, layers, health, discrepancies, governance boundaries, and validation.
- Phase 19A.2: Static Architecture Graph Registry. Deterministic registry describing the designed JARVIS subsystem graph and inert forbidden/tripwire edges.
- Phase 20A.1: Final System Status Registry. Typed, read-only Phase 20 integration registry summarizing Phase 10-19 operational status, evidence, authority posture, disabled-feature posture, and packaging relevance without adding routes, provider calls, execution hooks, or authority.
- Phase 20A.2: Final Readiness Report Generator. Deterministic metadata-only report builder over the final-system-status registry, summarizing readiness, phase coverage, authority surfaces, disabled features, packaging, move-in, portfolio/demo relevance, and final governance posture.
- Phase 20A.3: Final Disabled-Feature Matrix. Static, typed, metadata-only matrix consolidating intentionally disabled risky surfaces across Phases 10-19 and Phase 20 hardening, including wake word, hidden capture, auto-approval, graph-driven execution, unapproved device actions, scheduler side effects, and ungoverned provider escalation.
- Phase 20A.4: Final Authority Surface Inventory. Static, typed, metadata-only inventory of authority-bearing and authority-adjacent surfaces across Phases 10-19, including model/runtime/provider, voice, vision, room adapter, scheduler, approval, tool, UI, graph, telemetry, governance, red-team, persistence, project, and memory surfaces.

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

## Tech Stack

| Layer                    | Choice                             | Why                                                                                                         |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Frontend                 | Next.js 16 + React 19 + TypeScript | Current app runtime and UI layer, with strict typed contracts across client and server.                     |
| Styling                  | Tailwind CSS 4                     | Current styling layer for fast UI iteration without a separate component framework.                         |
| Testing                  | Vitest                             | Current test runner for colocated unit, boundary, contract, and closeout tests.                             |
| Providers                | OpenAI SDK + Anthropic SDK         | Cloud provider wrappers behind a shared provider interface, disabled unless explicitly routed.              |
| Database                 | SQLite via `better-sqlite3`        | Local persistence foundation and operationalization store substrate.                                        |
| Validation               | Zod                                | Runtime contract schemas for governance, graph, approval, runtime, voice, vision, and project metadata.     |
| Desktop shell            | Tauri                              | Planned/contracted local desktop packaging with loopback-only exposure and OS permissions under governance. |
| Voice operationalization | `whisper.cpp` for STT, Piper TTS   | Planned offline push-to-talk voice without wake word or cloud audio by default.                             |
| Local models             | Ollama                             | Planned local model runtime behind the existing registry/router pattern.                                    |
| Architecture graph UI    | React Flow or D3 later             | Deferred. Current Phase 19A slices are contracts and static registry only.                                  |

## Project Structure

```text
jarvis/
  app/                         Next.js App Router and API route surfaces
  src/
    components/                React panels for approvals, voice, memory, projects, review queues
    lib/
      approval-runtime/        Phase 18 approval lifecycle metadata contracts and closeout guards
      architecture-graph/      Phase 19A read-only architecture graph contracts and static registry
      final-system-status/     Phase 20A metadata-only status, readiness, disabled-feature, and authority inventories
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

## Phase 19A Architecture Graph

Phase 19A begins the Fortress Upgrades with read-only architecture visibility.

Implemented so far:

- `src/lib/architecture-graph/contracts.ts`: graph/node/edge/layer/kind/health/activity/discrepancy/governance-boundary schemas and metadata-only validation.
- `src/lib/architecture-graph/fixtures.ts`: deterministic Phase 19A.1 sample graph fixture.
- `src/lib/architecture-graph/static-registry.ts`: deterministic static registry for completed JARVIS subsystems and designed dependency edges.
- `src/lib/architecture-graph/index.ts`: safe exports for read-only graph contracts and registry helpers.

The static registry includes Phase 10 through Phase 19A nodes, core runtime/module nodes, designed dependency edges, and forbidden/tripwire edges such as "Voice Runtime must not approve actions" and "Architecture Graph must not execute traces." These are metadata tripwires only, not executable behavior.

Deferred:

- No UI.
- No React Flow or D3.
- No source import parsing.
- No filesystem reads.
- No database reads.
- No telemetry ingestion.
- No runtime observers.
- No graph-driven execution.

## Phase 20A Final Integration

Phase 20A starts final integration without introducing a new subsystem. The first slices add `src/lib/final-system-status`, a static, typed, read-only registry, report layer, disabled-feature matrix, and authority surface inventory for completed core phases 10-19.

The registry records:

- Phase id, phase name, and current status.
- Metadata-only evidence references.
- Readiness categories for final audit, packaging, move-in, onboarding, portfolio, and disabled-feature matrix work.
- Authority posture for authority-bearing phases.
- Disabled-feature posture for risky surfaces.
- Packaging relevance for later Phase 20 slices.

Query helpers return all phase statuses, final readiness summary, blocked/missing items, authority-bearing surfaces, and disabled-feature surfaces. Phase 20A.2 adds `buildFinalReadinessReport()`, which produces deterministic sections for summary, phase coverage, readiness categories, authority surfaces, disabled features, packaging readiness, move-in readiness, portfolio readiness, and governance verdict.

Phase 20A.3 adds `getFinalDisabledFeatureMatrix()`, `getDisabledFeaturesByCategory()`, `getCriticalDisabledFeatures()`, and `summarizeDisabledFeaturePosture()` for final hardening audits. The matrix pins wake word, always-listening, background/hidden capture, autonomous device execution, public dashboards, voice-only approval, auto-approval, graph-driven execution, unredacted telemetry/UI exposure, remote/cloud defaults, whole-home control, CAI non-whitelisted targets, UI run/retry/mutate controls, scheduler side effects, routine chaining, unapproved room actions, and ungoverned provider escalation as still disabled.

Phase 20A.4 adds `getFinalAuthoritySurfaceInventory()`, `getAuthoritySurfacesRequiringApproval()`, `getExecutableAuthoritySurfaces()`, `getNetworkCapableAuthoritySurfaces()`, and `summarizeAuthoritySurfacePosture()`. The inventory records read/write/execute posture, approval requirements, network posture, raw payload posture, disabled-feature dependencies, governance notes, and final Phase 20 posture for every authority-bearing or authority-adjacent surface without reclassifying or enabling any surface.

Phase 20A adds no UI route, provider call, network call, filesystem mutation, routine execution, room/device control, raw payload exposure, approval bypass, runtime report generation surface, or new authority surface.

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

Current posture: 3,500+ passing tests, TypeScript strict, lint passing, and closeout guards across governance, voice, runtime, project intelligence, environment, vision, scheduled assistance, approval lifecycle, and architecture graph contracts.

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

The disabled list matters because most AI projects add features as fast as possible. JARVIS deliberately leaves out wake word, always-listening, autonomous execution, background camera access, auto-approval, voice-only approval, graph-driven execution, and unapproved device control. That reflects production-grade thinking about trust, safety, and blast radius.

Most student AI projects are prompt in, response out, call it a day. JARVIS has a governance layer, approval lifecycle, cost guards, redaction pipeline, read-only observability, adapter contracts, project continuity, voice boundaries, an architecture graph foundation, and thousands of tests. What separates a good CV from a great one is the discipline behind the code, not the feature count.

The current Phase 19A work makes the architecture itself visible. The graph contracts and static registry show how subsystems are designed to relate, where governance gates sit, and which connections are forbidden, without giving the graph any power to execute.

## Related Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - full architecture and delivery roadmap.
- [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md) - Phases 10-20 operationalization plan.

## Author Note

Built by Prince Anozie, MMU final-year Computer Science / Cybersecurity student.
