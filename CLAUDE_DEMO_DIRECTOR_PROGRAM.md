YOU ARE WORKING IN THE JARVIS REPO

Do not perform another UI audit.
Do not revisit UI.1-UI.10.

Read only:

- docs/architecture/UI_POLISH_PLAN.md
- docs/architecture/EXPANSION_ERA_V2.md
- current pipeline visualization implementation
- current command center surfaces

Implementation planning only. No code yet.

============================================================
GOAL
============================================================

Design two connected systems:

1. Live Pipeline Map
   A persistent, always-running interactive system map
   showing JARVIS architecture as six visual zones —
   each themed after an Infinity Stone — with real
   telemetry flowing through connections between them.
   This is a permanent Command Center surface.

2. Demo Director Program
   A system that records JARVIS demonstrating itself
   by orchestrating the Live Pipeline Map and other
   Command Center surfaces into a recruiter-grade export.

The Live Pipeline Map is the primary deliverable.
The Demo Director records it.

============================================================
THE GAUNTLET PRINCIPLE
============================================================

The map has one central truth:

The Human Gate is the Gauntlet wielder.

All six zones route through it.
No zone bypasses it.
All power answers to one hand.

The Human Gate node sits at the spatial centre
of the map. Every zone connects to it.
It is always visible. It never dims.

When a proposal is waiting:

- Human Gate glows bright white
- All connected pulses halt at the boundary
- The gate is the only thing moving
- Nothing executes until it decides

This is not decoration.
This is the architecture made visible.

============================================================
THE SIX ZONES — INFINITY STONE MAPPING
============================================================

Each zone has:

- a stone identity
- a colour
- a boundary shape inspired by that stone
- a spatial position on the map

---

ZONE 1 — SPACE STONE
Core Pipeline

---

Stone: Space (Tesseract)
Colour: #60A5FA (blue)
Shape: Rectangular channel — clean, linear, infinite
Position: Horizontal spine of the map

The fundamental path. Everything travels through space.
The void through which all data moves.

Nodes:

- Input Gateway
- Intent Classifier
- Safety Classifier
- Router
  └─ T0 (no model)
  └─ T1 (local fast)
  └─ T2 (local smart)
  └─ T3 (cloud mid)
  └─ T4 (cloud frontier)
- Human Gate (central node, connects all zones)
- Tool Runtime
- Audit Store

Visual behaviour:

- Pulses travel left to right along the spine
- Model tier nodes branch downward from Router
- Each tier glows when active
- Pulses stop at Human Gate boundary
- Resume on approval and continue to Tool Runtime

---

ZONE 2 — TIME STONE
Agent Ecosystem

---

Stone: Time (Eye of Agamotto)
Colour: #34D399 (emerald green)
Shape: Circular orbital — agents revolve like clock hands
Position: Upper left cluster

Agents are time-driven. Schedulers, routines,
periodic tasks. Time governs when they activate.

Nodes:

- Agent Coordinator (hub of the circle)
  └─ Life Coach Agent
  └─ Build Monitor Agent
  └─ Research Agent
  └─ CV Maintenance Agent
  └─ Job Scout Agent
  └─ Morning Brief Agent
  └─ Deadline Agent
  └─ Cost Monitor Agent
- Suggestion Inbox (exit node — connects to Human Gate)

Visual behaviour:

- Coordinator sits at centre of circle
- Agents arranged radially, orbiting it
- Scheduler tick activates relevant agent
- Agent output pulses from agent
  → Coordinator
  → Suggestion Inbox
  → Human Gate (halts, glows orange)
  → resumes on approval
- Inactive agents pulse gently at low opacity
  showing they are alive but waiting

---

ZONE 3 — MIND STONE
LLM Council

---

Stone: Mind
Colour: #FBBF24 (gold)
Shape: Hexagonal — six council members at vertices
Position: Upper right cluster

Multiple minds deliberating toward one synthesis.
The only zone where models see each other's work.

Nodes:

- Council Coordinator (activates the zone)
  └─ DeepSeek V4 Flash (cheap cloud 1)
  └─ Gemini Flash 2.0 (cheap cloud 2)
  └─ DeepSeek V4 Pro (smart cloud 1)
  └─ GPT-4o / GPT-5.5 (smart cloud 2)
  └─ llama3.2:3b (local 1)
  └─ qwen2.5:7b (local 2)
  └─ ChatGPT (assistant / pre-synthesis reviewer)
  └─ Claude Sonnet (Chairman — centre of the hexagon)

