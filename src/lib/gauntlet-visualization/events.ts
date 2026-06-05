/**
 * Gauntlet event schema — DD.1.
 *
 * Zod-validated, metadata-only event envelope for the Living System
 * Map. The schema is the boundary that demo fixtures and (later)
 * live subscriptions must cross. Every event carries an explicit
 * `metadata_only: true` / `read_only: true` tag so accidental wiring
 * to side-effectful streams fails closed.
 */

import { z } from "zod";

import { GAUNTLET_HUB_STATES, GAUNTLET_ZONE_IDS } from "./contracts";

export const GAUNTLET_EVENT_KINDS = [
  "pulse_start",
  "pulse_arrive",
  "halt",
  "resume",
  "proposal_pending",
  "approved",
  "denied",
] as const;

export const GauntletEventKindSchema = z.enum(GAUNTLET_EVENT_KINDS);
export type GauntletEventKind = z.infer<typeof GauntletEventKindSchema>;

export const GauntletEventZoneSchema = z.enum([...GAUNTLET_ZONE_IDS, "hub"]);
export type GauntletEventZone = z.infer<typeof GauntletEventZoneSchema>;

export const GauntletHubStateSchema = z.enum(GAUNTLET_HUB_STATES);

export const GauntletEventSchema = z.object({
  event_id: z.string().min(1),
  /** Logical clock — monotonic across a fixture stream. */
  timestamp: z.number().int().nonnegative(),
  zone_id: GauntletEventZoneSchema,
  source_node_id: z.string().min(1),
  target_node_id: z.string().min(1).nullable(),
  kind: GauntletEventKindSchema,
  pulse_stone: z
    .enum([
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
      "gold",
      "flame",
      "ruby",
    ])
    .optional(),
  hub_state: GauntletHubStateSchema.optional(),
  /** Free-form metadata-only annotation; never contains raw payloads. */
  note: z.string().max(200).optional(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export type GauntletEvent = z.infer<typeof GauntletEventSchema>;

/** Throwing parse — used by tests and fixture loaders. */
export function parseGauntletEvent(input: unknown): GauntletEvent {
  return GauntletEventSchema.parse(input);
}

/** Non-throwing parse — returns null on invalid input. */
export function tryParseGauntletEvent(input: unknown): GauntletEvent | null {
  const result = GauntletEventSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function isHubStateEvent(event: GauntletEvent): boolean {
  return (
    event.zone_id === "hub" &&
    (event.kind === "proposal_pending" ||
      event.kind === "approved" ||
      event.kind === "denied")
  );
}
