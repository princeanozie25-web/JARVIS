"use client";

// WorkflowBox v1c — the MIND-MAP SVG render (the FINAL WorkflowBox slice).
//
// An ALTERNATE RENDER over the proven model — NO new model, NO new read path, NO
// second mutation surface. It takes the map geometry DERIVED from the SAME lane
// view-model (buildWorkflowMapViewModel) and the SAME mark/edit callbacks the lane
// uses, and draws a roadmap.sh-style SVG node graph: nodes at their persisted
// layout{x,y}, dependency edges between them, each node showing title / status /
// DERIVED percent / sub-item count. Clicking a node opens the SAME shared detail
// panel (WorkflowNodeDetail) — so marking on the map and on the lane are the SAME
// operation on the SAME store and cannot drift. Dragging a node persists its new
// layout via the SAME store (the additive `moveNode` wires to the v1a updateNode
// layout patch — LAYOUT ONLY; status/percent/deps are untouched).
//
// SVG, not canvas: addressable node groups, accessible labels, deterministic
// snapshots, reduced-motion handled in CSS. The map renders the derived numbers;
// it never recomputes or sets a percent. Every node is display-class -> CALM, no
// amber; the three no-affordance contracts are carried.

import { useRef, useState } from "react";

import type {
  MapNodeView,
  MapProjectView,
  WorkflowMapViewModel,
} from "@/lib/workflowbox/map-view";

import {
  WorkflowNodeDetail,
  type WorkflowLaneActions,
} from "./WorkflowNodeDetail";

/**
 * The map writes marks through the SAME lane callbacks; it adds ONE layout-only
 * callback for drag, wired by the host to the v1a store's existing updateNode
 * layout patch (no new mutation surface).
 */
export interface WorkflowMapActions extends WorkflowLaneActions {
  moveNode(
    projectId: string,
    nodeId: string,
    layout: { x: number; y: number },
  ): void;
}

export interface WorkflowMapProps {
  model: WorkflowMapViewModel;
  /** Optional — when omitted the map is purely display (no mark/drag affordances). */
  actions?: WorkflowMapActions;
  /** Open this node's detail panel in the initial render (SSR / tests). */
  initialOpenNodeId?: string | null;
}

const BAR_WIDTH = 132;

