import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTINE_CONCURRENCY_POLICY,
  DEFAULT_ROUTINE_REGISTRY,
  RoutineRunLeaseTelemetryEventSchema,
  cancelRoutineRunLease,
  createRoutineRunLeaseTelemetryEvent,
  createSchedulerTick,
  evaluateRoutineRunLease,
  expireRoutineRunLease,
  type Routine,
} from "./index";

function enabledRoutine(): Routine {
  return { ...DEFAULT_ROUTINE_REGISTRY.routines[0], enabled: true };
}

function tick() {
  return createSchedulerTick({
    tick_id: "tick:lease:1000",
    source_mode: "manual",
    invoked_at_ms: 1000,
    user_present: true,
  });
}

describe("Phase 8B.2 scheduler concurrency and run lease scaffold", () => {
  it("lets the first eligible routine acquire a metadata-only lease", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:first:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:first",
    });

    expect(lease).toMatchObject({
      state: "acquired",
      reason: "lease_acquired",
      concurrency_cap: 1,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:first",
      metadata_only: true,
      lease_only: true,
      no_future_work_scheduled: true,
      timer_started: false,
      scheduler_started: false,
      background_job_started: false,
      routine_executed: false,
      tool_called: false,
      action_executed: false,
    });
  });

  it("denies a second concurrent routine when cap is 1", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:second:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 1,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:second",
    });

    expect(lease).toMatchObject({
      state: "denied",
      reason: "concurrency_cap_reached",
      concurrency_cap: 1,
      routine_executed: false,
    });
  });

  it("denies lease acquisition when the kill-switch is active", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:killswitch:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      kill_switch_active: true,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:killswitch",
    });

    expect(lease).toMatchObject({
      state: "denied",
      reason: "kill_switch_active",
      scheduler_started: false,
      routine_executed: false,
    });
  });

  it("denies lease acquisition when user presence is required and absent", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:user-absent:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: false,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:user-absent",
    });

    expect(lease).toMatchObject({
      state: "denied",
      reason: "user_present_required",
      routine_executed: false,
    });
  });

  it("denies disabled routines", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:disabled:1000",
      tick: tick(),
      routine: DEFAULT_ROUTINE_REGISTRY.routines[0],
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:disabled",
    });

    expect(lease).toMatchObject({
      state: "denied",
      reason: "routine_disabled",
      routine_executed: false,
    });
  });

  it("denies invalid or unsafe routines", () => {
    const unsafeRoutine = {
      ...enabledRoutine(),
      can_execute_actions: true,
    };
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:invalid:1000",
      tick: tick(),
      routine: unsafeRoutine,
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:invalid",
    });

    expect(lease).toMatchObject({
      state: "denied",
      reason: "routine_invalid",
      action_executed: false,
    });
  });

  it("keeps expired and cancelled leases non-executing", () => {
    const acquired = evaluateRoutineRunLease({
      lease_id: "lease:transitions:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:transitions",
    });
    const expired = expireRoutineRunLease(acquired, 31_000);
    const cancelled = cancelRoutineRunLease(acquired, 1_500);

    expect(expired).toMatchObject({
      state: "expired",
      reason: "lease_expired",
      timer_started: false,
      routine_executed: false,
    });
    expect(cancelled).toMatchObject({
      state: "cancelled",
      reason: "lease_cancelled",
      action_executed: false,
      routine_executed: false,
    });
  });

  it("represents max_runtime_ms without starting a timer", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:max-runtime:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 60_000,
      cancellation_token_ref: "hash:max-runtime",
    });

    expect(lease).toMatchObject({
      max_runtime_ms: 60_000,
      cancellation_token_ref: "hash:max-runtime",
      timer_started: false,
      no_future_work_scheduled: true,
    });
  });

  it("emits metadata-only lease telemetry with counts and flags only", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:telemetry:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "ref:telemetry",
    });
    const event = createRoutineRunLeaseTelemetryEvent(lease);

    expect(event).toEqual({
      event_type: "routine_run_lease_evaluated",
      state: "acquired",
      reason: "lease_acquired",
      acquired_count: 1,
      denied_count: 0,
      expired_count: 0,
      cancelled_count: 0,
      concurrency_cap: DEFAULT_ROUTINE_CONCURRENCY_POLICY.concurrency_cap,
      metadata_only: true,
      counts_and_flags_only: true,
      timer_started: false,
      scheduler_started: false,
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
      RoutineRunLeaseTelemetryEventSchema.safeParse({
        ...event,
        routine_executed: true,
        tool_called: true,
        cloud_called: true,
      }).success,
    ).toBe(false);
  });

  it("keeps tools, approvals, writes, network, and background jobs unreachable", () => {
    const lease = evaluateRoutineRunLease({
      lease_id: "lease:unreachable:1000",
      tick: tick(),
      routine: enabledRoutine(),
      active_lease_count: 0,
      user_present: true,
      max_runtime_ms: 30_000,
      cancellation_token_ref: "cancel:unreachable",
    });

    expect({
      backgroundJobStarted: lease.background_job_started,
      toolCalled: lease.tool_called,
      approvalGranted: lease.approval_granted,
      memoryWritten: lease.memory_written,
      projectMutated: lease.project_mutated,
      environmentMutated: lease.environment_mutated,
      runtimeMutated: lease.runtime_mutated,
      cloudCalled: lease.cloud_called,
    }).toEqual({
      backgroundJobStarted: false,
      toolCalled: false,
      approvalGranted: false,
      memoryWritten: false,
      projectMutated: false,
      environmentMutated: false,
      runtimeMutated: false,
      cloudCalled: false,
    });
  });
});
