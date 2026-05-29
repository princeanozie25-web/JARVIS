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
import { DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES } from "../../src/lib/routines/read-scope";
import { evaluateRoutineReadScopeBinding } from "../../src/lib/routines/read-scope-binding";
import { getScheduledAssistanceRuntimeContract } from "../../src/lib/routines/runtime-contract";
import { evaluateRoutineEligibility } from "../../src/lib/routines/routine-eligibility";
import { buildForegroundSchedulerAuditPreview } from "../../src/lib/routines/scheduler-audit-preview";
import { buildForegroundSchedulerOutputEnvelope } from "../../src/lib/routines/scheduler-output-envelope";
import { evaluateForegroundSchedulerTick } from "../../src/lib/routines/foreground-scheduler";

const repoRoot = process.cwd();

describe("Phase 17B.6 foreground scheduler closeout guard", () => {
  it("proves the foreground tick evaluator is metadata-only and non-executing", () => {
    const decision = evaluateForegroundSchedulerTick(
      {
        tick_id: "tick:phase17b:closeout",
        tick_source_kind: "foreground_scheduler",
        kill_switch_state: "safe",
        user_present_state: "present",
      },
      DEFAULT_PHASE_17_ROUTINE_REGISTRY,
      getScheduledAssistanceRuntimeContract(),
    );

    expect(decision).toMatchObject({
      tick_id: "tick:phase17b:closeout",
      decision: "denied",
      foreground_only: true,
      scheduler_execution_supported: false,
      scheduler_execution_allowed: false,
      routine_execution_supported: false,
      routine_execution_allowed: false,
      side_effects_allowed: false,
      execution_attempted: false,
      persistence_attempted: false,
      metadata_only: true,
      timer_started: false,
      scheduler_started: false,
      routine_executed: false,
      collector_ran: false,
      report_generated: false,
      suggestion_generated: false,
      db_read_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
    });
    expect(decision.routine_eligibility).toHaveLength(5);
    expect(decision.output_envelopes).toHaveLength(5);
    expect(decision.audit_preview).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_attempted: false,
      event_store_write_attempted: false,
      telemetry_attempted: false,
    });
  });

  it("proves background and headless ticks are denied", () => {
    for (const tickSourceKind of [
      "background",
      "headless",
      "background_headless",
    ] as const) {
      expect(
        evaluateForegroundSchedulerTick({
          tick_id: `tick:phase17b:closeout:${tickSourceKind}`,
          tick_source_kind: tickSourceKind,
          kill_switch_state: "safe",
        }),
      ).toMatchObject({
        decision: "denied",
        reason: "background_headless_tick_rejected",
        background_allowed: false,
        routine_executed: false,
      });
    }
  });

  it("proves routine eligibility exists and eligible metadata still cannot execute", () => {
    const routine = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0],
      enabled: true,
    };
    const eligibility = evaluateRoutineEligibility(
      routine,
      {
        tick_id: "tick:phase17b:eligibility-closeout",
        tick_source_kind: "manual",
      },
      getScheduledAssistanceRuntimeContract(),
      {
        kill_switch_state: "safe",
        user_present_state: "present",
      },
    );

    expect(eligibility).toMatchObject({
      eligible: true,
      reason: "eligible_metadata_only",
      metadata_only: true,
      routine_execution_allowed: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      collector_ran: false,
      persisted: false,
    });
  });

  it("proves read-scope binding is bounded and read-only", () => {
    for (const routine of DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines) {
      const binding = evaluateRoutineReadScopeBinding(
        routine,
        DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
      );

      expect(binding).toMatchObject({
        routine_id: routine.routine_id,
        binding_complete: true,
        denied_read_scopes: [],
        metadata_only: true,
        collector_execution_supported: false,
        collector_execution_attempted: false,
        db_read_supported: false,
        db_read_performed: false,
        event_store_read_supported: false,
        event_store_read_performed: false,
        report_generation_supported: false,
        report_generated: false,
        suggestion_generation_supported: false,
        suggestion_generated: false,
        persistence_supported: false,
        persisted: false,
      });
    }
  });

  it("proves output envelopes and audit previews are shaped but non-productive", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0];
    const envelope = buildForegroundSchedulerOutputEnvelope({
      tick_id: "tick:phase17b:output-closeout",
      routine,
      eligible: true,
    });
    const audit = buildForegroundSchedulerAuditPreview({
      tick_id: "tick:phase17b:audit-closeout",
      source_kind: "manual",
      eligible_count: 1,
      skipped_count: 4,
      output_envelope_count: 5,
    });

    expect(envelope).toMatchObject({
      output_kind: "report",
      output_supported: false,
      output_generated: false,
      redaction_required: true,
      raw_output_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
    });
    expect(audit).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      telemetry_supported: false,
      telemetry_attempted: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
    });
  });

  it("keeps the Phase 17 disabled guard matrix pinned", () => {
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
      raw_report_telemetry_enabled: false,
      raw_suggestion_telemetry_enabled: false,
      metadata_only: true,
      foreground_only: true,
      non_executing: true,
    });
    expect(validatePhase17RoutineRegistry()).toMatchObject({
      pass: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });
    expect(evaluatePhase17DisabledGuard("scheduler_execution")).toMatchObject({
      allowed: false,
      scheduler_started: false,
      routine_executed: false,
      persisted: false,
    });
  });

  it("keeps Phase 17B source files free of runtime side-effect markers", () => {
    const sources = [
      read("src/lib/routines/foreground-scheduler.ts"),
      read("src/lib/routines/routine-eligibility.ts"),
      read("src/lib/routines/read-scope-binding.ts"),
      read("src/lib/routines/scheduler-output-envelope.ts"),
      read("src/lib/routines/scheduler-audit-preview.ts"),
    ].join("\n");

    expect(sources).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion|generateBaseline/i,
    );
    expect(sources).not.toMatch(/\bcollect[A-Z]/);
  });

  it("documents Phase 17B closeout and Phase 17C prerequisite", () => {
    const closeout = read("docs/phase-17/phase-17b-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 17B Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "What 17B Achieved",
      "What Remains Intentionally Unimplemented",
      "Phase 17C.1 - Self-Audit Report Schema Scaffold",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
