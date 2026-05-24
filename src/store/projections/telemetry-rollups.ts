import {
  PROJECTION_POSTURE,
  clone,
  parseMetadataJson,
  safeMetadataText,
  withReadonlyDatabase,
  type ProjectionPosture,
  type ProjectionStatus,
} from "./helpers";

export interface CountBucket {
  readonly key: string;
  readonly count: number;
}

export interface TelemetryRollupsProjection {
  readonly projection_status: ProjectionStatus;
  readonly telemetry_by_scope: readonly CountBucket[];
  readonly telemetry_by_severity: readonly CountBucket[];
  readonly runtime_by_status: readonly CountBucket[];
  readonly model_calls_by_provider: readonly CountBucket[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPosture;
}

interface TelemetryRow {
  readonly telemetry_event_id: string;
  readonly telemetry_scope: string;
  readonly severity: string;
  readonly metadata_only: 0 | 1;
  readonly metadata_json: string;
  readonly payload_json: string | null;
}

interface RuntimeRow {
  readonly runtime_execution_id: string;
  readonly status: string;
  readonly metadata_json: string;
  readonly payload_json: string | null;
}

interface ModelCallRow {
  readonly model_call_id: string;
  readonly provider_id: string;
  readonly cloud_call: 0 | 1;
  readonly prompt_payload_retained: 0 | 1;
  readonly metadata_json: string;
  readonly payload_json: string | null;
}

export function readTelemetryRollupsProjection(input: {
  readonly databasePath: string;
}): TelemetryRollupsProjection {
  const projection = withReadonlyDatabase(input.databasePath, (db) => {
    const errors: string[] = [];
    const telemetryRows = db
      .prepare(
        `
          SELECT
            te.telemetry_event_id,
            te.telemetry_scope,
            te.severity,
            te.metadata_only,
            e.metadata_json,
            e.payload_json
          FROM telemetry_events te
          INNER JOIN events e ON e.event_id = te.event_id
        `,
      )
      .all() as TelemetryRow[];
    const runtimeRows = db
      .prepare(
        `
          SELECT
            re.runtime_execution_id,
            re.status,
            e.metadata_json,
            e.payload_json
          FROM runtime_executions re
          INNER JOIN events e ON e.event_id = re.event_id
        `,
      )
      .all() as RuntimeRow[];
    const modelRows = db
      .prepare(
        `
          SELECT
            mc.model_call_id,
            mc.provider_id,
            mc.cloud_call,
            mc.prompt_payload_retained,
            e.metadata_json,
            e.payload_json
          FROM model_calls mc
          INNER JOIN events e ON e.event_id = mc.event_id
        `,
      )
      .all() as ModelCallRow[];

    const telemetryByScope = new Map<string, number>();
    const telemetryBySeverity = new Map<string, number>();
    const runtimeByStatus = new Map<string, number>();
    const modelCallsByProvider = new Map<string, number>();

    for (const row of telemetryRows) {
      if (
        row.metadata_only !== 1 ||
        row.payload_json !== null ||
        !parseMetadataJson(row.metadata_json)
      ) {
        errors.push(`unsafe_telemetry_event:${row.telemetry_event_id}`);
        continue;
      }
      increment(telemetryByScope, safeMetadataText(row.telemetry_scope));
      increment(telemetryBySeverity, safeMetadataText(row.severity));
    }

    for (const row of runtimeRows) {
      if (row.payload_json !== null || !parseMetadataJson(row.metadata_json)) {
        errors.push(`unsafe_runtime_execution:${row.runtime_execution_id}`);
        continue;
      }
      increment(runtimeByStatus, safeMetadataText(row.status));
    }

    for (const row of modelRows) {
      if (
        row.payload_json !== null ||
        row.cloud_call !== 0 ||
        row.prompt_payload_retained !== 0 ||
        !parseMetadataJson(row.metadata_json)
      ) {
        errors.push(`unsafe_model_call:${row.model_call_id}`);
        continue;
      }
      increment(modelCallsByProvider, safeMetadataText(row.provider_id));
    }

    return {
      projection_status: errors.length > 0 ? "degraded" : "ok",
      telemetry_by_scope: buckets(telemetryByScope),
      telemetry_by_severity: buckets(telemetryBySeverity),
      runtime_by_status: buckets(runtimeByStatus),
      model_calls_by_provider: buckets(modelCallsByProvider),
      errors,
      posture: PROJECTION_POSTURE,
    } satisfies TelemetryRollupsProjection;
  });

  return clone(projection);
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buckets(map: Map<string, number>): CountBucket[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
