import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
  Phase9KPrivacyTelemetryCloseoutReportSchema,
  createDefaultCommandCenterPrivacyPolicy,
  createDefaultRedactionCoverageMatrix,
  createPhase9KPrivacyTelemetryCloseoutReport,
  validateRedactionCoverageMatrix,
} from "./index";

describe("Phase 9K3 privacy telemetry closeout guards", () => {
  it("passes the default 9K closeout report", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
      generated_from: "phase_9k_privacy_telemetry_audit_scaffold",
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      non_executable: true,
      raw_payloads_forbidden: true,
      source_code_forbidden: true,
      live_user_data_forbidden_in_demo: true,
      remote_dashboard_forbidden: true,
      export_unredacted_forbidden: true,
      authority_surface: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
  });

  it("includes a coverage summary with all surfaces covered", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport();

    expect(report.coverage_summary).toMatchObject({
      total_surfaces: 9,
      covered_surfaces: [
        "rest_orb",
        "working_cockpit",
        "audit_timeline",
        "audit_replay",
        "governance_boundary",
        "runtime_dependency",
        "demo_dataset",
        "recruiter_presentation",
        "developer_console",
      ],
      uncovered_surfaces: [],
      verdict: "pass",
    });
  });

  it("fails if privacy policy enforcement is disabled", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      privacyPolicy: {
        ...createDefaultCommandCenterPrivacyPolicy(),
        raw_payloads_forbidden: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_raw_tool_arguments",
        "no_raw_prompts",
        "no_export_unredacted",
        "no_mutating_or_executable_affordances",
      ]),
    });
  });

  it("fails if redaction matrix coverage is missing or incomplete", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      redactionMatrix: {
        ...matrix,
        entries: matrix.entries.filter((entry) => entry.surface !== "rest_orb"),
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      coverage_summary: expect.objectContaining({
        verdict: "fail",
        uncovered_surfaces: ["rest_orb"],
      }),
      failed_guards: expect.arrayContaining(["no_raw_prompts"]),
    });
  });

  it("fails if any required coverage enforcement boolean is false", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const redactionMatrix = {
      ...matrix,
      entries: [
        { ...matrix.entries[0], raw_payload_guard: false },
        ...matrix.entries.slice(1),
      ],
    };

    expect(validateRedactionCoverageMatrix(redactionMatrix).passed).toBe(false);
    expect(
      createPhase9KPrivacyTelemetryCloseoutReport({ redactionMatrix }),
    ).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining(["no_raw_tool_arguments"]),
    });
  });

  it("confirms forbidden payload classes fail closed", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      unsafePayloadByGuard: {
        no_raw_prompts: {
          metadata_only: true,
          render_safe: true,
          non_executable: true,
        },
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_raw_prompts"],
      notes: expect.arrayContaining([
        "forbidden_payload_rendered:no_raw_prompts",
      ]),
    });
  });

  it("fails if demo live user data is allowed", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
        live_user_data_in_demo_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_live_user_data_in_demo"],
    });
  });

  it("fails if recruiter developer-console or raw-table exposure is allowed", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      unsafePayloadByGuard: {
        no_mutating_or_executable_affordances: {
          metadata_only: true,
          render_safe: true,
          non_executable: true,
        },
      },
      guardState: {
        ...DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
        mutating_or_executable_affordances_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_mutating_or_executable_affordances"],
    });
  });

  it("fails if remote dashboard or unredacted export is enabled", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
        remote_dashboard_enabled: true,
        export_unredacted_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_remote_dashboard",
        "no_export_unredacted",
      ]),
    });
  });

  it("fails if mutating or executable affordances are enabled", () => {
    const report = createPhase9KPrivacyTelemetryCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
        mutating_or_executable_affordances_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_mutating_or_executable_affordances"],
    });
  });

  it("returns deterministic and serializable report output", () => {
    const first = createPhase9KPrivacyTelemetryCloseoutReport();
    const second = createPhase9KPrivacyTelemetryCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9KPrivacyTelemetryCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });

  it("exports privacy closeout helpers from command-center index", () => {
    expect(typeof createPhase9KPrivacyTelemetryCloseoutReport).toBe("function");
    expect(
      Phase9KPrivacyTelemetryCloseoutReportSchema.parse(
        createPhase9KPrivacyTelemetryCloseoutReport(),
      ),
    ).toEqual(createPhase9KPrivacyTelemetryCloseoutReport());
  });
});
