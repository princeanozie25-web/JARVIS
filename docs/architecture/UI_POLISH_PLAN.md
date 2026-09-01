# JARVIS UI Polish Plan

Status: active, post-Phase-21, pre-Phase-22
Date: 03 June 2026
Owner: UI Systems Lead
Source authorities: `DESIGN.md`, `PRODUCT.md`, `docs/architecture/EXPANSION_ERA_V2.md`, `docs/architecture/EXPANSION_ERA_REFRESH.md`, `README.md`.

## 1. Purpose

The UI Polish Program is the next active program after the Expansion Era v2 refresh and before Phase 22 Voice Overhaul. Its purpose is to transform JARVIS from a "ChatGPT-style application with a powerful architecture" into a "Governed Orbital Command Room" without changing governance, authority boundaries, or execution paths.

The architecture is complete. The problem is no longer capability. The problem is presentation. This program closes that gap.

## 2. Constraints

The program is bound by these non-negotiable rules:

- Do not start Phase 22.
- Do not touch MacBook-dependent work.
- Do not install Three.js until the orb state machine slice opens.
- Do not redesign governance, the approval lifecycle, runtime authority surfaces, the router, the model runtime, or anything in Phase 1-21.
- Do not add new execution paths, run/retry/execute buttons, autonomous behavior, or chatbot UX.
- Do not introduce new capabilities or new authority surfaces under cover of a UI pass.

UI work only. Every slice must be reversible, scoped, and reviewed.

## 3. Design Identity

Target identity: Governed Orbital Command Room.

Characteristics:

- Cinematic, but task-first.
- Orb-first system presence.
- Operational HUD panes, rails, queues, evidence strips.
- Metadata-first telemetry; raw payloads stay out of UI chrome.
- Dark, authoritative, professional.
- Recruiter-demo ready.

Anti-references:

- Generic SaaS dashboard.
- Notion clone.
- Startup template.
- Chatbot wrapper.
- Purple/blue gradient landing page.

## 4. Slice Sequence

The program is decomposed into ordered slices. No slice is started until the previous one is reviewed.

| Slice | Title                      | Scope                                                                                             | Status      |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| UI.1  | UI Program Bootstrap       | Land authoritative plan + audit docs; bootstrap `src/lib/design-tokens/`; link program in README. | Active      |
| UI.2  | Design Token System        | Repo-owned CSS variables and TS exports for color, font, radius, space, shadow, semantic roles.   | Active      |
| UI.3  | Typography System          | Install Syne + JetBrains Mono via `next/font`; remove Arial; expose type scale tokens.            | Active      |
| UI.4  | Kill Chatbot UI            | Replace `/` chatbot composition with cockpit shell; preserve all governance surfaces.             | Not started |
| UI.5  | Motion Tokens              | Repo-owned motion variables; orb heartbeat, panel reveal, fail-closed feedback; reduced-motion.   | Not started |
| UI.6  | Orb State Machine          | Promote orb to authoritative state surface tied to governance/approval signals.                   | Not started |
| UI.7  | Theme Engine               | Light/dark/audit theme switching grounded in semantic tokens.                                     | Not started |
| UI.8  | Cockpit Layout             | Standardize Rest/Working/Audit shells around HUD-pane vocabulary.                                 | Not started |
| UI.9  | Accessibility Pass         | WCAG AA, focus rings, color-independent status, reduced-motion, keyboard reachability.            | Not started |
| UI.10 | Visual Regression Coverage | Screenshot baselines for `/`, `/rest`, `/working`, `/audit`, governance, telemetry, red team.     | Not started |

UI.1, UI.2, and UI.3 together establish the UI foundation. They are the only slices in scope for the current implementation pass. UI.4 begins only after these three close.

## 5. UI.1 — UI Program Bootstrap

Goal: make the UI Polish Program a first-class, discoverable artifact in the repository.

Required deliverables:

- `docs/architecture/UI_POLISH_PLAN.md` (this file): single source of truth for slice sequence, scope, and constraints.
- `docs/architecture/UI_POLISH_PLAN_AUDIT.md`: current-UI audit covering AI slop patterns, generic chatbot tells, purple/blue gradient risk, nested card soup, typography weakness, spacing/hierarchy weakness, command-center inconsistency, accessibility gaps, motion/design-system gaps.
- `src/lib/design-tokens/README.md`: surface contract for the design token module, conventions for adding tokens, and the rule that downstream code must consume tokens — not raw hex/font strings.
- A short link from the root `README.md` pointing readers to the UI Polish Program.

Out of scope:

- Any visual change to screens.
- Any new authority surface or chatbot replacement.

Exit criteria:

- Plan, audit, and tokens README exist.
- README links to the program.
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `git diff --check` are clean.

## 6. UI.2 — Design Token System

Goal: replace ad-hoc hex/font literals with a repo-owned token surface that the rest of the app consumes through Tailwind v4 `@theme` and a typed TS export.

Required deliverables:

