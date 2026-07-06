import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorkflowLane } from "../../src/components/working/WorkflowLane";
import { WorkflowMap } from "../../src/components/working/WorkflowMap";
import { SYNTHETIC_WORKFLOW_LANE } from "../../src/components/working/workflow-lane-fixture";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import { applyMigrations } from "../../src/lib/db/schema";
import {
  buildWorkflowLaneViewModel,
  buildWorkflowMapViewModel,
  createProject,
  listProjects,
  toggleSubItem,
} from "../../src/lib/workflowbox";

// AP-J3 — the WorkflowBox surface pass. Display-class, NOT Gate-touching:
// no amber anywhere (I-APJ3-1); data/mono registers (I-APJ3-2); the derived
// two-layer rollup fills via the inherited measuredFill beat (I-APJ3-3);
// SSOT over the live store preserved (I-APJ3-4); honest live/sample/empty
// states calm (I-APJ3-5); SVG map with draggable nodes + branch edges
// (I-APJ3-6); display-only, runtime.runTool exactly 2 (I-APJ3-7).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), "utf8");
}

const LANE_CSS = read("src", "components", "working", "workflow-lane.css");
const MAP_CSS = read("src", "components", "working", "workflow-map.css");
const LANE_SOURCE = read("src", "components", "working", "WorkflowLane.tsx");
const MAP_SOURCE = read("src", "components", "working", "WorkflowMap.tsx");
const DETAIL_SOURCE = read(
  "src",
  "components",
  "working",
  "WorkflowNodeDetail.tsx",
);
const COCKPIT_SOURCE = read(
  "src",
  "components",
  "working",
  "WorkingCockpit.tsx",
);
const DOC = read("docs", "capstone", "JARVIS_DESIGN_LANGUAGE.md");

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "");
}

const AMBER_MARKERS = [
  "--jcc-amber",
  "--jarvis-shell-gate",
  "--tc-restricted",
  "amber-review",
  "--jarvis-color-review",
  "#ffb24d",
  "#ff8a1f",
  "#fbbf24",
  "255, 178, 77",
  "255, 138, 31",
] as const;

function mentionsAmber(text: string): boolean {
  const haystack = text.toLowerCase();
  return AMBER_MARKERS.some((marker) => haystack.includes(marker));
}

function walkSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walkSources(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

function seed() {
  // a -> b dependency; a: 1/2 sub-items (50%); b: binary done (100%);
  // rollup = round((50 + 100) / 2) = 75.
  createProject(
    db,
    {
      id: "p1",
      title: "Language pass",
      goal: "Calm live surface",
      nodes: [
        {
          id: "a",
          title: "Polish lane",
          layout: { x: 40, y: 40 },
          sub_items: [
            { id: "a1", title: "bars", done: true },
            { id: "a2", title: "registers", done: false },
          ],
        },
        {
          id: "b",
          title: "Polish map",
          depends_on: ["a"],
          layout: { x: 280, y: 40 },
          status: "done",
        },
      ],
    },
    { now: 1_000 },
  );
}

function laneVm() {
  return buildWorkflowLaneViewModel(listProjects(db));
}

function mapVm() {
  return buildWorkflowMapViewModel(laneVm());
}

/* ------------------------------------------------------------------------ *
 * I-APJ3-1 — NO amber: WorkflowBox is display-class, not Gate-touching
 * ------------------------------------------------------------------------ */

describe("I-APJ3-1 — the color law: no amber anywhere in WorkflowBox", () => {
  it("the lane and map styling carry zero amber", () => {
    for (const css of [LANE_CSS, MAP_CSS]) {
      expect(mentionsAmber(stripComments(css))).toBe(false);
    }
  });

  it("the components render zero amber state (sources + markup)", () => {
    for (const source of [LANE_SOURCE, MAP_SOURCE, DETAIL_SOURCE]) {
      expect(mentionsAmber(stripComments(source))).toBe(false);
    }
    seed();
    const laneHtml = renderToStaticMarkup(<WorkflowLane model={laneVm()} />);
    const mapHtml = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    for (const html of [laneHtml, mapHtml]) {
      expect(html).toContain('data-lane-amber-present="false"');
      expect(html).not.toContain('data-node-touches-gate="true"');
    }
  });

  it("both fills are the emerald->sky progress range", () => {
    // lane: the CSS gradient over base tokens
    expect(LANE_CSS).toContain("var(--jarvis-color-emerald-local)");
    expect(LANE_CSS).toContain("var(--jarvis-color-sky-focus)");
    // map: the per-project SVG gradient whose stops consume the base tokens
    seed();
    const html = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(html).toContain('id="wfm-progress-p1"');
    expect(html).toContain('stop-color="var(--jarvis-color-emerald-local)"');
    expect(html).toContain('stop-color="var(--jarvis-color-sky-focus)"');
    expect(html).toContain('fill="url(#wfm-progress-p1)"');
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-2 — registers: data titles, mono ids/counts
 * ------------------------------------------------------------------------ */

describe("I-APJ3-2 — registers on the surface", () => {
  it("node titles are the DATA register on both views; project titles keep display", () => {
    const laneTitle = LANE_CSS.match(/\.wfl-node-title\s*\{[^}]*\}/);
    expect(laneTitle![0]).toContain("var(--jarvis-font-body)");
    const mapTitle = MAP_CSS.match(/\.wfm-node-title\s*\{[^}]*\}/);
    expect(mapTitle![0]).toContain("var(--jarvis-font-body)");
    const mapProject = MAP_CSS.match(/\.wfm-project-title\s*\{[^}]*\}/);
    expect(mapProject![0]).toContain("var(--jarvis-font-display)");
  });

  it("ids, counts, statuses, and percents are JetBrains Mono", () => {
    for (const [css, selectors] of [
      [LANE_CSS, [".wfl-count", ".wfl-node-pct", ".wfl-status"]],
      [MAP_CSS, [".wfm-node-status", ".wfm-node-pct"]],
    ] as const) {
      for (const selector of selectors) {
        const rule = css.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
        expect(rule, selector).not.toBeNull();
        expect(rule![0]).toContain("var(--jarvis-font-mono)");
      }
    }
  });

  it("no model-voice italic is misused on system data", () => {
    seed();
    const html = renderToStaticMarkup(
      <>
        <WorkflowLane model={laneVm()} />
        <WorkflowMap model={mapVm()} />
      </>,
    );
    expect(html).not.toContain('data-text-register="model-voice"');
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-3 — derived rollup fills via the inherited measuredFill beat
 * ------------------------------------------------------------------------ */

describe("I-APJ3-3 — the two-layer derived rollup fills measuredly", () => {
  it("toggling one sub-item moves the node bar AND the rollup bar, both derived", () => {
    seed();
    const before = renderToStaticMarkup(<WorkflowLane model={laneVm()} />);
    expect(before).toContain('data-node-percent="50"');
    expect(before).toContain('data-rollup-percent="75"');

    toggleSubItem(db, "p1", "a", "a2"); // 1/2 -> 2/2

    const after = renderToStaticMarkup(<WorkflowLane model={laneVm()} />);
    expect(after).toContain('data-node-percent="100"');
    expect(after).toContain('data-rollup-percent="100"');
    // the map shows the SAME derived numbers (no recompute, same store)
    const mapAfter = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(mapAfter).toContain('data-node-percent="100"');
    expect(mapAfter).toContain('data-rollup-percent="100"');
  });

  it("both bars bind the measured fill through the vocabulary token", () => {
    const laneBar = LANE_CSS.match(/\.wfl-bar i\s*\{[^}]*\}/);
    expect(laneBar![0]).toContain("var(--jarvis-motion-vocab-fill)");
    const mapBar = MAP_CSS.match(/\.wfm-bar-fill\s*\{[^}]*\}/);
    expect(mapBar![0]).toContain("var(--jarvis-motion-vocab-fill)");
  });

  it("reduced motion neutralizes the map fill (and the vocab token zeroes both)", () => {
    const reduced = MAP_CSS.match(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*$/,
    );
    expect(reduced![0]).toContain(".wfm-bar-fill");
    expect(reduced![0]).toContain("transition: none");
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-4 — SSOT preserved over the live store
 * ------------------------------------------------------------------------ */

describe("I-APJ3-4 — one store, one mutation surface, two views", () => {
  it("the cockpit hands the SAME actions object to the lane and the map", () => {
    const matches = COCKPIT_SOURCE.match(/actions=\{laneActions\}/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it("the map view-model is derived from the lane view-model — same percents", () => {
    seed();
    const lane = laneVm();
    const map = buildWorkflowMapViewModel(lane);
    expect(map.projects[0].nodes.map((n) => n.node.percent)).toEqual(
      lane.projects[0].nodes.map((n) => n.percent),
    );
    expect(map.projects[0].rollup_percent).toBe(
      lane.projects[0].rollup_percent,
    );
  });

  it("no view imports the store or a second mutation path (source scan)", () => {
    for (const source of [LANE_SOURCE, MAP_SOURCE, DETAIL_SOURCE]) {
      const stripped = stripComments(source);
      expect(stripped).not.toMatch(
        /better-sqlite3|workflowbox\/store|workflowbox\/index|approval-runtime|mcp-gateway/,
      );
    }
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-5 — honest live/sample/empty states, calm
 * ------------------------------------------------------------------------ */

describe("I-APJ3-5 — honest provenance renders calm", () => {
  it("the sample state stays explicitly labelled in the calm family", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain("WORKFLOWBOX - SAMPLE");
    expect(html).toMatch(
      /wfl-provenance jcc-honest" data-honest-state="synthetic"/,
    );
  });

  it("the live state renders labelled LIVE in the calm family — never error-styled", () => {
    const html = renderToStaticMarkup(
      <WorkingCockpit lane={SYNTHETIC_WORKFLOW_LANE} laneProvenance="live" />,
    );
    expect(html).toContain("WORKFLOWBOX - LIVE");
    expect(html).toMatch(/wfl-provenance jcc-honest" data-honest-state="live"/);
    expect(html).toContain('data-workflowbox-provenance="live"');
  });

  it("both empty states join the honest-state family, calm", () => {
    const emptyLane = { ...SYNTHETIC_WORKFLOW_LANE, projects: [] };
    const laneHtml = renderToStaticMarkup(<WorkflowLane model={emptyLane} />);
    const mapHtml = renderToStaticMarkup(
      <WorkflowMap model={buildWorkflowMapViewModel(emptyLane)} />,
    );
    for (const html of [laneHtml, mapHtml]) {
      expect(html).toContain('data-honest-state="empty"');
      expect(html).toContain("jcc-honest");
      expect(html).toContain("No projects yet.");
      expect(html).not.toMatch(/error|blocked|warn/i);
    }
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-6 — SVG map, branch edges, draggable nodes
 * ------------------------------------------------------------------------ */

describe("I-APJ3-6 — the SVG map with branch edges and persistent drag", () => {
  it("renders SVG with addressable nodes and a curved branch edge per dependency", () => {
    seed();
    const html = renderToStaticMarkup(<WorkflowMap model={mapVm()} />);
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).not.toContain("<canvas");
    // the dependency edge is a cubic branch curve with addressable endpoints
    const edge = html.match(/<path class="wfm-edge"[^>]*>/);
    expect(edge).not.toBeNull();
    expect(edge![0]).toContain('data-edge-from="a"');
    expect(edge![0]).toContain('data-edge-to="b"');
    expect(edge![0]).toMatch(/d="M [\d.-]+ [\d.-]+ C /);
    // nodes are keyboard-reachable groups at their persisted layout
    expect(html).toMatch(/<g[^>]*data-node-id="a"[^>]*tabindex="0"/);
    expect(html).toContain('transform="translate(40, 40)"');
  });

  it("drag is layout-only through the same store; the edge stroke stays neutral stone", () => {
    // the drop persists via moveNode -> updateNode layout (source-level)
    expect(MAP_SOURCE).toContain("moveNode(project.id, drag.nodeId");
    expect(MAP_SOURCE).toContain("Math.round(override.x)");
    // edges are structure, not signal: neutral ink mix, no accent, no amber
    const edgeRule = MAP_CSS.match(/\.wfm-edge\s*\{[^}]*\}/);
    expect(edgeRule![0]).toContain("var(--jarvis-color-ink)");
    expect(edgeRule![0]).not.toContain("sky-focus");
    expect(mentionsAmber(edgeRule![0])).toBe(false);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ3-7 — display-only preserved, no behavior change
 * ------------------------------------------------------------------------ */

describe("I-APJ3-7 — display-only; runtime.runTool exactly 2", () => {
  it("runtime.runTool still has exactly its two drilled sites", () => {
    const sites: string[] = [];
    for (const file of walkSources(resolve(ROOT, "src"))) {
      const source = readFileSync(file, "utf8");
      const count = (source.match(/runtime\.runTool\(/g) ?? []).length;
      for (let i = 0; i < count; i += 1) {
        sites.push(file.slice(ROOT.length + 1).replaceAll("\\", "/"));
      }
    }
    expect(sites.sort()).toEqual([
      "src/lib/chat/tool-approvals.ts",
      "src/lib/chat/tool-continuation.ts",
    ]);
  });

  it("the no-affordance contracts hold on both views over live data", () => {
    seed();
    const html = renderToStaticMarkup(
      <>
        <WorkflowLane model={laneVm()} />
        <WorkflowMap model={mapVm()} />
      </>,
    );
    expect(html.match(/data-execute-affordance-present="false"/g)).toHaveLength(
      2,
    );
    expect(html.match(/data-approve-affordance-present="false"/g)).toHaveLength(
      2,
    );
    expect(html).toContain('data-only-mutator="human-gate"');
  });

  it("the design-language doc records the AP-J3 surface pass", () => {
    expect(DOC).toContain("AP-J3 — WorkflowBox");
    expect(DOC).toContain("no amber anywhere");
    expect(DOC).toContain("wfm-progress-<project>");
  });
});
