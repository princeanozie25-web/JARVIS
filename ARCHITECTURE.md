# JARVIS — Master Architecture & Delivery Roadmap

**Version:** 3.1  
**Owner:** Prince Anozie  
**Last Updated:** 14 May 2026  
**Companion doc:** PREMORTEM.md

---

> **Executive Position:** v3.1 is the result of two successive audits (v2 → v3 Opus audit, v3 → Pre-Mortem audit). Every weakness found was fixed. No features were cut. The system gets stronger at each revision, not smaller.

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

Provider wrappers in `models/providers/` implement a common interface. The registry is the only file that needs updating when a model changes.

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

| State Type                   | Store                                | Rationale                               |
| ---------------------------- | ------------------------------------ | --------------------------------------- |
| Session conversation history | SQLite (jarvis.db)                   | Structured, queryable, survives restart |
| Telemetry events             | SQLite or local Parquet              | Append-heavy, queryable for self-audit  |
| Logs (raw)                   | Rotating log files in logs/          | Easy to grep                            |
| Hot session state            | In-memory dict, optional Redis later | Fast access, recreatable on restart     |
| Memory summaries             | Obsidian markdown files              | Human-readable, vault-searchable        |
| Vector embeddings            | Local Chroma or LanceDB              | Cheap, fast, no external dependency     |
| Configuration                | .env + YAML files in config/         | Version-controllable                    |
| Prompts                      | Files in prompts/ under git          | Versioned, diff-able, roll-back-able    |

---

## 10. Repository Structure

```
jarvis/
  apps/
    desktop/                 # Electron or local UI later
    api/                     # FastAPI local server
    dashboard/               # cost + telemetry dashboard
    mobile/                  # cross-device trigger interface
  core/
    orchestrator/            # central coordinator
    router/                  # intent, safety, capability, cost stages
    safety/                  # permission policies and confirmation flows
    memory/                  # session, project, preference, vector
    telemetry/               # logs, costs, traces, metrics
    streaming/               # LLM and TTS streaming helpers
    diagnostics/             # self-diagnostic, failure replay, comparison
    cost_guard/              # hard caps, budget enforcement
    scheduler/               # cron-like scheduled routines
  plugins/                   # runtime-loaded capability extensions
    example_plugin/
  tools/
    os_tools/
    document_tools/
    project_tools/
    room_tools/
      mocks/                 # mock implementations of each hardware tool
    vision_tools/
      mocks/
    browser_tools/
  models/
    providers/               # openai.py, anthropic.py, ollama.py, gemini.py
    registry.yaml            # capability registry — source of truth
    calibration/             # calibration suites per task class
  prompts/                   # versioned, git-tracked
    jarvis_system.md
    router_policy.md
    safety_policy.md
    audit_prompt.md
  config/
    dev.yaml
    prod.yaml
    routines.yaml
  scripts/
    run_calibration.py
    cost_report.py
    stuck_log_template.md
  infra/                     # docker compose, deployment configs
  obsidian/
    templates/
    build_log/
  tests/
  docs/
    ARCHITECTURE.md          # this file
    PREMORTEM.md
    decisions/               # ADRs
    runbooks/
    demos/
  data/                      # gitignored
  .env.example
  docker-compose.yml
  README.md
```

---

## 11. Build Roadmap

| Phase    | Build Work                                                                                                                                                       | Exit Criteria                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Phase 0  | Repo, Python env, cost cap module, logging skeleton, README, test framework, prompt versioning, calibration skeleton, Stuck Log template, Docker dev environment | Clean repo, tests run, cost caps enforce themselves |
| Phase 1A | Typed input → Claude/OpenAI → TTS playback                                                                                                                       | First heartbeat of Jarvis                           |
| Phase 1B | Provider wrappers (OpenAI, Anthropic, Ollama)                                                                                                                    | Same prompt routes through any provider via config  |
| Phase 1C | registry.yaml schema, loader, capability lookup                                                                                                                  | Picking a model is a registry call, not a hardcode  |
| Phase 1D | Router skeleton: intent, safety, capability, cost — each testable independently                                                                                  | Given 20 inputs, router picks correct tier on >90%  |
| Phase 2  | Local desktop tools, Build Log Mode, Self-Diagnostic v1                                                                                                          | Useful daily assistant; self-diagnostic works       |
| Phase 3  | Memory + Obsidian, Demo Mode v1, Cost Dashboard live                                                                                                             | Cross-session context; can demo on command          |
| Phase 4  | Voice interface (streaming STT/TTS, interrupts), Cross-Device Trigger                                                                                            | Natural spoken interaction; triggerable from phone  |
| Phase 5  | Project assistant, Plugin Architecture refactor                                                                                                                  | Jarvis helps build TripSplit, itself, others        |
| Phase 6  | Smart room (Hue, FancyLED, Nanoleaf, Tapo, Aqara), mock-first per device                                                                                         | Bedroom is a responsive AI workspace                |
| Phase 7  | Vision layer (YOLOv8n, MediaPipe, Tesseract), Failure Replay                                                                                                     | Jarvis can see desk and screen context              |
| Phase 8  | Daily self-audit, Scheduled Routines, Comparison Mode                                                                                                            | Jarvis improves context, runs scheduled workflows   |
| Phase 9  | Dashboard, HUD, room visualisation, Interview Mode                                                                                                               | Polished and demoable in any interview              |

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

```sql
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              TEXT    NOT NULL,
  session_id      TEXT    NOT NULL,
  event_type      TEXT    NOT NULL,
  intent          TEXT,
  safety_tag      TEXT,
  tier            TEXT,
  model_id        TEXT,
  tool_name       TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        REAL,
  latency_ms      INTEGER,
  success         INTEGER,
  error_class     TEXT,
  user_rating     INTEGER,
  notes           TEXT
);
```

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

| Component               | Approx RAM |
| ----------------------- | ---------- |
| macOS baseline          | 3-4 GB     |
| Chrome (10 tabs)        | 2-3 GB     |
| VS Code + project       | 1.5-2 GB   |
| Jarvis runtime (Python) | 0.5-1 GB   |
| Local 3B model (Ollama) | 2-3 GB     |
| Local 7B model          | 4-5 GB     |

**Conclusion:** 16GB handles Jarvis + 3B model comfortably. 7B workable with limited browser tabs. 13B impractical. Phases 1-3: 16GB is fine.

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

_JARVIS Architecture v3.1 — Prince Anozie — 14 May 2026_
