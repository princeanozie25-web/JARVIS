// WorkflowBox v1a — the SINGLE model API (the one mutation surface).
//
// Every project/node mutation goes through THIS module (I-WBv1a-1): both future
// views (the lane list and the mind-map in v1b) write through the same path, so
// "mark from either, one project" is guaranteed structurally — there is no second
// mutation surface and no second authoritative copy. SQLite is the structured
// source of truth; rollup_percent is DERIVED on read, never stored.
//
// This module imports ONLY the better-sqlite3 TYPE + the pure model rules. It has
// NO path to runtime.runTool or any governed mutator (I-WBv1a-7): it persists the
// user's own planning state (like sessions/goals/preferences), it does not execute
// tool work. A "side_effecting" node (the amber door) is REFUSED in v1 — declared
// in the type, not wired here.

import type DatabaseType from "better-sqlite3";

import {
  binaryDoneFromProgress,
  clampPercent,
  computeNodePercent,
  computeRollupPercent,
  statusFromPercent,
  type CreateProjectInput,
  type EffectClass,
  type NodeLayout,
  type Project,
  type SubItem,
  type SubItemInput,
  type UpdateNodeInput,
  type UpdateSubItemInput,
  type WorkNode,
  type WorkNodeInput,
} from "./types";

export type WorkflowBoxErrorCode =
  | "project_not_found"
  | "node_not_found"
  | "duplicate_node_id"
  | "self_dependency"
  | "unknown_dependency"
  | "dependency_cycle"
  | "side_effecting_not_wired"
  | "sub_item_not_found"
  | "duplicate_sub_item_id";

export class WorkflowBoxError extends Error {
  constructor(
    readonly code: WorkflowBoxErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowBoxError";
  }
}

export interface WorkflowBoxOptions {
  now?: number;
  newId?: () => string;
}

function resolveOpts(opts: WorkflowBoxOptions = {}): {
  now: number;
  newId: () => string;
} {
  return {
    now: opts.now ?? Date.now(),
    newId: opts.newId ?? (() => globalThis.crypto.randomUUID()),
  };
}

// --- row types + mapping -----------------------------------------------------

interface ProjectRow {
  id: string;
  title: string;
  goal: string;
  created_at: number;
  updated_at: number;
}

