// WorkflowBox v1a — model + persistence invariants
// I-WBv1a-1,-2,-3,-4,-5,-7,-8 (materialization -6 is in materialize.test.ts).

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { applyMigrations } from "../db/schema";
import {
  addNode,
  createProject,
  getProject,
  listProjects,
  removeNode,
  removeProject,
  updateNode,
  WorkflowBoxError,
  type Project,
} from "./index";

let db: Database.Database;
const OPTS = (n = 0): { now: number; newId: () => string } => {
  let i = 0;
  return { now: 1_000 + n, newId: () => `node-${i++}` };
};

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

// ===========================================================================
// I-WBv1a-1 — single source of truth: all mutations through one API; reading
// after a mutation reflects it; no second authoritative copy.
// ===========================================================================
describe("I-WBv1a-1 (single source of truth)", () => {
  it("every mutation is reflected by a subsequent read of the same project", () => {
    const created = createProject(
      db,
      {
        id: "p1",
        title: "Ship the thing",
        goal: "Get it out the door",
        nodes: [{ id: "a", title: "Design" }],
      },
      OPTS(),
    );
    expect(getProject(db, "p1")).toEqual(created);

    const afterAdd = addNode(
      db,
      "p1",
      { id: "b", title: "Build" },
      { now: 2_000 },
    );
    expect(getProject(db, "p1")).toEqual(afterAdd);
    expect(afterAdd.nodes.map((n) => n.id)).toEqual(["a", "b"]);

    const afterMark = updateNode(
      db,
      "p1",
      "a",
      { percent: 100 },
      { now: 3_000 },
    );
    expect(getProject(db, "p1")).toEqual(afterMark);
    expect(getProject(db, "p1")?.nodes.find((n) => n.id === "a")?.percent).toBe(
      100,
    );
    // exactly one project exists; the read IS the source of truth
    expect(listProjects(db).map((p) => p.id)).toEqual(["p1"]);
  });

  it("a layout-only mark (the future drag) goes through the same single API", () => {
    createProject(
      db,
      { id: "p1", title: "T", goal: "G", nodes: [{ id: "a", title: "A" }] },
      OPTS(),
    );
    const moved = updateNode(
      db,
      "p1",
      "a",
      { layout: { x: 42, y: 7 } },
      { now: 2_000 },
    );
    expect(moved.nodes[0].layout).toEqual({ x: 42, y: 7 });
    expect(getProject(db, "p1")?.nodes[0].layout).toEqual({ x: 42, y: 7 });
  });
});

// ===========================================================================
// I-WBv1a-2 — rollup is DERIVED (mean of node percents), recomputes, never set
// ===========================================================================
describe("I-WBv1a-2 (rollup derived)", () => {
  it("rollup is the rounded mean of node percents and recomputes on change", () => {
    const p = createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", percent: 0, title: "A" },
          { id: "b", percent: 50, title: "B" },
          { id: "c", percent: 100, title: "C" },
        ],
      },
      OPTS(),
    );
    expect(p.rollup_percent).toBe(50); // round((0+50+100)/3)

    const after = updateNode(db, "p1", "a", { percent: 100 }, { now: 2_000 });
    expect(after.rollup_percent).toBe(83); // round((100+50+100)/3)

    expect(
      createProject(db, { id: "empty", title: "T", goal: "G" }, OPTS())
        .rollup_percent,
    ).toBe(0);
  });

  it("rollup_percent is not a stored column (cannot be authored directly)", () => {
    const columns = (
      db.prepare("PRAGMA table_info(workflow_projects)").all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    expect(columns).not.toContain("rollup_percent");
  });
});

