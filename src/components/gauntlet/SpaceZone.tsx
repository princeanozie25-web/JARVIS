import { stoneColorVar } from "@/lib/design-tokens";
import type {
  GauntletEdge,
  GauntletNode,
  GauntletPoint,
  GauntletZone,
} from "@/lib/gauntlet-visualization";

/**
 * Space zone — DD.3.
 *
 * Renders the eleven Space nodes, their edges, and an animated pulse
 * per edge. Pulses are SVG <circle> elements whose CSS animation rides
 * a translation between source/target node positions via the
 * `--pulse-from-*` / `--pulse-to-*` CSS variables declared inline on
 * each pulse. The pulse policy (allowed / gated) is mirrored to
 * `data-gauntlet-pulse-policy` so the parent pipeline's
 * `data-hub-state` can halt or resume the gated set.
 *
 * No buttons. No forms. No anchors. No execution.
 */

export interface SpaceZoneProps {
  zone: GauntletZone;
}

function findNode(
  nodes: readonly GauntletNode[],
  id: string,
): GauntletNode | undefined {
  return nodes.find((node) => node.node_id === id);
}

export function SpaceZone({ zone }: SpaceZoneProps) {
  if (zone.zone_id !== "space" || !zone.populated) return null;
  const stoneColor = stoneColorVar("space");

  return (
    <g
      data-gauntlet-zone="space"
      data-gauntlet-zone-populated="true"
      aria-label={`${zone.label} zone`}
    >
      {/* Edges first so nodes/pulses paint on top. */}
      <g data-gauntlet-zone-edges="space">
        {zone.edges.map((edge) => (
          <SpaceEdgeLine
            key={edge.edge_id}
            edge={edge}
            nodes={zone.nodes}
            stoneColor={stoneColor}
          />
        ))}
      </g>

      {/* Pulses — one per edge. */}
      <g data-gauntlet-zone-pulses="space">
        {zone.edges.map((edge, index) => (
          <SpacePulse
            key={`pulse-${edge.edge_id}`}
            edge={edge}
            nodes={zone.nodes}
            stoneColor={stoneColor}
            delayMs={index * 120}
          />
        ))}
      </g>

      {/* Nodes. */}
      <g data-gauntlet-zone-nodes="space">
        {zone.nodes.map((node) => (
          <SpaceNodeMark
            key={node.node_id}
            node={node}
            stoneColor={stoneColor}
          />
        ))}
      </g>
    </g>
  );
}

interface EdgeLineProps {
  edge: GauntletEdge;
  nodes: readonly GauntletNode[];
  stoneColor: string;
}

function SpaceEdgeLine({ edge, nodes, stoneColor }: EdgeLineProps) {
  const from = findNode(nodes, edge.from_node_id);
  const to = findNode(nodes, edge.to_node_id);
  if (!from || !to) return null;
  const isGated = edge.policy === "gated";
  return (
    <line
      data-gauntlet-edge-id={edge.edge_id}
      data-gauntlet-edge-policy={edge.policy}
      x1={from.position.x}
      y1={from.position.y}
      x2={to.position.x}
      y2={to.position.y}
      stroke={stoneColor}
      strokeOpacity={isGated ? 0.45 : 0.75}
      strokeWidth={isGated ? 1.5 : 2}
      strokeDasharray={isGated ? "6 4" : undefined}
    />
  );
}

interface NodeMarkProps {
  node: GauntletNode;
  stoneColor: string;
}

