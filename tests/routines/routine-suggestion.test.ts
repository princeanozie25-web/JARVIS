import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
  DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
  ROUTINE_SUGGESTION_KINDS,
  RoutineSuggestionSchema,
  createEmptyRoutineSuggestion,
  validateSuggestionApprovalBridge,
  validateRoutineSuggestionSafety,
  validateRoutineSuggestion,
} from "../../src/lib/routines/routine-suggestion";

const repoRoot = process.cwd();

describe("Phase 17D.1 suggestion output contract scaffold", () => {
  it("declares every supported suggestion kind", () => {
    expect(ROUTINE_SUGGESTION_KINDS).toEqual([
      "next_action",
      "cost_review",
      "project_progress",
      "calibration_review",
      "self_audit_followup",
    ]);
  });

  it("creates empty metadata-only suggestions for every kind", () => {
    for (const suggestionKind of ROUTINE_SUGGESTION_KINDS) {
      const suggestion = createEmptyRoutineSuggestion({
        suggestion_id: `suggestion:${suggestionKind}`,
        routine_id: "routine:next_action_suggest",
        source_report_id: "self_audit_report:phase17:daily_self_audit:0:100",
        suggestion_kind: suggestionKind,
      });

      expect(RoutineSuggestionSchema.safeParse(suggestion).success).toBe(true);
      expect(suggestion).toMatchObject({
        suggestion_id: `suggestion:${suggestionKind}`,
        routine_id: "routine:next_action_suggest",
        source_report_id: "self_audit_report:phase17:daily_self_audit:0:100",
        suggestion_kind: suggestionKind,
        metadata_only: true,
        suggestion_generated: false,
        body_generated: false,
        raw_body_allowed: false,
        raw_content_allowed: false,
        redaction_required: true,
        persistence_supported: false,
        persistence_attempted: false,
        approval_bridge_supported: false,
        approval_bridge_attempted: false,
        action_execution_supported: false,
        action_execution_attempted: false,
        inbox_item_supported: false,
        inbox_item_created: false,
        report_generated: false,
        baseline_update_generated: false,
        db_read_performed: false,
        db_write_performed: false,
        event_store_read_performed: false,
        event_store_write_performed: false,
        telemetry_attempted: false,
        tool_called: false,
        device_action_executed: false,
        project_mutated: false,
        memory_written: false,
        approval_executed: false,
        network_called: false,
        cloud_called: false,
      });
    }
  });

  it("validates empty suggestions without producing content or side effects", () => {
    const suggestion = validSuggestion();

    expect(validateRoutineSuggestion(suggestion)).toEqual({
      kind: "phase17.routine_suggestion_validation",
      pass: true,
      suggestion_id: suggestion.suggestion_id,
      suggestion_kind: suggestion.suggestion_kind,
      violation_count: 0,
      violations: ["valid_schema"],
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
  });

  it("rejects raw body, raw content, secrets, and PII", () => {
    expect(
      validateRoutineSuggestion({
        ...validSuggestion(),
        body_generated: true,
        raw_body: "body",
        raw_content: "content",
        api_key: "secret",
        pii_email: "person@example.test",
      }),
    ).toMatchObject({
      pass: false,
      suggestion_id: null,
      suggestion_kind: null,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_body_forbidden",
        "raw_content_forbidden",
        "secret_forbidden",
        "pii_forbidden",
      ]),
      suggestion_generated: false,
      body_generated: false,
      inbox_item_created: false,
    });
  });

  it("rejects persistence, approval bridge, action execution, and authority flags", () => {
    expect(
      validateRoutineSuggestion({
        ...validSuggestion(),
        persistence_supported: true,
        persistence_attempted: true,
        db_write_performed: true,
        event_store_write_performed: true,
        approval_bridge_supported: true,
        approval_bridge_attempted: true,
        action_execution_supported: true,
        action_execution_attempted: true,
        approval_executed: true,
        tool_called: true,
        device_action_executed: true,
        project_mutated: true,
        memory_written: true,
        network_called: true,
        cloud_called: true,
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "persistence_forbidden",
        "approval_or_action_forbidden",
      ]),
      persisted: false,
      persistence_attempted: false,
      db_write_performed: false,
      event_store_write_performed: false,
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
  });

  it("validates the suggestion redaction and safety boundary as required but unsupported", () => {
    expect(
      validateRoutineSuggestionSafety(
        DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY,
      ),
    ).toEqual({
      kind: "phase17.routine_suggestion_safety_validation",
      pass: true,
      violation_count: 0,
      violations: ["valid_schema"],
      metadata_only: true,
      redaction_required: true,
      redaction_supported: false,
      redaction_attempted: false,
      safety_review_required: true,
      safety_review_supported: false,
      safety_review_attempted: false,
      suggestion_generated: false,
      body_generated: false,
      body_attached: false,
      inbox_item_created: false,
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
    expect(DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY).toMatchObject({
      raw_body_allowed: false,
      raw_report_allowed: false,
      raw_source_snapshot_allowed: false,
      pii_allowed: false,
      secrets_allowed: false,
      project_body_allowed: false,
      tool_output_allowed: false,
      prompt_allowed: false,
      model_output_allowed: false,
      action_payload_allowed: false,
    });
  });

  it("rejects unsafe suggestion safety payloads", () => {
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
        redaction_supported: true,
        redaction_attempted: true,
        safety_review_supported: true,
        safety_review_attempted: true,
        body_attached: true,
        persistence_attempted: true,
        approval_bridge_attempted: true,
        action_execution_attempted: true,
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
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
        "persistence_forbidden",
        "approval_or_action_forbidden",
      ]),
      redaction_attempted: false,
      safety_review_attempted: false,
      body_attached: false,
      persisted: false,
      approval_bridge_attempted: false,
      action_execution_attempted: false,
    });
  });

  it("validates suggestion approval bridge metadata as unavailable and non-executing", () => {
    expect(
      validateSuggestionApprovalBridge(
        DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
      ),
    ).toEqual({
      kind: "phase17.routine_suggestion_approval_bridge_validation",
      pass: true,
      violation_count: 0,
      violations: ["valid_schema"],
      metadata_only: true,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      approval_required_if_executed: true,
      approval_state: "unavailable",
      suggestion_generated: false,
      body_generated: false,
      inbox_item_created: false,
      persisted: false,
      persistence_attempted: false,
      db_read_performed: false,
      db_write_performed: false,
      event_store_read_performed: false,
      event_store_write_performed: false,
      telemetry_attempted: false,
      tool_called: false,
      device_action_executed: false,
      project_mutated: false,
      memory_written: false,
      approval_created: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
  });

  it("rejects suggestion approval references and execution attempts", () => {
    expect(
      validateSuggestionApprovalBridge({
        ...DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE,
        approval_reference_allowed: true,
        approval_reference_present: true,
        approval_id: "approval:123",
        approval_bridge_supported: true,
        approval_bridge_attempted: true,
        approval_state: "approved",
        action_execution_supported: true,
        action_execution_attempted: true,
        approval_created: true,
        approval_executed: true,
        persistence_attempted: true,
        db_write_performed: true,
        event_store_write_performed: true,
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "approval_reference_forbidden",
        "approval_or_action_forbidden",
        "persistence_forbidden",
      ]),
      approval_bridge_attempted: false,
      approval_reference_allowed: false,
      approval_reference_present: false,
      action_execution_attempted: false,
      approval_state: "unavailable",
      approval_created: false,
      approval_executed: false,
      persisted: false,
    });
  });

  it("does not add inbox creation, reports, DB/event-store, tools, approvals, cloud, or network behavior", () => {
    const source = read("src/lib/routines/routine-suggestion.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateBaseline|createSuggestionInboxItem/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
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

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
