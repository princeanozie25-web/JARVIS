import { listAuditPanels } from "@/components/audit/panel-registry";
import { IDLE_ORB_STATE } from "@/components/orb/state-tokens";
import { listWorkingPanels } from "@/components/working/panel-registry";
import { readRecentTracesProjection } from "@/store/projections/recent-traces";
import { readRoomStateProjection } from "@/store/projections/room-state";
import { readTelemetryRollupsProjection } from "@/store/projections/telemetry-rollups";

import type {
  CreateObservabilityApiInput,
  ObservabilityApi,
  ObservabilityProjectionReaders,
  ObservabilityRedactionPosture,
  ObservabilityResponse,
} from "./contracts";

const SAFE_REDACTION: ObservabilityRedactionPosture = Object.freeze({
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  unsafe_payload_withheld: false,
});

const WITHHELD_REDACTION: ObservabilityRedactionPosture = Object.freeze({
  ...SAFE_REDACTION,
  unsafe_payload_withheld: true,
});

const DEFAULT_READERS: ObservabilityProjectionReaders = Object.freeze({
  roomState: readRoomStateProjection,
  recentTraces: readRecentTracesProjection,
  telemetryRollups: readTelemetryRollupsProjection,
});

export function createObservabilityApi(
  input: CreateObservabilityApiInput,
): ObservabilityApi {
  const readers = {
    ...DEFAULT_READERS,
    ...input.projectionReaders,
  };
  const auditPanels = input.auditPanels ?? listAuditPanels;
  const workingPanels = input.workingPanels ?? listWorkingPanels;
  const orbState = input.orbState ?? (() => IDLE_ORB_STATE);

  return Object.freeze({
    queryRoomState: (options = {}) =>
      respondFromProjection(
        readers.roomState({
          databasePath: input.databasePath,
          nowMs: options.nowMs,
          staleAfterMs: options.staleAfterMs,
        }),
      ),
    queryRecentTraces: (options = {}) =>
      respondFromProjection(
        readers.recentTraces({
          databasePath: input.databasePath,
          limit: options.traceLimit,
        }),
        true,
      ),
    queryTelemetryRollups: () =>
      respondFromProjection(
        readers.telemetryRollups({ databasePath: input.databasePath }),
      ),
    queryAuditPanelMetadata: () => respondFromMetadata(auditPanels(), true),
    queryOrbStateMetadata: () => respondFromMetadata(orbState()),
    queryWorkingPanelMetadata: () => respondFromMetadata(workingPanels()),
  } satisfies ObservabilityApi);
}

function respondFromProjection<T>(
  value: unknown,
  replaySafe = false,
): ObservabilityResponse<T> {
  if (!isRecord(value) || !isProjectionStatus(value.projection_status)) {
    return withheldResponse(["malformed_projection_payload"], replaySafe);
  }
  if (!isSafeMetadataValue(value)) {
    return withheldResponse(["unsafe_projection_payload"], replaySafe);
  }

  const errors = stringArray(value.errors);
  const status =
    value.projection_status === "degraded" || errors.length > 0
      ? "degraded"
      : "ok";

  return Object.freeze({
    status,
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: replaySafe,
    data: clone(value as T),
    errors: clone(errors),
    withheld: false,
    redaction: clone(SAFE_REDACTION),
  } satisfies ObservabilityResponse<T>);
}

function respondFromMetadata<T>(
  value: unknown,
  replaySafe = false,
): ObservabilityResponse<T> {
  if (!isRecord(value) && !Array.isArray(value)) {
    return withheldResponse(["malformed_metadata_payload"], replaySafe);
  }
  if (!isSafeMetadataValue(value)) {
    return withheldResponse(["unsafe_metadata_payload"], replaySafe);
  }

  return Object.freeze({
    status: "ok",
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: replaySafe,
    data: clone(value as T),
    errors: [],
    withheld: false,
    redaction: clone(SAFE_REDACTION),
  } satisfies ObservabilityResponse<T>);
}

function withheldResponse<T>(
  errors: readonly string[],
  replaySafe: boolean,
): ObservabilityResponse<T> {
  return Object.freeze({
    status: "withheld",
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: replaySafe,
    data: null,
    errors: clone(errors),
    withheld: true,
    redaction: clone(WITHHELD_REDACTION),
  } satisfies ObservabilityResponse<T>);
}

function isSafeMetadataValue(value: unknown): boolean {
  return !containsUnsafePayload(value, new Set());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectionStatus(value: unknown): value is "ok" | "degraded" {
  return value === "ok" || value === "degraded";
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
  }
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
    if (key === "raw_payload_included" && value === false) return false;
    if (key === "raw_payload_retained" && value === 0) return false;
    if (key === "prompt_payload_retained" && value === 0) return false;
    return true;
  }
  return false;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