function SpaceNodeMark({ node, stoneColor }: NodeMarkProps) {
  const { x, y } = node.position;
  const isTesseractCore = node.node_id === "router";
  return (
    <g
      data-gauntlet-node-id={node.node_id}
      data-gauntlet-zone="space"
      data-gauntlet-approaches-hub={String(node.approaches_hub)}
      aria-label={node.label}
      role="img"
    >
      {isTesseractCore ? (
        <g
          aria-hidden="true"
          data-space-tesseract-core="true"
          data-space-pipeline-core="true"
        >
          <circle
            cx={x}
            cy={y}
            r={122}
            fill="rgba(14,165,233,0.08)"
            stroke={stoneColor}
            strokeOpacity={0.16}
            strokeWidth={1}
          />
          <polygon
            points={`${x},${y - 96} ${x + 98},${y - 38} ${x + 98},${y + 62} ${x},${y + 116} ${x - 98},${y + 62} ${x - 98},${y - 38}`}
            fill="rgba(30,144,255,0.13)"
            stroke={stoneColor}
            strokeOpacity={0.72}
            strokeWidth={2.5}
          />
          <polygon
            points={`${x},${y - 60} ${x + 60},${y - 22} ${x + 60},${y + 42} ${x},${y + 78} ${x - 60},${y + 42} ${x - 60},${y - 22}`}
            fill="rgba(186,230,253,0.08)"
            stroke={stoneColor}
            strokeOpacity={0.88}
            strokeWidth={1.5}
          />
          <line x1={x - 98} y1={y - 38} x2={x - 60} y2={y - 22} stroke={stoneColor} strokeOpacity={0.5} />
          <line x1={x + 98} y1={y - 38} x2={x + 60} y2={y - 22} stroke={stoneColor} strokeOpacity={0.5} />
          <line x1={x - 98} y1={y + 62} x2={x - 60} y2={y + 42} stroke={stoneColor} strokeOpacity={0.5} />
          <line x1={x + 98} y1={y + 62} x2={x + 60} y2={y + 42} stroke={stoneColor} strokeOpacity={0.5} />
          <line x1={x} y1={y - 96} x2={x} y2={y + 116} stroke={stoneColor} strokeOpacity={0.38} />
          <line x1={x - 98} y1={y + 62} x2={x + 98} y2={y - 38} stroke={stoneColor} strokeOpacity={0.26} />
          <line x1={x - 98} y1={y - 38} x2={x + 98} y2={y + 62} stroke={stoneColor} strokeOpacity={0.26} />
        </g>
      ) : null}
      <circle
        cx={x}
        cy={y}
        r={node.approaches_hub ? 28 : 22}
        fill="var(--jarvis-color-panel-soft)"
        stroke={stoneColor}
        strokeWidth={node.approaches_hub ? 2.5 : 1.5}
      />
      <circle cx={x} cy={y} r={6} fill={stoneColor} />
      <text
        x={x}
        y={y + 46}
        textAnchor="middle"
        fontFamily="var(--jarvis-font-display)"
        fontSize={14}
        fontWeight={600}
        fill="var(--jarvis-color-ink)"
      >
        {node.label}
      </text>
      <text
        x={x}
        y={y + 62}
        textAnchor="middle"
        fontFamily="var(--jarvis-font-mono)"
        fontSize={9}
        letterSpacing="0.18em"
        fill="var(--jarvis-color-ink)"
        fillOpacity={0.55}
      >
        {node.node_id}
      </text>
    </g>
  );
}

interface PulseProps {
  edge: GauntletEdge;
  nodes: readonly GauntletNode[];
  stoneColor: string;
  delayMs: number;
}

function SpacePulse({ edge, nodes, stoneColor, delayMs }: PulseProps) {
  const from = findNode(nodes, edge.from_node_id);
  const to = findNode(nodes, edge.to_node_id);
  if (!from || !to) return null;
  const delta = vectorBetween(from.position, to.position);
  const style = {
    "--pulse-from-x": "0px",
    "--pulse-from-y": "0px",
    "--pulse-to-x": `${delta.x}px`,
    "--pulse-to-y": `${delta.y}px`,
    "--pulse-delay": `${delayMs}ms`,
  } as React.CSSProperties;
  return (
    <circle
      data-gauntlet-pulse="true"
      data-gauntlet-pulse-edge-id={edge.edge_id}
      data-gauntlet-pulse-policy={edge.policy}
      data-gauntlet-pulse-stone="space"
      cx={from.position.x}
      cy={from.position.y}
      r={5}
      fill={stoneColor}
      style={style}
    />
  );
}

function vectorBetween(from: GauntletPoint, to: GauntletPoint): GauntletPoint {
  return { x: to.x - from.x, y: to.y - from.y };
}
