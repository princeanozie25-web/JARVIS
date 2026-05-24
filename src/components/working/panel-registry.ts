import type {
  WorkingDisabledAffordance,
  WorkingPanelDefinition,
  WorkingPanelId,
  WorkingPanelViewModel,
  WorkingShellModel,
} from "./types";

export const WORKING_PANEL_IDS = Object.freeze([
  "system_status",
  "room_state",
  "recent_activity",
  "model_router",
  "suggestions_inbox",
  "cost_usage",
  "safety_governance",
] as const satisfies readonly WorkingPanelId[]);

export const WORKING_DISABLED_AFFORDANCES = Object.freeze([
  "run",
  "retry",
  "approve",
  "execute",
  "mutate",
  "schedule",
] as const satisfies readonly WorkingDisabledAffordance[]);

const PANEL_DEFINITIONS = Object.freeze([
  {
    panel_id: "system_status",
    title: "System status",
    description:
      "Host readiness indicators will appear here after observation wiring.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Shell", value: "local" },
      { label: "Binding", value: "static" },
    ]),
  },
  {
    panel_id: "room_state",
    title: "Room state",
    description:
      "Room topology summaries are withheld until read-only projections exist.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Room", value: "withheld" },
      { label: "Devices", value: "not wired" },
    ]),
  },
  {
    panel_id: "recent_activity",
    title: "Recent activity",
    description:
      "Append-only event summaries will render here in a later slice.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Timeline", value: "placeholder" },
      { label: "Payloads", value: "withheld" },
    ]),
  },
  {
    panel_id: "model_router",
    title: "Model/router status",
    description: "Routing status remains disconnected from this shell.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Router", value: "not wired" },
      { label: "Calls", value: "none" },
    ]),
  },
  {
    panel_id: "suggestions_inbox",
    title: "Suggestions inbox",
    description:
      "Suggestion summaries are visual placeholders with no action surface.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Inbox", value: "static" },
      { label: "Items", value: "withheld" },
    ]),
  },
  {
    panel_id: "cost_usage",
    title: "Cost/usage",
    description: "Usage bands will stay metadata-only when connected later.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Budget", value: "placeholder" },
      { label: "Spend", value: "withheld" },
    ]),
  },
  {
    panel_id: "safety_governance",
    title: "Safety/governance",
    description:
      "Governance posture is visible only; no decisions are made here.",
    source_phase: "12B.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: WORKING_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Policy", value: "visible" },
      { label: "Authority", value: "none" },
    ]),
  },
] as const satisfies readonly WorkingPanelDefinition[]);

const PANEL_STATUS: Record<WorkingPanelId, WorkingPanelViewModel["status"]> = {
  system_status: "placeholder",
  room_state: "withheld",
  recent_activity: "placeholder",
  model_router: "not_wired",
  suggestions_inbox: "placeholder",
  cost_usage: "placeholder",
  safety_governance: "withheld",
};

const PANEL_EYEBROW: Record<WorkingPanelId, string> = {
  system_status: "Local shell",
  room_state: "Room OS",
  recent_activity: "Timeline",
  model_router: "Routing",
  suggestions_inbox: "Assistance",
  cost_usage: "Budget",
  safety_governance: "Policy",
};

const UNKNOWN_PANEL: WorkingPanelViewModel = Object.freeze({
  panel_id: "safety_governance",
  title: "Unknown panel",
  description:
    "Panel metadata withheld because the requested id is not registered.",
  source_phase: "12B.2",
  data_classification: "metadata_only",
  authority: "read_only",
  refresh_policy: "static_placeholder",
  disabled_affordances: WORKING_DISABLED_AFFORDANCES,
  placeholder_rows: Object.freeze([{ label: "State", value: "withheld" }]),
  status: "withheld",
  eyebrow: "Fail closed",
  metadataOnly: true,
  localOnly: true,
  shellAuthority: "none",
  withheld: true,
});

function toViewModel(panel: WorkingPanelDefinition): WorkingPanelViewModel {
  const status = PANEL_STATUS[panel.panel_id];
  return Object.freeze({
    ...panel,
    disabled_affordances: Object.freeze([...panel.disabled_affordances]),
    placeholder_rows: Object.freeze([...panel.placeholder_rows]),
    status,
    eyebrow: PANEL_EYEBROW[panel.panel_id],
    metadataOnly: true,
    localOnly: true,
    shellAuthority: "none",
    withheld: status === "withheld",
  });
}

export function listWorkingPanels(): readonly WorkingPanelViewModel[] {
  return Object.freeze(PANEL_DEFINITIONS.map(toViewModel));
}

export function getWorkingPanel(panelId: string): WorkingPanelViewModel {
  const panel = PANEL_DEFINITIONS.find((item) => item.panel_id === panelId);
  return panel ? toViewModel(panel) : UNKNOWN_PANEL;
}

export const WORKING_SHELL_MODEL: WorkingShellModel = Object.freeze({
  title: "JARVIS Working",
  subtitle: "Read-only cockpit shell. Static placeholder regions only.",
  posture: "read_only_placeholder",
  localOnly: true,
  metadataOnly: true,
  authority: "none",
  panels: listWorkingPanels(),
});
