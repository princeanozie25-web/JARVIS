# JARVIS COMMAND CENTER — DESIGN BRIEF v3.1 (2026-09-04)

> v3.1 = v3 with the UX architecture in front of it. Part A says where
> things live and why, how attention is routed, how you move, and what every
> state looks like. Part B (unchanged from v3) is the visual system and the
> component sourcing. CC reads A before B; a surface built without its place
> in A is rejected at the design read.

> **v3.2 — operator amendment (2026-09-04, after seeing U.3/U.4 live).**
> Three changes to Part B §2, decided by the operator against a reference
> image of a physical arc reactor: (1) the Night field is **TRUE BLACK
> `#000000`** (not `#06122B`); surfaces sit barely above it (`#04091a`,
> hairline `#101c3a`); (2) the accent and the Core's heart are **deeper,
> wide-gamut blues** — sRGB `#2f7bff` / `#9fdcff` lifted into `display-p3`
> where the panel supports it; amber stays sRGB so the Gate reads the same
> everywhere; (3) **no wordmark behind the Core** — the name appears once,
> small, in the nav. The Core reads as a layered reactor (housing rings,
> segmented blades, inner ring, cyan-white heart, bloom), not a line drawing.
> Everything else in §2 stands. Recorded as registry row E-032.

> **Banked 2026-09-04 (runway, post-R.2).** This is the Program U input the
> Roadmap v5.1 §9 cites as `UI_CAPSTONE_BRIEF.md`. Runway inputs for U.1:
> `docs/audits/V5_REAL_VS_SYNTHETIC_CHECK.md` is the capstone's may-render
> table; `docs/audits/V5_ENTRY_AUDIT.md` §5 is the current UI reality. Note
> §1 (fonts) supersedes the shipped Fraunces decision recorded in
> `docs/architecture/UI_POLISH_PLAN.md`; U.2 makes that change, not this file.

---

# PART A — UX ARCHITECTURE

## A0. The five UX laws (every decision below descends from these)

1. **One centre.** There is exactly one place that ever demands your
   attention: the Core. Everything else is peripheral until you turn to it.
2. **Attention is routed by consequence, not by recency.** What can change
   the world goes to the centre; what informs goes to the edge; what merely
   happened goes to the log. (This is the Playroom interrupt ladder —
   BLOCKER / DECISION / FYI — applied to a single-principal room.)
3. **Silence by default.** Agents do not speak unprompted. A quiet screen
   means "nothing needs you," and that must be true.
4. **Spatial constancy.** Things live in fixed places and move between them
   with visible motion. You should be able to find anything with your eyes
   closed after one day.
5. **Everything is one keystroke away and nothing is more than two deep.**
   The command palette is the second navigation; the pill nav is the first;
   there is no third.

## A1. The object model (what exists, in the user's language)

| Object       | What it is to you                                                             | Where it lives                             | Backed by                                           |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| **Agent**    | A named colleague with a job (Builder, Researcher, Scout, Observer, Reviewer) | Left rail (presence), Standup (voice)      | `agent-runtime` profiles → WorkerProfile v1         |
| **Proposal** | Something an agent wants to do that touches the world                         | The Core → Notice Board (Gate card)        | `approvals` row / CanonicalProposal (FC-1/FC-2)     |
| **Task**     | A unit of work an agent is on or waiting on                                   | Standup (task chips), Rooms (lane nodes)   | TaskEnvelope v1 / WorkflowBox nodes                 |
| **Room**     | A project: its lane, its map, its nodes                                       | Right rail → Rooms panel                   | WorkflowBox store (LIVE)                            |
| **Message**  | Something an agent said, to you or to another agent                           | Standup                                    | audit/telemetry events now → WorkerMessage v1 later |
| **Notice**   | A commitment-shaped fact: receipt, promotion, mandate, handoff                | Notice Board                               | audit chain + Suggestion/Promotion inbox            |
| **Voice**    | The mic and the mouth                                                         | Voice pill (bottom-left), Core (listening) | E-011 layer, standing consent                       |
| **Spend**    | What today cost                                                               | Bottom-right                               | telemetry cost (or honest "no data")                |
| **Evidence** | The proof: pipeline, audit chain, receipts, drills                            | Evidence panel                             | existing audit cockpits                             |

