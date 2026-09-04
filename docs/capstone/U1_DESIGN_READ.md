# Program U — U.1 Design Read + Reality Audit

**Registry entry:** E-028. **Basis:** `main` @ `2125016` (brief banked), primary
machine (M1 Max 32 GB, macOS 26.6.2), dev server `next dev` on 127.0.0.1:3000.
**Brief:** `docs/capstone/UI_CAPSTONE_BRIEF.md` v3.1. **Runway inputs:**
`docs/audits/V5_REAL_VS_SYNTHETIC_CHECK.md` (may-render table),
`docs/audits/V5_ENTRY_AUDIT.md` §5. **Date:** 2026-09-04.
**Method:** VibeCurb step 1 (design read) + the reality audit the roadmap
requires before any capstone code (v5.1 §9 U.1). Read-only on `src`; the only
outputs are this file, the registry row, and a `jarvis-dev` entry in
`.claude/launch.json`.

> **Gate 1 verdict:** extraction written back and matches brief §2 (see §1
> below). Code may start at U.2. Three U.1 decisions are recorded in §5;
> one of them (fonts) amends the brief additively because a frozen Phase 21
> test pins the current font tokens.

---

## 1. Extraction (Gate 1 — what the brief means, in build terms)

| Axis                 | Extracted direction                                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction            | One hero object (the Core = the Human Gate), massive wordmark behind it, rails not grids, one accent, amber reserved for the Gate, motion alive-not-busy. Nike product page × mission-control instrument panel.                                             |
| Attention            | BLOCKER / DECISION / FYI ladder. Only a real approval-store row may turn the Core amber. Demo cards are labelled and inert. Silence by default.                                                                                                             |
| Spatial structure    | Core (depth 0) → panel (1) → drawer/sheet (2). Pill nav Core · Standup · Board · Rooms · Evidence. Left rail 64px agents; right rail 240px rooms; voice pill bottom-left; spend bottom-right; ticker under nav. Escape → Core. Keys 1–5, `/`, `A`, `M`, ⌘K. |
| Palette (Night)      | field `#06122B`, surface `#0B1B3A`, hairline `#1E2F55`, text `#E8EEF9`, muted `#8FA3C8`, accent `#3B82F6`, Gate amber `#F5A524`, semantic green/red marks only.                                                                                             |
| Palette (Day)        | canvas `#F6F3EE`, rail `#0B1B3A`, same accent + amber. Same Core.                                                                                                                                                                                           |
| Type scale           | Wordmark 900 / −0.04em / clamp(96px,18vw,320px) at 6% opacity; H1 48/1.05; H2 28/1.15; body 15/1.5; data 13 mono. Steep on purpose.                                                                                                                         |
| Motion               | 100ms hover + 2px lift; 60ms stagger; streamed blur-in; 180ms collapsibles; 240ms theme crossfade; ease `[0.22, 1, 0.36, 1]`; reduced-motion → opacity only. Core: idle 4s breath; waiting 1.2s amber pulse.                                                |
| Sourcing             | shadcn/ui on Tailwind v4 → AI Elements + Beautiful UI registries → tweakcn palettes → Motion → React Flow (evaluated) → R3F for the Core only. VibeCurb governs process, not code.                                                                          |
| Governance-as-design | Amber = Gate only; agent text mono/fenced/tinted (EoP-11); Gate card shows the server-derived effect (FC-1); evidence has no buttons (I5); no model names on Rest; invariants unchanged.                                                                    |

---

## 2. Screenshot inventory (desktop 1440×900, Night, 2026-09-04)

Captured through the in-app browser against the dev server; described here
because the capstone's visual-diff step (§6 step 4) will re-capture each
surface after its slice and compare against this baseline.

