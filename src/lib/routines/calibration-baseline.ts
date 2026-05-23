import { z } from "zod";

export const CALIBRATION_BASELINE_WINDOW_KINDS = ["7d", "30d"] as const;

export const CALIBRATION_METRIC_GROUPS = [
  "approvals",
  "tools",
  "cost",
  "vision",
  "environment",
  "projects",
  "router",
  "safety",
] as const;

export const CALIBRATION_BASELINE_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const CALIBRATION_BASELINE_VALIDATION_REASONS = [
  "valid",
  "invalid_schema",
  "raw_payload_rejected",
  "unsafe_reference_rejected",
  "mutation_flag_rejected",
] as const;

export const CALIBRATION_BASELINE_TELEMETRY_EVENT_TYPES = [
  "calibration_baseline_validated",
] as const;

export type BaselineWindowKind =
  (typeof CALIBRATION_BASELINE_WINDOW_KINDS)[number];
export type CalibrationMetricGroup = (typeof CALIBRATION_METRIC_GROUPS)[number];
export type CalibrationBaselineRedactionStatus =
  (typeof CALIBRATION_BASELINE_REDACTION_STATUSES)[number];
export type CalibrationBaselineValidationReason =
  (typeof CALIBRATION_BASELINE_VALIDATION_REASONS)[number];
export type CalibrationBaselineTelemetryEventType =
  (typeof CALIBRATION_BASELINE_TELEMETRY_EVENT_TYPES)[number];

const AliasHashOrRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^(alias|hash|ref):[a-z0-9._:-]+$/);

const CalibrationBaselineBinSchema = z.strictObject({
  bin: AliasHashOrRefSchema,
  count: z.number().int().nonnegative(),
});

const CalibrationBaselineClassSchema = z.strictObject({
  class: AliasHashOrRefSchema,
  count: z.number().int().nonnegative(),
});

export const BaselineWindowKindSchema = z.enum(
  CALIBRATION_BASELINE_WINDOW_KINDS,
);
export const CalibrationMetricGroupSchema = z.enum(CALIBRATION_METRIC_GROUPS);
export const CalibrationBaselineRedactionStatusSchema = z.enum(
  CALIBRATION_BASELINE_REDACTION_STATUSES,
);
export const CalibrationBaselineValidationReasonSchema = z.enum(
  CALIBRATION_BASELINE_VALIDATION_REASONS,
);
export const CalibrationBaselineTelemetryEventTypeSchema = z.enum(
  CALIBRATION_BASELINE_TELEMETRY_EVENT_TYPES,
);

export const CalibrationBaselineMetricSchema = z.strictObject({
  group: CalibrationMetricGroupSchema,
  count: z.number().int().nonnegative(),
  bins: z.array(CalibrationBaselineBinSchema).max(32),
  classes: z.array(CalibrationBaselineClassSchema).max(32),
  metadata_only: z.literal(true),
  counts_bins_classes_only: z.literal(true),
  raw_text_included: z.literal(false),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_vision_text_included: z.literal(false),
  raw_environment_text_included: z.literal(false),
});