function clientToSvg(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

function MapNode({
  mapNode,
  position,
  open,
  draggable,
  gradientId,
  onToggle,
  onPointerDown,
}: Readonly<{
  mapNode: MapNodeView;
  position: { x: number; y: number };
  open: boolean;
  draggable: boolean;
  /** AP-J3: the per-project emerald->sky progress gradient (SVG defs id). */
  gradientId: string;
  onToggle: () => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}>) {
  const node = mapNode.node;
  return (
    <g
      className={`wfm-node ${open ? "open" : ""} ${draggable ? "draggable" : ""}`}
      data-node-id={node.id}
      data-node-status={node.status}
      data-node-touches-gate={node.touches_gate}
      data-node-x={position.x}
      data-node-y={position.y}
      data-node-percent={node.percent}
      transform={`translate(${position.x}, ${position.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${node.title} — ${node.status.replace("_", " ")} — ${node.percent}%`}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      onPointerDown={onPointerDown}
    >
      <rect
        className="wfm-node-box"
        width={mapNode.width}
        height={mapNode.height}
        rx={8}
      />
      <text className="wfm-node-title" x={12} y={22}>
        {node.title}
      </text>
      <text
        className={`wfm-node-status wfm-status-${node.status}`}
        x={12}
        y={40}
      >
        {node.status.replace("_", " ")}
        {node.sub_items_label ? `  ·  ${node.sub_items_label}` : ""}
      </text>
      <rect
        className="wfm-bar-track"
        x={12}
        y={52}
        width={BAR_WIDTH}
        height={6}
        rx={3}
      />
      <rect
        className="wfm-bar-fill"
        x={12}
        y={52}
        width={(node.percent / 100) * BAR_WIDTH}
        height={6}
        rx={3}
        data-node-percent={node.percent}
        fill={`url(#${gradientId})`}
      />
      <text className="wfm-node-pct" x={mapNode.width - 12} y={58}>
        {node.percent}%
      </text>
    </g>
  );
}

function MapProjectSvg({
  project,
  actions,
  openNodeId,
  onToggleNode,
}: Readonly<{
  project: MapProjectView;
  actions?: WorkflowMapActions;
  openNodeId: string | null;
  onToggleNode: (nodeId: string) => void;
}>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<{
    nodeId: string;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [override, setOverride] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  const canDrag = Boolean(actions?.moveNode);

  function positionOf(mapNode: MapNodeView): { x: number; y: number } {
    if (override && override.nodeId === mapNode.node.id) {
      return { x: override.x, y: override.y };
    }
    return { x: mapNode.x, y: mapNode.y };
  }

  function onPointerDown(
    event: React.PointerEvent<SVGGElement>,
    mapNode: MapNodeView,
  ) {
    if (!canDrag) return;
    const start = clientToSvg(svgRef.current, event.clientX, event.clientY);
    if (!start) return;
    movedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      nodeId: mapNode.node.id,
      originX: mapNode.x,
      originY: mapNode.y,
      startX: start.x,
      startY: start.y,
    });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const here = clientToSvg(svgRef.current, event.clientX, event.clientY);
    if (!here) return;
    movedRef.current = true;
    setOverride({
      nodeId: drag.nodeId,
      x: drag.originX + (here.x - drag.startX),
      y: drag.originY + (here.y - drag.startY),
    });
  }

  function endDrag() {
    if (drag && override && override.nodeId === drag.nodeId) {
      // drag is LAYOUT ONLY — persists via the SAME store (updateNode layout)
      actions?.moveNode(project.id, drag.nodeId, {
        x: Math.round(override.x),
        y: Math.round(override.y),
      });
    }
    setDrag(null);
    setOverride(null);
  }

  const openNode = project.nodes.find((n) => n.node.id === openNodeId);

  return (
    <section
      className="wfm-project"
      data-project-id={project.id}
      data-project-rollup={project.rollup_percent}
    >
      <header className="wfm-project-head">
        <div className="wfm-project-titles">
          <h3 className="wfm-project-title">{project.title}</h3>
          <p className="wfm-project-goal">{project.goal}</p>
        </div>
        <div className="wfm-project-overall">
          <span
            className="wfm-project-pct"
            data-rollup-percent={project.rollup_percent}
          >
            {project.rollup_percent}%
          </span>
        </div>
      </header>

      <svg
        ref={svgRef}
        className="wfm-svg"
        viewBox={project.view_box}
        role="img"
        aria-label={`${project.title} workflow map`}
        data-node-count={project.nodes.length}
        data-edge-count={project.edges.length}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* AP-J3: the ONE progress range — emerald->sky — as a per-project
            gradient (unique defs id per SVG; stops consume the base tokens). */}
        <defs>
          <linearGradient
            id={`wfm-progress-${project.id}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor="var(--jarvis-color-emerald-local)" />
            <stop offset="100%" stopColor="var(--jarvis-color-sky-focus)" />
          </linearGradient>
        </defs>
        <g className="wfm-edges">
          {/* AP-J3: dependency edges as calm branch curves (roadmap look) —
              same edge model, same endpoints; a cubic ease between them. */}
          {project.edges.map((edge) => (
            <path
              key={`${edge.from_id}->${edge.to_id}`}
              className="wfm-edge"
              data-edge-from={edge.from_id}
              data-edge-to={edge.to_id}
              d={`M ${edge.x1} ${edge.y1} C ${(edge.x1 + edge.x2) / 2} ${edge.y1}, ${(edge.x1 + edge.x2) / 2} ${edge.y2}, ${edge.x2} ${edge.y2}`}
            />
          ))}
        </g>
        <g className="wfm-nodes">
          {project.nodes.map((mapNode) => (
            <MapNode
              key={mapNode.node.id}
              mapNode={mapNode}
              position={positionOf(mapNode)}
              open={openNodeId === mapNode.node.id}
              draggable={canDrag}
              gradientId={`wfm-progress-${project.id}`}
              onToggle={() => {
                if (movedRef.current) return; // a drag, not a click
                onToggleNode(mapNode.node.id);
              }}
              onPointerDown={(event) => onPointerDown(event, mapNode)}
            />
          ))}
        </g>
      </svg>

      {openNode ? (
        <div className="wfm-detail-dock">
          <WorkflowNodeDetail
            projectId={project.id}
            node={openNode.node}
            actions={actions}
          />
        </div>
      ) : null}
    </section>
  );
}

export function WorkflowMap({
  model,
  actions,
  initialOpenNodeId = null,
}: WorkflowMapProps) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(
    initialOpenNodeId,
  );

  function toggleNode(nodeId: string) {
    setOpenNodeId((current) => (current === nodeId ? null : nodeId));
  }

  return (
    <section
      className="jcc-glass wfm-map"
      aria-label="Workflow map"
      data-workflow-map="mind-map"
      data-read-track-surface="workflow-map"
      data-only-mutator="human-gate"
      data-execute-affordance-present={String(model.execute_affordance_present)}
      data-approve-affordance-present={String(model.approve_affordance_present)}
      data-mutation-affordance-present={String(
        model.mutation_affordance_present,
      )}
      data-lane-amber-present={String(model.any_amber)}
    >
      <div className="jcc-panel-head">
        <span className="jcc-label">WORKFLOW MAP</span>
        <span className="jcc-tag">READ + TRACK</span>
      </div>
      <div className="wfm-body">
        {model.projects.length === 0 ? (
          // AP-J3 honest-state family: an empty map is honest, not an error.
          <p className="wfm-empty jcc-honest" data-honest-state="empty">
            No projects yet.
          </p>
        ) : (
          model.projects.map((project) => (
            <MapProjectSvg
              key={project.id}
              project={project}
              actions={actions}
              openNodeId={openNodeId}
              onToggleNode={toggleNode}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default WorkflowMap;
