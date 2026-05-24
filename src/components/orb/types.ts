export type OrbMode = "idle";

export interface OrbVisualState {
  mode: OrbMode;
  label: string;
  statusText: string;
  localOnly: true;
  authority: "none";
}

export const IDLE_ORB_STATE: OrbVisualState = Object.freeze({
  mode: "idle",
  label: "JARVIS Room OS - Rest Mode",
  statusText: "Idle. Local shell only.",
  localOnly: true,
  authority: "none",
});
