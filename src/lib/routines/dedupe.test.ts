import { describe, expect, it } from "vitest";

import {
  CreateRoutineIdempotencyKeyInputSchema,
  RoutineDedupeTelemetryEventSchema,
  createRoutineDedupeTelemetryEvent,
  createRoutineIdempotencyKey,
  createRoutineKillSwitchState,
  evaluateRoutineDedupe,
  summarizeRoutineIdempotencyKey,
  type RoutineDedupeWindow,
} from "./index";

function window(
  evaluatedAtMs = 1500,
  startMs = 1000,
  endMs = 2000,
): RoutineDedupeWindow {
  return {
    window_start_ms: startMs,
    window_end_ms: endMs,
    evaluated_at_ms: evaluatedAtMs,
    catch_up_allowed: false,
    metadata_only: true,
    persistence_enabled: false,
    timer_started: false,
  };
}

describe("Phase 8B.4 routine idempotency and dedupe scaffold", () => {
  it("creates deterministic idempotency keys for the same routine/window metadata", () => {
    const first = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:beta", "hash:alpha"],
    });
    const second = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha", "hash:beta"],
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      input_surface_count: 2,
      metadata_only: true,
      hashes_only: true,
      raw_input_stored: false,
      report_body_stored: false,
      persistence_written: false,
    });
  });

  it("creates different keys for different windows", () => {
    const first = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });
    const second = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 2000,
      window_end_ms: 3000,
      input_surface_hashes: ["hash:alpha"],
    });

    expect(first.key_hash).not.toBe(second.key_hash);
  });

  it("blocks duplicate keys using prior summaries only", () => {
    const candidate = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });
    const decision = evaluateRoutineDedupe({
      candidate_key: candidate,
      prior_key_summaries: [summarizeRoutineIdempotencyKey(candidate)],
      dedupe_window: window(),
    });

    expect(decision).toMatchObject({
      decision: "duplicate",
      reason: "duplicate_key",
      key_hash: candidate.key_hash,
      metadata_only: true,
      no_persistence: true,
      routine_executed: false,
    });
  });

  it("rejects expired windows and does not catch them up", () => {
    const candidate = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });
    const decision = evaluateRoutineDedupe({
      candidate_key: candidate,
      prior_key_summaries: [],
      dedupe_window: window(3000),
    });

    expect(decision).toMatchObject({
      decision: "expired_window",
      reason: "expired_window_catch_up_forbidden",
      catch_up_allowed: false,
      timer_started: false,
      scheduler_started: false,
    });
  });

  it("rejects raw report or input bodies in key input", () => {
    expect(
      CreateRoutineIdempotencyKeyInputSchema.safeParse({
        routine_id: "routine:self_audit",
        schedule_kind: "daily",
        window_start_ms: 1000,
        window_end_ms: 2000,
        input_surface_hashes: ["hash:alpha"],
        raw_report_body: "secret report body",
      }).success,
    ).toBe(false);
    expect(
      CreateRoutineIdempotencyKeyInputSchema.safeParse({
        routine_id: "routine:self_audit",
        schedule_kind: "daily",
        tick_id: "tick:dedupe:1000",
        raw_input_body: "private input",
      }).success,
    ).toBe(false);
  });

  it("uses hashes and counts only", () => {
    const key = createRoutineIdempotencyKey({
      routine_id: "routine:cost_report",
      schedule_kind: "manual",
      tick_id: "tick:dedupe:1000",
      input_surface_hashes: ["surface:one", "input:two"],
    });
    const summary = summarizeRoutineIdempotencyKey(key);
    const serialized = JSON.stringify({ key, summary });

    expect(key.input_surface_hashes).toEqual(["input:two", "surface:one"]);
    expect(key.input_surface_count).toBe(2);
    expect(summary).not.toHaveProperty("input_surface_hashes");
    expect(serialized).not.toContain("secret report body");
    expect(serialized).not.toContain("private");
  });

  it("blocks when kill-switch state is disabled or locked down", () => {
    const candidate = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });

    expect(
      evaluateRoutineDedupe({
        candidate_key: candidate,
        prior_key_summaries: [],
        dedupe_window: window(),
        kill_switch: createRoutineKillSwitchState({
          state: "disabled",
          checked_at_ms: 1000,
        }),
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "kill_switch_blocked",
    });
    expect(
      evaluateRoutineDedupe({
        candidate_key: candidate,
        prior_key_summaries: [],
        dedupe_window: window(),
        kill_switch: createRoutineKillSwitchState({
          state: "locked_down",
          checked_at_ms: 1000,
        }),
      }),
    ).toMatchObject({
      decision: "blocked",
      reason: "kill_switch_blocked",
    });
  });

  it("allows a unique, current metadata key without execution or persistence", () => {
    const candidate = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });
    const decision = evaluateRoutineDedupe({
      candidate_key: candidate,
      prior_key_summaries: [],
      dedupe_window: window(),
      kill_switch: createRoutineKillSwitchState({
        state: "enabled",
        checked_at_ms: 1000,
      }),
    });

    expect(decision).toMatchObject({
      decision: "allow",
      reason: "unique_key_allowed",
      no_persistence: true,
      persistence_written: false,
      routine_executed: false,
      tool_called: false,
      cloud_called: false,
    });
  });

  it("emits metadata-only dedupe telemetry with counts and flags only", () => {
    const candidate = createRoutineIdempotencyKey({
      routine_id: "routine:self_audit",
      schedule_kind: "daily",
      window_start_ms: 1000,
      window_end_ms: 2000,
      input_surface_hashes: ["hash:alpha"],
    });
    const decision = evaluateRoutineDedupe({
      candidate_key: candidate,
      prior_key_summaries: [],
      dedupe_window: window(),
    });
    const event = createRoutineDedupeTelemetryEvent({
      decision,
      prior_key_count: 0,
      input_surface_count: candidate.input_surface_count,
    });

    expect(event).toEqual({
      event_type: "routine_dedupe_evaluated",
      decision: "allow",
      reason: "unique_key_allowed",
      allow_count: 1,
      duplicate_count: 0,
      blocked_count: 0,
      expired_window_count: 0,
      prior_key_count: 0,
      input_surface_count: 1,
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
      persistence_written: false,
    });
    expect(
      RoutineDedupeTelemetryEventSchema.safeParse({
        ...event,
        routine_executed: true,
        persistence_written: true,
        cloud_called: true,
      }).success,
    ).toBe(false);
  });
});
