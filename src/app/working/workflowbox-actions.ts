"use server";

// E-019 — the WRITE half of the WorkflowBox wire: Next server actions, the
// app's minimal server-mutation transport (none existed before this slice —
// the cockpit was read-only SSR props). Each action is a THIN binding from
// the components' shared callback contract (WorkflowLaneActions/
// WorkflowMapActions) onto the v1a store's ONE mutation API — exactly the
// host wiring the v1b/v1c suites drilled, now against the live database.
// No new mutation semantics live here: one callback -> one store op ->
// revalidate, so the lane and the map re-read the SAME store state and
// cannot drift. This is user-progress tracking (display-class), NOT a
// governed mutation surface: no runtime tool path, no execution, and the
// store itself still refuses side_effecting nodes.
//
// Fail-closed: a store error (bad id, closed db) is swallowed and the route
// revalidated — the UI resyncs to what the store actually holds.

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db/node";
import {
  addSubItem,
  removeSubItem,
  toggleSubItem,
  updateNode,
  updateSubItem,
} from "@/lib/workflowbox";

function runStoreOp(op: () => void): void {
  try {
    op();
  } catch {
    // fail-closed: the revalidated view shows the store's real state
  } finally {
    revalidatePath("/working");
  }
}

export async function toggleSubItemAction(
  projectId: string,
  nodeId: string,
  subItemId: string,
): Promise<void> {
  runStoreOp(() => {
    toggleSubItem(getDb(), projectId, nodeId, subItemId);
  });
}

export async function addSubItemAction(
  projectId: string,
  nodeId: string,
  title: string,
): Promise<void> {
  runStoreOp(() => {
    addSubItem(getDb(), projectId, nodeId, { title });
  });
}

export async function updateSubItemAction(
  projectId: string,
  nodeId: string,
  subItemId: string,
  patch: { title?: string; done?: boolean },
): Promise<void> {
  runStoreOp(() => {
    updateSubItem(getDb(), projectId, nodeId, subItemId, patch);
  });
}

export async function removeSubItemAction(
  projectId: string,
  nodeId: string,
  subItemId: string,
): Promise<void> {
  runStoreOp(() => {
    removeSubItem(getDb(), projectId, nodeId, subItemId);
  });
}

export async function markNodeAction(
  projectId: string,
  nodeId: string,
  done: boolean,
): Promise<void> {
  runStoreOp(() => {
    updateNode(getDb(), projectId, nodeId, {
      status: done ? "done" : "todo",
    });
  });
}

export async function moveNodeAction(
  projectId: string,
  nodeId: string,
  layout: { x: number; y: number },
): Promise<void> {
  runStoreOp(() => {
    updateNode(getDb(), projectId, nodeId, { layout });
  });
}
