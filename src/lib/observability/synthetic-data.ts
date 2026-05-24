import { listAuditPanels } from "@/components/audit/panel-registry";
import type { AuditPanelViewModel } from "@/components/audit/types";
import type { RestOrbStateTokens } from "@/components/orb/types";
import { listWorkingPanels } from "@/components/working/panel-registry";
import type { WorkingPanelViewModel } from "@/components/working/types";
import {
  REQUIRED_DEMO_MARKER,
  createDemoSafetyEnvelope,
  validateDemoSafety,
  type DemoSafetyEnvelope,
} from "./demo-safety";

export const SYNTHETIC_OBSERVABILITY_MARKER = REQUIRED_DEMO_MARKER;

const REST_ORB_TOKENS: RestOrbStateTokens = Object.freeze({
  mode: "working",
  load_band: "active",
  last_event_class: "routine_completed",
  governance_posture: "all_green",
  heartbeat: "stable",
});

export const SYNTHETIC_REST_ORB_DATASET =
  createDemoSafetyEnvelope(REST_ORB_TOKENS);

export const SYNTHETIC_REST_ORB_TOKENS: RestOrbStateTokens =
  validatedSyntheticData(SYNTHETIC_REST_ORB_DATASET, {
    mode: "degraded",
    load_band: "idle",
    last_event_class: "error",
    governance_posture: "gated_active",
    heartbeat: "unavailable",
  });

export function syntheticWorkingPanels(): readonly WorkingPanelViewModel[] {
  const panels: WorkingPanelViewModel[] = listWorkingPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows: rowsForWorkingPanel(panel.panel_id),
  }));

  return validatedSyntheticData(
    createDemoSafetyEnvelope(panels),
    listWorkingPanels().map(withheldWorkingPanel),
  );
}

export function syntheticAuditPanels(): readonly AuditPanelViewModel[] {
  const panels: AuditPanelViewModel[] = listAuditPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows: rowsForAuditPanel(panel.panel_id),
  }));

  return validatedSyntheticData(
    createDemoSafetyEnvelope(panels),
    listAuditPanels().map(withheldAuditPanel),
  );
}

export function malformedSyntheticWorkingPanels(): readonly WorkingPanelViewModel[] {
  return listWorkingPanels().map((panel) =>
    panel.panel_id === "room_state"
      ? {
          ...panel,
          status: "withheld",
          withheld: true,
          projectionBacked: true,
          placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
        }
      : panel,
  );
}

export function validateSyntheticDataset<T>(
  envelope: Partial<DemoSafetyEnvelope<T>>,
) {
  return validateDemoSafety(envelope);
}

function validatedSyntheticData<T>(
  envelope: DemoSafetyEnvelope<T>,
  fallback: T,
): T {
  const validation = validateDemoSafety(envelope);
  return validation.ok && validation.data !== null
    ? validation.data
    : structuredClone(fallback);
}

function withheldWorkingPanel(
  panel: WorkingPanelViewModel,
): WorkingPanelViewModel {
  return {
    ...panel,
    status: "withheld",
    withheld: true,
    projectionBacked: false,
    placeholder_rows: [{ label: "State", value: "withheld" }],
  };
}

function withheldAuditPanel(panel: AuditPanelViewModel): AuditPanelViewModel {
  return {
    ...panel,
    status: "withheld",
    withheld: true,
    projectionBacked: false,
    placeholder_rows: [{ label: "State", value: "withheld" }],
  };
}

function rowsForWorkingPanel(
  panelId: WorkingPanelViewModel["panel_id"],
): WorkingPanelViewModel["placeholder_rows"] {
  switch (panelId) {
    case "system_status":
      return [
        { label: "Marker", value: SYNTHETIC_OBSERVABILITY_MARKER },
        { label: "Substrate", value: "local synthetic" },
      ];
    case "room_state":
      return [
        { label: "Room", value: "synthetic known" },
        { label: "Freshness", value: "demo current" },
      ];
    case "recent_activity":
      return [
        { label: "Trace", value: "synthetic replay metadata" },
        { label: "Payloads", value: "withheld" },
      ];
    case "model_router":
      return [
        { label: "Router", value: "synthetic offline" },
        { label: "Authority", value: "none" },
      ];
    case "suggestions_inbox":
      return [
        { label: "Inbox", value: "demo-safe" },
        { label: "Actions", value: "absent" },
      ];
    case "cost_usage":
      return [
        { label: "Model calls", value: "synthetic 0" },
        { label: "Spend", value: "withheld" },
      ];
    case "safety_governance":
      return [
        { label: "Governance", value: "synthetic all green" },
        { label: "Execution", value: "absent" },
      ];
  }
}

function rowsForAuditPanel(
  panelId: AuditPanelViewModel["panel_id"],
): AuditPanelViewModel["placeholder_rows"] {
  switch (panelId) {
    case "replay_timeline":
      return [
        { label: "Marker", value: SYNTHETIC_OBSERVABILITY_MARKER },
        { label: "Traces", value: "synthetic 3" },
      ];
    case "trace_viewer":
      return [
        { label: "Trace", value: "metadata only" },
        { label: "Bodies", value: "withheld" },
      ];
    case "governance_boundary":
      return [
        { label: "Boundary", value: "synthetic visible" },
        { label: "Authority", value: "none" },
      ];
    case "runtime_dependency":
      return [
        { label: "Graph", value: "static synthetic" },
        { label: "Execution", value: "absent" },
      ];
    case "redaction_status":
      return [
        { label: "Payloads", value: "withheld" },
        { label: "Sensitive", value: "withheld" },
      ];
    case "disabled_feature_matrix":
      return [
        { label: "Replay path", value: "absent" },
        { label: "Graph path", value: "absent" },
      ];
  }
}
