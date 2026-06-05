/**
 * Demo fixtures — DD.1.
 *
 * Static event sequences that walk a captured input through the Space
 * zone, halt at the Human Gate, and resume after approval. Fixtures
 * are the only event source DD.0-DD.3 understands; live telemetry
 * subscription is explicitly deferred to a later slice.
 */

import { parseGauntletEvent, type GauntletEvent } from "./events";

/**
 * Canonical happy-path demo: input enters, classification runs,
 * router targets a gated tier, the hub goes to `proposal_pending`,
 * approval is granted, and execution flows to the audit store.
 */
export const DEMO_GAUNTLET_FIXTURE_HAPPY_PATH: readonly GauntletEvent[] =
  Object.freeze(
    [
      {
        event_id: "fixture:happy:001",
        timestamp: 0,
        zone_id: "space" as const,
        source_node_id: "input_gateway",
        target_node_id: "intent_classifier",
        kind: "pulse_start" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:002",
        timestamp: 200,
        zone_id: "space" as const,
        source_node_id: "intent_classifier",
        target_node_id: "router",
        kind: "pulse_arrive" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:003",
        timestamp: 400,
        zone_id: "space" as const,
        source_node_id: "router",
        target_node_id: "tier_t2",
        kind: "pulse_start" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:004",
        timestamp: 600,
        zone_id: "hub" as const,
        source_node_id: "tier_t2",
        target_node_id: "human-gate",
        kind: "halt" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:005",
        timestamp: 650,
        zone_id: "hub" as const,
        source_node_id: "human-gate",
        target_node_id: null,
        kind: "proposal_pending" as const,
        hub_state: "proposal_pending" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:006",
        timestamp: 1800,
        zone_id: "hub" as const,
        source_node_id: "human-gate",
        target_node_id: null,
        kind: "approved" as const,
        hub_state: "approved" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:007",
        timestamp: 1850,
        zone_id: "hub" as const,
        source_node_id: "human-gate",
        target_node_id: "tool_runtime",
        kind: "resume" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:008",
        timestamp: 2000,
        zone_id: "space" as const,
        source_node_id: "tier_t2",
        target_node_id: "tool_runtime",
        kind: "pulse_arrive" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:happy:009",
        timestamp: 2200,
        zone_id: "space" as const,
        source_node_id: "tool_runtime",
        target_node_id: "audit_store",
        kind: "pulse_arrive" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
    ].map(parseGauntletEvent),
  ) as readonly GauntletEvent[];

/**
 * Denied-path demo: the hub denies the proposal — pulses do not
 * resume, audit still receives a metadata-only record.
 */
export const DEMO_GAUNTLET_FIXTURE_DENIED: readonly GauntletEvent[] =
  Object.freeze(
    [
      {
        event_id: "fixture:denied:001",
        timestamp: 0,
        zone_id: "space" as const,
        source_node_id: "input_gateway",
        target_node_id: "intent_classifier",
        kind: "pulse_start" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:denied:002",
        timestamp: 300,
        zone_id: "space" as const,
        source_node_id: "router",
        target_node_id: "tier_t3",
        kind: "pulse_start" as const,
        pulse_stone: "space" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:denied:003",
        timestamp: 600,
        zone_id: "hub" as const,
        source_node_id: "tier_t3",
        target_node_id: "human-gate",
        kind: "halt" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:denied:004",
        timestamp: 650,
        zone_id: "hub" as const,
        source_node_id: "human-gate",
        target_node_id: null,
        kind: "proposal_pending" as const,
        hub_state: "proposal_pending" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
      {
        event_id: "fixture:denied:005",
        timestamp: 1800,
        zone_id: "hub" as const,
        source_node_id: "human-gate",
        target_node_id: null,
        kind: "denied" as const,
        hub_state: "denied" as const,
        metadata_only: true as const,
        read_only: true as const,
      },
    ].map(parseGauntletEvent),
  ) as readonly GauntletEvent[];

export const DEMO_GAUNTLET_FIXTURES = Object.freeze({
  happy_path: DEMO_GAUNTLET_FIXTURE_HAPPY_PATH,
  denied: DEMO_GAUNTLET_FIXTURE_DENIED,
} as const);

export type DemoGauntletFixtureName = keyof typeof DEMO_GAUNTLET_FIXTURES;

/** Deny-by-default loader — unknown name falls back to `happy_path`. */
export function loadDemoGauntletFixture(
  name?: DemoGauntletFixtureName | string,
): readonly GauntletEvent[] {
  if (
    typeof name === "string" &&
    Object.prototype.hasOwnProperty.call(DEMO_GAUNTLET_FIXTURES, name)
  ) {
    return DEMO_GAUNTLET_FIXTURES[name as DemoGauntletFixtureName];
  }
  return DEMO_GAUNTLET_FIXTURES.happy_path;
}
