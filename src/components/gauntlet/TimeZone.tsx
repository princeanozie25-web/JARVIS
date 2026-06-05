import { stoneColorVar } from "@/lib/design-tokens";
import {
  HUB_NODE_ID,
  type GauntletEdge,
  type GauntletHub,
  type GauntletNode,
  type GauntletPoint,
  type GauntletZone,
  type TimeActivationState,
} from "@/lib/gauntlet-visualization";

/**
 * Time zone — DD.4.
 *
 * Orbital agent ecosystem. Eight agents ride a circle around
 * `agent_coordinator`; the coordinator aggregates into
 * `suggestion_inbox`, which exits gated through the Human Gate.
 *
 * Visual law (DD.4 brief):
 *   - idle               slow orbital breathing — restrained energy
 *   - scheduler_tick     ring brightens; coordinator anticipates
 *   - coordinator_pulse  coordinator emits
 *   - agent_ignition     agents ignite in turn
 *   - suggestion_pulse   suggestion_inbox lights and exit edge fires
 *
 * Pulses on the gated exit edge halt at the Human Gate via the
 * existing pipeline-level CSS rules.
 */

const TIME_STONE_VAR = stoneColorVar("time");

export interface TimeZoneProps {
  zone: GauntletZone;
  state?: TimeActivationState;
  hub: GauntletHub;
}

export function TimeZone({ zone, state = "idle", hub }: TimeZoneProps) {
  if (zone.zone_id !== "time" || !zone.populated) return null;
  return (
    <g
      data-gauntlet-zone="time"
      data-gauntlet-zone-populated="true"
      data-time-state={state}
      aria-label={`${zone.label} zone — agent ecosystem`}
    >
      <g data-gauntlet-zone-edges="time">
        {zone.edges.map((edge) => (
          <TimeEdge key={edge.edge_id} edge={edge} zone={zone} hub={hub} />
        ))}
      </g>
      <g data-gauntlet-zone-pulses="time">
        {zone.edges.map((edge, index) => (
          <TimePulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            zone={zone}
            hub={hub}
            delayMs={index * 90}
          />
        ))}
      </g>
      <g data-gauntlet-zone-nodes="time">
        {zone.nodes.map((node) => (
          <TimeNodeMark key={node.node_id} node={node} />
        ))}
      </g>
    </g>
  );
}

function findNodePosition(
  id: string,
  nodes: readonly GauntletNode[],
  hub: GauntletHub,
): GauntletPoint | null {
  if (id === HUB_NODE_ID) return hub.position;
  const node = nodes.find((candidate) => candidate.node_id === id);
  return node ? node.position : null;
}

interface EdgeProps {
  edge: GauntletEdge;
  zone: GauntletZone;
  hub: GauntletHub;
}

function TimeEdge({ edge, zone, hub }: EdgeProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const isExit = edge.kind === "exit";
  const isGated = edge.policy === "gated";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      data-time-edge-kind={edge.kind ?? "agent_feed"}
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={isExit ? "var(--jarvis-color-gold)" : TIME_STONE_VAR}
      strokeOpacity={isExit ? 0.7 : 0.42}
      strokeWidth={isExit ? 2 : 1.5}
      strokeDasharray={isGated ? "8 6" : undefined}
    />
  );
}

interface PulseProps extends EdgeProps {
  delayMs: number;
}

function TimePulse({ edge, zone, hub, delayMs }: PulseProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const isExit = edge.kind === "exit";
  const style = {
    "--pulse-from-x": "0px",
    "--pulse-from-y": "0px",
    "--pulse-to-x": `${to.x - from.x}px`,
    "--pulse-to-y": `${to.y - from.y}px`,
    "--pulse-delay": `${delayMs}ms`,
  } as React.CSSProperties;
  return (
    <circle
      data-gauntlet-pulse="true"
      data-gauntlet-pulse-edge-id={edge.edge_id}
      data-gauntlet-pulse-policy={edge.policy}
      data-gauntlet-pulse-stone="time"
      data-time-pulse-kind={edge.kind ?? "agent_feed"}
      cx={from.x}
      cy={from.y}
      r={isExit ? 6 : 4}
      fill={isExit ? "var(--jarvis-color-gold)" : TIME_STONE_VAR}
      style={style}
    />
  );
}

function TimeNodeMark({ node }: { node: GauntletNode }) {
  const { x, y } = node.position;
  const kind = node.kind ?? "agent";
  const isCoordinator = kind === "coordinator";
  const isInbox = kind === "suggestion_inbox";
  const radius = isCoordinator ? 38 : isInbox ? 30 : 20;
  const ringColor = isInbox ? "var(--jarvis-color-gold)" : TIME_STONE_VAR;
  return (
    <g
      data-time-node-id={node.node_id}
      data-time-node-kind={kind}
      data-gauntlet-zone="time"
      aria-label={node.label}
      role="img"
    >
      {isCoordinator && (
        <g aria-hidden="true" data-time-gravity-orbit-core="true">
          <circle
            cx={x}
            cy={y}
            r={radius + 18}
            fill="none"
            stroke={ringColor}
            strokeOpacity={0.24}
          />
          <circle
            cx={x}
            cy={y}
            r={radius + 12}
            fill="none"
            stroke={ringColor}
            strokeOpacity={0.3}
          />
          <polygon
            points={`${x},${y - radius - 4} ${x + radius * 0.78},${y} ${x},${y + radius + 4} ${x - radius * 0.78},${y}`}
            fill="rgba(52,211,153,0.08)"
            stroke={ringColor}
            strokeOpacity={0.62}
          />
        </g>
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="var(--jarvis-color-panel-soft)"
        stroke={ringColor}
        strokeWidth={isCoordinator ? 2.5 : 1.5}
      />
      <circle cx={x} cy={y} r={isCoordinator ? 10 : 5} fill={ringColor} />
      <text
        x={x}
        y={y + radius + 16}
        textAnchor="middle"
        fontFamily="var(--jarvis-font-display)"
        fontSize={13}
        fontWeight={600}
        fill="var(--jarvis-color-ink)"
      >
        {node.label}
      </text>
    </g>
  );
}
