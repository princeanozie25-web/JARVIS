export type AuditPanelId =
  | "replay_timeline"
  | "trace_viewer"
  | "governance_boundary"
  | "runtime_dependency"
  | "redaction_status"
  | "disabled_feature_matrix";

export type AuditDataClassification = "metadata_only";
export type AuditAuthority = "read_only";
export type AuditRefreshPolicy = "static_placeholder";
export type AuditDisabledAffordance =
  | "run"
  | "retry"
  | "approve"
  | "execute"
  | "mutate"
  | "schedule"
  | "replay_execute"
  | "graph_execute";
export type AuditPanelStatus = "placeholder" | "withheld" | "not_connected";

export interface AuditPlaceholderRow {
  label: string;
  value: string;
}

export interface AuditPanelDefinition {
  panel_id: AuditPanelId;
  title: string;
  description: string;
  source_phase: "12C.2";
  data_classification: AuditDataClassification;
  authority: AuditAuthority;
  refresh_policy: AuditRefreshPolicy;
  disabled_affordances: readonly AuditDisabledAffordance[];
  placeholder_rows: readonly AuditPlaceholderRow[];
}

export interface AuditPanelViewModel extends AuditPanelDefinition {
  eyebrow: string;
  status: AuditPanelStatus;
  posture: "inspection_only";
  metadataOnly: true;
  localOnly: true;
  shellAuthority: "none";
  withheld: boolean;
}

export interface AuditShellModel {
  title: string;
  subtitle: string;
  posture: "read_only_forensics_shell";
  localOnly: true;
  metadataOnly: true;
  authority: "none";
  panels: readonly AuditPanelViewModel[];
}
