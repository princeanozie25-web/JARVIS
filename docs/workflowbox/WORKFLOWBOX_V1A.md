# WorkflowBox v1a — Project model + persistence + materialization

**Date:** 2026-06-17. **Scope:** `src/lib/workflowbox/` + the additive
`workflow_projects` / `workflow_nodes` SQLite tables. **No UI** (the lane-list +
mind-map views, with mark/drag/edit from either, are v1b).

A **Project** is JARVIS's personal-scale unit of work: a goal plus a graph of
work-nodes, each tracking its own progress, rolling up to a project percent.
The user and JARVIS talk an idea through; on the user's trigger ("open a project
for this") the conversation **materializes** into a draft Project the user then
refines.

---

## 1. The model

```
Project   { id, title, goal, created_at, updated_at, nodes: WorkNode[], rollup_percent* }
WorkNode  { id, title, detail?, status, percent, depends_on: nodeId[], layout {x,y}, effect_class }
```

`* rollup_percent` is **DERIVED** (see the rollup rule) — it is **not** a stored
column and there is no API to set it.

### The rollup rule (I-WBv1a-2)

`rollup_percent = round(mean(node.percent))`, or `0` when there are no nodes.
Recomputed on every read and after every mutation. (A weighting scheme is a
later refinement; the mean is the clear v1 rule.)

### The status<->percent rule (I-WBv1a-3)

`percent` (0..100) is **canonical**; `status` is a pure function of it:

| percent  | status        |
| -------- | ------------- |
| `<= 0`   | `todo`        |
| `1..99`  | `in_progress` |
| `>= 100` | `done`        |

Marking by **status** maps to a canonical percent: `done -> 100`, `todo -> 0`,
`in_progress ->` the current in-range percent (or `50` if currently at a
boundary). The two are therefore **always** consistent, whichever the user marks.

### The DAG rule (I-WBv1a-4)

`depends_on` (this node is _blocked_by_ these) forms a DAG. The store rejects a
self-dependency, a dependency on an unknown node, and any cycle (DFS detection),
re-validating the whole graph on every create/add/update. Removing a node strips
it from every other node's `depends_on`.

---

## 2. Persistence — the single source of truth (I-WBv1a-1, -5)

SQLite is the structured, authoritative source of truth (`workflow_projects` +
`workflow_nodes`, added to `SCHEMA_SQL` — idempotent `CREATE TABLE IF NOT
EXISTS`, **no new migration id**, so the pinned migration list 001..018 is
unchanged). A created project + its nodes (layout, deps, percents) survive a
reconnect.

**One mutation surface.** Every change goes through the `store.ts` API —
`createProject`, `getProject`, `listProjects`, `addNode`, `updateNode`,
`removeNode`, `removeProject`. Both future views (lane list + mind-map) write
through this same path, so "mark from either, one project" is guaranteed
structurally: there is no second mutation surface and no second authoritative
copy. Reading a project after a mutation reflects it.

**Obsidian mirror — DEFERRED (not forced).** The brief allowed a human-readable
Obsidian project-page mirror _if it fit the existing pattern_. It does not: the
`src/lib/obsidian/` integration is LLM-wiki / knowledge-compounding page
generation (a different concept), and writing a page is a file-system side
effect inappropriate for a side-effect-free model slice. SQLite is the sole
authoritative copy; a WorkflowBox -> Obsidian mirror can be a later additive
_view_. Skipped this slice, reported.

---

## 3. Materialization — conversation -> DRAFT (I-WBv1a-6)

`materializeProjectFromConversation({ conversation, decompose, options })` takes
the conversation context + an **injected** decomposer (a model call in
production; a stub in tests) and returns a **DraftProject** — a goal + a draft
graph of work-nodes (all `todo` / `0%` / `display`, deps wired from the
decomposer's local keys, cyclic draft edges dropped to stay a DAG, layout
auto-assigned by dependency depth).

It **PROPOSES, it does not commit or execute**:

- it takes **no db handle** — it physically cannot persist; the returned draft
  is in-memory until the user's trigger commits it via `createProject`
  (`draftToCreateInput` carries the refined draft straight in). Nothing
  self-creates as authoritative.
- it takes **no runtime / mutator** — it cannot execute a step; it only shapes
  data.

---

## 4. The amber door (I-WBv1a-7) — a type seam, not wired

`effect_class` is `"display"` for every v1 node: nodes are shown and their
progress is marked by the **user**; a node never executes work. The type
reserves `"side_effecting"` for a **future** node that AI actually performs —
which, when built, will route through the existing **Human Gate** (Phase 18),
exactly like every other JARVIS mutation (`runtime.runTool` remains the sole,
gated executor). This slice does **not** wire execution:

- the `workflowbox/` module has **no** path to `runtime.runTool` or any governed
  mutator (asserted by a source scan — it imports only the better-sqlite3 type +
  its own pure rules; it persists planning state like sessions/goals/preferences,
  it does not execute tool work);
- the store **refuses** to persist a `side_effecting` node in v1
  (`side_effecting_not_wired`).

---

## 5. One primitive, two scales — the EB subset mapping (I-WBv1a-8)

The JARVIS `Project`/`WorkNode` is a clean **subset** of the Enterprise-Brain
`WorkflowBox` primitive (a goal + a graph of work-nodes), **not** a divergent
bespoke object. The personal scale keeps the shared shape and **drops** the
org-scale machinery:

| Enterprise-Brain WorkflowBox (org scale) | JARVIS Project (personal scale)                    |
| ---------------------------------------- | -------------------------------------------------- |
| Box = goal + graph of work-nodes         | **same** (Project + WorkNode[])                    |
| node: title/status/progress/deps/layout  | **same** (WorkNode)                                |
| derived rollup                           | **same** (`rollup_percent`)                        |
| permission compiler / compiled scope     | **dropped** (own machine, own work)                |
| BRM / trust root                         | **dropped**                                        |
| scope-filtering / per-actor visibility   | **dropped** (single user)                          |
| org-graph / multi-actor assignment       | **dropped**                                        |
| side-effecting boxes (gated execution)   | **reserved** as the `effect_class` seam, not wired |

The shapes carry only the documented subset keys (asserted: no
`permission`/`brm`/`scope`/`actor`/`trust_class` fields leak into the personal
model). EB inherits the org-scale superset later; JARVIS ships the simpler
subset now.

---

## 6. Invariants (asserted)

I-WBv1a-1 single source of truth · -2 rollup derived · -3 status/percent ·
-4 DAG · -5 persistence survives restart · -6 materialization drafts (proposes,
never executes) · -7 no self-execution / amber-door seam · -8 EB-primitive
subset. Tests: `store.test.ts`, `materialize.test.ts`.
