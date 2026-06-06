import { z } from "zod";

import { ModelTierSchema } from "./schema";
import type { ModelRegistryEntry } from "./types";

export const MODEL_REGISTRY_STALENESS_STATUSES = [
  "OK",
  "EOL_SOON",
  "RETIRED",
  "UNKNOWN",
] as const;

export const MODEL_REGISTRY_STALENESS_WARNING_WINDOW_DAYS = 60;

export type ModelRegistryStalenessStatus =
  (typeof MODEL_REGISTRY_STALENESS_STATUSES)[number];

export const ModelRegistryStalenessStatusSchema = z.enum(
  MODEL_REGISTRY_STALENESS_STATUSES,
);

export const ModelRegistryStalenessRowSchema = z.strictObject({
  id: z.string().trim().min(1).max(160),
  model_name: z.string().trim().min(1).max(160),
  tier: ModelTierSchema,
  eol_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  daysRemaining: z.number().int().nullable(),
  status: ModelRegistryStalenessStatusSchema,
  replacement_id: z.string().trim().min(1).max(160).nullable(),
});

export const ModelRegistryStalenessReportSchema = z.strictObject({
  warning_window_days: z.literal(MODEL_REGISTRY_STALENESS_WARNING_WINDOW_DAYS),
  rows: z.array(ModelRegistryStalenessRowSchema),
  summary: z.string().trim().min(1).max(360),
  retired_count: z.number().int().nonnegative(),
  eol_soon_count: z.number().int().nonnegative(),
  ok_count: z.number().int().nonnegative(),
  unknown_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  registry_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  router_mutation_enabled: z.literal(false),
  runtime_mutation_enabled: z.literal(false),
});

export type ModelRegistryStalenessRow = z.infer<
  typeof ModelRegistryStalenessRowSchema
>;
export type ModelRegistryStalenessReport = z.infer<
  typeof ModelRegistryStalenessReportSchema
>;

export function evaluateModelRegistryStaleness(
  entries: readonly ModelRegistryEntry[],
  now: Date | string,
): ModelRegistryStalenessReport {
  const nowDate = normalizeDate(now);
  const rows = entries.map((entry) => evaluateEntryStaleness(entry, nowDate));
  const retiredCount = rows.filter((row) => row.status === "RETIRED").length;
  const eolSoonCount = rows.filter((row) => row.status === "EOL_SOON").length;
  const okCount = rows.filter((row) => row.status === "OK").length;
  const unknownCount = rows.filter((row) => row.status === "UNKNOWN").length;

  return ModelRegistryStalenessReportSchema.parse({
    warning_window_days: MODEL_REGISTRY_STALENESS_WARNING_WINDOW_DAYS,
    rows,
    summary: summarizeModelRegistryStalenessRows(rows),
    retired_count: retiredCount,
    eol_soon_count: eolSoonCount,
    ok_count: okCount,
    unknown_count: unknownCount,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    registry_mutation_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    router_mutation_enabled: false,
    runtime_mutation_enabled: false,
  });
}

export function summarizeModelRegistryStalenessRows(
  rows: readonly ModelRegistryStalenessRow[],
): string {
  const retired = rows.filter((row) => row.status === "RETIRED");
  const eolSoon = rows
    .filter((row) => row.status === "EOL_SOON")
    .sort(
      (left, right) =>
        (left.daysRemaining ?? Number.MAX_SAFE_INTEGER) -
        (right.daysRemaining ?? Number.MAX_SAFE_INTEGER),
    );

  if (retired.length > 0) {
    return `${retired.length} model${retired.length === 1 ? "" : "s"} retired: ${retired.map(formatReplacement).join(", ")}`;
  }

  if (eolSoon.length > 0) {
    const first = eolSoon[0];
    const dayLabel =
      first.daysRemaining === 1 ? "1 day" : `${first.daysRemaining} days`;

    return `${eolSoon.length} model${eolSoon.length === 1 ? "" : "s"} retire${eolSoon.length === 1 ? "s" : ""} in ${dayLabel}: ${eolSoon.map(formatReplacement).join(", ")}`;
  }

  if (rows.length === 0) {
    return "No model registry entries supplied for EOL staleness inspection.";
  }

  return "No enabled registry models are retired or within 60 days of EOL.";
}

function evaluateEntryStaleness(
  entry: ModelRegistryEntry,
  nowDate: Date,
): ModelRegistryStalenessRow {
  const eolDate = entry.eol_date ?? null;

  if (entry.visibility !== "enabled" || !eolDate) {
    return row(entry, {
      eol_date: eolDate,
      daysRemaining: null,
      status: "UNKNOWN",
    });
  }

  const daysRemaining = daysBetween(nowDate, parseIsoDateOnly(eolDate));
  const status: ModelRegistryStalenessStatus =
    daysRemaining < 0
      ? "RETIRED"
      : daysRemaining <= MODEL_REGISTRY_STALENESS_WARNING_WINDOW_DAYS
        ? "EOL_SOON"
        : "OK";

  return row(entry, {
    eol_date: eolDate,
    daysRemaining,
    status,
  });
}

function row(
  entry: ModelRegistryEntry,
  input: Pick<
    ModelRegistryStalenessRow,
    "eol_date" | "daysRemaining" | "status"
  >,
): ModelRegistryStalenessRow {
  return ModelRegistryStalenessRowSchema.parse({
    id: entry.id,
    model_name: entry.id,
    tier: entry.tier,
    eol_date: input.eol_date,
    daysRemaining: input.daysRemaining,
    status: input.status,
    replacement_id: entry.replacement_id ?? null,
  });
}

function formatReplacement(row: ModelRegistryStalenessRow): string {
  return row.replacement_id ? `${row.id} -> ${row.replacement_id}` : row.id;
}

function normalizeDate(value: Date | string): Date {
  if (value instanceof Date) {
    return utcDayStart(value);
  }

  return utcDayStart(new Date(value));
}

function parseIsoDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function utcDayStart(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function daysBetween(left: Date, right: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((right.getTime() - left.getTime()) / millisecondsPerDay);
}
