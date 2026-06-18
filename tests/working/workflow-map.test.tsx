// WorkflowBox v1c — the MIND-MAP SVG render (UI + integration invariants).
// I-WBv1c-1 same source of truth · -2 renders the graph · -3 drag persists layout ·
// -4 mark-from-map == lane · -5 governance grammar · -6 no self-exec · -7 SVG.
//
// Same node harness as v1b (vitest "node", react-dom/server, no jsdom). The drag
// gesture's pointer math is browser-only; per I-WBv1c-3 the drag is proven by
// driving the SAME store callback the drop fires (moveNode -> updateNode layout)
// and re-reading. Map/lane parity is proven by building BOTH view-models from the
// SAME store after the SAME mutation.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  WorkflowMap,
  type WorkflowMapActions,
} from "../../src/components/working/WorkflowMap";
import { applyMigrations } from "../../src/lib/db/schema";
import {
  addSubItem,
  buildWorkflowLaneViewModel,
  buildWorkflowMapViewModel,
  createProject,
  listProjects,
  removeSubItem,
  toggleSubItem,
  updateNode,
  updateSubItem,
} from "../../src/lib/workflowbox";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

/** The host wiring: the SAME store, the SAME single mutation surface, for BOTH
 * the lane and the map. markNode + moveNode both route to updateNode. */
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

