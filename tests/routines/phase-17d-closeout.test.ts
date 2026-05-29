import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  evaluatePhase17DisabledGuard,
} from "../../src/lib/routines/phase-17-disabled-guards";
import {
  DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
  DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
  ROUTINE_SUGGESTION_KINDS,
  RoutineSuggestionAuditPreviewSchema,
  buildRoutineSuggestionAuditPreview,
  createEmptyRoutineSuggestion,
  validateRoutineSuggestion,
  validateRoutineSuggestionSafety,
  validateSuggestionApprovalBridge,
} from "../../src/lib/routines/routine-suggestion";
import {
  DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
  DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
  PHASE_17_SUGGESTION_INBOX_STATUSES,
  Phase17SuggestionInboxAuditPreviewSchema,
  buildSuggestionInboxAuditPreview,
  createEmptySuggestionInboxItem,
  validateInboxApprovalBridge,
  validateSuggestionInboxItem,
  validateSuggestionInboxSafety,
} from "../../src/lib/routines/suggestion-inbox";

const repoRoot = process.cwd();

describe("Phase 17D.6 suggestion output closeout guard", () => {
  it("proves suggestion output contracts exist and remain non-generating", () => {
    expect(ROUTINE_SUGGESTION_KINDS).toEqual([
      "next_action",
      "cost_review",
      "project_progress",
      "calibration_review",
      "self_audit_followup",
    ]);

    const suggestion = validSuggestion();
    expect(validateRoutineSuggestion(suggestion)).toMatchObject({
      kind: "phase17.routine_suggestion_validation",
      pass: true,
      suggestion_id: suggestion.suggestion_id,
      suggestion_kind: suggestion.suggestion_kind,
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
    expect(suggestion).toMatchObject({
      approval_bridge_supported: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      approval_required_if_executed: true,
      approval_state: "unavailable",
    });
  });

  it("proves suggestion inbox contracts exist and remain non-persisting", () => {
    expect(PHASE_17_SUGGESTION_INBOX_STATUSES).toEqual([
      "unavailable",
      "pending",
      "dismissed",
      "accepted_metadata_only",
    ]);

    const item = validInboxItem();
    expect(validateSuggestionInboxItem(item)).toMatchObject({
      kind: "phase17.suggestion_inbox_item_validation",
      pass: true,
      inbox_item_id: item.inbox_item_id,
      suggestion_id: item.suggestion_id,
      inbox_status: "unavailable",
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
      tool_called: false,
      device_action_executed: false,
      project_mutated: false,
      memory_written: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(item).toMatchObject({
      approval_bridge_supported: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      approval_required_if_executed: true,
      approval_state: "unavailable",
    });
  });

  it("proves redaction and safety guards reject unsafe payloads", () => {
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
      body_attached: false,
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
      body_attached: false,
      persisted: false,
    });

    const unsafe = {
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
    };

    expect(validateRoutineSuggestionSafety(unsafe)).toMatchObject({
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
      action_execution_attempted: false,
    });
    expect(
      validateSuggestionInboxSafety({
        ...DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
        ...unsafe,
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
      inbox_item_created: false,
      action_execution_attempted: false,
    });
  });

  it("proves approval bridge metadata remains unsupported and non-actionable", () => {
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
      approval_required_if_executed: true,
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
      approval_required_if_executed: true,
      approval_state: "unavailable",
      approval_created: false,
      approval_executed: false,
    });

    expect(
      validateSuggestionApprovalBridge({
        ...DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
        approval_id: "approval:123",
        approval_reference_present: true,
        approval_bridge_attempted: true,
        action_execution_attempted: true,
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "approval_reference_forbidden",
        "approval_or_action_forbidden",
      ]),
      approval_state: "unavailable",
      approval_created: false,
      approval_executed: false,
    });
  });

  it("proves audit previews are metadata-only and replay-safe", () => {
    const suggestionPreview =
      buildRoutineSuggestionAuditPreview(validSuggestion());
    const inboxPreview = buildSuggestionInboxAuditPreview(validInboxItem());

    expect(suggestionPreview).toMatchObject({
      audit_preview_supported: false,
      audit_preview_attempted: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      telemetry_supported: false,
      telemetry_attempted: false,
      suggestion_generated: false,
      body_generated: false,
      inbox_item_created: false,
      approval_created: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(inboxPreview).toMatchObject({
      audit_preview_supported: false,
      audit_preview_attempted: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      raw_payload_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      telemetry_supported: false,
      telemetry_attempted: false,
      inbox_item_created: false,
      body_attached: false,
      approval_created: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });

    expect(
      RoutineSuggestionAuditPreviewSchema.safeParse({
        ...suggestionPreview,
        raw_payload_allowed: true,
        persistence_attempted: true,
      }).success,
    ).toBe(false);
    expect(
      Phase17SuggestionInboxAuditPreviewSchema.safeParse({
        ...inboxPreview,
        event_store_write_attempted: true,
        telemetry_attempted: true,
      }).success,
    ).toBe(false);
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
    for (const feature of [
      "scheduler_execution",
      "tool_calls",
      "device_actions",
      "project_mutations",
      "memory_writes",
      "approval_execution",
      "cloud_network_calls",
      "raw_suggestion_telemetry",
    ] as const) {
      expect(evaluatePhase17DisabledGuard(feature)).toMatchObject({
        allowed: false,
        routine_executed: false,
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

  it("keeps Phase 17D source files free of new runtime side-effect markers", () => {
    const sources = [
      read("src/lib/routines/routine-suggestion.ts"),
      read("src/lib/routines/suggestion-inbox.ts"),
    ].join("\n");

    expect(sources).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateBaseline/i,
    );
    expect(sources).not.toMatch(/\bcollect[A-Z]/);
  });

  it("documents Phase 17D closeout and Phase 17 final prerequisite", () => {
    const closeout = read("docs/phase-17/phase-17d-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 17D Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "What 17D Achieved",
      "What Remains Intentionally Unimplemented",
      "Phase 17 Final Closeout",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function validSuggestion() {
  return createEmptyRoutineSuggestion({
    suggestion_id: "suggestion:next_action",
    routine_id: "routine:next_action_suggest",
    source_report_id: "self_audit_report:phase17:daily_self_audit:0:100",
    suggestion_kind: "next_action",
  });
}

function validInboxItem() {
  return createEmptySuggestionInboxItem({
    inbox_item_id: "inbox_item:next_action",
    suggestion_id: "suggestion:next_action",
    routine_id: "routine:next_action_suggest",
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
