---
name: JARVIS
description: Governed local-first AI command center with an orb-first operational HUD.
colors:
  void: "#0a0a0a"
  ink: "#ededed"
  panel: "#020617"
  panel-soft: "#0f172a"
  border-subtle: "#ffffff1a"
  cyan-signal: "#22d3ee"
  sky-focus: "#38bdf8"
  emerald-local: "#6ee7b7"
  amber-review: "#fbbf24"
  rose-blocked: "#fb7185"
  white: "#ffffff"
  black: "#000000"
typography:
  display:
    fontFamily: "var(--jarvis-font-display)"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "var(--jarvis-font-display)"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.005em"
  body:
    fontFamily: "var(--jarvis-font-body)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "var(--jarvis-font-display)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "var(--jarvis-font-mono)"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.16em"
    textTransform: "uppercase"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  hud-pane:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "20px"
  chip-metadata:
    backgroundColor: "{colors.panel-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  primary-command:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
---

# Design System: JARVIS

## 1. Overview

**Creative North Star: "The governed orbital command room"**

JARVIS is a product UI, not a brand site. The design should serve repeated operational work: asking, verifying, approving, inspecting, and planning. Its strongest current direction is the Rest/Working/Audit family: dark command surfaces, metadata-first panels, cyan signal lines, semantic governance colors, and a central orb that communicates state without pretending to be a toy assistant.

The current system is part mature command center and part legacy chatbot stack. The future design language should preserve the cinematic presence of the orb while making the rest of the UI more disciplined: fewer generic boxes, stronger layout regions, clearer status hierarchy, and a tighter component vocabulary.

**Key Characteristics:**

- Cinematic, but task-first.
- Orb-first system presence.
- Operational HUD panes instead of generic card stacks.
- Information-dense, but grouped by authority, evidence, and next action.
- Distinct from generic AI SaaS and chatbot wrappers.

## 2. Colors

The palette is a near-black command surface with cyan/sky signal energy and semantic safety colors for local, review, and blocked states.

### Primary

- **Cyan Signal** (`#22d3ee`): Live system signal, scan lines, focus glints, selected operational state, and orb energy.
- **Sky Focus** (`#38bdf8`): Focused mode, active inspection, and higher-attention surfaces.

### Secondary

- **Emerald Local** (`#6ee7b7`): Local-only, safe, metadata-only, and consent-positive states.
- **Amber Review** (`#fbbf24`): Approval, review, pending authority, and caution states.
- **Rose Blocked** (`#fb7185`): Withheld, denied, failed-closed, unsafe, or blocked states.

### Neutral

- **Void** (`#0a0a0a`): Current root background.
- **Panel** (`#020617`): Deep operational panes and cockpit surfaces.
- **Panel Soft** (`#0f172a`): Secondary pane layer, rows, rails, and metadata strips.
- **Ink** (`#ededed`): Primary readable text on dark surfaces.
- **Border Subtle** (`#ffffff1a`): Thin separators and HUD-pane boundaries.

### Named Rules

**The Signal Rarity Rule.** Cyan and sky should identify live state, focus, and navigation. They should not become generic decoration on every inactive surface.

**The Semantic Authority Rule.** Emerald, amber, and rose are reserved for governance meaning. Do not use them as decorative accents.

**The Purple Startup Ban.** Avoid broad purple/blue gradient hero language. JARVIS can glow, but it should glow like instrumentation, not like a SaaS landing page.

## 3. Typography

**Display Font:** Quincy first, with Orbitron (variable, weights 400-800) loaded via `next/font/google` as the build-safe fallback and exposed as `--jarvis-font-display`.
**Body Font:** Quincy first, with Rajdhani (weights 400-700) loaded via `next/font/google` as the build-safe fallback and exposed as `--jarvis-font-body`.
**Label/Mono Font:** JetBrains Mono (variable, weights 400-700), loaded via `next/font/google` and exposed as `--jarvis-font-mono`.

**Character:** Quincy carries the JARVIS identity — sharp, editorial, and cinematic without becoming ordinary dashboard type. Orbitron and Rajdhani remain the self-hosted fallbacks for builds where Quincy is not installed. JetBrains Mono is the operational instrument voice for labels, metadata strips, and code surfaces. Arial is forbidden as a primary UI fallback going forward. The font decision is recorded in `docs/architecture/UI_POLISH_PLAN.md` §7.

### Hierarchy

- **Display** (600, 2.25rem to 3rem observed, tight line-height): Reserved for orb and top-level mode labels.
- **Headline** (600, 1.5rem to 2rem): Use for major cockpit panes and route-level titles.
- **Title** (600, 1rem to 1.25rem): Use for panels, queues, and evidence groups.
- **Body** (400, 0.875rem to 1rem): Use for readable summaries, safe snippets, and operational copy.
- **Label** (600, 0.68rem to 0.75rem, uppercase, wide tracking): Use sparingly for metadata and status labels.

### Named Rules

**The Label Budget Rule.** Uppercase tracked labels are useful for instrumentation, but overuse makes every panel shout at the same volume.

**The Fixed Product Scale Rule.** Product surfaces should use stable rem-based sizes. Avoid viewport-scaled text except true hero or orb mode surfaces.

## 4. Elevation

JARVIS should use tonal layering, borders, glows, and scan-line highlights more than conventional drop shadows. Shadows are appropriate for cinematic cockpit depth and orb atmosphere, but not as generic card elevation.

