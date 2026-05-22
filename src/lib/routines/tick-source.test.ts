import { describe, expect, it } from "vitest";

import {
  DEFAULT_TICK_SOURCE_CONFIG,
  ROUTINE_DISABLED_TICK_SOURCE_MODES,
  RoutineSchedulerTickTelemetryEventSchema,
  createSchedulerTick,
  createSchedulerTickTelemetryEvent,
  validateSchedulerTick,
} from "./index";

describe("Phase 8B.1 scheduler tick source scaffold", () => {
  it("represents a manual tick as metadata only", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:manual:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      user_present: true,
    });
    const validation = validateSchedulerTick(tick);

    expect(tick).toMatchObject({
      source_mode: "manual",
      metadata_only: true,
      foreground_only: true,
      no_op_if_blocked: true,
      catch_up_allowed: false,
      scheduler_started: false,
      timer_started: false,
      background_job_started: false,
      routine_executed: false,
      action_executed: false,
    });
    expect(validation).toMatchObject({
      decision: "eligible",
      reason: "manual_tick_represented",
      metadata_only: true,
      no_op: false,
      routine_executed: false,
    });
  });

  it("allows foreground_single_process as a non-executing mode", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:foreground:1000",
      source_mode: "foreground_single_process",
      invoked_at_ms: 1000,
      previous_tick_at_ms: 900,
      user_present: true,
    });

    expect(validateSchedulerTick(tick)).toMatchObject({
      decision: "eligible",
      reason: "foreground_single_process_tick_represented",
      scheduler_started: false,
      timer_started: false,
      routine_executed: false,
    });
  });

  it("rejects background, multi-process, remote, and network-triggered modes", () => {
    for (const mode of ROUTINE_DISABLED_TICK_SOURCE_MODES) {
      const tick = createSchedulerTick({
        tick_id: `tick:${mode}:1000`,
        source_mode: mode,
        invoked_at_ms: 1000,
        user_present: true,
      });

      expect(validateSchedulerTick(tick)).toMatchObject({
        decision: "blocked",
        reason: "disabled_tick_source_mode",
        source_mode: mode,
        no_op: true,
        scheduler_started: false,
        background_job_started: false,
      });
    }
  });

  it("treats kill-switch active ticks as blocked no-ops", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:killswitch:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      kill_switch_active: true,
      user_present: true,
    });

    expect(validateSchedulerTick(tick)).toMatchObject({
      decision: "noop",
      reason: "kill_switch_active",
      no_op: true,
      routine_executed: false,
      tool_called: false,
    });
  });

  it("blocks user-present-required ticks when user_present is false", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:user-present:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      user_present: false,
      user_present_required: true,
    });

    expect(validateSchedulerTick(tick)).toMatchObject({
      decision: "blocked",
      reason: "user_present_required",
      no_op: true,
    });
  });

  it("rejects catch-up ticks", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:catch-up:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      user_present: true,
      catch_up_tick: true,
    });

    expect(validateSchedulerTick(tick)).toMatchObject({
      decision: "blocked",
      reason: "catch_up_tick_forbidden",
      no_op: true,
      background_job_started: false,
    });
  });

  it("rejects non-monotonic tick timestamps", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:monotonic:0900",
      source_mode: "manual",
      invoked_at_ms: 900,
      previous_tick_at_ms: 1000,
      user_present: true,
    });

    expect(tick.monotonic_timestamp).toBe(false);
    expect(validateSchedulerTick(tick)).toMatchObject({
      decision: "blocked",
      reason: "non_monotonic_timestamp",
      no_op: true,
    });
  });

  it("keeps disabled/default-safe feature flags off in tick config", () => {
    expect(DEFAULT_TICK_SOURCE_CONFIG).toMatchObject({
      foreground_only: true,
      single_process_only: true,
      timer_runtime_enabled: false,
      background_jobs_enabled: false,
      remote_triggers_enabled: false,
      network_triggers_enabled: false,
      metadata_only: true,
    });
  });

  it("emits metadata-only tick telemetry with counts and flags only", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:telemetry:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      user_present: true,
    });
    const event = createSchedulerTickTelemetryEvent(
      validateSchedulerTick(tick),
    );

    expect(event).toEqual({
      event_type: "routine_scheduler_tick_evaluated",
      decision: "eligible",
      reason: "manual_tick_represented",
      source_mode: "manual",
      eligible_count: 1,
      blocked_count: 0,
      noop_count: 0,
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
    });
    expect(
      RoutineSchedulerTickTelemetryEventSchema.safeParse({
        ...event,
        routine_executed: true,
        timer_started: true,
        action_executed: true,
      }).success,
    ).toBe(false);
  });

  it("cannot represent routine execution from a tick", () => {
    const tick = createSchedulerTick({
      tick_id: "tick:no-execution:1000",
      source_mode: "manual",
      invoked_at_ms: 1000,
      user_present: true,
    });

    expect({
      tickRoutineExecuted: tick.routine_executed,
      tickToolCalled: tick.tool_called,
      tickApprovalGranted: tick.approval_granted,
      tickMemoryWritten: tick.memory_written,
      tickCloudCalled: tick.cloud_called,
    }).toEqual({
      tickRoutineExecuted: false,
      tickToolCalled: false,
      tickApprovalGranted: false,
      tickMemoryWritten: false,
      tickCloudCalled: false,
    });
  });
});
