import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PHASE_17_SELF_AUDIT_REPORT_SECTIONS,
  Phase17SelfAuditReportSchema,
  createEmptyPhase17SelfAuditReport,
  validateSelfAuditReportSchema,
} from "../../src/lib/routines/self-audit-report";

const repoRoot = process.cwd();

describe("Phase 17C.1 self-audit report schema scaffold", () => {
  it("accepts a valid empty metadata-only report with every required section", () => {
    const report = validReport();
    const validation = validateSelfAuditReportSchema(report);

    expect(Phase17SelfAuditReportSchema.safeParse(report).success).toBe(true);
    expect(validation).toEqual({
      kind: "phase17.self_audit_report_schema_validation",
      pass: true,
      report_id: report.report_id,
      section_count: PHASE_17_SELF_AUDIT_REPORT_SECTIONS.length,
      violation_count: 0,
      violations: ["valid_schema"],
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
      tool_called: false,
      device_action_executed: false,
      project_mutated: false,
      memory_written: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(report.sections.map((section) => section.section)).toEqual([
      "approvals",
      "tools",
      "cost_model_usage",
      "vision",
      "environment_room",
      "projects",
      "router",
      "safety",
      "routines_scheduler",
    ]);
  });

  it("keeps all sections empty, metadata-only, and collector-free", () => {
    for (const section of validReport().sections) {
      expect(section).toMatchObject({
        metadata_only: true,
        item_count: 0,
        summary_available: false,
        raw_payload_allowed: false,
        pii_allowed: false,
        secrets_allowed: false,
        report_body_allowed: false,
        generated_content_allowed: false,
        collector_execution_supported: false,
        collector_execution_attempted: false,
        db_read_performed: false,
        event_store_read_performed: false,
      });
    }
  });

  it("rejects missing required sections and invalid schema shape", () => {
    const report = {
      ...validReport(),
      sections: validReport().sections.filter(
        (section) => section.section !== "routines_scheduler",
      ),
    };

    expect(validateSelfAuditReportSchema(report)).toMatchObject({
      pass: false,
      violations: ["invalid_schema"],
      metadata_only: true,
      report_generated: false,
      event_store_write_performed: false,
    });
  });

  it("rejects raw payloads, secrets, PII, and report body fields", () => {
    const unsafe = {
      ...validReport(),
      raw_payload: "raw report bytes",
      api_key: "secret",
      pii_email: "person@example.test",
      report_body_text: "body text",
    };

    expect(validateSelfAuditReportSchema(unsafe)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
        "report_body_forbidden",
      ]),
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_write_performed: false,
    });
  });

  it("rejects tool output, project bodies, voice transcripts, OCR text, frames, prompts, and model outputs", () => {
    const unsafe = {
      ...validReport(),
      tool_output: "tool text",
      project_body: "project body",
      voice_transcript: "voice text",
      ocr_text: "ocr text",
      raw_frame: "frame bytes",
      prompt: "prompt text",
      model_output: "model output",
    };

    expect(validateSelfAuditReportSchema(unsafe)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "tool_output_forbidden",
        "project_body_forbidden",
        "voice_transcript_forbidden",
        "ocr_text_forbidden",
        "frame_payload_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
      ]),
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      approval_executed: false,
      network_called: false,
      cloud_called: false,
    });
  });

  it("rejects persistence, event-store, generated output, and authority flags", () => {
    const unsafe = {
      ...validReport(),
      persistence_supported: true,
      persistence_attempted: true,
      event_store_write_performed: true,
      report_generated: true,
      suggestion_generated: true,
      baseline_update_generated: true,
      tool_called: true,
      device_action_executed: true,
      memory_written: true,
      cloud_called: true,
    };

    expect(validateSelfAuditReportSchema(unsafe)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "persistence_forbidden",
      ]),
      collector_execution_attempted: false,
      db_read_performed: false,
      telemetry_attempted: false,
    });
  });

  it("does not add collectors, DB/event-store reads or writes, report generation, suggestions, baselines, tools, mutations, approvals, cloud, or network behavior", () => {
    const source = read("src/lib/routines/self-audit-report.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion|generateBaseline/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function validReport() {
  return createEmptyPhase17SelfAuditReport({
    report_id: "self_audit_report:phase17:daily_self_audit:0:100",
    routine_id: "routine:daily_self_audit",
    generated_by_routine_id: "routine:daily_self_audit",
    start_ms: 0,
    end_ms: 100,
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
