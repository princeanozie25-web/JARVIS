import { z } from "zod";

import {
  CALIBRATION_BASELINE_REDACTION_STATUSES,
  CALIBRATION_METRIC_GROUPS,
  CalibrationBaselineMetricSchema,
  CalibrationBaselineSchema,
  CalibrationMetricGroupSchema,
  type CalibrationBaseline,
  type CalibrationMetricGroup,
} from "./calibration-baseline";

export const CALIBRATION_RELATIVE_DELTA_BANDS = [
  "none",
  "lt_10pct",
  "10_25pct",
  "25_50pct",
  "50pct_plus",
  "unknown",
] as const;

export const CALIBRATION_DRIFT_FLAGS = [
  "none",
  "low",
  "medium",
  "high",
] as const;

export const CALIBRATION_DIFF_DIRECTIONS = [
  "increased",
  "decreased",
  "unchanged",
  "unknown",
] as const;

export const CALIBRATION_CONFIDENCE_BANDS = [
  "unknown",
  "low",
  "medium",
  "high",
] as const;

export const CALIBRATION_REALIZED_OUTCOME_CLASSES = [
  "unknown",
  "expected",
  "unexpected",
  "mixed",
] as const;

export const CALIBRATION_DIFF_TELEMETRY_EVENT_TYPES = [
  "calibration_diff_evaluated",
] as const;

export type CalibrationRelativeDeltaBand =
  (typeof CALIBRATION_RELATIVE_DELTA_BANDS)[number];
export type CalibrationDriftFlagName = (typeof CALIBRATION_DRIFT_FLAGS)[number];
export type CalibrationDiffDirection =
  (typeof CALIBRATION_DIFF_DIRECTIONS)[number];
export type CalibrationConfidenceBand =
  (typeof CALIBRATION_CONFIDENCE_BANDS)[number];
export type CalibrationRealizedOutcomeClass =
  (typeof CALIBRATION_REALIZED_OUTCOME_CLASSES)[number];
export type CalibrationDiffTelemetryEventType =
  (typeof CALIBRATION_DIFF_TELEMETRY_EVENT_TYPES)[number];

export const CalibrationRelativeDeltaBandSchema = z.enum(
  CALIBRATION_RELATIVE_DELTA_BANDS,
);
export const CalibrationDriftFlagNameSchema = z.enum(CALIBRATION_DRIFT_FLAGS);
export const CalibrationDiffDirectionSchema = z.enum(
  CALIBRATION_DIFF_DIRECTIONS,
);
export const CalibrationConfidenceBandSchema = z.enum(
  CALIBRATION_CONFIDENCE_BANDS,
);
export const CalibrationRealizedOutcomeClassSchema = z.enum(
  CALIBRATION_REALIZED_OUTCOME_CLASSES,
);
export const CalibrationDiffTelemetryEventTypeSchema = z.enum(
  CALIBRATION_DIFF_TELEMETRY_EVENT_TYPES,
);

export const CalibrationCurrentMetricSchema =
  CalibrationBaselineMetricSchema.extend({
    confidence_band: CalibrationConfidenceBandSchema,
    realized_outcome_class: CalibrationRealizedOutcomeClassSchema,
  });

export const CalibrationCurrentMetricsSchema = z
  .strictObject({
    current_id_hash: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^(alias|hash|ref):[a-z0-9._:-]+$/),
    metrics: z
      .array(CalibrationCurrentMetricSchema)
      .max(CALIBRATION_METRIC_GROUPS.length),
    observed_at_ms: z.number().int().nonnegative(),
    sample_size: z.number().int().nonnegative(),
    redaction_status: z.enum(CALIBRATION_BASELINE_REDACTION_STATUSES),
    metadata_only: z.literal(true),
    counts_bins_classes_only: z.literal(true),
    raw_text_included: z.literal(false),
    raw_body_included: z.literal(false),
    raw_content_included: z.literal(false),
    raw_project_text_included: z.literal(false),
    raw_vision_text_included: z.literal(false),
    raw_environment_text_included: z.literal(false),
    thresholds_changed: z.literal(false),
    budgets_changed: z.literal(false),
    policies_changed: z.literal(false),
    router_changed: z.literal(false),
    approvals_triggered: z.literal(false),
    actions_executed: z.literal(false),
    db_read_performed: z.literal(false),
    db_write_performed: z.literal(false),
    provider_called: z.literal(false),
    llm_called: z.literal(false),
    network_called: z.literal(false),
    cloud_called: z.literal(false),
    tool_called: z.literal(false),
    mutation_performed: z.literal(false),
  })
  .refine(
    (current) => {
      const groups = current.metrics.map((metric) => metric.group);
      return new Set(groups).size === groups.length;
    },
    { message: "calibration current metric groups must be unique" },
  );

