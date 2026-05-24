import type { OrbVisualState } from "@/components/orb/types";
import type { AuditPanelViewModel } from "@/components/audit/types";
import type { WorkingPanelViewModel } from "@/components/working/types";
import type { RecentTracesProjection } from "@/store/projections/recent-traces";
import type { RoomStateProjection } from "@/store/projections/room-state";
import type { TelemetryRollupsProjection } from "@/store/projections/telemetry-rollups";

export type ObservabilityClassification = "metadata_only";
export type ObservabilityAuthority = "read_only";
export type ObservabilityStatus = "ok" | "degraded" | "withheld";

export interface ObservabilityRedactionPosture {
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly secrets_included: false;
  readonly executable_payload_included: false;
  readonly unsafe_payload_withheld: boolean;
}

export interface ObservabilityResponse<T> {
  readonly status: ObservabilityStatus;
  readonly classification: ObservabilityClassification;
  readonly authority: ObservabilityAuthority;
  readonly replay_safe: boolean;
  readonly data: T | null;
  readonly errors: readonly string[];
  readonly withheld: boolean;
  readonly redaction: ObservabilityRedactionPosture;
}

export interface ObservabilityQueryOptions {
  readonly nowMs?: number;
  readonly staleAfterMs?: number;
  readonly traceLimit?: number;
}

export interface ObservabilityApi {
  readonly queryRoomState: (
    options?: ObservabilityQueryOptions,
  ) => ObservabilityResponse<RoomStateProjection>;
  readonly queryRecentTraces: (
    options?: ObservabilityQueryOptions,
  ) => ObservabilityResponse<RecentTracesProjection>;
  readonly queryTelemetryRollups: () => ObservabilityResponse<TelemetryRollupsProjection>;
  readonly queryAuditPanelMetadata: () => ObservabilityResponse<
    readonly AuditPanelViewModel[]
  >;
  readonly queryOrbStateMetadata: () => ObservabilityResponse<OrbVisualState>;
  readonly queryWorkingPanelMetadata: () => ObservabilityResponse<
    readonly WorkingPanelViewModel[]
  >;
}

export interface ObservabilityProjectionReaders {
  readonly roomState: (input: {
    readonly databasePath: string;
    readonly nowMs?: number;
    readonly staleAfterMs?: number;
  }) => unknown;
  readonly recentTraces: (input: {
    readonly databasePath: string;
    readonly limit?: number;
  }) => unknown;
  readonly telemetryRollups: (input: {
    readonly databasePath: string;
  }) => unknown;
}

export interface CreateObservabilityApiInput {
  readonly databasePath: string;
  readonly projectionReaders?: Partial<ObservabilityProjectionReaders>;
  readonly auditPanels?: () => readonly AuditPanelViewModel[];
  readonly workingPanels?: () => readonly WorkingPanelViewModel[];
  readonly orbState?: () => OrbVisualState;
}
