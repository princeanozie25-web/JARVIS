import { describe, expect, it } from "vitest";

import {
  SELF_AUDIT_REPORT_SECTIONS,
  SelfAuditReportTelemetryEventSchema,
  createSelfAuditReportTelemetryEvent,
  validateSelfAuditReport,
  type SelfAuditReport,
  type SelfAuditReportSectionName,
} from "./index";

function section(name: SelfAuditReportSectionName) {
  return {
    section: name,
    counts: [{ class: `${name}:ok`, count: 1 }],
    bins: [{ bin: "daily", count: 1 }],
    classes: [`${name}:class`],
    truncated: false,
    redaction_status: "metadata_only" as const,
    metadata_only: true as const,
    raw_content_included: false as const,
  };
}

function validReport(): SelfAuditReport {
  return {
    report_id: "self_audit_report:daily:1000",
    report_window: {
      start_ms: 1000,
      end_ms: 2000,
      metadata_only: true,
    },
    generated_by_routine_id: "routine:self_audit",
    sections: SELF_AUDIT_REPORT_SECTIONS.map(section),
    redaction_status: "metadata_only",
    truncated: false,
    metadata_only: true,
    counts_bins_classes_only: true,
    raw_body_included: false,
    raw_text_included: false,
    raw_content_included: false,
    ocr_payload_included: false,
    screen_payload_included: false,
    frame_payload_included: false,
    voice_transcript_included: false,
    environment_raw_values_included: false,
    secrets_or_pii_included: false,
    db_read_performed: false,
    db_write_performed: false,
    llm_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    network_called: false,
    cloud_called: false,
  };
}

describe("Phase 8C.2 self-audit report schema and redaction scaffold", () => {
  it("accepts a valid report with counts, bins, and classes only", () => {
    const report = validReport();

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: true,
      report_id: report.report_id,
      section_count: SELF_AUDIT_REPORT_SECTIONS.length,
      violation_count: 0,
      db_read_performed: false,
      llm_called: false,
    });
  });

  it("rejects raw text, body, and content fields by strict shape", () => {
    for (const field of ["raw_text", "body", "content"]) {
      expect(
        validateSelfAuditReport({
          ...validReport(),
          [field]: "private payload",
        }),
      ).toMatchObject({
        pass: false,
        violations: ["invalid_report_shape"],
      });
    }
  });

  it("rejects project names, file paths, and task titles in metadata classes", () => {
    const report = validReport();
    report.sections[6] = {
      ...report.sections[6],
      classes: ["project_name", "file_path", "task_title"],
    };

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: false,
      violations: ["project_identifier_forbidden"],
    });
  });

  it("rejects vision OCR, screen, and frame payload markers", () => {
    const report = validReport();
    report.sections[4] = {
      ...report.sections[4],
      classes: ["ocr_payload", "screen_text", "frame_payload"],
    };

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "raw_content_forbidden",
        "vision_payload_forbidden",
      ]),
    });
  });

  it("rejects voice transcripts and environment raw values", () => {
    const report = validReport();
    report.sections[5] = {
      ...report.sections[5],
      classes: ["voice_transcript", "raw_sensor_value"],
    };

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "voice_transcript_forbidden",
        "environment_raw_value_forbidden",
      ]),
    });
  });

  it("rejects secrets and PII markers", () => {
    const report = validReport();
    report.sections[8] = {
      ...report.sections[8],
      classes: ["secret", "api_key", "pii"],
    };

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: false,
      violations: ["secret_or_pii_forbidden"],
    });
  });

  it("keeps report bounded, truncated, and metadata only", () => {
    const report = {
      ...validReport(),
      truncated: true,
      sections: validReport().sections.map((item) => ({
        ...item,
        truncated: true,
        counts: item.counts.slice(0, 1),
        bins: item.bins.slice(0, 1),
        classes: item.classes.slice(0, 1),
      })),
    };

    expect(validateSelfAuditReport(report)).toMatchObject({
      pass: true,
      section_count: SELF_AUDIT_REPORT_SECTIONS.length,
    });
    expect(report).toMatchObject({
      truncated: true,
      metadata_only: true,
      counts_bins_classes_only: true,
      raw_content_included: false,
      db_read_performed: false,
      network_called: false,
    });
  });

  it("emits metadata-only report telemetry with counts and flags only", () => {
    const report = validReport();
    const validation = validateSelfAuditReport(report);
    const event = createSelfAuditReportTelemetryEvent(report, validation);

    expect(event).toEqual({
      event_type: "self_audit_report_validated",
      pass: true,
      section_count: SELF_AUDIT_REPORT_SECTIONS.length,
      violation_count: 0,
      truncated: false,
      metadata_only: true,
      counts_and_flags_only: true,
      db_read_performed: false,
      db_write_performed: false,
      llm_called: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      SelfAuditReportTelemetryEventSchema.safeParse({
        ...event,
        db_read_performed: true,
        llm_called: true,
        tool_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, tool, network, write, or execution paths", () => {
    const validation = validateSelfAuditReport(validReport());

    expect({
      dbRead: validation.db_read_performed,
      dbWrite: validation.db_write_performed,
      llmCalled: validation.llm_called,
      toolCalled: validation.tool_called,
      actionExecuted: validation.action_executed,
      approvalTriggered: validation.approval_triggered,
      memoryWritten: validation.memory_written,
      networkCalled: validation.network_called,
      cloudCalled: validation.cloud_called,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      llmCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      memoryWritten: false,
      networkCalled: false,
      cloudCalled: false,
    });
  });
});
