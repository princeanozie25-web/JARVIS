# JARVIS

> A personal AI operating environment. Multi-model orchestration for chat, reasoning, room control, voice, and project execution — built local-first when local quality holds.

**Status:** Phase 1.5 landed — typed core + provider abstraction + streaming + cost guard + rate limit + telemetry + SQLite + model registry  
**Build log:** May 2026 → graduation (July 2027)  
**Stack:** Next.js 16 · React 19 · TypeScript · Node 20 · OpenAI SDK · Anthropic SDK · better-sqlite3 · Ollama (next)

> **Runtime decision (16 May 2026):** JARVIS is built on a TypeScript/Next.js runtime (Path A). The architecture document was originally drafted with a Python/FastAPI sketch — that's been formally reconciled in [ARCHITECTURE.md §0](ARCHITECTURE.md#0-runtime-stack-decision--path-a-typescript-first). All architecture principles, the router, the phase order, and the quality bars are unchanged.

---

## What this is

JARVIS is a local-first AI assistant being built from scratch as a final-year project at Manchester Metropolitan University. It orchestrates multiple AI providers (OpenAI, Anthropic, later Ollama) behind a unified `ChatProvider` interface, with a focus on quality-bounded routing, cost discipline, safety gates, and observability.

The end-state goal: a real personal AI environment that runs my desk and room, helps with project work, briefs me on news, controls lighting and sensors — all while staying inside hard monthly spend caps enforced by the orchestrator itself.

This repository is a **public build log**. It started rough in May 2026. By July 2027 it should be a fully integrated multi-modal AI system.

## Why this exists

Most "AI assistant" demos route every request to the most expensive frontier model. That's lazy architecture and unsustainable cost-wise. JARVIS exists to demonstrate that a well-routed system can:

- Stay local-first **when local quality matches frontier quality** — not as a cost shortcut
- Escalate to cloud models only when the task genuinely needs it
- Make every routing decision observable, auditable, and replayable
- Enforce cost caps at the orchestrator level so autonomous workflows can't run away
- Integrate physical hardware (lights, sensors, voice) without giving up software discipline

Building this is also how I'm proving to myself — and to recruiters — that I can architect, ship, and maintain a non-trivial AI system end-to-end.

## What runs today

**Phase 1A — Typed Core Loop** ✓
**Phase 1.5 — Pre-router prerequisites** ✓

- Typed input → chat UI → `/api/chat` (Next.js App Router) → provider → streamed SSE response → progressive UI render
- Two cloud providers behind one `ChatProvider` interface: OpenAI (`openai`) and Anthropic (`@anthropic-ai/sdk`)
- Typed `StreamEvent` discriminated union (`text`, `usage`, `done`, `error`, plus reserved `tool_call_*` slots)
- `AbortSignal` threaded from client → route → provider; Stop button works mid-stream
- Time-to-first-token captured per call; full latency, model id, input/output tokens, cost recorded
- Cost guard with daily/weekly/monthly USD caps (in-memory today, SQLite-backed soon)
- Rate limiter (sliding window, 20 req/min per client key)
- Zod request validation (size + count caps)
- Versioned system prompt loader with content-hash logging
- Telemetry write-through: in-memory ring buffer + `data/jarvis.db` (`telemetry_events` table)
- Sessions and messages persisted in SQLite (`sessions`, `messages` tables, foreign-key cascade)
- Model registry: provider, modelName, tier, capabilities, pricing — single source of truth at [src/lib/models/entries.ts](src/lib/models/entries.ts)
- Unified cost calculation reads pricing from the model registry
- Vitest test suite (currently 23 tests across 6 files)
- Prettier + Husky + lint-staged pre-commit gate (`lint-staged` → `lint` → `test`)

The router itself (intent → safety → capability → cost) is the next phase. Everything above is what had to land before that work could begin.

## Architectural principles

The full architecture lives in [ARCHITECTURE.md](ARCHITECTURE.md). The non-negotiables:

- **Local-first with quality guarantees** — local models handle tasks only when they match frontier-model quality on a calibration suite
- **Model-agnostic routing** — a model registry resolves capability requests to the cheapest model that meets the quality bar; provider names are not hardcoded
- **Streaming by default** — typed SSE events from the first phase that introduces them
- **Safety gates** — destructive actions require explicit confirmation and are logged
- **Cost-bound from Phase 0** — hard daily/weekly/monthly spending caps enforced by the orchestrator itself
- **Mock-first hardware** — room control logic testable without any device connected
- **Observable to itself** — self-diagnostic, failure replay, and comparison mode are core, not future features
- **State is explicit** — no implicit cross-session state; persistence is named and bounded

