/**
 * JARVIS motion vocabulary — AP-J1 (capstone design language).
 *
 * MOTION-RESTRAINT AS IDENTITY: "cinematic means what refuses to animate."
 * This module is the COMPLETE set of intentional interaction motions for the
 * capstone surfaces. Motion marks GOVERNANCE MOMENTS — a proposal arriving at
 * the Gate, an approval resolving, a rollup filling. Everything else is
 * still. Surfaces pull primitives from here; they do not invent ad-hoc
 * animation.
 *
 * Written directly against framer-motion's public API (Variants /
 * Transition / animate / useReducedMotion) — no generated markup, no
 * unvetted skill output.
 *
 * Budget (asserted by tests/motion-vocabulary.test.ts):
 * - core beats 120–240ms (fade 160ms, fill 240ms, gate beat 220ms);
 * - GATE moments only may settle to 480ms — the one cinematic allowance;
 * - under prefers-reduced-motion every primitive is instant (duration 0,
 *   no scale/keyframe travel). The CSS side (`--jarvis-motion-vocab-*` in
 *   tokens.css) zeroes in the same media query; the test keeps both sides
 *   in lockstep.
 *
 * The vocabulary, by name:
 * - `calmFade`      — state/panel transitions (opacity only, no travel).
 * - `measuredFill`  — rollup/progress fills (non-bouncy; the CSS binding is
 *                     `transition: width var(--jarvis-motion-vocab-fill)`).
 * - `gateResolve`   — THE signature beat: a proposal approving/denying.
 * - `gateArrival`   — a proposal arriving at (or being pointed at) the Gate:
 *                     a single amber afterglow pulse on the gate panel.
 */

import { animate } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

// Program U (E-031) — the capstone surfaces pull their motion PRIMITIVES from
// this module too, so framer-motion keeps exactly one sanctioned entry point
// (I-APJ1-2). Re-exported, not re-implemented.
export { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { easingTuple, prefersReducedMotion } from "@/lib/motion";

export { prefersReducedMotion } from "@/lib/motion";

/* ------------------------------------------------------------------------ *
 * Durations — JS mirror of the `--jarvis-motion-vocab-*` tokens (seconds).
 * ------------------------------------------------------------------------ */

export const vocabDurations = {
  /** calm fade — state/panel transitions (160ms) */
  fade: 0.16,
  /** measured fill — rollup/progress bars (240ms, non-bouncy) */
  fill: 0.24,
  /** gate resolution core beat (220ms) */
  gate: 0.22,
  /** gate afterglow settle (480ms) — the ONE cinematic allowance */
  gateSettle: 0.48,
} as const;

export type VocabDuration = keyof typeof vocabDurations;

const SMOOTH = easingTuple("smooth");
const ENTER = easingTuple("enter");
const EXIT = easingTuple("exit");

/* ------------------------------------------------------------------------ *
 * calmFade — the only allowed state/panel transition.
 * ------------------------------------------------------------------------ */

/**
 * Calm fade for state and panel transitions: opacity only, no travel, no
 * bounce. `reduced: true` renders the change instantly.
 */
export function calmFade(reduced: boolean): Variants {
  const duration = reduced ? 0 : vocabDurations.fade;
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration, ease: ENTER } },
    exit: { opacity: 0, transition: { duration, ease: EXIT } },
  };
}

/* ------------------------------------------------------------------------ *
 * measuredFill — rollup/progress fills.
 * ------------------------------------------------------------------------ */

/**
 * The measured, non-bouncy transition for progress/rollup fills. React
 * trees pass this as a framer-motion `transition`; the CSS/SVG bars bind the
 * same beat via `transition: width var(--jarvis-motion-vocab-fill)
 * var(--jarvis-motion-easing-smooth)`, which prefers-reduced-motion zeroes
 * for free.
 */
export function measuredFill(reduced: boolean): Transition {
  return { duration: reduced ? 0 : vocabDurations.fill, ease: SMOOTH };
}

