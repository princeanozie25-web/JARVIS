import { describe, expect, it } from "vitest";

import {
  PHASE_9E_AUDIT_SCREEN_CLOSEOUT_GUARDS,
  Phase9EAuditScreenCloseoutReportSchema,
  createDefaultAuditReplayViewerViewModel,
  createDefaultAuditTraceTimelineViewModel,
  createDefaultGovernanceBoundaryViewerViewModel,
  createDefaultRuntimeDependencyViewerViewModel,
  createPhase9EAuditScreenCloseoutReport,
} from "./index";

describe("Phase 9E Audit screen closeout guards", () => {
  it("passes the default Audit closeout report", () => {
    const report = createPhase9EAuditScreenCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      checked_guards: [...PHASE_9E_AUDIT_SCREEN_CLOSEOUT_GUARDS],
      failed_guards: [],
      generated_from: "phase_9e_audit_screen_scaffold",
      render_only: true,
      metadata_only: true,
      redaction_required: true,
      read_only: true,
      non_executable: true,
      source_code_rendering_allowed: false,
      raw_payload_rendering_allowed: false,
      graph_execution_allowed: false,
      remote_dashboard_allowed: false,
      export_unredacted_allowed: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      routine_scheduled: false,
      db_write_performed: false,
      network_called: false,
    });
  });

  it("fails if replay viewer is executable", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      replayViewer: {
        ...createDefaultAuditReplayViewerViewModel(),
        non_executable: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining(["no_graph_execution_affordance"]),
      render_safe: false,
    });
  });

  it("fails if trace timeline supports run or retry", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      traceTimeline: {
        ...createDefaultAuditTraceTimelineViewModel(),
        run_affordance_allowed: true,
        retry_affordance_allowed: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_run_trace_affordance",
        "no_retry_tool_affordance",
      ]),
    });
  });

  it("fails if governance boundary graph supports execution", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      governanceBoundaryViewer: {
        ...createDefaultGovernanceBoundaryViewerViewModel(),
        graph_execution_allowed: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining(["no_graph_execution_affordance"]),
    });
  });

  it("fails if runtime dependency viewer supports source-code rendering", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      runtimeDependencyViewer: {
        ...createDefaultRuntimeDependencyViewerViewModel(),
        implementation_body_included: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining(["no_source_code_rendering"]),
    });
  });

  it("fails if raw payload rendering is enabled", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      guardState: {
        run_trace_affordance_enabled: false,
        retry_tool_affordance_enabled: false,
        rerun_routine_affordance_enabled: false,
        approve_or_deny_affordance_enabled: false,
        tool_execution_affordance_enabled: false,
        graph_execution_affordance_enabled: false,
        source_code_rendering_enabled: false,
        raw_payload_rendering_enabled: true,
        live_code_introspection_enabled: false,
        db_write_access_enabled: false,
        telemetry_write_access_enabled: false,
        remote_dashboard_access_enabled: false,
        export_unredacted_affordance_enabled: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_raw_payload_rendering"],
      notes: [
        "forbidden_audit_affordance_enabled:raw_payload_rendering_enabled",
      ],
    });
  });

  it("fails if approval, tool, or routine affordances are enabled", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      guardState: {
        run_trace_affordance_enabled: false,
        retry_tool_affordance_enabled: false,
        rerun_routine_affordance_enabled: true,
        approve_or_deny_affordance_enabled: true,
        tool_execution_affordance_enabled: true,
        graph_execution_affordance_enabled: false,
        source_code_rendering_enabled: false,
        raw_payload_rendering_enabled: false,
        live_code_introspection_enabled: false,
        db_write_access_enabled: false,
        telemetry_write_access_enabled: false,
        remote_dashboard_access_enabled: false,
        export_unredacted_affordance_enabled: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_rerun_routine_affordance",
        "no_approve_or_deny_affordance",
        "no_tool_execution_affordance",
      ]),
    });
  });

  it("fails if remote dashboard or unredacted export is enabled", () => {
    const report = createPhase9EAuditScreenCloseoutReport({
      guardState: {
        run_trace_affordance_enabled: false,
        retry_tool_affordance_enabled: false,
        rerun_routine_affordance_enabled: false,
        approve_or_deny_affordance_enabled: false,
        tool_execution_affordance_enabled: false,
        graph_execution_affordance_enabled: false,
        source_code_rendering_enabled: false,
        raw_payload_rendering_enabled: false,
        live_code_introspection_enabled: false,
        db_write_access_enabled: false,
        telemetry_write_access_enabled: false,
        remote_dashboard_access_enabled: true,
        export_unredacted_affordance_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_remote_dashboard_access",
        "no_export_unredacted_affordance",
      ]),
    });
  });

  it("is deterministic and serializable", () => {
    const first = createPhase9EAuditScreenCloseoutReport();
    const second = createPhase9EAuditScreenCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9EAuditScreenCloseoutReportSchema.parse(first)).toEqual(first);
  });

  it("exports Audit closeout helpers from command-center index", () => {
    expect(typeof createPhase9EAuditScreenCloseoutReport).toBe("function");
    expect(
      Phase9EAuditScreenCloseoutReportSchema.parse(
        createPhase9EAuditScreenCloseoutReport(),
      ),
    ).toEqual(createPhase9EAuditScreenCloseoutReport());
  });
});
