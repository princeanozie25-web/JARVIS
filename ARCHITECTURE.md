# JARVIS — Master Architecture & Delivery Roadmap

**Version:** 3.2  
**Owner:** Prince Anozie  
**Last Updated:** 16 May 2026  
**Companion doc:** PREMORTEM.md

---

> **Executive Position:** v3.1 was the result of two successive audits (v2 → v3 Opus audit, v3 → Pre-Mortem audit). v3.2 reconciles the architecture with the runtime stack the code actually shipped on (formal "Path A" decision below). Principles, phase ordering, capability set, and quality bars are unchanged. The system gets stronger at each revision, not smaller.

---

## 0. Runtime Stack Decision — Path A (TypeScript-first)

The May 2026 Phase 1.5 audit (`docs/JARVIS_Audit_2026-05-16.docx`) flagged that the v3.1 document described a Python/FastAPI runtime while the repository was shipping on Next.js/TypeScript. This section formally resolves that contradiction by adopting **Path A — TypeScript-first**.

**Decision:**

| Layer               | Choice                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Runtime             | Node.js (≥20) via Next.js 16 App Router; React 19 frontend; TypeScript across the stack           |
| Server modules      | Server-only modules under `src/lib/`; route handlers under `app/api/`; `server-only` enforced     |
| Persistence         | SQLite via `better-sqlite3` (sync, native), file at `data/jarvis.db` (gitignored)                 |
| Cloud providers     | Anthropic SDK + OpenAI SDK, both behind a shared `ChatProvider` interface                         |
| Local model runtime | **Ollama accessed over HTTP** from the Node server (no in-process Python)                         |
| Desktop / OS tools  | Initial sidecar over local HTTP; **Electron shell adopted in Phase 2** when desktop control lands |
| Tool runtime guard  | `JARVIS_TOOLS_ENABLED=true` is allowed only on loopback/local binds (`localhost`, `127.x`, `::1`) |
| Streaming wire      | SSE (`text/event-stream`) carrying a typed `StreamEvent` discriminated union                      |
| Vector / embeddings | Deferred until memory phase; will pick a Node-native or HTTP-accessible store                     |
| Voice (Phase 4)     | Web Audio + Web Speech / cloud TTS over HTTP; native CoreAudio bridging deferred to Electron      |
| Tests               | Vitest                                                                                            |
| Formatter / hooks   | Prettier + Husky + lint-staged                                                                    |

**Why Path A:**

- Working Phase 1A/1.5 code already exists in TypeScript. Rewriting in Python would discard the provider abstraction, the SSE streaming layer, the cost guard, the rate limiter, the telemetry write-through, and the model registry — all of which currently pass their tests and gates.
- One language end-to-end keeps the route handler, the provider wrappers, the SQLite layer, and the React UI in a single mental model.
- Anthropic and OpenAI both ship first-class TypeScript SDKs with `AbortSignal` support and typed streaming. Parity with their Python SDKs is achieved.
- Ollama exposes a stable HTTP API. In-process Python embedding was never a load-bearing assumption — only an artefact of the original Python-first sketch.

