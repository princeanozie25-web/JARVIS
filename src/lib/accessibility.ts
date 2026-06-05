/**
 * JARVIS accessibility primitives — UI.9.
 *
 * Color-independent status indicators. Every governance status carries
 * BOTH a semantic color AND a non-color cue (a glyph + an explicit
 * screen-reader label) so the surface remains intelligible without
 * relying on color alone. WCAG 1.4.1.
 *
 * Components consume `getStatusIndicator(status)` and render the glyph
 * + label together; the semantic color is layered on top through a
 * `--jarvis-color-*` variable. No raw hex.
 */

export type JarvisStatusKind =
  | "signal"
  | "focus"
  | "local"
  | "review"
  | "blocked"
  | "neutral";

export interface JarvisStatusIndicator {
  kind: JarvisStatusKind;
  /**
   * Non-color glyph. Each kind has a unique shape so users who do not
   * perceive color can still tell the states apart.
   */
  glyph: string;
  /**
   * Short visible label intended for badges next to the glyph.
   */
  label: string;
  /**
   * Verbose accessible name for `aria-label` on icon-only renders.
   */
  ariaLabel: string;
  /**
   * Semantic color token name (without the `--jarvis-color-` prefix).
   */
  semanticToken: "signal" | "focus" | "local" | "review" | "blocked" | "ink";
}

export const JARVIS_STATUS_INDICATORS: Readonly<
  Record<JarvisStatusKind, JarvisStatusIndicator>
> = Object.freeze({
  signal: {
    kind: "signal",
    glyph: "●",
    label: "Signal",
    ariaLabel: "Status: live signal",
    semanticToken: "signal",
  },
  focus: {
    kind: "focus",
    glyph: "◆",
    label: "Focus",
    ariaLabel: "Status: focused",
    semanticToken: "focus",
  },
  local: {
    kind: "local",
    glyph: "▲",
    label: "Local",
    ariaLabel: "Status: local-only, governance green",
    semanticToken: "local",
  },
  review: {
    kind: "review",
    glyph: "■",
    label: "Review",
    ariaLabel: "Status: awaiting governed review",
    semanticToken: "review",
  },
  blocked: {
    kind: "blocked",
    glyph: "✕",
    label: "Blocked",
    ariaLabel: "Status: blocked or forbidden",
    semanticToken: "blocked",
  },
  neutral: {
    kind: "neutral",
    glyph: "○",
    label: "Neutral",
    ariaLabel: "Status: neutral, no signal",
    semanticToken: "ink",
  },
});

const KNOWN_STATUS_KINDS: ReadonlySet<string> = new Set(
  Object.keys(JARVIS_STATUS_INDICATORS),
);

/** Deny-by-default — unknown input returns the neutral indicator. */
export function getStatusIndicator(input: unknown): JarvisStatusIndicator {
  if (typeof input === "string" && KNOWN_STATUS_KINDS.has(input)) {
    return JARVIS_STATUS_INDICATORS[input as JarvisStatusKind];
  }
  return JARVIS_STATUS_INDICATORS.neutral;
}

/**
 * Returns the CSS variable expression that resolves to the semantic
 * color for the given status kind. Components use it inline:
 *
 *     style={{ color: statusColorVar("review") }}
 */
export function statusColorVar(kind: JarvisStatusKind): string {
  const token = JARVIS_STATUS_INDICATORS[kind].semanticToken;
  return `var(--jarvis-color-${token})`;
}

/**
 * Convenience for components that need both pieces at once: the
 * indicator descriptor and the CSS color variable.
 */
export function statusPresentation(
  input: unknown,
): JarvisStatusIndicator & { colorVar: string } {
  const indicator = getStatusIndicator(input);
  return { ...indicator, colorVar: statusColorVar(indicator.kind) };
}
