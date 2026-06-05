import { stoneColorVar } from "@/lib/design-tokens";
import {
  HUB_NODE_ID,
  type GauntletEdge,
  type GauntletHub,
  type GauntletNode,
  type GauntletPoint,
  type GauntletZone,
  type PowerState,
} from "@/lib/gauntlet-visualization";

/**
 * Power zone — DD.8.
 *
 * Fortress reactor ecosystem. A reactor core anchors architecture,
 * telemetry, and governance in a continuous audit heartbeat. CAI
 * manifest → adapter → execution gate drives the gated proposal
 * channel; the red team sandbox highlights forbidden edges through
 * governance. The execution gate exits gated to the Human Gate.
 *
 * Visual law:
 *   idle             continuous audit heartbeat — never asleep
 *   audit_cycle      heartbeat tightens, governance illuminates
 *   forbidden_alert  fortress flashes once, forbidden edge stays lit
 */

const POWER_STONE_VAR = stoneColorVar("power");

export interface PowerZoneProps {
  zone: GauntletZone;
  state?: PowerState;
  hub: GauntletHub;
}

export function PowerZone({ zone, state = "idle", hub }: PowerZoneProps) {
  if (zone.zone_id !== "power" || !zone.populated) return null;
  return (
    <g
      data-gauntlet-zone="power"
      data-gauntlet-zone-populated="true"
      data-power-state={state}
      aria-label={`${zone.label} zone — fortress reactor`}
    >
      <g data-gauntlet-zone-edges="power">
        {zone.edges.map((edge) => (
          <PowerEdge key={edge.edge_id} edge={edge} zone={zone} hub={hub} />
        ))}
      </g>
      <g data-gauntlet-zone-pulses="power">
        {zone.edges.map((edge, index) => (
          <PowerPulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            zone={zone}
            hub={hub}
            delayMs={index * 105}
          />
        ))}
      </g>
      <g data-gauntlet-zone-nodes="power">
        {zone.nodes.map((node) => (
          <PowerNodeMark key={node.node_id} node={node} />
        ))}
      </g>
      <g data-gauntlet-power-metadata="true">
        <text
          data-power-cost-counter="true"
          x={zone.nodes[0]!.position.x}
          y={zone.nodes[0]!.position.y - 260}
          textAnchor="middle"
          fontFamily="var(--jarvis-font-mono)"
          fontSize={11}
          letterSpacing="0.18em"
          fill={POWER_STONE_VAR}
        >
          COST · DEMO $0.00
        </text>
        <text
          data-power-event-rate="true"
          x={zone.nodes[0]!.position.x}
          y={zone.nodes[0]!.position.y - 244}
          textAnchor="middle"
          fontFamily="var(--jarvis-font-mono)"
          fontSize={11}
          letterSpacing="0.18em"
          fill={POWER_STONE_VAR}
        >
          EVENTS · DEMO 0/min
        </text>
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

function PowerEdge({ edge, zone, hub }: EdgeProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "audit";
  const isExit = kind === "exit";
  const isForbidden = kind === "forbidden";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      data-power-edge-kind={kind}
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={
        isExit
          ? "var(--jarvis-color-gold)"
          : isForbidden
            ? "var(--jarvis-color-pipeline-forbidden)"
            : POWER_STONE_VAR
      }
      strokeOpacity={isExit ? 0.7 : isForbidden ? 0.5 : 0.42}
      strokeWidth={isExit ? 2 : isForbidden ? 1.8 : 1.5}
      strokeDasharray={
        edge.policy === "gated" ? "8 6" : isForbidden ? "4 4" : undefined
      }
    />
  );
}

interface PulseProps extends EdgeProps {
  delayMs: number;
}

function PowerPulse({ edge, zone, hub, delayMs }: PulseProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "audit";
  const isExit = kind === "exit";
  const isForbidden = kind === "forbidden";
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
      data-gauntlet-pulse-stone="power"
      data-power-pulse-kind={kind}
      cx={from.x}
      cy={from.y}
      r={isExit ? 6 : 4}
      fill={
        isExit
          ? "var(--jarvis-color-gold)"
          : isForbidden
            ? "var(--jarvis-color-pipeline-forbidden)"
            : POWER_STONE_VAR
      }
      style={style}
    />
  );
}

function PowerNodeMark({ node }: { node: GauntletNode }) {
  const { x, y } = node.position;
  const kind = node.kind ?? "audit";
  const isReactor = kind === "reactor";
  const isGate = kind === "gate";
  const isSandbox = kind === "sandbox";
  const radius = isReactor ? 46 : isGate ? 36 : 24;
  const ringColor = isGate
    ? "var(--jarvis-color-gold)"
    : isSandbox
      ? "var(--jarvis-color-pipeline-forbidden)"
      : POWER_STONE_VAR;
  return (
    <g
      data-power-node-id={node.node_id}
      data-power-node-kind={kind}
      data-gauntlet-zone="power"
      aria-label={node.label}
      role="img"
    >
      {isReactor && (
        <g aria-hidden="true" data-power-fortress-reactor="true">
          <rect
            data-power-fortress-frame="true"
            x={x - radius - 18}
            y={y - radius - 18}
            width={(radius + 18) * 2}
            height={(radius + 18) * 2}
            fill="rgba(224,17,95,0.08)"
            stroke={POWER_STONE_VAR}
            strokeOpacity={0.45}
            strokeWidth={2}
          />
          <polygon
            points={`${x},${y - radius - 22} ${x + radius + 22},${y} ${x},${y + radius + 22} ${x - radius - 22},${y}`}
            fill="none"
            stroke="var(--jarvis-color-violet)"
            strokeOpacity={0.52}
          />
          <circle
            cx={x}
            cy={y}
            r={radius + 8}
            fill="none"
            stroke="var(--jarvis-color-pipeline-forbidden)"
            strokeOpacity={0.34}
            strokeDasharray="8 5"
          />
        </g>
      )}
      {isGate && (
        <rect
          data-power-gate-lock="true"
          x={x - radius - 8}
          y={y - radius - 8}
          width={(radius + 8) * 2}
          height={(radius + 8) * 2}
          fill="none"
          stroke={ringColor}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="var(--jarvis-color-panel-soft)"
        stroke={ringColor}
        strokeWidth={isReactor ? 2.5 : 1.5}
      />
      <circle cx={x} cy={y} r={isReactor ? 12 : 5} fill={ringColor} />
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
