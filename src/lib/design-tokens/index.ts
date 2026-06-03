/**
 * JARVIS design tokens — typed mirror of `tokens.css`.
 *
 * Authority: `DESIGN.md` frontmatter is the canonical palette/type. `tokens.css`
 * mirrors it as CSS custom properties; this module mirrors `tokens.css` as a
 * typed registry. A vitest contract test (`tests/design-tokens.test.ts`)
 * guards the chain against drift.
 *
 * Components and tests should consume these tokens — never raw hex or font
 * strings.
 */

export const jarvisColors = {
  void: "#0a0a0a",
  ink: "#ededed",
  panel: "#020617",
  "panel-soft": "#0f172a",
  "border-subtle": "#ffffff1a",
  "cyan-signal": "#22d3ee",
  "sky-focus": "#38bdf8",
  "emerald-local": "#6ee7b7",
  "amber-review": "#fbbf24",
  "rose-blocked": "#fb7185",
  white: "#ffffff",
  black: "#000000",
} as const;

export type JarvisColorRole = keyof typeof jarvisColors;

/**
 * Semantic governance aliases. Each alias resolves to one of the base color
 * roles in `jarvisColors`. Components consume aliases so that meaning stays
 * stable even if the underlying palette is retuned.
 */
export const jarvisSemanticColors = {
  signal: "cyan-signal",
  focus: "sky-focus",
  local: "emerald-local",
  review: "amber-review",
  blocked: "rose-blocked",
} as const satisfies Record<string, JarvisColorRole>;

export type JarvisSemanticColor = keyof typeof jarvisSemanticColors;

export const jarvisRadii = {
  sm: "4px",
  md: "6px",
  lg: "8px",
  pill: "9999px",
} as const;

export type JarvisRadius = keyof typeof jarvisRadii;

export const jarvisSpace = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;

export type JarvisSpace = keyof typeof jarvisSpace;

export const jarvisShadows = {
  "orb-atmosphere": "0 0 90px rgba(34, 211, 238, 0.22)",
  "cockpit-depth": "0 20px 80px rgba(2, 6, 23, 0.3)",
} as const;

export type JarvisShadow = keyof typeof jarvisShadows;

export const jarvisFonts = {
  display: 'var(--font-jarvis-display, "Syne", system-ui, sans-serif)',
  body: 'var(--font-jarvis-display, "Syne", system-ui, sans-serif)',
  mono: 'var(--font-jarvis-mono, "JetBrains Mono", ui-monospace, monospace)',
} as const;

export type JarvisFont = keyof typeof jarvisFonts;

export interface JarvisTextStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string;
  letterSpacing: string;
  textTransform?: "uppercase";
}

export const jarvisTypography = {
  display: {
    fontFamily: jarvisFonts.display,
    fontSize: "3rem",
    fontWeight: 600,
    lineHeight: "1.05",
    letterSpacing: "-0.01em",
  },
  headline: {
    fontFamily: jarvisFonts.display,
    fontSize: "2rem",
    fontWeight: 600,
    lineHeight: "1.15",
    letterSpacing: "-0.005em",
  },
  title: {
    fontFamily: jarvisFonts.display,
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: "1.3",
    letterSpacing: "normal",
  },
  body: {
    fontFamily: jarvisFonts.body,
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: "1.5",
    letterSpacing: "normal",
  },
  label: {
    fontFamily: jarvisFonts.mono,
    fontSize: "0.75rem",
    fontWeight: 600,
    lineHeight: "1.2",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
} as const satisfies Record<string, JarvisTextStyle>;

export type JarvisTextRole = keyof typeof jarvisTypography;

export const jarvisTokens = {
  colors: jarvisColors,
  semanticColors: jarvisSemanticColors,
  radii: jarvisRadii,
  space: jarvisSpace,
  shadows: jarvisShadows,
  fonts: jarvisFonts,
  typography: jarvisTypography,
} as const;

export type JarvisTokens = typeof jarvisTokens;
