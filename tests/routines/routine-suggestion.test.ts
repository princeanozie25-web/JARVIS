import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ROUTINE_SUGGESTION_KINDS,
  RoutineSuggestionSchema,
  createEmptyRoutineSuggestion,
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
