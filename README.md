# JARVIS

> A personal AI operating environment. Multi-model orchestration for voice, reasoning, room control, and project execution.

**Status:** Phase 1A — Typed core loop working (typed input → Claude reasoning → OpenAI TTS → audio playback)
**Build log:** May 2026 → graduation (July 2027)
**Stack:** Python · Anthropic Claude · OpenAI · Ollama (local models) · SQLite

---

## What this is

JARVIS is a local-first AI assistant being built from scratch as a final-year project at Manchester Metropolitan University. It orchestrates multiple AI providers (Claude, OpenAI, local models via Ollama) behind a unified router, with a focus on quality-bounded routing, cost discipline, safety gates, and observability.

The end-state goal: a real personal AI environment that runs my desk and room, helps with project work, briefs me on news, controls lighting and sensors — all while staying under £20/month in API costs.

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

- `jarvis.py` accepts typed input from terminal
- Sends to Claude (Sonnet 4.5) with a system prompt
- Maintains conversation history within the session
- Streams response back through OpenAI TTS (Onyx voice)
- Plays audio through speakers
- Clean error handling — one failure doesn't kill the session

That's it for now. Layer 1A is deliberately minimal. The hard part starts at Phase 1B.

## Architectural principles

The full architecture document is private during early development and will be opened up later. High-level commitments:

- **Local-first with quality guarantees** — local models handle tasks only when they match frontier-model quality on a calibration suite
- **Model-agnostic routing** — a `registry.yaml` resolves capability requests to the cheapest model that meets the quality bar; provider names are not hardcoded
- **Streaming by default** — voice responses start playing before the LLM finishes generating
- **Safety gates** — destructive actions require explicit confirmation and are logged
- **Cost-bound from Phase 0** — hard daily/weekly/monthly spending caps enforced by the orchestrator itself
- **Mock-first hardware** — room control logic testable without any device connected
- **Observable to itself** — self-diagnostic, failure replay, and comparison mode are core, not future features
- **State is explicit** — no implicit cross-session state; persistence is named and bounded

## Roadmap

| Phase | Capability                                                 | Status      |
| ----- | ---------------------------------------------------------- | ----------- |
| 0     | Foundations, cost caps, test framework, Docker dev env     | In progress |
| 1A    | Typed core loop (typed → Claude → TTS)                     | ✓           |
| 1B    | Provider wrappers (OpenAI, Anthropic, Ollama)              | Next        |
| 1C    | Model registry + calibration suite                         | Planned     |
| 1D    | Router (intent, safety, capability, cost stages)           | Planned     |
| 2     | Local desktop tools (files, apps, documents)               | Planned     |
| 3     | Memory + Obsidian integration                              | Planned     |
| 4     | Voice interface (streaming STT, streaming TTS, interrupts) | Planned     |
| 5     | Project assistant (repo inspection, test runner, patches)  | Planned     |
| 6     | Smart room (Hue, presence sensors, ambient feedback)       | Planned     |
| 7     | Vision layer (YOLOv8n, MediaPipe, OCR)                     | Planned     |
| 8     | Daily self-audit + scheduled routines                      | Planned     |
| 9     | Dashboard, demo mode, interview mode                       | Planned     |

## Tech stack

| Layer                            | Tools                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| Language                         | Python 3.11+                                                           |
| Cloud AI                         | Anthropic Claude Sonnet 4.5, OpenAI (GPT-4, Whisper, TTS)              |
| Local AI runtime                 | Ollama                                                                 |
| Local models (registry-resolved) | Qwen3, Mistral, Gemma, Hermes                                          |
| Storage                          | SQLite (telemetry, sessions), Chroma (vector), Obsidian (memory vault) |
| Vision (future)                  | YOLOv8n, MediaPipe, Tesseract / PaddleOCR                              |
| Hardware (future)                | Philips Hue, Aqara FP2, Nanoleaf, Tapo, HomePod mini                   |
| Dev / infra                      | Docker, pytest, pre-commit hooks                                       |

## Setup

> Setup will expand as phases ship. Currently supports Phase 1A only.

```bash
# Clone
git clone https://github.com/princeanozie25-web/JARVIS.git
cd JARVIS

# Install dependencies
pip install -r requirements.txt

# Configure secrets
cp .env.example .env
# Add ANTHROPIC_API_KEY and OPENAI_API_KEY to .env

# Run
python jarvis.py
```

Type a message. Listen to Jarvis reply. Type `exit` to quit.

## About

Built by **Prince Anozie** — final-year Cyber Securityy student at Manchester Metropolitan University, focused on the intersection of cybersecurity and AI engineering.

- LinkedIn: [linkedin.com/in/princeanozie](https://linkedin.com/in/princeanozie)
- GitHub: [@princeanozie25-web](https://github.com/princeanozie25-web)

---

_This is a public build log. Demo videos and progress updates are posted monthly on LinkedIn. If you're a recruiter and want to see something specific running, [reach out](https://linkedin.com/in/princeanozie) — I can demo whatever phase is current._
