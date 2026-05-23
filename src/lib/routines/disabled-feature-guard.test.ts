import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD,
  ROUTINE_CLOSEOUT_DISABLED_FEATURES,
  RoutineDisabledFeatureGuardTelemetryEventSchema,
  createRoutineDisabledFeatureGuardTelemetryEvent,
  validateRoutineDisabledFeatureGuard,
  type RoutineCloseoutDisabledFeature,
  type RoutineDisabledFeatureGuard,
} from "./index";

function guardWithEnabled(
  feature: RoutineCloseoutDisabledFeature,
): RoutineDisabledFeatureGuard {
  return {
    ...DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD,
    disabled_features: {
      ...DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD.disabled_features,
      [feature]: true,
    },
  } as unknown as RoutineDisabledFeatureGuard;
}

describe("Phase 8J.1 routine disabled-feature closeout guard", () => {
  it("passes the default guard", () => {
    const validation = validateRoutineDisabledFeatureGuard(
      DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD,
    );

    expect(validation).toMatchObject({
      passed: true,
      violations: [],
      disabled_feature_count: 20,
      enabled_feature_count: 0,
      metadata_only: true,
      scheduler_execution_started: false,
      timers_started: false,
      background_jobs_started: false,
      telemetry_persisted: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      mutation_performed: false,
      ui_wired: false,
      runtime_wired: false,
      voice_wired: false,
    });
  });

  it("fails if any disabled feature is enabled", () => {
    for (const feature of ROUTINE_CLOSEOUT_DISABLED_FEATURES) {
      const validation = validateRoutineDisabledFeatureGuard(
        guardWithEnabled(feature),
      );

      expect(validation).toMatchObject({
        passed: false,
        violations: [feature],
        enabled_feature_count: 1,
      });
    }
  });

  it("fails when raw report telemetry is enabled", () => {
    const validation = validateRoutineDisabledFeatureGuard(
      guardWithEnabled("raw_report_telemetry"),
    );

    expect(validation).toMatchObject({
      passed: false,
      violations: ["raw_report_telemetry"],
    });
  });

  it("fails when routine chaining or self-modification is enabled", () => {
    expect(
      validateRoutineDisabledFeatureGuard(guardWithEnabled("routine_chaining")),
    ).toMatchObject({
      passed: false,
      violations: ["routine_chaining"],
    });
    expect(
      validateRoutineDisabledFeatureGuard(
        guardWithEnabled("routine_self_modification"),
      ),
    ).toMatchObject({
      passed: false,
      violations: ["routine_self_modification"],
    });
  });

  it("fails when auto-tuning is enabled", () => {
    for (const feature of [
      "auto_threshold_tuning",
      "auto_budget_tuning",
      "auto_policy_tuning",
      "auto_router_tuning",
    ] satisfies RoutineCloseoutDisabledFeature[]) {
      expect(
        validateRoutineDisabledFeatureGuard(guardWithEnabled(feature)),
      ).toMatchObject({
        passed: false,
        violations: [feature],
      });
    }
  });

  it("fails when remote or network-triggered routines are enabled", () => {
    for (const feature of [
      "remote_network_triggered_routines",
      "public_remote_schedule_control",
      "routines_initiate_cloud_calls",
      "multi_process_scheduling",
    ] satisfies RoutineCloseoutDisabledFeature[]) {
      expect(
        validateRoutineDisabledFeatureGuard(guardWithEnabled(feature)),
      ).toMatchObject({
        passed: false,
        violations: [feature],
      });
    }
  });

  it("emits telemetry with counts and flags only", () => {
    const validation = validateRoutineDisabledFeatureGuard(
      guardWithEnabled("auto_approval"),
    );
    const telemetry =
      createRoutineDisabledFeatureGuardTelemetryEvent(validation);

    expect(telemetry).toEqual({
      event_type: "routine_disabled_feature_guard_validated",
      passed: false,
      disabled_feature_count: 20,
      enabled_feature_count: 1,
      violation_count: 1,
      metadata_only: true,
      counts_and_flags_only: true,
      scheduler_execution_started: false,
      timers_started: false,
      background_jobs_started: false,
      telemetry_persisted: false,
      db_read_performed: false,
      db_write_performed: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      mutation_performed: false,
      ui_wired: false,
      api_route_added: false,
      runtime_wired: false,
      voice_wired: false,
    });
    expect(
      RoutineDisabledFeatureGuardTelemetryEventSchema.safeParse({
        ...telemetry,
        raw_report_body: "private",
      }).success,
    ).toBe(false);
    expect(
      RoutineDisabledFeatureGuardTelemetryEventSchema.safeParse({
        ...telemetry,
        action_executed: true,
      }).success,
    ).toBe(false);
  });

  it("adds no runtime execution, tool, action, write, network, UI, or mutation paths", () => {
    const validation = validateRoutineDisabledFeatureGuard(
      DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD,
    );

    expect({
      scheduler: validation.scheduler_execution_started,
      timers: validation.timers_started,
      background: validation.background_jobs_started,
      telemetryPersisted: validation.telemetry_persisted,
      dbRead: validation.db_read_performed,
      dbWrite: validation.db_write_performed,
      providerCalled: validation.provider_called,
      llmCalled: validation.llm_called,
      networkCalled: validation.network_called,
      cloudCalled: validation.cloud_called,
      toolCalled: validation.tool_called,
      actionExecuted: validation.action_executed,
      approvalGranted: validation.approval_granted,
      memoryWritten: validation.memory_written,
      projectMutated: validation.project_mutated,
      environmentMutated: validation.environment_mutated,
      mutationPerformed: validation.mutation_performed,
      uiWired: validation.ui_wired,
      apiRouteAdded: validation.api_route_added,
      runtimeWired: validation.runtime_wired,
      voiceWired: validation.voice_wired,
    }).toEqual({
      scheduler: false,
      timers: false,
      background: false,
      telemetryPersisted: false,
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalGranted: false,
      memoryWritten: false,
      projectMutated: false,
      environmentMutated: false,
      mutationPerformed: false,
      uiWired: false,
      apiRouteAdded: false,
      runtimeWired: false,
      voiceWired: false,
    });
  });
});
