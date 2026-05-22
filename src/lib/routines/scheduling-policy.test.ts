import { describe, expect, it } from "vitest";

import {
  DAILY_SELF_AUDIT_ROUTINE_ID,
  DEFAULT_ROUTINE_REGISTRY,
  RoutineSchedulePolicyTelemetryEventSchema,
  createRoutineSchedulePolicyTelemetryEvent,
  evaluateRoutineScheduleEligibility,
  type RoutineRegistry,
} from "./index";

function cloneRegistry(): RoutineRegistry {
  return structuredClone(DEFAULT_ROUTINE_REGISTRY);
}

describe("Phase 8A.2 routine trust and scheduling policy", () => {
  it("allows manual routines only as non-executing eligibility decisions", () => {
    const result = evaluateRoutineScheduleEligibility({
      routine_id: "routine:cost_report",
      requested_schedule_kind: "manual",
      user_present: true,
    });

    expect(result).toMatchObject({
      decision: "eligible",
      reason: "manual_non_executing_eligible",
      routine_id: "routine:cost_report",
      schedule_kind: "manual",
      metadata_only: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      action_executed: false,
    });
  });

  it("requires user opt-in before daily_self_audit becomes eligible", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
        requested_schedule_kind: "daily",
        user_present: true,
        user_opted_in: false,
      }),
    ).toMatchObject({
      decision: "requires_user_opt_in",
      reason: "daily_self_audit_requires_user_opt_in",
    });

    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
        requested_schedule_kind: "daily",
        user_present: true,
        user_opted_in: true,
      }),
    ).toMatchObject({
      decision: "eligible",
      reason: "daily_self_audit_eligible",
      scheduler_started: false,
      routine_executed: false,
    });
  });

  it("blocks other daily routines in v1", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: "routine:cost_report",
        requested_schedule_kind: "daily",
        user_present: true,
        user_opted_in: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "daily_not_allowed_in_v1",
      schedule_kind: "daily",
    });
  });

  it("blocks interval schedules in v1", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
        requested_schedule_kind: "interval",
        user_present: true,
        user_opted_in: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "interval_disabled_in_v1",
      schedule_kind: "interval",
    });
  });

  it("blocks actuate_reserved routines from scheduling", () => {
    const registry = cloneRegistry();
    registry.routines[0] = {
      ...registry.routines[0],
      trust_class: "actuate_reserved",
    };

    expect(
      evaluateRoutineScheduleEligibility(
        {
          routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
          requested_schedule_kind: "manual",
          user_present: true,
        },
        { registry },
      ),
    ).toMatchObject({
      decision: "blocked",
      reason: "actuate_reserved_schedule_blocked",
      trust_class: "actuate_reserved",
    });
  });

  it("lets the kill-switch block every schedule eligibility decision", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
        requested_schedule_kind: "daily",
        user_present: true,
        user_opted_in: true,
        kill_switch_engaged: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "kill_switch_engaged",
      scheduler_started: false,
      routine_executed: false,
    });
  });

  it("requires user_present by default for scheduled routines", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: "routine:cost_report",
        requested_schedule_kind: "manual",
        user_present: false,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "user_present_required",
    });
  });

  it("keeps missed-run catch-up disabled", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: DAILY_SELF_AUDIT_ROUTINE_ID,
        requested_schedule_kind: "daily",
        user_present: true,
        user_opted_in: true,
        missed_run: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "missed_run_catch_up_disabled",
      background_job_started: false,
    });
  });

  it("rejects routine-to-routine scheduling", () => {
    expect(
      evaluateRoutineScheduleEligibility({
        routine_id: "routine:next_action_suggest",
        requested_schedule_kind: "manual",
        requested_by: "routine",
        user_present: true,
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "routine_to_routine_scheduling_forbidden",
      tool_called: false,
      action_executed: false,
      approval_granted: false,
    });
  });

  it("emits metadata-only schedule telemetry with counts and flags only", () => {
    const result = evaluateRoutineScheduleEligibility({
      routine_id: "routine:cost_report",
      requested_schedule_kind: "manual",
      user_present: true,
    });
    const event = createRoutineSchedulePolicyTelemetryEvent(result);

    expect(event).toEqual({
      event_type: "routine_schedule_policy_evaluated",
      decision: "eligible",
      reason: "manual_non_executing_eligible",
      schedule_kind: "manual",
      trust_class: "summarize",
      eligible_count: 1,
      blocked_count: 0,
      requires_user_opt_in_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
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
      RoutineSchedulePolicyTelemetryEventSchema.safeParse({
        ...event,
        action_executed: true,
        cloud_called: true,
        memory_written: true,
      }).success,
    ).toBe(false);
  });
});
