# `@/lib/design-tokens`

JARVIS design tokens. The single source of truth for color, font, radius, space, shadow, semantic, and (later) motion values used across the UI.

## Status

- UI.1 — module reserved (this README).
- UI.2 — `tokens.css` and `index.ts` land here.
- UI.3 — typography scale tokens added.
- UI.5+ — motion tokens added.

Until UI.2 lands, **do not import from this directory.** No tokens are exported yet.

## What lives here

| File         | Role                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `tokens.css` | CSS custom properties under the `--jarvis-*` namespace. Imported globally by `app/layout.tsx`.           |
| `index.ts`   | Typed mirror of `tokens.css` for tests, snapshots, and React consumers. Hand-maintained to stay in sync. |
| `README.md`  | This file. Scope, conventions, contribution rules.                                                       |

## Conventions

- **Namespace:** every variable starts with `--jarvis-` to avoid collisions with Tailwind, Next.js, and third-party CSS.
- **Categories:** `color`, `font`, `radius`, `space`, `shadow`, `text` (scale), `motion` (deferred).
- **Semantic aliases:** governance-meaningful names (`signal`, `focus`, `local`, `review`, `blocked`) resolve to base color roles. Components consume aliases, not raw hex.
- **Wire-up:** Tailwind v4 `@theme` in `app/globals.css` re-exports tokens as theme keys so utilities like `bg-signal` or `text-ink` resolve to JARVIS tokens.
- **Source of truth:** `DESIGN.md` frontmatter is the authoritative palette and type scale. `tokens.css` mirrors it; `index.ts` mirrors `tokens.css`. A vitest contract test guards the chain against drift.

## Contribution rules

1. **Add tokens here first.** New colors, sizes, or scale entries land in `tokens.css` and `index.ts` before any component consumes them.
2. **No raw hex or font strings in components.** Always go through a token (CSS variable or Tailwind utility resolved to a token).
3. **Semantic aliases stay governance-meaningful.** Do not repurpose `signal`, `focus`, `local`, `review`, or `blocked` for decoration.
4. **Updating `DESIGN.md`?** Update `tokens.css` and `index.ts` in the same change; the drift test will catch a missed mirror.
5. **No motion tokens yet.** Motion tokens are reserved for UI.5. The placeholder block in `tokens.css` is frozen until that slice opens.

## Anchored documents

- `DESIGN.md` — token authority (palette, type, radius, space, components).
- `PRODUCT.md` — brand personality, anti-references, accessibility commitments.
- `docs/architecture/UI_POLISH_PLAN.md` — slice plan and acceptance criteria.
- `docs/architecture/UI_POLISH_PLAN_AUDIT.md` — frozen audit baseline that justifies the program.
