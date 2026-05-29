import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PHASE_17_SELF_AUDIT_REPORT_SECTIONS,
  PHASE_17_SELF_AUDIT_SOURCE_KINDS,
  DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
  DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
  Phase17SelfAuditReportSchema,
  createEmptyPhase17SelfAuditReport,
  createEmptySelfAuditSourceSnapshot,
  validateSelfAuditRedactionBoundary,
  validateSelfAuditSectionMetadata,
  validateSelfAuditSourceSnapshot,
  validateSelfAuditTelemetryBoundary,
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
        section_id: `section:${section.section}`,
        section_kind: section.section,
        metadata_only: true,
        collector_supported: false,
        collector_attempted: false,
        source_read_supported: false,
        source_read_attempted: false,
        item_count: 0,
        row_cap: 250,
        max_items: 250,
        summary_available: false,
        summary_generated: false,
        raw_payload_allowed: false,
        redaction_required: true,
        redaction_status: "not_started",
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

  it("validates every detailed section metadata contract", () => {
    for (const section of validReport().sections) {
      expect(validateSelfAuditSectionMetadata(section)).toEqual({
        kind: "phase17.self_audit_section_metadata_validation",
        pass: true,
        section_id: section.section_id,
        section_kind: section.section_kind,
        violation_count: 0,
        violations: ["valid_schema"],
        metadata_only: true,
        summary_generated: false,
        collector_attempted: false,
        source_read_attempted: false,
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
    }
  });

  it("rejects unsafe section metadata fields", () => {
    const unsafeSection = {
      ...validReport().sections[0],
      raw_payload: "raw",
      report_body_text: "body",
      api_key: "secret",
      pii_email: "person@example.test",
      tool_output: "tool",
      project_body: "project",
      voice_transcript: "voice",
      ocr_text: "ocr",
      raw_frame: "frame",
      prompt: "prompt",
      model_output: "model",
    };

    expect(validateSelfAuditSectionMetadata(unsafeSection)).toMatchObject({
      pass: false,
      section_id: null,
      section_kind: null,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
        "report_body_forbidden",
        "tool_output_forbidden",
        "project_body_forbidden",
        "voice_transcript_forbidden",
        "ocr_text_forbidden",
        "frame_payload_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
      ]),
      summary_generated: false,
      collector_attempted: false,
      source_read_attempted: false,
      db_read_performed: false,
      event_store_write_performed: false,
      telemetry_attempted: false,
    });
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

  it("validates the disabled redaction boundary as metadata-only", () => {
    expect(
      validateSelfAuditRedactionBoundary(
        DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
      ),
    ).toEqual({
      kind: "phase17.self_audit_redaction_boundary_validation",
      pass: true,
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
    expect(DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY).toMatchObject({
      redaction_required: true,
      redaction_supported: false,
      redaction_attempted: false,
      raw_payload_allowed: false,
      pii_allowed: false,
      secrets_allowed: false,
      project_body_allowed: false,
      tool_output_allowed: false,
      voice_transcript_allowed: false,
      ocr_text_allowed: false,
      frame_data_allowed: false,
      prompt_allowed: false,
      model_output_allowed: false,
    });
  });

  it("rejects unsafe redaction boundary payloads", () => {
    const unsafe = {
      ...DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
      redaction_supported: true,
      redaction_attempted: true,
      raw_payload: "raw",
      pii_email: "person@example.test",
      api_key: "secret",
      project_body: "project",
      tool_output: "tool",
      voice_transcript: "voice",
      ocr_text: "ocr",
      raw_frame: "frame",
      prompt: "prompt",
      model_output: "model",
    };

    expect(validateSelfAuditRedactionBoundary(unsafe)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "pii_forbidden",
        "secret_forbidden",
        "project_body_forbidden",
        "tool_output_forbidden",
        "voice_transcript_forbidden",
        "ocr_text_forbidden",
        "frame_payload_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
      ]),
      telemetry_attempted: false,
      event_store_write_performed: false,
      network_called: false,
      cloud_called: false,
    });
  });

  it("validates the disabled telemetry boundary as metadata-only", () => {
    expect(
      validateSelfAuditTelemetryBoundary(
        DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
      ),
    ).toMatchObject({
      kind: "phase17.self_audit_telemetry_boundary_validation",
      pass: true,
      violation_count: 0,
      violations: ["valid_schema"],
      metadata_only: true,
      telemetry_attempted: false,
      persisted: false,
      event_store_write_performed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY).toMatchObject({
      telemetry_supported: false,
      telemetry_attempted: false,
      telemetry_payload_kind: "metadata_only",
      raw_report_allowed: false,
      raw_section_content_allowed: false,
      raw_payload_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
    });
  });

  it("rejects telemetry boundaries with raw report or section content", () => {
    const unsafe = {
      ...DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
      telemetry_supported: true,
      telemetry_attempted: true,
      telemetry_payload_kind: "raw_report",
      raw_report_allowed: true,
      raw_section_content_allowed: true,
      raw_report: "report",
      raw_section_content: "section",
      event_store_write_attempted: true,
    };

    expect(validateSelfAuditTelemetryBoundary(unsafe)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "raw_report_forbidden",
        "raw_section_content_forbidden",
        "telemetry_forbidden",
        "persistence_forbidden",
      ]),
      telemetry_attempted: false,
      event_store_write_performed: false,
      tool_called: false,
      approval_executed: false,
    });
  });

  it("creates empty metadata-only source snapshots for every required source kind", () => {
    const expectedSectionBySource = {
      approvals: "approvals",
      tool_calls: "tools",
      model_cost: "cost_model_usage",
      vision_replay: "vision",
      room_environment: "environment_room",
      project_ledger: "projects",
      router_decisions: "router",
      safety_classifier: "safety",
      scheduler_routines: "routines_scheduler",
    };

    expect(PHASE_17_SELF_AUDIT_SOURCE_KINDS).toEqual([
      "approvals",
      "tool_calls",
      "model_cost",
      "vision_replay",
      "room_environment",
      "project_ledger",
      "router_decisions",
      "safety_classifier",
      "scheduler_routines",
    ]);

    for (const sourceKind of PHASE_17_SELF_AUDIT_SOURCE_KINDS) {
      const snapshot = createEmptySelfAuditSourceSnapshot({
        snapshot_id: `snapshot:${sourceKind}`,
        source_kind: sourceKind,
      });

      expect(snapshot).toMatchObject({
        snapshot_id: `snapshot:${sourceKind}`,
        source_kind: sourceKind,
        section_kind: expectedSectionBySource[sourceKind],
        metadata_only: true,
        source_read_supported: false,
        source_read_attempted: false,
        collector_supported: false,
        collector_attempted: false,
        row_count: 0,
        row_cap: 250,
        truncated: false,
        raw_payload_allowed: false,
        redaction_required: true,
        persistence_supported: false,
        persistence_attempted: false,
        report_generated: false,
        suggestion_generated: false,
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

  it("validates source snapshots without reading sources or running collectors", () => {
    const snapshot = createEmptySelfAuditSourceSnapshot({
      snapshot_id: "snapshot:vision_replay",
      source_kind: "vision_replay",
      row_cap: 100,
    });

    expect(validateSelfAuditSourceSnapshot(snapshot)).toEqual({
      kind: "phase17.self_audit_source_snapshot_validation",
      pass: true,
      snapshot_id: "snapshot:vision_replay",
      source_kind: "vision_replay",
      section_kind: "vision",
      violation_count: 0,
      violations: ["valid_schema"],
      metadata_only: true,
      source_read_attempted: false,
      collector_attempted: false,
      row_count: 0,
      truncated: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
      db_read_performed: false,
      db_write_performed: false,
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
    expect(snapshot).toMatchObject({
      row_cap: 100,
      row_count: 0,
      truncated: false,
    });
  });

  it("rejects unsafe source snapshot payloads and mismatched source sections", () => {
    const unsafe = {
      ...createEmptySelfAuditSourceSnapshot({
        snapshot_id: "snapshot:project_ledger",
        source_kind: "project_ledger",
      }),
      section_kind: "vision",
      source_read_attempted: true,
      collector_attempted: true,
      row_count: 1,
      truncated: true,
      raw_payload: "raw",
      user_content: "content",
      api_key: "secret",
      pii_email: "person@example.test",
      report_body_text: "body",
      tool_output: "tool",
      project_body: "project",
      voice_transcript: "voice",
      ocr_text: "ocr",
      raw_frame: "frame",
      prompt: "prompt",
      model_output: "model",
      db_read_performed: true,
      event_store_write_performed: true,
      telemetry_attempted: true,
      network_called: true,
    };

    expect(validateSelfAuditSourceSnapshot(unsafe)).toMatchObject({
      pass: false,
      snapshot_id: null,
      source_kind: null,
      section_kind: null,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
        "report_body_forbidden",
        "tool_output_forbidden",
        "project_body_forbidden",
        "voice_transcript_forbidden",
        "ocr_text_forbidden",
        "frame_payload_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
        "persistence_forbidden",
        "telemetry_forbidden",
      ]),
      source_read_attempted: false,
      collector_attempted: false,
      db_read_performed: false,
      event_store_write_performed: false,
      telemetry_attempted: false,
      network_called: false,
      cloud_called: false,
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
