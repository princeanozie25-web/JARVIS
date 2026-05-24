import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "@/lib/observability/contracts";

import type {
  OrbGovernancePosture,
  OrbHeartbeat,
  OrbLastEventClass,
  OrbLoadBand,
  OrbMode,
  OrbVisualState,
  RestOrbStateTokens,
} from "./types";

const WITHHELD_TOKENS: RestOrbStateTokens = Object.freeze({
  mode: "degraded",
  load_band: "idle",
  last_event_class: "error",
  governance_posture: "gated_active",
  heartbeat: "unavailable",
});

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

export function createOrbProjectionTokens(
  api: Pick<
    ObservabilityApi,
    "queryOrbStateMetadata" | "queryTelemetryRollups" | "queryRecentTraces"
  >,
): RestOrbStateTokens {
  const orbResponse = api.queryOrbStateMetadata();
  if (!isSafeResponse(orbResponse) || !isSafeOrbState(orbResponse.data)) {
    return clone(WITHHELD_TOKENS);
  }

  const baseTokens = tokensFromOrbState(orbResponse.data);
  if (baseTokens.governance_posture === "kill_switch_on") {
    return clone({
      mode: "kill_switch",
      load_band: "idle",
      last_event_class: "error",
      governance_posture: "kill_switch_on",
      heartbeat: "unavailable",
    });
  }

  const telemetryTokens = tokensFromTelemetry(api.queryTelemetryRollups());
  if (!telemetryTokens) return clone(WITHHELD_TOKENS);

  const eventClass = eventClassFromRecentTraces(api.queryRecentTraces());
  if (!eventClass) return clone(WITHHELD_TOKENS);

  return clone({
    mode: modeFromSignals(
      baseTokens.mode,
      telemetryTokens.load_band,
      eventClass,
    ),
    load_band: telemetryTokens.load_band,
    last_event_class: eventClass,
    governance_posture: baseTokens.governance_posture,
    heartbeat: telemetryTokens.heartbeat,
  });
}

function modeFromSignals(
  baseMode: OrbMode,
  loadBand: OrbLoadBand,
  eventClass: OrbLastEventClass,
): OrbMode {
  if (eventClass === "error") return "degraded";
  if (baseMode === "idle" && loadBand !== "idle") return "working";
  return baseMode;
}

function tokensFromOrbState(state: OrbVisualState): RestOrbStateTokens {
  return {
    mode: state.mode,
    load_band: state.loadBand,
    last_event_class: state.lastEventClass,
    governance_posture: state.governancePosture,
    heartbeat: state.heartbeat,
  };
}

function tokensFromTelemetry(
  response: ObservabilityResponse<{
    readonly projection_status: string;
    readonly telemetry_by_scope: readonly unknown[];
    readonly telemetry_by_severity: readonly unknown[];
    readonly runtime_by_status: readonly unknown[];
    readonly model_calls_by_provider: readonly unknown[];
    readonly errors?: readonly unknown[];
  }>,
): Pick<RestOrbStateTokens, "load_band" | "heartbeat"> | null {
  if (!isSafeResponse(response) || !response.data) return null;

  const activityCount =
    response.data.telemetry_by_scope.length +
    response.data.runtime_by_status.length +
    response.data.model_calls_by_provider.length;
  const hasErrors =
    response.status === "degraded" ||
    response.data.projection_status === "degraded" ||
    (response.data.errors?.length ?? 0) > 0;

  return {
    load_band: loadBandFromCount(activityCount),
    heartbeat: hasErrors ? "delayed" : "stable",
  };
}

function eventClassFromRecentTraces(
  response: ObservabilityResponse<{
    readonly projection_status: string;
    readonly traces: readonly { readonly trace_kind: string }[];
    readonly errors?: readonly unknown[];
  }>,
): OrbLastEventClass | null {
  if (!isSafeResponse(response) || !response.data) return null;
  if (
    response.status === "degraded" ||
    response.data.projection_status === "degraded" ||
    (response.data.errors?.length ?? 0) > 0
  ) {
    return "error";
  }

  return traceKindToEventClass(response.data.traces[0]?.trace_kind ?? "none");
}

function loadBandFromCount(count: number): OrbLoadBand {
  if (count <= 0) return "idle";
  if (count <= 2) return "light";
  if (count <= 5) return "active";
  return "busy";
}

function traceKindToEventClass(traceKind: string): OrbLastEventClass {
  if (/routine/i.test(traceKind)) return "routine_completed";
  if (/approval/i.test(traceKind)) return "approval_pending";
  if (/vision/i.test(traceKind)) return "vision_degraded";
  if (/error|failure|failed/i.test(traceKind)) return "error";
  return "none";
}

function isSafeResponse<T>(
  response: ObservabilityResponse<T>,
): response is ObservabilityResponse<T> & { readonly data: T } {
  return (
    response.classification === "metadata_only" &&
    response.authority === "read_only" &&
    response.withheld === false &&
    response.data !== null &&
    response.redaction.metadata_only === true &&
    response.redaction.raw_payload_included === false &&
    response.redaction.secrets_included === false &&
    response.redaction.executable_payload_included === false &&
    response.redaction.unsafe_payload_withheld === false &&
    isSafeMetadataValue(response.data)
  );
}

function isSafeOrbState(state: OrbVisualState): boolean {
  return (
    hasValue<OrbMode>(MODES, state.mode) &&
    hasValue<OrbLoadBand>(LOAD_BANDS, state.loadBand) &&
    hasValue<OrbLastEventClass>(EVENT_CLASSES, state.lastEventClass) &&
    hasValue<OrbGovernancePosture>(
      GOVERNANCE_POSTURES,
      state.governancePosture,
    ) &&
    hasValue<OrbHeartbeat>(HEARTBEATS, state.heartbeat) &&
    state.metadataOnly === true &&
    state.rawPayloadIncluded === false &&
    state.localOnly === true &&
    state.authority === "none" &&
    isSafeMetadataValue(state)
  );
}

function hasValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isSafeMetadataValue(value: unknown): boolean {
  return !containsUnsafePayload(value, new Set());
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isSecretText(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafePayload(item, seen));
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKeyValue(key, child)) return true;
    if (containsUnsafePayload(child, seen)) return true;
  }
  return false;
}

function isUnsafeKeyValue(key: string, value: unknown): boolean {
  if (
    /raw|payload_json|prompt|output|transcript|frame|secret|token/i.test(key)
  ) {
    if (value === null || value === false) return false;
    if (key === "rawPayloadIncluded" && value === false) return false;
    if (key === "raw_payload_included" && value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
