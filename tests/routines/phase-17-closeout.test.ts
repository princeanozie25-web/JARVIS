import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  PHASE_17_DISABLED_FEATURES,
  evaluatePhase17DisabledGuard,
} from "../../src/lib/routines/phase-17-disabled-guards";
import { evaluateForegroundSchedulerTick } from "../../src/lib/routines/foreground-scheduler";
import { DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES } from "../../src/lib/routines/read-scope";
import { evaluateRoutineReadScopeBinding } from "../../src/lib/routines/read-scope-binding";
import {
  DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  validatePhase17RoutineRegistry,
} from "../../src/lib/routines/routine-registry";
import {
  DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
  DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
  buildRoutineSuggestionAuditPreview,
  createEmptyRoutineSuggestion,
  validateRoutineSuggestion,
  validateRoutineSuggestionSafety,
  validateSuggestionApprovalBridge,
} from "../../src/lib/routines/routine-suggestion";
import { evaluateRoutineEligibility } from "../../src/lib/routines/routine-eligibility";
import { getScheduledAssistanceRuntimeContract } from "../../src/lib/routines/runtime-contract";
import {
  PHASE_17_SELF_AUDIT_REPORT_SECTIONS,
  PHASE_17_SELF_AUDIT_SOURCE_KINDS,
  createEmptyPhase17SelfAuditReport,
  createEmptySelfAuditAggregationEnvelope,
  createEmptySelfAuditSourceSnapshot,
  validateSelfAuditAggregationEnvelope,
  validateSelfAuditReportSchema,
  validateSelfAuditSourceSnapshot,
} from "../../src/lib/routines/self-audit-report";
import { evaluateScheduledAssistanceTick } from "../../src/lib/routines/scheduled-assistance-tick-source";
import {
  DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
  DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
  buildSuggestionInboxAuditPreview,
  createEmptySuggestionInboxItem,
  validateInboxApprovalBridge,
  validateSuggestionInboxItem,
  validateSuggestionInboxSafety,
} from "../../src/lib/routines/suggestion-inbox";

const repoRoot = process.cwd();

