import { stoneColorVar } from "@/lib/design-tokens";
import {
  HUB_NODE_ID,
  type GauntletEdge,
  type GauntletHub,
  type GauntletNode,
  type GauntletPoint,
  type GauntletZone,
  type RealityState,
} from "@/lib/gauntlet-visualization";

/**
 * Reality zone — DD.7.
 *
 * Crystalline device ecosystem. The theme engine sits at the center,
 * the room registry above, room sensors feeding in, and four device
 * adapters (Hue, FancyLED, Nanoleaf, Tapo) ringed around it. Until
 * paired the adapters render as `mock` — reduced opacity + explicit
 * MOCK badge — and the theme engine exits gated to the Human Gate.
 *
 * Visual law:
 *   idle         subtle electrical activity, low crystal glow
 *   room_action  sensors → registry → theme engine illuminates
 *   theme_sync   theme engine → all adapters synchronisation pulse
 */

const REALITY_STONE_VAR = stoneColorVar("reality");

export interface RealityZoneProps {
  zone: GauntletZone;
  state?: RealityState;
  hub: GauntletHub;
}

export function RealityZone({ zone, state = "idle", hub }: RealityZoneProps) {
  if (zone.zone_id !== "reality" || !zone.populated) return null;
  return (
    <g
      data-gauntlet-zone="reality"
      data-gauntlet-zone-populated="true"
      data-reality-state={state}
      aria-label={`${zone.label} zone — device ecosystem`}
    >
      <g data-gauntlet-zone-edges="reality">
        {zone.edges.map((edge) => (
          <RealityEdge key={edge.edge_id} edge={edge} zone={zone} hub={hub} />
        ))}
      </g>
      <g data-gauntlet-zone-pulses="reality">
        {zone.edges.map((edge, index) => (
          <RealityPulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            zone={zone}
            hub={hub}
            delayMs={index * 95}
          />
        ))}
      </g>
      <g data-gauntlet-zone-nodes="reality">
        {zone.nodes.map((node) => (
          <RealityNodeMark key={node.node_id} node={node} />
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

function RealityEdge({ edge, zone, hub }: EdgeProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "sync";
  const isExit = kind === "exit";
  const isSync = kind === "sync";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      data-reality-edge-kind={kind}
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={isExit ? "var(--jarvis-color-gold)" : REALITY_STONE_VAR}
      strokeOpacity={isExit ? 0.7 : isSync ? 0.35 : 0.45}
      strokeWidth={isExit ? 2 : 1.5}
      strokeDasharray={edge.policy === "gated" ? "8 6" : undefined}
    />
  );
}

interface PulseProps extends EdgeProps {
  delayMs: number;
}

function RealityPulse({ edge, zone, hub, delayMs }: PulseProps) {
  const from = findNodePosition(edge.from_node_id, zone.nodes, hub);
  const to = findNodePosition(edge.to_node_id, zone.nodes, hub);
  if (!from || !to) return null;
  const kind = edge.kind ?? "sync";
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
      data-gauntlet-pulse-stone="reality"
      data-reality-pulse-kind={kind}
      cx={from.x}
      cy={from.y}
      r={isExit ? 6 : 4}
      fill={isExit ? "var(--jarvis-color-gold)" : REALITY_STONE_VAR}
      style={style}
    />
  );
}

function RealityNodeMark({ node }: { node: GauntletNode }) {
  const { x, y } = node.position;
  const kind = node.kind ?? "adapter";
  const isThemeEngine = kind === "theme_engine";
  const isRegistry = kind === "registry";
  const isMock = kind.endsWith("_mock");
  const radius = isThemeEngine ? 40 : isRegistry ? 28 : 24;
  const opacity = isMock ? 0.6 : 1;
  return (
    <g
      data-reality-node-id={node.node_id}
      data-reality-node-kind={kind}
      data-reality-mock={isMock ? "true" : "false"}
      data-gauntlet-zone="reality"
      aria-label={node.label}
      role="img"
      opacity={opacity}
    >
      {isThemeEngine && (
        <polygon
          data-reality-crystal-halo="true"
          points={`${x},${y - radius - 14} ${x + radius + 14},${y} ${x},${y + radius + 14} ${x - radius - 14},${y}`}
          fill="none"
          stroke={REALITY_STONE_VAR}
          strokeOpacity={0.45}
          strokeWidth={2}
        />
      )}
      <polygon
        points={`${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}`}
        fill="var(--jarvis-color-panel-soft)"
        stroke={REALITY_STONE_VAR}
        strokeWidth={isThemeEngine ? 2.5 : 1.5}
      />
      <circle
        cx={x}
        cy={y}
        r={isThemeEngine ? 10 : 4}
        fill={REALITY_STONE_VAR}
      />
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
      {isMock && (
        <text
          data-reality-mock-badge="true"
          x={x}
          y={y - radius - 8}
          textAnchor="middle"
          fontFamily="var(--jarvis-font-mono)"
          fontSize={9}
          letterSpacing="0.24em"
          fill={REALITY_STONE_VAR}
        >
          MOCK
        </text>
      )}
    </g>
  );
}
