export type WorkingPanelId =
  | "system_status"
  | "room_state"
  | "recent_activity"
  | "model_router"
  | "suggestions_inbox"
  | "cost_usage"
  | "safety_governance";

export type WorkingDataClassification = "metadata_only";
export type WorkingAuthority = "read_only";
export type WorkingRefreshPolicy = "static_placeholder";
export type WorkingDisabledAffordance =
  | "run"
  | "retry"
  | "approve"
  | "execute"
  | "mutate"
  | "schedule";
export type WorkingPanelStatus = "placeholder" | "withheld" | "not_wired";

export interface WorkingPlaceholderRow {
  label: string;
  value: string;
}

export interface WorkingPanelDefinition {
  panel_id: WorkingPanelId;
  title: string;
  description: string;
  source_phase: "12B.2";
  data_classification: WorkingDataClassification;
  authority: WorkingAuthority;
  refresh_policy: WorkingRefreshPolicy;
  disabled_affordances: readonly WorkingDisabledAffordance[];
  placeholder_rows: readonly WorkingPlaceholderRow[];
}

export interface WorkingPanelViewModel extends WorkingPanelDefinition {
  status: WorkingPanelStatus;
  eyebrow: string;
  metadataOnly: true;
  localOnly: true;
  shellAuthority: "none";
  withheld: boolean;
  projectionBacked?: boolean;
}

export interface WorkingShellModel {
  title: string;
  subtitle: string;
  posture: "read_only_placeholder";
  localOnly: true;
  metadataOnly: true;
  authority: "none";
  panels: readonly WorkingPanelViewModel[];
}
