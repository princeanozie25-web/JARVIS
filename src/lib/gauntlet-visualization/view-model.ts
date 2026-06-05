/**
 * buildGauntletViewModel — DD.1.
 *
 * Pure, deterministic factory for the Living System Map view model.
 * DD.3 ships the Space zone fully populated; the other five zones are
 * placeholders carrying frozen empty `nodes`/`edges` arrays so later
 * DD slices can fill them without renderer changes.
 */

import {
  COUNCIL_STAGES,
  GAUNTLET_ZONE_IDS,
  HUB_NODE_ID,
  POWER_STATES,
  REALITY_STATES,
  SOUL_STATES,
  TIME_ACTIVATION_STATES,
  type CouncilStage,
  type GauntletEdge,
  type GauntletHub,
  type GauntletHubState,
  type GauntletNode,
  type GauntletViewModel,
  type GauntletZone,
  type GauntletZoneId,
  type PowerState,
  type RealityState,
  type SoulState,
  type TimeActivationState,
} from "./contracts";

/**
 * SVG viewBox — kept constant so positions stay stable across renders.
 * Extended to 2700 vertical units (DD.6–DD.8) so Soul, Reality, and
 * Power get their own spatial band beneath the Time and Mind row.
 */
export const GAUNTLET_VIEWBOX = { width: 1600, height: 2700 } as const;

const HUB_POSITION = { x: 1100, y: 450 } as const;

// ---------------------------------------------------------------------------
// Space zone — DD.3 populated
// ---------------------------------------------------------------------------

interface SpaceNodeSeed {
  node_id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  approaches_hub?: boolean;
}

const SPACE_NODE_SEEDS: readonly SpaceNodeSeed[] = [
  {
    node_id: "input_gateway",
    label: "Input Gateway",
    description: "Captured input enters the space lane.",
    x: 120,
    y: 450,
  },
  {
    node_id: "intent_classifier",
    label: "Intent Classifier",
    description: "Determines intent and capability class.",
    x: 280,
    y: 380,
  },
  {
    node_id: "safety_classifier",
    label: "Safety Classifier",
    description: "Applies safety and privacy classification.",
    x: 280,
    y: 520,
  },
  {
    node_id: "router",
    label: "Router",
    description: "Routes the request to a tier or read-only path.",
    x: 460,
    y: 450,
    approaches_hub: true,
  },
  {
    node_id: "tier_t0",
    label: "Tier T0",
    description: "Read-only voice and observe-only actions.",
    x: 680,
    y: 200,
  },
  {
    node_id: "tier_t1",
    label: "Tier T1",
    description: "Low-risk reversible actions under standing consent.",
    x: 680,
    y: 320,
  },
  {
    node_id: "tier_t2",
    label: "Tier T2",
    description: "Voice-initiated actions requiring UI confirmation.",
    x: 680,
    y: 450,
  },
  {
    node_id: "tier_t3",
    label: "Tier T3",
    description: "Manual-only authority. Approval lifecycle required.",
    x: 680,
    y: 580,
  },
  {
    node_id: "tier_t4",
    label: "Tier T4",
    description: "Restricted execution — disabled by default.",
    x: 680,
    y: 700,
  },
  {
    node_id: "tool_runtime",
    label: "Tool Runtime",
    description: "Approved proposals reach the existing tool runtime.",
    x: 1320,
    y: 320,
  },
  {
    node_id: "audit_store",
    label: "Audit Store",
    description: "Redacted audit metadata only — no raw payloads.",
    x: 1320,
    y: 580,
  },
] as const;

interface SpaceEdgeSeed {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  policy: "allowed" | "gated";
}

