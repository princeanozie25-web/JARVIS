// WorkflowBox v1a — the personal-scale project model (types + the documented rules).
//
// ONE PRIMITIVE, TWO SCALES. This Project/WorkNode is a CLEAN SUBSET of the
// Enterprise-Brain WorkflowBox primitive (a goal + a graph of work-nodes). The
// personal scale DROPS the org-scale machinery — no permission compiler, no BRM,
// no scope-filtering, no org-graph, no multi-actor: it is the user's own work on
// the user's own machine. EB inherits the org-scale superset later. The shared
// shape is { id, title, goal, nodes[] } + node { title, status, percent,
// depends_on, layout } + a DERIVED rollup. (docs/workflowbox/WORKFLOWBOX_V1A.md.)
//
// GATE-IS-ONLY-MUTATOR (type-level). A WorkNode is DISPLAY + user-tracked — it is
// shown and its progress is marked by the USER; it never executes work. The type
// reserves an amber-door seam (effect_class "side_effecting") for a FUTURE node
// that AI actually performs — which, WHEN built, routes through the existing
// Human Gate (Phase 18), exactly like every other JARVIS mutation. v1 does NOT
// wire execution: the model has no path from a WorkNode to any mutator, and the
// store refuses to persist a "side_effecting" node.

export type NodeStatus = "todo" | "in_progress" | "done";

/** The amber door. v1 only ever uses "display". "side_effecting" is RESERVED for
 * a future node performing work via the Human Gate — declared, not wired. */
export type EffectClass = "display" | "side_effecting";

export interface NodeLayout {
  x: number;
  y: number;
}

/** v1b — an optional checklist item under a WorkNode. The user toggles `done`;
 * the node's percent is DERIVED from the done-ratio (never hand-typed). */
export interface SubItem {
  id: string;
  title: string;
  done: boolean;
}

export interface WorkNode {
  id: string;
  title: string;
  /** The work this node represents (sub-steps as free text/list). */
  detail: string | null;
  status: NodeStatus;
  /** 0..100 per-node. v1b: DERIVED, never settable — the sub-item done-ratio when
   * the node has sub-items, else binary (done=100 / todo=0). status follows it. */
  percent: number;
  /** This node is blocked_by these node ids — a DAG (no cycles, no self-dep). */
  depends_on: string[];
  /** Position on the future map — owned by the user (v1b drag). */
  layout: NodeLayout;
  /** Always "display" in v1 (the amber-door seam; see EffectClass). */
  effect_class: EffectClass;
  /** v1b — optional checklist (additive; default []). When non-empty it DRIVES
   * `percent` (the done-ratio). When empty the node is binary (mark done/not-done). */
  sub_items: SubItem[];
}

export interface Project {
  id: string;
  title: string;
  goal: string;
  created_at: number;
  updated_at: number;
  nodes: WorkNode[];
  /** DERIVED from nodes (mean of node percents, rounded; 0 if none). NEVER
   * authored directly — recomputed on every read/mutation (I-WBv1a-2). */
  rollup_percent: number;
}

// --- the documented rules ----------------------------------------------------

/** STATUS<->PERCENT RULE (I-WBv1a-3): percent is canonical; status is a pure
 * function of it. percent<=0 => "todo"; percent>=100 => "done"; else
 * "in_progress" (done=100, 0=todo, 1..99=in_progress). */
export function statusFromPercent(percent: number): NodeStatus {
  if (percent <= 0) return "todo";
  if (percent >= 100) return "done";
  return "in_progress";
}

/** Coerce any number into an integer 0..100 (non-finite => 0). */
export function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

/**
 * Reconcile a progress update (percent and/or status) into a CONSISTENT pair.
 * percent wins when supplied; a status-only update maps to a canonical percent
 * (done=100, todo=0, in_progress keeps an in-range percent, or 50 at a boundary).
 * The returned status is ALWAYS statusFromPercent(percent) — never inconsistent.
 */
export function reconcileProgress(
  update: { percent?: number; status?: NodeStatus },
  currentPercent: number,
): { percent: number; status: NodeStatus } {
  let percent: number;
  if (update.percent !== undefined) {
    percent = clampPercent(update.percent);
  } else if (update.status !== undefined) {
    if (update.status === "done") percent = 100;
    else if (update.status === "todo") percent = 0;
    else {
      const current = clampPercent(currentPercent);
      percent = current > 0 && current < 100 ? current : 50;
    }
  } else {
    percent = clampPercent(currentPercent);
  }
  return { percent, status: statusFromPercent(percent) };
}

/** ROLLUP RULE (I-WBv1a-2): the project percent is the mean of its node percents,
 * rounded; 0 when there are no nodes. DERIVED — never stored or authored. */
