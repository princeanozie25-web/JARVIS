# Expansion Era v2 Roadmap

> **SUPERSEDED (2026-09-01)** by the JARVIS Master Architecture & Delivery Roadmap v5.1.
> This 03-Jun-2026 planning doc predates the Phase 22/23/24 execution and numbers the
> future differently — it assigns 24 = "Local T2 Promotion", 25 = "Sensing/Security",
> 26 = "Mobile JARVIS" — a sequence already invalidated when Phase 24 opened and froze as
> the MCP Gateway. Retained for history only; do NOT use its phase numbering. Authoritative
> v5 numbering: 25 = Productionization, 26 = Presence/Voice, 27 = Vision/Spatial,
> 28 = Local Intelligence/Council, 29 = Smart Room, 30 = Mobile/Node Fabric.
> See docs/audits/V5_ENTRY_AUDIT.md §1.

Status: active after Phase 21 refresh  
Date: 03 June 2026

## Purpose

Expansion Era v2 starts from the actual repository state after Phase 21, not the original aspirational sequence. Phase 21 is complete. The next work is UI refurbishment, then MacBook-dependent Phase 22+ work.

## What Is Complete

Phase 1-20 are complete as the governance and operationalization substrate.

Phase 21 is complete across:

- 21A Verification Agent
- 21B Google Stack
- 21C Morning Brief
- 21D Telegram
- 21E Social Media Extraction
- 21F Live Council
- 21G Knowledge Compounding
- 21H Agent Suite
- 21I Job Scout
- 21J Graphify
- 21K Pipeline Visualization

## What Is Operationally Validated

Operationally validated:

- 21E Social Media Extraction

Validated smoke path:

```text
https://www.youtube.com/watch?v=jNQXAC9IVRw
-> yt-dlp 2026.03.17
-> ffmpeg/ffprobe 8.1.1
-> faster-whisper:tiny
-> multimodal packet
-> deterministic analysis
-> temp cleanup
```

Other Phase 21 capabilities are realized or execution-enabled through tests and injected/adapter boundaries, but are not marked operationally validated unless a real runtime smoke exists.

## Classification Model

Use the strongest true classification:

1. Foundation Complete: contracts, schemas, planners, or previews exist.
2. Workflow Complete: end-to-end planned or simulated workflow exists, but no real execution.
3. Realized: real integration or workflow exists through injected/adapter boundaries, with a visible or inspectable result.
4. Execution Enabled: guarded execution exists behind approval, consent, cost gate, final confirmation, or explicit user trigger.
5. Operationally Validated: runtime dependency is installed/configured and at least one real smoke run passed.

## Phase 21 Final Classification

| Area                        | Classification          |
| --------------------------- | ----------------------- |
| 21A Verification Agent      | Realized                |
| 21B Google Stack            | Execution Enabled       |
| 21C Morning Brief           | Execution Enabled       |
| 21D Telegram                | Realized                |
| 21E Social Media Extraction | Operationally Validated |
| 21F Live Council            | Execution Enabled       |
| 21G Knowledge Compounding   | Execution Enabled       |
| 21H Agent Suite             | Execution Enabled       |
| 21I Job Scout               | Execution Enabled       |
| 21J Graphify                | Realized                |
| 21K Pipeline Visualization  | Realized                |

## UI Polish Program Placement

UI Polish is the next program after this refresh and before Phase 22.

Reason:

- Phase 21 now has enough real workflows to deserve a stronger Command Center surface.
- `DESIGN.md` and `PRODUCT.md` define the design direction.
- The current UI still contains legacy chatbot composition and generic panel/card patterns.
- Recruiter/demo value is highest if the next visible pass makes JARVIS look like the governed command center it has become.

Minimum sequence:

1. UI.1 interface-design readiness and design token inventory.
2. UI.2 design tokens.
3. UI.3 typography.
4. UI.4 remove generic chatbot UI.
5. UI.5 motion.
6. UI.6 orb state machine.
7. UI.8 cockpit layout.

Do not start implementation until the UI Polish Plan is added or confirmed as the authoritative external artifact.

## Phase 22+ Sequencing

After UI Polish closeout:

1. Phase 22 Voice Overhaul
   - local wake word
   - conversation mode
   - T0-T3 voice authority enforcement
   - standing consent
   - no cloud wake word
   - no pre-wake audio storage

2. Phase 23 Video Vision
   - real camera path
   - user-triggered capture
   - no background camera
   - no raw frame telemetry

3. Phase 24 Local T2 Promotion
   - MacBook calibration
   - qwen/local-smart promotion by task class
   - no silent cloud/local routing changes

4. Phase 25 Sensing and Security
   - RuView observe-only sensing
   - identity confidence gates
   - Real CAI Execution only if explicitly opened

5. Phase 26 Mobile JARVIS
   - Tauri iOS
   - desktop remains governance truth
   - no long-lived mobile approval state

## What Is Deferred

Deferred until explicit future openings:

- autonomous council triggering
- persistent Council run viewer
- automatic provider benchmarking
- richer Telegram media, voice, files, groups, and mobile workflows
- automated Graphify execution
- graph-driven execution
- social extraction bulk download or background watching
- Job Scout scraping, unsupervised Playwright automation, and auto-apply
- Drive writes
- real RuView integration
- Real CAI Execution
- MacBook-only local voice/model/camera/mobile work

## What Must Not Be Reopened

Do not reopen:

- Phase 1-20 governance substrate
- approval lifecycle authority model
- metadata-only telemetry rules
- no raw payload telemetry
- no silent writes
- no auto-execution
- no graph-driven execution
- cloud-disabled-by-default posture
- adapter/injected-runner boundaries
- Voice T3 manual-only policy

## Next Recommended Sequence

1. Commit Expansion Era Refresh.
2. Start UI.1 interface-design readiness and token inventory.
3. Add or check in the authoritative UI Polish Plan before UI implementation.
4. Complete UI Polish Program closeout.
5. Open Phase 22 only after UI closeout and MacBook readiness.
