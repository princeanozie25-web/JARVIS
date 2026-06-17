// WorkflowBox v1a — materialization invariant I-WBv1a-6 (conversation -> DRAFT):
// it drafts (goal + todo/0% nodes), PROPOSES (does not auto-commit/persist), and
// EXECUTES nothing. The amber door stays "display" for every draft node.

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyMigrations } from "../db/schema";
import {
  createProject,
  draftToCreateInput,
  getProject,
  listProjects,
  materializeProjectFromConversation,
  type ConversationContext,
  type Decomposer,
} from "./index";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});
afterEach(() => db.close());

const conversation: ConversationContext = {
  messages: [
    { role: "user", content: "I want to launch a small side project." },
    { role: "assistant", content: "Let's break it into steps." },
    { role: "user", content: "Open a project for this." },
  ],
};

const decompose: Decomposer = () => ({
  goal: "Launch the side project",
  nodes: [
    { key: "research", title: "Research the space" },
    { key: "build", title: "Build the MVP", depends_on: ["research"] },
    { key: "ship", title: "Ship it", depends_on: ["build"] },
  ],
});

const idGen = () => {
  let i = 0;
  return () => `id-${i++}`;
};

describe("I-WBv1a-6 (materialization drafts; proposes, never executes)", () => {
  it("turns conversation + the decomposer into a DRAFT project (goal + todo/0% nodes)", () => {
    const draft = materializeProjectFromConversation({
      conversation,
      decompose,
      options: { now: 7_000, newId: idGen() },
    });

    expect(draft.draft).toBe(true);
    expect(draft.project.goal).toBe("Launch the side project");
    expect(draft.project.title).toBe("Launch the side project"); // derived from goal
    expect(draft.project.nodes).toHaveLength(3);
    // every draft node is todo / 0% / display — a fresh plan that does no work yet
    for (const node of draft.project.nodes) {
      expect(node.status).toBe("todo");
      expect(node.percent).toBe(0);
      expect(node.effect_class).toBe("display");
    }
    expect(draft.project.rollup_percent).toBe(0);

    // dependencies are wired by the decomposer's local keys -> real node ids
    const build = draft.project.nodes.find((n) => n.title === "Build the MVP");
    const research = draft.project.nodes.find(
      (n) => n.title === "Research the space",
    );
    expect(build?.depends_on).toEqual([research?.id]);
  });

  it("auto-assigns a layout by dependency depth (the future map isn't all at 0,0)", () => {
    const draft = materializeProjectFromConversation({
      conversation,
      decompose,
      options: { now: 7_000, newId: idGen() },
    });
    const xByTitle = Object.fromEntries(
      draft.project.nodes.map((n) => [n.title, n.layout.x]),
    );
    expect(xByTitle["Research the space"]).toBe(0);
    expect(xByTitle["Build the MVP"]).toBe(220);
    expect(xByTitle["Ship it"]).toBe(440);
  });

  it("PROPOSES — it does not auto-commit; the db has no project until the user's trigger persists it", () => {
    const draft = materializeProjectFromConversation({
      conversation,
      decompose,
      options: { now: 7_000, newId: idGen() },
    });
    // nothing self-created: materialization took no db handle and persisted nothing
    expect(listProjects(db)).toEqual([]);

    // the user's trigger commits the (refined) draft through the ONE store API
    const committed = createProject(db, draftToCreateInput(draft), {
      now: 9_000,
    });
    expect(getProject(db, committed.id)).toEqual(committed);
    expect(listProjects(db).map((p) => p.id)).toEqual([committed.id]);
    expect(committed.goal).toBe("Launch the side project");
  });

  it("produces an ACYCLIC draft even if the decomposer proposes a cycle (the commit then succeeds)", () => {
    const cyclic: Decomposer = () => ({
      goal: "Cyclic plan",
      nodes: [
        { key: "a", title: "A", depends_on: ["b"] },
        { key: "b", title: "B", depends_on: ["a"] },
      ],
    });
    const draft = materializeProjectFromConversation({
      conversation,
      decompose: cyclic,
      options: { now: 7_000, newId: idGen() },
    });
    // one back-edge was dropped to keep the draft a DAG
    const totalEdges = draft.project.nodes.reduce(
      (acc, n) => acc + n.depends_on.length,
      0,
    );
    expect(totalEdges).toBe(1);
    // committing the acyclic draft does NOT throw (the store accepts a DAG)
    expect(() =>
      createProject(db, draftToCreateInput(draft), { now: 9_000 }),
    ).not.toThrow();
  });
});
