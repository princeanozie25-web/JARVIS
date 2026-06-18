// WorkflowBox v1b — the LANE LIST view (UI invariants).
// I-WBv1b-7 lane governance grammar · I-WBv1b-9 live two-layer rollup.
//
// The harness has no jsdom / React Testing Library (vitest environment is "node";
// the cockpit tests render with react-dom/server). Per I-WBv1b-9 ("...to the extent
// the harness allows; else assert the store-level recompute that drives it + a DOM-
// render test"), the live rollup is proven by driving the REAL in-memory store with
// ONE sub-item toggle and re-rendering the lane from the resulting view-model: the
// node bar AND the project rollup bar both move. The lane render is a pure function
// of store state, which IS the live behavior when the host re-renders on new props.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorkflowLane } from "../../src/components/working/WorkflowLane";
import { applyMigrations } from "../../src/lib/db/schema";
import {
  buildWorkflowLaneViewModel,
  createProject,
  listProjects,
  toggleSubItem,
} from "../../src/lib/workflowbox";

const FORBIDDEN_OUTSIDE_GATE = /\b(run|retry|execute|schedule)\b/i;

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

function buttonLabels(html: string): string[] {
  return Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)).map(
    (match) => (match[1] ?? "").replace(/<[^>]+>/g, " ").trim(),
  );
}

function nodePercent(html: string, nodeId: string): number {
  const match = new RegExp(
    `data-node-id="${nodeId}"[\\s\\S]*?data-node-percent="(\\d+)"`,
  ).exec(html);
  if (!match) throw new Error(`no node bar for ${nodeId}`);
  return Number(match[1]);
}

function rollupPercent(html: string, projectId: string): number {
  const match = new RegExp(
    `data-project-id="${projectId}"[\\s\\S]*?data-rollup-percent="(\\d+)"`,
  ).exec(html);
  if (!match) throw new Error(`no rollup bar for ${projectId}`);
  return Number(match[1]);
}

function seed() {
  createProject(
    db,
    {
      id: "p1",
      title: "Ship v1b",
      goal: "Build the lane",
      nodes: [
        {
          id: "model",
          title: "Model extension",
          detail: "Derived percents + sub-items.",
          sub_items: [
            { id: "m1", title: "types", done: true },
            { id: "m2", title: "store", done: false },
          ],
        },
        { id: "lane", title: "Lane view" }, // binary, todo
      ],
    },
    { now: 1_000 },
  );
}

// ===========================================================================
// I-WBv1b-7 — the lane carries the no-affordance grammar; no node glows amber
// ===========================================================================
describe("I-WBv1b-7 (lane governance grammar)", () => {
  it("carries the three no-affordance contracts and renders no amber/Gate state", () => {
    seed();
    const vm = buildWorkflowLaneViewModel(listProjects(db));
    const html = renderToStaticMarkup(
      <WorkflowLane model={vm} initialOpenNodeId="model" />,
    );

    expect(html).toContain('data-execute-affordance-present="false"');
    expect(html).toContain('data-approve-affordance-present="false"');
    expect(html).toContain('data-mutation-affordance-present="false"');
    // calm: nothing touches the Gate — every node is display-class
    expect(html).toContain('data-lane-amber-present="false"');
    expect(html).not.toContain('data-node-touches-gate="true"');
    expect(vm.any_amber).toBe(false);
    // it does not impersonate the Gate's own mutation surface
    expect(html).not.toContain('data-human-gate-panel="true"');
    expect(html).not.toContain("wc-gate-approve");
    // the amber state is never active (the only "amber" token is the calm
    // contract attribute, declared false)
    expect(html).not.toContain('data-lane-amber-present="true"');
  });

  it("renders the node row (status + own percent + sub-item count) and the detail checklist", () => {
    seed();
    const vm = buildWorkflowLaneViewModel(listProjects(db));
    const html = renderToStaticMarkup(
      <WorkflowLane model={vm} initialOpenNodeId="model" />,
    );

    expect(html).toContain("Model extension");
    expect(nodePercent(html, "model")).toBe(50); // 1/2 derived
    expect(html).toContain(">1/2<"); // sub-item count chip
    // the open node's checklist renders each sub-item as a checkbox
    expect(html).toContain('data-sub-item-id="m1"');
    expect(html).toContain('data-sub-item-id="m2"');
    // a no-sub-item node row carries its binary percent and no count chip
    expect(nodePercent(html, "lane")).toBe(0);
  });

  it("the lane styling uses existing --jarvis-* tokens and never the amber token", () => {
    const css = readFileSync(
      resolve("src/components/working/workflow-lane.css"),
      "utf8",
    );
    expect(css).toContain("var(--jarvis-font-mono)");
    expect(css).toContain("var(--jarvis-font-display)");
    expect(css).toContain("var(--jarvis-color-emerald-local)");
    // the amber/Gate token is RESERVED — never used as an active value (calm lane)
    expect(css).not.toContain("var(--jarvis-color-amber-review)");
  });

  it("keeps mark affordances free of execute/run/retry/schedule wording", () => {
    seed();
    const vm = buildWorkflowLaneViewModel(listProjects(db));
    const noop = () => {};
    const actions = {
      toggleSubItem: noop,
      addSubItem: noop,
      updateSubItem: noop,
      removeSubItem: noop,
      markNode: noop,
    };
    const html = renderToStaticMarkup(
      <WorkflowLane model={vm} actions={actions} initialOpenNodeId="model" />,
    );
    const labels = buttonLabels(html).join(" ");
    expect(labels).not.toMatch(FORBIDDEN_OUTSIDE_GATE);
    expect(labels).toContain("Add");
    expect(labels).toContain("Remove");
  });
});

// ===========================================================================
// I-WBv1b-9 — one sub-item toggle moves the node bar AND the project rollup bar
// ===========================================================================
describe("I-WBv1b-9 (live two-layer rollup)", () => {
  it("a single store toggle updates the node bar and the project overall bar", () => {
    createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          {
            id: "n",
            title: "N",
            sub_items: [
              { id: "s1", title: "a", done: true },
              { id: "s2", title: "b", done: false },
            ],
          },
          {
            id: "m",
            title: "M",
            sub_items: [
              { id: "t1", title: "x", done: false },
              { id: "t2", title: "y", done: false },
            ],
          },
        ],
      },
      { now: 1_000 },
    );

    const before = renderToStaticMarkup(
      <WorkflowLane
        model={buildWorkflowLaneViewModel(listProjects(db))}
        initialOpenNodeId="n"
      />,
    );
    expect(nodePercent(before, "n")).toBe(50); // 1/2
    expect(nodePercent(before, "m")).toBe(0);
    expect(rollupPercent(before, "p1")).toBe(25); // round((50+0)/2)

    // ONE mutation through the single store API
    toggleSubItem(db, "p1", "n", "s2", { now: 2_000 });

    const after = renderToStaticMarkup(
      <WorkflowLane model={buildWorkflowLaneViewModel(listProjects(db))} />,
    );
    // the node bar moved 50 -> 100 AND the project rollup moved 25 -> 50 together
    expect(nodePercent(after, "n")).toBe(100); // 2/2
    expect(nodePercent(after, "m")).toBe(0); // unrelated node unchanged
    expect(rollupPercent(after, "p1")).toBe(50); // round((100+0)/2)
  });
});
