import type DatabaseType from "better-sqlite3";

import { SYNTHETIC_WORKFLOW_LANE } from "@/components/working/workflow-lane-fixture";
import { getDb } from "@/lib/db/node";
import {
  buildWorkflowLaneViewModel,
  listProjects,
  type WorkflowLaneViewModel,
} from "@/lib/workflowbox";

// E-019 — the READ half of the WorkflowBox wire. The working route loads the
// user's REAL projects from the live store (the same v1a single-model API the
// suites drilled) and renders them when they exist. When the store is empty or
// unreachable this falls back to the documented fixture — but labelled
// "sample" (per-panel provenance, honesty pass), never presented as the
// user's data. One lane view-model feeds BOTH the lane and the map, so the
// two views cannot disagree about what the store said.

export type WorkflowboxProvenance = "live" | "sample";

export interface CockpitWorkflowbox {
  readonly lane: WorkflowLaneViewModel;
  readonly provenance: WorkflowboxProvenance;
}

// `db` is an injection seam for tests; the route passes nothing and gets the
// app database (data/jarvis.db — the workflow_* tables live in its schema).
export function loadCockpitWorkflowbox(
  db?: DatabaseType.Database,
): CockpitWorkflowbox {
  try {
    const handle = db ?? getDb();
    const projects = listProjects(handle);
    if (projects.length > 0) {
      return {
        lane: buildWorkflowLaneViewModel(projects),
        provenance: "live",
      };
    }
  } catch {
    // Fail-closed to the labelled sample — a broken store must not take the
    // cockpit down, and must not masquerade as real data either.
  }
  return { lane: SYNTHETIC_WORKFLOW_LANE, provenance: "sample" };
}