// ===========================================================================
// I-WBv1a-3 — status<->percent consistency (done=100, 0=todo, else in_progress)
// ===========================================================================
describe("I-WBv1a-3 (status/percent consistency)", () => {
  it("status is derived from percent on create + update", () => {
    const p = createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", percent: 0, title: "A" },
          { id: "b", percent: 50, title: "B" },
          { id: "c", percent: 100, title: "C" },
        ],
      },
      OPTS(),
    );
    const byId = Object.fromEntries(p.nodes.map((n) => [n.id, n.status]));
    expect(byId).toEqual({ a: "todo", b: "in_progress", c: "done" });
  });

  it("setting status maps to a consistent canonical percent", () => {
    createProject(
      db,
      { id: "p1", title: "T", goal: "G", nodes: [{ id: "a", title: "A" }] },
      OPTS(),
    );

    let after = updateNode(db, "p1", "a", { status: "done" }, { now: 2_000 });
    expect(after.nodes[0]).toMatchObject({ status: "done", percent: 100 });

    after = updateNode(db, "p1", "a", { status: "todo" }, { now: 3_000 });
    expect(after.nodes[0]).toMatchObject({ status: "todo", percent: 0 });

    // in_progress from a boundary (0/100) lands at a sensible mid value
    after = updateNode(
      db,
      "p1",
      "a",
      { status: "in_progress" },
      { now: 4_000 },
    );
    expect(after.nodes[0].status).toBe("in_progress");
    expect(after.nodes[0].percent).toBeGreaterThan(0);
    expect(after.nodes[0].percent).toBeLessThan(100);
  });
});

// ===========================================================================
// I-WBv1a-4 — depends_on is a DAG: self/dangling/cycle rejected
// ===========================================================================
describe("I-WBv1a-4 (DAG)", () => {
  it("a valid dependency chain is accepted", () => {
    const p = createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", title: "A" },
          { id: "b", title: "B", depends_on: ["a"] },
          { id: "c", title: "C", depends_on: ["b"] },
        ],
      },
      OPTS(),
    );
    expect(p.nodes.find((n) => n.id === "c")?.depends_on).toEqual(["b"]);
  });

  it("a self-dependency is rejected", () => {
    expect(() =>
      createProject(
        db,
        {
          id: "p1",
          title: "T",
          goal: "G",
          nodes: [{ id: "a", title: "A", depends_on: ["a"] }],
        },
        OPTS(),
      ),
    ).toThrowError(/cannot depend on itself/i);
  });

  it("a dependency on an unknown node is rejected", () => {
    expect(() =>
      createProject(
        db,
        {
          id: "p1",
          title: "T",
          goal: "G",
          nodes: [{ id: "a", title: "A", depends_on: ["ghost"] }],
        },
        OPTS(),
      ),
    ).toThrowError(/unknown node/i);
  });

  it("a cycle is rejected at create and on an update that would close one", () => {
    expect(() =>
      createProject(
        db,
        {
          id: "p1",
          title: "T",
          goal: "G",
          nodes: [
            { id: "a", title: "A", depends_on: ["b"] },
            { id: "b", title: "B", depends_on: ["a"] },
          ],
        },
        OPTS(),
      ),
    ).toThrowError(/cycle/i);

    createProject(
      db,
      {
        id: "p2",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", title: "A" },
          { id: "b", title: "B", depends_on: ["a"] },
        ],
      },
      OPTS(),
    );
    // a -> b already; making a depend on b closes a cycle
    let threw: unknown;
    try {
      updateNode(db, "p2", "a", { depends_on: ["b"] }, { now: 2_000 });
    } catch (error) {
      threw = error;
    }
    expect(threw).toBeInstanceOf(WorkflowBoxError);
    expect((threw as WorkflowBoxError).code).toBe("dependency_cycle");
    // the rejected update did not persist
    expect(
      getProject(db, "p2")?.nodes.find((n) => n.id === "a")?.depends_on,
    ).toEqual([]);
  });

  it("removing a node strips it from other nodes' depends_on", () => {
    createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", title: "A" },
          { id: "b", title: "B", depends_on: ["a"] },
        ],
      },
      OPTS(),
    );
    const after = removeNode(db, "p1", "a", { now: 2_000 });
    expect(after.nodes.map((n) => n.id)).toEqual(["b"]);
    expect(after.nodes[0].depends_on).toEqual([]);
  });
});