const SPACE_EDGE_SEEDS: readonly SpaceEdgeSeed[] = [
  {
    edge_id: "space-edge:input-to-intent",
    from_node_id: "input_gateway",
    to_node_id: "intent_classifier",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:input-to-safety",
    from_node_id: "input_gateway",
    to_node_id: "safety_classifier",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:intent-to-router",
    from_node_id: "intent_classifier",
    to_node_id: "router",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:safety-to-router",
    from_node_id: "safety_classifier",
    to_node_id: "router",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:router-to-t0",
    from_node_id: "router",
    to_node_id: "tier_t0",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:router-to-t1",
    from_node_id: "router",
    to_node_id: "tier_t1",
    policy: "gated",
  },
  {
    edge_id: "space-edge:router-to-t2",
    from_node_id: "router",
    to_node_id: "tier_t2",
    policy: "gated",
  },
  {
    edge_id: "space-edge:router-to-t3",
    from_node_id: "router",
    to_node_id: "tier_t3",
    policy: "gated",
  },
  {
    edge_id: "space-edge:router-to-t4",
    from_node_id: "router",
    to_node_id: "tier_t4",
    policy: "gated",
  },
  {
    edge_id: "space-edge:t1-to-tool",
    from_node_id: "tier_t1",
    to_node_id: "tool_runtime",
    policy: "gated",
  },
  {
    edge_id: "space-edge:t2-to-tool",
    from_node_id: "tier_t2",
    to_node_id: "tool_runtime",
    policy: "gated",
  },
  {
    edge_id: "space-edge:t3-to-tool",
    from_node_id: "tier_t3",
    to_node_id: "tool_runtime",
    policy: "gated",
  },
  {
    edge_id: "space-edge:tool-to-audit",
    from_node_id: "tool_runtime",
    to_node_id: "audit_store",
    policy: "allowed",
  },
  {
    edge_id: "space-edge:t0-to-audit",
    from_node_id: "tier_t0",
    to_node_id: "audit_store",
    policy: "allowed",
  },
] as const;

