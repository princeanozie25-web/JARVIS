// WorkflowBox v1c — the MIND-MAP geometry projection (display-only).
//
// A PURE transform DERIVED FROM THE LANE VIEW-MODEL (buildWorkflowLaneViewModel) —
// NOT a second read path to the store. It reuses the lane's LaneNodeView verbatim
// (so the map feeds the SAME shared detail panel) and only adds SVG geometry:
// per-node positions (the persisted layout{x,y}), dependency edges, and a viewBox.
// It reaches no store, no mutator, no runtime (the workflowbox no-mutator scan
// covers this file). The map renders these numbers; it never recomputes percents
// (that is the v1b derivation) and it never sets them.

import {
  LANE_GOVERNANCE_CONTRACT,
  type LaneGovernanceContract,
  type LaneNodeView,
  type LaneProjectView,
  type WorkflowLaneViewModel,
} from "./lane-view";

export const MAP_NODE_WIDTH = 176;
export const MAP_NODE_HEIGHT = 76;
const MAP_GAP_X = 248;
const MAP_GAP_Y = 140;
const MAP_PADDING = 48;

export interface MapNodeView {
  /** The SAME node view the lane uses — drives the SAME shared detail panel. */
  node: LaneNodeView;
  /** Resolved top-left position (persisted layout, or the non-overlap fallback). */
  x: number;
  y: number;
  /** Center (edge endpoints + drag origin). */
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface MapEdgeView {
  from_id: string;
  to_id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MapProjectView {
  id: string;
  title: string;
  goal: string;
  rollup_percent: number;
  nodes: MapNodeView[];
  edges: MapEdgeView[];
  /** SVG viewBox "minX minY width height" enclosing every node (+ padding). */
  view_box: string;
  width: number;
  height: number;
}

export interface WorkflowMapViewModel extends LaneGovernanceContract {
  projects: MapProjectView[];
  any_amber: boolean;
}

/** Two nodes occupy the same point — a degenerate layout (e.g. all at the origin). */
function hasOverlap(nodes: ReadonlyArray<LaneNodeView>): boolean {
  const seen = new Set<string>();
  for (const node of nodes) {
    const key = `${node.layout.x},${node.layout.y}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Resolve each node's top-left position. Persisted layout is honored when it is
 * non-degenerate; if any two nodes overlap (a fresh/un-dragged graph all at one
 * point) a deterministic grid keeps the map readable — drag is still the user's
 * tool to arrange it (this is NOT an auto-layout engine).
 */
function resolvePositions(
  nodes: ReadonlyArray<LaneNodeView>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (!hasOverlap(nodes)) {
    for (const node of nodes) {
      positions.set(node.id, { x: node.layout.x, y: node.layout.y });
    }
    return positions;
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: (index % cols) * MAP_GAP_X,
      y: Math.floor(index / cols) * MAP_GAP_Y,
    });
  });
  return positions;
}

function toMapProject(project: LaneProjectView): MapProjectView {
  const positions = resolvePositions(project.nodes);
  const nodes: MapNodeView[] = project.nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      node,
      x: pos.x,
      y: pos.y,
      cx: pos.x + MAP_NODE_WIDTH / 2,
      cy: pos.y + MAP_NODE_HEIGHT / 2,
      width: MAP_NODE_WIDTH,
      height: MAP_NODE_HEIGHT,
    };
  });

  const byId = new Map(nodes.map((n) => [n.node.id, n]));
  const edges: MapEdgeView[] = [];
  for (const target of nodes) {
    for (const depId of target.node.depends_on) {
      const source = byId.get(depId);
      if (!source) continue; // dangling deps don't draw (store keeps the DAG clean)
      edges.push({
        from_id: depId,
        to_id: target.node.id,
        x1: source.cx,
        y1: source.cy,
        x2: target.cx,
        y2: target.cy,
      });
    }
  }

  let minX = 0;
  let minY = 0;
  let maxX = MAP_NODE_WIDTH;
  let maxY = MAP_NODE_HEIGHT;
  if (nodes.length > 0) {
    minX = Math.min(...nodes.map((n) => n.x));
    minY = Math.min(...nodes.map((n) => n.y));
    maxX = Math.max(...nodes.map((n) => n.x + n.width));
    maxY = Math.max(...nodes.map((n) => n.y + n.height));
  }
  const width = maxX - minX + MAP_PADDING * 2;
  const height = maxY - minY + MAP_PADDING * 2;
  const view_box = `${minX - MAP_PADDING} ${minY - MAP_PADDING} ${width} ${height}`;

  return {
    id: project.id,
    title: project.title,
    goal: project.goal,
    rollup_percent: project.rollup_percent,
    nodes,
    edges,
    view_box,
    width,
    height,
  };
}

/** Derive the map geometry from the lane view-model. Pure; no DB, no mutation. */
export function buildWorkflowMapViewModel(
  lane: WorkflowLaneViewModel,
): WorkflowMapViewModel {
  return {
    ...LANE_GOVERNANCE_CONTRACT,
    projects: lane.projects.map(toMapProject),
    any_amber: lane.any_amber,
  };
}