There is no "chat with JARVIS" object. Talking to JARVIS is talking _in the
room_ — the composer is one composer, and JARVIS is one more participant in
Standup with a distinct voice. That is what removes the chatbot.

## A2. Information architecture (the map)

```
CORE (home, always underneath)
 ├─ Left rail   — AGENTS (presence) ──► Agent transcript (drawer)
 ├─ Right rail  — ROOMS (thumbnails) ──► Room panel: lane · map · nodes
 ├─ Bottom-left — VOICE pill          ──► Voice sheet: consent grants, engine health
 ├─ Bottom-right— SPEND               ──► Spend sheet: today, by agent, caps
 └─ Pill nav:  Core · Standup · Board · Rooms · Evidence
      Standup  — the agents' channel (threads by task; @you; cost inline)
      Board    — Gate cards (waiting) · Sealed cards (receipts, promotions, mandates)
      Rooms    — same as right rail, full width
      Evidence — pipeline map · audit chain · drills · telemetry (read-only)
 ⌘K  Command palette — go anywhere, act on anything the Gate allows
```

Depth rule: Core (0) → panel (1) → drawer/sheet inside a panel (2). Nothing
opens a third layer; if it needs one, it's a page in Evidence.

## A3. Attention routing (what goes where, and what it may do to you)

| Level        | Meaning                                                       | Where it appears                                              | What it may do                                     | Example                                              |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| **BLOCKER**  | An agent cannot proceed without you                           | Core turns amber + count; Gate card on Board; push (Phase 30) | Interrupt: the Core pulses; a sound if voice is on | Proposal to push a branch; a mandate expired mid-run |
| **DECISION** | Something waits for you, but work continues on other branches | Board badge; Core status line                                 | Never interrupts; visible until answered           | Promotion inbox item; a handoff request              |
| **FYI**      | Something happened                                            | Standup message; daily digest                                 | Silent; scroll to read                             | Task completed; cost update; monitor unchanged       |

