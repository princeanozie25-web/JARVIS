import { stoneColorVar } from "@/lib/design-tokens";
import {
  HUB_NODE_ID,
  type GauntletEdge,
  type GauntletHub,
  type GauntletNode,
  type GauntletPoint,
  type GauntletZone,
  type SoulState,
} from "@/lib/gauntlet-visualization";

/**
 * Soul zone — DD.6.
 *
 * Molten amber vault ecosystem. The obsidian vault sits at the center
 * with sqlite_vec, the librarian agent, the LLM wiki, session memory,
 * and project intelligence orbiting it. Knowledge compounding is the
 * gated exit toward the Human Gate.
 *
 * Visual law:
 *   idle              slow memory circulation + vault heartbeat
 *   retrieval         vault → vec → librarian channel ignites
 *   knowledge_write   compounding → Human Gate flows (gated halt)
 */

const SOUL_STONE_VAR = stoneColorVar("soul");

export interface SoulZoneProps {
  zone: GauntletZone;
  state?: SoulState;
  hub: GauntletHub;
}

export function SoulZone({ zone, state = "idle", hub }: SoulZoneProps) {
  if (zone.zone_id !== "soul" || !zone.populated) return null;
  return (
    <g
      data-gauntlet-zone="soul"
      data-gauntlet-zone-populated="true"
      data-soul-state={state}
      aria-label={`${zone.label} zone — vault ecosystem`}
    >
      <g data-gauntlet-zone-edges="soul">
        {zone.edges.map((edge) => (
          <SoulEdge key={edge.edge_id} edge={edge} zone={zone} hub={hub} />
        ))}
      </g>
      <g data-gauntlet-zone-pulses="soul">
        {zone.edges.map((edge, index) => (
          <SoulPulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            zone={zone}
            hub={hub}
            delayMs={index * 100}
          />
        ))}
      </g>
      <g data-gauntlet-zone-nodes="soul">
        {zone.nodes.map((node) => (
          <SoulNodeMark key={node.node_id} node={node} />
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

function SoulEdge({ edge, zone, hub }: EdgeProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "memory_write";
  const isExit = kind === "exit";
  const isGated = edge.policy === "gated";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      data-soul-edge-kind={kind}
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={isExit ? "var(--jarvis-color-gold)" : SOUL_STONE_VAR}
      strokeOpacity={isExit ? 0.7 : 0.4}
      strokeWidth={isExit ? 2 : 1.5}
      strokeDasharray={isGated ? "8 6" : undefined}
    />
  );
}

interface PulseProps extends EdgeProps {
  delayMs: number;
}

function SoulPulse({ edge, zone, hub, delayMs }: PulseProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "memory_write";
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
      data-gauntlet-pulse-stone="soul"
      data-soul-pulse-kind={kind}
      cx={from.x}
      cy={from.y}
      r={isExit ? 6 : 4}
      fill={isExit ? "var(--jarvis-color-gold)" : SOUL_STONE_VAR}
      style={style}
    />
  );
}

function SoulNodeMark({ node }: { node: GauntletNode }) {
  const { x, y } = node.position;
  const kind = node.kind ?? "satellite";
  const isVault = kind === "vault";
  const isCompounding = kind === "compounding";
  const radius = isVault ? 42 : isCompounding ? 32 : 22;
  const ringColor = isCompounding ? "var(--jarvis-color-gold)" : SOUL_STONE_VAR;
  return (
    <g
      data-soul-node-id={node.node_id}
      data-soul-node-kind={kind}
      data-gauntlet-zone="soul"
      aria-label={node.label}
      role="img"
    >
      {isVault && (
        <g aria-hidden="true" data-soul-molten-crystal="true">
          <circle
            data-soul-vault-heartbeat="true"
            cx={x}
            cy={y}
            r={radius + 16}
            fill="none"
            stroke={SOUL_STONE_VAR}
            strokeOpacity={0.4}
            strokeWidth={2}
          />
          <polygon
            points={`${x},${y - radius - 10} ${x + radius * 0.82},${y - 8} ${x + radius * 0.52},${y + radius + 12} ${x - radius * 0.5},${y + radius + 8} ${x - radius * 0.86},${y - 6}`}
            fill="rgba(251,146,60,0.12)"
            stroke={SOUL_STONE_VAR}
            strokeOpacity={0.68}
          />
          <path
            d={`M ${x - 16} ${y - radius + 2} C ${x - 4} ${y - 12}, ${x + 18} ${y - 2}, ${x + 6} ${y + radius - 4}`}
            fill="none"
            stroke="var(--jarvis-color-flame)"
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
        strokeWidth={isVault ? 2.5 : 1.5}
      />
      <circle cx={x} cy={y} r={isVault ? 10 : 5} fill={ringColor} />
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