Visual behaviour:

Stage 1 — Independent answers:
All 6 council nodes activate simultaneously.
Parallel pulses visible at each vertex.
Provider labels hidden — nodes anonymous.

Stage 2 — Peer review:
Cross-pulses between council members.
Each reviews others. Edges light briefly
between all vertex pairs.

Stage 3 — Assistant review:
ChatGPT node activates.
Consolidation pulse sweeps inward to Chairman.

Stage 4 — Chairman synthesis:
Claude Sonnet node at hexagon centre glows.
Single synthesis pulse exits the zone
and re-enters Core Pipeline at Router.

Zone only activates for high-complexity queries.
Cost gate enforced before activation.

---

ZONE 4 — SOUL STONE
Memory Ecosystem

---

Stone: Soul
Colour: #FB923C (orange)
Shape: Teardrop / flame — organic, identity-forming
Position: Lower left

Memory is identity.
What JARVIS knows is what JARVIS is.
The soul persists across sessions.

Nodes:

- Obsidian Vault
- sqlite-vec (vector store)
- Knowledge Compounding Layer
- Librarian Agent
- LLM Wiki
- Session Memory
- Project Intelligence

Visual behaviour:

- Memory reads are low-intensity background pulses
  (always present, never dominant)
- Knowledge Compounding writes are approval-gated:
  pulse halts at Human Gate before vault write
- When a query triggers retrieval, a warm orange
  pulse sweeps from vault through vector store
  toward Router
- LLM Wiki generation glows brighter when
  new pages are being drafted

---

ZONE 5 — REALITY STONE
Room OS

---

Stone: Reality (Aether)
Colour: #F87171 (red)
Shape: Angular / crystalline — reality has sharp edges
Position: Lower right

Controlling physical reality.
Actual devices. Actual room. Actual lights.
The only zone that touches the physical world.

Nodes:

- Room Registry
- Device Adapters
  └─ Hue Bridge
  └─ FancyLED
  └─ Nanoleaf
  └─ Tapo Plugs
  └─ RuView Sensors (future)
- Theme Engine (UI + LED sync node)

Visual behaviour:

- Room commands pulse from Tool Runtime
  into this zone toward specific device nodes
- Theme change fires simultaneously to
  Theme Engine node AND all connected device nodes
  (the lights literally sync as you watch)
- "Jarvis systems check" fires a scan pulse
  that sweeps all Room OS nodes in sequence
  → nodes flash green briefly if healthy
  → nodes flash red if unreachable
- Fake adapters shown at lower opacity with
  a badge indicating mock status

---

ZONE 6 — POWER STONE
Fortress Layer

---

Stone: Power
Colour: #A78BFA (purple)
Shape: Hexagonal shield — protective, dominant
Position: Centre right, bordering all other zones

Raw capability under governance.
Security, defenses, adversarial testing.
The most dangerous zone — the most governed.

Nodes:

- Architecture Graph
- Telemetry Cockpit
- Governance Boundary Visualizer
- Red-Team Sandbox
  └─ CAI Manifest
  └─ CAI Adapter
  └─ CAI Execution Gate (locked — red indicator)

Visual behaviour:

- Fortress nodes pulse slowly at low intensity
  — always watching, always auditing
- Forbidden edge violations cause a sharp
  purple flash across the entire zone boundary
  then hold the affected edge red permanently
- CAI Execution Gate shows a locked icon
  at all times — never unlocked in demo mode
- Telemetry Cockpit node shows a live
  cost counter and event rate as metadata

============================================================
ZONE INTERACTION RULES
============================================================

Cross-zone connections:

Space ↔ Time:
Scheduler ticks enter Core Pipeline.
Agent outputs return via Suggestion Inbox → Human Gate.

Space ↔ Mind:
High-complexity query exits Router into Council.
Chairman synthesis re-enters at Router.

Space ↔ Soul:
Every model call triggers a Soul memory read.
Approved memory writes pass Human Gate → Soul.

Space ↔ Reality:
Approved room commands exit Tool Runtime → Reality.
Theme changes exit simultaneously to Reality.

Space ↔ Power:
Every telemetry event writes to Fortress.
Forbidden edges detected in Power trigger
visual alert in Space.

All cross-zone pulses are brighter and
longer-range than intra-zone pulses.
The viewer can follow a request visually
across every zone it touches.

============================================================
CENTRAL HUB — THE HUMAN GATE
============================================================

The Human Gate is not part of any zone.
It sits at the spatial centre of the map.
All six zones connect to it.
All power answers to one hand.

