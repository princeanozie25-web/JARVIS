export type WorkingPanelId =
  | "system_status"
  | "room_state"
  | "recent_activity"
  | "model_router_status"
  | "suggestions_inbox"
  | "cost_usage"
  | "safety_governance";

export interface WorkingPanelPlaceholder {
  id: WorkingPanelId;
  title: string;
  eyebrow: string;
  summary: string;
  status: "placeholder" | "withheld" | "not_wired";
  metadataOnly: true;
  authority: "none";
}

export interface WorkingShellModel {
  title: string;
  subtitle: string;
  posture: "read_only_placeholder";
  localOnly: true;
  metadataOnly: true;
  authority: "none";
  panels: readonly WorkingPanelPlaceholder[];
}
