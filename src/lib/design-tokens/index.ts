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
  violet: "#a78bfa",
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

/**
 * Shell registers — AP-J1 (capstone design language).
 *
 * The cockpit shell renders on deep glass; each register is the documented
 * on-glass rendering of exactly ONE base role — not a parallel palette. The
 * cockpit's former private `--jcc-*` palette resolves through these.
 *
 * Color law: amber registers (`gate`, `gate-deep`) are reserved for
 * Gate-touching state; progress uses the emerald->sky base range; the one
 * interactive accent is `accent`; neutrals carry everything else.
 */
export const jarvisShellRegisters = {
  ink: { value: "#eaf1fb", roleOf: "ink" },
  "ink-dim": { value: "#8ea4c4", roleOf: "ink" },
  "ink-faint": { value: "#46587a", roleOf: "ink" },
  accent: { value: "#86bcff", roleOf: "sky-focus" },
  signal: { value: "#5fe6e0", roleOf: "cyan-signal" },
  "signal-deep": { value: "#1ea7a0", roleOf: "cyan-signal" },
  gate: { value: "#ffb24d", roleOf: "amber-review" },
  "gate-deep": { value: "#ff8a1f", roleOf: "amber-review" },
  blocked: { value: "#ff6b6b", roleOf: "rose-blocked" },
} as const satisfies Record<string, { value: string; roleOf: JarvisColorRole }>;

export type JarvisShellRegister = keyof typeof jarvisShellRegisters;

/** The only shell registers allowed to render amber — the Gate hue. */
export const AMBER_SHELL_REGISTERS = [
  "gate",
  "gate-deep",
] as const satisfies readonly JarvisShellRegister[];

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
  display: 'var(--font-jarvis-display, "Fraunces", Georgia, serif)',
  body: 'var(--font-jarvis-display, "Fraunces", Georgia, serif)',
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
  fontStyle?: "italic";
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
  /** Model-voice register — AP-J1: model-GENERATED text renders visibly
   * distinct from system fact (italic light serif; fact stays roman). */
  voice: {
    fontFamily: jarvisFonts.display,
    fontSize: "1rem",
    fontWeight: 300,
    lineHeight: "1.5",
    letterSpacing: "normal",
    fontStyle: "italic",
  },
} as const satisfies Record<string, JarvisTextStyle>;

export type JarvisTextRole = keyof typeof jarvisTypography;

export const jarvisMotionDurations = {
  instant: "0ms",
  fast: "120ms",
  normal: "240ms",
  slow: "480ms",
  cinematic: "960ms",
} as const;

export type JarvisMotionDuration = keyof typeof jarvisMotionDurations;

export const jarvisMotionEasings = {
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
  smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  orbit: "cubic-bezier(0.45, 0, 0.55, 1)",
} as const;

export type JarvisMotionEasing = keyof typeof jarvisMotionEasings;

export const jarvisMotion = {
  duration: jarvisMotionDurations,
  easing: jarvisMotionEasings,
} as const;

// ---------------------------------------------------------------------------
// Stones — DD.0
// ---------------------------------------------------------------------------

export const jarvisStones = {
  space: "#1e90ff",
  time: "#34d399",
  mind: "#fbbf24",
  soul: "#fb923c",
  reality: "#ef4444",
  power: jarvisColors.violet,
  gold: "#facc15",
  flame: "#f97316",
  ruby: "#e0115f",
} as const;

export type JarvisStone = keyof typeof jarvisStones;

export const JARVIS_STONE_IDS = [
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
] as const satisfies readonly JarvisStone[];

export type JarvisStoneZone = (typeof JARVIS_STONE_IDS)[number];

/** Returns the CSS variable expression for the stone token. */
export function stoneColorVar(stone: JarvisStone): string {
  if ((JARVIS_STONE_IDS as readonly string[]).includes(stone)) {
    return `var(--jarvis-color-stone-${stone})`;
  }
  return `var(--jarvis-color-${stone})`;
}

// ---------------------------------------------------------------------------
// Pulse timing — DD.0
// ---------------------------------------------------------------------------

export const jarvisPulseDurations = {
  short: "800ms",
  normal: "1600ms",
  long: "3200ms",
  dwell: "1200ms",
} as const;

export type JarvisPulseDuration = keyof typeof jarvisPulseDurations;

export const jarvisPulse = {
  duration: jarvisPulseDurations,
} as const;

export const jarvisTokens = {
  colors: jarvisColors,
  semanticColors: jarvisSemanticColors,
  shellRegisters: jarvisShellRegisters,
  radii: jarvisRadii,
  space: jarvisSpace,
  shadows: jarvisShadows,
  fonts: jarvisFonts,
  typography: jarvisTypography,
  motion: jarvisMotion,
  stones: jarvisStones,
  pulse: jarvisPulse,
} as const;

export type JarvisTokens = typeof jarvisTokens;
