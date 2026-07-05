import { WorkingCockpit } from "@/components/working/WorkingCockpit";
import type { WorkflowMapActions } from "@/components/working/WorkflowMap";
import { buildWorkingCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";

import {
  addSubItemAction,
  markNodeAction,
  moveNodeAction,
  removeSubItemAction,
  toggleSubItemAction,
  updateSubItemAction,
} from "./workflowbox-actions";
import { loadCockpitWorkflowbox } from "./workflowbox-live";

// E-019: ONE actions object (server-action references) is handed to the
// cockpit, which passes the SAME object to the lane AND the map — both views
// write through the store's single mutation API, so they cannot drift.
// Actions are wired ONLY when the lane is live: the labelled sample fixture
// stays display-only (there is nothing real to mutate).
const LIVE_WORKFLOWBOX_ACTIONS: WorkflowMapActions = {
  toggleSubItem: toggleSubItemAction,
  addSubItem: addSubItemAction,
  updateSubItem: updateSubItemAction,
  removeSubItem: removeSubItemAction,
  markNode: markNodeAction,
  moveNode: moveNodeAction,
};

export default function WorkingPage() {
  const model = buildWorkingCommandCenterModel();
  const workflowbox = loadCockpitWorkflowbox();

  return (
    <main
      aria-label="JARVIS Working cockpit"
      data-working-layout="approval-gated-cockpit"
      data-working-layout-style="working-cockpit"
    >
      <WorkingCockpit
        model={model}
        lane={workflowbox.lane}
        laneProvenance={workflowbox.provenance}
        laneActions={
          workflowbox.provenance === "live"
            ? LIVE_WORKFLOWBOX_ACTIONS
            : undefined
        }
      />
    </main>
  );
}
