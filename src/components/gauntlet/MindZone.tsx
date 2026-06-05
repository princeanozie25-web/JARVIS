import { stoneColorVar } from "@/lib/design-tokens";
import {
  HUB_NODE_ID,
  type CouncilStage,
  type GauntletEdge,
  type GauntletHub,
  type GauntletNode,
  type GauntletPoint,
  type GauntletZone,
} from "@/lib/gauntlet-visualization";

/**
 * Mind zone — DD.5.
 *
 * Hexagonal council ecosystem. Six members on the outer ring,
 * `assistant_reviewer` on the inner ring above the chairman, the
 * chairman at the center, and `coordinator` staging from below. The
 * chairman's synthesis pulse exits gated through the Human Gate.
 *
 * Council sequence (driven by `data-mind-council-stage`):
 *   idle               — low-frequency thought exchange on peer edges
 *   independent        — members ignite in place
 *   peer_review        — peer edges accelerate
 *   assistant_review   — member→reviewer edges light up
 *   chairman_synthesis — chairman accumulates; exit edge fires
 */

const MIND_STONE_VAR = stoneColorVar("mind");

export interface MindZoneProps {
  zone: GauntletZone;
  councilStage?: CouncilStage;
  hub: GauntletHub;
}

export function MindZone({ zone, councilStage = "idle", hub }: MindZoneProps) {
  if (zone.zone_id !== "mind" || !zone.populated) return null;
  return (
    <g
      data-gauntlet-zone="mind"
      data-gauntlet-zone-populated="true"
      data-mind-council-stage={councilStage}
      aria-label={`${zone.label} zone — council ecosystem`}
    >
      <g data-gauntlet-zone-edges="mind">
        {zone.edges.map((edge) => (
          <MindEdge key={edge.edge_id} edge={edge} zone={zone} hub={hub} />
        ))}
      </g>
      <g data-gauntlet-zone-pulses="mind">
        {zone.edges.map((edge, index) => (
          <MindPulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            zone={zone}
            hub={hub}
            delayMs={index * 110}
          />
        ))}
      </g>
      <g data-gauntlet-zone-nodes="mind">
        {zone.nodes.map((node) => (
          <MindNodeMark key={node.node_id} node={node} />
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

function MindEdge({ edge, zone, hub }: EdgeProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "peer";
  const isExit = kind === "exit";
  const isPeer = kind === "peer";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      data-mind-edge-kind={kind}
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={isExit ? "var(--jarvis-color-gold)" : MIND_STONE_VAR}
      strokeOpacity={isExit ? 0.7 : isPeer ? 0.28 : 0.4}
      strokeWidth={isExit ? 2 : 1.4}
      strokeDasharray={edge.policy === "gated" ? "8 6" : undefined}
    />
  );
}

interface PulseProps extends EdgeProps {
  delayMs: number;
}

function MindPulse({ edge, zone, hub, delayMs }: PulseProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "peer";
  const isExit = kind === "exit";
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
      data-gauntlet-pulse-stone="mind"
      data-mind-pulse-kind={kind}
      cx={from.x}
      cy={from.y}
      r={isExit ? 6 : 4}
      fill={isExit ? "var(--jarvis-color-gold)" : MIND_STONE_VAR}
      style={style}
    />
  );
}

function MindNodeMark({ node }: { node: GauntletNode }) {
  const { x, y } = node.position;
  const kind = node.kind ?? "member";
  const isChairman = kind === "chairman";
  const isReviewer = kind === "reviewer";
  const isCoordinator = kind === "coordinator";
  const radius = isChairman ? 42 : isReviewer ? 28 : isCoordinator ? 26 : 22;
  return (
    <g
      data-mind-node-id={node.node_id}
      data-mind-node-kind={kind}
      data-gauntlet-zone="mind"
      aria-label={node.label}
      role="img"
    >
      {isChairman && (
        <g aria-hidden="true" data-mind-cognition-crystal="true">
          <circle
            data-mind-chairman-halo="true"
            cx={x}
            cy={y}
            r={radius + 18}
            fill="none"
            stroke={MIND_STONE_VAR}
            strokeOpacity={0.45}
            strokeWidth={2}
          />
          <polygon
            points={`${x},${y - radius - 12} ${x + radius + 10},${y} ${x},${y + radius + 12} ${x - radius - 10},${y}`}
            fill="rgba(167,139,250,0.10)"
            stroke="var(--jarvis-color-violet)"
            strokeOpacity={0.68}
          />
          <line x1={x} y1={y - radius - 12} x2={x} y2={y + radius + 12} stroke="var(--jarvis-color-gold)" strokeOpacity={0.42} />
          <line x1={x - radius - 10} y1={y} x2={x + radius + 10} y2={y} stroke="var(--jarvis-color-gold)" strokeOpacity={0.42} />
        </g>
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="var(--jarvis-color-panel-soft)"
        stroke={MIND_STONE_VAR}
        strokeWidth={isChairman ? 2.5 : 1.5}
      />
      <circle cx={x} cy={y} r={isChairman ? 10 : 5} fill={MIND_STONE_VAR} />
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
