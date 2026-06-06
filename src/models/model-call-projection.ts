import {
  PROJECTION_POSTURE,
  clone,
  safeMetadataText,
  withReadonlyDatabase,
  type ProjectionPosture,
  type ProjectionStatus,
} from "../store/projections/helpers";
import { ModelCallEventSchema, type ModelCallEvent } from "./model-call-event";
import type {
  ModelCapability,
  ModelProviderKind,
  ModelRuntimeClass,
} from "./types";
import type {
  ModelProviderFailureClass,
  ModelProviderRedactionStatus,
  ModelProviderTokenUsage,
} from "./providers/contract";

export type ModelCallStatus = "success" | "failed";

export interface ModelCallProjectionOptions {
  readonly databasePath: string;
}

export interface RecentModelCallsOptions extends ModelCallProjectionOptions {
  readonly limit?: number;
}

export interface RecentModelCallRecord {
  readonly event_id: string;
  readonly model_call_id: string;
  readonly request_id: string;
  readonly execution_id: string;
  readonly aux_task_kind?: string;
  readonly model_id: string | null;
  readonly provider_kind: ModelProviderKind | null;
  readonly runtime_class: ModelRuntimeClass | null;
  readonly capability: ModelCapability | null;
  readonly status: ModelCallStatus;
  readonly failure_class?: ModelProviderFailureClass;
  readonly token_usage: ModelProviderTokenUsage;
  readonly latency_ms: number;
  readonly fallback_used: boolean;
  readonly degraded: boolean;
  readonly created_at: number;
  readonly redaction_status: ModelProviderRedactionStatus;
  readonly metadata_only: true;
  readonly raw_payload_included: false;
}

