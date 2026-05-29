import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ForegroundSchedulerAuditPreviewSchema,
  buildForegroundSchedulerAuditPreview,
} from "../../src/lib/routines/scheduler-audit-preview";

const repoRoot = process.cwd();

describe("Phase 17B.5 foreground scheduler audit preview scaffold", () => {
  it("builds metadata-only replay-safe audit preview summaries", () => {
    expect(
      buildForegroundSchedulerAuditPreview({
        tick_id: "tick:phase17b:audit-preview",
        source_kind: "foreground_scheduler",
        eligible_count: 1,
        skipped_count: 4,
        output_envelope_count: 5,
      }),
    ).toEqual({
      audit_preview_id: "audit_preview:phase17b:audit-preview",
      tick_id: "tick:phase17b:audit-preview",
      source_kind: "foreground_scheduler",
      eligible_count: 1,
      skipped_count: 4,
      output_envelope_count: 5,
      metadata_only: true,
      replay_safe: true,
      redaction_status: "not_started",
      raw_payload_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      telemetry_supported: false,
      telemetry_attempted: false,
      collector_execution_supported: false,
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_read_performed: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
      routine_executed: false,
      timer_started: false,
      scheduler_started: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
    });
  });

  it("rejects raw payload, persistence, event-store writes, telemetry, and generated content", () => {
    const preview = buildForegroundSchedulerAuditPreview({
      tick_id: "tick:phase17b:audit-schema",
      source_kind: "manual",
      eligible_count: 0,
      skipped_count: 5,
      output_envelope_count: 5,
    });

    expect(
      ForegroundSchedulerAuditPreviewSchema.safeParse({
        ...preview,
        raw_payload_allowed: true,
        persistence_supported: true,
        persistence_attempted: true,
        event_store_write_supported: true,
        event_store_write_attempted: true,
        telemetry_supported: true,
        telemetry_attempted: true,
        report_generated: true,
        suggestion_generated: true,
        baseline_update_generated: true,
      }).success,
    ).toBe(false);
  });

  it("does not add collectors, DB/event-store reads or writes, reports, suggestions, baselines, timers, tools, mutations, approval, cloud, or network behavior", () => {
    const source = read("src/lib/routines/scheduler-audit-preview.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion|generateBaseline/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
