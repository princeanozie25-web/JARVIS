import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
  SCHEDULED_ASSISTANCE_ROUTINE_KINDS,
  ScheduledAssistanceRuntimeContractSchema,
  getScheduledAssistanceRuntimeContract,
} from "../../src/lib/routines/runtime-contract";

const repoRoot = process.cwd();

describe("Phase 17A.1 scheduled assistance runtime contract scaffold", () => {
  it("defines every Phase 17 routine as metadata-only and side-effect free", () => {
    const contract = getScheduledAssistanceRuntimeContract();

    expect(contract.routines.map((routine) => routine.routine_kind)).toEqual([
      "daily_self_audit",
      "cost_report",
      "project_progress",
      "calibration_diff",
      "next_action_suggest",
    ]);
    expect(contract.routines).toHaveLength(
      SCHEDULED_ASSISTANCE_ROUTINE_KINDS.length,
    );

    for (const routine of contract.routines) {
      expect(routine).toMatchObject({
        routine_id: `routine:${routine.routine_kind}`,
        enabled: false,
        user_present_required: true,
        side_effects_allowed: false,
        execution_mode: "contract_only",
        kill_switch_required: true,
        metadata_only: true,
      });
    }
  });

  it("keeps the runtime contract non-executing and scheduler inactive", () => {
    expect(DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT).toMatchObject({
      phase: 17,
      slice: "17A.1",
      runtime_id: "scheduled_assistance_runtime",
      execution_supported: false,
      scheduler_active: false,
      scheduler_running: false,
      side_effects_supported: false,
      timers_registered: false,
      metadata_only: true,
    });
  });

  it("pins off network, cloud, tool, memory, device, project, approval, report, suggestion, and persistence authority", () => {
    expect(getScheduledAssistanceRuntimeContract()).toMatchObject({
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
    });
  });

  it("schema rejects any attempt to turn on execution or side effects", () => {
    const unsafe = {
      ...DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
      execution_supported: true,
      scheduler_active: true,
      tool_execution_allowed: true,
      memory_write_allowed: true,
      device_action_allowed: true,
      routines: DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT.routines.map(
        (routine) => ({
          ...routine,
          enabled: true,
          side_effects_allowed: true,
        }),
      ),
    };

    expect(
      ScheduledAssistanceRuntimeContractSchema.safeParse(unsafe).success,
    ).toBe(false);
  });

  it("does not add timers, scheduler execution, reports, suggestions, persistence, or network markers", () => {
    const source = read("src/lib/routines/runtime-contract.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|INSERT INTO|event_store|writeMemory|callTool|executeTool|controlDevice|approveExecution/i,
    );
  });

  it("documents the Phase 17A runtime contract scaffold", () => {
    const doc = read("docs/phase-17/phase-17a-runtime-contract.md");

    for (const required of [
      "Phase 17A.1",
      "Scheduled Assistance Runtime Contract",
      "Contract Only",
      "No timers",
      "No scheduler execution",
      "No reports or suggestions are generated",
      "No persistence, tools, memory writes, project mutations, device actions, approvals, cloud, or network calls",
    ]) {
      expect(doc).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