export interface RecentModelCallsProjection {
  readonly projection_status: ProjectionStatus;
  readonly calls: readonly RecentModelCallRecord[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPosture;
}

export interface ModelCallCountBucket {
  readonly key: string;
  readonly count: number;
}

export interface ModelCallLatencySummary {
  readonly min_ms: number;
  readonly max_ms: number;
  readonly average_ms: number;
}

export interface ModelCallRollupProjection {
  readonly projection_status: ProjectionStatus;
  readonly total_calls: number;
  readonly successful_calls: number;
  readonly failed_calls: number;
  readonly degraded_calls: number;
  readonly fallback_used_calls: number;
  readonly token_usage_totals: ModelProviderTokenUsage;
  readonly latency_ms: ModelCallLatencySummary;
  readonly calls_by_model: readonly ModelCallCountBucket[];
  readonly calls_by_provider_kind: readonly ModelCallCountBucket[];
  readonly calls_by_runtime_class: readonly ModelCallCountBucket[];
  readonly calls_by_capability: readonly ModelCallCountBucket[];
  readonly calls_by_aux_task_kind: readonly ModelCallCountBucket[];
  readonly calls_by_status: readonly ModelCallCountBucket[];
  readonly failures_by_class: readonly ModelCallCountBucket[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPosture;
}

interface ModelCallProjectionRow {
  readonly event_id: string;
  readonly event_type: string;
  readonly metadata_json: string;
  readonly payload_json: string | null;
  readonly local_only: 0 | 1;
  readonly model_call_id: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly cloud_call: 0 | 1;
  readonly prompt_payload_retained: 0 | 1;
}

interface NormalizedModelCallRow {
  readonly row: ModelCallProjectionRow;
  readonly event: ModelCallEvent;
}

const ZERO_LATENCY: ModelCallLatencySummary = {
  min_ms: 0,
  max_ms: 0,
  average_ms: 0,
};

const ZERO_TOKEN_USAGE: ModelProviderTokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
};

export function getRecentModelCalls(
  input: RecentModelCallsOptions,
): RecentModelCallsProjection {
  const projection = withReadonlyDatabase(input.databasePath, (db) => {
    const rows = db
      .prepare(
        `
          SELECT
            e.event_id,
            e.event_type,
            e.metadata_json,
            e.payload_json,
            e.local_only,
            mc.model_call_id,
            mc.provider_id,
            mc.model_id,
            mc.cloud_call,
            mc.prompt_payload_retained
          FROM model_calls mc
          INNER JOIN events e ON e.event_id = mc.event_id
          ORDER BY e.occurred_at_ms DESC, mc.model_call_id DESC
          LIMIT ?
        `,
      )
      .all(input.limit ?? 20) as ModelCallProjectionRow[];

    const { valid, errors } = normalizeRows(rows);
    return {
      projection_status: errors.length > 0 ? "degraded" : "ok",
      calls: valid.map(toRecentRecord),
      errors,
      posture: PROJECTION_POSTURE,
    } satisfies RecentModelCallsProjection;
  });

  return clone(projection);
}

export function getModelCallRollup(
  input: ModelCallProjectionOptions,
): ModelCallRollupProjection {
  const projection = withReadonlyDatabase(input.databasePath, (db) => {
    const rows = db
      .prepare(
        `
          SELECT
            e.event_id,
            e.event_type,
            e.metadata_json,
            e.payload_json,
            e.local_only,
            mc.model_call_id,
            mc.provider_id,
            mc.model_id,
            mc.cloud_call,
            mc.prompt_payload_retained
          FROM model_calls mc
          INNER JOIN events e ON e.event_id = mc.event_id
        `,
      )
      .all() as ModelCallProjectionRow[];

    const { valid, errors } = normalizeRows(rows);
    const records = valid.map(toRecentRecord);
    const tokenTotals = records.reduce<ModelProviderTokenUsage>(
      (totals, record) => ({
        input_tokens: totals.input_tokens + record.token_usage.input_tokens,
        output_tokens: totals.output_tokens + record.token_usage.output_tokens,
        total_tokens: totals.total_tokens + record.token_usage.total_tokens,
      }),
      ZERO_TOKEN_USAGE,
    );
    const successfulCalls = records.filter(
      (record) => record.status === "success",
    ).length;
    const failedCalls = records.length - successfulCalls;

    return {
      projection_status: errors.length > 0 ? "degraded" : "ok",
      total_calls: records.length,
      successful_calls: successfulCalls,
      failed_calls: failedCalls,
      degraded_calls: records.filter((record) => record.degraded).length,
      fallback_used_calls: records.filter((record) => record.fallback_used)
        .length,
      token_usage_totals: tokenTotals,
      latency_ms: summarizeLatency(records),
      calls_by_model: buckets(records.map((record) => record.model_id)),
      calls_by_provider_kind: buckets(
        records.map((record) => record.provider_kind),
      ),
      calls_by_runtime_class: buckets(
        records.map((record) => record.runtime_class),
      ),
      calls_by_capability: buckets(records.map((record) => record.capability)),
      calls_by_aux_task_kind: buckets(
        records.flatMap((record) =>
          record.aux_task_kind ? [record.aux_task_kind] : [],
        ),
      ),
      calls_by_status: buckets(records.map((record) => record.status)),
      failures_by_class: buckets(
        records.flatMap((record) =>
          record.failure_class ? [record.failure_class] : [],
        ),
      ),
      errors,
      posture: PROJECTION_POSTURE,
    } satisfies ModelCallRollupProjection;
  });

  return clone(projection);
}

function normalizeRows(rows: readonly ModelCallProjectionRow[]): {
  readonly valid: readonly NormalizedModelCallRow[];
  readonly errors: readonly string[];
} {
  const valid: NormalizedModelCallRow[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const event = parseSafeEvent(row);
    if (!event) {
      errors.push(`unsafe_model_call:${safeMetadataText(row.model_call_id)}`);
      continue;
    }
    valid.push({ row, event });
  }

  return { valid, errors };
}

function parseSafeEvent(row: ModelCallProjectionRow): ModelCallEvent | null {
  if (
    row.event_type !== "model.call" ||
    row.payload_json !== null ||
    row.local_only !== 1 ||
    row.cloud_call !== 0 ||
    row.prompt_payload_retained !== 0 ||
    UNSAFE_METADATA_PATTERN.test(row.metadata_json)
  ) {
    return null;
  }

  try {
    const parsedJson = JSON.parse(row.metadata_json) as unknown;
    const parsedEvent = ModelCallEventSchema.safeParse(parsedJson);
    if (!parsedEvent.success) return null;
    const event = parsedEvent.data;
    if (
      event.event_id !== row.event_id ||
      event.redaction_status !== "metadata_only" ||
      event.runtime_class === "cloud"
    ) {
      return null;
    }
    return event;
  } catch {
    return null;
  }
}

function toRecentRecord(input: NormalizedModelCallRow): RecentModelCallRecord {
  const { row, event } = input;
  const status: ModelCallStatus =
    event.successful_model === null || event.failure_class
      ? "failed"
      : "success";

  return {
    event_id: event.event_id,
    model_call_id: row.model_call_id,
    request_id: event.request_id,
    execution_id: event.execution_id,
    ...(event.aux_task_kind
      ? { aux_task_kind: safeMetadataText(event.aux_task_kind) }
      : {}),
    model_id: event.selected_model_id ?? row.model_id,
    provider_kind: event.provider_kind,
    runtime_class: event.runtime_class,
    capability: event.capability,
    status,
    ...(event.failure_class ? { failure_class: event.failure_class } : {}),
    token_usage: event.token_usage,
    latency_ms: event.latency_ms,
    fallback_used: event.fallback_used,
    degraded: event.degraded,
    created_at: event.created_at,
    redaction_status: event.redaction_status,
    metadata_only: true,
    raw_payload_included: false,
  };
}

function summarizeLatency(
  records: readonly RecentModelCallRecord[],
): ModelCallLatencySummary {
  if (records.length === 0) return ZERO_LATENCY;
  const latencies = records.map((record) => record.latency_ms);
  const total = latencies.reduce((sum, latency) => sum + latency, 0);
  return {
    min_ms: Math.min(...latencies),
    max_ms: Math.max(...latencies),
    average_ms: total / latencies.length,
  };
}

function buckets(
  values: readonly (string | null | undefined)[],
): ModelCallCountBucket[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = safeMetadataText(value ?? "unknown");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const UNSAFE_METADATA_PATTERN =
  /raw[_-]?(?:prompt|response|output|stream|payload)|stream[_-]?tokens|provider[_-]?payload|http[_-]?(?:request|response)[_-]?body|request[_-]?body|response[_-]?body|sk-[a-z0-9_-]+|api[_-]?key|secret|password|process\.env|import\.meta\.env/i;