export const CalibrationDriftFlagSchema = z.strictObject({
  group: CalibrationMetricGroupSchema,
  baseline_count: z.number().int().nonnegative().nullable(),
  current_count: z.number().int().nonnegative().nullable(),
  absolute_delta: z.number().int().nonnegative(),
  relative_delta_band: CalibrationRelativeDeltaBandSchema,
  drift_flag: CalibrationDriftFlagNameSchema,
  direction: CalibrationDiffDirectionSchema,
  confidence_band: CalibrationConfidenceBandSchema,
  realized_outcome_class: CalibrationRealizedOutcomeClassSchema,
  miscalibration_flag: CalibrationDriftFlagNameSchema,
  advisory_only: z.literal(true),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  thresholds_changed: z.literal(false),
  budgets_changed: z.literal(false),
  policies_changed: z.literal(false),
  router_changed: z.literal(false),
  approvals_triggered: z.literal(false),
  actions_executed: z.literal(false),
});

export const CalibrationDiffSchema = z.strictObject({
  baseline_id_hash: z.string().min(1).max(160),
  current_id_hash: z.string().min(1).max(160),
  compared_group_count: z.number().int().nonnegative(),
  high_drift_count: z.number().int().nonnegative(),
  medium_drift_count: z.number().int().nonnegative(),
  low_drift_count: z.number().int().nonnegative(),
  miscalibration_count: z.number().int().nonnegative(),
  drift_flags: z
    .array(CalibrationDriftFlagSchema)
    .max(CALIBRATION_METRIC_GROUPS.length),
  redaction_status: z.enum(CALIBRATION_BASELINE_REDACTION_STATUSES),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_text_included: z.literal(false),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_vision_text_included: z.literal(false),
  raw_environment_text_included: z.literal(false),
  thresholds_changed: z.literal(false),
  budgets_changed: z.literal(false),
  policies_changed: z.literal(false),
  router_changed: z.literal(false),
  approvals_triggered: z.literal(false),
  actions_executed: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CalibrationDiffTelemetryEventSchema = z.strictObject({
  event_type: CalibrationDiffTelemetryEventTypeSchema,
  compared_group_count: z.number().int().nonnegative(),
  high_drift_count: z.number().int().nonnegative(),
  medium_drift_count: z.number().int().nonnegative(),
  low_drift_count: z.number().int().nonnegative(),
  miscalibration_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  thresholds_changed: z.literal(false),
  budgets_changed: z.literal(false),
  policies_changed: z.literal(false),
  router_changed: z.literal(false),
  approvals_triggered: z.literal(false),
  actions_executed: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  mutation_performed: z.literal(false),
});

export type CalibrationCurrentMetric = z.infer<
  typeof CalibrationCurrentMetricSchema
>;
export type CalibrationCurrentMetrics = z.infer<
  typeof CalibrationCurrentMetricsSchema
>;
export type CalibrationDriftFlag = z.infer<typeof CalibrationDriftFlagSchema>;
export type CalibrationDiff = z.infer<typeof CalibrationDiffSchema>;
export type CalibrationDiffTelemetryEvent = z.infer<
  typeof CalibrationDiffTelemetryEventSchema
>;

function relativeBand(
  baselineCount: number | null,
  currentCount: number | null,
): CalibrationRelativeDeltaBand {
  if (baselineCount === null || currentCount === null) {
    return "unknown";
  }
  if (baselineCount === 0 && currentCount === 0) {
    return "none";
  }
  if (baselineCount === 0) {
    return "unknown";
  }

  const relativeDelta = Math.abs(currentCount - baselineCount) / baselineCount;
  if (relativeDelta === 0) {
    return "none";
  }
  if (relativeDelta < 0.1) {
    return "lt_10pct";
  }
  if (relativeDelta < 0.25) {
    return "10_25pct";
  }
  if (relativeDelta < 0.5) {
    return "25_50pct";
  }
  return "50pct_plus";
}

function driftFlag(
  relativeDeltaBand: CalibrationRelativeDeltaBand,
): CalibrationDriftFlagName {
  if (relativeDeltaBand === "50pct_plus" || relativeDeltaBand === "unknown") {
    return relativeDeltaBand === "unknown" ? "low" : "high";
  }
  if (relativeDeltaBand === "25_50pct") {
    return "medium";
  }
  if (relativeDeltaBand === "10_25pct" || relativeDeltaBand === "lt_10pct") {
    return "low";
  }
  return "none";
}

function direction(
  baselineCount: number | null,
  currentCount: number | null,
): CalibrationDiffDirection {
  if (baselineCount === null || currentCount === null) {
    return "unknown";
  }
  if (currentCount > baselineCount) {
    return "increased";
  }
  if (currentCount < baselineCount) {
    return "decreased";
  }
  return "unchanged";
}

function miscalibrationFlag(
  confidenceBand: CalibrationConfidenceBand,
  realizedOutcomeClass: CalibrationRealizedOutcomeClass,
): CalibrationDriftFlagName {
  if (realizedOutcomeClass === "unknown" || confidenceBand === "unknown") {
    return "none";
  }
  if (confidenceBand === "high" && realizedOutcomeClass === "unexpected") {
    return "high";
  }
  if (confidenceBand === "medium" && realizedOutcomeClass === "unexpected") {
    return "medium";
  }
  if (realizedOutcomeClass === "mixed") {
    return confidenceBand === "high" ? "medium" : "low";
  }
  return "none";
}

function metricByGroup<T extends { group: CalibrationMetricGroup }>(
  metrics: T[],
): Map<CalibrationMetricGroup, T> {
  return new Map(metrics.map((metric) => [metric.group, metric]));
}

export function compareCalibrationToBaseline(input: {
  baseline: CalibrationBaseline;
  current: CalibrationCurrentMetrics;
}): CalibrationDiff {
  const baseline = CalibrationBaselineSchema.parse(input.baseline);
  const current = CalibrationCurrentMetricsSchema.parse(input.current);
  const baselineMetrics = metricByGroup(baseline.metrics);
  const currentMetrics = metricByGroup(current.metrics);

  const driftFlags = CALIBRATION_METRIC_GROUPS.map((group) => {
    const baselineMetric = baselineMetrics.get(group);
    const currentMetric = currentMetrics.get(group);
    const baselineCount = baselineMetric?.count ?? null;
    const currentCount = currentMetric?.count ?? null;
    const relativeDeltaBand = relativeBand(baselineCount, currentCount);
    const confidenceBand = currentMetric?.confidence_band ?? "unknown";
    const realizedOutcomeClass =
      currentMetric?.realized_outcome_class ?? "unknown";

    return CalibrationDriftFlagSchema.parse({
      group,
      baseline_count: baselineCount,
      current_count: currentCount,
      absolute_delta:
        baselineCount === null || currentCount === null
          ? 0
          : Math.abs(currentCount - baselineCount),
      relative_delta_band: relativeDeltaBand,
      drift_flag: driftFlag(relativeDeltaBand),
      direction: direction(baselineCount, currentCount),
      confidence_band: confidenceBand,
      realized_outcome_class: realizedOutcomeClass,
      miscalibration_flag: miscalibrationFlag(
        confidenceBand,
        realizedOutcomeClass,
      ),
      advisory_only: true,
      metadata_only: true,
      counts_and_flags_only: true,
      thresholds_changed: false,
      budgets_changed: false,
      policies_changed: false,
      router_changed: false,
      approvals_triggered: false,
      actions_executed: false,
    });
  });

  return CalibrationDiffSchema.parse({
    baseline_id_hash: baseline.baseline_id_hash,
    current_id_hash: current.current_id_hash,
    compared_group_count: driftFlags.length,
    high_drift_count: driftFlags.filter((flag) => flag.drift_flag === "high")
      .length,
    medium_drift_count: driftFlags.filter(
      (flag) => flag.drift_flag === "medium",
    ).length,
    low_drift_count: driftFlags.filter((flag) => flag.drift_flag === "low")
      .length,
    miscalibration_count: driftFlags.filter(
      (flag) => flag.miscalibration_flag !== "none",
    ).length,
    drift_flags: driftFlags,
    redaction_status:
      baseline.redaction_status === "redacted" ||
      current.redaction_status === "redacted"
        ? "redacted"
        : "metadata_only",
    metadata_only: true,
    advisory_only: true,
    counts_and_flags_only: true,
    raw_text_included: false,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_vision_text_included: false,
    raw_environment_text_included: false,
    thresholds_changed: false,
    budgets_changed: false,
    policies_changed: false,
    router_changed: false,
    approvals_triggered: false,
    actions_executed: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    mutation_performed: false,
  });
}

export function createCalibrationDiffTelemetryEvent(
  diffInput: CalibrationDiff,
): CalibrationDiffTelemetryEvent {
  const diff = CalibrationDiffSchema.parse(diffInput);
  return CalibrationDiffTelemetryEventSchema.parse({
    event_type: "calibration_diff_evaluated",
    compared_group_count: diff.compared_group_count,
    high_drift_count: diff.high_drift_count,
    medium_drift_count: diff.medium_drift_count,
    low_drift_count: diff.low_drift_count,
    miscalibration_count: diff.miscalibration_count,
    metadata_only: true,
    counts_and_flags_only: true,
    thresholds_changed: false,
    budgets_changed: false,
    policies_changed: false,
    router_changed: false,
    approvals_triggered: false,
    actions_executed: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    mutation_performed: false,
  });
}
