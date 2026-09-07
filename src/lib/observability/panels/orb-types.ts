export type OrbMode = "idle" | "working" | "audit" | "degraded" | "kill_switch";
export type OrbLoadBand = "idle" | "light" | "active" | "busy";
export type OrbLastEventClass =
  | "none"
  | "routine_completed"
  | "approval_pending"
  | "vision_degraded"
  | "error";
export type OrbGovernancePosture =
  | "all_green"
  | "gated_active"
  | "kill_switch_on";
export type OrbHeartbeat = "stable" | "delayed" | "unavailable";

export interface RestOrbStateTokens {
  mode: OrbMode;
  load_band: OrbLoadBand;
  last_event_class: OrbLastEventClass;
  governance_posture: OrbGovernancePosture;
  heartbeat: OrbHeartbeat;
}

export interface OrbVisualState {
  mode: OrbMode;
  loadBand: OrbLoadBand;
  lastEventClass: OrbLastEventClass;
  governancePosture: OrbGovernancePosture;
  heartbeat: OrbHeartbeat;
  label: string;
  statusText: string;
  detailText: string;
  tone: "quiet" | "focused" | "review" | "withheld";
  metadataOnly: true;
  rawPayloadIncluded: false;
  localOnly: true;
  authority: "none";
  withheld: boolean;
}