function mapVm() {
  return buildWorkflowMapViewModel(
    buildWorkflowLaneViewModel(listProjects(db)),
  );
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function attrAfter(html: string, anchor: string, attr: string): number | null {
  const match = new RegExp(`${anchor}[\\s\\S]*?${attr}="(-?\\d+)"`).exec(html);
  return match ? Number(match[1]) : null;
}

function seedGraph() {
  // a -> b (b depends on a). distinct layouts (no fallback). a: 1/2 sub-items;
  // b: binary done. rollup = round((50+100)/2) = 75.
  createProject(
    db,
    {
      id: "p1",
      title: "Ship v1c",
      goal: "Map over the model",
      nodes: [
        {
          id: "a",
          title: "Model",
          detail: "the proven core",
          layout: { x: 40, y: 40 },
          sub_items: [
            { id: "a1", title: "x", done: true },
            { id: "a2", title: "y", done: false },
          ],
        },
        {
          id: "b",
          title: "Render",
          depends_on: ["a"],
          layout: { x: 280, y: 40 },
          status: "done",
        },
      ],
    },
    { now: 1_000 },
  );
}

// ===========================================================================
// I-WBv1c-1 — same source of truth (no second read path / mutation surface)
// ===========================================================================
describe("I-WBv1c-1 (same source of truth)", () => {
  it("the map view-model is DERIVED from the lane view-model (same nodes, same %)", () => {
    seedGraph();
    const lane = buildWorkflowLaneViewModel(listProjects(db));
    const map = buildWorkflowMapViewModel(lane);

    const laneNodes = lane.projects[0].nodes;
    const mapNodes = map.projects[0].nodes;
    expect(mapNodes.map((m) => m.node.id)).toEqual(laneNodes.map((n) => n.id));
    // the map carries the SAME LaneNodeView (same derived percents) — no recompute
    expect(mapNodes.map((m) => m.node.percent)).toEqual(
      laneNodes.map((n) => n.percent),
    );
    expect(map.projects[0].rollup_percent).toBe(
      lane.projects[0].rollup_percent,
    );
  });

  it("the map component + projection reach NO store / sqlite / mutator (source scan)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const root = resolve(here, "..", "..");
    const files = [
      resolve(root, "src/components/working/WorkflowMap.tsx"),
      resolve(root, "src/components/working/WorkflowNodeDetail.tsx"),
      resolve(root, "src/lib/workflowbox/map-view.ts"),
    ];
    const strip = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");
    const offenders: string[] = [];
    for (const file of files) {
      const code = strip(readFileSync(file, "utf8"));
      if (/\.runTool\s*\(/.test(code)) offenders.push(`${file}: runTool`);
      for (const from of [...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
        (m) => m[1],
      )) {
        if (
          /better-sqlite3|workflowbox\/store|workflowbox\/index|tools\/runtime|mcp-gateway|approval-runtime|chat\/tool-approvals|lib\/router/.test(
            from,
          )
        ) {
          offenders.push(`${file} -> ${from}`);
        }
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});

// ===========================================================================
// I-WBv1c-2 — renders the SVG graph (nodes at layout, edges, derived %, rollup)
// ===========================================================================
describe("I-WBv1c-2 (renders the graph)", () => {
  it("an addressable node group per node at its layout, an edge per dependency", () => {
    seedGraph();
    const html = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);

    // one addressable group per node, positioned by persisted layout
    expect(html.match(/data-node-id="/g)).toHaveLength(2);
    expect(attrAfter(html, 'data-node-id="a"', "data-node-x")).toBe(40);
    expect(attrAfter(html, 'data-node-id="a"', "data-node-y")).toBe(40);
    expect(attrAfter(html, 'data-node-id="b"', "data-node-x")).toBe(280);
    expect(html).toContain('transform="translate(40, 40)"');

    // one dependency edge a -> b
    expect(html.match(/<line\b/g)).toHaveLength(1);
    expect(html).toContain('data-edge-from="a"');
    expect(html).toContain('data-edge-to="b"');

    // each node shows its DERIVED percent; the project rollup is shown once
    expect(attrAfter(html, 'data-node-id="a"', "data-node-percent")).toBe(50);
    expect(attrAfter(html, 'data-node-id="b"', "data-node-percent")).toBe(100);
    expect(attrAfter(html, 'data-project-id="p1"', "data-rollup-percent")).toBe(
      75,
    );
  });

  it("a degenerate (all-origin) layout falls back to a readable non-overlapping grid", () => {
    createProject(
      db,
      {
        id: "p2",
        title: "Fresh",
        goal: "no layout yet",
        nodes: [
          { id: "n1", title: "A" },
          { id: "n2", title: "B" },
          { id: "n3", title: "C" },
        ],
      },
      { now: 1_000 },
    );
    const map = buildWorkflowMapViewModel(
      buildWorkflowLaneViewModel(listProjects(db)),
    );
    const points = map.projects[0].nodes.map((n) => `${n.x},${n.y}`);
    // no two nodes share a point (the fallback spread them out)
    expect(new Set(points).size).toBe(points.length);
  });
});

// ===========================================================================
// I-WBv1c-3 — drag persists layout via the SAME store mutation (layout only)
// ===========================================================================
describe("I-WBv1c-3 (drag persists layout)", () => {
  it("a simulated drag updates layout and re-reads it; status/percent/deps untouched", () => {
    seedGraph();
    const before = must(
      listProjects(db)[0].nodes.find((n) => n.id === "a"),
      "node a",
    );
    expect(before.layout).toEqual({ x: 40, y: 40 });

    // the map's drop fires moveNode -> the SAME store (updateNode layout)
    storeActions().moveNode("p1", "a", { x: 220, y: 160 });

    const after = must(
      listProjects(db)[0].nodes.find((n) => n.id === "a"),
      "node a",
    );
    expect(after.layout).toEqual({ x: 220, y: 160 }); // persisted
    expect(after.percent).toBe(before.percent); // derived %, unchanged by drag
    expect(after.status).toBe(before.status);
    expect(after.depends_on).toEqual(before.depends_on);
    // the map now renders the node at its new persisted position
    const html = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(attrAfter(html, 'data-node-id="a"', "data-node-x")).toBe(220);
    expect(attrAfter(html, 'data-node-id="a"', "data-node-y")).toBe(160);
  });
});

// ===========================================================================
// I-WBv1c-4 — mark from the map == mark from the lane (same callbacks, same store)
// ===========================================================================
describe("I-WBv1c-4 (mark from the map == lane)", () => {
  it("toggling a sub-item via the map's callbacks recomputes identically to the lane", () => {
    seedGraph(); // node a: 1/2 -> 50
    const actions = storeActions();

    // the map's checklist checkbox fires the SAME toggleSubItem callback
    actions.toggleSubItem("p1", "a", "a2"); // -> 2/2 = 100

    const lane = buildWorkflowLaneViewModel(listProjects(db));
    const map = buildWorkflowMapViewModel(lane);
    const laneA = must(
      lane.projects[0].nodes.find((n) => n.id === "a"),
      "lane a",
    );
    const mapA = must(
      map.projects[0].nodes.find((m) => m.node.id === "a"),
      "map a",
    );

    expect(laneA.percent).toBe(100); // derived from the store
    expect(mapA.node.percent).toBe(100); // SAME store, SAME number
    expect(map.projects[0].rollup_percent).toBe(
      lane.projects[0].rollup_percent,
    );
    expect(lane.projects[0].rollup_percent).toBe(100); // round((100+100)/2)
  });
});

// ===========================================================================
// I-WBv1c-5 — governance grammar (no-affordance, calm/no-amber, tokens, motion)
// ===========================================================================
describe("I-WBv1c-5 (governance grammar)", () => {
  it("carries the three no-affordance contracts; nodes are calm/display-class", () => {
    seedGraph();
    const html = renderToStaticMarkup(
      <WorkflowMap model={mapVm()} initialOpenNodeId="a" />,
    );
    expect(html).toContain('data-execute-affordance-present="false"');
    expect(html).toContain('data-approve-affordance-present="false"');
    expect(html).toContain('data-mutation-affordance-present="false"');
    expect(html).toContain('data-lane-amber-present="false"');
    expect(html).not.toContain('data-node-touches-gate="true"');
    expect(html).not.toContain('data-lane-amber-present="true"');
  });

  it("the map styling uses existing --jarvis-* tokens, no amber, with reduced-motion", () => {
    const css = readFileSync(
      resolve("src/components/working/workflow-map.css"),
      "utf8",
    );
    expect(css).toContain("var(--jarvis-color-emerald-local)");
    expect(css).toContain("var(--jarvis-font-display)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).not.toContain("var(--jarvis-color-amber-review)");
  });
});

// ===========================================================================
// I-WBv1c-6 — no self-execution preserved (runtime.runTool stays exactly 2)
// ===========================================================================
describe("I-WBv1c-6 (no self-execution preserved)", () => {
  it("runtime.runTool production call-site count is UNCHANGED at exactly 2", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const libRoot = resolve(here, "..", "..", "src", "lib");
    const walk = (root: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        const full = resolve(root, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
          out.push(full);
      }
      return out;
    };
    const sites: string[] = [];
    for (const file of walk(libRoot)) {
      const matches = readFileSync(file, "utf8").match(/\.runTool\s*\(/g);
      if (matches) for (let i = 0; i < matches.length; i++) sites.push(file);
    }
    expect(sites.length, sites.join(", ")).toBe(2);
    expect(sites.every((s) => s.split(/[\\/]/).includes("chat"))).toBe(true);
  });

  it("every map node is effect_class display (no amber/Gate state)", () => {
    seedGraph();
    const map = mapVm();
    expect(map.any_amber).toBe(false);
    expect(
      map.projects.every((p) => p.nodes.every((n) => !n.node.touches_gate)),
    ).toBe(true);
  });
});

// ===========================================================================
// I-WBv1c-7 — SVG, addressable, deterministic (not canvas)
// ===========================================================================
describe("I-WBv1c-7 (SVG, addressable, deterministic)", () => {
  it("renders SVG with addressable node groups + accessible labels, not canvas", () => {
    seedGraph();
    const html = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(html).toContain("<svg");
    expect(html).toContain("viewBox=");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Ship v1c workflow map"');
    expect(html).toMatch(/<g[^>]*data-node-id="a"/);
    expect(html).toContain('aria-label="Model — in progress — 50%"');
    expect(html).not.toContain("<canvas");
  });

  it("is deterministic given the same model", () => {
    seedGraph();
    const a = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    const b = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(a).toBe(b);
  });
});