**What Path A explicitly defers (and how it's still reachable):**

- **Native desktop control (Phase 2):** Browsers cannot open arbitrary folders or launch apps. The plan is a thin local Node sidecar (or Tauri/Electron shell) that the Next route calls over `localhost`. The `ChatProvider` interface and tool layer are framework-agnostic — they will move into the Electron main process unchanged when that shell lands.
- **Voice CoreAudio / native STT (Phase 4):** Phase 4 will start with browser-native APIs and cloud TTS over HTTP; lower-latency native paths come with Electron.
- **Vision local models (Phase 7):** ONNX Runtime Web exists; for performance-critical paths the Electron main process or a Python sidecar (called over HTTP) remains an option. The decision is deferred to Phase 7.
- **Vector / embeddings (Phase 3):** Either a Node-native library (e.g. LanceDB Node bindings) or a local HTTP service (e.g. Qdrant in Docker). No commitment yet.

**What was rejected and why:**

- **Path B (Python core + Next dashboard).** Would have required reimplementing every Phase 1.5 win in Python and rewiring the route as a thin proxy. No technical reason to incur that cost; the Python SDKs offer no capability the TypeScript SDKs lack for the work in scope.

**What does not change:**

- All 14 architecture principles in §2 (model agnostic, local-first if quality holds, deterministic tools first, safety gates, observable routing, cost engineering, mock-first hardware, etc.).
- The router stages in §4 (intent → safety → capability → cost).
- The roadmap phase ordering in §11.
- The quality bars in §4.5.
- The non-goals in §19.
- The telemetry schema in §17 (now realised in `data/jarvis.db`).

> **Reading these docs:** mentions of `models/providers/*.py`, `apps/api/` (FastAPI), or Python-specific tooling reflect the v3.1 sketch and are superseded by Path A. Section §10 (Repository Structure) reflects the actual TypeScript layout.

---

## 1. Product Vision

Jarvis is a personal AI operating environment for one bedroom workspace. It behaves like a practical operator, not a chatbot: it listens, speaks, opens files, controls apps, manages room states, inspects projects, summarises documents, retrieves memory, and escalates to stronger models only when the task justifies the cost.

| Capability        | Target Behaviour                                        | Cost Principle                           |
| ----------------- | ------------------------------------------------------- | ---------------------------------------- |
| Room control      | Lights, plugs, scenes, presence, focus and gaming modes | Local API-free where possible            |
| Desktop control   | Open folders, apps, files, search local documents       | Local deterministic tools                |
| Project assistant | Read repo, run tests, inspect errors, propose fixes     | Local tools, cloud reasoning when needed |
| Voice assistant   | Push-to-talk first, realtime voice later                | Avoid always-on cloud audio early        |
| Memory system     | Session logs, compressed context, Obsidian vault        | Local-first compression and retrieval    |
| Vision layer      | Desk camera, screenshot OCR, object recognition         | Local CV first, cloud vision when needed |
| Self-audit        | End-of-day logs, mistakes, improvements, next steps     | Local summary or cheap model             |

---

## 2. Non-Negotiable Architecture Principles

1. **Local-first IF quality holds** — a task runs locally only when local output meets the same standard a frontier model would produce. Cost saving is not a licence for mediocrity. If quality is uncertain, escalate.
2. **Model agnostic** — no provider is the permanent default.
3. **Deterministic tools before language models** — opening a folder does not require Opus.
4. **Cloud by exception** — frontier models reserved for complex coding, planning, advanced voice, difficult multimodal reasoning.
5. **Safety gates** — destructive actions require explicit confirmation and logging.
6. **Observable system** — every routed decision, tool call, model call, cost estimate, error, and fallback is logged.
7. **Composable modules** — each subsystem can be replaced without rewriting the assistant.
8. **Progressive delivery** — typed core → voice → smart room → vision → cinematic UI.
9. **Streaming by default** — voice and long responses stream from the first phase that introduces them.
10. **State is explicit** — no implicit in-memory state survives across sessions; persistence is named and bounded.
11. **Mock-first for hardware** — every hardware-dependent tool has a mock implementation. Real hardware swaps in when logic is proven.
12. **Plugin-extensible** — capabilities load from a `plugins/` directory at runtime. Adding a feature does not touch the core orchestrator.
13. **Cost-bound from Phase 0** — hard daily, weekly, and monthly spend caps exist before the first cloud call is made. Caps are enforced by the orchestrator.
14. **Observable to ourselves** — Jarvis can audit itself, replay its own decisions, and compare its own outputs. Core, not future.

---

## 3. End-State System Architecture

```
User input / sensor event
        ↓
Input Gateway (typed, voice, sensor, scheduled)
        ↓
Intent Classifier
        ↓
Safety Classifier
        ↓
Router (capability match + cost optimise)
        ↓
Execution Layer (OS, document, room, vision, browser tools)
        ↓
Feedback Layer (voice, UI, lighting, logs, notifications)
        ↓
Memory + Self-Audit (session summaries, Obsidian, telemetry)
```

| Layer               | Components                                                                  | Purpose                                                |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Input Gateway       | Typed input, push-to-talk, wake word later, sensor events, scheduled events | Normalises all inbound work                            |
| Intent Classifier   | Local rules + small classifier model                                        | Determines what the user wants                         |
| Safety Classifier   | Permission rules + risk scoring                                             | Determines whether action is allowed                   |
| Router              | Capability matcher + cost optimiser + registry lookup                       | Selects cheapest capable engine that meets quality bar |
| Execution Layer     | OS, file, document, project, room, vision, browser tools                    | Performs actions through controlled tools              |
| Feedback Layer      | Voice, UI, lighting, logs, notifications                                    | Communicates outcome, requests approval                |
| Memory + Self-Audit | Session summaries, Obsidian, telemetry, lessons                             | Preserves context and improves routing                 |

---

## 4. The Router (Concrete)

### 4.1 Intent Classification

Stage 1: lightweight local classification. Buckets input into:

- `DETERMINISTIC_COMMAND` — e.g. "turn off the light", "open Downloads"
- `INFORMATION_REQUEST` — e.g. "what's on my calendar"
- `REASONING_TASK` — e.g. "review this code", "plan my week"
- `CREATIVE_TASK` — e.g. "draft a message", "write a summary"
- `CONVERSATIONAL` — e.g. "hey Jarvis, you there?"
- `AMBIGUOUS` — fallback, promotes to next tier classifier

Implementation: regex + keyword rules first. Small local model (~1-3B) for ambiguous cases. Never call a frontier model just to classify.

### 4.2 Safety Classification

Stage 2: independent from intent.

- `ALLOW` — safe local actions (read files, query state, turn on a light)
- `CONFIRM_ONCE` — reversible writes (edit a file, create a note)
- `CONFIRM_ALWAYS` — destructive (delete, overwrite, uninstall, send external)
- `BLOCK` — hard-blocked categories until user changes config

> Why separate from intent: an `INFORMATION_REQUEST` can be `ALLOW` or `BLOCK` depending on whether it accesses private data. Coupling these creates bugs.

### 4.3 Capability Matching

Stage 3: given intent + safety, select capability tier:

| Tier | Capability                 | Used For                                                            | Latency Target |
| ---- | -------------------------- | ------------------------------------------------------------------- | -------------- |
| T0   | No model, local tools only | Room commands, app launching, file ops                              | <300ms         |
| T1   | Local fast (~1-3B)         | Classification, paraphrasing, lightweight extraction                | <800ms         |
| T2   | Local smart (~7-13B)       | Medium reasoning, summarisation, simple code explanation            | <3s            |
| T3   | Cloud fast/mid             | General reasoning, web summaries, structured outputs, voice replies | <2s streaming  |
| T4   | Cloud frontier             | Architecture review, complex debugging, hard multimodal             | <5s streaming  |

### 4.4 Cost Optimisation

Stage 4: within a capability tier, pick the cheapest engine from the registry that meets the quality bar for the task class. Record the decision. Update telemetry. Allow user override via verbal command.

### 4.5 Quality Threshold & Escalation

> **Standing Rule:** The bar is set by Claude and ChatGPT-class output. If a local model cannot match that bar for a given task class, that class does not run locally. Cost is never an excuse for a worse answer.

**How quality is measured:**

- Confidence scoring: below threshold → escalate
- Structured output validation: malformed → automatic escalation
- User rating feedback: thumbs-down marks that task class for cloud routing
- A/B sampling: 5-10% of local-eligible tasks also run on frontier; if local loses consistently, class is promoted
- Periodic re-evaluation when local models are upgraded

**Per-task-class quality bars:**

| Task Class                    | Acceptable Locally | Bar Definition                                      |
| ----------------------------- | ------------------ | --------------------------------------------------- |
| Intent classification         | Yes                | >95% agreement with frontier model on test set      |
| Keyword extraction            | Yes                | Structured output passes schema validation          |
| Short paraphrase (<50 words)  | Yes                | User rating ≥4/5 on rolling sample                  |
| Memory compression summaries  | Conditional        | Information retention check                         |
| Document summary (>1 page)    | Conditional        | A/B against frontier; if local loses >20%, escalate |
| Code explanation              | Conditional        | Technical accuracy check                            |
| Code generation               | No (early phases)  | Always frontier until proven safe                   |
| Architecture/design reasoning | No                 | Always frontier                                     |
| Voice conversational reply    | Conditional        | Naturalness + accuracy; user rating drives routing  |

---

## 5. Model Registry (Concrete Schema)

The registry is a YAML file. Models are added or replaced without code changes.

```yaml
# registry.yaml
models:
  - id: local-fast
    provider: ollama
    model_name: llama3.2:3b # swap to qwen3:3b, gemma3n, etc. freely
    tier: T1
    capabilities: [classification, extraction, paraphrase]
    cost_per_1k_tokens: 0.0
    avg_latency_ms: 600
    context_window: 8192
    privacy: local
    enabled: true

  - id: cloud-mid
    provider: anthropic
    model_name: claude-haiku-4-5-20251001
    tier: T3
    capabilities: [reasoning, conversation, voice-reply]
    cost_per_1k_tokens: 0.001
    avg_latency_ms: 1400
    context_window: 200000
    privacy: cloud
    enabled: true

  - id: cloud-frontier
    provider: anthropic
    model_name: claude-opus-4-6
    tier: T4
    capabilities: [deep-reasoning, code-review, architecture]
    cost_per_1k_tokens: 0.015
    avg_latency_ms: 3200
    context_window: 200000
    privacy: cloud
    enabled: true
```

Provider wrappers (`src/lib/providers/openai.ts`, `src/lib/providers/anthropic.ts`, future `ollama.ts`) implement the `ChatProvider` interface in [src/lib/providers/types.ts](src/lib/providers/types.ts). Model entries are registered in [src/lib/models/entries.ts](src/lib/models/entries.ts) (YAML loader deferred until the registry needs hot-reloading).

---

## 6. Provider Roles

| Provider / Engine           | Best Role                                         | Rule                                                |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| Local deterministic runtime | Fast actions, room automation                     | Use when no reasoning is needed                     |
| Ollama (local runtime)      | Compression, classification, first-pass summaries | Use when quality acceptable and privacy/cost matter |
| OpenAI                      | Realtime voice, multimodal, general builder tasks | Use when latency/voice/multimodal quality matters   |
| Anthropic Claude            | Deep critique, code review, architecture audit    | Use as reviewer or complex reasoning engine         |
| Gemini / NotebookLM         | Large document ingestion, Google ecosystem        | Add later if needed, not core runtime               |

> **Anti-Bias Rule:** Jarvis selects the cheapest capable route, not the developer's preferred model.

---

## 7. Latency & Performance Budgets

| Operation                                | P50 Target | P95 Target | Hard Ceiling |
| ---------------------------------------- | ---------- | ---------- | ------------ |
| T0 deterministic command                 | <200ms     | <400ms     | 1s           |
| T1 local classification                  | <600ms     | <1.2s      | 2s           |
| T2 local reasoning                       | <2s        | <4s        | 8s           |
| T3 cloud reply (streamed first token)    | <800ms     | <1.5s      | 3s           |
| T4 frontier reply (streamed first token) | <1.5s      | <3s        | 6s           |
| Wake word → STT → first reply token      | <1.5s      | <2.5s      | 5s           |
| Voice round-trip (full reply spoken)     | <5s        | <10s       | 20s          |

When P95 drifts for a week, treat it as a bug.

---

## 8. Streaming Architecture

### 8.1 LLM Streaming

- All cloud LLM calls use streaming mode by default
- Tokens buffered into sentence chunks (split on `.` `!` `?` followed by space)
- Each completed sentence dispatched to TTS immediately

### 8.2 TTS Streaming

- OpenAI streaming TTS endpoint for cloud voice
- Audio chunks play through a queue: sentence N plays while N+1 is being generated
- Interrupt handling: user speech or "stop" command flushes the queue immediately

### 8.3 STT Streaming

- Whisper or faster-whisper for local STT; OpenAI Realtime for cloud
- Partial transcripts used for VAD-based end-of-turn detection

---

## 9. State Management & Persistence

| State Type                   | Store                                                                   | Rationale                                                  | Status  |
| ---------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| Session conversation history | SQLite at `data/jarvis.db` (`messages` table)                           | Structured, queryable, survives restart                    | Built   |
| Telemetry events             | SQLite at `data/jarvis.db` (`telemetry_events` table)                   | Append-heavy, queryable for self-audit                     | Built   |
| Hot in-memory telemetry      | `src/lib/telemetry/memory.ts` ring buffer (last 1000)                   | Zero-latency reads for dashboards; write-through to SQLite | Built   |
| Logs (raw)                   | `console.*` (captured by host runtime); rotating files later            | Easy to grep                                               | Partial |
| Hot session state            | React state (frontend cache only); session id round-tripped per request | Recreatable on restart; client owns ephemeral state        | Built   |
| Memory summaries             | Obsidian markdown files                                                 | Human-readable, vault-searchable                           | Planned |
| Vector embeddings            | Node-native (LanceDB) or HTTP (Qdrant) — decision deferred to Phase 3   | Cheap, fast, no external dependency                        | Planned |
| Configuration                | `.env.local` + `src/lib/config.ts` + `src/lib/models/entries.ts`        | Version-controllable; secrets out of git                   | Built   |
| Prompts                      | Files in `prompts/` under git, loaded server-only with content hash     | Versioned, diff-able, roll-back-able                       | Built   |

---

## 10. Repository Structure

The current TypeScript-first layout. Folders marked `(planned)` will be added when the corresponding phase begins.

```
jarvis/
  app/                                 # Next.js App Router
    layout.tsx
    page.tsx                           # chat UI
    api/
      chat/route.ts                    # POST /api/chat — SSE stream, all gates
  src/
    lib/
      chat/
        schema.ts                      # Zod request schema + provider enum
      cost/
        config.ts                      # daily/weekly/monthly USD caps
        guard.ts                       # canExecuteRequest()
        pricing.ts                     # unified calculateCostUsd() (reads from model registry)
        usage.ts                       # InMemoryUsageStore singleton
      db/
        client.ts                      # better-sqlite3 singleton, lazy init, server-only
        schema.ts                      # migrations (sessions, messages, telemetry_events)
        sessions.ts                    # session CRUD
        messages.ts                    # message CRUD (id-keyed, INSERT OR IGNORE)
        telemetry.ts                   # telemetry persistence
      models/
        entries.ts                     # registered ModelEntry rows (registry source of truth)
        registry.ts                    # ModelRegistry class + singleton
      prompts/
        loader.ts                      # reads prompts/*.md, computes content hash, server-only
      providers/
        types.ts                       # ChatProvider, GenerateOptions, StreamEvent, StreamResult
        openai.ts                      # OpenAIProvider (SSE-mapped)
        anthropic.ts                   # AnthropicProvider (SSE-mapped)
        anthropic-messages.ts          # pure helper (system-prompt extraction)
        registry.ts                    # provider singleton registry
      rate-limit/
        memory.ts                      # InMemoryRateLimiter (sliding window)
      telemetry/
        memory.ts                      # InMemoryTelemetryStore (ring buffer)
        index.ts                       # recordEvent — write-through to SQLite
      config.ts                        # env-required apiKeys (no model strings here)
      types.ts                         # Message, Role shared types
    components/                        # (planned — UI primitives)
    styles/
  prompts/                             # versioned, git-tracked
    jarvis_system.md
  data/                                # gitignored — SQLite + WAL files
  docs/
    ARCHITECTURE.md                    # this file
    JARVIS_Audit_2026-05-16.docx       # Phase 1.5 gate audit
    PREMORTEM.md                       # (companion)
  scripts/
  .husky/pre-commit                    # lint-staged → lint → test
  .prettierrc / .prettierignore
  next.config.ts                       # serverExternalPackages: ["better-sqlite3"]
  tsconfig.json                        # @/* → ./src/*
  eslint.config.mjs
  package.json                         # scripts: dev, build, lint, test, format, prepare
  .env.local                           # OPENAI_API_KEY + ANTHROPIC_API_KEY (gitignored)
  README.md

(planned, by phase)
  src/lib/router/                      # Phase 1D — intent / safety / capability / cost stages
  src/lib/safety/                      # Phase 1D / 2 — permission policies, confirmation flows
  src/lib/tools/                       # Phase 2 — os, document, project, room (mocks), vision, browser
  src/lib/memory/                      # Phase 3 — Obsidian, vector store
  src/lib/voice/                       # Phase 4 — STT/TTS streaming pipeline
  src/lib/diagnostics/                 # Phase 7/8 — self-diagnostic, failure replay, comparison
  src/lib/scheduler/                   # Phase 8 — cron-like routines
  plugins/                             # Phase 5 — runtime-loaded capability extensions
  apps/desktop/                        # Phase 2 — Electron shell when desktop control lands
  apps/dashboard/                      # Phase 3 — cost + telemetry dashboard (may be in-app)
  obsidian/                            # Phase 3 — vault structure + build_log/
  docker-compose.yml                   # added when local Ollama / vector store land
```

`src/lib/` is the seam: every subsystem under it is server-only and framework-agnostic. The Phase 2 Electron shell will import the same modules from its main process; no rewrite required.

---

## 11. Build Roadmap

| Phase    | Build Work                                                                                                                                                                                                          | Exit Criteria                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Phase 0  | Repo, Node/TS env, cost cap module, logging skeleton, README, test framework (Vitest), prompt versioning + hash logging, calibration skeleton, Stuck Log template, Docker dev environment (added when Ollama lands) | Clean repo, tests run, cost caps enforce themselves |
| Phase 1A | Typed input → Claude/OpenAI → TTS playback                                                                                                                                                                          | First heartbeat of Jarvis                           |
| Phase 1B | Provider wrappers (OpenAI, Anthropic, Ollama)                                                                                                                                                                       | Same prompt routes through any provider via config  |
| Phase 1C | registry.yaml schema, loader, capability lookup                                                                                                                                                                     | Picking a model is a registry call, not a hardcode  |
| Phase 1D | Router skeleton: intent, safety, capability, cost — each testable independently                                                                                                                                     | Given 20 inputs, router picks correct tier on >90%  |
| Phase 2  | Local desktop tools, Build Log Mode, Self-Diagnostic v1                                                                                                                                                             | Useful daily assistant; self-diagnostic works       |
| Phase 3  | Memory + Obsidian, Demo Mode v1, Cost Dashboard live                                                                                                                                                                | Cross-session context; can demo on command          |
| Phase 4  | Voice interface (streaming STT/TTS, interrupts), Cross-Device Trigger                                                                                                                                               | Natural spoken interaction; triggerable from phone  |
| Phase 5  | Project assistant, Plugin Architecture refactor                                                                                                                                                                     | Jarvis helps build TripSplit, itself, others        |
| Phase 6  | Smart room (Hue, FancyLED, Nanoleaf, Tapo, Aqara), mock-first per device                                                                                                                                            | Bedroom is a responsive AI workspace                |
| Phase 7  | Vision layer (YOLOv8n, MediaPipe, Tesseract), Failure Replay                                                                                                                                                        | Jarvis can see desk and screen context              |
| Phase 8  | Daily self-audit, Scheduled Routines, Comparison Mode                                                                                                                                                               | Jarvis improves context, runs scheduled workflows   |
| Phase 9  | Dashboard, HUD, room visualisation, Interview Mode                                                                                                                                                                  | Polished and demoable in any interview              |

---

## 12. Smart Room Architecture

### Room States

| State                | Lighting                           | Jarvis Behaviour            |
| -------------------- | ---------------------------------- | --------------------------- |
| Focus mode           | Cool white desk + dim ambient blue | Short replies, task-focused |
| Gaming mode          | FancyLED sync + low ambient Hue    | Minimal interruptions       |
| Approval needed      | Blue pulse                         | Ask yes/no                  |
| No response reminder | Purple pulse after timeout         | Repeat concise prompt       |
| Error / build failed | Red pulse                          | Explain error and next fix  |
| Night mode           | Warm dim                           | Calm, low-energy replies    |

### Hardware Failure Modes

| Failure              | Detection                                     | Response                                        |
| -------------------- | --------------------------------------------- | ----------------------------------------------- |
| Hue bridge offline   | API timeout >2s                               | Fail soft, speak 'lights unreachable', continue |
| Aqara false-positive | Repeated trigger with no follow-up within 60s | Confidence decay; require corroborating signal  |
| Aqara false-negative | User speaks but no presence event             | Trust voice input over sensor                   |
| Camera covered       | Uniform frame or stream error                 | Disable vision tier, notify                     |
| HomePod unreachable  | Speaker discovery fails                       | Fall back to local laptop audio                 |

### Mock-First Hardware

Every hardware tool has a mock in `tools/room_tools/mocks/`. Mock is default in dev. Real hardware activates via config flag in `prod.yaml`.

---

## 13. Vision Layer

| Task                | Local Tool             | Cloud Fallback        | Trigger                            |
| ------------------- | ---------------------- | --------------------- | ---------------------------------- |
| Object detection    | YOLOv8n                | Claude/GPT vision     | Local confidence <0.6              |
| OCR (printed)       | Tesseract or PaddleOCR | Cloud vision          | Quality below threshold            |
| OCR (handwritten)   | PaddleOCR or TrOCR     | Cloud vision          | Always fallback if quality matters |
| Pose/gesture        | MediaPipe              | —                     | —                                  |
| Scene understanding | —                      | Cloud vision required | Always cloud                       |

All vision tasks on sampled frames (1 fps default), never continuous video.

---

## 14. Safety & Permission Model

| Action Type                    | Default Permission           |
| ------------------------------ | ---------------------------- |
| Safe local actions             | Allowed                      |
| Reversible edits               | Ask once per session/project |
| Destructive actions            | Always confirm               |
| External actions               | Always confirm               |
| Terminal commands              | Confirm unless whitelisted   |
| Cloud upload of sensitive data | Confirm                      |

**Emergency stop:** "Jarvis stop now" interrupts active workflows immediately.

---

## 15. Memory System

| Memory Type        | Stored In                    | Purpose                                    |
| ------------------ | ---------------------------- | ------------------------------------------ |
| Session logs       | SQLite + Obsidian daily note | What happened today                        |
| Project memory     | Obsidian project pages       | Repo state, decisions, roadmap             |
| Preference memory  | Local YAML/SQLite            | Style, tool choices, safety preferences    |
| Operational memory | Telemetry SQLite             | Model performance, cost, latency, failures |
| Vector memory      | Local Chroma/LanceDB         | Retrieve relevant past context             |

---

## 16. Cost Engineering

> **Phase 0 Requirement:** Cost caps implemented before Phase 1A closes. The orchestrator refuses requests that would breach caps. Non-negotiable.

- Hard caps: daily ($1 dev / configurable), weekly ($10), monthly ($30)
- No always-listening cloud voice early — push-to-talk only
- Cache repeated results: file summaries, common commands, room states
- Every model call logs estimated cost
- Budget mode: refuses expensive routes unless explicitly approved
- Autonomous loops: max-iteration, max-cost, timeout limits at orchestrator level
- Cost dashboard shows real-time burn per day/week/model/task

---

## 17. Telemetry Schema

Implemented in [src/lib/db/schema.ts](src/lib/db/schema.ts) as `telemetry_events`. Identical to the v3.1 sketch with one addition (`time_to_first_token_ms`, surfaced by Phase 1.5 streaming work) and `timestamp` stored as INTEGER ms-since-epoch for cheap range queries.

```sql
CREATE TABLE telemetry_events (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp                INTEGER NOT NULL,
  session_id               TEXT,
  event_type               TEXT NOT NULL,
  success                  INTEGER NOT NULL,
  intent                   TEXT,
  safety_tag               TEXT,
  tier                     TEXT,
  model_id                 TEXT,
  tool_name                TEXT,
  input_tokens             INTEGER,
  output_tokens            INTEGER,
  latency_ms               INTEGER,
  time_to_first_token_ms   INTEGER,
  cost_usd                 REAL,
  error_class              TEXT,
  user_rating              INTEGER,
  notes                    TEXT
);
CREATE INDEX idx_telemetry_timestamp ON telemetry_events (timestamp);
```

Populated today by [src/lib/telemetry/index.ts](src/lib/telemetry/index.ts) for: `validation_failure`, `rate_limited`, `cost_denied`, `model_call`, `provider_error`, `client_disconnect`. The `intent` / `safety_tag` / `tier` / `tool_name` / `user_rating` columns are reserved for router and safety phases; nullable today.

### 17.1 Self-Diagnostic Mode

Command: "Jarvis, audit yourself." Reports provider connectivity, registry validity, calibration scores, cost burn, telemetry health, sensor reachability, test suite status. Output to voice (summary) and Obsidian (full report).

### 17.2 Failure Replay

Replay decision tree from telemetry: `input → intent → safety → routed model → output → error or success`.

### 17.3 Comparison Mode

Same query through multiple models, side-by-side output, logged to telemetry. Powers calibration suite.

---

## 18. Testing & Quality Gates

### 18.1 Prompt Versioning

Prompts live in `prompts/` under git. Changes committed with `feat/prompt` or `fix/prompt`. Rollback = `git revert`. Every model call logs the prompt file hash.

### 18.2 Stuck Log Protocol

When stuck >2 hours:

1. Document what was tried, what failed, what was expected
2. Ask Claude/ChatGPT with the log as context
3. Time-box another 2 hours
4. If still stuck: document a workaround, move on, return later
5. Stuck logs → `docs/stuck_log/` → become interview material

### 18.3 Build Log Mode

Every meaningful commit auto-generates an Obsidian journal entry. Weekly digests → public LinkedIn build log.

---

## 19. Explicit Non-Goals

- Not a SaaS product
- Not always-listening before Phase 4 proves budget safety
- Not a code-generating IDE replacement — assists, doesn't auto-commit
- Not a smart home controller for the whole house — one bedroom workspace
- Not a phone assistant — desk and room first
- Not a learning system that fine-tunes models

---

## 20. Hardware Reality Check (16GB M4 MacBook Air)

| Component                               | Approx RAM |
| --------------------------------------- | ---------- |
| macOS baseline                          | 3-4 GB     |
| Chrome (10 tabs)                        | 2-3 GB     |
| VS Code + project                       | 1.5-2 GB   |
| Jarvis runtime (Node 20 / Next 16)      | 0.4-0.8 GB |
| Local 3B model (Ollama, out-of-process) | 2-3 GB     |
| Local 7B model                          | 4-5 GB     |

**Conclusion:** 16GB handles Jarvis + 3B model comfortably. 7B workable with limited browser tabs. 13B impractical. Phases 1-3: 16GB is fine. Node runtime is lighter than the original Python sketch; Ollama remains the dominant consumer when local models are loaded.

---

## 21. Local Model Options (2026)

Resolved via `registry.yaml` — not hardcoded.

| Task Class                         | Recommended Model              | Runtime |
| ---------------------------------- | ------------------------------ | ------- |
| Intent classification / extraction | Gemma 3n E4B or Qwen3 3B       | Ollama  |
| General reasoning (7B tier)        | Mistral Medium 3.5 or Qwen3 7B | Ollama  |
| Code assistance (local)            | Qwen3 Coder or Codestral       | Ollama  |
| Lightweight / fast                 | Gemma 3n E4B or Jan-Nano       | Ollama  |

Models update quarterly. The registry is the only file that changes.

---

## 22. Instructions for Future Audits

1. Is the architecture modular enough to support future model changes?
2. Are there hidden cost traps or runaway loop risks?
3. Is routing realistic on the chosen hardware?
4. Are safety gates strict enough?
5. Is the build order practical for the available time budget?
6. Which layer is most likely to fail in real implementation?
7. What latency budget is being missed?
8. What state could become inconsistent and how is it reconciled?

---

## 23. Differentiating Capability Set

| Capability           | What It Is                                          | Where It Lives          | Phase   |
| -------------------- | --------------------------------------------------- | ----------------------- | ------- |
| Cost Cap Module      | Hard limits enforced by orchestrator                | `core/cost_guard/`      | Phase 0 |
| Build Log Mode       | Auto-journals commits to Obsidian; public build log | `obsidian/build_log/`   | Phase 2 |
| Self-Diagnostic      | "Jarvis, audit yourself." Full system health report | `core/diagnostics/`     | Phase 2 |
| Cost Dashboard       | Real-time web view of API spend                     | `apps/dashboard/`       | Phase 3 |
| Demo Mode            | Scripted tour of capabilities, 30-60s segments      | `docs/demos/`           | Phase 3 |
| Cross-Device Trigger | Mobile web interface for commands away from desk    | `apps/mobile/`          | Phase 4 |
| Plugin Architecture  | Runtime-loaded capabilities, zero core changes      | `plugins/`              | Phase 5 |
| Failure Replay       | Replay decision trees from telemetry                | `core/diagnostics/`     | Phase 7 |
| Comparison Mode      | Same query through multiple models, side-by-side    | `core/diagnostics/`     | Phase 8 |
| Scheduled Routines   | Cron-like autonomous workflows                      | `core/scheduler/`       | Phase 8 |
| Interview Mode       | 3-5 min scripted demo flow for live interviews      | `docs/demos/interview/` | Phase 9 |

---

## 24. Immediate Next Actions

| Priority | Action                                              | Owner           |
| -------- | --------------------------------------------------- | --------------- |
| P0       | Move Jarvis folder out of OneDrive sync             | Prince          |
| P0       | Implement cost cap module before Phase 1A closes    | Prince + Claude |
| P0       | Set up daily commit habit + weekly Obsidian note    | Prince          |
| P1       | Phase 1B: provider wrappers                         | Prince + Claude |
| P1       | Phase 1C: registry.yaml + calibration skeleton      | Prince + Claude |
| P1       | Phase 1D: router skeleton (4 stages)                | Prince + Claude |
| P1       | Test suite skeleton + pre-commit hook               | Prince          |
| P1       | First build log video posted to LinkedIn            | Prince          |
| P1       | Docker dev environment for Mac migration            | Prince + Claude |
| P2       | Obsidian vault structure + session summary template | Prince          |
| P2       | Three-tier backup discipline                        | Prince          |
| P3       | Benchmark local models on MacBook                   | Prince          |
| P3       | Telemetry table + first dashboard query             | Prince + Claude |

---

_JARVIS Architecture v3.2 — Prince Anozie — 16 May 2026 (Path A reconciliation)_
