import {
  PROJECTION_POSTURE,
  clone,
  parseMetadataJson,
  withReadonlyDatabase,
  type ProjectionPosture,
  type ProjectionStatus,
} from "./helpers";

export type RoomStateSummaryStatus = "known" | "unknown" | "stale";

export interface RoomStateSummary {
  readonly room_id: string | null;
  readonly profile_id: string | null;
  readonly adapter_id: string | null;
  readonly device_id: string | null;
  readonly sensor_id: string | null;
  readonly capability: string | null;
  readonly latest_event_id: string | null;
  readonly latest_seen_at_ms: number | null;
  readonly status: RoomStateSummaryStatus;
  readonly stale: boolean;
  readonly failure_class: string | null;
  readonly metadata_only: true;
  readonly raw_payload_included: false;
}

export interface RoomStateProjection {
  readonly projection_status: ProjectionStatus;
  readonly room_status: "known" | "unknown";
  readonly stale: boolean;
  readonly summaries: readonly RoomStateSummary[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPosture;
}

interface RoomEventRow {
  readonly event_id: string;
  readonly occurred_at_ms: number;
  readonly metadata_json: string;
  readonly payload_json: string | null;
  readonly room_id: string | null;
  readonly profile_id: string | null;
  readonly adapter_id: string | null;
  readonly device_id: string | null;
  readonly sensor_id: string | null;
  readonly capability: string | null;
  readonly failure_class: string | null;
  readonly metadata_only: 0 | 1;
}

export function readRoomStateProjection(input: {
  readonly databasePath: string;
  readonly nowMs?: number;
  readonly staleAfterMs?: number;
}): RoomStateProjection {
  const projection = withReadonlyDatabase(input.databasePath, (db) => {
    const rows = db
      .prepare(
        `
          SELECT
            e.event_id,
            e.occurred_at_ms,
            e.metadata_json,
            e.payload_json,
            re.room_id,
            re.profile_id,
            re.adapter_id,
            re.device_id,
            re.sensor_id,
            re.capability,
            re.failure_class,
            re.metadata_only
          FROM room_events re
          INNER JOIN events e ON e.event_id = re.event_id
          ORDER BY e.occurred_at_ms ASC, e.event_id ASC
        `,
      )
      .all() as RoomEventRow[];

    const errors: string[] = [];
    const latest = new Map<string, RoomStateSummary>();
    const nowMs = input.nowMs ?? 0;
    const staleAfterMs = input.staleAfterMs ?? 30_000;

    for (const row of rows) {
      const malformed =
        row.payload_json !== null ||
        row.metadata_only !== 1 ||
        !parseMetadataJson(row.metadata_json);
      if (malformed) errors.push(`unsafe_room_event:${row.event_id}`);

      const stale =
        malformed ||
        row.failure_class !== null ||
        nowMs - row.occurred_at_ms > staleAfterMs;
      const status: RoomStateSummaryStatus = malformed
        ? "unknown"
        : stale
          ? "stale"
          : "known";
      const key =
        row.device_id ??
        row.sensor_id ??
        row.room_id ??
        `event:${row.event_id}`;

      latest.set(key, {
        room_id: row.room_id,
        profile_id: row.profile_id,
        adapter_id: row.adapter_id,
        device_id: row.device_id,
        sensor_id: row.sensor_id,
        capability: row.capability,
        latest_event_id: malformed ? null : row.event_id,
        latest_seen_at_ms: malformed ? null : row.occurred_at_ms,
        status,
        stale,
        failure_class: row.failure_class,
        metadata_only: true,
        raw_payload_included: false,
      });
    }

    const summaries = [...latest.values()].sort((a, b) =>
      [
        a.room_id ?? "",
        a.device_id ?? "",
        a.sensor_id ?? "",
        a.capability ?? "",
      ]
        .join(":")
        .localeCompare(
          [
            b.room_id ?? "",
            b.device_id ?? "",
            b.sensor_id ?? "",
            b.capability ?? "",
          ].join(":"),
        ),
    );

    return {
      projection_status: errors.length > 0 ? "degraded" : "ok",
      room_status:
        summaries.length > 0 &&
        summaries.every((summary) => summary.status !== "unknown")
          ? "known"
          : "unknown",
      stale:
        summaries.length === 0 ||
        summaries.some((summary) => summary.stale === true),
      summaries,
      errors,
      posture: PROJECTION_POSTURE,
    } satisfies RoomStateProjection;
  });

  return clone(projection);
}