/* ------------------------------------------------------------------------ *
 * gateResolve — THE signature beat (a proposal approving/denying).
 * ------------------------------------------------------------------------ */

/**
 * The one signature moment: the Gate resolving a proposal. The resolution
 * verdict materializes with a short, deliberate beat (220ms, slight scale
 * settle — instrumentation, not theatre). Under reduced motion the verdict
 * simply appears.
 */
export function gateResolve(reduced: boolean): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }
  return {
    hidden: { opacity: 0, scale: 0.985 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: vocabDurations.gate, ease: ENTER },
    },
    exit: {
      opacity: 0,
      transition: { duration: vocabDurations.fade, ease: EXIT },
    },
  };
}

/* ------------------------------------------------------------------------ *
 * gateArrival — a proposal arriving at / being pointed at the Gate.
 * ------------------------------------------------------------------------ */

/** Amber afterglow keyframes for the gate panel (amber = Gate-touching —
 * this primitive is only ever legal ON the gate panel). */
export const GATE_AFTERGLOW_BOX_SHADOW = [
  "0 0 6vmin rgba(255, 150, 40, 0.10)",
  "0 0 9vmin rgba(255, 170, 70, 0.50)",
  "0 0 6vmin rgba(255, 150, 40, 0.10)",
] as const;

/**
 * Pulse the gate panel's amber afterglow once — the "a proposal points
 * here" cue. Imperative (framer-motion `animate()`), because the gate panel
 * is a long-lived element, not an enter/exit tree. No-ops under reduced
 * motion; the governance state itself is carried by the panel, not the
 * pulse.
 */
export function gateArrival(
  element: HTMLElement | null,
  options?: { reduced?: boolean },
): void {
  if (!element) return;
  const reduced = options?.reduced ?? prefersReducedMotion();
  if (reduced) return;
  animate(
    element,
    { boxShadow: [...GATE_AFTERGLOW_BOX_SHADOW] },
    { duration: vocabDurations.gateSettle, ease: SMOOTH },
  );
}

/* ------------------------------------------------------------------------ *
 * The vocabulary registry — the closed set.
 * ------------------------------------------------------------------------ */

/**
 * The COMPLETE motion vocabulary. A capstone surface that wants motion picks
 * from this set; a motion that is not in this set does not ship. (The shell's
 * one-time entrance choreography and the ambient depth field predate the
 * vocabulary and are documented as shell identity in
 * docs/capstone/JARVIS_DESIGN_LANGUAGE.md — they are part of the frame, not
 * per-interaction animation.)
 */
export const MOTION_VOCABULARY = {
  calmFade,
  measuredFill,
  gateResolve,
  gateArrival,
} as const;

export type MotionVocabularyName = keyof typeof MOTION_VOCABULARY;

/* ------------------------------------------------------------------------ *
 * Capstone grammar (Program U, brief §2) — JS mirror of the
 * `--jarvis-cc-motion-*` tokens (seconds). Kept in lockstep by
 * tests/capstone/foundation.test.ts. Separate from MOTION_VOCABULARY above so
 * the AP-J1 vocabulary stays byte-stable.
 * ------------------------------------------------------------------------ */

export const capstoneMotion = {
  /** the one easing — never a keyword */
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  hover: 0.1,
  stagger: 0.06,
  collapse: 0.18,
  theme: 0.24,
  /** pill indicator glide + panel slide */
  pillGlide: 0.24,
  panelSlide: 0.18,
  coreBreath: 4,
  gatePulse: 1.2,
} as const;

export type CapstoneMotionBeat = Exclude<keyof typeof capstoneMotion, "ease">;

/** A transition for one capstone beat; reduced motion collapses it to 0. */
export function capstoneTransition(
  beat: CapstoneMotionBeat,
  reduced: boolean,
): Transition {
  return reduced
    ? { duration: 0 }
    : { duration: capstoneMotion[beat], ease: capstoneMotion.ease };
}
