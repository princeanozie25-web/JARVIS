/**
 * Honest-state treatment — AP-J1 (capstone design language).
 *
 * HONESTY STATES ARE CALM, NEVER ERROR-STYLED. A synthetic-labelled panel,
 * an empty WorkflowBox, the voice terminal-only state, a null/absent value —
 * the system being honest about its limits is CORRECT behavior, so these
 * states render in calm neutral tones (stone inks, subtle borders) and must
 * never wear error styling (no blocked-red, no gate-amber, no alarm).
 *
 * The five states (from docs/capstone/REAL_VS_SYNTHETIC_LEDGER.md):
 * - `live`        — reflects real runtime state (real rows, real probes).
 * - `derived`     — computed from live data; real, just computed.
 * - `synthetic`   — deliberately fixture/static, for a recorded reason
 *                   (includes the lane's labelled "sample").
 * - `empty`       — honestly nothing to show (no rows yet).
 * - `unavailable` — a dependency is absent/denied by design (fail-closed);
 *                   absent ≠ broken.
 *
 * Markup contract: an element that states data honesty carries
 * `data-honest-state="<state>"`. The calm rendering lives in the shell CSS
 * (`liquid-command-center.css`, "honest-state family" section); the
 * assertion that no honest state is error-styled lives in
 * tests/working/design-language.test.tsx.
 */

export const HONEST_STATES = [
  "live",
  "derived",
  "synthetic",
  "empty",
  "unavailable",
] as const;

export type HonestState = (typeof HONEST_STATES)[number];

/** Panel/lane provenance strings already used by the cockpit, mapped into
 * the honest-state vocabulary ("sample" is the lane's labelled fixture). */
export function honestStateOf(
  provenance: "live" | "synthetic" | "sample",
): HonestState {
  return provenance === "sample" ? "synthetic" : provenance;
}
