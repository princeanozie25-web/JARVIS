# JARVIS Design Language — AP-J1 (capstone)

**Status:** the governing visual language for every capstone (AP-J) surface slice.
**Scope of this slice:** the LANGUAGE + the SHELL. Per-surface polish (Gate panel
detail, WorkflowBox visual pass, pipeline map, voice, rest) are later AP-J slices
that INHERIT this frame — they pull from this document instead of inventing.

JARVIS shares a philosophy with its sibling product's charter — governance made
visible — but expresses it in its OWN grammar (the cockpit: deep glass, stone
inks, the amber Gate). It does NOT adopt the sibling's paper-white
evidence-modernism identity.

## 1. Philosophy

1. **Testify, don't decorate.** Every rendered value is real or honestly
   labelled (enforced by the honesty pass + the real-vs-synthetic ledger). No
   decorative element may imply a capability that isn't there.
2. **Motion-restraint as identity.** Cinematic means what refuses to animate.
   A small documented motion vocabulary marks GOVERNANCE MOMENTS; everything
   else is still.
3. **Honesty states are calm, never error-styled.** A synthetic label, an
   empty lane, a terminal-only voice stack, an absent value — the system being
   honest about its limits is CORRECT behavior and renders in calm tones.
4. **Governance is the aesthetic.** The Human Gate is the visual center of
   gravity; amber means Gate-touching and calm means read-only, as the
   organizing principle — not a theme applied on top.

## 2. The token system (one system, no parallel palette)

Source of truth: [`src/lib/design-tokens/tokens.css`](../../src/lib/design-tokens/tokens.css)
(typed mirror [`index.ts`](../../src/lib/design-tokens/index.ts); lockstep tests
`tests/design-tokens.test.ts`, `tests/working/design-language.test.tsx`).

### Base roles (DESIGN.md frontmatter — unchanged)

Neutrals `void / panel / panel-soft / ink / border-subtle`; signals
`cyan-signal / sky-focus`; governance `emerald-local / amber-review /
rose-blocked`; plus `violet`, `white`, `black`.

### Shell registers (`--jarvis-shell-*`) — AP-J1

The cockpit renders on deep glass, where several roles need a lifted
(higher-luminance) rendering to stay readable. Each register is the DOCUMENTED
on-glass rendering of exactly one base role. The cockpit's former private
palette (`--jcc-*` in `liquid-command-center.css`) now RESOLVES through these
registers — the parallel palette is gone.

| Register                     | Value           | On-glass rendering of | Meaning                                   |
| ---------------------------- | --------------- | --------------------- | ----------------------------------------- |
| `--jarvis-shell-ink`         | `#eaf1fb`       | ink                   | primary text                              |
| `--jarvis-shell-ink-dim`     | `#8ea4c4`       | ink (stone)           | secondary text                            |
| `--jarvis-shell-ink-faint`   | `#46587a`       | ink (stone)           | metadata text                             |
| `--jarvis-shell-accent`      | `#86bcff`       | sky-focus             | THE interactive accent (selection, focus) |
| `--jarvis-shell-signal`      | `#5fe6e0`       | cyan-signal           | live/evidence, read-only (audit)          |
| `--jarvis-shell-signal-deep` | `#1ea7a0`       | cyan-signal           | deep end of the signal range              |
| `--jarvis-shell-gate`        | `#ffb24d`       | amber-review          | **Gate-touching ONLY**                    |
| `--jarvis-shell-gate-deep`   | `#ff8a1f`       | amber-review          | **Gate-touching ONLY** (deep end)         |
| `--jarvis-shell-blocked`     | `#ff6b6b`       | rose-blocked          | denied / failed-closed / error            |
| `--jarvis-shell-glass(-hi)`  | glass gradients | panel / panel-soft    | pane surfaces                             |
| `--jarvis-shell-stroke(-hi)` | rgba strokes    | border-subtle         | pane boundaries                           |

### The color law (asserted: I-APJ1-1)