| Route                                                                                                                                 | What is on screen today                                                                                                                                                                                                                                                                                                                                                         | Reads as                                                                                                                                 | Brief surface                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `/` and `/rest`                                                                                                                       | Deep-blue radial field; small "JARVIS" wordmark top-left; clock top-right; centred DOM/CSS orb (`.jcc-orb`, mic glyph, ~260px) with "Awaiting you" caption + a mode strip; four floating suggestion cards at the corners; footer pills (`SYNTHETIC`, `NO ACTION AUTHORITY`, `TTS - SYNTHETIC`, `THEME`).                                                                        | Already close to the brief's hero composition, but the hero is small, the wordmark is not behind it, cards are card-soup at the corners. | Core                               |
| `/working`                                                                                                                            | Header "Working Cockpit" + `SYNTHETIC - METADATA-ONLY`; top pill nav (Core/Rest/Working/Audit/Pipeline); status pills (PIPELINE, MODEL, TTS - LIVE/SYNTHETIC, clock); a WorkflowBox lane (LIVE/SAMPLE label) with projects/nodes and emerald→sky rollup bars; a draggable SVG mind-map below; a Human Gate panel with a demo proposal card and Approve/Deny (local state only). | A two-column glass cockpit; the Gate is central by contract but visually one panel among panels.                                         | Rooms + Board (Gate card)          |
| `/converse`                                                                                                                           | Black page, "JARVIS — Personal AI Operating Environment", an assistant line, then stacked developer panels: Runtime Commands, Runtime Command Audit, Voice Scaffold (mic/speaker selects, Hold to Talk), Consent Manifest, Conversation Curator, `ApprovalCard`.                                                                                                                | A developer test harness. Generic dark-form styling. **The chatbot shell the brief removes.**                                            | replaced by Standup + composer     |
| `/audit`                                                                                                                              | Header "Audit"; left trace timeline; centre replay viewer with step list + progress bar; right column: governance boundary, telemetry stats + sparkline, voice activity, disabled matrix; footer `READ-ONLY · NO ACTION AUTHORITY`.                                                                                                                                             | Instrument-panel-ish already; read-only contract intact.                                                                                 | Evidence                           |
| `/audit/pipeline`                                                                                                                     | Header "PIPELINE"; six-stage spine (Capture → Classify → Route → Human Gate → Execute → Audit) with the Gate boxed amber; dashed forbidden edges; stage cards below.                                                                                                                                                                                                            | The strongest existing surface; keeps as-is, re-themed.                                                                                  | Evidence → pipeline map            |
| `/audit/telemetry-cockpit`, `/audit/architecture-graph`, `/audit/governance-boundaries`, `/audit/red-team-sandbox`, `/audit/gauntlet` | Sub-cockpits sharing the audit chrome (read-only, panel registry). Not re-captured; classified below.                                                                                                                                                                                                                                                                           | Evidence pages                                                                                                                           | Evidence (pages, depth 1)          |
| `/showcase`                                                                                                                           | Full-screen R3F cinematic (curved-fibre neural field, animated operating map, agent cards). Display-only by I-SHOW-1.                                                                                                                                                                                                                                                           | A demo reel, not an operating surface.                                                                                                   | none — stays as `/showcase`        |
| `/cosmic-gauntlet-prototype`                                                                                                          | 12-line prototype route.                                                                                                                                                                                                                                                                                                                                                        | Lab.                                                                                                                                     | none — candidate for removal later |

**Cockpit grammar confirmation** (U.1 checklist): SVG-not-canvas holds for
every evidence-bearing surface (pipeline, mind-map, audit) — only `/showcase`
and the orb atmosphere use WebGL. Human Gate is central by contract
(`.jcc-work-grid` gate column; `tests/working/gate-panel.test.tsx`). AMBER is
Gate-only by token law (`--jarvis-shell-gate*`, tokens.css). Trusted/untrusted
separation exists as `data-text-register="model-voice" | "system-fact"`
(italic-light vs roman) — the brief tightens this to mono/fenced/tinted.
Tokens are `--jarvis-*` and are already bridged into Tailwind v4 `@theme
inline` in `app/globals.css`. Fonts are **Fraunces + JetBrains Mono**, bundled
via `next/font/local` (not Syne, not Geist).

---

## 3. Dead / legacy component map

