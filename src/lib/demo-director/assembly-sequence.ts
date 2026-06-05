/**
 * Demo Director assembly sequence — DD.10.
 *
 * The ordered awakening of JARVIS at the start of every script:
 *   black → orb → space → time → mind → soul → reality → power
 *        → human_gate → first_pulse → complete
 *
 * Each step has a deterministic offset within the assembly segment so
 * the renderer (and tests) can derive the active stage from elapsed_ms
 * without any timer state.
 *
 * Assembly law:
 *   - no fade, no slide — stages materialise with weight
 *   - the Human Gate ignition is the climax
 *   - the first pulse seals the awakening
 */

import { DEMO_ASSEMBLY_STAGES, type DemoAssemblyStage } from "./contracts";

export interface AssemblyBeat {
  stage: DemoAssemblyStage;
  /** Offset within the assembly segment in milliseconds. */
  at_ms: number;
  label: string;
}

export const ASSEMBLY_BEATS: readonly AssemblyBeat[] = Object.freeze([
  { stage: "black", at_ms: 0, label: "Dormant" },
  { stage: "orb", at_ms: 600, label: "Reactor ignition" },
  { stage: "space", at_ms: 1400, label: "Space materialises" },
  { stage: "time", at_ms: 2000, label: "Time materialises" },
  { stage: "mind", at_ms: 2600, label: "Mind materialises" },
  { stage: "soul", at_ms: 3200, label: "Soul materialises" },
  { stage: "reality", at_ms: 3800, label: "Reality materialises" },
  { stage: "power", at_ms: 4400, label: "Power materialises" },
  { stage: "human_gate", at_ms: 5200, label: "Human Gate ignition" },
  { stage: "first_pulse", at_ms: 5800, label: "First governed pulse" },
  { stage: "complete", at_ms: 6000, label: "Awake" },
] as const) as readonly AssemblyBeat[];

export const ASSEMBLY_DURATION_MS = 6000;

/**
 * Returns the assembly stage active at `at_ms` within the assembly
 * segment. Inputs below 0 collapse to `black`; inputs at or past the
 * assembly duration collapse to `complete`.
 */
export function assemblyStageAt(at_ms: number): DemoAssemblyStage {
  if (!Number.isFinite(at_ms) || at_ms <= 0) return "black";
  if (at_ms >= ASSEMBLY_DURATION_MS) return "complete";
  let current: DemoAssemblyStage = "black";
  for (const beat of ASSEMBLY_BEATS) {
    if (at_ms >= beat.at_ms) current = beat.stage;
    else break;
  }
  return current;
}

/** Ordered list of assembly stages — exported for tests and renderers. */
export const ASSEMBLY_STAGE_ORDER: readonly DemoAssemblyStage[] = Object.freeze(
  [...DEMO_ASSEMBLY_STAGES],
);

/**
 * The climax of the assembly is the Human Gate ignition. Exposed as a
 * named constant so the playback CSS and tests can reference one
 * source of truth.
 */
export const ASSEMBLY_CLIMAX_STAGE: DemoAssemblyStage = "human_gate";
