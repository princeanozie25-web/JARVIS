import { describe, expect, it } from "vitest";

import {
  CalibrationCurrentMetricsSchema,
  CalibrationDiffTelemetryEventSchema,
  compareCalibrationToBaseline,
  createCalibrationDiffTelemetryEvent,
  type CalibrationBaseline,
  type CalibrationBaselineMetric,
  type CalibrationCurrentMetric,
  type CalibrationCurrentMetrics,
} from "./index";

function baselineMetric(
  group: CalibrationBaselineMetric["group"],
  count: number,
  overrides: Partial<CalibrationBaselineMetric> = {},
): CalibrationBaselineMetric {
  return {
    group,
    count,
    bins: [{ bin: "alias:default", count }],
    classes: [{ class: "hash:class-default", count }],
    metadata_only: true,
    counts_bins_classes_only: true,
    raw_text_included: false,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_vision_text_included: false,
    raw_environment_text_included: false,
    ...overrides,
  };
}

function currentMetric(
  group: CalibrationCurrentMetric["group"],
  count: number,
  overrides: Partial<CalibrationCurrentMetric> = {},
): CalibrationCurrentMetric {
  return {
    ...baselineMetric(group, count),
    confidence_band: "medium",
    realized_outcome_class: "expected",
    ...overrides,
  };
}

function baseline(overrides: Partial<CalibrationBaseline> = {}) {
  return {
    baseline_id_hash: "hash:baseline-1",
    window_kind: "30d",
    metrics: [
      baselineMetric("approvals", 10),
      baselineMetric("cost", 100),
      baselineMetric("vision", 4),
    ],
    updated_at_ms: 1_000,
    sample_size: 114,
    redaction_status: "metadata_only",
    previous_baseline_ref: "ref:baseline-prev",
    metadata_only: true,
    counts_bins_classes_only: true,
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
    ...overrides,
  } satisfies CalibrationBaseline;
}

function current(overrides: Partial<CalibrationCurrentMetrics> = {}) {
  return {
    current_id_hash: "hash:current-1",
    metrics: [
      currentMetric("approvals", 10),
      currentMetric("cost", 130),
      currentMetric("vision", 10, {
        confidence_band: "high",
        realized_outcome_class: "unexpected",
      }),
    ],
    observed_at_ms: 2_000,
    sample_size: 150,
    redaction_status: "metadata_only",
    metadata_only: true,
    counts_bins_classes_only: true,
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
    ...overrides,
  } satisfies CalibrationCurrentMetrics;
}

describe("Phase 8G.2 calibration diff and drift scaffold", () => {
  it("compares current metrics against baseline deterministically", () => {
    const first = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });
    const second = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      baseline_id_hash: "hash:baseline-1",
      current_id_hash: "hash:current-1",
      compared_group_count: 8,
      metadata_only: true,
      advisory_only: true,
      thresholds_changed: false,
      router_changed: false,
    });
    expect(
      first.drift_flags.find((flag) => flag.group === "cost"),
    ).toMatchObject({
      baseline_count: 100,
      current_count: 130,
      absolute_delta: 30,
      direction: "increased",
    });
  });

  it("returns coarse relative drift bands", () => {
    const diff = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });

    expect(
      diff.drift_flags.find((flag) => flag.group === "approvals"),
    ).toMatchObject({
      relative_delta_band: "none",
      drift_flag: "none",
      direction: "unchanged",
    });
    expect(
      diff.drift_flags.find((flag) => flag.group === "cost"),
    ).toMatchObject({
      relative_delta_band: "25_50pct",
      drift_flag: "medium",
    });
    expect(
      diff.drift_flags.find((flag) => flag.group === "vision"),
    ).toMatchObject({
      relative_delta_band: "50pct_plus",
      drift_flag: "high",
    });
  });

  it("keeps high drift advisory only", () => {
    const diff = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });
    const visionDrift = diff.drift_flags.find(
      (flag) => flag.group === "vision",
    );

    expect(visionDrift).toMatchObject({
      drift_flag: "high",
      advisory_only: true,
      thresholds_changed: false,
      budgets_changed: false,
      policies_changed: false,
      router_changed: false,
      approvals_triggered: false,
      actions_executed: false,
    });
    expect(diff.high_drift_count).toBe(1);
  });

  it("represents confidence miscalibration as metadata only", () => {
    const diff = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });

    expect(
      diff.drift_flags.find((flag) => flag.group === "vision"),
    ).toMatchObject({
      confidence_band: "high",
      realized_outcome_class: "unexpected",
      miscalibration_flag: "high",
      metadata_only: true,
      counts_and_flags_only: true,
    });
    expect(diff.miscalibration_count).toBe(1);
  });

  it("cannot change thresholds, budgets, policies, router behavior, approvals, or actions", () => {
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        thresholds_changed: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        budgets_changed: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        policies_changed: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        router_changed: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        approvals_triggered: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        actions_executed: true,
      }).success,
    ).toBe(false);
  });

  it("rejects raw report, project, vision, and environment content fields", () => {
    for (const field of [
      "raw_text",
      "raw_body",
      "raw_content",
      "project_name",
      "vision_text",
      "environment_text",
    ]) {
      expect(
        CalibrationCurrentMetricsSchema.safeParse({
          ...current(),
          [field]: "private payload",
        }).success,
      ).toBe(false);
    }

    expect(
      CalibrationCurrentMetricsSchema.safeParse({
        ...current(),
        raw_project_text_included: true,
      }).success,
    ).toBe(false);
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const diff = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });
    const telemetry = createCalibrationDiffTelemetryEvent(diff);

    expect(telemetry).toEqual({
      event_type: "calibration_diff_evaluated",
      compared_group_count: 8,
      high_drift_count: 1,
      medium_drift_count: 1,
      low_drift_count: 5,
      miscalibration_count: 1,
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
    expect(
      CalibrationDiffTelemetryEventSchema.safeParse({
        ...telemetry,
        raw_report_body: "private",
      }).success,
    ).toBe(false);
    expect(
      CalibrationDiffTelemetryEventSchema.safeParse({
        ...telemetry,
        network_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, write, LLM, network, tool, action, or mutation paths", () => {
    const diff = compareCalibrationToBaseline({
      baseline: baseline(),
      current: current(),
    });

    expect({
      dbRead: diff.db_read_performed,
      dbWrite: diff.db_write_performed,
      providerCalled: diff.provider_called,
      llmCalled: diff.llm_called,
      networkCalled: diff.network_called,
      cloudCalled: diff.cloud_called,
      toolCalled: diff.tool_called,
      actionsExecuted: diff.actions_executed,
      approvalsTriggered: diff.approvals_triggered,
      mutationPerformed: diff.mutation_performed,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionsExecuted: false,
      approvalsTriggered: false,
      mutationPerformed: false,
    });
  });
});