- `src/lib/design-tokens/tokens.css`: CSS custom properties under the `--jarvis-*` namespace covering:
  - `--jarvis-color-*` for void, panel, panel-soft, ink, border-subtle, cyan-signal, sky-focus, emerald-local, amber-review, rose-blocked, white, black.
  - `--jarvis-font-*` for display, body, mono.
  - `--jarvis-radius-*` for sm, md, lg, pill.
  - `--jarvis-space-*` for xs, sm, md, lg, xl.
  - `--jarvis-shadow-*` for orb-atmosphere and cockpit-depth.
  - Semantic aliases: `--jarvis-signal`, `--jarvis-focus`, `--jarvis-local`, `--jarvis-review`, `--jarvis-blocked`.
- `src/lib/design-tokens/index.ts`: typed TS export of the same token registry for tests, snapshots, and future React consumers. Tokens are the source of truth; the TS export mirrors them for type-safe access.
- Wire into Tailwind v4 `@theme` inside `app/globals.css` via the existing `@theme inline { ... }` directive so utility classes resolve to JARVIS tokens.
- Import `tokens.css` globally so every route receives the variables.
- `tests/design-tokens.test.ts`: contract tests that assert the registry exposes every required role, every semantic alias resolves to a base color role, and the registry shape stays stable across edits.

Out of scope:

- Component refactors that consume the new tokens.
- Color decisions beyond what `DESIGN.md` already documents.

Exit criteria:

- All required tokens and aliases exist as CSS variables and TS exports.
- Tailwind `@theme` resolves to JARVIS tokens.
- Token tests pass; full validation gate is clean.

## 7. UI.3 — Typography System

> **Correction (2026-09-01):** UI.3 SHIPPED with **Fraunces** (a bundled Quincy stand-in),
> not Syne, loaded via **`next/font/local`** (bundled TTFs, no network), not `next/font/google`.
> The typography contract test (`tests/typography-tokens.test.ts`) asserts this reality
> (Fraunces for display/headline/title/body; JetBrains Mono for label; local, not google).
> Treat every "Syne" / "next/font/google" reference below as superseded by the shipped
> implementation. See docs/audits/V5_ENTRY_AUDIT.md §5.

Font decision (shipped): **Fraunces** (bundled Quincy stand-in) for display/body, **JetBrains Mono** for label/mono, both loaded via `next/font/local`. Inter is rejected: JARVIS identity takes precedence over generic UI convention. _(Original plan named Syne via `next/font/google`; the build diverged to bundled Fraunces to avoid network-time font loading.)_

Goal: replace the Arial/Helvetica fallback stack with the authoritative JARVIS type voice and expose a rem-based scale.

Required deliverables:

- `next/font/google` loaders for Syne and JetBrains Mono inside `app/layout.tsx`, exposing CSS variables (`--jarvis-font-display`, `--jarvis-font-mono`, plus a body alias).
- Remove every `Arial, Helvetica, sans-serif` reference from `app/globals.css` and `DESIGN.md` token YAML; replace with token references that resolve to the loaded fonts.
- Extend the token surface with a type scale: `display`, `headline`, `title`, `body`, `label`. Each entry carries `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, and `letterSpacing` consistent with the hierarchy already documented in `DESIGN.md` §3.
- Apply the body font at the `<body>` element so every route inherits it.
- `tests/typography-tokens.test.ts`: contract tests that assert every scale tier exists, that display and label resolve to Syne, that mono/label monospaced contexts resolve to JetBrains Mono, that no value in the scale falls back to Arial, and that the registry remains stable.

Out of scope:

- Replacing component-level typography utilities (handled by UI.4+).
- Custom font subsetting or variable-font fine-tuning (deferred).

Exit criteria:

- Syne and JetBrains Mono load through `next/font/google` with no network-time surprises.
- No Arial reference remains in `app/globals.css` or `DESIGN.md` token YAML.
- Type scale tokens exist and are exported.
- Typography tests pass; full validation gate is clean.

## 8. STOP after UI.3

Implementation pauses at the end of UI.3. UI.4 (Kill Chatbot UI) is the next slice but is NOT in scope for the current pass:

- Do not modify `app/page.tsx` for redesign reasons.
- Do not create `/converse` or any new route.
- Do not remove existing chatbot composition.
- Do not redesign cockpit screens.

Those changes belong to UI.4 and require a separate brief, review, and commit.

## 9. Tooling Decision: Impeccable

Decision: **do not re-run Impeccable** during this program. `DESIGN.md` is the frozen output of the Phase 21 Impeccable audit. Re-running it now would either rewrite the design system mid-program or produce noise that contradicts the slice plan. Future audits supersede `DESIGN.md`; they do not re-derive it.

## 10. Validation Gate

Every slice must pass before commit:

```text
npm test
npx tsc --noEmit
npm run lint
git diff --check
```

The gate is non-negotiable and applies to every slice in this program.

## 11. References

- `DESIGN.md` — design system, color/typography/elevation/component vocabulary, named rules.
- `PRODUCT.md` — register, brand personality, anti-references, design principles, accessibility commitments.
- `docs/architecture/EXPANSION_ERA_V2.md` — program placement, slice ordering, deferred work.
- `docs/architecture/EXPANSION_ERA_REFRESH.md` — Phase 21 final classification, governance posture.
- `README.md` — repository overview, phase status, and the link to this program.
