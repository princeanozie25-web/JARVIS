// WorkflowBox v1b — sub-items + fully-derived percentages.
// I-WBv1b-1 derived node % · -2 binary fallback · -3 two-layer rollup ·
// -4 single source of truth · -5 persistence · -8 no self-execution.
// (-6 materialization is in materialize.test.ts; -7/-9 lane UI in
// tests/working/workflow-lane.test.tsx.)

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { applyMigrations } from "../db/schema";
import {
  addNode,
  addSubItem,
  createProject,
  getProject,
  removeSubItem,
  toggleSubItem,
  updateNode,
  updateSubItem,
  WorkflowBoxError,
  type Project,
} from "./index";

let db: Database.Database;
const OPTS = (n = 0): { now: number; newId: () => string } => {
  let i = 0;
  return { now: 1_000 + n, newId: () => `gen-${i++}` };
};

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

function nodeOf(project: Project, id: string) {
  const node = project.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node ${id}`);
  return node;
}

function seedWithSubItems(): Project {
  return createProject(
    db,
    {
      id: "p1",
      title: "Ship v1b",
      goal: "Build the lane",
      nodes: [
        {
          id: "model",
          title: "Model extension",
          sub_items: [
            { id: "m1", title: "types", done: false },
            { id: "m2", title: "store", done: false },
            { id: "m3", title: "schema", done: false },
            { id: "m4", title: "tests", done: false },
          ],
        },
        { id: "lane", title: "Lane view" }, // no sub-items (binary)
      ],
    },
    OPTS(),
  );
}

// ===========================================================================
// I-WBv1b-1 — a node's percent is the DERIVED sub-item ratio; not settable
// ===========================================================================
describe("I-WBv1b-1 (derived node %)", () => {
  it("percent = round(done/total*100), recomputed on toggle/add/remove", () => {
    let p = seedWithSubItems();
    expect(nodeOf(p, "model").percent).toBe(0); // 0/4

    p = toggleSubItem(db, "p1", "model", "m1", { now: 2_000 });
    expect(nodeOf(p, "model").percent).toBe(25); // 1/4

    p = toggleSubItem(db, "p1", "model", "m2", { now: 3_000 });
    expect(nodeOf(p, "model").percent).toBe(50); // 2/4

    // adding an unchecked item changes the denominator -> 2/5 = 40
    p = addSubItem(
      db,
      "p1",
      "model",
      { id: "m5", title: "docs" },
      { now: 4_000 },
    );
    expect(nodeOf(p, "model").percent).toBe(40); // 2/5

    // removing an unchecked item -> 2/4 = 50
    p = removeSubItem(db, "p1", "model", "m5", { now: 5_000 });
    expect(nodeOf(p, "model").percent).toBe(50); // 2/4

    // rounding: 1/3 -> 33
    p = createProject(
      db,
      {
        id: "p2",
        title: "T",
        goal: "G",
        nodes: [
          {
            id: "n",
            title: "N",
            sub_items: [
              { id: "a", title: "a", done: true },
              { id: "b", title: "b", done: false },
              { id: "c", title: "c", done: false },
            ],
          },
        ],
      },
      OPTS(),
    );
    expect(nodeOf(p, "n").percent).toBe(33); // round(1/3*100)
  });

  it("percent is NOT settable directly on a node that has sub-items", () => {
    let p = seedWithSubItems();
    p = toggleSubItem(db, "p1", "model", "m1", { now: 2_000 }); // -> 25
    expect(nodeOf(p, "model").percent).toBe(25);

    // any percent/status patch is ignored for a sub-item node — the ratio wins
    p = updateNode(db, "p1", "model", { percent: 90 }, { now: 3_000 });
    expect(nodeOf(p, "model").percent).toBe(25);
    p = updateNode(db, "p1", "model", { status: "done" }, { now: 4_000 });
    expect(nodeOf(p, "model").percent).toBe(25);

    // a non-percent patch (title) still applies; the derived percent is untouched
    p = updateNode(db, "p1", "model", { title: "Model" }, { now: 5_000 });
    expect(nodeOf(p, "model").title).toBe("Model");
    expect(nodeOf(p, "model").percent).toBe(25);
  });

  it("completing every sub-item derives 100 (done)", () => {
    let p = seedWithSubItems();
    for (const id of ["m1", "m2", "m3", "m4"]) {
      p = toggleSubItem(db, "p1", "model", id);
    }
    expect(nodeOf(p, "model")).toMatchObject({ percent: 100, status: "done" });
  });
});

// ===========================================================================
// I-WBv1b-2 — a no-sub-item node is BINARY; in_progress unreachable without items
// ===========================================================================
describe("I-WBv1b-2 (no-sub-item binary fallback)", () => {
  it("marks done=100 / todo=0 only; in_progress collapses to todo", () => {
    seedWithSubItems();
    let p = updateNode(db, "p1", "lane", { status: "done" }, { now: 2_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 100, status: "done" });

    p = updateNode(db, "p1", "lane", { status: "todo" }, { now: 3_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 0, status: "todo" });

    p = updateNode(db, "p1", "lane", { status: "in_progress" }, { now: 4_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 0, status: "todo" });

    p = updateNode(db, "p1", "lane", { percent: 73 }, { now: 5_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 0, status: "todo" });
  });

  it("adding the first sub-item flips a done node to ratio-derived (0% until checked)", () => {
    seedWithSubItems();
    let p = updateNode(db, "p1", "lane", { status: "done" }, { now: 2_000 });
    expect(nodeOf(p, "lane").percent).toBe(100);

    p = addSubItem(
      db,
      "p1",
      "lane",
      { id: "L1", title: "step" },
      { now: 3_000 },
    );
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 0, status: "todo" }); // 0/1

    p = toggleSubItem(db, "p1", "lane", "L1", { now: 4_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 100, status: "done" }); // 1/1

    // removing the only sub-item reverts to not-done (empty checklist tracks nothing)
    p = removeSubItem(db, "p1", "lane", "L1", { now: 5_000 });
    expect(nodeOf(p, "lane")).toMatchObject({ percent: 0, status: "todo" });
  });
});

// ===========================================================================
// I-WBv1b-3 — two-layer rollup: one toggle moves node.percent AND rollup_percent
// ===========================================================================
describe("I-WBv1b-3 (two-layer derived rollup)", () => {
  it("toggling a sub-item updates node.percent and project.rollup_percent together", () => {
    let p = seedWithSubItems();
    // model 0/4 = 0, lane todo = 0 -> rollup round((0+0)/2) = 0
    expect(p.rollup_percent).toBe(0);

    p = toggleSubItem(db, "p1", "model", "m1", { now: 2_000 }); // model -> 25
    expect(nodeOf(p, "model").percent).toBe(25);
    expect(p.rollup_percent).toBe(13); // round((25+0)/2) = round(12.5) = 13

    p = toggleSubItem(db, "p1", "model", "m2", { now: 3_000 }); // model -> 50
    expect(p.rollup_percent).toBe(25); // round((50+0)/2)

    p = updateNode(db, "p1", "lane", { status: "done" }, { now: 4_000 }); // lane -> 100
    expect(p.rollup_percent).toBe(75); // round((50+100)/2)

    // rollup is exactly the mean of the DERIVED node percents
    const mean = Math.round(
      p.nodes.reduce((acc, n) => acc + n.percent, 0) / p.nodes.length,
    );
    expect(p.rollup_percent).toBe(mean);
  });
});

// ===========================================================================
// I-WBv1b-4 — single source of truth: every sub-item write goes through the store
// ===========================================================================
describe("I-WBv1b-4 (single source of truth preserved)", () => {
  it("a read after any sub-item mutation reflects it; no second authoritative copy", () => {
    seedWithSubItems();

    const afterAdd = addSubItem(
      db,
      "p1",
      "model",
      { id: "m5", title: "lint" },
      { now: 2_000 },
    );
    expect(getProject(db, "p1")).toEqual(afterAdd);

    const afterToggle = toggleSubItem(db, "p1", "model", "m5", { now: 3_000 });
    expect(getProject(db, "p1")).toEqual(afterToggle);

    const afterEdit = updateSubItem(
      db,
      "p1",
      "model",
      "m5",
      { title: "linting" },
      { now: 4_000 },
    );
    expect(getProject(db, "p1")).toEqual(afterEdit);
    expect(
      nodeOf(getProject(db, "p1") as Project, "model").sub_items.find(
        (s) => s.id === "m5",
      ),
    ).toMatchObject({ title: "linting", done: true });

    const afterRemove = removeSubItem(db, "p1", "model", "m5", { now: 5_000 });
    expect(getProject(db, "p1")).toEqual(afterRemove);
  });

  it("a typed error is thrown for a missing node or sub-item", () => {
    seedWithSubItems();
    expect(() => toggleSubItem(db, "p1", "ghost", "x")).toThrowError(
      WorkflowBoxError,
    );
    let code: string | undefined;
    try {
      toggleSubItem(db, "p1", "model", "nope");
    } catch (error) {
      code = (error as WorkflowBoxError).code;
    }
    expect(code).toBe("sub_item_not_found");
  });
});

// ===========================================================================
// I-WBv1b-5 — persistence: sub-items + derived percents survive a reconnect
// ===========================================================================
describe("I-WBv1b-5 (persistence of sub-items + derived percents)", () => {
  it("a checklist state + the percent it derives survive a simulated restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflowbox-sub-"));
    const file = join(dir, "wb.db");
    try {
      const first = new Database(file);
      applyMigrations(first);
      createProject(
        first,
        {
          id: "p1",
          title: "Persisted",
          goal: "Survive restart",
          nodes: [
            {
              id: "n",
              title: "N",
              sub_items: [
                { id: "s1", title: "a", done: true },
                { id: "s2", title: "b", done: false },
              ],
            },
          ],
        },
        { now: 5_000 },
      );
      const toggled = toggleSubItem(first, "p1", "n", "s2", { now: 6_000 }); // -> 2/2
      expect(toggled.nodes[0].percent).toBe(100);
      first.close();

      const reopened = new Database(file);
      applyMigrations(reopened); // idempotent
      const reread = getProject(reopened, "p1");
      reopened.close();

      expect(reread).toEqual(toggled);
      expect(reread?.nodes[0].percent).toBe(100);
      expect(reread?.nodes[0].sub_items.map((s) => s.done)).toEqual([
        true,
        true,
      ]);
      expect(reread?.rollup_percent).toBe(100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// I-WBv1b-8 — no self-execution preserved (the amber door stays a type seam)
// ===========================================================================
describe("I-WBv1b-8 (no self-execution preserved)", () => {
  it("sub-item nodes stay effect_class 'display'; side_effecting still refused", () => {
    const p = seedWithSubItems();
    expect(p.nodes.every((n) => n.effect_class === "display")).toBe(true);

    let code: string | undefined;
    try {
      addNode(db, "p1", {
        title: "doer",
        effect_class: "side_effecting",
        sub_items: [{ title: "x" }],
      });
    } catch (error) {
      code = (error as WorkflowBoxError).code;
    }
    expect(code).toBe("side_effecting_not_wired");
  });

  it("workflowbox/ + the lane component reach NO mutator (source scan)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const srcRoot = resolve(dir, "..", "..");
    const laneComponent = resolve(
      srcRoot,
      "components/working/WorkflowLane.tsx",
    );
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => resolve(dir, name));
    files.push(laneComponent);

    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");
    // the same mutator set the v1a no-mutator scan forbids (the store may import
    // the better-sqlite3 TYPE — it persists planning state, it does not execute).
    const MUTATOR =
      /tools\/runtime|mcp-gateway|approval-runtime|chat\/tool-approvals|lib\/router/;
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\.runTool\s*\(/.test(code)) offenders.push(`${file}: runTool`);
      for (const from of [...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
        (m) => m[1],
      )) {
        if (MUTATOR.test(from)) offenders.push(`${file} -> ${from}`);
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);

    // the lane component is props-driven: it reaches no store / no sqlite at all
    // (the read path + mutations are injected; it only renders + calls callbacks).
    const laneCode = stripComments(readFileSync(laneComponent, "utf8"));
    const laneImports = [
      ...laneCode.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);
    expect(
      laneImports.filter((from) =>
        /better-sqlite3|workflowbox\/store|workflowbox\/index|workflowbox['"]/.test(
          from,
        ),
      ),
      "lane component must not import the store or sqlite",
    ).toEqual([]);
  });

  it("runtime.runTool production call-site count is UNCHANGED at exactly 2", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const libRoot = resolve(dir, "..");
    const walk = (root: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        const full = resolve(root, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (
          entry.name.endsWith(".ts") &&
          !entry.name.endsWith(".test.ts")
        ) {
          out.push(full);
        }
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
});
