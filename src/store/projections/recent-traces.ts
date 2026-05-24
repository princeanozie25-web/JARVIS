import {
  PROJECTION_POSTURE,
  clone,
  parseMetadataJson,
  safeMetadataText,
  withReadonlyDatabase,
  type ProjectionPosture,
  type ProjectionStatus,
} from "./helpers";

export interface RecentTraceSummary {
  readonly replay_trace_id: string;
  readonly event_id: string;
  readonly trace_kind: string;
  readonly occurred_at_ms: number;
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly executable_payload_included: false;
  readonly run_affordance: false;
  readonly retry_affordance: false;
}

export interface RecentTracesProjection {
  readonly projection_status: ProjectionStatus;
  readonly traces: readonly RecentTraceSummary[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPosture;
}

interface ReplayTraceRow {
  readonly replay_trace_id: string;
  readonly event_id: string;
  readonly trace_kind: string;
  readonly occurred_at_ms: number;
  readonly payload_json: string | null;
  readonly replay_metadata_json: string;
  readonly raw_payload_retained: 0 | 1;
}

export function readRecentTracesProjection(input: {
  readonly databasePath: string;
  readonly limit?: number;
}): RecentTracesProjection {
  const projection = withReadonlyDatabase(input.databasePath, (db) => {
    const rows = db
      .prepare(
        `
          SELECT
            rt.replay_trace_id,
            rt.event_id,
            rt.trace_kind,
            rt.replay_metadata_json,
            rt.raw_payload_retained,
            e.occurred_at_ms,
            e.payload_json
          FROM replay_traces rt
          INNER JOIN events e ON e.event_id = rt.event_id
          ORDER BY e.occurred_at_ms DESC, rt.replay_trace_id DESC
          LIMIT ?
        `,
      )
      .all(input.limit ?? 20) as ReplayTraceRow[];

    const errors: string[] = [];
    const traces: RecentTraceSummary[] = [];

    for (const row of rows) {
      const unsafe =
        row.payload_json !== null ||
        row.raw_payload_retained !== 0 ||
        !parseMetadataJson(row.replay_metadata_json);
      if (unsafe) {
        errors.push(`unsafe_replay_trace:${row.replay_trace_id}`);
        continue;
      }
      traces.push({
        replay_trace_id: row.replay_trace_id,
        event_id: row.event_id,
        trace_kind: safeMetadataText(row.trace_kind),
        occurred_at_ms: row.occurred_at_ms,
        metadata_only: true,
        raw_payload_included: false,
        executable_payload_included: false,
        run_affordance: false,
        retry_affordance: false,
      });
    }

    return {
      projection_status: errors.length > 0 ? "degraded" : "ok",
      traces,
      errors,
      posture: PROJECTION_POSTURE,
    } satisfies RecentTracesProjection;
  });

  return clone(projection);
}