describe("Phase 17 final scheduled assistance closeout guard", () => {
  it("proves all Phase 17 closeout guards and final closeout docs exist", () => {
    for (const path of [
      "tests/routines/phase-17a-closeout.test.ts",
      "tests/routines/phase-17b-closeout.test.ts",
      "tests/routines/phase-17c-closeout.test.ts",
      "tests/routines/phase-17d-closeout.test.ts",
      "docs/phase-17/phase-17a-closeout.md",
      "docs/phase-17/phase-17b-closeout.md",
      "docs/phase-17/phase-17c-closeout.md",
      "docs/phase-17/phase-17d-closeout.md",
    ]) {
      expect(read(path).length).toBeGreaterThan(100);
    }
  });

  it("keeps the runtime contract and disabled guard matrix pinned", () => {
    const runtime = getScheduledAssistanceRuntimeContract();

    expect(runtime).toMatchObject({
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
      suggestion_only: true,
      foreground_only: true,
      metadata_only: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });

    for (const feature of PHASE_17_DISABLED_FEATURES) {
      expect(evaluatePhase17DisabledGuard(feature)).toMatchObject({
        feature,
        allowed: false,
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

  it("keeps the routine registry opt-in, metadata-only, foreground-only, and non-authoritative", () => {
    expect(validatePhase17RoutineRegistry()).toMatchObject({
      pass: true,
      routine_count: 5,
      required_routine_count: 5,
      metadata_only: true,
      foreground_only: true,
      suggestion_only: true,
      non_executing: true,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
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

  it("keeps tick source and foreground scheduler decisions metadata-only and non-executing", () => {
    expect(
      evaluateScheduledAssistanceTick({
        tick_id: "tick:phase17:final",
        tick_source_kind: "foreground_scheduler",
      }),
    ).toMatchObject({
      decision: "denied",
      execution_allowed: false,
      foreground_only: true,
      background_allowed: false,
      scheduler_execution_supported: false,
      scheduler_execution_attempted: false,
      routine_execution_supported: false,
      routine_execution_attempted: false,
      catch_up_supported: false,
      timer_started: false,
      scheduler_started: false,
      routine_executed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });

    const decision = evaluateForegroundSchedulerTick({
      tick_id: "tick:phase17:final:foreground",
      tick_source_kind: "foreground_scheduler",
      kill_switch_state: "safe",
      user_present_state: "present",
    });

    expect(decision).toMatchObject({
      decision: "denied",
      reason: "scheduler_execution_not_implemented",
      foreground_only: true,
      background_allowed: false,
      scheduler_execution_supported: false,
      scheduler_execution_allowed: false,
      routine_execution_supported: false,
      routine_execution_allowed: false,
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
      persisted: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
    });
    expect(decision.output_envelopes).toHaveLength(5);
    for (const envelope of decision.output_envelopes) {
      expect(envelope).toMatchObject({
        output_supported: false,
        output_generated: false,
        report_generated: false,
        suggestion_generated: false,
        baseline_update_generated: false,
        raw_output_allowed: false,
        persistence_attempted: false,
        approval_bridge_attempted: false,
      });
    }
    expect(decision.audit_preview).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_attempted: false,
      event_store_write_attempted: false,
      telemetry_attempted: false,
    });
  });

  it("keeps eligibility and read-scope binding explanatory but non-productive", () => {
    const routine = {
      ...DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[4],
      enabled: true,
    };
    const eligibility = evaluateRoutineEligibility(
      routine,
      {
        tick_id: "tick:phase17:final:eligibility",
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

    const binding = evaluateRoutineReadScopeBinding(
      routine,
      DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
    );
    expect(binding).toMatchObject({
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
  });

  it("keeps self-audit schemas, source snapshots, and aggregation empty and non-reading", () => {
    const report = createEmptyPhase17SelfAuditReport({
      report_id: "self_audit_report:phase17:final:0:100",
      routine_id: "routine:daily_self_audit",
      generated_by_routine_id: "routine:daily_self_audit",
      start_ms: 0,
      end_ms: 100,
    });
    const snapshots = PHASE_17_SELF_AUDIT_SOURCE_KINDS.map((sourceKind) =>
      createEmptySelfAuditSourceSnapshot({
        snapshot_id: `snapshot:${sourceKind}`,
        source_kind: sourceKind,
      }),
    );
    const aggregation = createEmptySelfAuditAggregationEnvelope({
      aggregation_id: "aggregation:phase17:final",
      report_id: report.report_id,
      source_snapshot_ids: snapshots.map((snapshot) => snapshot.snapshot_id),
      section_ids: report.sections.map((section) => section.section_id),
    });

    expect(validateSelfAuditReportSchema(report)).toMatchObject({
      pass: true,
      section_count: PHASE_17_SELF_AUDIT_REPORT_SECTIONS.length,
      metadata_only: true,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      persisted: false,
      telemetry_attempted: false,
    });
    for (const snapshot of snapshots) {
      expect(validateSelfAuditSourceSnapshot(snapshot)).toMatchObject({
        pass: true,
        row_count: 0,
        source_read_attempted: false,
        collector_attempted: false,
        report_generated: false,
        suggestion_generated: false,
        baseline_update_generated: false,
        db_read_performed: false,
        event_store_read_performed: false,
        event_store_write_performed: false,
        telemetry_attempted: false,
      });
    }
    expect(validateSelfAuditAggregationEnvelope(aggregation)).toMatchObject({
      pass: true,
      aggregation_attempted: false,
      source_reads_attempted: false,
      collector_execution_attempted: false,
      report_body_generated: false,
      summary_generated: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
      db_read_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      persisted: false,
      telemetry_attempted: false,
    });
  });

  it("keeps suggestion output and inbox contracts metadata-only and non-actionable", () => {
    const suggestion = createEmptyRoutineSuggestion({
      suggestion_id: "suggestion:phase17:final",
      routine_id: "routine:next_action_suggest",
      source_report_id: "self_audit_report:phase17:final:0:100",
      suggestion_kind: "next_action",
    });
    const inboxItem = createEmptySuggestionInboxItem({
      inbox_item_id: "inbox_item:phase17:final",
      suggestion_id: suggestion.suggestion_id,
      routine_id: suggestion.routine_id,
    });

    expect(validateRoutineSuggestion(suggestion)).toMatchObject({
      pass: true,
      metadata_only: true,
      suggestion_generated: false,
      body_generated: false,
      inbox_item_created: false,
      report_generated: false,
      baseline_update_generated: false,
      persisted: false,
      persistence_attempted: false,
      db_read_performed: false,
      db_write_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      telemetry_attempted: false,
      approval_bridge_attempted: false,
      action_execution_attempted: false,
      tool_called: false,
      device_action_executed: false,
      project_mutated: false,
      memory_written: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(validateSuggestionInboxItem(inboxItem)).toMatchObject({
      pass: true,
      metadata_only: true,
      inbox_item_created: false,
      body_attached: false,
      suggestion_generated: false,
      report_generated: false,
      baseline_update_generated: false,
      scheduler_execution_attempted: false,
      routine_execution_attempted: false,
      persisted: false,
      persistence_attempted: false,
      db_read_performed: false,
      db_write_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      telemetry_attempted: false,
      approval_bridge_attempted: false,
      action_execution_attempted: false,
    });
    expect(
      validateRoutineSuggestionSafety(
        DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
      ),
    ).toMatchObject({
      pass: true,
      redaction_required: true,
      redaction_supported: false,
      redaction_attempted: false,
      safety_review_required: true,
      safety_review_supported: false,
      safety_review_attempted: false,
      persisted: false,
    });
    expect(
      validateSuggestionInboxSafety(
        DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
      ),
    ).toMatchObject({
      pass: true,
      redaction_required: true,
      redaction_supported: false,
      redaction_attempted: false,
      safety_review_required: true,
      safety_review_supported: false,
      safety_review_attempted: false,
      persisted: false,
    });
    expect(
      validateSuggestionApprovalBridge(
        DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
      ),
    ).toMatchObject({
      pass: true,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      approval_state: "unavailable",
      approval_created: false,
      approval_executed: false,
    });
    expect(
      validateInboxApprovalBridge(
        DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
      ),
    ).toMatchObject({
      pass: true,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      approval_state: "unavailable",
      approval_created: false,
      approval_executed: false,
    });
    expect(buildRoutineSuggestionAuditPreview(suggestion)).toMatchObject({
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_attempted: false,
      event_store_write_attempted: false,
      telemetry_attempted: false,
      suggestion_generated: false,
      body_generated: false,
      approval_created: false,
      approval_executed: false,
    });
    expect(buildSuggestionInboxAuditPreview(inboxItem)).toMatchObject({
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_attempted: false,
      event_store_write_attempted: false,
      telemetry_attempted: false,
      inbox_item_created: false,
      body_attached: false,
      approval_created: false,
      approval_executed: false,
    });
  });

  it("keeps unsafe raw reports, suggestions, source payloads, secrets, and PII rejected", () => {
    expect(
      validateRoutineSuggestionSafety({
        ...DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
        raw_body: "body",
        raw_report: "report",
        raw_source_snapshot: "snapshot",
        pii_email: "person@example.test",
        api_key: "secret",
        project_body: "project",
        tool_output: "tool",
        prompt: "prompt",
        model_output: "model",
        action_payload: "action",
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "raw_body_forbidden",
        "raw_report_forbidden",
        "raw_source_snapshot_forbidden",
        "pii_forbidden",
        "secret_forbidden",
        "project_body_forbidden",
        "tool_output_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
        "action_payload_forbidden",
      ]),
      body_attached: false,
      persisted: false,
      action_execution_attempted: false,
    });
    expect(
      validateSelfAuditReportSchema({
        ...createEmptyPhase17SelfAuditReport({
          report_id: "self_audit_report:phase17:unsafe:0:100",
          routine_id: "routine:daily_self_audit",
          generated_by_routine_id: "routine:daily_self_audit",
          start_ms: 0,
          end_ms: 100,
        }),
        raw_payload: "raw",
        api_key: "secret",
        pii_email: "person@example.test",
        report_body_text: "body",
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
        "report_body_forbidden",
      ]),
      report_generated: false,
      telemetry_attempted: false,
    });
  });

  it("keeps Phase 17 source files free of scheduler, persistence, authority, and network markers", () => {
    const sources = [
      "src/lib/routines/runtime-contract.ts",
      "src/lib/routines/phase-17-disabled-guards.ts",
      "src/lib/routines/routine-registry.ts",
      "src/lib/routines/scheduled-assistance-tick-source.ts",
      "src/lib/routines/foreground-scheduler.ts",
      "src/lib/routines/routine-eligibility.ts",
      "src/lib/routines/read-scope.ts",
      "src/lib/routines/read-scope-binding.ts",
      "src/lib/routines/scheduler-output-envelope.ts",
      "src/lib/routines/scheduler-audit-preview.ts",
      "src/lib/routines/self-audit-report.ts",
      "src/lib/routines/routine-suggestion.ts",
      "src/lib/routines/suggestion-inbox.ts",
    ]
      .map(read)
      .join("\n");

    expect(sources).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateBaseline/i,
    );
    expect(sources).not.toMatch(/\bcollect[A-Z]/);
  });

  it("documents the final Phase 17 verdict and Phase 18 handoff", () => {
    const closeout = read("docs/phase-17/phase-17-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed Phase 17 Slices",
      "Files/Modules Audited",
      "Final Operational State",
      "Explicit Disabled Features Still Pinned Off",
      "What Phase 17 Achieved",
      "What Phase 17 Intentionally Did Not Implement",
      "Phase 18 - Approval-Gated Execution Layer",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
