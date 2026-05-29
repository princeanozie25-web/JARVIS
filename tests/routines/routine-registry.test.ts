import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_DISABLED_GUARDS } from "../../src/lib/routines/phase-17-disabled-guards";
import {
  DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  Phase17RoutineRegistrySchema,
  validatePhase17RoutineRegistry,
} from "../../src/lib/routines/routine-registry";

describe("Phase 17A.3 scheduled assistance routine registry alignment", () => {
  it("contains every required Phase 17 routine", () => {
    expect(
      DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map(
        (routine) => routine.routine_kind,
      ),
    ).toEqual([
      "daily_self_audit",
      "cost_report",
      "project_progress",
      "calibration_diff",
      "next_action_suggest",
    ]);
  });

  it("keeps all routines disabled by default, metadata-only, foreground-only, and kill-switch guarded", () => {
    for (const routine of DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines) {
      expect(routine).toMatchObject({
        routine_id: `routine:${routine.routine_kind}`,
        enabled: false,
        enabled_by_default: false,
        requires_user_present: true,
        side_effects_allowed: false,
        execution_supported: false,
        metadata_only: true,
        foreground_only: true,
        kill_switch_required: true,
        scheduler_execution_supported: false,
        background_headless_allowed: false,
        tool_execution_allowed: false,
        device_action_allowed: false,
        project_mutation_allowed: false,
        memory_write_allowed: false,
        approval_execution_allowed: false,
        cloud_network_allowed: false,
      });
    }
  });

  it("validates the default registry against Phase 17 disabled guards", () => {
    expect(validatePhase17RoutineRegistry()).toEqual({
      pass: true,
      reason: "valid_registry",
      routine_count: 5,
      required_routine_count: 5,
      metadata_only: true,
      foreground_only: true,
      suggestion_only: true,
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

  it("rejects unsafe routine entries with side effects or authority", () => {
    const unsafe = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      routines: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map((routine) =>
        routine.routine_kind === "cost_report"
          ? {
              ...routine,
              side_effects_allowed: true,
              tool_execution_allowed: true,
              memory_write_allowed: true,
              device_action_allowed: true,
              project_mutation_allowed: true,
              approval_execution_allowed: true,
              cloud_network_allowed: true,
              background_headless_allowed: true,
            }
          : routine,
      ),
    };

    expect(Phase17RoutineRegistrySchema.safeParse(unsafe).success).toBe(false);
    expect(validatePhase17RoutineRegistry(unsafe)).toMatchObject({
      pass: false,
      reason: "schema_invalid",
      metadata_only: true,
      routine_executed: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
    });
  });

  it("rejects missing required routines and unsafe disabled guard state", () => {
    const missingRoutine = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      routines: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.filter(
        (routine) => routine.routine_kind !== "next_action_suggest",
      ),
    };
    const unsafeGuards = {
      ...DEFAULT_PHASE_17_DISABLED_GUARDS,
      scheduler_execution_enabled: true,
    };

    expect(validatePhase17RoutineRegistry(missingRoutine)).toMatchObject({
      pass: false,
      reason: "required_routine_missing",
      routine_count: 4,
      required_routine_count: 5,
      scheduler_started: false,
      routine_executed: false,
    });
    expect(
      validatePhase17RoutineRegistry(
        DEFAULT_PHASE_17_ROUTINE_REGISTRY,
        unsafeGuards,
      ),
    ).toMatchObject({
      pass: false,
      reason: "disabled_guard_unsafe",
      scheduler_started: false,
      routine_executed: false,
    });
  });
});
