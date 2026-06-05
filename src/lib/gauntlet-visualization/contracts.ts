/**
 * Gauntlet visualization contracts — DD.1.
 *
 * Pure, frozen, read-only descriptors for the Living System Map. No
 * execution logic, no telemetry subscription, no provider calls. The
 * view model is consumed by SVG components and by demo-mode fixtures
 * only.
 */

import type { JarvisStone, JarvisStoneZone } from "@/lib/design-tokens";

export const GAUNTLET_HUB_STATES = [
  "default",
  "proposal_pending",
  "approved",
  "denied",
] as const;

export type GauntletHubState = (typeof GAUNTLET_HUB_STATES)[number];

/**
 * Pseudo-node id used by Time/Mind exit edges to terminate visually at
 * the Human Gate hub. Zone renderers resolve this against the hub
 * position rather than the zone's `nodes` array.
 */
export const HUB_NODE_ID = "human-gate" as const;
export type HubNodeId = typeof HUB_NODE_ID;

// ---------------------------------------------------------------------------
// Time zone activation — DD.4
// ---------------------------------------------------------------------------

export const TIME_ACTIVATION_STATES = [
  "idle",
  "scheduler_tick",
  "coordinator_pulse",
  "agent_ignition",
  "suggestion_pulse",
] as const;

export type TimeActivationState = (typeof TIME_ACTIVATION_STATES)[number];

// ---------------------------------------------------------------------------
// Mind council sequence — DD.5
// ---------------------------------------------------------------------------

export const COUNCIL_STAGES = [
  "idle",
  "independent",
  "peer_review",
  "assistant_review",
  "chairman_synthesis",
] as const;

export type CouncilStage = (typeof COUNCIL_STAGES)[number];

// ---------------------------------------------------------------------------
// Soul / Reality / Power activation — DD.6 / DD.7 / DD.8
// ---------------------------------------------------------------------------

export const SOUL_STATES = ["idle", "retrieval", "knowledge_write"] as const;

export type SoulState = (typeof SOUL_STATES)[number];

export const REALITY_STATES = ["idle", "room_action", "theme_sync"] as const;

export type RealityState = (typeof REALITY_STATES)[number];

export const POWER_STATES = ["idle", "audit_cycle", "forbidden_alert"] as const;

export type PowerState = (typeof POWER_STATES)[number];

export const GAUNTLET_ZONE_IDS = [
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
] as const;

export type GauntletZoneId = (typeof GAUNTLET_ZONE_IDS)[number];

/** Cartesian position in the gauntlet SVG viewBox (1600 x 900). */
export interface GauntletPoint {
  x: number;
  y: number;
}

export interface GauntletNode {
  node_id: string;
  label: string;
  description: string;
  zone_id: GauntletZoneId;
  position: GauntletPoint;
  /** Optional descriptor — pulses originating here use this stone color. */
  stone: JarvisStone;
  /** True if this node is the terminus before the human gate. */
  approaches_hub: boolean;
  /**
   * Optional categorical kind used by zone renderers (e.g. agent,
   * coordinator, suggestion_inbox, member, chairman, reviewer).
   */
  kind?: string;
  metadata_only: true;
  read_only: true;
}

export interface GauntletEdge {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  zone_id: GauntletZoneId;
  /**
   * `gated` edges are interrupted at the human gate when the hub is in
   * `proposal_pending`. `allowed` edges flow regardless.
   */
  policy: "allowed" | "gated";
  /**
   * Optional categorical kind used by zone renderers to attach
   * presentational classes (e.g. peer / review / synthesis / exit).
   * Purely visual — does not gate behavior.
   */
  kind?: string;
  metadata_only: true;
  read_only: true;
}

export interface GauntletZone {
  zone_id: GauntletZoneId;
  label: string;
  stone: JarvisStoneZone;
  /** True once the zone has been populated by a DD slice. DD.3 = space. */
  populated: boolean;
  nodes: readonly GauntletNode[];
  edges: readonly GauntletEdge[];
  metadata_only: true;
  read_only: true;
}

export interface GauntletHub {
  hub_id: "human-gate";
  label: "Human Gate";
  state: GauntletHubState;
  position: GauntletPoint;
  always_visible: true;
  /** Cosmetic ring color for `default` — switched per state at render. */
  default_ring_stone: "gold";
  metadata_only: true;
  read_only: true;
}

export interface GauntletViewModel {
  model_id: "living-system-map:dd-foundation";
  title: "Living System Map";
  subtitle: string;
  hub: GauntletHub;
  zones: readonly GauntletZone[];
  /**
   * Convenience flag for renderers — DD.3 ships space, DD.4 adds time,
   * DD.5 adds mind. Later DD slices populate the remaining zones.
   */
  populated_zones: readonly GauntletZoneId[];
  /** DD.4 — current Time-zone activation state. */
  time_state: TimeActivationState;
  /** DD.5 — current Mind-zone council stage. */
  mind_council_stage: CouncilStage;
  /** DD.6 — current Soul-zone activation state. */
  soul_state: SoulState;
  /** DD.7 — current Reality-zone activation state. */
  reality_state: RealityState;
  /** DD.8 — current Power-zone activation state. */
  power_state: PowerState;
  metadata_only: true;
  read_only: true;
  execute_affordance_present: false;
  approve_affordance_present: false;
  mutation_affordance_present: false;
  recording_enabled: false;
  voice_enabled: false;
  export_enabled: false;
  live_telemetry_subscribed: false;
}
