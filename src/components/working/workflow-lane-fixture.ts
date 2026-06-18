// A small SYNTHETIC, display-only WorkflowBox lane for the cockpit prototype.
//
// The cockpit is a metadata-only synthetic surface (no live store), so the lane it
// shows is synthetic too. Percents are DERIVED here exactly as the store derives
// them (computeNodePercent / computeRollupPercent) so the demo can never show a
// hand-typed/ inconsistent number. No store, no mutator — pure data.

import {
  buildWorkflowLaneViewModel,
  computeNodePercent,
  computeRollupPercent,
  statusFromPercent,
  type Project,
  type SubItem,
  type WorkflowLaneViewModel,
  type WorkNode,
} from "@/lib/workflowbox";

let seq = 0;
const id = (prefix: string) => `${prefix}-${seq++}`;

function sub(title: string, done: boolean): SubItem {
  return { id: id("s"), title, done };
}

function makeNode(
  title: string,
  detail: string,
  subItems: SubItem[],
  binaryDone = false,
): WorkNode {
  const percent = computeNodePercent(subItems, binaryDone);
  return {
    id: id("n"),
    title,
    detail,
    status: statusFromPercent(percent),
    percent,
    depends_on: [],
    layout: { x: 0, y: 0 },
    effect_class: "display",
    sub_items: subItems,
  };
}

function makeProject(title: string, goal: string, nodes: WorkNode[]): Project {
  return {
    id: id("p"),
    title,
    goal,
    created_at: 0,
    updated_at: 0,
    nodes,
    rollup_percent: computeRollupPercent(nodes),
  };
}

const SYNTHETIC_PROJECTS: Project[] = [
  makeProject("WorkflowBox v1b", "Sub-items + a calm lane in the cockpit", [
    makeNode("Model extension", "Derived percents + the sub-item layer.", [
      sub("types", true),
      sub("store", true),
      sub("schema", true),
      sub("tests", false),
    ]),
    makeNode("Lane list view", "The display-only cockpit lane.", [
      sub("node rows", true),
      sub("detail panel", false),
      sub("live rollup", false),
    ]),
    makeNode("Mind-map view", "The SVG node-graph render (v1c).", []),
  ]),
  makeProject("Morning brief polish", "Tighten the daily digest", [
    makeNode("Digest layout", "Lay out the morning brief sections.", [], true),
    makeNode("Suggestion ranking", "Order suggestions by relevance.", [
      sub("heuristics", true),
      sub("offline eval", false),
    ]),
  ]),
];

export const SYNTHETIC_WORKFLOW_LANE: WorkflowLaneViewModel =
  buildWorkflowLaneViewModel(SYNTHETIC_PROJECTS);