export function computeRollupPercent(
  nodes: ReadonlyArray<{ percent: number }>,
): number {
  if (nodes.length === 0) return 0;
  const sum = nodes.reduce((acc, node) => acc + clampPercent(node.percent), 0);
  return Math.round(sum / nodes.length);
}

/**
 * DERIVED NODE-PERCENT RULE (v1b — I-WBv1b-1 / I-WBv1b-2). `node.percent` is
 * never hand-typed; it is computed:
 *
 *   * a node WITH sub-items → `round(done / total * 100)` (the checklist ratio).
 *     This is the ONLY way a node reaches a partial (in_progress) percent.
 *   * a node with NO sub-items → BINARY: `binaryDone ? 100 : 0` (done/todo). There
 *     is no in_progress without sub-items.
 *
 * The whole tree is derived: node percents roll up to `rollup_percent` (the mean),
 * so nothing in the model is authored as a number — the user only toggles done-ness.
 */
export function computeNodePercent(
  subItems: ReadonlyArray<{ done: boolean }>,
  binaryDone: boolean,
): number {
  if (subItems.length > 0) {
    const done = subItems.reduce((acc, item) => acc + (item.done ? 1 : 0), 0);
    return Math.round((done / subItems.length) * 100);
  }
  return binaryDone ? 100 : 0;
}

/**
 * The binary done-ness for a NO-SUB-ITEM node from a progress signal (I-WBv1b-2).
 * `status` wins when given (`done` ⇒ done; any other ⇒ not-done, so marking such a
 * node `in_progress` collapses to todo); else `percent >= 100` ⇒ done; else the
 * node keeps its current done-ness. Sub-item nodes ignore this (ratio-derived).
 */
export function binaryDoneFromProgress(
  signal: { percent?: number; status?: NodeStatus },
  currentDone: boolean,
): boolean {
  if (signal.status !== undefined) return signal.status === "done";
  if (signal.percent !== undefined) return clampPercent(signal.percent) >= 100;
  return currentDone;
}

// --- inputs (the single mutation API's argument shapes) ----------------------

/** A sub-item to seed onto a node at create/add time (or from a committed draft).
 * `done` defaults false. `percent`/`status` on the parent node are ignored when
 * sub-items are present (the node percent is the derived ratio). */
export interface SubItemInput {
  id?: string;
  title: string;
  done?: boolean;
}

export interface WorkNodeInput {
  /** Reuse a draft/known id, or omit to generate one. */
  id?: string;
  title: string;
  detail?: string | null;
  /** Binary signal for a NO-SUB-ITEM node (>=100 ⇒ done). Ignored when `sub_items`
   * is non-empty — percent is then DERIVED from the checklist (I-WBv1b-1). */
  percent?: number;
  status?: NodeStatus;
  depends_on?: string[];
  layout?: NodeLayout;
  /** Defaults to "display". "side_effecting" is rejected in v1 (not wired). */
  effect_class?: EffectClass;
  /** v1b — optional checklist to seed (additive; default []). */
  sub_items?: SubItemInput[];
}

/** A patch for one sub-item (any subset). */
export interface UpdateSubItemInput {
  title?: string;
  done?: boolean;
}

export interface CreateProjectInput {
  id?: string;
  title: string;
  goal: string;
  nodes?: WorkNodeInput[];
}

/** A patch for an existing node. Any subset; progress is reconciled. */
export interface UpdateNodeInput {
  title?: string;
  detail?: string | null;
  percent?: number;
  status?: NodeStatus;
  depends_on?: string[];
  layout?: NodeLayout;
}

// --- materialization (conversation -> draft) types ---------------------------

/** A minimal read-only view of the conversation the user wants to act on. */
export interface ConversationContext {
  messages: ReadonlyArray<{ role: string; content: string }>;
}

/** A draft node the decomposer proposes; deps reference other drafts by `key`. */
export interface DraftNodeSpec {
  /** Local handle for dependency wiring — NOT the final node id. */
  key: string;
  title: string;
  detail?: string | null;
  /** keys of other draft nodes this one is blocked_by. */
  depends_on?: string[];
  /** v1b — the decomposer MAY also draft a checklist (all todo / not-done). The
   * user refines (add/edit/remove) before/while the draft lives. Just titles. */
  sub_items?: string[];
}

/** The injected decomposition (a model call in production; a stub in tests). It
 * PROPOSES a structure; it never persists or executes. */
export type Decomposer = (conversation: ConversationContext) => {
  goal: string;
  nodes: DraftNodeSpec[];
};

/** A materialized DRAFT: a Project-shaped object that is NOT yet persisted. The
 * user's trigger commits it (createProject); nothing self-creates (I-WBv1a-6). */
export interface DraftProject {
  draft: true;
  project: Project;
}
