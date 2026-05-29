import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  PHASE_17_DISABLED_FEATURES,
  Phase17DisabledGuardDecisionSchema,
  Phase17DisabledGuardMatrixSchema,
  evaluatePhase17DisabledGuard,
} from "../../src/lib/routines/phase-17-disabled-guards";

describe("Phase 17A.2 scheduled assistance disabled guard matrix", () => {
  it("pins every Phase 17 forbidden capability off", () => {
    expect(DEFAULT_PHASE_17_DISABLED_GUARDS).toEqual({
      phase: 17,
      slice: "17A.2",
      status: "disabled_guard_matrix",
      scheduler_execution_enabled: false,
      background_headless_scheduler_enabled: false,
      autonomous_execution_enabled: false,
      tool_calls_enabled: false,
      device_actions_enabled: false,
      project_mutations_enabled: false,
      memory_writes_enabled: false,
      approval_execution_enabled: false,
      cloud_network_calls_enabled: false,
      routine_chaining_enabled: false,
      self_modifying_routines_enabled: false,
      auto_tuning_thresholds_budgets_policies_enabled: false,
      catch_up_missed_schedule_runs_enabled: false,
      voice_enable_disable_schedule_changes_enabled: false,
      raw_report_telemetry_enabled: false,
      raw_suggestion_telemetry_enabled: false,
      suggestion_only: true,
      foreground_only: true,
      metadata_only: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
    });
  });

  it("returns metadata-only denial decisions for every forbidden feature", () => {
    for (const feature of PHASE_17_DISABLED_FEATURES) {
      expect(evaluatePhase17DisabledGuard(feature)).toMatchObject({
        feature,
        allowed: false,
        phase: 17,
        slice: "17A.2",
        suggestion_only: true,
        foreground_only: true,
        metadata_only: true,
        non_executing: true,
        scheduler_started: false,
        routine_executed: false,
        report_generated: false,
        suggestion_generated: false,
        persisted: false,
        network_called: false,
        cloud_called: false,
        tool_called: false,
        memory_written: false,
        project_mutated: false,
        device_action_executed: false,
        approval_executed: false,
      });
    }
  });

  it("fails closed if a guard flag is enabled", () => {
    expect(
      Phase17DisabledGuardMatrixSchema.safeParse({
        ...DEFAULT_PHASE_17_DISABLED_GUARDS,
        scheduler_execution_enabled: true,
      }).success,
    ).toBe(false);
    expect(
      Phase17DisabledGuardDecisionSchema.safeParse({
        ...evaluatePhase17DisabledGuard("tool_calls"),
        allowed: true,
        tool_called: true,
      }).success,
    ).toBe(false);
  });
});
