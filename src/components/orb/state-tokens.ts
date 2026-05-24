import type {
  OrbGovernancePosture,
  OrbHeartbeat,
  OrbLastEventClass,
  OrbLoadBand,
  OrbMode,
  OrbVisualState,
  RestOrbStateTokens,
} from "./types";

const MODES = ["idle", "working", "audit", "degraded", "kill_switch"] as const;
const LOAD_BANDS = ["idle", "light", "active", "busy"] as const;
const EVENT_CLASSES = [
  "none",
  "routine_completed",
  "approval_pending",
  "vision_degraded",
  "error",
] as const;
const GOVERNANCE_POSTURES = [
  "all_green",
  "gated_active",
  "kill_switch_on",
] as const;
const HEARTBEATS = ["stable", "delayed", "unavailable"] as const;

export const DEFAULT_REST_ORB_TOKENS: RestOrbStateTokens = Object.freeze({
  mode: "idle",
  load_band: "idle",
  last_event_class: "none",
  governance_posture: "all_green",
  heartbeat: "stable",
});

const WITHHELD_TOKENS: RestOrbStateTokens = Object.freeze({
  mode: "degraded",
  load_band: "idle",
  last_event_class: "error",
  governance_posture: "gated_active",
  heartbeat: "unavailable",
});

function hasValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isKnownTokenSet(tokens: RestOrbStateTokens): boolean {
  return (
    hasValue<OrbMode>(MODES, tokens.mode) &&
    hasValue<OrbLoadBand>(LOAD_BANDS, tokens.load_band) &&
    hasValue<OrbLastEventClass>(EVENT_CLASSES, tokens.last_event_class) &&
    hasValue<OrbGovernancePosture>(
      GOVERNANCE_POSTURES,
      tokens.governance_posture,
    ) &&
    hasValue<OrbHeartbeat>(HEARTBEATS, tokens.heartbeat)
  );
}

function isSafeTokenCombination(tokens: RestOrbStateTokens): boolean {
  if (tokens.mode === "idle" && tokens.load_band !== "idle") return false;
  if (tokens.governance_posture === "kill_switch_on") {
    return tokens.mode === "kill_switch";
  }
  if (tokens.mode === "kill_switch") {
    return false;
  }
  if (tokens.mode === "working" && tokens.heartbeat === "unavailable") {
    return false;
  }
  if (tokens.last_event_class === "error" && tokens.mode === "idle") {
    return false;
  }
  return true;
}

function eventLabel(eventClass: OrbLastEventClass): string {
  switch (eventClass) {
    case "routine_completed":
      return "Routine completed.";
    case "approval_pending":
      return "Approval pending at the governance boundary.";
    case "vision_degraded":
      return "Vision signal degraded.";
    case "error":
      return "Error metadata withheld.";
    case "none":
      return "No recent event.";
  }
}

function modeLabel(
  mode: OrbMode,
): Pick<OrbVisualState, "label" | "statusText" | "tone"> {
  switch (mode) {
    case "working":
      return {
        label: "JARVIS Room OS - Working Signal",
        statusText: "Activity indicated. No execution controls exposed.",
        tone: "focused",
      };
    case "audit":
      return {
        label: "JARVIS Room OS - Audit Signal",
        statusText: "Review posture visible. Metadata only.",
        tone: "review",
      };
    case "degraded":
      return {
        label: "JARVIS Room OS - Degraded Signal",
        statusText: "State withheld until signals are safe.",
        tone: "withheld",
      };
    case "kill_switch":
      return {
        label: "JARVIS Room OS - Kill Switch Signal",
        statusText: "Authority remains unavailable.",
        tone: "withheld",
      };
    case "idle":
      return {
        label: "JARVIS Room OS — Rest Mode",
        statusText: "Idle. Local shell only.",
        tone: "quiet",
      };
  }
}

function createViewModel(
  tokens: RestOrbStateTokens,
  withheld: boolean,
): OrbVisualState {
  const mode = modeLabel(tokens.mode);
  return Object.freeze({
    mode: tokens.mode,
    loadBand: tokens.load_band,
    lastEventClass: tokens.last_event_class,
    governancePosture: tokens.governance_posture,
    heartbeat: tokens.heartbeat,
    label: mode.label,
    statusText: mode.statusText,
    detailText: [
      `Load ${tokens.load_band}.`,
      eventLabel(tokens.last_event_class),
      `Governance ${tokens.governance_posture}.`,
      `Heartbeat ${tokens.heartbeat}.`,
    ].join(" "),
    tone: mode.tone,
    metadataOnly: true,
    rawPayloadIncluded: false,
    localOnly: true,
    authority: "none",
    withheld,
  } satisfies OrbVisualState);
}

export function restOrbTokensToViewModel(
  tokens: RestOrbStateTokens,
): OrbVisualState {
  if (!isKnownTokenSet(tokens) || !isSafeTokenCombination(tokens)) {
    return createViewModel(WITHHELD_TOKENS, true);
  }

  return createViewModel(tokens, false);
}

export const IDLE_ORB_STATE = restOrbTokensToViewModel(DEFAULT_REST_ORB_TOKENS);
