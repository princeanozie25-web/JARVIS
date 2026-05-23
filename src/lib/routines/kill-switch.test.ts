import { describe, expect, it } from "vitest";

import {
  RoutineKillSwitchTelemetryEventSchema,
  assertRoutineKillSwitchAllows,
  createRoutineKillSwitchState,
  createRoutineKillSwitchTelemetryEvent,
  evaluateRoutineKillSwitch,
} from "./index";

describe("Phase 8B.3 routine kill-switch enforcement scaffold", () => {
  it("allows enabled state as a policy decision only, not execution", () => {
    const result = evaluateRoutineKillSwitch({
      kill_switch: createRoutineKillSwitchState({
        state: "enabled",
        checked_at_ms: 1000,
      }),
      operation: "tick_eligibility",
      requested_by: "user",
    });

    expect(result).toMatchObject({
      decision: "allowed",
      reason: "enabled_policy_decision_only",
      state: "enabled",
      operation: "tick_eligibility",
      policy_decision_only: true,
      metadata_only: true,
      scheduler_started: false,
      routine_executed: false,
      action_executed: false,
      kill_switch_mutated: false,
    });
  });

  it("blocks ticks, leases, and runs when disabled", () => {
    const killSwitch = createRoutineKillSwitchState({
      state: "disabled",
      checked_at_ms: 1000,
    });

    for (const operation of [
      "tick_eligibility",
      "lease_acquisition",
      "routine_run",
    ] as const) {
      expect(
        evaluateRoutineKillSwitch({
          kill_switch: killSwitch,
          operation,
          requested_by: "user",
        }),
      ).toMatchObject({
        decision: "blocked",
        reason: "disabled_blocks_all",
        operation,
        routine_executed: false,
        tool_called: false,
      });
    }
  });

  it("blocks locked_down state and requires manual reset metadata", () => {
    const result = evaluateRoutineKillSwitch({
      kill_switch: createRoutineKillSwitchState({
        state: "locked_down",
        checked_at_ms: 1000,
      }),
      operation: "lease_acquisition",
      requested_by: "user",
    });

    expect(result).toMatchObject({
      decision: "locked_down",
      reason: "locked_down_manual_reset_required",
      manual_reset_required: true,
      automatic_reset_performed: false,
      scheduler_started: false,
      routine_executed: false,
    });
  });

  it("rejects routine-origin attempts to change the kill-switch", () => {
    expect(
      evaluateRoutineKillSwitch({
        kill_switch: createRoutineKillSwitchState({
          state: "enabled",
          checked_at_ms: 1000,
        }),
        operation: "change_state",
        requested_by: "routine",
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "routine_origin_cannot_change_kill_switch",
      kill_switch_mutated: false,
    });
  });

  it("rejects voice-origin attempts to change the kill-switch", () => {
    expect(
      evaluateRoutineKillSwitch({
        kill_switch: createRoutineKillSwitchState({
          state: "enabled",
          checked_at_ms: 1000,
        }),
        operation: "change_state",
        requested_by: "voice",
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "voice_origin_cannot_change_kill_switch",
      kill_switch_mutated: false,
    });
  });

  it("rejects automatic reset attempts", () => {
    expect(
      evaluateRoutineKillSwitch({
        kill_switch: createRoutineKillSwitchState({
          state: "locked_down",
          checked_at_ms: 1000,
        }),
        operation: "reset",
        requested_by: "user",
        automatic_reset_requested: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "automatic_reset_forbidden",
      automatic_reset_performed: false,
      kill_switch_mutated: false,
    });
  });

  it("keeps assertRoutineKillSwitchAllows pure and metadata-only", () => {
    const result = assertRoutineKillSwitchAllows({
      kill_switch: createRoutineKillSwitchState({
        state: "enabled",
        checked_at_ms: 1000,
      }),
      operation: "lease_acquisition",
      requested_by: "developer_test",
    });

    expect(result).toMatchObject({
      decision: "allowed",
      policy_decision_only: true,
      metadata_only: true,
      routine_executed: false,
      memory_written: false,
      cloud_called: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const decision = evaluateRoutineKillSwitch({
      kill_switch: createRoutineKillSwitchState({
        state: "enabled",
        checked_at_ms: 1000,
      }),
      operation: "tick_eligibility",
      requested_by: "user",
    });
    const event = createRoutineKillSwitchTelemetryEvent(decision);

    expect(event).toEqual({
      event_type: "routine_kill_switch_evaluated",
      decision: "allowed",
      reason: "enabled_policy_decision_only",
      state: "enabled",
      operation: "tick_eligibility",
      allowed_count: 1,
      blocked_count: 0,
      locked_down_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      scheduler_started: false,
      timer_started: false,
      background_job_started: false,
      routine_executed: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
      cloud_called: false,
      kill_switch_mutated: false,
      automatic_reset_performed: false,
    });
    expect(
      RoutineKillSwitchTelemetryEventSchema.safeParse({
        ...event,
        routine_executed: true,
        kill_switch_mutated: true,
        cloud_called: true,
      }).success,
    ).toBe(false);
  });

  it("keeps timers, jobs, tools, actions, approvals, writes, and network unreachable", () => {
    const result = evaluateRoutineKillSwitch({
      kill_switch: createRoutineKillSwitchState({
        state: "enabled",
        checked_at_ms: 1000,
      }),
      operation: "routine_run",
      requested_by: "user",
    });

    expect({
      timerStarted: result.timer_started,
      backgroundJobStarted: result.background_job_started,
      toolCalled: result.tool_called,
      actionExecuted: result.action_executed,
      approvalGranted: result.approval_granted,
      memoryWritten: result.memory_written,
      projectMutated: result.project_mutated,
      environmentMutated: result.environment_mutated,
      runtimeMutated: result.runtime_mutated,
      cloudCalled: result.cloud_called,
    }).toEqual({
      timerStarted: false,
      backgroundJobStarted: false,
      toolCalled: false,
      actionExecuted: false,
      approvalGranted: false,
      memoryWritten: false,
      projectMutated: false,
      environmentMutated: false,
      runtimeMutated: false,
      cloudCalled: false,
    });
  });
});