- **Amber = Gate.** Amber (`amber-review` / `--jarvis-shell-gate*` /
  `--jcc-amber*` / `--tc-restricted`) appears ONLY on Gate-touching elements:
  the gate panel and its children, the proposal chip (it points at the Gate),
  the GATE pill's pending state, the audit trail's `pending` (awaiting
  approval) status, the `restricted` trust class (requires the Gate), and the
  rest orb's `approval` reactor state. Never decorative. A warn that is not a
  Gate state renders CALM (bright ink) — the value TEXT carries the meaning.
- **Progress = emerald->sky.** Every progress/rollup fill uses
  `emerald-local -> sky-focus` (the WorkflowBox bars and the shell bars share
  the same fill). Never amber, never the accent.
- **One interactive accent.** `--jarvis-shell-accent` (sky-focus register)
  for selection/focus/active navigation. Cyan-signal is the read-only
  live/evidence tone (audit), not an interactive accent.
- **Neutrals carry everything else.** Surface glass + the three stone inks.

### Known residue (honest, tracked — not silently blessed)

- `--jcc-lav: #b6a4ff` and `--jcc-coach: #f2cf86` — rest-room suggestion-card
  accents; the rest-surface AP-J slice decides their roles.
- `--tc-observe: #6b7a90` — observe-tier stone between `ink-dim` and
  `ink-faint`; fold into the stone scale in a later surface slice.
- The gate panel's interior warm rgba washes are raw values inside
  gate-scoped rules (legal under the amber law); the Gate-panel AP-J slice
  tokenizes them.
- DD.0 stone/pulse tokens (`--jarvis-color-stone-*`, gold/flame/ruby) are the
  demo-director gauntlet palette — demo-scoped, not cockpit language.

## 3. Type registers

Fonts: Fraunces (bundled, `--jarvis-font-display` = `--jarvis-font-body`) and
JetBrains Mono (`--jarvis-font-mono`). No new fonts.

| Register        | Face + form                                      | Used for                                                                                                |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Display**     | Fraunces 600, display/headline/title scale       | room titles, brand, the gate title — the chrome                                                         |
| **Data/UI**     | Fraunces 400, body scale                         | operational copy, summaries, device names, proposal titles                                              |
| **Mono**        | JetBrains Mono, label scale (tracked, uppercase) | ids, hashes, chips, pills, tags, provenance markers, statusbar — anything rule-like                     |
| **Model-voice** | Fraunces _italic_ 300 (`--jarvis-text-voice-*`)  | model-GENERATED text — visibly distinct from system fact. Markup: `data-text-register="model-voice"`    |
| **System-fact** | roman (the default)                              | verdicts, states, measurements. Markup (where the contrast matters): `data-text-register="system-fact"` |

Register law: _italic belongs to the model's voice._ Hints, placeholders,
markers, and verdicts are roman. Applied this slice: the chat's JARVIS reply is
`model-voice`; the gate's resolution verdict is `system-fact` (roman); the
composer hint and the provenance markers dropped their italic.

## 4. The motion vocabulary (I-APJ1-2)

Module: [`src/lib/design-language/motion-vocabulary.ts`](../../src/lib/design-language/motion-vocabulary.ts)
(framer-motion, written directly from its public API). CSS tokens:
`--jarvis-motion-vocab-*`. Lockstep + budget asserted by
`tests/motion-vocabulary.test.ts`.

| Beat           | Duration     | Marks                                                                                  |
| -------------- | ------------ | -------------------------------------------------------------------------------------- |
| `calmFade`     | 160ms        | state/panel transitions (opacity only, no travel)                                      |
| `measuredFill` | 240ms        | rollup/progress fills (non-bouncy; CSS binding on the bars)                            |
| `gateResolve`  | 220ms        | **the signature**: a proposal approving/denying                                        |
| `gateArrival`  | 480ms settle | a proposal arriving at / pointing at the Gate (amber afterglow on the gate panel only) |

