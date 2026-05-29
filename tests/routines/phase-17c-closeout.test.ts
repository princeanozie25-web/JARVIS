import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  evaluatePhase17DisabledGuard,
} from "../../src/lib/routines/phase-17-disabled-guards";
import {
  DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
  DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
  PHASE_17_SELF_AUDIT_REPORT_SECTIONS,
  PHASE_17_SELF_AUDIT_SOURCE_KINDS,
  createEmptyPhase17SelfAuditReport,
  createEmptySelfAuditAggregationEnvelope,
  createEmptySelfAuditSourceSnapshot,
  validateSelfAuditAggregationEnvelope,
  validateSelfAuditRedactionBoundary,
  validateSelfAuditReportSchema,
  validateSelfAuditSectionMetadata,
  validateSelfAuditSourceSnapshot,
  validateSelfAuditTelemetryBoundary,
} from "../../src/lib/routines/self-audit-report";

const repoRoot = process.cwd();

describe("Phase 17C.6 self-audit report closeout guard", () => {
  it("proves the self-audit report schema exists and remains metadata-only", () => {
    const report = validReport();

    expect(validateSelfAuditReportSchema(report)).toMatchObject({
      kind: "phase17.self_audit_report_schema_validation",
      pass: true,
      report_id: report.report_id,
      section_count: PHASE_17_SELF_AUDIT_REPORT_SECTIONS.length,
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
    expect(report.sections.map((section) => section.section_kind)).toEqual([
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

  it("proves section metadata contracts exist and remain non-collecting", () => {
    for (const section of validReport().sections) {
      expect(validateSelfAuditSectionMetadata(section)).toMatchObject({
        kind: "phase17.self_audit_section_metadata_validation",
        pass: true,
        section_id: section.section_id,
        section_kind: section.section_kind,
        metadata_only: true,
        summary_generated: false,
        collector_attempted: false,
        source_read_attempted: false,
        db_read_performed: false,
        event_store_read_performed: false,
        event_store_write_performed: false,
        persisted: false,
        telemetry_attempted: false,
      });
      expect(section).toMatchObject({
        collector_supported: false,
        collector_attempted: false,
        source_read_supported: false,
        source_read_attempted: false,
        summary_generated: false,
        raw_payload_allowed: false,
        redaction_required: true,
      });
    }
  });

  it("proves redaction and telemetry boundaries exist and reject unsafe fields", () => {
    expect(
      validateSelfAuditRedactionBoundary(
        DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
      ),
    ).toMatchObject({
      pass: true,
      metadata_only: true,
      telemetry_attempted: false,
      event_store_write_performed: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      validateSelfAuditTelemetryBoundary(
        DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
      ),
    ).toMatchObject({
      pass: true,
      metadata_only: true,
      telemetry_attempted: false,
      persisted: false,
      event_store_write_performed: false,
    });

    expect(
      validateSelfAuditRedactionBoundary({
        ...DEFAULT_PHASE_17_SELF_AUDIT_REDACTION_BOUNDARY,
        raw_payload: "raw",
        api_key: "secret",
        pii_email: "person@example.test",
        tool_output: "tool",
        project_body: "project",
        voice_transcript: "voice",
        ocr_text: "ocr",
        raw_frame: "frame",
        prompt: "prompt",
        model_output: "model",
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
        "tool_output_forbidden",
        "project_body_forbidden",
        "voice_transcript_forbidden",
        "ocr_text_forbidden",
        "frame_payload_forbidden",
        "prompt_forbidden",
        "model_output_forbidden",
      ]),
      telemetry_attempted: false,
    });

    expect(
      validateSelfAuditTelemetryBoundary({
        ...DEFAULT_PHASE_17_SELF_AUDIT_TELEMETRY_BOUNDARY,
        telemetry_attempted: true,
        raw_report: "report",
        raw_section_content: "section",
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "raw_report_forbidden",
        "raw_section_content_forbidden",
        "telemetry_forbidden",
      ]),
      event_store_write_performed: false,
    });
  });

  it("proves source snapshot contracts exist for every required source kind", () => {
    expect(PHASE_17_SELF_AUDIT_SOURCE_KINDS).toHaveLength(9);

    for (const sourceKind of PHASE_17_SELF_AUDIT_SOURCE_KINDS) {
      const snapshot = createEmptySelfAuditSourceSnapshot({
        snapshot_id: `snapshot:${sourceKind}`,
        source_kind: sourceKind,
      });

      expect(validateSelfAuditSourceSnapshot(snapshot)).toMatchObject({
        kind: "phase17.self_audit_source_snapshot_validation",
        pass: true,
        snapshot_id: `snapshot:${sourceKind}`,
        source_kind: sourceKind,
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
        network_called: false,
        cloud_called: false,
      });
    }
  });

  it("proves the aggregation envelope exists and remains non-generating", () => {
    const envelope = validAggregationEnvelope();

    expect(validateSelfAuditAggregationEnvelope(envelope)).toMatchObject({
      kind: "phase17.self_audit_aggregation_envelope_validation",
      pass: true,
      aggregation_id: envelope.aggregation_id,
      report_id: envelope.report_id,
      source_snapshot_count: PHASE_17_SELF_AUDIT_SOURCE_KINDS.length,
      section_count: PHASE_17_SELF_AUDIT_REPORT_SECTIONS.length,
      metadata_only: true,
      aggregation_attempted: false,
      source_reads_attempted: false,
      collector_execution_attempted: false,
      report_body_generated: false,
      summary_generated: false,
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
  });

  it("keeps unsafe report, snapshot, and aggregation payloads rejected", () => {
    expect(
      validateSelfAuditReportSchema({
        ...validReport(),
        raw_payload: "raw",
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
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
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
      report_generated: false,
    });

    expect(
      validateSelfAuditSourceSnapshot({
        ...createEmptySelfAuditSourceSnapshot({
          snapshot_id: "snapshot:approvals",
          source_kind: "approvals",
        }),
        source_read_attempted: true,
        collector_attempted: true,
        raw_payload: "raw",
        user_content: "content",
        api_key: "secret",
        pii_email: "person@example.test",
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "secret_forbidden",
        "pii_forbidden",
      ]),
      source_read_attempted: false,
      collector_attempted: false,
    });

    expect(
      validateSelfAuditAggregationEnvelope({
        ...validAggregationEnvelope(),
        aggregation_attempted: true,
        report_body_generated: true,
        summary_generated: true,
        raw_payload: "raw",
        user_content: "content",
        telemetry_attempted: true,
        event_store_write_performed: true,
      }),
    ).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "invalid_schema",
        "raw_payload_forbidden",
        "persistence_forbidden",
        "telemetry_forbidden",
      ]),
      aggregation_attempted: false,
      report_body_generated: false,
      summary_generated: false,
      event_store_write_performed: false,
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
    for (const feature of [
      "scheduler_execution",
      "tool_calls",
      "device_actions",
      "project_mutations",
      "memory_writes",
      "approval_execution",
      "cloud_network_calls",
      "raw_report_telemetry",
    ] as const) {
      expect(evaluatePhase17DisabledGuard(feature)).toMatchObject({
        allowed: false,
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

  it("keeps Phase 17C source files free of runtime side-effect markers", () => {
    const source = read("src/lib/routines/self-audit-report.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion|generateBaseline/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });

  it("documents Phase 17C closeout and Phase 17D prerequisite", () => {
    const closeout = read("docs/phase-17/phase-17c-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 17C Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "What 17C Achieved",
      "What Remains Intentionally Unimplemented",
      "Phase 17D.1 - Suggestion Output Contract Scaffold",
    ]) {
      expect(closeout).toContain(required);
    }
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

function validAggregationEnvelope() {
  const report = validReport();
  return createEmptySelfAuditAggregationEnvelope({
    aggregation_id: "aggregation:daily_self_audit:0:100",
    report_id: report.report_id,
    source_snapshot_ids: PHASE_17_SELF_AUDIT_SOURCE_KINDS.map(
      (sourceKind) => `snapshot:${sourceKind}`,
    ),
    section_ids: report.sections.map((section) => section.section_id),
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