function makeSpaceZone(): GauntletZone {
  const nodes: GauntletNode[] = SPACE_NODE_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "space",
    position: { x: seed.x, y: seed.y },
    stone: "space",
    approaches_hub: seed.approaches_hub === true,
    metadata_only: true,
    read_only: true,
  }));
  const edges: GauntletEdge[] = SPACE_EDGE_SEEDS.map((seed) => ({
    edge_id: seed.edge_id,
    from_node_id: seed.from_node_id,
    to_node_id: seed.to_node_id,
    zone_id: "space",
    policy: seed.policy,
    metadata_only: true,
    read_only: true,
  }));
  return Object.freeze({
    zone_id: "space",
    label: "Space",
    stone: "space",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze(edges) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

// ---------------------------------------------------------------------------
// Time zone — DD.4 (orbital agent ecosystem)
// ---------------------------------------------------------------------------

const TIME_CENTER = { x: 400, y: 1250 } as const;
const TIME_ORBIT_RADIUS = 180;
const TIME_SUGGESTION_INBOX_POSITION = { x: 760, y: 1250 } as const;

interface TimeAgentSeed {
  node_id: string;
  label: string;
  description: string;
  angleDegrees: number;
}

const TIME_AGENT_SEEDS: readonly TimeAgentSeed[] = [
  {
    node_id: "life_coach",
    label: "Life Coach",
    description: "Personal coaching agent — observations only.",
    angleDegrees: 0,
  },
  {
    node_id: "build_monitor",
    label: "Build Monitor",
    description: "Watches build and gate health metadata.",
    angleDegrees: 45,
  },
  {
    node_id: "research",
    label: "Research",
    description: "Background research and digest agent.",
    angleDegrees: 90,
  },
  {
    node_id: "cv_maintenance",
    label: "CV Maintenance",
    description: "Keeps career artefacts current; advisory only.",
    angleDegrees: 135,
  },
  {
    node_id: "job_scout",
    label: "Job Scout",
    description: "Read-only feed ingestion and ranking.",
    angleDegrees: 180,
  },
  {
    node_id: "morning_brief",
    label: "Morning Brief",
    description: "Composes governed daily brief metadata.",
    angleDegrees: 225,
  },
  {
    node_id: "deadline",
    label: "Deadline",
    description: "Tracks gated commitments and rolling deadlines.",
    angleDegrees: 270,
  },
  {
    node_id: "cost_monitor",
    label: "Cost Monitor",
    description: "Cost telemetry observer — metadata only.",
    angleDegrees: 315,
  },
];

function orbitalPosition(angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.round(TIME_CENTER.x + Math.cos(radians) * TIME_ORBIT_RADIUS),
    y: Math.round(TIME_CENTER.y + Math.sin(radians) * TIME_ORBIT_RADIUS),
  };
}

function makeTimeZone(): GauntletZone {
  const agents: GauntletNode[] = TIME_AGENT_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "time",
    position: orbitalPosition(seed.angleDegrees),
    stone: "time",
    approaches_hub: false,
    kind: "agent",
    metadata_only: true,
    read_only: true,
  }));

  const coordinator: GauntletNode = {
    node_id: "agent_coordinator",
    label: "Agent Coordinator",
    description: "Orchestrates governed agent proposals.",
    zone_id: "time",
    position: { ...TIME_CENTER },
    stone: "time",
    approaches_hub: false,
    kind: "coordinator",
    metadata_only: true,
    read_only: true,
  };

  const suggestionInbox: GauntletNode = {
    node_id: "suggestion_inbox",
    label: "Suggestion Inbox",
    description: "Aggregated suggestions await human review.",
    zone_id: "time",
    position: { ...TIME_SUGGESTION_INBOX_POSITION },
    stone: "time",
    approaches_hub: true,
    kind: "suggestion_inbox",
    metadata_only: true,
    read_only: true,
  };

  const nodes: GauntletNode[] = [...agents, coordinator, suggestionInbox];

  const agentFeedEdges: GauntletEdge[] = agents.map((agent) => ({
    edge_id: `time-edge:${agent.node_id}-to-coordinator`,
    from_node_id: agent.node_id,
    to_node_id: coordinator.node_id,
    zone_id: "time",
    policy: "allowed",
    kind: "agent_feed",
    metadata_only: true,
    read_only: true,
  }));

  const aggregateEdge: GauntletEdge = {
    edge_id: "time-edge:coordinator-to-inbox",
    from_node_id: coordinator.node_id,
    to_node_id: suggestionInbox.node_id,
    zone_id: "time",
    policy: "allowed",
    kind: "aggregate",
    metadata_only: true,
    read_only: true,
  };

  const exitEdge: GauntletEdge = {
    edge_id: "time-edge:inbox-to-gate",
    from_node_id: suggestionInbox.node_id,
    to_node_id: HUB_NODE_ID,
    zone_id: "time",
    policy: "gated",
    kind: "exit",
    metadata_only: true,
    read_only: true,
  };

  return Object.freeze({
    zone_id: "time",
    label: "Time",
    stone: "time",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze([
      ...agentFeedEdges,
      aggregateEdge,
      exitEdge,
    ]) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

// ---------------------------------------------------------------------------
// Mind zone — DD.5 (hexagonal council ecosystem)
// ---------------------------------------------------------------------------

const MIND_CENTER = { x: 1100, y: 1250 } as const;
const MIND_OUTER_RADIUS = 200;

interface MindMemberSeed {
  node_id: string;
  label: string;
  description: string;
  angleDegrees: number;
}

const MIND_MEMBER_SEEDS: readonly MindMemberSeed[] = [
  {
    node_id: "member_1",
    label: "Member 1",
    description: "Independent council voice.",
    angleDegrees: -90,
  },
  {
    node_id: "member_2",
    label: "Member 2",
    description: "Independent council voice.",
    angleDegrees: -30,
  },
  {
    node_id: "member_3",
    label: "Member 3",
    description: "Independent council voice.",
    angleDegrees: 30,
  },
  {
    node_id: "member_4",
    label: "Member 4",
    description: "Independent council voice.",
    angleDegrees: 90,
  },
  {
    node_id: "member_5",
    label: "Member 5",
    description: "Independent council voice.",
    angleDegrees: 150,
  },
  {
    node_id: "member_6",
    label: "Member 6",
    description: "Independent council voice.",
    angleDegrees: 210,
  },
];

function mindMemberPosition(angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.round(MIND_CENTER.x + Math.cos(radians) * MIND_OUTER_RADIUS),
    y: Math.round(MIND_CENTER.y + Math.sin(radians) * MIND_OUTER_RADIUS),
  };
}

function makeMindZone(): GauntletZone {
  const members: GauntletNode[] = MIND_MEMBER_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "mind",
    position: mindMemberPosition(seed.angleDegrees),
    stone: "mind",
    approaches_hub: false,
    kind: "member",
    metadata_only: true,
    read_only: true,
  }));

  const reviewer: GauntletNode = {
    node_id: "assistant_reviewer",
    label: "Assistant Reviewer",
    description: "Reads peer reviews; never writes.",
    zone_id: "mind",
    position: { x: MIND_CENTER.x, y: MIND_CENTER.y - 100 },
    stone: "mind",
    approaches_hub: false,
    kind: "reviewer",
    metadata_only: true,
    read_only: true,
  };

  const chairman: GauntletNode = {
    node_id: "chairman",
    label: "Chairman",
    description:
      "Synthesises the final advisory answer — never an authority surface.",
    zone_id: "mind",
    position: { ...MIND_CENTER },
    stone: "mind",
    approaches_hub: true,
    kind: "chairman",
    metadata_only: true,
    read_only: true,
  };

  const coordinator: GauntletNode = {
    node_id: "coordinator",
    label: "Coordinator",
    description: "Stages the council sequence; advisory only.",
    zone_id: "mind",
    position: { x: MIND_CENTER.x, y: MIND_CENTER.y + 100 },
    stone: "mind",
    approaches_hub: false,
    kind: "coordinator",
    metadata_only: true,
    read_only: true,
  };

  const nodes: GauntletNode[] = [...members, reviewer, chairman, coordinator];

  // Peer-review ring — 6 edges between adjacent members.
  const peerEdges: GauntletEdge[] = members.map((member, index) => {
    const next = members[(index + 1) % members.length];
    return {
      edge_id: `mind-edge:peer-${member.node_id}-${next.node_id}`,
      from_node_id: member.node_id,
      to_node_id: next.node_id,
      zone_id: "mind",
      policy: "allowed",
      kind: "peer",
      metadata_only: true,
      read_only: true,
    } satisfies GauntletEdge;
  });

  // Assistant review — every member → reviewer.
  const reviewEdges: GauntletEdge[] = members.map((member) => ({
    edge_id: `mind-edge:review-${member.node_id}`,
    from_node_id: member.node_id,
    to_node_id: reviewer.node_id,
    zone_id: "mind",
    policy: "allowed",
    kind: "review",
    metadata_only: true,
    read_only: true,
  }));

  // Coordinator stages the council — visible as a coordinator → chairman link.
  const coordinatorEdge: GauntletEdge = {
    edge_id: "mind-edge:coordinator-to-chairman",
    from_node_id: coordinator.node_id,
    to_node_id: chairman.node_id,
    zone_id: "mind",
    policy: "allowed",
    kind: "coordinator",
    metadata_only: true,
    read_only: true,
  };

  // Reviewer → chairman synthesis.
  const synthesisEdge: GauntletEdge = {
    edge_id: "mind-edge:reviewer-to-chairman",
    from_node_id: reviewer.node_id,
    to_node_id: chairman.node_id,
    zone_id: "mind",
    policy: "allowed",
    kind: "synthesis",
    metadata_only: true,
    read_only: true,
  };

  // Chairman → human gate — gated exit.
  const exitEdge: GauntletEdge = {
    edge_id: "mind-edge:chairman-to-gate",
    from_node_id: chairman.node_id,
    to_node_id: HUB_NODE_ID,
    zone_id: "mind",
    policy: "gated",
    kind: "exit",
    metadata_only: true,
    read_only: true,
  };

  return Object.freeze({
    zone_id: "mind",
    label: "Mind",
    stone: "mind",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze([
      ...peerEdges,
      ...reviewEdges,
      coordinatorEdge,
      synthesisEdge,
      exitEdge,
    ]) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

// ---------------------------------------------------------------------------
// Soul zone — DD.6 (molten amber vault ecosystem)
// ---------------------------------------------------------------------------

const SOUL_CENTER = { x: 400, y: 1900 } as const;
const SOUL_ORBIT_RADIUS = 170;
const SOUL_COMPOUNDING_POSITION = { x: 760, y: 1900 } as const;

interface SoulSatelliteSeed {
  node_id: string;
  label: string;
  description: string;
  angleDegrees: number;
}

const SOUL_SATELLITE_SEEDS: readonly SoulSatelliteSeed[] = [
  {
    node_id: "sqlite_vec",
    label: "Vector Store",
    description: "sqlite_vec embedding index over vault memory.",
    angleDegrees: 0,
  },
  {
    node_id: "librarian_agent",
    label: "Librarian",
    description: "Retrieval router over the vault and vector store.",
    angleDegrees: -60,
  },
  {
    node_id: "llm_wiki",
    label: "LLM Wiki",
    description: "Curated wiki surface for governed reads.",
    angleDegrees: -120,
  },
  {
    node_id: "session_memory",
    label: "Session Memory",
    description: "Per-session memory feeds the vault on commit.",
    angleDegrees: 180,
  },
  {
    node_id: "project_intelligence",
    label: "Project Intelligence",
    description: "Compounded project knowledge — read only.",
    angleDegrees: 120,
  },
];

function soulOrbitPosition(angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.round(SOUL_CENTER.x + Math.cos(radians) * SOUL_ORBIT_RADIUS),
    y: Math.round(SOUL_CENTER.y + Math.sin(radians) * SOUL_ORBIT_RADIUS),
  };
}

function makeSoulZone(): GauntletZone {
  const vault: GauntletNode = {
    node_id: "obsidian_vault",
    label: "Obsidian Vault",
    description: "Authoritative memory vault — slow heartbeat.",
    zone_id: "soul",
    position: { ...SOUL_CENTER },
    stone: "soul",
    approaches_hub: false,
    kind: "vault",
    metadata_only: true,
    read_only: true,
  };

  const satellites: GauntletNode[] = SOUL_SATELLITE_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "soul",
    position: soulOrbitPosition(seed.angleDegrees),
    stone: "soul",
    approaches_hub: false,
    kind:
      seed.node_id === "sqlite_vec"
        ? "vec_store"
        : seed.node_id === "librarian_agent"
          ? "router"
          : seed.node_id === "llm_wiki"
            ? "wiki"
            : seed.node_id === "session_memory"
              ? "session"
              : "intelligence",
    metadata_only: true,
    read_only: true,
  }));

  const compounding: GauntletNode = {
    node_id: "knowledge_compounding",
    label: "Knowledge Compounding",
    description: "Promotes vetted knowledge — exits gated to Human Gate.",
    zone_id: "soul",
    position: { ...SOUL_COMPOUNDING_POSITION },
    stone: "soul",
    approaches_hub: true,
    kind: "compounding",
    metadata_only: true,
    read_only: true,
  };

  const nodes: GauntletNode[] = [vault, ...satellites, compounding];

  const edges: GauntletEdge[] = [
    {
      edge_id: "soul-edge:session-to-vault",
      from_node_id: "session_memory",
      to_node_id: "obsidian_vault",
      zone_id: "soul",
      policy: "allowed",
      kind: "memory_write",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:vault-to-vec",
      from_node_id: "obsidian_vault",
      to_node_id: "sqlite_vec",
      zone_id: "soul",
      policy: "allowed",
      kind: "index",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:vec-to-librarian",
      from_node_id: "sqlite_vec",
      to_node_id: "librarian_agent",
      zone_id: "soul",
      policy: "allowed",
      kind: "retrieval",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:librarian-to-wiki",
      from_node_id: "librarian_agent",
      to_node_id: "llm_wiki",
      zone_id: "soul",
      policy: "allowed",
      kind: "publish",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:wiki-to-intelligence",
      from_node_id: "llm_wiki",
      to_node_id: "project_intelligence",
      zone_id: "soul",
      policy: "allowed",
      kind: "compound",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:intelligence-to-compounding",
      from_node_id: "project_intelligence",
      to_node_id: "knowledge_compounding",
      zone_id: "soul",
      policy: "allowed",
      kind: "promote",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "soul-edge:compounding-to-gate",
      from_node_id: "knowledge_compounding",
      to_node_id: HUB_NODE_ID,
      zone_id: "soul",
      policy: "gated",
      kind: "exit",
      metadata_only: true,
      read_only: true,
    },
  ];

  return Object.freeze({
    zone_id: "soul",
    label: "Soul",
    stone: "soul",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze(edges) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

// ---------------------------------------------------------------------------
// Reality zone — DD.7 (crystalline device ecosystem)
// ---------------------------------------------------------------------------

const REALITY_CENTER = { x: 1200, y: 1900 } as const;
const REALITY_RING_RADIUS = 180;

interface RealitySatelliteSeed {
  node_id: string;
  label: string;
  description: string;
  angleDegrees: number;
  kind: "registry" | "adapter" | "sensor";
  mock?: boolean;
}

const REALITY_SATELLITE_SEEDS: readonly RealitySatelliteSeed[] = [
  {
    node_id: "room_registry",
    label: "Room Registry",
    description: "Declarative room model — fed by sensors.",
    angleDegrees: -90,
    kind: "registry",
  },
  {
    node_id: "hue_bridge",
    label: "Hue Bridge",
    description: "Hue adapter — mock until paired.",
    angleDegrees: -30,
    kind: "adapter",
    mock: true,
  },
  {
    node_id: "fancyled",
    label: "FancyLED",
    description: "FancyLED adapter — mock until provisioned.",
    angleDegrees: 30,
    kind: "adapter",
    mock: true,
  },
  {
    node_id: "nanoleaf",
    label: "Nanoleaf",
    description: "Nanoleaf adapter — mock until authorised.",
    angleDegrees: 90,
    kind: "adapter",
    mock: true,
  },
  {
    node_id: "tapo_plugs",
    label: "Tapo Plugs",
    description: "Tapo smart-plug adapter — mock until linked.",
    angleDegrees: 150,
    kind: "adapter",
    mock: true,
  },
  {
    node_id: "ruview_sensors",
    label: "RuView Sensors",
    description: "Room sensors — feedback into the registry.",
    angleDegrees: 210,
    kind: "sensor",
  },
];

function realityRingPosition(angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.round(REALITY_CENTER.x + Math.cos(radians) * REALITY_RING_RADIUS),
    y: Math.round(REALITY_CENTER.y + Math.sin(radians) * REALITY_RING_RADIUS),
  };
}

function makeRealityZone(): GauntletZone {
  const themeEngine: GauntletNode = {
    node_id: "theme_engine",
    label: "Theme Engine",
    description: "Synchronizes themes across rooms — gated exit.",
    zone_id: "reality",
    position: { ...REALITY_CENTER },
    stone: "reality",
    approaches_hub: true,
    kind: "theme_engine",
    metadata_only: true,
    read_only: true,
  };

  const satellites: GauntletNode[] = REALITY_SATELLITE_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "reality",
    position: realityRingPosition(seed.angleDegrees),
    stone: "reality",
    approaches_hub: false,
    kind: seed.mock ? `${seed.kind}_mock` : seed.kind,
    metadata_only: true,
    read_only: true,
  }));

  const nodes: GauntletNode[] = [themeEngine, ...satellites];

  const syncEdges: GauntletEdge[] = REALITY_SATELLITE_SEEDS.filter(
    (seed) => seed.kind === "adapter",
  ).map((seed) => ({
    edge_id: `reality-edge:theme-to-${seed.node_id}`,
    from_node_id: "theme_engine",
    to_node_id: seed.node_id,
    zone_id: "reality",
    policy: "allowed",
    kind: "sync",
    metadata_only: true,
    read_only: true,
  }));

  const edges: GauntletEdge[] = [
    {
      edge_id: "reality-edge:sensors-to-registry",
      from_node_id: "ruview_sensors",
      to_node_id: "room_registry",
      zone_id: "reality",
      policy: "allowed",
      kind: "sense",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "reality-edge:registry-to-theme",
      from_node_id: "room_registry",
      to_node_id: "theme_engine",
      zone_id: "reality",
      policy: "allowed",
      kind: "stage",
      metadata_only: true,
      read_only: true,
    },
    ...syncEdges,
    {
      edge_id: "reality-edge:theme-to-gate",
      from_node_id: "theme_engine",
      to_node_id: HUB_NODE_ID,
      zone_id: "reality",
      policy: "gated",
      kind: "exit",
      metadata_only: true,
      read_only: true,
    },
  ];

  return Object.freeze({
    zone_id: "reality",
    label: "Reality",
    stone: "reality",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze(edges) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

// ---------------------------------------------------------------------------
// Power zone — DD.8 (fortress reactor ecosystem)
// ---------------------------------------------------------------------------

const POWER_CENTER = { x: 800, y: 2400 } as const;
const POWER_RING_RADIUS = 200;

interface PowerSatelliteSeed {
  node_id: string;
  label: string;
  description: string;
  angleDegrees: number;
  kind: "audit" | "cai" | "sandbox";
}

const POWER_SATELLITE_SEEDS: readonly PowerSatelliteSeed[] = [
  {
    node_id: "architecture_graph",
    label: "Architecture Graph",
    description: "Dual-graph snapshot — read only.",
    angleDegrees: -90,
    kind: "audit",
  },
  {
    node_id: "telemetry_cockpit",
    label: "Telemetry Cockpit",
    description: "Telemetry stream — observe only.",
    angleDegrees: -30,
    kind: "audit",
  },
  {
    node_id: "governance_visualizer",
    label: "Governance Visualizer",
    description: "Governance state and forbidden-edge alerts.",
    angleDegrees: 30,
    kind: "audit",
  },
  {
    node_id: "cai_manifest",
    label: "CAI Manifest",
    description: "Constitutional manifest — read only.",
    angleDegrees: 90,
    kind: "cai",
  },
  {
    node_id: "cai_adapter",
    label: "CAI Adapter",
    description: "Adapts policy onto execution proposals.",
    angleDegrees: 150,
    kind: "cai",
  },
  {
    node_id: "red_team_sandbox",
    label: "Red Team Sandbox",
    description: "Adversarial probe surface — sandboxed.",
    angleDegrees: 210,
    kind: "sandbox",
  },
];

function powerRingPosition(angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: Math.round(POWER_CENTER.x + Math.cos(radians) * POWER_RING_RADIUS),
    y: Math.round(POWER_CENTER.y + Math.sin(radians) * POWER_RING_RADIUS),
  };
}

function makePowerZone(): GauntletZone {
  const executionGate: GauntletNode = {
    node_id: "cai_execution_gate",
    label: "CAI Execution Gate",
    description: "Final gate before Human Gate — locked until policy clears.",
    zone_id: "power",
    position: { x: POWER_CENTER.x + 280, y: POWER_CENTER.y },
    stone: "power",
    approaches_hub: true,
    kind: "gate",
    metadata_only: true,
    read_only: true,
  };

  const satellites: GauntletNode[] = POWER_SATELLITE_SEEDS.map((seed) => ({
    node_id: seed.node_id,
    label: seed.label,
    description: seed.description,
    zone_id: "power",
    position: powerRingPosition(seed.angleDegrees),
    stone: "power",
    approaches_hub: false,
    kind: seed.kind,
    metadata_only: true,
    read_only: true,
  }));

  const reactor: GauntletNode = {
    node_id: "reactor_core",
    label: "Reactor Core",
    description: "Contained reactor core — coordinates the fortress.",
    zone_id: "power",
    position: { ...POWER_CENTER },
    stone: "power",
    approaches_hub: false,
    kind: "reactor",
    metadata_only: true,
    read_only: true,
  };

  const nodes: GauntletNode[] = [reactor, ...satellites, executionGate];

  const edges: GauntletEdge[] = [
    // Audit heartbeat cycle.
    {
      edge_id: "power-edge:arch-to-telemetry",
      from_node_id: "architecture_graph",
      to_node_id: "telemetry_cockpit",
      zone_id: "power",
      policy: "allowed",
      kind: "audit",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "power-edge:telemetry-to-governance",
      from_node_id: "telemetry_cockpit",
      to_node_id: "governance_visualizer",
      zone_id: "power",
      policy: "allowed",
      kind: "audit",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "power-edge:governance-to-arch",
      from_node_id: "governance_visualizer",
      to_node_id: "architecture_graph",
      zone_id: "power",
      policy: "allowed",
      kind: "audit",
      metadata_only: true,
      read_only: true,
    },
    // Red team forbidden-edge alert routed via governance.
    {
      edge_id: "power-edge:sandbox-to-governance",
      from_node_id: "red_team_sandbox",
      to_node_id: "governance_visualizer",
      zone_id: "power",
      policy: "allowed",
      kind: "forbidden",
      metadata_only: true,
      read_only: true,
    },
    // CAI proposal chain into the execution gate.
    {
      edge_id: "power-edge:manifest-to-adapter",
      from_node_id: "cai_manifest",
      to_node_id: "cai_adapter",
      zone_id: "power",
      policy: "allowed",
      kind: "manifest",
      metadata_only: true,
      read_only: true,
    },
    {
      edge_id: "power-edge:adapter-to-gate",
      from_node_id: "cai_adapter",
      to_node_id: "cai_execution_gate",
      zone_id: "power",
      policy: "gated",
      kind: "proposal",
      metadata_only: true,
      read_only: true,
    },
    // Exit to Human Gate.
    {
      edge_id: "power-edge:gate-to-hub",
      from_node_id: "cai_execution_gate",
      to_node_id: HUB_NODE_ID,
      zone_id: "power",
      policy: "gated",
      kind: "exit",
      metadata_only: true,
      read_only: true,
    },
  ];

  return Object.freeze({
    zone_id: "power",
    label: "Power",
    stone: "power",
    populated: true,
    nodes: Object.freeze(nodes) as readonly GauntletNode[],
    edges: Object.freeze(edges) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

function makePlaceholderZone(zone_id: GauntletZoneId): GauntletZone {
  return Object.freeze({
    zone_id,
    label: zone_id.charAt(0).toUpperCase() + zone_id.slice(1),
    stone: zone_id,
    populated: false,
    nodes: Object.freeze([]) as readonly GauntletNode[],
    edges: Object.freeze([]) as readonly GauntletEdge[],
    metadata_only: true,
    read_only: true,
  } satisfies GauntletZone);
}

export interface BuildGauntletViewModelInput {
  hubState?: GauntletHubState;
  timeState?: TimeActivationState;
  councilStage?: CouncilStage;
  soulState?: SoulState;
  realityState?: RealityState;
  powerState?: PowerState;
}

const POPULATED_ZONE_IDS: readonly GauntletZoneId[] = Object.freeze([
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
]);

function isKnownTimeState(value: unknown): value is TimeActivationState {
  return (
    typeof value === "string" &&
    (TIME_ACTIVATION_STATES as readonly string[]).includes(value)
  );
}

function isKnownCouncilStage(value: unknown): value is CouncilStage {
  return (
    typeof value === "string" &&
    (COUNCIL_STAGES as readonly string[]).includes(value)
  );
}

function isKnownSoulState(value: unknown): value is SoulState {
  return (
    typeof value === "string" &&
    (SOUL_STATES as readonly string[]).includes(value)
  );
}

function isKnownRealityState(value: unknown): value is RealityState {
  return (
    typeof value === "string" &&
    (REALITY_STATES as readonly string[]).includes(value)
  );
}

function isKnownPowerState(value: unknown): value is PowerState {
  return (
    typeof value === "string" &&
    (POWER_STATES as readonly string[]).includes(value)
  );
}

export function buildGauntletViewModel(
  input: BuildGauntletViewModelInput = {},
): GauntletViewModel {
  const hubState: GauntletHubState = input.hubState ?? "default";
  const timeState: TimeActivationState = isKnownTimeState(input.timeState)
    ? input.timeState
    : "idle";
  const councilStage: CouncilStage = isKnownCouncilStage(input.councilStage)
    ? input.councilStage
    : "idle";
  const soulState: SoulState = isKnownSoulState(input.soulState)
    ? input.soulState
    : "idle";
  const realityState: RealityState = isKnownRealityState(input.realityState)
    ? input.realityState
    : "idle";
  const powerState: PowerState = isKnownPowerState(input.powerState)
    ? input.powerState
    : "idle";

  const hub: GauntletHub = Object.freeze({
    hub_id: "human-gate",
    label: "Human Gate",
    state: hubState,
    position: HUB_POSITION,
    always_visible: true,
    default_ring_stone: "gold",
    metadata_only: true,
    read_only: true,
  });

  const zones: GauntletZone[] = GAUNTLET_ZONE_IDS.map((zone_id) => {
    if (zone_id === "space") return makeSpaceZone();
    if (zone_id === "time") return makeTimeZone();
    if (zone_id === "mind") return makeMindZone();
    if (zone_id === "soul") return makeSoulZone();
    if (zone_id === "reality") return makeRealityZone();
    if (zone_id === "power") return makePowerZone();
    return makePlaceholderZone(zone_id);
  });

  return Object.freeze({
    model_id: "living-system-map:dd-foundation",
    title: "Living System Map",
    subtitle:
      "Read-only governed flow. DD.3-DD.8 ship Space, Time, Mind, Soul, Reality, and Power — every flow terminates at the Human Gate.",
    hub,
    zones: Object.freeze(zones) as readonly GauntletZone[],
    populated_zones: POPULATED_ZONE_IDS,
    time_state: timeState,
    mind_council_stage: councilStage,
    soul_state: soulState,
    reality_state: realityState,
    power_state: powerState,
    metadata_only: true,
    read_only: true,
    execute_affordance_present: false,
    approve_affordance_present: false,
    mutation_affordance_present: false,
    recording_enabled: false,
    voice_enabled: false,
    export_enabled: false,
    live_telemetry_subscribed: false,
  } satisfies GauntletViewModel);
}
