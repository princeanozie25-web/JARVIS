import type {
  AuditDisabledAffordance,
  AuditPanelDefinition,
  AuditPanelId,
  AuditPanelViewModel,
  AuditShellModel,
} from "./types";

export const AUDIT_PANEL_IDS = Object.freeze([
  "replay_timeline",
  "trace_viewer",
  "governance_boundary",
  "runtime_dependency",
  "redaction_status",
  "disabled_feature_matrix",
] as const satisfies readonly AuditPanelId[]);

export const AUDIT_DISABLED_AFFORDANCES = Object.freeze([
  "run",
  "retry",
  "approve",
  "execute",
  "mutate",
  "schedule",
  "replay_execute",
  "graph_execute",
] as const satisfies readonly AuditDisabledAffordance[]);

const PANEL_DEFINITIONS = Object.freeze([
  {
    panel_id: "replay_timeline",
    title: "Replay timeline",
    description: "Timeline metadata placeholder for future trace inspection.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Timeline", value: "static" },
      { label: "Payloads", value: "withheld" },
    ]),
  },
  {
    panel_id: "trace_viewer",
    title: "Trace viewer",
    description: "Trace metadata remains disconnected from stored events.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Trace", value: "placeholder" },
      { label: "Bodies", value: "withheld" },
    ]),
  },
  {
    panel_id: "governance_boundary",
    title: "Governance boundary viewer",
    description: "Boundary visualization placeholder with no decision surface.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Boundary", value: "visible" },
      { label: "Authority", value: "none" },
    ]),
  },
  {
    panel_id: "runtime_dependency",
    title: "Runtime dependency viewer",
    description: "Dependency graph placeholder; graph logic is not connected.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Graph", value: "placeholder" },
      { label: "Edges", value: "metadata only" },
    ]),
  },
  {
    panel_id: "redaction_status",
    title: "Redaction status",
    description: "Redaction posture placeholder without raw content display.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Payload", value: "withheld" },
      { label: "Display", value: "metadata only" },
    ]),
  },
  {
    panel_id: "disabled_feature_matrix",
    title: "Disabled-feature matrix",
    description: "Frozen feature posture placeholder for audit review.",
    source_phase: "12C.2",
    data_classification: "metadata_only",
    authority: "read_only",
    refresh_policy: "static_placeholder",
    disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
    placeholder_rows: Object.freeze([
      { label: "Matrix", value: "static" },
      { label: "Controls", value: "absent" },
    ]),
  },
] as const satisfies readonly AuditPanelDefinition[]);

const PANEL_STATUS: Record<AuditPanelId, AuditPanelViewModel["status"]> = {
  replay_timeline: "placeholder",
  trace_viewer: "not_connected",
  governance_boundary: "placeholder",
  runtime_dependency: "not_connected",
  redaction_status: "withheld",
  disabled_feature_matrix: "placeholder",
};

const PANEL_EYEBROW: Record<AuditPanelId, string> = {
  replay_timeline: "Forensics",
  trace_viewer: "Evidence",
  governance_boundary: "Policy",
  runtime_dependency: "Runtime",
  redaction_status: "Privacy",
  disabled_feature_matrix: "Safety",
};

const UNKNOWN_PANEL: AuditPanelViewModel = Object.freeze({
  panel_id: "disabled_feature_matrix",
  title: "Unknown audit panel",
  description:
    "Panel metadata withheld because the requested id is not registered.",
  source_phase: "12C.2",
  data_classification: "metadata_only",
  authority: "read_only",
  refresh_policy: "static_placeholder",
  disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
  placeholder_rows: Object.freeze([{ label: "State", value: "withheld" }]),
  eyebrow: "Fail closed",
  status: "withheld",
  posture: "inspection_only",
  metadataOnly: true,
  localOnly: true,
  shellAuthority: "none",
  withheld: true,
});

function toViewModel(panel: AuditPanelDefinition): AuditPanelViewModel {
  const status = PANEL_STATUS[panel.panel_id];
  return Object.freeze({
    ...panel,
    disabled_affordances: Object.freeze([...panel.disabled_affordances]),
    placeholder_rows: Object.freeze([...panel.placeholder_rows]),
    eyebrow: PANEL_EYEBROW[panel.panel_id],
    status,
    posture: "inspection_only",
    metadataOnly: true,
    localOnly: true,
    shellAuthority: "none",
    withheld: status === "withheld",
  });
}

export function listAuditPanels(): readonly AuditPanelViewModel[] {
  return Object.freeze(PANEL_DEFINITIONS.map(toViewModel));
}

export function getAuditPanel(panelId: string): AuditPanelViewModel {
  const panel = PANEL_DEFINITIONS.find((item) => item.panel_id === panelId);
  return panel ? toViewModel(panel) : UNKNOWN_PANEL;
}

export const AUDIT_SHELL_MODEL: AuditShellModel = Object.freeze({
  title: "JARVIS Room OS — Audit Mode",
  subtitle: "Read-only forensics shell. Static placeholder regions only.",
  posture: "read_only_forensics_shell",
  localOnly: true,
  metadataOnly: true,
  authority: "none",
  panels: listAuditPanels(),
});
