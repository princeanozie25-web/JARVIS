// WorkflowBox v1a — conversation -> DRAFT project materialization.
//
// THE USE CASE: the user and JARVIS talk through an idea; on the user's explicit
// trigger ("open a project for this") this turns the discussion into a DRAFT
// Project — a goal + a draft graph of work-nodes — that the user then refines
// (rename/reorder/re-split) in v1b before/while it lives.
//
// IT PROPOSES, IT DOES NOT COMMIT OR EXECUTE (I-WBv1a-6, I-WBv1a-7):
//   * NO db handle — this function CANNOT persist. The returned DraftProject is
//     in-memory; the user's trigger commits it via store.createProject. Nothing
//     self-creates as authoritative.
//   * NO runtime / mutator — this function CANNOT execute a step. It only shapes
//     data. All draft nodes are todo / 0% / display.
//   * The decomposition itself is INJECTED (a model call in production, a stub in
//     tests) — materialization owns the SHAPE, not the model.

import {
  computeRollupPercent,
  statusFromPercent,
  type ConversationContext,
  type Decomposer,
  type DraftProject,
  type Project,
  type WorkNode,
} from "./types";

export interface MaterializeOptions {
  now?: number;
  newId?: () => string;
}

interface RawNode {
  id: string;
  title: string;
  detail: string | null;
  depends_on: string[];
}

/** Can `start` reach `target` by following depends_on edges in `adjacency`? */
function canReach(
  start: string,
  target: string,
  adjacency: ReadonlyMap<string, string[]>,
): boolean {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }
  return false;
}

/** Greedily keep only dependency edges that preserve a DAG — a draft must be
 * acyclic (the store would reject a cycle). An edge n -> dep is dropped if `dep`
 * can already reach `n`. */
function keepAcyclicEdges(nodes: RawNode[]): RawNode[] {
  const kept = new Map<string, string[]>();
  for (const node of nodes) kept.set(node.id, []);
  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!kept.has(dep) || dep === node.id) continue;
      if (canReach(dep, node.id, kept)) continue; // would close a cycle — drop it
      kept.get(node.id)?.push(dep);
    }
  }
  return nodes.map((node) => ({
    ...node,
    depends_on: kept.get(node.id) ?? [],
  }));
}

/** Longest dependency chain to each node (roots = 0) — drives the column layout. */
function computeDepths(nodes: RawNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  function compute(id: string): number {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // defensive — graph is already acyclic
    visiting.add(id);
    const node = byId.get(id);
    let max = 0;
    for (const dep of node?.depends_on ?? []) {
      max = Math.max(max, compute(dep) + 1);
    }
    visiting.delete(id);
    depth.set(id, max);
    return max;
  }
  for (const node of nodes) compute(node.id);
  return depth;
}

function deriveTitle(goal: string): string {
  const firstLine = goal.split(/[\n.!?]/)[0]?.trim() ?? "";
  if (firstLine.length === 0) return "Untitled project";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

/**
 * Materialize a DRAFT project from conversation context. Invoked ONLY on the
 * user's explicit trigger ("open a project for this"); the act of calling it IS
 * the trigger. Returns an unpersisted DraftProject — the caller commits it via
 * store.createProject. Pure: no persistence, no execution.
 */
export function materializeProjectFromConversation(input: {
  conversation: ConversationContext;
  decompose: Decomposer;
  /** Optional explicit title; otherwise derived from the goal. */
  title?: string;
  options?: MaterializeOptions;
}): DraftProject {
  const now = input.options?.now ?? Date.now();
  const newId = input.options?.newId ?? (() => globalThis.crypto.randomUUID());

  const decomposed = input.decompose(input.conversation);
  const goal = decomposed.goal.trim();

  // give each draft node a stable id keyed by the decomposer's local handle
  const keyToId = new Map<string, string>();
  for (const spec of decomposed.nodes) {
    if (!keyToId.has(spec.key)) keyToId.set(spec.key, newId());
  }

  const rawNodes: RawNode[] = decomposed.nodes.map((spec) => {
    const id = keyToId.get(spec.key) as string;
    const deps = (spec.depends_on ?? [])
      .map((key) => keyToId.get(key))
      .filter((dep): dep is string => typeof dep === "string" && dep !== id);
    return {
      id,
      title: spec.title,
      detail: spec.detail ?? null,
      depends_on: Array.from(new Set(deps)),
    };
  });

  const acyclic = keepAcyclicEdges(rawNodes);
  const depths = computeDepths(acyclic);
  const columnCounters = new Map<number, number>();

  const nodes: WorkNode[] = acyclic.map((node) => {
    const depth = depths.get(node.id) ?? 0;
    const row = columnCounters.get(depth) ?? 0;
    columnCounters.set(depth, row + 1);
    return {
      id: node.id,
      title: node.title,
      detail: node.detail,
      percent: 0,
      status: statusFromPercent(0), // "todo" — a fresh draft does no work yet
      depends_on: node.depends_on,
      layout: { x: depth * 220, y: row * 120 },
      effect_class: "display", // amber door reserved in the type, not used here
    };
  });

  const project: Project = {
    id: newId(),
    title: input.title?.trim() || deriveTitle(goal),
    goal,
    created_at: now,
    updated_at: now,
    nodes,
    rollup_percent: computeRollupPercent(nodes), // 0 — all nodes are todo
  };

  return { draft: true, project };
}

/** Convenience: turn a draft's nodes into createProject inputs (ids + deps + layout
 * preserved), so the user's trigger commits exactly the refined draft. */
export function draftToCreateInput(draft: DraftProject): {
  id: string;
  title: string;
  goal: string;
  nodes: Array<{
    id: string;
    title: string;
    detail: string | null;
    percent: number;
    depends_on: string[];
    layout: { x: number; y: number };
  }>;
} {
  return {
    id: draft.project.id,
    title: draft.project.title,
    goal: draft.project.goal,
    nodes: draft.project.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      detail: node.detail,
      percent: node.percent,
      depends_on: node.depends_on,
      layout: node.layout,
    })),
  };
}
