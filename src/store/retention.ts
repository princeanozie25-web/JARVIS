export const EVENT_STORE_RETENTION_TABLES = [
  "events",
  "room_events",
  "telemetry_events",
  "replay_traces",
  "runtime_executions",
  "approval_lifecycle",
  "routine_suggestions",
  "model_calls",
  "schema_migrations",
] as const;

export type EventStoreRetentionTable =
  (typeof EVENT_STORE_RETENTION_TABLES)[number];

export type RetentionWindow =
  | { readonly kind: "forever" }
  | { readonly kind: "days"; readonly days: 30 | 90 };

export interface RetentionRule {
  readonly table: EventStoreRetentionTable;
  readonly window: RetentionWindow;
  readonly raw_payload_retention_allowed: false;
}

export interface RetentionPreviewItem {
  readonly table: EventStoreRetentionTable;
  readonly retained_forever: boolean;
  readonly retention_days: 30 | 90 | null;
  readonly deletion_cutoff_ms: number | null;
  readonly retention_action: "none";
  readonly metadata_only: true;
  readonly raw_payload_retention_allowed: false;
  readonly mutation_executed: false;
}

export interface RetentionPreview {
  readonly generated_at_ms: number;
  readonly items: readonly RetentionPreviewItem[];
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly retention_execution_enabled: false;
  readonly delete_executed: false;
  readonly update_executed: false;
  readonly vacuum_executed: false;
}

export const EVENT_STORE_RETENTION_POLICY = {
  events: {
    table: "events",
    window: { kind: "forever" },
    raw_payload_retention_allowed: false,
  },
  room_events: {
    table: "room_events",
    window: { kind: "forever" },
    raw_payload_retention_allowed: false,
  },
  telemetry_events: {
    table: "telemetry_events",
    window: { kind: "days", days: 30 },
    raw_payload_retention_allowed: false,
  },
  replay_traces: {
    table: "replay_traces",
    window: { kind: "days", days: 90 },
    raw_payload_retention_allowed: false,
  },
  runtime_executions: {
    table: "runtime_executions",
    window: { kind: "days", days: 90 },
    raw_payload_retention_allowed: false,
  },
  approval_lifecycle: {
    table: "approval_lifecycle",
    window: { kind: "forever" },
    raw_payload_retention_allowed: false,
  },
  routine_suggestions: {
    table: "routine_suggestions",
    window: { kind: "days", days: 90 },
    raw_payload_retention_allowed: false,
  },
  model_calls: {
    table: "model_calls",
    window: { kind: "days", days: 30 },
    raw_payload_retention_allowed: false,
  },
  schema_migrations: {
    table: "schema_migrations",
    window: { kind: "forever" },
    raw_payload_retention_allowed: false,
  },
} as const satisfies Record<EventStoreRetentionTable, RetentionRule>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRetentionRule(table: string): RetentionRule {
  if (!isRetentionTable(table)) {
    throw new Error(`Unknown event-store retention table: ${table}.`);
  }
  return clone(EVENT_STORE_RETENTION_POLICY[table]);
}

export function previewRetention(input: {
  readonly nowMs: number;
  readonly tables?: readonly string[];
}): RetentionPreview {
  if (!Number.isInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("Retention preview requires a nonnegative integer clock.");
  }

  const tables = input.tables ?? EVENT_STORE_RETENTION_TABLES;
  const items = tables.map((table) =>
    previewRetentionTable(table, input.nowMs),
  );

  return clone({
    generated_at_ms: input.nowMs,
    items,
    metadata_only: true,
    raw_payload_included: false,
    retention_execution_enabled: false,
    delete_executed: false,
    update_executed: false,
    vacuum_executed: false,
  });
}

export function previewRetentionTable(
  table: string,
  nowMs: number,
): RetentionPreviewItem {
  const rule = getRetentionRule(table);
  if (rule.raw_payload_retention_allowed !== false) {
    throw new Error(`Raw payload retention is forbidden for ${table}.`);
  }

  if (rule.window.kind === "forever") {
    return clone({
      table: rule.table,
      retained_forever: true,
      retention_days: null,
      deletion_cutoff_ms: null,
      retention_action: "none",
      metadata_only: true,
      raw_payload_retention_allowed: false,
      mutation_executed: false,
    });
  }

  return clone({
    table: rule.table,
    retained_forever: false,
    retention_days: rule.window.days,
    deletion_cutoff_ms: nowMs - rule.window.days * DAY_MS,
    retention_action: "none",
    metadata_only: true,
    raw_payload_retention_allowed: false,
    mutation_executed: false,
  });
}

function isRetentionTable(table: string): table is EventStoreRetentionTable {
  return EVENT_STORE_RETENTION_TABLES.includes(
    table as EventStoreRetentionTable,
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