## Roadmap

| Phase | Capability                                                        | Status  |
| ----- | ----------------------------------------------------------------- | ------- |
| 0     | Foundations, cost caps, test framework, Docker dev env (later)    | Built   |
| 1A    | Typed core loop (typed input → cloud reasoning → reply)           | ✓       |
| 1.5   | Provider abstraction, streaming, telemetry, registry, SQLite      | ✓       |
| 1B    | Ollama provider behind the same `ChatProvider` interface          | Next    |
| 1C    | Calibration suite per task class (quality bars in code)           | Planned |
| 1D    | Router skeleton (intent / safety / capability / cost stages)      | Planned |
| 2     | Local desktop tools (files, apps, documents) — Electron shell     | Planned |
| 3     | Memory + Obsidian integration; vector store decision              | Planned |
| 4     | Voice interface (streaming STT, streaming TTS, interrupts)        | Planned |
| 5     | Project assistant + plugin architecture                           | Planned |
| 6     | Smart room (Hue, presence sensors, ambient feedback) — mock-first | Planned |
| 7     | Vision layer (YOLOv8n, MediaPipe, OCR)                            | Planned |
| 8     | Daily self-audit + scheduled routines                             | Planned |
| 9     | Dashboard, demo mode, interview mode                              | Planned |

## Tech stack

| Layer                  | Tools                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Runtime                | Node 20, Next.js 16, React 19, TypeScript                                                    |
| Cloud AI               | OpenAI SDK (`gpt-4o-mini` default), Anthropic SDK (`claude-haiku-4-5-20251001` default)      |
| Local AI runtime       | Ollama over HTTP (Phase 1B)                                                                  |
| Local models (planned) | Qwen3, Mistral, Gemma — resolved via [src/lib/models/entries.ts](src/lib/models/entries.ts)  |
| Persistence            | SQLite via `better-sqlite3` at `data/jarvis.db` — `sessions`, `messages`, `telemetry_events` |
| Streaming wire         | SSE (`text/event-stream`) with typed `StreamEvent` payloads                                  |
| Validation             | Zod                                                                                          |
| Tests                  | Vitest                                                                                       |
| Quality gates          | Prettier, ESLint, Husky pre-commit (lint-staged → lint → test)                               |
| Vision (future)        | YOLOv8n, MediaPipe, Tesseract / PaddleOCR — runtime decision in Phase 7                      |
| Hardware (future)      | Philips Hue, Aqara FP2, Nanoleaf, Tapo, HomePod mini                                         |

## Setup

```bash
# Clone
git clone https://github.com/princeanozie25-web/JARVIS.git
cd JARVIS

# Install dependencies (Node 20+)
npm install

# Configure secrets — create .env.local with:
#   OPENAI_API_KEY=sk-...
#   ANTHROPIC_API_KEY=sk-ant-...
# Both keys are required at server boot.

# Run the dev server
npm run dev
```

Open <http://localhost:3000>. The chat UI streams responses from whichever provider is selected in the dropdown. Hit `Stop` mid-stream to abort.

### Scripts

| Command                | What it does                   |
| ---------------------- | ------------------------------ |
| `npm run dev`          | Next dev server on :3000       |
| `npm run build`        | Production build               |
| `npm start`            | Run the production build       |
| `npm run lint`         | ESLint over the repo           |
| `npm test`             | Vitest (single run)            |
| `npm run format`       | Prettier write across the repo |
| `npm run format:check` | Prettier check (CI-style)      |

### Persistence

- SQLite file is created lazily at `data/jarvis.db` on first request; `data/` is gitignored.
- Schema (`sessions`, `messages`, `telemetry_events`) is applied automatically via `applyMigrations` on connection open.
- To inspect: `sqlite3 data/jarvis.db ".tables"` then standard SQL.

## About

Built by **Prince Anozie** — final-year Cyber Security student at Manchester Metropolitan University, focused on the intersection of cybersecurity and AI engineering.

- LinkedIn: [linkedin.com/in/princeanozie](https://linkedin.com/in/princeanozie)
- GitHub: [@princeanozie25-web](https://github.com/princeanozie25-web)

---

_This is a public build log. Demo videos and progress updates are posted monthly on LinkedIn. If you're a recruiter and want to see something specific running, [reach out](https://linkedin.com/in/princeanozie) — I can demo whatever phase is current._
