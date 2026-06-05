/**
 * JARVIS motion system — UI.5.
 *
 * Repo-owned motion tokens and a tiny set of reusable framer-motion variants.
 * Tokens are sourced from `@/lib/design-tokens` so motion stays in lockstep
 * with the design token registry — no parallel duration/easing tables.
 *
 * Reduced-motion: the CSS variables in `tokens.css` collapse to `0ms` under
 * `@media (prefers-reduced-motion: reduce)`. The `prefersReducedMotion()`
 * helper is the JS-side hook for components that need to short-circuit
 * framer-motion's runtime entirely (e.g. skip a variant). Components that
 * want a single source of truth should consume the CSS token values.
 *
 * Scope: this module ESTABLISHES the system. UI.5 does not animate every
 * surface. Components opt in by importing a variant.
 */

import type { Variants } from "framer-motion";

import {
  jarvisMotion,
  jarvisMotionDurations,
  jarvisMotionEasings,
  type JarvisMotionDuration,
  type JarvisMotionEasing,
} from "@/lib/design-tokens";

export const motionDurations = jarvisMotionDurations;
export const motionEasings = jarvisMotionEasings;
export const motion = jarvisMotion;

export type MotionDurationName = JarvisMotionDuration;
export type MotionEasingName = JarvisMotionEasing;

/**
 * Convert a token like `"120ms"` to the framer-motion `transition.duration`
 * unit (seconds). Falls back to 0 when reduced motion is in effect or the
 * token cannot be parsed — never throws.
 */
export function durationSeconds(name: MotionDurationName): number {
  const raw = motionDurations[name];
  const match = /^(\d+(?:\.\d+)?)ms$/.exec(raw);
  if (!match) return 0;
  return Number(match[1]) / 1000;
}

/**
 * Returns the cubic-bezier string for the named easing token. The
 * framer-motion `transition.ease` field accepts cubic-bezier arrays; this
 * helper returns the cubic-bezier as a 4-tuple so consumers can pass it
 * directly.
 */
export function easingTuple(
  name: MotionEasingName,
): [number, number, number, number] {
  const raw = motionEasings[name];
  const match = /cubic-bezier\(([^)]+)\)/.exec(raw);
  if (!match) return [0.4, 0, 0.2, 1];
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return [0.4, 0, 0.2, 1];
  }
  return parts as [number, number, number, number];
}

/**
 * Detects the user's reduced-motion preference. Safe to call on the server:
 * if `window` is not present, returns `false` so SSR matches the default
 * full-motion render. Components should re-evaluate on mount.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const NORMAL = durationSeconds("normal");
const FAST = durationSeconds("fast");
const CINEMATIC = durationSeconds("cinematic");
const ENTER = easingTuple("enter");
const SMOOTH = easingTuple("smooth");
const ORBIT = easingTuple("orbit");

/**
 * Reusable framer-motion variants. Components opt in by spreading these
 * into a `motion.*` element's `variants`, `initial`, and `animate` props.
 *
 * These variants are intentionally minimal — UI.5 establishes the system,
 * later slices may add more.
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: NORMAL, ease: ENTER },
  },
};

export const panelEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: NORMAL, ease: ENTER },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: FAST, ease: SMOOTH },
  },
};

export const orbPulse: Variants = {
  rest: { scale: 1, opacity: 0.85 },
  pulse: {
    scale: [1, 1.02, 1],
    opacity: [0.85, 1, 0.85],
    transition: {
      duration: CINEMATIC,
      ease: ORBIT,
      repeat: Infinity,
    },
  },
};

export const motionVariants = {
  fadeIn,
  panelEnter,
  orbPulse,
} as const;

export type MotionVariantName = keyof typeof motionVariants;