interface NodeRow {
  id: string;
  project_id: string;
  title: string;
  detail: string | null;
  status: string;
  percent: number;
  depends_on_json: string;
  layout_x: number;
  layout_y: number;
  effect_class: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

interface SubItemRow {
  id: string;
  node_id: string;
  title: string;
  done: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

function parseDependsOn(json: string): string[] {
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function mapSubItemRow(row: SubItemRow): SubItem {
  return { id: row.id, title: row.title, done: row.done === 1 };
}

function readSubItemRows(db: DatabaseType.Database, nodeId: string): SubItem[] {
  return (
    db
      .prepare(
        "SELECT * FROM workflow_sub_items WHERE node_id = ? ORDER BY sort_order ASC, created_at ASC",
      )
      .all(nodeId) as SubItemRow[]
  ).map(mapSubItemRow);
}

/** Map a node row + its sub-items into a WorkNode with a DERIVED percent
 * (I-WBv1b-1/-2): the sub-item done-ratio when there are sub-items, else the
 * BINARY stored mark (>=100 ⇒ done). status follows percent — always consistent,
 * even if the cached percent column drifted. */
function mapNodeRow(row: NodeRow, subItems: SubItem[]): WorkNode {
  const percent = computeNodePercent(
    subItems,
    clampPercent(row.percent) >= 100,
  );
  return {
    id: row.id,
    title: row.title,
    detail: row.detail ?? null,
    status: statusFromPercent(percent),
    percent,
    depends_on: parseDependsOn(row.depends_on_json),
    layout: { x: row.layout_x, y: row.layout_y },
    effect_class:
      row.effect_class === "side_effecting" ? "side_effecting" : "display",
    sub_items: subItems,
  };
}

/** Read a single node (with sub-items + derived percent), or undefined. */
function readNode(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
): WorkNode | undefined {
  const row = db
    .prepare("SELECT * FROM workflow_nodes WHERE id = ? AND project_id = ?")
    .get(nodeId, projectId) as NodeRow | undefined;
  if (!row) return undefined;
  return mapNodeRow(row, readSubItemRows(db, nodeId));
}

function readProjectRow(
  db: DatabaseType.Database,
  id: string,
): ProjectRow | undefined {
  return db.prepare("SELECT * FROM workflow_projects WHERE id = ?").get(id) as
    | ProjectRow
    | undefined;
}

function readNodeRows(db: DatabaseType.Database, projectId: string): NodeRow[] {
  return db
    .prepare(
      "SELECT * FROM workflow_nodes WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .all(projectId) as NodeRow[];
}

/** All nodes of a project (each with its sub-items + derived percent). */
function assembleNodes(
  db: DatabaseType.Database,
  projectId: string,
): WorkNode[] {
  return readNodeRows(db, projectId).map((row) =>
    mapNodeRow(row, readSubItemRows(db, row.id)),
  );
}

/** Assemble the full Project (nodes + DERIVED rollup) — the canonical read. */
function assembleProject(
  db: DatabaseType.Database,
  id: string,
): Project | null {
  const projectRow = readProjectRow(db, id);
  if (!projectRow) return null;
  const nodes = assembleNodes(db, id);
  return {
    id: projectRow.id,
    title: projectRow.title,
    goal: projectRow.goal,
    created_at: projectRow.created_at,
    updated_at: projectRow.updated_at,
    nodes,
    rollup_percent: computeRollupPercent(nodes),
  };
}

// --- validation (DAG + self + dangling + amber door) -------------------------

function normalizeSubItems(
  specs: ReadonlyArray<SubItemInput> | undefined,
  newId: () => string,
): SubItem[] {
  const items = (specs ?? []).map((spec) => ({
    id: spec.id ?? newId(),
    title: spec.title,
    done: spec.done ?? false,
  }));
  assertUniqueSubItemIds(items);
  return items;
}

function normalizeNodeInput(
  spec: WorkNodeInput,
  newId: () => string,
): WorkNode {
  if (spec.effect_class === "side_effecting") {
    throw new WorkflowBoxError(
      "side_effecting_not_wired",
      "A side_effecting node (the amber door) is not wired in v1 — when built it routes through the Human Gate; nodes are display + user-tracked.",
    );
  }
  const sub_items = normalizeSubItems(spec.sub_items, newId);
  // percent is DERIVED (I-WBv1b-1/-2): the sub-item ratio when present, else the
  // BINARY mark from the (percent|status) signal. Never authored as a free number.
  const binaryDone = binaryDoneFromProgress(
    { percent: spec.percent, status: spec.status },
    false,
  );
  const percent = computeNodePercent(sub_items, binaryDone);
  const layout: NodeLayout = spec.layout ?? { x: 0, y: 0 };
  return {
    id: spec.id ?? newId(),
    title: spec.title,
    detail: spec.detail ?? null,
    status: statusFromPercent(percent),
    percent,
    depends_on: [...(spec.depends_on ?? [])],
    layout,
    effect_class: "display" as EffectClass,
    sub_items,
  };
}

/** Reject a self-dependency, a dependency on an unknown node, or a cycle. Runs
 * over the WHOLE post-mutation node set so the graph stays a DAG (I-WBv1a-4). */
function validateGraph(nodes: ReadonlyArray<WorkNode>): void {
  const ids = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    if (node.depends_on.includes(node.id)) {
      throw new WorkflowBoxError(
        "self_dependency",
        `Node ${node.id} cannot depend on itself.`,
      );
    }
    for (const dep of node.depends_on) {
      if (!ids.has(dep)) {
        throw new WorkflowBoxError(
          "unknown_dependency",
          `Node ${node.id} depends on unknown node ${dep}.`,
        );
      }
    }
  }
  const cycle = findDependencyCycle(nodes);
  if (cycle) {
    throw new WorkflowBoxError(
      "dependency_cycle",
      `Dependency cycle: ${cycle.join(" -> ")}.`,
    );
  }
}

/** DFS cycle detection over depends_on edges; returns a cycle path or null. */
export function findDependencyCycle(
  nodes: ReadonlyArray<{ id: string; depends_on: string[] }>,
): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, node.depends_on);
  const WHITE = 0,
    GREY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.id, WHITE);
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GREY);
    stack.push(id);
    for (const dep of adjacency.get(id) ?? []) {
      if (!color.has(dep)) continue; // unknown deps are caught separately
      if (color.get(dep) === GREY) {
        const from = stack.indexOf(dep);
        return [...stack.slice(from), dep];
      }
      if (color.get(dep) === WHITE) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}

// --- persistence helpers -----------------------------------------------------

