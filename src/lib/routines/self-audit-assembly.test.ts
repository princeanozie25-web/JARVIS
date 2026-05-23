import { describe, expect, it } from "vitest";

import {
  SELF_AUDIT_COLLECTOR_SURFACES,
  SelfAuditReportAssemblyTelemetryEventSchema,
  assembleSelfAuditReport,
  createSelfAuditReportAssemblyTelemetryEvent,
  type SelfAuditCollectorResult,
  type SelfAuditCollectorSurface,
} from "./index";

const SURFACE_TO_SECTION = {
  approvals_ledger: "approvals",
  tool_call_audit: "tools",
  failures: "failures",
  cost_telemetry: "cost",
  vision_replay: "vision",
  environment_events: "environment",
  project_ledger: "projects",
  router_decisions: "router",
  safety_classifier: "safety",
} as const satisfies Record<SelfAuditCollectorSurface, string>;

function collectorResult(
  surface: SelfAuditCollectorSurface,
  overrides: Partial<SelfAuditCollectorResult> = {},
): SelfAuditCollectorResult {
  return {
    surface,
    counts: [{ class: `${surface}:ok`, count: 1 }],
    bins: [{ bin: "daily", count: 1 }],
    classes: [`${surface}:class`],
    duration_ms: 5,
    rows_read_bin: "1_10",
    truncated: false,
    error_class: "none",
    redaction_status: "metadata_only",
    read_only: true,
    metadata_only: true,
    raw_content_included: false,
    writes_performed: false,
    tools_called: false,
    network_called: false,
    actions_executed: false,
    approvals_triggered: false,
    mutations_performed: false,
    ...overrides,
  };
}

function input(
  results = SELF_AUDIT_COLLECTOR_SURFACES.map((surface) =>
    collectorResult(surface),
  ),
) {
  return {
    report_window: {
      start_ms: 1000,
      end_ms: 2000,
      metadata_only: true as const,
    },
    generated_by_routine_id: "routine:self_audit",
    collector_results: results,
    metadata_only: true as const,
  };
}

describe("Phase 8C.3 self-audit report assembly scaffold", () => {
  it("assembles valid collector result metadata into a valid report", () => {
    const assembly = assembleSelfAuditReport(input());

    expect(assembly.validation).toMatchObject({
      pass: true,
      section_count: SELF_AUDIT_COLLECTOR_SURFACES.length,
      violation_count: 0,
      db_read_performed: false,
      llm_called: false,
    });
    expect(assembly.report).toMatchObject({
      generated_by_routine_id: "routine:self_audit",
      metadata_only: true,
      counts_bins_classes_only: true,
      db_read_performed: false,
      db_write_performed: false,
      tool_called: false,
      action_executed: false,
    });
    expect(assembly.report.sections.map((section) => section.section)).toEqual(
      Object.values(SURFACE_TO_SECTION),
    );
  });

  it("represents missing surfaces as counts and flags only", () => {
    const assembly = assembleSelfAuditReport(
      input([collectorResult("approvals_ledger")]),
    );

    expect(assembly.metadata).toMatchObject({
      collector_result_count: 1,
      missing_surface_count: SELF_AUDIT_COLLECTOR_SURFACES.length - 1,
      metadata_only: true,
      counts_and_flags_only: true,
    });
    expect(
      assembly.report.sections.filter((section) =>
        section.classes.includes("missing_surface"),
      ),
    ).toHaveLength(SELF_AUDIT_COLLECTOR_SURFACES.length - 1);
  });

  it("represents failed collectors by error_class only", () => {
    const assembly = assembleSelfAuditReport(
      input([
        collectorResult("failures", {
          counts: [{ class: "ignored_input_count", count: 99 }],
          bins: [{ bin: "ignored_input_bin", count: 99 }],
          classes: ["ignored_input_class"],
          error_class: "timeout",
        }),
      ]),
    );
    const failureSection = assembly.report.sections.find(
      (section) => section.section === "failures",
    );

    expect(assembly.metadata.failed_collector_count).toBe(1);
    expect(failureSection).toMatchObject({
      counts: [{ class: "error:timeout", count: 1 }],
      bins: [],
      classes: ["timeout"],
    });
  });

  it("propagates truncated collector flags to sections and report metadata", () => {
    const assembly = assembleSelfAuditReport(
      input([
        collectorResult("cost_telemetry", {
          truncated: true,
          redaction_status: "redacted",
        }),
      ]),
    );

    expect(assembly.report.truncated).toBe(true);
    expect(assembly.report.redaction_status).toBe("redacted");
    expect(assembly.metadata.truncated_collector_count).toBe(1);
    expect(
      assembly.report.sections.find((section) => section.section === "cost"),
    ).toMatchObject({
      truncated: true,
      redaction_status: "redacted",
    });
  });

  it("rejects raw payload-like fields before assembly", () => {
    expect(() =>
      assembleSelfAuditReport(
        input([
          {
            ...collectorResult("vision_replay"),
            raw_text: "private payload",
          } as unknown as SelfAuditCollectorResult,
        ]),
      ),
    ).toThrow();
  });

  it("carries report validation failures for raw-looking metadata classes", () => {
    const assembly = assembleSelfAuditReport(
      input([
        collectorResult("vision_replay", {
          classes: ["ocr_payload"],
        }),
      ]),
    );

    expect(assembly.validation).toMatchObject({
      pass: false,
      violations: expect.arrayContaining(["vision_payload_forbidden"]),
    });
    expect(assembly.metadata.validation_pass).toBe(false);
  });

  it("emits metadata-only assembly telemetry with counts and flags only", () => {
    const assembly = assembleSelfAuditReport(
      input([collectorResult("approvals_ledger")]),
    );
    const event = createSelfAuditReportAssemblyTelemetryEvent(assembly);

    expect(event).toEqual({
      event_type: "self_audit_report_assembled",
      pass: true,
      collector_result_count: 1,
      missing_surface_count: SELF_AUDIT_COLLECTOR_SURFACES.length - 1,
      failed_collector_count: 0,
      truncated_collector_count: 0,
      section_count: SELF_AUDIT_COLLECTOR_SURFACES.length,
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
      SelfAuditReportAssemblyTelemetryEventSchema.safeParse({
        ...event,
        db_read_performed: true,
        llm_called: true,
        tool_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB reads, writes, LLM calls, tools, actions, approvals, network, or execution", () => {
    const assembly = assembleSelfAuditReport(input());

    expect({
      dbRead: assembly.metadata.db_read_performed,
      dbWrite: assembly.metadata.db_write_performed,
      llmCalled: assembly.metadata.llm_called,
      toolCalled: assembly.metadata.tool_called,
      actionExecuted: assembly.metadata.action_executed,
      approvalTriggered: assembly.metadata.approval_triggered,
      memoryWritten: assembly.metadata.memory_written,
      networkCalled: assembly.metadata.network_called,
      cloudCalled: assembly.metadata.cloud_called,
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
