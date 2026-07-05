import { readFileSync } from "node:fs";

import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadCockpitWorkflowbox } from "../../src/app/working/workflowbox-live";
import { SYNTHETIC_WORKFLOW_LANE } from "../../src/components/working/workflow-lane-fixture";
import { WorkflowLane } from "../../src/components/working/WorkflowLane";
import {
  WorkflowMap,
  type WorkflowMapActions,
} from "../../src/components/working/WorkflowMap";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import { applyMigrations } from "../../src/lib/db/node";
import {
  addSubItem,
  buildWorkflowLaneViewModel,
  buildWorkflowMapViewModel,
  createProject,
  getProject,
  listProjects,
  removeSubItem,
  toggleSubItem,
  updateNode,
  updateSubItem,
  WorkflowBoxError,
} from "../../src/lib/workflowbox";

// E-019 — the WorkflowBox live wire. The lane + map now read REAL persisted
// projects and mutate them through the store's ONE API (server actions bound
// by the route). These tests drive the SAME binding shape the actions module
// uses, against a real (in-memory) database, and assert the honesty +
// single-source-of-truth invariants.

const LIVE_SOURCE = readFileSync("src/app/working/workflowbox-live.ts", "utf8");
const ACTIONS_SOURCE = readFileSync(
  "src/app/working/workflowbox-actions.ts",
  "utf8",
);
const PAGE_SOURCE = readFileSync("src/app/working/page.tsx", "utf8");
const COCKPIT_SOURCE = readFileSync(
  "src/components/working/WorkingCockpit.tsx",
  "utf8",
);

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => db.close());

function seedProject() {
  return createProject(db, {
    id: "p-live",
    title: "Ship the capstone",
    goal: "Wire, verify, present",
    nodes: [
      {
        id: "n-wire",
        title: "Wire the store",
        detail: "read + write through the one API",
        sub_items: [
          { id: "s-read", title: "read path", done: true },
          { id: "s-write", title: "write path", done: false },
        ],
      },
      { id: "n-verify", title: "Verify end to end", layout: { x: 40, y: 60 } },
    ],
  });
}

/** The SAME binding shape src/app/working/workflowbox-actions.ts uses — one
 * callback -> one store op -> re-read. Both views receive this ONE object. */
function storeActions(): WorkflowMapActions {
  return {
    toggleSubItem: (p, n, s) => {
      toggleSubItem(db, p, n, s);
    },
    addSubItem: (p, n, t) => {
      addSubItem(db, p, n, { title: t });
    },
    updateSubItem: (p, n, s, patch) => {
      updateSubItem(db, p, n, s, patch);
    },
    removeSubItem: (p, n, s) => {
      removeSubItem(db, p, n, s);
    },
    markNode: (p, n, done) => {
      updateNode(db, p, n, { status: done ? "done" : "todo" });
    },
    moveNode: (p, n, layout) => {
      updateNode(db, p, n, { layout });
    },
  };
}

function liveLane() {
  return buildWorkflowLaneViewModel(listProjects(db));
}

describe("I-E019-1 — live render: real project, not the fixture", () => {
  it("loads the real project with derived percents and provenance live", () => {
    seedProject();
    const result = loadCockpitWorkflowbox(db);

    expect(result.provenance).toBe("live");
    const project = result.lane.projects.find((p) => p.id === "p-live");
    expect(project?.title).toBe("Ship the capstone");
    const wire = project?.nodes.find((n) => n.id === "n-wire");
    expect(wire?.percent).toBe(50); // 1/2 sub-items — DERIVED, not typed
    expect(result.lane).not.toBe(SYNTHETIC_WORKFLOW_LANE);
  });

  it("renders the real project in BOTH the lane and the map via the cockpit", () => {
    seedProject();
    const result = loadCockpitWorkflowbox(db);
    const html = renderToStaticMarkup(
      <WorkingCockpit lane={result.lane} laneProvenance="live" />,
    );

    expect(html).toContain("Ship the capstone");
    expect(html).toContain('data-workflowbox-provenance="live"');
    expect(html).toContain("WORKFLOWBOX - LIVE");
    // The fixture's sample project must NOT be presented alongside real data.
    expect(html).not.toContain("WorkflowBox v1b");
  });
});

describe("I-E019-2 — honest empty/sample when there is no store data", () => {
  it("falls back to the fixture labelled sample when the store is empty", () => {
    const result = loadCockpitWorkflowbox(db);
    expect(result.provenance).toBe("sample");
    expect(result.lane).toBe(SYNTHETIC_WORKFLOW_LANE);
  });

  it("fails closed to sample when the store is unreachable", () => {
    const broken = new Database(":memory:");
    broken.close();
    const result = loadCockpitWorkflowbox(broken);
    expect(result.provenance).toBe("sample");
    expect(result.lane).toBe(SYNTHETIC_WORKFLOW_LANE);
  });

  it("renders the sample provenance label by default (never unlabelled fixture)", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-workflowbox-provenance="sample"');
    expect(html).toContain("WORKFLOWBOX - SAMPLE");
  });
});

