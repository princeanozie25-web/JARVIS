import { EXPANSION_ERA_AGENT_IDS } from "@/lib/agent-runtime/contract";

// Program U.4 (E-031) — the left rail's presence marks, built from the REAL
// agent registry (agent-runtime contract). Brief §4: today the rail shows
// agent-runtime metadata with STATIC roles; live worker states arrive with
// Track A. Provenance is carried on every mark so the rail cannot pretend
// a registry entry is a running worker.

export const PRESENCE_STATES = [
  "working",
  "waiting",
  "blocked",
  "sleeping",
  "offline",
] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export interface PresenceMark {
  readonly id: (typeof EXPANSION_ERA_AGENT_IDS)[number];
  readonly label: string;
  readonly initials: string;
  readonly state: PresenceState;
  readonly provenance: "registry";
}

const LABELS: Readonly<Record<PresenceMark["id"], string>> = {
  life_coach: "Life Coach",
  build_monitor: "Build Monitor",
  research_agent: "Research",
  cv_maintenance: "CV Maintenance",
  application_tracker: "Application Tracker",
  deadline_agent: "Deadlines",
  cost_monitor: "Cost Monitor",
  health_agent: "Health",
};

export function buildPresenceRail(): readonly PresenceMark[] {
  return EXPANSION_ERA_AGENT_IDS.map((id) => ({
    id,
    label: LABELS[id],
    initials: LABELS[id]
      .split(" ")
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    // No worker runtime exists yet (Track A): every registered agent is
    // honestly asleep. Never "working" from static metadata.
    state: "sleeping",
    provenance: "registry",
  }));
}
