# JARVIS

A governed, local-first AI operating environment. Built in phases. Architecture-first.

![Tests](https://img.shields.io/badge/tests-5292%20observed%20%7C%205272%20passing-yellowgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## What This Is

JARVIS is a personal AI operating environment with governance, memory, tools, voice, project intelligence, environment state, vision contracts, scheduled assistance, approval-gated execution contracts, read-only observability, architecture visibility, and a pipeline-first command-center UI built into one TypeScript runtime.

It is not a chatbot wrapper, not a LangChain demo, and not a prompt-in-response-out project. The core idea is governance first: every capability is routed through safety, approval, privacy, telemetry, redaction, cost, and authority boundaries before it can matter.

## Current Status

| Built / Frozen / In Progress                                    | Deliberately Not Enabled                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Governance architecture                                         | Cloud wake word or pre-wake audio buffering/storage                         |
| Runtime governance                                              | Always-listening or background capture                                      |
| Safety enforcement                                              | Autonomous execution                                                        |
| Tool orchestration contracts                                    | Background camera                                                           |
| Persistent memory architecture                                  | Auto-approval of any action                                                 |
| Project continuity and registry layers                          | T2/T3 voice-only approval                                                   |
| Voice orchestration and streaming boundaries                    | Unapproved device actions                                                   |
| STT/TTS provider contracts and queues                           | Cloud providers by default                                                  |
| Runtime command governance                                      | Remote/public dashboard                                                     |
| Environmental/smart-room scaffolding                            | Graph-driven execution                                                      |
| Vision layer contracts                                          | Architecture graph UI                                                       |
| Scheduled self-audit contracts                                  | React Flow/D3 graph rendering                                               |
| Observability Command Center contracts                          | Runtime dependency observers                                                |
| Phase 18 Approval Runtime foundation                            | Source import parsing for graph                                             |
| Phase 19 architecture graph contracts and static registry       | Database/telemetry-backed graph ingestion                                   |
| Phase 20 final integration, hardening, packaging, and readiness | Packaging/install automation or unapproved expansion-era runtime enablement |

The disabled list is not a gap. It is the architecture. Governance first, capability second. Expansion Era voice work may add local-only wake/conversation mode and tiered voice authority, but cloud wake word, pre-wake audio storage, auto-approval, destructive voice approval, public dashboards, and unapproved device actions remain forbidden.

Official UI direction: the Pipeline Command Center is authoritative across Rest, Working, Audit, and Demo Director surfaces. The prior Infinity Gauntlet / cosmic prototype direction is removed from the official product path; any cinematic polish now serves the governed pipeline, not a separate gauntlet UI.

Demo Director status: real browser capture and local disk export are implemented. `npm run demo:export -- recruiter` records the local app through Playwright/Chromium, writes a real `demo.mp4`, captures reactor/pipeline/working/audit screenshots, and generates transcript, architecture summary, LinkedIn draft, and release notes. Nothing auto-posts, auto-uploads, or grants execution authority.

## Phase Status

JARVIS has completed the Phase 1-20 governance and operationalization substrate described in [docs/ARCHITECTURE_OPERATIONALIZATION.md](docs/ARCHITECTURE_OPERATIONALIZATION.md). The Expansion Era is now the active post-Phase-20 roadmap, with future capability openings governed by the Expansion Era authority model instead of by the historical substrate alone.

Active UI program: the [UI Polish Plan](docs/architecture/UI_POLISH_PLAN.md) is the post-Phase-21, pre-Phase-22 program turning JARVIS into the Governed Orbital Command Room without changing governance, approval lifecycle, or execution paths.

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

| Layer                    | Choice                             | Why                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                 | Next.js 16 + React 19 + TypeScript | Current app runtime and UI layer, with strict typed contracts across client and server.                                                                                                                               |
| Styling                  | Tailwind CSS 4                     | Current styling layer for fast UI iteration without a separate component framework.                                                                                                                                   |
| Testing                  | Vitest                             | Current test runner for colocated unit, boundary, contract, and closeout tests.                                                                                                                                       |
| Providers                | OpenAI SDK + Anthropic SDK         | Cloud provider wrappers behind a shared provider interface, disabled unless explicitly routed.                                                                                                                        |
| Database                 | SQLite via `better-sqlite3`        | Local persistence foundation and operationalization store substrate.                                                                                                                                                  |
| Validation               | Zod                                | Runtime contract schemas for governance, graph, approval, runtime, voice, vision, and project metadata.                                                                                                               |
| Desktop shell            | Tauri                              | Planned/contracted local desktop packaging with loopback-only exposure and OS permissions under governance.                                                                                                           |
| Voice operationalization | Local STT/TTS stack                | Current voice remains local-first. Demo Director narration prefers Chatterbox-TTS-Server, falls back to Kokoro, then the existing local narration fallback; this is narration only, not wake word or voice authority. |
| Demo capture             | Playwright + FFmpeg                | Records local command-center demo routes, exports MP4 and screenshots to disk only, and validates the export package without posting or uploading.                                                                    |
| Local models             | Ollama                             | Planned local model runtime behind the existing registry/router pattern.                                                                                                                                              |
| Architecture graph UI    | React Flow or D3 later             | Deferred. Current Phase 19 graph work is contracts and static registry only.                                                                                                                                          |

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
      demo-director/           Demo scripts, narration fallback chain, real browser capture, recording/export package
      pipeline-visualization/  Phase 21K read-only governed pipeline visualization model
      social-extraction/       Phase 21E user-triggered social video extraction workflow
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

The static registry includes Phase 10 through Phase 19 nodes, core runtime/module nodes, designed dependency edges, and forbidden/tripwire edges such as voice approval-bypass guards and "Architecture Graph must not execute traces." These are metadata tripwires only, not executable behavior. They protect the Phase 1-20 substrate and do not override the Expansion Era T0-T3 voice authority model described below.

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

Expansion Era is active as the post-Phase-20 roadmap. Phase 21 is complete with a PASS verdict across 21A-21K, and the mandatory Expansion Era Refresh is recorded in [docs/architecture/EXPANSION_ERA_REFRESH.md](docs/architecture/EXPANSION_ERA_REFRESH.md) and [docs/architecture/EXPANSION_ERA_V2.md](docs/architecture/EXPANSION_ERA_V2.md). The refresh does not change the Phase 1-20 execution doctrine: no silent writes, no raw payload telemetry, no cloud providers by default, no auto-apply, no auto-send, and no auto-execution.

Current Phase 21 implementation status:

- DeepSeek V4 migration and live draft paths have been tested through governed local-dev activation. The committed registry defaults keep DeepSeek cloud models disabled; local live testing uses an in-memory override only.
- Obsidian now has a pull-only indexing foundation and local semantic retrieval path. It can scan a configured vault, retrieve metadata and bounded snippets, and populate local vectors without watching files, mutating the vault, or using cloud embeddings.
- Vault taxonomy, routing, frontmatter, Vault Write Gateway proposal/execution boundaries, and Librarian contracts exist as approval-aware foundations. Durable vault writes remain approval-gated and explicit.
- LLM Wiki has preview/draft foundations, and Knowledge Compounding is execution-enabled through the human approval boundary: hub candidate selection, candidate ranking, vault-sourced draft generation, source attribution, approval-gated write planning, injected approved vault writer execution, path validation, and bounded re-index metadata exist. Automatic wiki creation, scheduler-driven mutation, autonomous knowledge growth, and gateway bypass remain forbidden.
- Verification Agent exists as an advisory foundation with confidence, caveats, risk flags, metadata-only telemetry rules, and a UI confidence surface.
- Google adapter work is execution-enabled through governed T0-T2 boundaries. Gmail, Calendar, and Drive T0 read integrations exist with a shared Google Account Runtime for OAuth state, token validity metadata, scope inventory, and adapter readiness. Gmail draft creation, Gmail send, and Calendar event creation are available only through injected adapters and approval/consent gates. Drive writes, background sync, hidden SDK calls, token telemetry, and live MCP wiring remain disabled.
- Morning Brief is realized as a scheduled Suggestion Inbox delivery workflow: it consumes supplied Google metadata input, composes deterministically, creates metadata-only Suggestion Inbox delivery items, and exposes a scheduler invocation boundary for daily 08:00 local delivery with idempotency/dedupe and a kill switch. It does not run a background daemon, call live Google adapters directly, auto-send, auto-execute, mutate, or approve anything; live Google input resolution remains through the Google T0 read stack rather than direct calls inside the Morning Brief composer, delivery, or scheduler invocation layers.
- Job Scout is execution-enabled through the supervised human approval boundary: source contracts, supplied feed ingestion, feed validation/summary, normalization into job postings, deterministic ranking, fit scoring, missing-skill analysis, digest generation, Suggestion Inbox-ready digest payloads, optional Morning Brief digest metadata integration, application tracking, cover-letter draft planning, acquisition policy/rate gates, form-fill previews, final UI confirmation, and injected/fakeable submission adapters exist. Scraping, Playwright/browser automation, unsupervised submission, auto-apply, auto-send, raw application telemetry, and real Suggestion Inbox writes remain forbidden outside future governed openings.
- Telegram is realized as a governed single-user text transport: bot configuration metadata, authorized direct-text inbound parsing, router envelope handoff, dry-run/default outbound reply planning, and an injected sender boundary for future runtime integration exist. Webhook servers, polling daemons, media/voice/files/images, groups/channels, Telegram approval authority, remote execution, provider calls, and desktop approval bypass remain future/forbidden.
- Social media extraction is operationally validated as a user-triggered, injected-runner workflow. JARVIS can classify supported URLs, enforce source policy, run yt-dlp download, run ffmpeg adaptive frame extraction, use the local faster-whisper transcription runtime, assemble a multimodal packet, return structured timestamped analysis metadata, and clean the temp workspace. The public YouTube smoke path passed with yt-dlp 2026.03.17, ffmpeg/ffprobe 8.1.1, faster-whisper:tiny, packet assembly, deterministic analysis, and temp cleanup. It does not watch URLs, bulk download, persist raw media, store raw transcript/frame/audio/video data in telemetry, call providers directly, or bypass cloud cost/user-trigger gates.
- Council Mode is realized as an opt-in, cost-gated live provider reasoning workflow. The target roster is Claude, GPT, DeepSeek, Local Fast, and Local Smart; provider dispatch happens only through an injected approved runner boundary after explicit cost confirmation, with independent answers, anonymous peer review, chairman synthesis, confidence/disagreement summaries, and an advisory final answer. Council Mode does not run by default, does not execute tools, finalise approvals, trigger autonomously, or bypass routing/cost governance. Command Center Council UI, persistent council run viewer, automatic provider benchmarking, autonomous triggering, and council-driven action approvals remain future/forbidden outside separately governed openings.
- Agent Suite is realized as a scheduled Suggestion Inbox delivery workflow: the shared contract, registry, planner, dry-run runtime, output factory, preview suite, scheduled invocation boundary, digest generation path, and Suggestion Inbox delivery bridge can turn supplied agent previews for Life Coach, Build Monitor, Research Agent, CV Maintenance, Application Tracker, Deadline Agent, Cost Monitor, and Health Agent into real user-visible digest or alert items. Autonomous execution, cross-agent workflows, agent self-modification, direct side effects, execution authority, provider/model calls, live reads, and approval finalization remain future/forbidden outside separately governed phases.
- GitNexus is modeled as a read-only/local verification foundation. It is not governance truth, does not mutate the repo or vault, and remains separate from the Graphify architecture overlay.
- Graphify overlay is complete as a read-only architecture data source. JARVIS can accept supplied Graphify-compatible `graph.json` / NetworkX node-link metadata, normalize nodes and edges, compare Graphify-derived code graph metadata against the designed architecture graph, and summarize discrepancies such as design-only nodes, Graphify-only nodes/edges, and missing supplied test/doc coverage. Graphify does not become governance truth, execute checks, run hooks, crawl the repo, write files, write telemetry, add UI routes, or drive runtime behavior. Automated Graphify execution, git hook generation, live telemetry overlay, UI rendering polish, and graph-driven execution remain future/forbidden outside a separately governed opening.
- Pipeline visualization is complete as a read-only governance surface. It now supports stage-by-stage governance flow, approval boundary visibility, authority surface visibility, Graphify overlay integration, and discrepancy reporting across the Capture -> Classify -> Route -> Human Gate -> Execute -> Audit path. It does not add execution buttons, approval buttons, mutating controls, provider calls, network calls, filesystem writes, telemetry writes, scheduler execution, governance replacement, Graphify execution, or new authority surfaces.

Phase 21 is now closed with PASS across 21A-21K. The next program is UI Polish, not Phase 22: interface-design readiness, design tokens, typography, removal of generic chatbot composition, motion, orb state machine, and cockpit layout. Phase 22 should open only after the refresh and UI Polish closeout. Still future after Phase 21: cinematic redesign implementation, recruiter screenshots, Three.js enhancements, real provider benchmarking, autonomous council triggering, richer Telegram media/mobile workflows, and MacBook-only Phases 22-26.

CAI status is governed and integrated, but execution-blocked: Phase 19D includes the red-team sandbox contracts, provider manifest, mock dry-run provider, approval binding, localhost execution gate, and visible sandbox route. CAI is not installed, imported, called, sidecar-backed, subprocess-backed, network-scanning, approval-creating, or authority-token-creating. Real CAI execution requires an explicit future opening.

## Expansion Era Direction

The Expansion Era is the active post-Phase-20 execution era. It turns frozen scaffolds into real integrations without reopening the Phase 1-20 governance substrate.

Expansion Era roadmap structure:

- Priority 0: alignment, authority clarification, and readiness work. This includes README/architecture alignment and the Voice Authority Amendment; it does not activate runtime features by documentation alone.
- Phase 21: the first governed implementation-opening phase after Priority 0. Any capability opened here must preserve Phase 1-20 approval, redaction, local-first, telemetry, and authority boundaries.
- Phase 22+: later Expansion Era integrations. These remain future planned capabilities until their own explicit opening, tests, and closeout gates exist.

Planned voice changes are no longer described as outside the roadmap forever. The intended voice overhaul keeps voice local-first: local-only wake word, no pre-wake audio buffering or storage, conversation mode with timeout, and explicit sleep commands such as "Jarvis sleep" or "Goodnight Jarvis." Cloud wake word remains forbidden.

Voice authority moves to a T0-T3 model:

- T0: read-only voice actions need no approval.
- T1: low-risk reversible actions may be voice-authorised with standing consent.
- T2: voice may initiate the proposal, but UI confirmation finalises it.
- T3: manual-only actions cannot be approved by voice.

Still forbidden: T2/T3 voice-only approval, destructive voice approval, governance changes by voice, self-elevating trust classes, auto-approval, public/remote dashboards, unapproved device actions, cloud wake word, pre-wake audio storage, and raw audio/transcript telemetry.

### Model tiers vs action authority

ModelTier `T0`–`T4` (`src/lib/models/types.ts`) ranks model capability for routing and cost; it is not the voice action-authority ladder above (`src/lib/voice-operating-mode/authority.ts`). T4 is the frontier multimodal reasoning class — native image+audio+text input with long-context cross-modal synthesis. No production model entry instantiates T4 yet, and registering one later is registry data, not a phase change. In analysis packets, `model_tier` is a minimum-capability floor: the resolver selects the lowest qualifying tier at or above T3 per aux-routing and cost rules.

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

Export a local recruiter demo package:

```bash
npm run dev:local
npm run demo:export -- recruiter
```

Exports land under `demo-exports/<timestamp>/` and are ignored by git because they are generated media artifacts.

Latest local validation snapshot on June 6, 2026:

- Focused Demo Director / pipeline / typography / registry / approval-runtime closeout: 495 tests passing.
- Full `npm test` measured during closeout: 5,292 tests executed, 5,272 passing; the remaining failures were long-running frozen audit closeout timeouts plus direct regressions that were fixed and revalidated in the focused pass above.
- `npx tsc --noEmit --pretty false`: pass.
- `npm run lint`: pass with 18 pre-existing warnings in older modules.
- `git diff --check`: pass.

Optional provider environment:

- Put local secrets in `.env.local`; do not commit that file.
- `DEEPSEEK_API_KEY` is required only for the manual DeepSeek smoke path.
- `DEEPSEEK_BASE_URL` is optional and defaults to the OpenAI-compatible DeepSeek endpoint `https://api.deepseek.com`.
- Committed registry defaults keep `deepseek-v4-flash` and `deepseek-v4-pro` at `visibility: disabled`; never commit cloud-enabled defaults.
- For local live DeepSeek tests only, add `JARVIS_ENABLE_DEEPSEEK_LIVE=true` to `.env.local`, run `npm run smoke:deepseek` or `npm run wiki:draft`, then remove that flag or set it to `false`.
- The local live override creates an in-memory registry view for DeepSeek V4 only. It does not mutate `config/models/registry.yaml`, does not enable other cloud providers, and does not print API keys.

Optional Obsidian pull-only index:

- `OBSIDIAN_VAULT_PATH` points at an existing Obsidian vault directory.
- Run `npm run obsidian:index` to perform a manual pull-only scan.
- The scan builds an in-memory metadata index of markdown notes and folders, including note id, title, relative path, size, timestamps, and tags. It does not watch files, run in the background, create notes, mutate the vault, generate embeddings, or call cloud services.
- Retrieval is available through the Obsidian pull-indexer module for note metadata lookup and bounded snippet reads by note id or relative path. Snippets are read on demand from disk and are not stored in telemetry.
- Run `npm run obsidian:embed` to perform a manual local semantic population pass. This reads the vault through the pull-only indexer, embeds note text with the local Ollama `nomic-embed-text` model, and stores vectors in a local `sqlite-vec` table outside the vault.
- Optional semantic env: `OBSIDIAN_EMBEDDING_MODEL` defaults to `nomic-embed-text`, `OBSIDIAN_EMBEDDING_DIMENSION` defaults to `768`, `OBSIDIAN_EMBEDDING_TIMEOUT_MS` defaults to `30000`, and `JARVIS_OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434`.
- `OBSIDIAN_SEMANTIC_QUERY` can be set for the manual embed command to print metadata-only top-k result ids and scores. It never prints the query text, snippets, embeddings, note bodies, or the absolute vault path.

Optional Phase 21E social extraction smoke:

- Install or verify `yt-dlp`, `ffmpeg`, `ffprobe`, Python, and `faster-whisper`.
- Configure the local STT provider in `.env.local`: `JARVIS_STT_PYTHON_COMMAND`, `JARVIS_STT_MODEL_NAME`, `JARVIS_STT_MODEL_PATH`, `JARVIS_STT_PROVIDER_ID`, and optionally `JARVIS_STT_TIMEOUT_MS`.
- Run `npm run social:smoke` to exercise the user-triggered URL -> download -> frame extraction -> transcript -> multimodal packet -> analysis -> cleanup path against a public YouTube smoke URL.
- The smoke path uses injected runner boundaries and keeps workflow telemetry metadata-only. It does not watch URLs, bulk download, persist raw media, store raw transcript/frame/audio/video telemetry, or bypass the explicit user-trigger gate.
- Full setup notes live in [docs/architecture/phase-21e-social-extraction-operational-validation.md](docs/architecture/phase-21e-social-extraction-operational-validation.md).

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
