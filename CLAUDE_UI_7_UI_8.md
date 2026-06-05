UI.6 is complete.

Do not perform another audit.

Do not reread architecture documents.

Read only:

- docs/architecture/UI_POLISH_PLAN.md
- app/page.tsx
- app/converse/page.tsx
- app/globals.css
- src/lib/design-tokens/\*
- src/lib/motion.ts
- src/components/orb/\*
- src/app/working/\*
- src/components/working/\*

Implementation only.

============================================================
CURRENT STATUS
============================================================

UI.1 ✓
UI.2 ✓
UI.3 ✓
UI.4 ✓
UI.5 ✓
UI.6 ✓

Next:

UI.7 Theme Engine
UI.8 Cockpit Layout

============================================================
DO NOT TOUCH
============================================================

- governance
- approval lifecycle
- router
- model runtime
- memory
- agents
- council
- Google integrations
- social extraction
- Phase 22+
- accessibility
- pipeline visualization

No new authority surfaces.

No new capabilities.

============================================================
UI.7
THEME ENGINE
============================================================

Create:

src/lib/theme.ts

src/components/ThemeProvider.tsx

Implement:

blue
red
amber
purple
green

Each theme controls:

--color-theme-primary
--color-theme-glow

Use existing token system.

Theme switching must be:

typed
token-driven
persistable

No hardcoded component colors.

No LED integration yet.

Prepare LED sync hooks only.

Do not implement hardware calls.

============================================================
UI.8
COCKPIT LAYOUT
============================================================

Target:

Mission-control layout.

Replace:

stacked card soup

with:

cockpit panes.

Focus only on:

/working

and supporting components.

Desired structure:

SYSTEM STATUS
SUGGESTIONS
COST

ROOM STATE
RECENT ACTIVITY

MODEL ROUTER
SAFETY

COMMAND BAR

Requirements:

- remove max-width dashboard feel
- full-width command-center feel
- pane composition
- semantic token usage
- motion system integration where useful
- orb remains unchanged

Do not redesign functionality.

Do not remove existing capability surfaces.

Recompose.

============================================================
TESTS
============================================================

Add tests for:

- theme registry completeness
- theme switching
- theme persistence behavior
- cockpit layout structure
- pane presence
- no functionality loss

============================================================
VALIDATION
============================================================

Run:

npm test
npx tsc --noEmit
npm run lint
git diff --check

============================================================
STOP RULE
============================================================

STOP after UI.8.

Do NOT begin:

UI.9 Accessibility
UI.10 Pipeline Visualization

============================================================
FINAL RESPONSE
============================================================

1. Effort level
2. Files created
3. Files modified
4. What was implemented
5. Tests added
6. Commands run + results
7. UI.7 verdict
8. UI.8 verdict
9. Suggested commit message

Suggested commit:

feat(ui): add theme engine and cockpit layout
