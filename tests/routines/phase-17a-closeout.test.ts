import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  evaluatePhase17DisabledGuard,
} from "../../src/lib/routines/phase-17-disabled-guards";
import {
  DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  validatePhase17RoutineRegistry,
} from "../../src/lib/routines/routine-registry";
import {
  DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
  evaluateScheduledAssistanceReadScope,
} from "../../src/lib/routines/read-scope";
import { getScheduledAssistanceRuntimeContract } from "../../src/lib/routines/runtime-contract";
import { evaluateScheduledAssistanceTick } from "../../src/lib/routines/scheduled-assistance-tick-source";

const repoRoot = process.cwd();

describe("Phase 17A.6 scheduled assistance runtime closeout guard", () => {
  it("proves runtime contract exists and remains disabled/non-executing", () => {
    expect(getScheduledAssistanceRuntimeContract()).toMatchObject({
      phase: 17,
      slice: "17A.1",
      runtime_id: "scheduled_assistance_runtime",
      execution_supported: false,
      scheduler_active: false,
      scheduler_running: false,
      side_effects_supported: false,
      network_allowed: false,
      cloud_allowed: false,
      tool_execution_allowed: false,
      memory_write_allowed: false,
      device_action_allowed: false,
      project_mutation_allowed: false,
      approval_execution_allowed: false,
      report_generation_supported: false,
      suggestion_generation_supported: false,
      persistence_supported: false,
      timers_registered: false,
      metadata_only: true,
    });
  });

  it("proves disabled guard matrix exists and remains pinned", () => {
    expect(DEFAULT_PHASE_17_DISABLED_GUARDS).toMatchObject({
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
      metadata_only: true,
      foreground_only: true,
      non_executing: true,
    });

    for (const feature of [
      "scheduler_execution",
      "background_headless_scheduler",
      "tool_calls",
      "device_actions",
      "project_mutations",
      "memory_writes",
      "approval_execution",
      "cloud_network_calls",
      "raw_report_telemetry",
      "raw_suggestion_telemetry",
    ] as const) {
      expect(evaluatePhase17DisabledGuard(feature)).toMatchObject({
        allowed: false,
        metadata_only: true,
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

  it("proves routine registry validates safe metadata-only foreground routines", () => {
    expect(validatePhase17RoutineRegistry()).toMatchObject({
      pass: true,
      reason: "valid_registry",
      routine_count: 5,
      required_routine_count: 5,
      metadata_only: true,
      foreground_only: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });

    for (const routine of DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines) {
      expect(routine).toMatchObject({
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

  it("proves tick source contract exists and denies execution", () => {
    expect(
      evaluateScheduledAssistanceTick({
        tick_id: "tick:phase17a:closeout",
        tick_source_kind: "foreground_scheduler",
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "scheduler_execution_not_implemented",
      execution_allowed: false,
      foreground_only: true,
      background_allowed: false,
      scheduler_execution_supported: false,
      scheduler_execution_attempted: false,
      routine_execution_supported: false,
      routine_execution_attempted: false,
      catch_up_supported: false,
      missed_tick_policy: "skip",
      metadata_only: true,
      side_effects_allowed: false,
      timer_started: false,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });
    expect(
      evaluateScheduledAssistanceTick({
        tick_id: "tick:phase17a:background",
        tick_source_kind: "background_headless",
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "background_headless_tick_rejected",
      background_allowed: false,
      routine_executed: false,
    });
    expect(
      evaluateScheduledAssistanceTick({
        tick_id: "tick:phase17a:catch-up",
        tick_source_kind: "manual",
        catch_up_requested: true,
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "catch_up_not_supported",
      catch_up_supported: false,
      catch_up_attempted: false,
      missed_tick_policy: "skip",
    });
  });

  it("proves read scope contract exists and denies unsafe scopes", () => {
    const safe = DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES[0];

    expect(evaluateScheduledAssistanceReadScope(safe)).toMatchObject({
      allowed: true,
      read_only: true,
      metadata_only: true,
      raw_payload_allowed: false,
      pii_allowed: false,
      secrets_allowed: false,
      network_allowed: false,
      write_allowed: false,
      collector_implemented: false,
      db_read_performed: false,
      event_store_read_performed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...safe,
        raw_payload_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "raw_payload_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...safe,
        network_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "network_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...safe,
        write_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "write_forbidden" });
  });

  it("keeps Phase 17A source files free of runtime side-effect markers", () => {
    const sources = [
      read("src/lib/routines/runtime-contract.ts"),
      read("src/lib/routines/phase-17-disabled-guards.ts"),
      read("src/lib/routines/routine-registry.ts"),
      read("src/lib/routines/scheduled-assistance-tick-source.ts"),
      read("src/lib/routines/read-scope.ts"),
    ].join("\n");

    expect(sources).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
    expect(sources).not.toMatch(/\bcollect[A-Z]/);
  });

  it("documents Phase 17A closeout and Phase 17B prerequisite", () => {
    const closeout = read("docs/phase-17/phase-17a-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 17A Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "What 17A Achieved",
      "What Remains Intentionally Unimplemented",
      "Phase 17B.1 - Foreground Scheduler Tick Evaluator Scaffold",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