### Shadow Vocabulary

- **Orb Atmosphere** (`0 0 90px rgba(34,211,238,0.22)`): Reserved for orb state, not ordinary panels.
- **Cockpit Depth** (`0 20px 80px rgba(2,6,23,0.3)`): Used on major Working/Audit shell regions.

### Named Rules

**The Pane Not Card Rule.** Primary layout regions are panes, rails, strips, and canvases. Cards are for repeated items, proposals, and review records, not nested page sections.

## 5. Components

### Orb

- **Role:** Primary system presence and state signal.
- **Shape:** Circular, layered rings, radial core, semantic tone classes.
- **States:** Quiet, focused, review, withheld.
- **Strength:** The current orb already embodies the intended design direction.
- **Risk:** Cyan/blue glow can dominate if every surrounding surface copies it.

### HUD Panes

- **Shape:** Sharp or small-radius rectangular panes, preferably 0 to 8px.
- **Background:** Near-black or slate with subtle white borders.
- **Behavior:** Carry metadata, queues, evidence, telemetry, and status. Avoid nesting panes inside panes unless the inner element is a repeated item.

### Buttons

- **Shape:** Current buttons often use `rounded-md`, `rounded-lg`, or `rounded-xl`; future standard should cap most controls at 8px.
- **Primary:** High-contrast white-on-black or black-on-white command actions.
- **Semantic:** Amber for approval review, rose for blocked or denial actions, emerald for local/safe confirmation.
- **Risk:** Legacy command buttons vary too much across panels.

### Chips and Badges

- **Style:** Thin border, small type, semantic state colors.
- **Use:** Authority tier, provider status, confidence, consent, local-only, metadata-only, and risk flags.
- **Risk:** Too many rounded text badges can become visual noise. Prefer compact labels with consistent color roles.

### Inputs and Command Entry

- **Style:** Dark field, subtle border, strong focus state, stable height.
- **Current issue:** The main route still reads like a conventional chat input with a provider dropdown and `Message JARVIS...` placeholder.
- **Future direction:** Treat input as a command line attached to system state, not a chatbot textarea.

### Current UI Audit

- **AI slop patterns:** The legacy main page uses centered chat bubbles, generic gray boxes, and repeated rounded panels that could read as AI-generated SaaS.
- **Generic chatbot tells:** User bubble `bg-blue-600`, assistant bubble `bg-gray-900`, centered `max-w-3xl` conversation stream, provider selector, and ordinary chat placeholder.
- **Purple/blue gradient risk:** Purple is not dominant, but cyan/sky/slate can still become one-note if not balanced by semantic governance colors.
- **Nested cards/card soup:** Many panels share `w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 rounded-lg p-4`, producing a stacked-card rhythm.
- **Typography weakness:** Arial is functional but unowned. Small uppercase labels are useful but over-applied.
- **Spacing/hierarchy weakness:** Legacy panels append below the chat stream rather than composing a cockpit with clear zones.
- **Command Center inconsistency:** Rest, Working, Audit, Governance, Telemetry, and Red Team surfaces are much closer to the desired design language than the legacy main route and older panels.
- **Accessibility risks:** Muted gray text, tiny uppercase labels, motion-safe orb animation, and dense panel controls need a dedicated contrast, focus, and reduced-motion pass.
- **Motion/design-system gaps:** No repo-owned motion tokens, density tokens, z-index rules, focus ring standard, or component inventory yet.

## 6. Do's and Don'ts

### Do

- Lead with the orb when the user is orienting to system state.
- Use HUD panes, rails, evidence strips, queues, and timelines for operational information.
- Make approval, confidence, caveats, provider state, and local/cloud posture visible.
- Keep semantic colors tied to governance meaning.
- Preserve raw-body privacy by showing metadata, bounded snippets, and redaction summaries.
- Use icons and compact controls for operational tools when a familiar icon exists.
- Keep dense surfaces scannable with stable grids, clear sectioning, and predictable labels.

### Don't

- Do not make new generic card stacks for major page sections.
- Do not use marketing hero layouts for app surfaces.
- Do not make JARVIS look like a generic AI chatbot with a fancy background.
- Do not use blue/purple gradients as a default design answer.
- Do not hide caveats, consent, disabled state, or authority gates behind decorative UI.
- Do not introduce broad styling changes without a focused UI polish slice.
- Do not add motion unless it communicates state.

### Future UI Polish Roadmap

1. Create repo-owned design tokens for color roles, type scale, spacing, radius, focus, elevation, density, and motion.
2. Replace the legacy main chat composition with an orb-first command center layout: system state, command lane, work queue, evidence panes.
3. Convert older `max-w-3xl` gray rounded panels into a consistent HUD-pane family one module at a time.
4. Run a typography pass to replace Arial with a deliberate product UI face and a stable rem scale.
5. Standardize buttons, chips, inputs, review cards, telemetry strips, confidence chips, and approval states.
6. Add accessibility checks for contrast, keyboard focus, reduced motion, and color-independent status meaning.
7. Add visual regression screenshots for `/`, `/rest`, `/working`, `/audit`, governance, telemetry, architecture graph, and red-team surfaces.
8. Introduce motion tokens for orb heartbeat, state transitions, panel reveal, and fail-closed feedback.
9. Preserve the current no-redesign constraint until a dedicated UI implementation slice is opened.