// ===========================================================================
// I-WBv1a-5 — persistence survives a simulated restart (re-open the file db)
// ===========================================================================
describe("I-WBv1a-5 (persistence)", () => {
  it("a project + nodes (layout, deps, percents) survive a reconnect", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflowbox-"));
    const file = join(dir, "wb.db");
    try {
      const first = new Database(file);
      applyMigrations(first);
      const created = createProject(
        first,
        {
          id: "p1",
          title: "Persisted",
          goal: "Survive restart",
          nodes: [
            { id: "a", title: "A", percent: 100, layout: { x: 10, y: 20 } },
            {
              id: "b",
              title: "B",
              percent: 40,
              depends_on: ["a"],
              layout: { x: 200, y: 20 },
            },
          ],
        },
        { now: 5_000, newId: () => "x" },
      );
      first.close();

      const reopened = new Database(file);
      applyMigrations(reopened); // idempotent
      const reread = getProject(reopened, "p1");
      reopened.close();

      expect(reread).toEqual<Project>(created);
      expect(reread?.rollup_percent).toBe(70); // round((100+40)/2)
      expect(reread?.nodes.find((n) => n.id === "b")?.depends_on).toEqual([
        "a",
      ]);
      expect(reread?.nodes.find((n) => n.id === "b")?.layout).toEqual({
        x: 200,
        y: 20,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// I-WBv1a-7 — no self-execution / the amber door (type seam, not wired)
// ===========================================================================
describe("I-WBv1a-7 (no self-execution / amber door)", () => {
  it("all created nodes are effect_class 'display'", () => {
    const p = createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
        ],
      },
      OPTS(),
    );
    expect(p.nodes.every((n) => n.effect_class === "display")).toBe(true);
  });

  it("a 'side_effecting' node is REFUSED in v1 (the seam is declared, not wired)", () => {
    let threw: unknown;
    try {
      createProject(
        db,
        {
          id: "p1",
          title: "T",
          goal: "G",
          nodes: [{ id: "a", title: "A", effect_class: "side_effecting" }],
        },
        OPTS(),
      );
    } catch (error) {
      threw = error;
    }
    expect(threw).toBeInstanceOf(WorkflowBoxError);
    expect((threw as WorkflowBoxError).code).toBe("side_effecting_not_wired");
    expect(getProject(db, "p1")).toBeNull(); // nothing persisted
  });

  it("the workflowbox source has NO path to runtime.runTool or any mutator", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");
    const offenders: string[] = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const code = stripComments(readFileSync(resolve(dir, name), "utf8"));
      if (/\.runTool\s*\(/.test(code)) offenders.push(`${name}: runTool`);
      const froms = [...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
        (m) => m[1],
      );
      for (const f of froms) {
        if (
          /tools\/runtime|mcp-gateway|approval-runtime|chat\/tool-approvals|lib\/router/.test(
            f,
          )
        ) {
          offenders.push(`${name} -> ${f}`);
        }
      }
    }
    expect(
      offenders,
      `mutator path in workflowbox: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

// ===========================================================================
// I-WBv1a-8 — clean SUBSET of the EB WorkflowBox primitive (no org-scale fields)
// ===========================================================================
describe("I-WBv1a-8 (primitive subset)", () => {
  it("the Project + WorkNode shapes carry ONLY the documented subset keys", () => {
    const p = createProject(
      db,
      {
        id: "p1",
        title: "T",
        goal: "G",
        nodes: [{ id: "a", title: "A", detail: "do it" }],
      },
      OPTS(),
    );
    expect(Object.keys(p).sort()).toEqual(
      [
        "created_at",
        "goal",
        "id",
        "nodes",
        "rollup_percent",
        "title",
        "updated_at",
      ].sort(),
    );
    expect(Object.keys(p.nodes[0]).sort()).toEqual(
      [
        "depends_on",
        "detail",
        "effect_class",
        "id",
        "layout",
        "percent",
        "status",
        "title",
      ].sort(),
    );
    // no org-scale machinery leaked into the personal subset
    const blob = JSON.stringify(p);
    for (const orgField of [
      "permission",
      "brm",
      "scope_filter",
      "compiled_scope",
      "actor",
      "trust_class",
    ]) {
      expect(blob.toLowerCase()).not.toContain(orgField);
    }
  });
});

// ===========================================================================
// supporting: not-found + removeProject
// ===========================================================================
describe("supporting behavior", () => {
  it("mutating a missing project/node throws a typed error; removeProject deletes", () => {
    expect(() => addNode(db, "nope", { title: "X" }, OPTS())).toThrowError(
      WorkflowBoxError,
    );
    createProject(
      db,
      { id: "p1", title: "T", goal: "G", nodes: [{ id: "a", title: "A" }] },
      OPTS(),
    );
    expect(() =>
      updateNode(db, "p1", "ghost", { percent: 1 }, { now: 2 }),
    ).toThrowError(/no node/i);
    removeProject(db, "p1");
    expect(getProject(db, "p1")).toBeNull();
  });
});