Visual specification:

Default state:

- Soft white glow
- All zone connection lines visible
- Shows governance posture metadata

Proposal waiting:

- Bright white pulse
- All inbound pulses halt at zone boundaries
- Connection lines brighten
- Counter shows time waiting
- Orange ring around the node

Approved:

- Green flash
- All paused pulses resume simultaneously
- Brief ripple across all connected zones

Denied:

- Red flash
- Paused pulses dissolve
- Event logged to Audit Store (visible)

This is the moment in every demo that proves
governance is not decorative.
Everything stops. One decision. Everything moves.

============================================================
DESIGN PRINCIPLE
============================================================

Cinematic first. Explanation second.

Visual impact
↓
Curiosity
↓
Explanation
↓
Trust

The first 30 seconds should impress.
The next 5 minutes should prove substance.

A viewer should be able to watch a request
travel from input through every zone it touches,
stop at the Human Gate, and complete on approval —
without reading a single line of documentation.

============================================================
DEMO DIRECTOR REQUIREMENT
============================================================

Command:

"Jarvis, generate demo [audience: recruiter|security|technical|general]"

JARVIS reads its own architecture docs, Obsidian vault,
phase log, test count, governance boundary state, build log.

LLM generates a bespoke demo script for the audience.
Script goes to Suggestion Inbox.
Prince approves.
Demo Director executes.

Demo sequence:

Black screen
↓
Orb wakes (idle → active state)
↓
Command Center boots
↓
Live Pipeline Map loads — all six zones appear
sequentially like stones being placed in the Gauntlet
↓
Human Gate ignites at centre — connects all zones
↓
Example request travels through Core Pipeline
touching each zone it activates
↓
Agent Ecosystem fires — agents pulse in their orbits
↓
LLM Council activates — six parallel deliberations visible
↓
Human Gate halts everything — glows bright
↓
Approval granted — all zones resume
↓
Room OS zone pulses — lights respond in real room
↓
Fortress zone shows governance audit completing
↓
Full Gauntlet assembled — all six zones active
↓
Summary generated by JARVIS narrating its own architecture
↓
Video exported

Audience routing:

security:

- Human Gate depth
- Fortress zone (CAI sandbox, forbidden edges)
- Approval lifecycle detail
- Trust class visibility per zone

recruiter:

- Velocity (test count, phase timeline)
- Full Gauntlet assembled visually
- Agent ecosystem scope
- Build log narrative

technical:

- Council deliberation sequence
- Model routing tier decisions
- Telemetry cost breakdown per zone
- Cross-zone interaction mechanics

============================================================
VOICE REQUIREMENT
============================================================

Dedicated demo-grade voice stack.

Primary: Chatterbox Turbo (MIT, emotion control)
Fallback: Kokoro (82M params, sub-100ms)
Mac-only: Qwen3-TTS via MLX (voice design)

Pre-MacBook fallback must be specified in design.

============================================================
OUTPUT PACKAGE
============================================================

demo.mp4
screenshots/
transcript.md
release-notes.md
linkedin-post.md
architecture-summary.md

============================================================
SAFETY AND GOVERNANCE CONSTRAINTS
============================================================

Live Pipeline Map:

- Read-only. No execute/approve/mutate buttons.
- No raw payloads in any zone — metadata only
- Demo Mode reads synthetic data only
- Cannot read live tables in demo mode
- Zone visualizations never expose secrets

Demo Director:

- All scripts approval-gated
- No auto-execution
- No autonomous sharing or posting
- Export requires approval before publish

============================================================
DO NOT IMPLEMENT
============================================================

No code.
No dependencies.
No Phase 22 work.
No wake word.
No conversation mode.
No authority changes.

Design only.

============================================================
FINAL RESPONSE
============================================================

1. Live Pipeline Map architecture
   (six-zone spatial layout, Gauntlet principle,
   Human Gate as central hub, telemetry wiring)

2. Zone-by-zone specification
   (all nodes, shapes, colours, pulse behaviour,
   cross-zone connections)

3. Human Gate specification
   (central hub design, all approval states,
   cross-zone halt and resume behaviour)

4. Demo Director architecture
   (Gauntlet assembly sequence, audience routing,
   script generation, approval gate)

5. Voice stack recommendation

6. Recording and export recommendation

7. Governance requirements for both systems

8. Suggested implementation sequence
   (Human Gate first, then zones outward:
   Space → Time → Mind → Soul → Reality → Power)

9. Estimated effort
