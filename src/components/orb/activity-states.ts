/**
 * Orb activity state machine — UI.6.
 *
 * Pure descriptor table mapping each of the seven JARVIS orb activity
 * states to:
 *   - a semantic governance color (`signal` / `focus` / `local` / `review`
 *     / `blocked`) — never raw hex,
 *   - an existing `OrbVisualState["tone"]` for backwards compatibility
 *     with the Rest projection,
 *   - a CSS animation name driven by `orb-states.css`,
 *   - a human-readable label.
 *
 * The SVG/CSS renderer remains the truth layer. The optional Three.js
 * atmosphere can observe the resolved presentational state, but it never
 * owns routing, metadata, or authority. `resolveOrbActivityState` is the
 * only safe entry point: it deny-falls-back to `idle` for any unknown input
 * so the surface never crashes.
 */

import type { OrbVisualState } from "./types";

export const ORB_ACTIVITY_STATES = [
  "idle",
  "listening",
  "processing",
  "speaking",
  "systems_healthy",
  "approval_needed",
  "alert",
] as const;

export type OrbActivityState = (typeof ORB_ACTIVITY_STATES)[number];

export type OrbSemanticTone =
  | "signal"
  | "focus"
  | "local"
  | "review"
  | "blocked";

export interface OrbActivityDescriptor {
  state: OrbActivityState;
  tone: OrbVisualState["tone"];
  semantic: OrbSemanticTone;
  animation:
    | "breathing"
    | "pulse-fast"
    | "sweep"
    | "rhythmic"
    | "scan"
    | "pulse-orange"
    | "pulse-red";
  label: string;
  detail: string;
}

export const ORB_ACTIVITY_DESCRIPTORS: Readonly<
  Record<OrbActivityState, OrbActivityDescriptor>
> = Object.freeze({
  idle: {
    state: "idle",
    tone: "quiet",
    semantic: "signal",
    animation: "breathing",
    label: "Idle",
    detail: "Resting orb. Subtle breathing glow.",
  },
  listening: {
    state: "listening",
    tone: "focused",
    semantic: "focus",
    animation: "pulse-fast",
    label: "Listening",
    detail: "Faster, brighter pulse. Capture posture only.",
  },
  processing: {
    state: "processing",
    tone: "focused",
    semantic: "focus",
    animation: "sweep",
    label: "Processing",
    detail: "Rotating sweep. Work in flight.",
  },
  speaking: {
    state: "speaking",
    tone: "focused",
    semantic: "focus",
    animation: "rhythmic",
    label: "Speaking",
    detail: "Rhythmic pulse. Output in progress.",
  },
  systems_healthy: {
    state: "systems_healthy",
    tone: "quiet",
    semantic: "local",
    animation: "scan",
    label: "Systems healthy",
    detail: "Green 360 sweep. Local posture green.",
  },
  approval_needed: {
    state: "approval_needed",
    tone: "review",
    semantic: "review",
    animation: "pulse-orange",
    label: "Approval needed",
    detail: "Amber pulse. Awaiting governed decision.",
  },
  alert: {
    state: "alert",
    tone: "withheld",
    semantic: "blocked",
    animation: "pulse-red",
    label: "Alert",
    detail: "Rose pulse. Attention required.",
  },
});

const KNOWN_STATES: ReadonlySet<string> = new Set(ORB_ACTIVITY_STATES);

/**
 * Deny-by-default resolver. Returns the `idle` descriptor for any
 * unrecognised input — never throws, never returns `undefined`.
 */
export function resolveOrbActivityState(input: unknown): OrbActivityDescriptor {
  if (typeof input === "string" && KNOWN_STATES.has(input)) {
    return ORB_ACTIVITY_DESCRIPTORS[input as OrbActivityState];
  }
  return ORB_ACTIVITY_DESCRIPTORS.idle;
}

export const IDLE_ORB_ACTIVITY_DESCRIPTOR = ORB_ACTIVITY_DESCRIPTORS.idle;