export const CalibrationBaselineSchema = z
  .strictObject({
    baseline_id_hash: AliasHashOrRefSchema,
    window_kind: BaselineWindowKindSchema,
    metrics: z
      .array(CalibrationBaselineMetricSchema)
      .max(CALIBRATION_METRIC_GROUPS.length),
    updated_at_ms: z.number().int().nonnegative(),
    sample_size: z.number().int().nonnegative(),
    redaction_status: CalibrationBaselineRedactionStatusSchema,
    previous_baseline_ref: AliasHashOrRefSchema.nullable(),
    metadata_only: z.literal(true),
    counts_bins_classes_only: z.literal(true),
    raw_text_included: z.literal(false),
    raw_body_included: z.literal(false),
    raw_content_included: z.literal(false),
    raw_project_text_included: z.literal(false),
    raw_vision_text_included: z.literal(false),
    raw_environment_text_included: z.literal(false),
    baseline_persisted: z.literal(false),
    automatic_update_performed: z.literal(false),
    threshold_updated: z.literal(false),
    budget_updated: z.literal(false),
    policy_mutated: z.literal(false),
    router_mutated: z.literal(false),
    db_read_performed: z.literal(false),
    db_write_performed: z.literal(false),
    provider_called: z.literal(false),
    llm_called: z.literal(false),
    network_called: z.literal(false),
    cloud_called: z.literal(false),
    tool_called: z.literal(false),
    action_executed: z.literal(false),
    approval_triggered: z.literal(false),
    mutation_performed: z.literal(false),
  })
  .refine(
    (baseline) => {
      const groups = baseline.metrics.map((metric) => metric.group);
      return new Set(groups).size === groups.length;
    },
    { message: "calibration baseline metric groups must be unique" },
  );