function insertProjectRow(db: DatabaseType.Database, row: ProjectRow): void {
  db.prepare(
    `INSERT INTO workflow_projects (id, title, goal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.id, row.title, row.goal, row.created_at, row.updated_at);
}

function insertNodeRow(
  db: DatabaseType.Database,
  projectId: string,
  node: WorkNode,
  sortOrder: number,
  now: number,
): void {
  db.prepare(
    `INSERT INTO workflow_nodes (
       id, project_id, title, detail, status, percent, depends_on_json,
       layout_x, layout_y, effect_class, sort_order, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    node.id,
    projectId,
    node.title,
    node.detail,
    node.status,
    node.percent,
    JSON.stringify(node.depends_on),
    node.layout.x,
    node.layout.y,
    node.effect_class,
    sortOrder,
    now,
    now,
  );
  node.sub_items.forEach((item, index) =>
    insertSubItemRow(db, node.id, item, index, now),
  );
}

function insertSubItemRow(
  db: DatabaseType.Database,
  nodeId: string,
  item: SubItem,
  sortOrder: number,
  now: number,
): void {
  db.prepare(
    `INSERT INTO workflow_sub_items (
       id, node_id, title, done, sort_order, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(item.id, nodeId, item.title, item.done ? 1 : 0, sortOrder, now, now);
}

/** Recompute + persist a node's DERIVED percent/status from its CURRENT sub-items
 * (I-WBv1b-1). With sub-items: the done-ratio. With none left: reverts to not-done
 * (0) — an empty checklist tracks nothing as done. Keeps the cached percent/status
 * columns in step with the read-time derivation. */
function recomputeNodePercentFromSubItems(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  now: number,
): void {
  const subItems = readSubItemRows(db, nodeId);
  const percent = computeNodePercent(subItems, false);
  db.prepare(
    `UPDATE workflow_nodes
       SET percent = ?, status = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  ).run(percent, statusFromPercent(percent), now, nodeId, projectId);
}

function touchProject(
  db: DatabaseType.Database,
  id: string,
  now: number,
): void {
  db.prepare("UPDATE workflow_projects SET updated_at = ? WHERE id = ?").run(
    now,
    id,
  );
}

function requireProject(db: DatabaseType.Database, id: string): void {
  if (!readProjectRow(db, id)) {
    throw new WorkflowBoxError("project_not_found", `No project ${id}.`);
  }
}

// --- the single mutation API -------------------------------------------------

/** Create + persist a project (and any draft nodes). Validates the DAG, reconciles
 * progress, rejects side_effecting nodes, and returns the assembled Project. */
export function createProject(
  db: DatabaseType.Database,
  input: CreateProjectInput,
  options: WorkflowBoxOptions = {},
): Project {
  const { now, newId } = resolveOpts(options);
  const id = input.id ?? newId();
  const nodes = (input.nodes ?? []).map((spec) =>
    normalizeNodeInput(spec, newId),
  );
  assertUniqueIds(nodes);
  validateGraph(nodes);

  const persist = db.transaction(() => {
    insertProjectRow(db, {
      id,
      title: input.title,
      goal: input.goal,
      created_at: now,
      updated_at: now,
    });
    nodes.forEach((node, index) => insertNodeRow(db, id, node, index, now));
  });
  persist();
  return assembleProject(db, id) as Project;
}

/** Read one project (nodes + derived rollup), or null. */
export function getProject(
  db: DatabaseType.Database,
  id: string,
): Project | null {
  return assembleProject(db, id);
}

/** Read all projects (each assembled with nodes + derived rollup), newest first. */
export function listProjects(db: DatabaseType.Database): Project[] {
  const ids = db
    .prepare(
      "SELECT id FROM workflow_projects ORDER BY updated_at DESC, created_at DESC",
    )
    .all() as Array<{ id: string }>;
  return ids
    .map((row) => assembleProject(db, row.id))
    .filter((project): project is Project => project !== null);
}

/** Add a node to an existing project. Validates the post-add DAG. */
export function addNode(
  db: DatabaseType.Database,
  projectId: string,
  spec: WorkNodeInput,
  options: WorkflowBoxOptions = {},
): Project {
  const { now, newId } = resolveOpts(options);
  requireProject(db, projectId);
  const existing = assembleNodes(db, projectId);
  const node = normalizeNodeInput(spec, newId);
  if (existing.some((n) => n.id === node.id)) {
    throw new WorkflowBoxError(
      "duplicate_node_id",
      `Node ${node.id} already exists in project ${projectId}.`,
    );
  }
  validateGraph([...existing, node]);

  const persist = db.transaction(() => {
    insertNodeRow(db, projectId, node, existing.length, now);
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Update a node (title/detail/depends_on/layout, and — for a NO-SUB-ITEM node
 * only — its binary done mark). The DAG is re-validated.
 *
 * percent is DERIVED, never settable directly:
 *   * a node WITH sub-items IGNORES any percent/status in the patch (I-WBv1b-1) —
 *     its percent is the checklist ratio; mark it via the sub-item methods.
 *   * a node with NO sub-items is BINARY (I-WBv1b-2): a `done` status/`>=100`
 *     percent marks it done; anything else (incl. `in_progress`) is not-done. */
export function updateNode(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  patch: UpdateNodeInput,
  options: WorkflowBoxOptions = {},
): Project {
  const { now } = resolveOpts(options);
  requireProject(db, projectId);
  const existing = assembleNodes(db, projectId);
  const target = existing.find((n) => n.id === nodeId);
  if (!target) {
    throw new WorkflowBoxError(
      "node_not_found",
      `No node ${nodeId} in project ${projectId}.`,
    );
  }

  let percent = target.percent;
  if (target.sub_items.length === 0) {
    // binary mark only when no checklist drives the node
    const binaryDone = binaryDoneFromProgress(
      { percent: patch.percent, status: patch.status },
      clampPercent(target.percent) >= 100,
    );
    percent = computeNodePercent([], binaryDone);
  }
  // a sub-item node keeps its derived ratio regardless of any percent/status patch

  const updated: WorkNode = {
    ...target,
    title: patch.title ?? target.title,
    detail: patch.detail !== undefined ? patch.detail : target.detail,
    percent,
    status: statusFromPercent(percent),
    depends_on:
      patch.depends_on !== undefined
        ? [...patch.depends_on]
        : target.depends_on,
    layout: patch.layout ?? target.layout,
  };

  const nextNodes = existing.map((n) => (n.id === nodeId ? updated : n));
  validateGraph(nextNodes);

  const persist = db.transaction(() => {
    db.prepare(
      `UPDATE workflow_nodes
         SET title = ?, detail = ?, status = ?, percent = ?, depends_on_json = ?,
             layout_x = ?, layout_y = ?, updated_at = ?
       WHERE id = ? AND project_id = ?`,
    ).run(
      updated.title,
      updated.detail,
      updated.status,
      updated.percent,
      JSON.stringify(updated.depends_on),
      updated.layout.x,
      updated.layout.y,
      now,
      nodeId,
      projectId,
    );
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Remove a node, and strip it from every other node's depends_on (keeps the
 * graph valid). */
export function removeNode(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  options: WorkflowBoxOptions = {},
): Project {
  const { now } = resolveOpts(options);
  requireProject(db, projectId);
  const existing = assembleNodes(db, projectId);
  if (!existing.some((n) => n.id === nodeId)) {
    throw new WorkflowBoxError(
      "node_not_found",
      `No node ${nodeId} in project ${projectId}.`,
    );
  }

  const persist = db.transaction(() => {
    // explicit child cleanup (the workflowbox harness does not enable FK cascade)
    db.prepare("DELETE FROM workflow_sub_items WHERE node_id = ?").run(nodeId);
    db.prepare(
      "DELETE FROM workflow_nodes WHERE id = ? AND project_id = ?",
    ).run(nodeId, projectId);
    for (const node of existing) {
      if (node.id === nodeId) continue;
      if (node.depends_on.includes(nodeId)) {
        const pruned = node.depends_on.filter((d) => d !== nodeId);
        db.prepare(
          "UPDATE workflow_nodes SET depends_on_json = ?, updated_at = ? WHERE id = ? AND project_id = ?",
        ).run(JSON.stringify(pruned), now, node.id, projectId);
      }
    }
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Delete a project and all its nodes (and their sub-items). */
export function removeProject(db: DatabaseType.Database, id: string): void {
  const persist = db.transaction(() => {
    db.prepare(
      `DELETE FROM workflow_sub_items
        WHERE node_id IN (SELECT id FROM workflow_nodes WHERE project_id = ?)`,
    ).run(id);
    db.prepare("DELETE FROM workflow_nodes WHERE project_id = ?").run(id);
    db.prepare("DELETE FROM workflow_projects WHERE id = ?").run(id);
  });
  persist();
}

// --- the single mutation API: sub-items (v1b) --------------------------------
//
// Every sub-item change goes through THIS module too (I-WBv1b-4) — the same one
// mutation surface as nodes/projects. Each persists the checklist change, then
// recomputes + persists the node's DERIVED percent, then touches the project, so a
// subsequent read reflects the new node percent AND the new project rollup
// (I-WBv1b-3). No second mutation surface; no execution path (effect_class stays
// "display").

function requireNode(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
): WorkNode {
  requireProject(db, projectId);
  const node = readNode(db, projectId, nodeId);
  if (!node) {
    throw new WorkflowBoxError(
      "node_not_found",
      `No node ${nodeId} in project ${projectId}.`,
    );
  }
  return node;
}

function nextSubItemSortOrder(
  db: DatabaseType.Database,
  nodeId: string,
): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM workflow_sub_items WHERE node_id = ?",
    )
    .get(nodeId) as { max_order: number };
  return row.max_order + 1;
}

/** Add a sub-item to a node. Adding the first sub-item makes the node's percent
 * the checklist ratio (a previously binary-done node becomes 0% until items are
 * checked). Returns the assembled project with recomputed percents. */
export function addSubItem(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  spec: SubItemInput,
  options: WorkflowBoxOptions = {},
): Project {
  const { now, newId } = resolveOpts(options);
  requireNode(db, projectId, nodeId);
  const item: SubItem = {
    id: spec.id ?? newId(),
    title: spec.title,
    done: spec.done ?? false,
  };
  if (
    db.prepare("SELECT 1 FROM workflow_sub_items WHERE id = ?").get(item.id) !==
    undefined
  ) {
    throw new WorkflowBoxError(
      "duplicate_sub_item_id",
      `Sub-item ${item.id} already exists.`,
    );
  }
  const persist = db.transaction(() => {
    insertSubItemRow(db, nodeId, item, nextSubItemSortOrder(db, nodeId), now);
    recomputeNodePercentFromSubItems(db, projectId, nodeId, now);
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Toggle a sub-item's done flag and recompute the node's derived percent. */
export function toggleSubItem(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  subItemId: string,
  options: WorkflowBoxOptions = {},
): Project {
  const { now } = resolveOpts(options);
  const node = requireNode(db, projectId, nodeId);
  const current = node.sub_items.find((item) => item.id === subItemId);
  if (!current) {
    throw new WorkflowBoxError(
      "sub_item_not_found",
      `No sub-item ${subItemId} on node ${nodeId}.`,
    );
  }
  const persist = db.transaction(() => {
    db.prepare(
      "UPDATE workflow_sub_items SET done = ?, updated_at = ? WHERE id = ? AND node_id = ?",
    ).run(current.done ? 0 : 1, now, subItemId, nodeId);
    recomputeNodePercentFromSubItems(db, projectId, nodeId, now);
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Patch a sub-item (title and/or done) and recompute the node's derived percent. */
export function updateSubItem(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  subItemId: string,
  patch: UpdateSubItemInput,
  options: WorkflowBoxOptions = {},
): Project {
  const { now } = resolveOpts(options);
  const node = requireNode(db, projectId, nodeId);
  const current = node.sub_items.find((item) => item.id === subItemId);
  if (!current) {
    throw new WorkflowBoxError(
      "sub_item_not_found",
      `No sub-item ${subItemId} on node ${nodeId}.`,
    );
  }
  const title = patch.title ?? current.title;
  const done = patch.done ?? current.done;
  const persist = db.transaction(() => {
    db.prepare(
      "UPDATE workflow_sub_items SET title = ?, done = ?, updated_at = ? WHERE id = ? AND node_id = ?",
    ).run(title, done ? 1 : 0, now, subItemId, nodeId);
    recomputeNodePercentFromSubItems(db, projectId, nodeId, now);
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

/** Remove a sub-item and recompute the node's derived percent. Removing the last
 * sub-item reverts the node to not-done (0) — an empty checklist tracks nothing. */
export function removeSubItem(
  db: DatabaseType.Database,
  projectId: string,
  nodeId: string,
  subItemId: string,
  options: WorkflowBoxOptions = {},
): Project {
  const { now } = resolveOpts(options);
  const node = requireNode(db, projectId, nodeId);
  if (!node.sub_items.some((item) => item.id === subItemId)) {
    throw new WorkflowBoxError(
      "sub_item_not_found",
      `No sub-item ${subItemId} on node ${nodeId}.`,
    );
  }
  const persist = db.transaction(() => {
    db.prepare(
      "DELETE FROM workflow_sub_items WHERE id = ? AND node_id = ?",
    ).run(subItemId, nodeId);
    recomputeNodePercentFromSubItems(db, projectId, nodeId, now);
    touchProject(db, projectId, now);
  });
  persist();
  return assembleProject(db, projectId) as Project;
}

function assertUniqueIds(nodes: ReadonlyArray<WorkNode>): void {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new WorkflowBoxError(
        "duplicate_node_id",
        `Duplicate node id ${node.id}.`,
      );
    }
    seen.add(node.id);
  }
}

function assertUniqueSubItemIds(items: ReadonlyArray<SubItem>): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new WorkflowBoxError(
        "duplicate_sub_item_id",
        `Duplicate sub-item id ${item.id}.`,
      );
    }
    seen.add(item.id);
  }
}
