# JARVIS

A governed, local-first AI operating environment. Built in phases. Architecture-first.

![Tests](https://img.shields.io/badge/tests-1772%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## What This Is

JARVIS is a personal AI operating environment with governance, memory, tools, voice, project intelligence, environment state, vision contracts, scheduled assistance, and observability built into one TypeScript runtime.
It is not a chatbot wrapper, not a LangChain demo, and not a prompt-in-response-out project.
The core idea is governance first: every capability is routed through safety, approval, privacy, telemetry, and cost boundaries before it can matter.
It was built as a deliberate architectural exercise over nine phases, not as a weekend feature demo.

## Current Status

| Built and Frozen (✅)                                 | Deliberately Not Enabled (❌) |
| ----------------------------------------------------- | ----------------------------- |
| Governance architecture                               | Wake word                     |
| Runtime governance                                    | Always-listening              |
| Safety enforcement                                    | Autonomous execution          |
| Tool orchestration                                    | Background camera             |
| Persistent memory architecture                        | Auto-approval of any action   |
| Project continuity model                              | Unapproved device actions     |
| Voice orchestration layer (push-to-talk)              | Cloud providers by default    |
| Realtime interruption system                          | Remote/public dashboard       |
| Runtime/voice boundaries                              |                               |
| Privacy architecture                                  |                               |
| Telemetry governance                                  |                               |
| Local-first architecture                              |                               |
| Cloud policy governance                               |                               |
| Approval governance                                   |                               |
| Cost governance                                       |                               |
| Project intelligence layer                            |                               |
| Environmental/smart-room scaffolding                  |                               |
| Vision layer (screenshot OCR, object detection)       |                               |
| Scheduled self-audit system                           |                               |
| Observability Command Center (Rest / Working / Audit) |                               |

The disabled list is not a gap - it is the architecture. Governance first, capability second.

## Architecture

JARVIS was built through nine frozen phases: core governance/runtime substrate, typed providers, streaming, cost guards, memory, Obsidian-oriented continuity, runtime safety, terminal execution, governed voice, project intelligence, environmental scaffolding, vision contracts, scheduled assistance, and the Phase 9 Command Center.
The full architecture is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), with the next operationalization era in [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md).

Key decisions:

- Governance-before-capability doctrine: safety gates are substrate, not decoration.
- Mock-first / provider-later pattern: providers and devices prove contracts before real integrations land.
- Approval lifecycle as the only path to side effects.
- Read-only observability: the Command Center can inspect, replay, and explain, but cannot mutate.
- Local-first by default, with cloud routes explicitly opt-in, budget-gated, consent-gated, and audited.

## Tech Stack

| Layer                                      | Choice                             | Why                                                                                                   |
| ------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend                                   | Next.js 16 + React 19 + TypeScript | Current app runtime and UI layer, with strict typed contracts across client and server.               |
| Styling                                    | Tailwind CSS 4                     | Current styling layer for fast UI iteration without a separate component framework.                   |
| Testing                                    | Vitest                             | Current test runner for colocated unit, boundary, contract, and closeout tests.                       |
| Providers                                  | OpenAI SDK + Anthropic SDK         | Current cloud provider wrappers behind a shared provider interface.                                   |
| Database                                   | SQLite via `better-sqlite3`        | Current local persistence foundation; operationalization expands this into append-only event storage. |
| Voice (planned operationalization)         | `whisper.cpp` for STT, Piper TTS   | Offline push-to-talk voice without always-listening or cloud audio by default.                        |
| Local models (planned operationalization)  | Ollama                             | Local model runtime behind the existing registry/router pattern.                                      |
| Desktop shell (planned operationalization) | Tauri                              | Local desktop packaging with loopback-only exposure and OS permissions under governance.              |

## Project Structure

```text
jarvis/
  app/                         Next.js App Router, API routes, chat surface
    api/                       Chat, approvals, memory, runtime commands, consent, goals, timeline
  src/
    components/                React panels for approvals, voice, memory, projects, review queues
    lib/
      command-center/          Phase 9 Rest / Working / Audit contracts, replay, governance, demo mode
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
  *.test.ts / *.test.tsx       Tests are colocated with source; there is no top-level tests/ folder
  next.config.ts               Next.js config
  vitest.config.ts             Vitest config
  package.json                 Scripts, dependencies, lint-staged config
```

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

Open `http://localhost:3000` for the current local app surface.
There is no standalone `demo` script yet; Phase 9 demo/recruiter mode exists as tested Command Center contracts and view models.

## Testing

Current posture: 1,772 passing tests across 207 test files, with TypeScript strict and lint passing.
The tests cover governance invariants, redaction, no-mutation proofs, disabled-feature guards, approval boundaries, voice/runtime separation, adapter conformance, replay safety, cost controls, and closeout gates.

```bash
pnpm test
```

Every phase has closeout gates before it is frozen. A feature is not considered done until its tests prove both what works and what must remain disabled.

## For Recruiters / Non-Technical Readers

JARVIS demonstrates architecture-before-features discipline. The builder put safety gates, approval flows, privacy boundaries, telemetry rules, and cost controls in place before chasing impressive demos. The 1,772 tests are not padding; many of them prove that risky features are disabled, redacted, blocked, or unable to mutate state.

The "what is disabled" list matters because most AI projects add features as fast as possible. JARVIS deliberately leaves out wake word, always-listening, autonomous execution, background camera access, and unapproved device control. That reflects production-grade thinking about trust, safety, and blast radius.

Most student AI projects are prompt in, response out, call it a day. JARVIS has a governance layer, approval lifecycle, cost guards, redaction pipeline, read-only observability, adapter contracts, project continuity, voice boundaries, and 1,772 tests. What separates a good CV from a great one is the discipline behind the code, not the feature count.

The next era is operationalization: Phases 10-20 move the system from governed scaffolds into real local services. That means Ollama for local models, push-to-talk STT/TTS, Hue lights behind approval gates, an interactive architecture graph, a telemetry cockpit, a governance visualizer, and a red-team layer via CAI. All of it sits behind the same governance contracts already in place.

## Related Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - full v3.1/v3.2 architecture and delivery roadmap.
- [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md) - Phases 10-20 operationalization plan.

## Author Note

Built by Prince Anozie, MMU final-year Computer Science / Cybersecurity student.