| Component / file                                                                                     | Status                                                                                                                                      | U disposition                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/converse/page.tsx` + `ConsentManifestPanel`, `ConversationCuratorPanel`, runtime-command panels | Developer harness; the only route that mounts `ApprovalCard` (R.4 said "no route" — corrected: `/converse` imports it, `/working` does not) | U.5 replaces the route with Standup + Board; the panels' data hooks are reused, their chrome is not                                                      |
| `src/components/ApprovalCard.tsx`, `HumanReviewQueuePanel.tsx`                                       | Tested, mounted only by `/converse`                                                                                                         | The Gate card's data contract; re-skinned on Beautiful UI `approval-card` in U.5                                                                         |
| `src/components/demo-director/DemoPlayback.tsx`                                                      | Demo export UI; no route                                                                                                                    | Untouched                                                                                                                                                |
| `src/components/verification-agent/VerificationConfidenceSurface.tsx`                                | No route                                                                                                                                    | Candidate Evidence page (U.7) or leave                                                                                                                   |
| `src/components/command-center/liquid-command-center.css` (1909 lines, `.jcc-*`)                     | The whole current cockpit skin, DOM orb included                                                                                            | Retired surface by surface as U.3–U.7 land; deleted only when its last consumer goes                                                                     |
| `src/components/orb/Orb.tsx` (DOM/CSS orb) + `OrbReactorAtmosphere.tsx` (R3F drei)                   | Phase 21 orb: seven-state token model (`mode × load × event × posture × heartbeat`)                                                         | U.3 extends the R3F atmosphere into the Core ring and maps the brief's six states onto the existing token model; Phase 21 orb tests migrate, not deleted |
| `src/components/showcase/*`                                                                          | Display-only cinematic                                                                                                                      | Untouched (I-SHOW-1)                                                                                                                                     |
| `app/cosmic-gauntlet-prototype`                                                                      | Lab                                                                                                                                         | Untouched in U; removal is a later hygiene row                                                                                                           |
| Pill nav `COMMAND_CENTER_ROUTES` (Core · Rest · Working · Audit · Pipeline)                          | Live, tested (`unification.test.tsx`)                                                                                                       | U.4 remaps to Core · Standup · Board · Rooms · Evidence additively (old ids stay routable)                                                               |

---

## 4. What the tree already has (so U does not re-buy it)

- **Tailwind v4** with `@tailwindcss/postcss` and `@theme inline` in
  `app/globals.css` — the token bridge exists. There is no `components.json`
  and no shadcn; no `clsx`/`tailwind-merge`/`class-variance-authority`;
  no `cmdk`, `sonner`, `vaul`, Radix, `@xyflow/react`, `ai`/`@ai-sdk`.
- **framer-motion ^12** (the same package Motion publishes; `motion` is the
  new name of the identical library). A motion vocabulary already exists
  (`src/lib/design-language/motion-vocabulary.ts` ↔ `tokens.css`, kept in
  lockstep by test).
- **react-three-fiber ^9 + drei ^10 + postprocessing** — the Core's renderer
  is already installed.
- **Tokens**: `src/lib/design-tokens/tokens.css` (+ `index.ts` mirror,
  authority `DESIGN.md`), with the AP-J1 shell registers and the amber law.
- **Live data**: WorkflowBox store rows (E-019), TTS engine health probes
  (E-020), the approval store + `resumeApproval`, telemetry/event DBs when
  configured, agent-runtime profiles (static roles).

---

## 5. U.1 decisions (the three the brief delegates, plus one amendment)

**5.1 Migration path CSS → Tailwind v4 tokens (decided).** Additive, not a
rewrite. U.2 adds a `@theme` block that defines the brief's Deep Blue
Night/Day palette as **new** tokens (`--jarvis-cc-*` for "command center",
plus the shadcn variable names `--background/--foreground/--primary/…`
mapped onto them) beside the existing `--jarvis-*` set. Existing surfaces
keep resolving through the old tokens until their slice re-themes them; no
existing token is renamed or removed (E-005/E-022-style additive doctrine;
`tests/design-tokens.test.ts` and `tests/accessibility.test.ts` stay green).
`liquid-command-center.css` is retired per surface, never bulk-edited.

**5.2 Fonts (amendment — load-bearing, recorded).** The brief says "Geist
Sans replaces Fraunces." A frozen Phase 21 battery test
(`tests/command-center/unification.test.tsx` "uses local-first Fraunces and
JetBrains Mono tokens") and `tests/typography-tokens.test.ts` pin the Fraunces
tokens and the `next/font/local` loader. Reopening Phase 21 is forbidden.
Decision: **add Geist additively** as new roles — `--jarvis-font-sans`
(Geist Sans, UI + body on capstone surfaces) and `--jarvis-font-wordmark`
(Geist 900) — loaded through `next/font/local` from bundled OFL TTFs (the
`geist` npm package ships them; no network fonts, `next/font/google` stays
banned). Fraunces tokens and the display/headline/title roles remain
defined and used by the untouched surfaces; the capstone's own surfaces
route through the new roles. Net effect on screen is the brief's; net
effect on frozen tests is zero. Recorded in the E-028 row; U.2 executes it.

**5.3 Mind-map engine (decided: keep SVG for U).** The WorkflowBox map is
evidence-bearing (node state, dependency edges, live rollups) and the
grammar rule is SVG-not-canvas for evidence. React Flow renders to DOM (not
canvas), so it is admissible, but it adds a dependency and a second
interaction model for a surface that is already live, tested
(`workflow-map.test.tsx`) and draggable. U.6 re-themes the existing SVG map
and adds the rail thumbnails; React Flow is deferred to a registry row for
when the map needs auto-layout or >~40 nodes. Reversible.

**5.4 Core geometry (decided after the 3D read).** The Phase 21 orb is two
layers: a DOM/CSS sphere (`.jcc-orb`, mic glyph, caustics, sweep) and an
R3F atmosphere (`OrbReactorAtmosphere`: drei `Sphere` + `Torus` in a
`Canvas`, gated by a reduced-motion/enable flag). U.3 builds the Core as
**R3F ring + inner arc** in that same atmosphere component (the `Torus` is
already the ring), drives it from the existing `RestOrbStateTokens`
(mode/load/event/posture/heartbeat) through a six-state mapper
(`idle | listening | working | waiting | blocked | error`), and retires the
DOM sphere's decorative layers. The wordmark goes behind as DOM text (SEO,
addressable). Amber states bind to a real `pending_count` from the approval
store; the demo card cannot produce them (A3 rule → assertion in U.3's
tests).

---

## 6. Slice plan (registry entries to open, in order)

| Slice | Entry | Scope                                                                                                                              | Exit                                                                                             |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| U.2   | E-029 | shadcn init (components.json, `cn`), Deep Blue Night+Day `@theme`, Geist additive fonts, `.dark`/`.day` switch, Motion confirmed   | tokens + fonts tests green; Phase 21 battery + Rest purity green; zero raw hex in new components |
| U.3   | E-030 | Core: R3F ring, six states, wordmark, status line, amber bound to real proposals                                                   | orb tests migrated and green; demo card cannot turn the Core amber (test)                        |
| U.4   | E-031 | Shell: pill nav (5), rails, panels/drawers, ⌘K palette, theme switch, keyboard map, Escape→Core                                    | I5 affordance scans green; keyboard nav test; old route ids still resolve                        |
| U.5   | E-032 | Standup + Notice Board over audit/telemetry events + Suggestion Inbox; Gate card on Beautiful UI `approval-card`; provenance chips | no client framing on cards (FC-1 as layout test); `/converse` retired                            |
| U.6   | E-033 | Rooms on the rail (LIVE store), voice pill re-skin (LIVE probes), spend (honest no-data)                                           | E-019/E-020 invariants green                                                                     |
| U.7   | E-034 | Evidence instrument panel, motion pass, reduced-motion, a11y                                                                       | Program U closes at **Execution Enabled**; OV is 25F                                             |

Every slice: registry row first, one commit, hooks in full, invariants
re-asserted (`runtime.runTool` = 2, `resumeApproval` sole executor, spine
byte-frozen, GATE-2, 24E drill, I1–I5).

---

## 7. Drift list (rejected on sight in every slice)

Generic dashboard cards; purple/blue gradients; keyword easings; placeholder
copy; card-soup; any amber outside the Gate; any button on an evidence
surface; any model name on Rest; any `next/font/google`; any raw hex in a
component; any third layer of depth.
