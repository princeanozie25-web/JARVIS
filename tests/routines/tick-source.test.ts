import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_DISABLED_GUARDS } from "../../src/lib/routines/phase-17-disabled-guards";
import {
  SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS,
  ScheduledAssistanceTickDecisionSchema,
  evaluateScheduledAssistanceTick,
} from "../../src/lib/routines/scheduled-assistance-tick-source";

const repoRoot = process.cwd();

describe("Phase 17A.4 scheduled assistance tick source contract", () => {
  it("describes manual, foreground scheduler, and test fixture ticks as metadata-only denials", () => {
    for (const tickSourceKind of SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS) {
      expect(
        evaluateScheduledAssistanceTick({
          tick_id: `tick:phase17:${tickSourceKind}`,
          tick_source_kind: tickSourceKind,
        }),
      ).toMatchObject({
        tick_source_kind: tickSourceKind,
        decision: "denied",
        reason: "scheduler_execution_not_implemented",
        execution_allowed: false,
        foreground_only: true,
        background_allowed: false,
        scheduler_execution_supported: false,
        routine_execution_supported: false,
        catch_up_supported: false,
        missed_tick_policy: "skip",
        metadata_only: true,
        side_effects_allowed: false,
      });
    }
  });

  it("never starts timers, scheduler execution, routines, reports, suggestions, persistence, tools, or mutations", () => {
    const decision = evaluateScheduledAssistanceTick({
      tick_id: "tick:phase17:no-side-effects",
      tick_source_kind: "foreground_scheduler",
    });

    expect(decision).toMatchObject({
      timer_started: false,
      scheduler_started: false,
      scheduler_execution_attempted: false,
      routine_execution_attempted: false,
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

  it("rejects catch-up ticks and keeps missed tick policy set to skip", () => {
    expect(
      evaluateScheduledAssistanceTick({
        tick_id: "tick:phase17:catch-up",
        tick_source_kind: "manual",
        catch_up_requested: true,
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "catch_up_not_supported",
      catch_up_supported: false,
      catch_up_attempted: false,
      missed_tick_policy: "skip",
      routine_executed: false,
    });
  });

  it("rejects background and headless ticks", () => {
    for (const tickSourceKind of [
      "background",
      "headless",
      "background_headless",
    ] as const) {
      expect(
        evaluateScheduledAssistanceTick({
          tick_id: `tick:phase17:${tickSourceKind}`,
          tick_source_kind: tickSourceKind,
        }),
      ).toMatchObject({
        tick_source_kind: tickSourceKind,
        decision: "denied",
        reason: "background_headless_tick_rejected",
        foreground_only: true,
        background_allowed: false,
        scheduler_execution_supported: false,
        routine_execution_supported: false,
      });
    }
  });

  it("fails closed if execution or side-effect fields are enabled", () => {
    const decision = evaluateScheduledAssistanceTick({
      tick_id: "tick:phase17:schema-guard",
      tick_source_kind: "test_fixture",
    });

    expect(
      ScheduledAssistanceTickDecisionSchema.safeParse({
        ...decision,
        execution_allowed: true,
        scheduler_started: true,
        routine_executed: true,
      }).success,
    ).toBe(false);
  });

  it("keeps the Phase 17 disabled guard matrix pinned", () => {
    expect(DEFAULT_PHASE_17_DISABLED_GUARDS).toMatchObject({
      scheduler_execution_enabled: false,
      background_headless_scheduler_enabled: false,
      autonomous_execution_enabled: false,
      catch_up_missed_schedule_runs_enabled: false,
      tool_calls_enabled: false,
      memory_writes_enabled: false,
      project_mutations_enabled: false,
      device_actions_enabled: false,
      approval_execution_enabled: false,
      cloud_network_calls_enabled: false,
      metadata_only: true,
      non_executing: true,
    });
  });

  it("does not add real timer, scheduler execution, report, suggestion, persistence, or network markers", () => {
    const source = read("src/lib/routines/scheduled-assistance-tick-source.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|INSERT INTO|event_store|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