export const CalibrationBaselineValidationSchema = z.strictObject({
  valid: z.boolean(),
  reasons: z.array(CalibrationBaselineValidationReasonSchema),
  metric_group_count: z.number().int().nonnegative(),
  sample_size: z.number().int().nonnegative(),
  bin_count: z.number().int().nonnegative(),
  class_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  baseline_persisted: z.literal(false),
  automatic_update_performed: z.literal(false),
  threshold_updated: z.literal(false),
  budget_updated: z.literal(false),
  policy_mutated: z.literal(false),
  router_mutated: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CalibrationBaselineSummarySchema = z.strictObject({
  baseline_id_hash: AliasHashOrRefSchema,
  window_kind: BaselineWindowKindSchema,
  metric_group_count: z.number().int().nonnegative(),
  sample_size: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  bin_count: z.number().int().nonnegative(),
  class_count: z.number().int().nonnegative(),
  updated_at_ms: z.number().int().nonnegative(),
  has_previous_baseline: z.boolean(),
  redaction_status: CalibrationBaselineRedactionStatusSchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_text_included: z.literal(false),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_vision_text_included: z.literal(false),
  raw_environment_text_included: z.literal(false),
  baseline_persisted: z.literal(false),
  automatic_update_performed: z.literal(false),
  threshold_updated: z.literal(false),
  budget_updated: z.literal(false),
  policy_mutated: z.literal(false),
  router_mutated: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CalibrationBaselineTelemetryEventSchema = z.strictObject({
  event_type: CalibrationBaselineTelemetryEventTypeSchema,
  valid: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  metric_group_count: z.number().int().nonnegative(),
  sample_size: z.number().int().nonnegative(),
  bin_count: z.number().int().nonnegative(),
  class_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  baseline_persisted: z.literal(false),
  automatic_update_performed: z.literal(false),
  threshold_updated: z.literal(false),
  budget_updated: z.literal(false),
  policy_mutated: z.literal(false),
  router_mutated: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export type CalibrationBaselineMetric = z.infer<
  typeof CalibrationBaselineMetricSchema
>;
export type CalibrationBaseline = z.infer<typeof CalibrationBaselineSchema>;
export type CalibrationBaselineValidation = z.infer<
  typeof CalibrationBaselineValidationSchema
>;
export type CalibrationBaselineSummary = z.infer<
  typeof CalibrationBaselineSummarySchema
>;
export type CalibrationBaselineTelemetryEvent = z.infer<
  typeof CalibrationBaselineTelemetryEventSchema
>;

function countBins(baseline: CalibrationBaseline): number {
  return baseline.metrics.reduce(
    (total, metric) => total + metric.bins.length,
    0,
  );
}

function countClasses(baseline: CalibrationBaseline): number {
  return baseline.metrics.reduce(
    (total, metric) => total + metric.classes.length,
    0,
  );
}

function validationReasons(
  issues: z.ZodIssue[],
): CalibrationBaselineValidationReason[] {
  const reasons = new Set<CalibrationBaselineValidationReason>([
    "invalid_schema",
  ]);

  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path.includes("raw_")) {
      reasons.add("raw_payload_rejected");
    }
    if (path.includes("previous_baseline_ref")) {
      reasons.add("unsafe_reference_rejected");
    }
    if (
      path.includes("threshold_updated") ||
      path.includes("budget_updated") ||
      path.includes("policy_mutated") ||
      path.includes("router_mutated") ||
      path.includes("mutation_performed")
    ) {
      reasons.add("mutation_flag_rejected");
    }
  }

  return [...reasons];
}

export function validateCalibrationBaseline(
  input: unknown,
): CalibrationBaselineValidation {
  const parsed = CalibrationBaselineSchema.safeParse(input);
  if (!parsed.success) {
    return CalibrationBaselineValidationSchema.parse({
      valid: false,
      reasons: validationReasons(parsed.error.issues),
      metric_group_count: 0,
      sample_size: 0,
      bin_count: 0,
      class_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      baseline_persisted: false,
      automatic_update_performed: false,
      threshold_updated: false,
      budget_updated: false,
      policy_mutated: false,
      router_mutated: false,
      db_read_performed: false,
      db_write_performed: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
      mutation_performed: false,
    });
  }

  return CalibrationBaselineValidationSchema.parse({
    valid: true,
    reasons: ["valid"],
    metric_group_count: parsed.data.metrics.length,
    sample_size: parsed.data.sample_size,
    bin_count: countBins(parsed.data),
    class_count: countClasses(parsed.data),
    metadata_only: true,
    counts_and_flags_only: true,
    baseline_persisted: false,
    automatic_update_performed: false,
    threshold_updated: false,
    budget_updated: false,
    policy_mutated: false,
    router_mutated: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    mutation_performed: false,
  });
}

export function summarizeCalibrationBaseline(
  input: CalibrationBaseline,
): CalibrationBaselineSummary {
  const baseline = CalibrationBaselineSchema.parse(input);
  return CalibrationBaselineSummarySchema.parse({
    baseline_id_hash: baseline.baseline_id_hash,
    window_kind: baseline.window_kind,
    metric_group_count: baseline.metrics.length,
    sample_size: baseline.sample_size,
    total_count: baseline.metrics.reduce(
      (total, metric) => total + metric.count,
      0,
    ),
    bin_count: countBins(baseline),
    class_count: countClasses(baseline),
    updated_at_ms: baseline.updated_at_ms,
    has_previous_baseline: baseline.previous_baseline_ref !== null,
    redaction_status: baseline.redaction_status,
    metadata_only: true,
    counts_and_flags_only: true,
    raw_text_included: false,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_vision_text_included: false,
    raw_environment_text_included: false,
    baseline_persisted: false,
    automatic_update_performed: false,
    threshold_updated: false,
    budget_updated: false,
    policy_mutated: false,
    router_mutated: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    mutation_performed: false,
  });
}

export function createCalibrationBaselineTelemetryEvent(
  validationInput: CalibrationBaselineValidation,
): CalibrationBaselineTelemetryEvent {
  const validation = CalibrationBaselineValidationSchema.parse(validationInput);
  return CalibrationBaselineTelemetryEventSchema.parse({
    event_type: "calibration_baseline_validated",
    valid: validation.valid,
    violation_count: validation.valid ? 0 : validation.reasons.length,
    metric_group_count: validation.metric_group_count,
    sample_size: validation.sample_size,
    bin_count: validation.bin_count,
    class_count: validation.class_count,
    metadata_only: true,
    counts_and_flags_only: true,
    baseline_persisted: false,
    automatic_update_performed: false,
    threshold_updated: false,
    budget_updated: false,
    policy_mutated: false,
    router_mutated: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    mutation_performed: false,
  });
}