**Budget:** core beats 120–240ms. GATE moments only may settle to 480ms — the
one cinematic allowance. NOTHING else moves. A surface that wants motion pulls
a primitive from the vocabulary; ad-hoc animation does not ship.

**Reduced motion:** every primitive goes instant when
`prefers-reduced-motion` is set — the JS side via `useReducedMotion()` /
`prefersReducedMotion()` (each primitive takes `reduced`), the CSS side by
zeroing `--jarvis-motion-vocab-*` in the same media query, and the `.jcc`
scope's blanket `animation/transition: none` kill switch stays in force.

**Shell identity (grandfathered, documented, not per-interaction motion):**
the one-time entrance choreography (`jcc-fade-down/-up`, `jcc-slide-in`,
`jcc-gate-in` — the room assembling once on entry), the ambient depth field
(`jcc-drift*`, grain), the status pulse dot, and the rest orb's presence
loops (the rest slice owns their future). All are killed by reduced motion.
No NEW keyframes may be added to the shell outside the vocabulary (asserted).

## 5. Honest-state treatment (I-APJ1-3)

Module: [`src/lib/design-language/honest-states.ts`](../../src/lib/design-language/honest-states.ts);
CSS family: `liquid-command-center.css` ("honest-state family"). Markup:
`class="jcc-honest" data-honest-state="<state>"`.

| State         | Meaning (ledger)                                                  | Rendering                    |
| ------------- | ----------------------------------------------------------------- | ---------------------------- |
| `live`        | real runtime state (rows, probes)                                 | calm mono, stone `ink-dim`   |
| `derived`     | computed from live data                                           | calm mono, stone `ink-dim`   |
| `synthetic`   | deliberate fixture, recorded reason (incl. the lane's "sample")   | calm mono, stone `ink-faint` |
| `empty`       | honestly nothing to show                                          | calm mono, stone `ink-faint` |
| `unavailable` | dependency absent/denied by design (fail-closed); absent ≠ broken | calm mono, stone `ink-faint` |

None of these states may wear error styling — no blocked-red, no gate-amber,
no alarm. Error styling is reserved for actual failures (`rose-blocked`
family), which are NOT honesty states. Applied this slice: the header
provenance marker, the OBSERVABILITY panel tags, the WORKFLOWBOX provenance
label, the TTS pill label (live and synthetic), and the empty-lane message.

## 6. The shell (I-APJ1-4)

The shell is the frame that holds the rooms — topbar (brand + provenance
marker + route nav + status pills), the working grid, the WorkflowBox band,
the statusbar — over the ambient depth field.

Structural contracts (markup, not styling — asserted):

- **Gate centrality:** the work grid carries `data-shell-center="human-gate"`;
  the gate column is the WIDEST flexible track; the gate panel keeps
  `data-human-gate-panel` / `data-only-path-to-side-effects` /
  `data-mutator-entrypoint`. The only `<button>` elements in the default shell
  are the gate's APPROVE/DENY.
- **No-affordance:** read-only panels keep `data-read-only-context-panel` and
  render no interactive controls; the WorkflowBox keeps its three
  no-affordance attributes and `data-only-mutator="human-gate"`.
- **Provenance is structural:** the `SYNTHETIC - METADATA-ONLY` marker lives
  in the topbar (above the fold, before the grid in DOM order) and may never
  be demoted below the fold or into decoration; per-panel provenance renders
  on every labelled panel (`data-panel-provenance` + the honest-state family).

## 7. What later AP-J slices inherit

1. Consume tokens/registers — never raw hex (new values join `tokens.css`
   with a documented role first).
2. Amber only if the element touches the Gate; extend the law test's
   allowlist consciously when a new gate-touching element appears.
3. Motion only from the vocabulary; a new beat is a vocabulary change
   (module + tokens + budget test + this doc), not a component change.
4. Honest states via `jcc-honest` + `data-honest-state` — calm, never
   error-styled.
5. Model-generated text renders in the model-voice register.
6. The structural contracts (§6) are load-bearing: tests pin them.
