import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTINE_FEATURE_FLAGS,
  DEFAULT_ROUTINE_KILL_SWITCH_CONFIG,
  DEFAULT_ROUTINE_REGISTRY,
  ROUTINE_CAPABILITIES,
  ROUTINE_DISABLED_FEATURES,
  RoutineRegistryTelemetryEventSchema,
  createRoutineRegistryTelemetryEvent,
  validateRoutineRegistry,
  type RoutineRegistry,
} from "./index";

function cloneRegistry(): RoutineRegistry {
  return structuredClone(DEFAULT_ROUTINE_REGISTRY);
}

describe("Phase 8A.1 routine registry and capability model", () => {
  it("declares all v1 routines with side_effects none and no actuation", () => {
    const capabilities = DEFAULT_ROUTINE_REGISTRY.routines.map(
      (routine) => routine.capability,
    );

    expect(capabilities.sort()).toEqual([...ROUTINE_CAPABILITIES].sort());
    for (const routine of DEFAULT_ROUTINE_REGISTRY.routines) {
      expect(routine).toMatchObject({
        side_effects: "none",
        enabled: false,
        can_execute_actions: false,
        actuation_allowed: false,
        metadata_only: true,
        advisory_only: true,
      });
      expect(routine.trust_class).not.toBe("actuate_reserved");
    }
    expect(validateRoutineRegistry(DEFAULT_ROUTINE_REGISTRY)).toMatchObject({
      pass: true,
      enabled_routine_count: 0,
      violation_count: 0,
    });
  });

  it("rejects actuate_reserved routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      trust_class: "actuate_reserved",
      actuation_allowed: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["actuation_reserved"],
    });
  });

  it("rejects tool-calling routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = { ...registry.routines[0], can_call_tools: true };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["tool_calls_forbidden"],
      tool_called: false,
    });
  });

  it("rejects memory-writing routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = { ...registry.routines[0], can_write_memory: true };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["memory_writes_forbidden"],
      memory_written: false,
    });
  });

  it("rejects approval-triggering routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      can_trigger_approvals: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["approvals_forbidden"],
      approval_granted: false,
    });
  });

  it("rejects project, environment, and runtime mutation routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      can_mutate_projects: true,
      can_mutate_environment: true,
      can_mutate_runtime: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["mutations_forbidden"],
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
    });
  });

  it("rejects cloud or network routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      can_use_cloud_network: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: ["cloud_network_forbidden"],
      cloud_called: false,
    });
  });

  it("rejects background, autonomous, action, and side-effect routines", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      side_effects: "write",
      can_run_background: true,
      autonomous: true,
      scheduler_registered: true,
      can_execute_actions: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "side_effects_not_none",
        "background_or_autonomous_forbidden",
        "actions_forbidden",
      ]),
      background_job_started: false,
      action_executed: false,
    });
  });

  it("keeps all routines disabled by default and all disabled feature flags off", () => {
    expect(
      DEFAULT_ROUTINE_REGISTRY.routines.every((routine) => !routine.enabled),
    ).toBe(true);
    expect(Object.keys(DEFAULT_ROUTINE_FEATURE_FLAGS).sort()).toEqual(
      [...ROUTINE_DISABLED_FEATURES].sort(),
    );
    for (const feature of ROUTINE_DISABLED_FEATURES) {
      expect(DEFAULT_ROUTINE_FEATURE_FLAGS[feature]).toBe(false);
      expect(DEFAULT_ROUTINE_REGISTRY.feature_flags[feature]).toBe(false);
    }
  });

  it("defaults the kill-switch to a safe fully-off posture", () => {
    expect(DEFAULT_ROUTINE_KILL_SWITCH_CONFIG).toEqual({
      global_routines_enabled: false,
      scheduler_enabled: false,
      autonomous_execution_enabled: false,
      tool_calls_enabled: false,
      memory_writes_enabled: false,
      approvals_enabled: false,
      runtime_actions_enabled: false,
      project_mutations_enabled: false,
      environment_mutations_enabled: false,
      runtime_mutations_enabled: false,
      cloud_network_enabled: false,
      metadata_only: true,
    });
  });

  it("rejects unsafe feature flags and kill-switch relaxations", () => {
    const registry = cloneRegistry();
    registry.feature_flags = {
      ...registry.feature_flags,
      timers: true,
      background_jobs: true,
      cloud_network_calls: true,
    };
    registry.kill_switch = {
      ...registry.kill_switch,
      scheduler_enabled: true,
      cloud_network_enabled: true,
    };

    expect(validateRoutineRegistry(registry)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "disabled_feature_enabled",
        "kill_switch_not_safe",
      ]),
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const event = createRoutineRegistryTelemetryEvent(
      validateRoutineRegistry(DEFAULT_ROUTINE_REGISTRY),
    );

    expect(event).toEqual({
      event_type: "routine_registry_validated",
      pass: true,
      routine_count: DEFAULT_ROUTINE_REGISTRY.routines.length,
      enabled_routine_count: 0,
      violation_count: 0,
      disabled_feature_count: ROUTINE_DISABLED_FEATURES.length,
      kill_switch_safe: true,
      metadata_only: true,
      counts_and_flags_only: true,
      scheduler_started: false,
      background_job_started: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
      cloud_called: false,
    });
    expect(
      RoutineRegistryTelemetryEventSchema.safeParse({
        ...event,
        action_executed: true,
        tool_called: true,
        memory_written: true,
      }).success,
    ).toBe(false);
  });
});
