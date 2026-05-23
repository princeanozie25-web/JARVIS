import { describe, expect, it } from "vitest";

import {
  BaselineWindowKindSchema,
  CalibrationBaselineSchema,
  CalibrationBaselineTelemetryEventSchema,
  createCalibrationBaselineTelemetryEvent,
  summarizeCalibrationBaseline,
  validateCalibrationBaseline,
  type BaselineWindowKind,
  type CalibrationBaseline,
  type CalibrationBaselineMetric,
} from "./index";

function metric(
  group: CalibrationBaselineMetric["group"] = "approvals",
  overrides: Partial<CalibrationBaselineMetric> = {},
): CalibrationBaselineMetric {
  return {
    group,
    count: 3,
    bins: [{ bin: "alias:low", count: 1 }],
    classes: [{ class: "hash:class-a", count: 2 }],
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

function baseline(
  overrides: Partial<CalibrationBaseline> = {},
): CalibrationBaseline {
  return {
    baseline_id_hash: "hash:baseline-1",
    window_kind: "7d",
    metrics: [metric("approvals"), metric("cost", { count: 5 })],
    updated_at_ms: 1_000,
    sample_size: 8,
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
  };
}

describe("Phase 8G.1 calibration baseline scaffold", () => {
  it("validates metadata-only calibration baselines", () => {
    const validation = validateCalibrationBaseline(baseline());

    expect(validation).toMatchObject({
      valid: true,
      reasons: ["valid"],
      metric_group_count: 2,
      sample_size: 8,
      bin_count: 2,
      class_count: 2,
      metadata_only: true,
      threshold_updated: false,
      router_mutated: false,
      db_write_performed: false,
    });
  });

  it("supports only 7d and 30d baseline windows", () => {
    for (const windowKind of ["7d", "30d"] satisfies BaselineWindowKind[]) {
      expect(
        CalibrationBaselineSchema.safeParse(
          baseline({ window_kind: windowKind }),
        ).success,
      ).toBe(true);
    }

    expect(BaselineWindowKindSchema.safeParse("14d").success).toBe(false);
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        window_kind: "90d",
      }).success,
    ).toBe(false);
  });

  it("rejects raw report, project, vision, and environment payload fields", () => {
    for (const field of [
      "raw_text",
      "raw_body",
      "raw_content",
      "project_name",
      "vision_text",
      "environment_text",
    ]) {
      expect(
        CalibrationBaselineSchema.safeParse({
          ...baseline(),
          [field]: "private payload",
        }).success,
      ).toBe(false);
    }

    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        raw_project_text_included: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        metrics: [{ ...metric("vision"), raw_vision_text_included: true }],
      }).success,
    ).toBe(false);
  });

  it("requires previous baseline reference to be hash/ref metadata only", () => {
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        previous_baseline_ref: "hash:baseline-prev",
      }).success,
    ).toBe(true);
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        previous_baseline_ref: null,
      }).success,
    ).toBe(true);
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        previous_baseline_ref: "daily baseline title",
      }).success,
    ).toBe(false);
  });

  it("summarizes baselines with counts and flags only", () => {
    const summary = summarizeCalibrationBaseline(baseline());

    expect(summary).toEqual({
      baseline_id_hash: "hash:baseline-1",
      window_kind: "7d",
      metric_group_count: 2,
      sample_size: 8,
      total_count: 8,
      bin_count: 2,
      class_count: 2,
      updated_at_ms: 1_000,
      has_previous_baseline: true,
      redaction_status: "metadata_only",
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
    expect("raw_body" in summary).toBe(false);
    expect("content" in summary).toBe(false);
    expect("project_name" in summary).toBe(false);
  });

  it("does not update thresholds, budgets, policies, or router behavior", () => {
    const validation = validateCalibrationBaseline(baseline());

    expect(validation).toMatchObject({
      threshold_updated: false,
      budget_updated: false,
      policy_mutated: false,
      router_mutated: false,
      automatic_update_performed: false,
      baseline_persisted: false,
    });
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        threshold_updated: true,
      }).success,
    ).toBe(false);
    expect(
      CalibrationBaselineSchema.safeParse({
        ...baseline(),
        policy_mutated: true,
      }).success,
    ).toBe(false);
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const validation = validateCalibrationBaseline(baseline());
    const telemetry = createCalibrationBaselineTelemetryEvent(validation);

    expect(telemetry).toEqual({
      event_type: "calibration_baseline_validated",
      valid: true,
      violation_count: 0,
      metric_group_count: 2,
      sample_size: 8,
      bin_count: 2,
      class_count: 2,
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
    expect(
      CalibrationBaselineTelemetryEventSchema.safeParse({
        ...telemetry,
        raw_report_body: "private",
      }).success,
    ).toBe(false);
    expect(
      CalibrationBaselineTelemetryEventSchema.safeParse({
        ...telemetry,
        network_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, write, LLM, network, tool, action, or mutation paths", () => {
    const summary = summarizeCalibrationBaseline(baseline());

    expect({
      dbRead: summary.db_read_performed,
      dbWrite: summary.db_write_performed,
      providerCalled: summary.provider_called,
      llmCalled: summary.llm_called,
      networkCalled: summary.network_called,
      cloudCalled: summary.cloud_called,
      toolCalled: summary.tool_called,
      actionExecuted: summary.action_executed,
      approvalTriggered: summary.approval_triggered,
      mutationPerformed: summary.mutation_performed,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      mutationPerformed: false,
    });
  });
});
