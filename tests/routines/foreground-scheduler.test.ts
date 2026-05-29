import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  Phase17RoutineRegistrySchema,
} from "../../src/lib/routines/routine-registry";
import { getScheduledAssistanceRuntimeContract } from "../../src/lib/routines/runtime-contract";
import {
  ForegroundSchedulerTickDecisionSchema,
  evaluateForegroundSchedulerTick,
} from "../../src/lib/routines/foreground-scheduler";

const repoRoot = process.cwd();

describe("Phase 17B.1 foreground scheduler tick evaluator scaffold", () => {
  it("evaluates a foreground tick as metadata only and never executes routines", () => {
    const decision = evaluateForegroundSchedulerTick(
      {
        tick_id: "tick:phase17b:foreground",
        tick_source_kind: "foreground_scheduler",
        kill_switch_state: "safe",
      },
      DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      getScheduledAssistanceRuntimeContract(),
    );

    expect(decision).toMatchObject({
      tick_id: "tick:phase17b:foreground",
      tick_source_kind: "foreground_scheduler",
      decision: "denied",
      reason: "scheduler_execution_not_implemented",
      foreground_only: true,
      background_allowed: false,
      scheduler_execution_supported: false,
      scheduler_execution_allowed: false,
      routine_execution_supported: false,
      routine_execution_allowed: false,
      side_effects_allowed: false,
      routine_eligibility: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map(
        (routine) =>
          expect.objectContaining({
            routine_id: routine.routine_id,
            eligible: false,
            reason: "routine_disabled",
            routine_execution_allowed: false,
            routine_executed: false,
          }),
      ),
      output_envelopes: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map(
        (routine) =>
          expect.objectContaining({
            routine_id: routine.routine_id,
            output_kind: "none",
            output_supported: false,
            output_generated: false,
            raw_output_allowed: false,
            persistence_attempted: false,
            approval_bridge_attempted: false,
          }),
      ),
      eligible_routines: [],
      kill_switch_required: true,
      kill_switch_state: "safe",
      execution_attempted: false,
      persistence_attempted: false,
      metadata_only: true,
      catch_up_supported: false,
      missed_tick_policy: "skip",
    });
    expect(decision.skipped_routines).toHaveLength(5);
    expect(decision.skipped_routines).toEqual(
      DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map((routine) => ({
        routine_id: routine.routine_id,
        routine_kind: routine.routine_kind,
        reason: "routine_disabled",
        metadata_only: true,
        routine_execution_allowed: false,
      })),
    );
  });

  it("does not broaden registry authority for opt-in-like routine entries", () => {
    const enabledRoutine = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0],
      enabled: true,
    };
    const enabledRegistry = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      routines: [enabledRoutine],
    };
    const decision = evaluateForegroundSchedulerTick(
      {
        tick_id: "tick:phase17b:eligible-metadata",
        tick_source_kind: "manual",
        kill_switch_state: "safe",
        user_present_state: "present",
      },
      enabledRegistry,
      getScheduledAssistanceRuntimeContract(),
    );

    expect(decision).toMatchObject({
      reason: "unsafe_routine_registry",
      eligible_routines: [],
      skipped_routines: [],
      execution_attempted: false,
      routine_executed: false,
    });
  });

  it("rejects background and headless ticks before routine eligibility", () => {
    for (const tickSourceKind of [
      "background",
      "headless",
      "background_headless",
    ] as const) {
      expect(
        evaluateForegroundSchedulerTick({
          tick_id: `tick:phase17b:${tickSourceKind}`,
          tick_source_kind: tickSourceKind,
          kill_switch_state: "safe",
        }),
      ).toMatchObject({
        tick_source_kind: tickSourceKind,
        decision: "denied",
        reason: "background_headless_tick_rejected",
        foreground_only: true,
        background_allowed: false,
        scheduler_execution_supported: false,
        routine_execution_allowed: false,
        execution_attempted: false,
        routine_executed: false,
      });
    }
  });

  it("denies when the kill switch is active, missing, or unsafe", () => {
    expect(
      evaluateForegroundSchedulerTick({
        tick_id: "tick:phase17b:kill-switch-active",
        tick_source_kind: "manual",
        kill_switch_state: "active",
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "kill_switch_active",
      kill_switch_required: true,
      kill_switch_state: "active",
      execution_attempted: false,
    });
    expect(
      evaluateForegroundSchedulerTick({
        tick_id: "tick:phase17b:kill-switch-missing",
        tick_source_kind: "manual",
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "kill_switch_missing",
      kill_switch_state: "missing",
      execution_attempted: false,
    });
    expect(
      evaluateForegroundSchedulerTick({
        tick_id: "tick:phase17b:kill-switch-unsafe",
        tick_source_kind: "manual",
        kill_switch_state: "unsafe",
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "kill_switch_unsafe",
      kill_switch_state: "unsafe",
      execution_attempted: false,
    });
  });

  it("skips disabled routines and rejects catch-up runs", () => {
    const decision = evaluateForegroundSchedulerTick({
      tick_id: "tick:phase17b:catch-up",
      tick_source_kind: "test_fixture",
      kill_switch_state: "safe",
      catch_up_requested: true,
    });

    expect(decision).toMatchObject({
      decision: "denied",
      reason: "catch_up_not_supported",
      catch_up_supported: false,
      catch_up_attempted: false,
      routine_execution_allowed: false,
      routine_executed: false,
    });
    expect(
      decision.skipped_routines.every(
        (routine) => routine.reason === "routine_disabled",
      ),
    ).toBe(true);
  });

  it("denies unsafe routine registry or runtime contract state", () => {
    const unsafeRegistry = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      routines: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.map((routine) =>
        routine.routine_kind === "daily_self_audit"
          ? { ...routine, side_effects_allowed: true }
          : routine,
      ),
    };
    const unsafeRuntime = {
      ...getScheduledAssistanceRuntimeContract(),
      scheduler_active: true,
    };

    expect(Phase17RoutineRegistrySchema.safeParse(unsafeRegistry).success).toBe(
      false,
    );
    expect(
      evaluateForegroundSchedulerTick(
        {
          tick_id: "tick:phase17b:unsafe-registry",
          tick_source_kind: "manual",
          kill_switch_state: "safe",
        },
        unsafeRegistry,
        getScheduledAssistanceRuntimeContract(),
      ),
    ).toMatchObject({
      decision: "denied",
      reason: "unsafe_routine_registry",
      skipped_routines: [],
      execution_attempted: false,
      routine_executed: false,
    });
    expect(
      evaluateForegroundSchedulerTick(
        {
          tick_id: "tick:phase17b:unsafe-runtime",
          tick_source_kind: "manual",
          kill_switch_state: "safe",
        },
        DEFAULT_PHASE_17_ROUTINE_REGISTRY,
        unsafeRuntime,
      ),
    ).toMatchObject({
      decision: "denied",
      reason: "unsafe_runtime_contract",
      execution_attempted: false,
      routine_executed: false,
    });
  });

  it("schema rejects any attempted execution or persistence fields", () => {
    const decision = evaluateForegroundSchedulerTick({
      tick_id: "tick:phase17b:schema",
      tick_source_kind: "foreground_scheduler",
      kill_switch_state: "safe",
    });

    expect(
      ForegroundSchedulerTickDecisionSchema.safeParse({
        ...decision,
        scheduler_execution_allowed: true,
        routine_execution_allowed: true,
        execution_attempted: true,
        persistence_attempted: true,
      }).success,
    ).toBe(false);
  });

  it("does not add timers, collectors, reports, suggestions, persistence, tools, mutations, approval, cloud, or network markers", () => {
    const source = read("src/lib/routines/foreground-scheduler.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