Rules: only a real row in the approval store can create a BLOCKER. A demo
card is a demo card, labelled, and cannot turn the Core amber. Nothing times
out into an approval. Unanswered BLOCKERs hold their task; the agent goes
quiet. You can downgrade a BLOCKER to DECISION with one tap (the agent is
told, and it costs the agent's interrupt budget when budgets exist).

## A4. Navigation model

- **Pill nav** (mouse/touch, 5 items) and **⌘K** (keyboard) are the two
  routes. ⌘K is `cmdk` (the palette shadcn's `Command` is built on): go to a
  panel, open a room, jump to an agent, filter Standup, "approve waiting"
  (opens the Gate card — never approves from the palette itself).
- **Escape always returns to the Core.** From anywhere, in one press.
- **Rails are shortcuts, panels are destinations.** Clicking a rail item opens
  a drawer over the Core (depth 1); the panel is the same content full-width.
- **Number keys 1–5** = pill items. `/` focuses the composer. `A` opens the
  first waiting Gate card. `M` toggles mic (PTT hold to talk).
- **Back is spatial**: a drawer closing slides back to its rail; a panel
  closing shrinks to the pill. Motion's `layoutId` moves the _same_ element,
  so the eye tracks it (constancy).

## A5. The composer (one input, three intents)

One composer, docked bottom-centre when Standup or Core is showing.

- Plain text → to the room (JARVIS answers; agents only if @-tagged).
- `@builder …` → summons that agent (one turn per summon; silent otherwise).
- `/` → commands: `/room`, `/freeze` (halts all agent side effects — a
  human-only emergency stop), `/digest`, `/theme`.
- PTT: hold `M`; the Core enters _listening_; transcript appears in the
  composer before it is sent — you see what was heard before it goes.

## A6. Flows (the ones that must feel effortless)

**Approve a proposal (the money flow).** Core turns amber, count "1" →
press `A` (or click the Core) → the Gate card slides up from the Board:
_what the server derived it will do_ (FC-1), tier, dry-run diff, expiry,
which agent, why → Approve / Deny / Downgrade → the card seals (receipt
animation, a sealed card lands on the Board) → the Core returns to idle.
Two seconds, zero hunting. Deny asks for one line of reason, optional.

**Read what the agents are doing.** Press `2` → Standup, threads grouped by
task, latest at bottom, agent messages in their voice (mono, fenced, tinted),
JARVIS's summaries in the system voice; each message shows cost; a task chip
at the top of each thread shows working / waiting / done.

**Open a room.** Click a thumbnail on the right rail → the lane drawer; press
the expand icon → full Rooms panel with the mind-map. Editing a node is a
proposal if it changes anything an agent will act on; renaming is not.

**Teach and promote (Track D, designed now).** A demonstration ends → a
candidate appears on the Board as DECISION ("Promote as a procedure?") with
replay + canary results → Promote / Quarantine. Promotion is the human's
click; the candidate cannot self-promote.

**Freeze.** `/freeze` or the red stop in the voice sheet → every agent goes
to _blocked_, the Core holds amber without pulsing, a "frozen" band appears
under the nav. Un-freeze is a deliberate second action.

## A7. States (every surface has all five; empty is designed, not blank)

| State           | Core                                                | Standup                                  | Board                            | Rooms                                       | Rails                           |
| --------------- | --------------------------------------------------- | ---------------------------------------- | -------------------------------- | ------------------------------------------- | ------------------------------- |
| Empty           | idle breath, "Nothing waiting"                      | "Your agents are quiet." + how to summon | "Nothing to decide."             | "No rooms yet — say what you're working on" | agents shown asleep             |
| Loading         | ring holds, no status line                          | skeleton rows (no shimmer spam)          | skeleton cards                   | skeleton lane                               | marks dim                       |
| Live            | as designed                                         | streaming blur-in                        | cards pinned                     | LIVE label                                  | states from runtime             |
| Synthetic       | never amber; status "demo"                          | `SYNTHETIC` provenance chip per thread   | chips on demo cards              | `SAMPLE` label                              | static roles                    |
| Error / offline | single red flare, then idle + "sidecar down: piper" | banner at top, history stays readable    | cards readable, actions disabled | read-only                                   | marks grey with reason on hover |

Offline never silently degrades authority: if the approval store is
unreachable, the Gate card shows "cannot approve right now" — it does not
disappear.

## A8. Ambient vs focal (what you notice without looking)

Ambient (always visible, never demanding): Core state, presence marks, voice
pill, spend, a thin activity ticker under the nav showing the last three
FYIs in 12px mono. Focal (you choose to open): everything else. The test:
glance at the screen from across the room — you should know whether anything
needs you, who is working, and whether the mic is hot. Nothing else needs
to be readable from there.

## A9. UX libraries and patterns (what exists for this)

There is no library for information architecture; there are components and
patterns, and this is what we use for the UX layer specifically:

| Need                       | Use                                                                                                                                                                            | Provenance                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Command palette            | `cmdk` via shadcn `Command`                                                                                                                                                    | shadcn first-party        |
| App shell / rails          | shadcn `Sidebar` blocks as the rail skeleton (collapsible, keyboard-aware), re-themed                                                                                          | shadcn first-party        |
| Drawers / sheets / dialogs | shadcn `Sheet`, `Drawer` (Vaul), `Dialog` on Radix/Base UI                                                                                                                     | first-party; a11y handled |
| Spatial constancy          | Motion `layoutId` shared-layout transitions                                                                                                                                    | Motion official docs      |
| FYI notifications          | `sonner` toasts, bottom-left, auto-dismiss, never for BLOCKER/DECISION                                                                                                         | shadcn default            |
| Graph/mind-map             | React Flow (xyflow) via AI Elements Workflow canvas — U.4 decides vs the existing SVG                                                                                          | Vercel / xyflow           |
| Data model for Standup     | AI SDK message _parts_ (text, reasoning, tool, task, data) — one schema for JARVIS and agents                                                                                  | Vercel                    |
| Approval flow shape        | AI SDK human-in-the-loop helpers (pause a tool call / require approval) as the UI-side model; the actual authority stays in `resumeApproval`                                   | Vercel / shadcn docs      |
| Patterns, not libraries    | Linear's inbox triage (one queue, keyboard-first), Raycast's palette-first navigation, Slack's channel/thread model for Standup, mission-control "one hero instrument" layouts | reference only            |

Reference apps to study in U.1's design read (patterns, not pixels): Linear
(triage + keyboard), Raycast (palette-first), Arc (rails + spatial constancy),
Slack threads (Standup), Nike product page (hero composition).

## A10. What A fixes and what U.1 may adjust

Fixed: the five laws, the object model, the depth rule, the attention ladder
and its "only real proposals make amber" rule, Escape-to-Core, one composer,
the approve flow, the state table, ambient-vs-focal.

U.1 may adjust: rail widths, the exact ⌘K verb list, whether Rooms is a
panel or a drawer-first surface, the ticker's presence in Day theme.

---

# PART B — VISUAL SYSTEM AND SOURCING (v3, unchanged)

---

## 0. The experience

You open JARVIS and one thing is on screen: **the Core** — an arc-reactor
ring at the centre of a deep-blue field, breathing slowly, with the
wordmark set huge behind it. That ring _is_ the Human Gate. It is calm
when nothing needs you. It warms to amber and tightens its pulse when an
agent has proposed something and is waiting. You never hunt for approvals;
the room's centre tells you.

Around the Core, your agents are visible as presence — small lit marks on
the left rail: Builder working, Researcher waiting, Scout asleep. They talk
to each other in **Standup**, a channel you can read like a group chat
between colleagues: handoffs, results, questions, cost. You are @-taggable
there; they are silent unless there is something to say. Anything
commitment-shaped — a proposal, a promoted procedure, a receipt — lands on
the **Notice Board** as a pinned card, not as chat noise.

Your projects live on the right rail as rooms (WorkflowBox lanes). Voice
state is a single pill. Cost is a single number. Evidence — the pipeline,
the audit chain, the receipts — is one keystroke away and reads like a
clean instrument panel, never like a dashboard template.

It should feel like Nike's product page felt to you: one hero object,
massive type behind it, a restrained pill nav, rails not grids, one accent
colour, and motion that is _alive but never busy_. Simple. Premium.

Two themes, one Core. **Night**: deep blue field, hairline surfaces,
electric-blue idle glow. **Day**: warm off-white canvas with a dark
operational rail; same Core, same amber. You switch; the ring doesn't change
meaning.

---

## 1. The landscape (verified 2026-09-04) and the stack decision

| Layer                   | Choice                                                                                                                                                                                                                                       | Why this, and how it relates to the rest                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Substrate               | **shadcn/ui on Tailwind v4 CSS-variable tokens** (Radix or Base UI primitives)                                                                                                                                                               | Every library below is a shadcn registry. One `@theme` block drives all of them; one `components.json`. JARVIS is Next.js already.                                                                  |
| Agent-native components | **Vercel AI Elements** (official; Conversation, Message, Reasoning, Tool, Task, Confirmation/approval, Loader, Sources, Workflow canvas on React Flow) + **shadcn/ui chat primitives** (MessageScroller, Message, Bubble, Marker; June 2026) | Standup, Notice Board and agent transcripts are these primitives re-themed. The AI SDK human-in-the-loop helpers (July 2026) model "pause a tool call / require approval" — the Gate's exact shape. |
| Premium finish          | **Beautiful UI** (beautifului.dev, MIT, shadcn registry): hairline-first surfaces, cool blue-tinted neutrals, one blue accent, `approval-card`, thinking states, streaming blur-in, staggered entrances, reduced-motion baked in             | Closest visual DNA to "deep blue, hairline, restrained." Its `approval-card` is the starting point for the Gate card. Its motion grammar becomes ours.                                              |
| Motion                  | **Motion** (motion.dev, formerly Framer Motion), written from the official docs                                                                                                                                                              | Breathing Core, presence glides, message entrances, theme crossfade. The 0-star third-party motion skill stays rejected.                                                                            |
| The Core                | **react-three-fiber + drei** on the existing Phase 21 Three.js orb                                                                                                                                                                           | The one WebGL surface. Everything evidence-bearing stays SVG/DOM (addressable, testable).                                                                                                           |
| Theme tooling           | **tweakcn** to generate and iterate the Night/Day palettes as shadcn variables                                                                                                                                                               | Fast palette iteration without hand-editing tokens.                                                                                                                                                 |
| Method                  | **VibeCurb** pipeline (design read → quality gate → precise build → visual diff → drift rejection) as the U build protocol                                                                                                                   | It is the same discipline as our reality-audit-first rule, applied to visuals. Markdown rules only — no code dependency, no system access.                                                          |
| Fonts                   | **Geist Sans** (display + body, heavy weights for the wordmark) + **JetBrains Mono** (data)                                                                                                                                                  | Vercel's OFL family, pairs natively with shadcn. Replaces Fraunces; keeps the mono already in the tree.                                                                                             |

Relationships, so nobody bolts these on separately: shadcn is the
foundation → AI Elements and Beautiful UI are registries on it (install via
`npx shadcn add <registry-url>`) → tweakcn edits the same CSS variables they
consume → Motion animates the components → React Flow (inside AI Elements)
is the graph engine for the workflow/mind-map view → R3F renders the Core
only. VibeCurb governs the process, not the code.

Provenance is re-verified at install time (licence, maintainer, last
release); nothing is trusted from this document alone. Vercel and shadcn are
first-party-grade; Beautiful UI is a small MIT project already adopted by
other agent apps; VibeCurb is 42 stars and three commits — used for its
rules, never as a dependency.

---

## 2. The design system: Deep Blue

**Palette (Night).** Field `#06122B`; surface `#0B1B3A` with 1px hairline
`#1E2F55`; text `#E8EEF9` / muted `#8FA3C8`; accent (Core idle, links,
focus) electric `#3B82F6`; **Gate amber `#F5A524`** (reserved: nothing
read-only may use it); semantic green/red only for success/failure marks.

**Day.** Canvas `#F6F3EE`, rail `#0B1B3A`, same accent and amber. Generate
both with tweakcn; freeze as `@theme` variables; no hex in components.

**Type.** Wordmark: Geist 900, tracking −0.04em, clamp(96px, 18vw, 320px),
set behind the Core at 6% opacity. H1 48/1.05, H2 28/1.15, body 15/1.5,
data 13 mono. Scale is deliberately steep — hierarchy is the design.

**Layout — rails, not grids.**

- Top: a single pill nav, centred: **Core · Standup · Board · Rooms · Evidence**. Search, theme, spend at the right.
- Left rail (64px): agent presence marks (working / waiting / blocked / sleeping / offline). Hover = name + current task; click = that agent's transcript.
- Centre: the Core, 42vh, wordmark behind, one line of status under it ("Nothing waiting" / "1 proposal waiting").
- Right rail (240px): rooms — the WorkflowBox lanes as thumbnails; click opens the lane + mind-map.
- Bottom-left: voice pill (`TTS LIVE`, `mic`), bottom-right: spend for today.
- Standup / Board / Rooms / Evidence open as full-height panels that slide over the field; the Core stays visible, reduced to a corner ring.

**The Core.** Ring + inner arc, R3F. States: _idle_ (4s breath, electric
glow), _listening_ (tighter ring, amplitude from the E-011 voice layer),
_working_ (slow rotation), _waiting-on-you_ (amber, 1.2s pulse, count),
_blocked_ (amber hold, no pulse), _error_ (single red flare, then idle).
The amber states only ever come from a real proposal in the approval store.

**Motion grammar** (Beautiful UI's, tuned): 100ms hover feedback, 2px lift;
staggered entrances at 60ms; streamed text blur-in; collapsibles glide at
180ms; theme crossfade 240ms; no keyword easings — use `[0.22, 1, 0.36, 1]`;
`prefers-reduced-motion` collapses everything to opacity.

---

## 3. Surfaces and where their components come from

| Surface                   | Built from                                                                                                                               | What we change                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                      | Phase 21 orb → R3F ring; status line                                                                                                     | New geometry, six states, amber bound to real proposals                                                                                                         |
| Standup (agents' channel) | AI Elements `Conversation` + `Message` + `Reasoning` + `Tool` + `Task`; shadcn `MessageScroller`; Beautiful UI streaming/thinking states | `from` = agent id with presence colour; cost per message inline; @-mention of you; agent text in the untrusted (mono, fenced) style                             |
| Notice Board              | Beautiful UI `approval-card` + AI Elements `Confirmation`; pinned card grid                                                              | Cards are canonical effects (what the server derived), never client framing; Approve/Deny only on the Gate card; receipts and promotions render as sealed cards |
| Rooms (WorkflowBox)       | Existing lane list + SVG mind-map; AI Elements Workflow canvas (React Flow) evaluated as the mind-map engine in U.4                      | Thumbnails on the rail; lane detail keeps SVG                                                                                                                   |
| Presence rail             | shadcn `Tooltip`, custom marks                                                                                                           | Five states, derived from worker status                                                                                                                         |
| Voice pill                | existing TTS StatusPill                                                                                                                  | Re-skinned; same live probes                                                                                                                                    |
| Evidence                  | existing pipeline SVG + audit cockpits                                                                                                   | Re-themed as one instrument panel; no run/approve controls, by design                                                                                           |
| Prompt input              | AI Elements `PromptInput`                                                                                                                | One composer for Standup and Core; PTT indicator inside it                                                                                                      |

---

## 4. How each surface fills with real data (honest progression)

| Surface       | Today (U)                                                                   | Phase 25                                                    | Track A (workers)                                    |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Core amber    | demo proposal card, labelled demo                                           | real approval store → `pending_count`; the gate panel wired | same                                                 |
| Standup       | audit + telemetry events rendered as agent messages; Suggestion Inbox items | live voice + tool events                                    | real `WorkerMessage` peer bus — agents actually talk |
| Notice Board  | Suggestion Inbox + receipts                                                 | promotion inbox (human promotes)                            | mandates, handoffs                                   |
| Presence rail | agent-runtime metadata (static roles)                                       | —                                                           | live worker states                                   |
| Rooms         | LIVE store rows now (E-019)                                                 | —                                                           | —                                                    |
| Voice pill    | LIVE probes now (E-020)                                                     | wake word live                                              | —                                                    |
| Spend         | honest "no cost data" until an observability DB exists                      | live                                                        | per-worker                                           |

U ships the full design over what exists, with the Beautiful-UI-style
provenance label on anything still synthetic. It does not fabricate a live
gate or a peer bus; it makes the surfaces ready for them so Phase 25 and
Track A light them up without a redesign.

---

## 5. Governance as the design language

- The Core is the Gate. Amber is the Gate's colour and nothing else's. A read-only panel never glows.
- What an agent said is visibly _theirs_: mono, fenced, tinted — separate from the system's own voice (EoP-11 as typography).
- A card that can be approved shows the effect the _server_ derived, not the words the agent used (FC-1 as layout).
- Evidence surfaces have no buttons that do things. That absence is the design; it is also I5.
- Models are never named on the Rest/home surface; agents have names, models do not.
- The invariants CC checks at every commit are unchanged: `runtime.runTool` = 2, `resumeApproval` sole executor, spine byte-frozen, GATE-2, 24E drill, I1–I5. They are the reason the UI can be this bold: the surface cannot mint authority, so it can afford to look like it has it.

---

## 6. Build method and sequence

Method: VibeCurb's pipeline is the protocol for every slice.

1. **Design read** — CC extracts direction, palette, spatial structure, type scale from this brief and the Nike reference before any code.
2. **Gate 1** — no code until the extraction is written back and matches §2.
3. **Precise build** — one surface per slice.
4. **Visual diff** — screenshot vs. brief, PASS/FAIL table on composition, type, colour, motion, responsiveness.
5. **Drift rejection** — generic dashboard patterns, purple/blue gradients, keyword easings, placeholder copy, card-soup: rejected inline.

Sequence (one slice at a time, registry entry each):

- **U.1 Design read + reality audit** — screenshot inventory of current surfaces; extraction written; migration plan to shadcn + Tailwind v4 tokens (what `liquid-command-center.css` and `tokens.css` become).
- **U.2 Foundation** — shadcn init, Tailwind v4 `@theme` (Night + Day via tweakcn), Geist + JetBrains Mono, Motion installed, Beautiful UI foundation stylesheet. Phase 21 battery and Rest purity green.
- **U.3 Core** — R3F ring, six states, wordmark, status line; Phase 21 orb tests migrated, not deleted.
- **U.4 Shell** — pill nav, rails, panel sliding, theme switch; presence marks from agent-runtime metadata.
- **U.5 Standup + Notice Board** — AI Elements + Beautiful UI components over today's events and inbox; provenance labels.
- **U.6 Rooms + Voice + Spend** — WorkflowBox on the rail, mind-map engine decision, pill re-skin, spend.
- **U.7 Evidence + motion pass + a11y** — instrument-panel evidence, full motion grammar, reduced-motion, keyboard.
- Closes at **Execution Enabled**; operational validation on real data is 25F.

---

## 7. The prompt CC starts every slice with (VibeCurb narrative form)

> Based on the design brief v3 and the VibeCurb pipeline, generate `<surface>` for JARVIS, a governed local-first Room OS.
> The interface is for one person supervising a small team of AI agents. Because of that, I want it to feel calm, premium and alive, with a single arc-reactor Core at the centre that is the only thing that ever turns amber. Make it feel like a Nike product page crossed with a mission-control instrument panel.
> Rails not grids; one hero object with the wordmark set huge behind it. Deep-blue Night palette from `@theme` (Day theme is a switch, same Core), Geist heavy display + JetBrains Mono data, hairline surfaces, one electric-blue accent, amber reserved for the Gate.
> Run the Design Read first and stop until the extraction passes. Motion from the official Motion docs only; reduced-motion honoured. No generic dashboard patterns, no gradients, no keyword easings, no placeholder copy. Label anything synthetic with a provenance chip. Generate `<surface>`.

---

## 8. What is decided vs. what U.1 decides

Decided: the experience (§0), the stack (§1), the palette/type/layout/motion (§2), the sourcing (§3), the progression (§4), the sequence (§6).

U.1 decides: the exact migration path from the current CSS to Tailwind v4 tokens, whether the mind-map moves to React Flow, and the Core's geometry after a 3D read of the Phase 21 orb.
