"use client";

// WorkflowBox v1b — the LANE LIST view (display-only, governance grammar).
//
// A calm, read + user-progress-tracking surface for the working cockpit: projects
// as lanes, each node a row with its DERIVED percent and (when present) a sub-item
// count; clicking a node opens a detail panel with its work + a sub-item checklist.
//
// This component speaks the cockpit's governance grammar but is NOT a Gate mutation
// surface — marking checklist progress is user-state tracking, not a governed
// mutation of JARVIS. It therefore carries all three no-affordance contracts and
// never renders the amber / Human-Gate state (every v1b node is display-class).
//
// It imports NO store: it is driven by a pure view-model (`WorkflowLaneViewModel`,
// built from the v1a store's read path) plus optional mutation callbacks that the
// host wires to the v1a store's ONE mutation surface. Marking from here therefore
// writes through the single source of truth; both bars recompute from the next
// view-model the host passes back (the live two-layer rollup). The mind-map SVG
// view (v1c) will read/write the SAME projection + callbacks.

import { useState } from "react";

import type {
  LaneNodeView,
  LaneProjectView,
  WorkflowLaneViewModel,
} from "@/lib/workflowbox/lane-view";

import {
  WorkflowNodeDetail,
  type WorkflowLaneActions,
} from "./WorkflowNodeDetail";

// the mark/edit callbacks live with the SHARED detail panel; re-exported here so
// existing importers (and the map) get the one contract both views write through.
export type { WorkflowLaneActions } from "./WorkflowNodeDetail";

export interface WorkflowLaneProps {
  model: WorkflowLaneViewModel;
  /** Optional — when omitted the lane is purely display (no mark affordances). */
  actions?: WorkflowLaneActions;
  /** Open this node's detail panel in the initial render (SSR / tests). */
  initialOpenNodeId?: string | null;
}

function Bar({
  percent,
  kind,
}: Readonly<{ percent: number; kind: "node" | "rollup" }>) {
  const dataAttr =
    kind === "rollup"
      ? { "data-rollup-percent": percent }
      : { "data-node-percent": percent };
  return (
    <div
      className="jcc-bar wfl-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      {...dataAttr}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

function NodeRow({
  projectId,
  node,
  open,
  onToggle,
  actions,
}: Readonly<{
  projectId: string;
  node: LaneNodeView;
  open: boolean;
  onToggle: () => void;
  actions?: WorkflowLaneActions;
}>) {
  return (
    <div
      className={`wfl-node ${open ? "open" : ""}`}
      data-node-id={node.id}
      data-node-status={node.status}
      data-node-touches-gate={node.touches_gate}
    >
      <div
        className="wfl-node-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`wfl-detail-${node.id}`}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="wfl-node-main">
          <span className="wfl-node-title">{node.title}</span>
          <span className={`wfl-status wfl-status-${node.status}`}>
            {node.status.replace("_", " ")}
          </span>
          {node.sub_items_label ? (
            <span className="wfl-count">{node.sub_items_label}</span>
          ) : null}
        </div>
        <div className="wfl-node-progress">
          <Bar percent={node.percent} kind="node" />
          <span className="wfl-node-pct">{node.percent}%</span>
        </div>
      </div>
      {open ? (
        <WorkflowNodeDetail
          projectId={projectId}
          node={node}
          actions={actions}
        />
      ) : null}
    </div>
  );
}

function ProjectBlock({
  project,
  openNodeId,
  onToggleNode,
  actions,
}: Readonly<{
  project: LaneProjectView;
  openNodeId: string | null;
  onToggleNode: (nodeId: string) => void;
  actions?: WorkflowLaneActions;
}>) {
  return (
    <section
      className="wfl-project"
      data-project-id={project.id}
      data-project-rollup={project.rollup_percent}
    >
      <header className="wfl-project-head">
        <div className="wfl-project-titles">
          <h3 className="wfl-project-title">{project.title}</h3>
          <p className="wfl-project-goal">{project.goal}</p>
        </div>
        <div className="wfl-project-overall">
          <span className="wfl-project-pct">{project.rollup_percent}%</span>
          <Bar percent={project.rollup_percent} kind="rollup" />
        </div>
      </header>
      <div className="wfl-nodes">
        {project.nodes.map((node) => (
          <NodeRow
            key={node.id}
            projectId={project.id}
            node={node}
            open={openNodeId === node.id}
            onToggle={() => onToggleNode(node.id)}
            actions={actions}
          />
        ))}
      </div>
    </section>
  );
}

export function WorkflowLane({
  model,
  actions,
  initialOpenNodeId = null,
}: WorkflowLaneProps) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(
    initialOpenNodeId,
  );

  function toggleNode(nodeId: string) {
    setOpenNodeId((current) => (current === nodeId ? null : nodeId));
  }

  return (
    <section
      className="jcc-glass wfl-lane"
      aria-label="Workflow lane"
      data-workflow-lane="lane-list"
      data-read-track-surface="workflow-lane"
      data-only-mutator="human-gate"
      data-execute-affordance-present={String(model.execute_affordance_present)}
      data-approve-affordance-present={String(model.approve_affordance_present)}
      data-mutation-affordance-present={String(
        model.mutation_affordance_present,
      )}
      data-lane-amber-present={String(model.any_amber)}
    >
      <div className="jcc-panel-head">
        <span className="jcc-label">WORKFLOW LANE</span>
        <span className="jcc-tag">READ + TRACK</span>
      </div>
      <div className="wfl-body">
        {model.projects.length === 0 ? (
          <p className="wfl-empty">No projects yet.</p>
        ) : (
          model.projects.map((project) => (
            <ProjectBlock
              key={project.id}
              project={project}
              openNodeId={openNodeId}
              onToggleNode={toggleNode}
              actions={actions}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default WorkflowLane;