describe("I-E019-3 — live mutations persist through the ONE store API", () => {
  it("toggle / add / update / remove sub-items and markNode/moveNode all persist on re-read", () => {
    seedProject();
    const actions = storeActions();

    actions.toggleSubItem("p-live", "n-wire", "s-write");
    expect(
      getProject(db, "p-live")?.nodes.find((n) => n.id === "n-wire")?.percent,
    ).toBe(100);

    actions.addSubItem("p-live", "n-wire", "document it");
    const added = getProject(db, "p-live")
      ?.nodes.find((n) => n.id === "n-wire")
      ?.sub_items.find((s) => s.title === "document it");
    expect(added).toBeDefined();
    expect(
      getProject(db, "p-live")?.nodes.find((n) => n.id === "n-wire")?.percent,
    ).toBe(67); // 2/3 — derivation recomputed from the persisted checklist

    actions.updateSubItem("p-live", "n-wire", added!.id, { done: true });
    actions.removeSubItem("p-live", "n-wire", "s-read");
    expect(
      getProject(db, "p-live")
        ?.nodes.find((n) => n.id === "n-wire")
        ?.sub_items.map((s) => s.id)
        .sort(),
    ).toEqual([added!.id, "s-write"].sort());

    actions.markNode("p-live", "n-verify", true);
    expect(
      getProject(db, "p-live")?.nodes.find((n) => n.id === "n-verify")?.percent,
    ).toBe(100);

    actions.moveNode("p-live", "n-verify", { x: 220, y: 160 });
    expect(
      getProject(db, "p-live")?.nodes.find((n) => n.id === "n-verify")?.layout,
    ).toEqual({ x: 220, y: 160 });
  });

  it("the actions module routes ONLY through the store's exported ops (no second path)", () => {
    // one callback -> one store op; no raw SQL, no other data layer
    expect(ACTIONS_SOURCE).toContain('from "@/lib/workflowbox"');
    expect(ACTIONS_SOURCE).not.toMatch(/prepare\(|INSERT |UPDATE |DELETE /);
    for (const op of [
      "toggleSubItem(",
      "addSubItem(",
      "updateSubItem(",
      "removeSubItem(",
      "updateNode(",
    ]) {
      expect(ACTIONS_SOURCE).toContain(op);
    }
  });
});

describe("I-E019-4 — mark-from-either holds over live persistence", () => {
  it("a mutation from either view is reflected in BOTH (same live store read)", () => {
    seedProject();
    const actions = storeActions();

    // Mark from the LANE side: toggle the open sub-item.
    actions.toggleSubItem("p-live", "n-wire", "s-write");
    // Move from the MAP side: persist a drag.
    actions.moveNode("p-live", "n-wire", { x: 300, y: 120 });

    const lane = liveLane();
    const laneHtml = renderToStaticMarkup(
      <WorkflowLane model={lane} actions={actions} />,
    );
    const mapVm = buildWorkflowMapViewModel(lane);
    const mapHtml = renderToStaticMarkup(
      <WorkflowMap model={mapVm} actions={actions} />,
    );

    // Both views show the SAME post-mutation percent for the same node.
    expect(laneHtml).toContain('data-node-percent="100"');
    expect(mapHtml).toContain("100%");
    // The map's node position is the persisted layout from the SAME store.
    const mapNode = mapVm.projects
      .flatMap((p) => p.nodes)
      .find((n) => n.node.id === "n-wire");
    expect({ x: mapNode?.x, y: mapNode?.y }).toEqual({ x: 300, y: 120 });
  });
});

describe("I-E019-5 — derived integrity over live data", () => {
  it("sub-item -> node% -> rollup recomputes from real nodes (nothing hand-typed)", () => {
    seedProject();
    const before = getProject(db, "p-live")!;
    expect(before.rollup_percent).toBe(25); // (50 + 0) / 2

    storeActions().toggleSubItem("p-live", "n-wire", "s-write");
    const after = getProject(db, "p-live")!;
    expect(after.nodes.find((n) => n.id === "n-wire")?.percent).toBe(100);
    expect(after.rollup_percent).toBe(50); // (100 + 0) / 2 — recomputed
  });
});

describe("I-E019-6 — no execution path added", () => {
  it("the wire's sources carry no runTool and the store still refuses side_effecting", () => {
    for (const source of [LIVE_SOURCE, ACTIONS_SOURCE, PAGE_SOURCE]) {
      expect(source).not.toContain("runTool");
    }
    expect(() =>
      createProject(db, {
        title: "amber",
        goal: "refused",
        nodes: [{ title: "danger", effect_class: "side_effecting" }],
      }),
    ).toThrowError(WorkflowBoxError);
  });
});

describe("I-E019-7 — single source of truth, structurally", () => {
  it("the cockpit hands the SAME lane + SAME actions object to both views", () => {
    expect(COCKPIT_SOURCE.match(/actions=\{laneActions\}/g)).toHaveLength(2);
    expect(COCKPIT_SOURCE).toContain("model={lane}");
    expect(COCKPIT_SOURCE).toContain("buildWorkflowMapViewModel(lane)");
  });

  it("the view components still import no store (props only)", () => {
    for (const file of [
      "src/components/working/WorkflowLane.tsx",
      "src/components/working/WorkflowMap.tsx",
      "src/components/working/WorkflowNodeDetail.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/workflowbox\/store|@\/lib\/db|getDb/);
    }
  });

  it("the route wires ONE actions object, live-only (sample stays display)", () => {
    expect(PAGE_SOURCE).toContain("LIVE_WORKFLOWBOX_ACTIONS");
    expect(PAGE_SOURCE).toContain('workflowbox.provenance === "live"');
    expect(PAGE_SOURCE).toContain(": undefined");
    expect(PAGE_SOURCE).toContain("lane={workflowbox.lane}");
  });
});
