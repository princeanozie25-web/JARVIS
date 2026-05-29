import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_DISABLED_GUARDS } from "../../src/lib/routines/phase-17-disabled-guards";
import { DEFAULT_PHASE_17_ROUTINE_REGISTRY } from "../../src/lib/routines/routine-registry";
import { getScheduledAssistanceRuntimeContract } from "../../src/lib/routines/runtime-contract";
import {
  RoutineEligibilityDecisionSchema,
  evaluateRoutineEligibility,
} from "../../src/lib/routines/routine-eligibility";

const repoRoot = process.cwd();
const defaultRoutine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0];
const foregroundTick = {
  tick_id: "tick:phase17b:eligibility",
  tick_source_kind: "foreground_scheduler" as const,
};

describe("Phase 17B.2 scheduled assistance routine eligibility matrix", () => {
  it("marks disabled routines ineligible with explicit metadata-only reason", () => {
    expect(
      evaluateRoutineEligibility(
        defaultRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "safe", user_present_state: "present" },
      ),
    ).toMatchObject({
      routine_id: defaultRoutine.routine_id,
      routine_kind: defaultRoutine.routine_kind,
      eligible: false,
      enabled: false,
      enabled_by_default: false,
      user_present_required: true,
      user_present_state: "present",
      kill_switch_required: true,
      kill_switch_state: "safe",
      schedule_kind: defaultRoutine.schedule_kind,
      tick_source_kind: "foreground_scheduler",
      foreground_only: true,
      side_effects_allowed: false,
      execution_supported: false,
      reason: "routine_disabled",
      error_class: "routine_disabled",
      metadata_only: true,
      routine_execution_allowed: false,
      routine_executed: false,
    });
  });

  it("denies user absent, unknown, or not checked when presence is required", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };

    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "safe", user_present_state: "absent" },
      ),
    ).toMatchObject({ eligible: false, reason: "user_absent" });
    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "safe", user_present_state: "unknown" },
      ),
    ).toMatchObject({ eligible: false, reason: "user_unknown" });
    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "safe" },
      ),
    ).toMatchObject({
      eligible: false,
      reason: "user_presence_not_checked",
    });
  });

  it("denies active, missing, or unsafe kill switch state", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };

    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "active", user_present_state: "present" },
      ),
    ).toMatchObject({ eligible: false, reason: "kill_switch_active" });
    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { user_present_state: "present" },
      ),
    ).toMatchObject({ eligible: false, reason: "kill_switch_missing" });
    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "unsafe", user_present_state: "present" },
      ),
    ).toMatchObject({ eligible: false, reason: "kill_switch_unsafe" });
  });

  it("denies background and headless tick metadata", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };

    for (const tickSourceKind of [
      "background",
      "headless",
      "background_headless",
    ] as const) {
      expect(
        evaluateRoutineEligibility(
          enabledRoutine,
          { ...foregroundTick, tick_source_kind: tickSourceKind },
          getScheduledAssistanceRuntimeContract(),
          { kill_switch_state: "safe", user_present_state: "present" },
        ),
      ).toMatchObject({
        eligible: false,
        reason: "background_headless_tick_rejected",
        tick_source_kind: tickSourceKind,
        routine_executed: false,
      });
    }
  });

  it("denies unsafe routine entries and unsafe disabled guard state", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };
    const unsafeGuards = {
      ...DEFAULT_PHASE_17_DISABLED_GUARDS,
      scheduler_execution_enabled: true,
    };

    expect(
      evaluateRoutineEligibility(
        { ...enabledRoutine, enabled_by_default: true },
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        { kill_switch_state: "safe", user_present_state: "present" },
      ),
    ).toMatchObject({ eligible: false, reason: "unsafe_routine_entry" });
    expect(
      evaluateRoutineEligibility(
        enabledRoutine,
        foregroundTick,
        getScheduledAssistanceRuntimeContract(),
        {
          kill_switch_state: "safe",
          user_present_state: "present",
          disabled_guards: unsafeGuards,
        },
      ),
    ).toMatchObject({
      eligible: false,
      reason: "unsafe_disabled_guard_state",
    });
  });

  it("denies side effects and every mutation authority surface", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };
    const unsafeCases = [
      ["side_effects_allowed", "side_effects_forbidden"],
      ["tool_execution_allowed", "tool_authority_forbidden"],
      ["device_action_allowed", "device_authority_forbidden"],
      ["memory_write_allowed", "memory_write_forbidden"],
      ["project_mutation_allowed", "project_mutation_forbidden"],
      ["approval_execution_allowed", "approval_execution_forbidden"],
      ["cloud_network_allowed", "cloud_network_forbidden"],
    ] as const;

    for (const [field, reason] of unsafeCases) {
      expect(
        evaluateRoutineEligibility(
          { ...enabledRoutine, [field]: true },
          foregroundTick,
          getScheduledAssistanceRuntimeContract(),
          { kill_switch_state: "safe", user_present_state: "present" },
        ),
      ).toMatchObject({
        eligible: false,
        reason,
        routine_execution_allowed: false,
        routine_executed: false,
      });
    }
  });

  it("can mark a metadata-only opt-in routine eligible while still denying execution", () => {
    const enabledRoutine = { ...defaultRoutine, enabled: true };
    const decision = evaluateRoutineEligibility(
      enabledRoutine,
      foregroundTick,
      getScheduledAssistanceRuntimeContract(),
      { kill_switch_state: "safe", user_present_state: "present" },
    );

    expect(decision).toMatchObject({
      eligible: true,
      reason: "eligible_metadata_only",
      enabled: true,
      enabled_by_default: false,
      foreground_only: true,
      side_effects_allowed: false,
      execution_supported: false,
      metadata_only: true,
      routine_execution_allowed: false,
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

  it("schema rejects attempted execution and generated outputs", () => {
    const decision = evaluateRoutineEligibility(
      { ...defaultRoutine, enabled: true },
      foregroundTick,
      getScheduledAssistanceRuntimeContract(),
      { kill_switch_state: "safe", user_present_state: "present" },
    );

    expect(
      RoutineEligibilityDecisionSchema.safeParse({
        ...decision,
        routine_execution_allowed: true,
        routine_executed: true,
        report_generated: true,
        suggestion_generated: true,
      }).success,
    ).toBe(false);
  });

  it("does not add timers, collectors, persistence, DB, tool, device, project, memory, approval, cloud, or network behavior", () => {
    const source = read("src/lib/routines/routine-eligibility.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
