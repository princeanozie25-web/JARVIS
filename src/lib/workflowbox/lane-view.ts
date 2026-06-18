// WorkflowBox v1b — the LANE read projection (display-only, governance grammar).
//
// A PURE transform from the store's Project[] into a calm, display-only view-model
// for the working.html cockpit lane. It imports ONLY the model types — it reaches
// no store, no mutator, no runtime (the same no-mutator scan that guards the rest
// of workflowbox/ covers this file). Mutations (mark / add / edit / remove a
// sub-item) happen through the v1a store's ONE API, not here; this only shapes what
// the lane renders. The mind-map SVG view (v1c) will read the SAME projection.

import type { NodeStatus, Project } from "./types";

export interface LaneSubItemView {
  id: string;
  title: string;
  done: boolean;
}

export interface LaneNodeView {
  id: string;
  title: string;
  detail: string | null;
  /** Derived from percent in the model (todo / in_progress / done). */
  status: NodeStatus;
  /** Derived node percent (sub-item ratio, or binary). Never hand-typed. */
  percent: number;
  has_sub_items: boolean;
  sub_items_done: number;
  sub_items_total: number;
  /** "3/5" convenience label, or null when the node has no checklist. */
  sub_items_label: string | null;
  sub_items: LaneSubItemView[];
  /** v1b: every node is display-class, so this is always false — the node is CALM
   * (it never glows amber). Computed from effect_class so the contract is real. */
  touches_gate: boolean;
  /** v1a persisted map position. The lane ignores it; the v1c map positions nodes
   * by it. Carried here so ONE projection feeds BOTH views (no second read path). */
  layout: { x: number; y: number };
  /** Node ids this node is blocked_by — the v1c map draws one edge per dependency. */
  depends_on: string[];
}

export interface LaneProjectView {
  id: string;
  title: string;
  goal: string;
  /** Derived project rollup (mean of derived node percents). */
  rollup_percent: number;
  node_count: number;
  nodes: LaneNodeView[];
}

/**
 * The lane is a READ + user-progress-tracking surface — NOT a governed mutation
 * surface. Marking checklist progress is user-state tracking (like sessions /
 * goals / preferences), not a mutation of JARVIS, so the lane carries all three
 * no-affordance contracts and never renders the amber / Human-Gate state.
 */
export interface LaneGovernanceContract {
  execute_affordance_present: false;
  approve_affordance_present: false;
  mutation_affordance_present: false;
}

export const LANE_GOVERNANCE_CONTRACT: LaneGovernanceContract = {
  execute_affordance_present: false,
  approve_affordance_present: false,
  mutation_affordance_present: false,
};

export interface WorkflowLaneViewModel extends LaneGovernanceContract {
  projects: LaneProjectView[];
  /** True iff ANY node touches the Gate (side_effecting). Always false in v1b —
   * the lane is calm. Computed (not hard-coded) so the assertion is meaningful. */
  any_amber: boolean;
}

function toNodeView(node: Project["nodes"][number]): LaneNodeView {
  const total = node.sub_items.length;
  const done = node.sub_items.reduce(
    (acc, item) => acc + (item.done ? 1 : 0),
    0,
  );
  return {
    id: node.id,
    title: node.title,
    detail: node.detail,
    status: node.status,
    percent: node.percent,
    has_sub_items: total > 0,
    sub_items_done: done,
    sub_items_total: total,
    sub_items_label: total > 0 ? `${done}/${total}` : null,
    sub_items: node.sub_items.map((item) => ({
      id: item.id,
      title: item.title,
      done: item.done,
    })),
    touches_gate: node.effect_class === "side_effecting",
    layout: { x: node.layout.x, y: node.layout.y },
    depends_on: [...node.depends_on],
  };
}

function toProjectView(project: Project): LaneProjectView {
  return {
    id: project.id,
    title: project.title,
    goal: project.goal,
    rollup_percent: project.rollup_percent,
    node_count: project.nodes.length,
    nodes: project.nodes.map(toNodeView),
  };
}

/** Shape the store's projects into the lane view-model. Pure; no DB, no mutation. */
export function buildWorkflowLaneViewModel(
  projects: ReadonlyArray<Project>,
): WorkflowLaneViewModel {
  const projectViews = projects.map(toProjectView);
  return {
    ...LANE_GOVERNANCE_CONTRACT,
    projects: projectViews,
    any_amber: projectViews.some((project) =>
      project.nodes.some((node) => node.touches_gate),
    ),
  };
}
