import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
  DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
  PHASE_17_SUGGESTION_INBOX_STATUSES,
  Phase17SuggestionInboxItemSchema,
  createEmptySuggestionInboxItem,
  validateInboxApprovalBridge,
  validateSuggestionInboxSafety,
  validateSuggestionInboxItem,
} from "../../src/lib/routines/suggestion-inbox";

const repoRoot = process.cwd();

describe("Phase 17D.2 suggestion inbox contract scaffold", () => {
  it("declares metadata-only inbox statuses", () => {
    expect(PHASE_17_SUGGESTION_INBOX_STATUSES).toEqual([
      "unavailable",
      "pending",
      "dismissed",
      "accepted_metadata_only",
    ]);
  });

  it("creates an empty inbox item without creating a real inbox record", () => {
    const item = validInboxItem();

    expect(Phase17SuggestionInboxItemSchema.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({
      inbox_item_id: "inbox_item:next_action",
      suggestion_id: "suggestion:next_action",
      routine_id: "routine:next_action_suggest",
      inbox_status: "unavailable",
      metadata_only: true,
      inbox_item_created: false,
      body_attached: false,
      raw_body_allowed: false,
      raw_content_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      action_execution_supported: false,
      action_execution_attempted: false,
      suggestion_generated: false,
      report_generated: false,
      baseline_update_generated: false,
      scheduler_execution_attempted: false,
      routine_execution_attempted: false,
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
  });

  it("validates empty inbox items as metadata-only", () => {
    expect(validateSuggestionInboxItem(validInboxItem())).toEqual({
      kind: "phase17.suggestion_inbox_item_validation",
      pass: true,
      inbox_item_id: "inbox_item:next_action",
      suggestion_id: "suggestion:next_action",
      inbox_status: "unavailable",
      violation_count: 0,
      violations: ["valid_schema"],
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
  });

  it("rejects raw body, raw content, secrets, and PII", () => {
    expect(
      validateSuggestionInboxItem({
        ...validInboxItem(),
        body_attached: true,
        raw_body: "body",
        raw_content: "content",
        api_key: "secret",
        pii_email: "person@example.test",
      }),
    ).toMatchObject({
      pass: false,
      inbox_item_id: null,
      suggestion_id: null,
      inbox_status: null,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_body_forbidden",
        "raw_content_forbidden",
        "secret_forbidden",
        "pii_forbidden",
      ]),
      inbox_item_created: false,
      body_attached: false,
      persisted: false,
    });
  });

  it("rejects persistence, approval bridge, action execution, and authority flags", () => {
    expect(
      validateSuggestionInboxItem({
        ...validInboxItem(),
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
      inbox_item_created: false,
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

  it("validates the inbox redaction and safety boundary as required but unsupported", () => {
    expect(
      validateSuggestionInboxSafety(
        DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
      ),
    ).toEqual({
      kind: "phase17.suggestion_inbox_safety_validation",
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
      inbox_item_created: false,
      body_attached: false,
      suggestion_generated: false,
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
    expect(DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY).toMatchObject({
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

  it("rejects unsafe inbox safety payloads", () => {
    expect(
      validateSuggestionInboxSafety({
        ...DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY,
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

  it("validates inbox approval bridge metadata as unavailable and non-executing", () => {
    expect(
      validateInboxApprovalBridge(
        DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
      ),
    ).toEqual({
      kind: "phase17.suggestion_inbox_approval_bridge_validation",
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
      inbox_item_created: false,
      body_attached: false,
      suggestion_generated: false,
      report_generated: false,
      baseline_update_generated: false,
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

  it("rejects inbox approval references and execution attempts", () => {
    expect(
      validateInboxApprovalBridge({
        ...DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE,
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

  it("keeps the Phase 17D inbox scaffold free of new runtime side-effect markers", () => {
    const source = read("src/lib/routines/suggestion-inbox.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateBaseline/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

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
