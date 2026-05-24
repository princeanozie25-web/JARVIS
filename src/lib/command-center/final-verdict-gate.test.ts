import { describe, expect, it } from "vitest";

import {
  Phase9FinalVerdictGateSchema,
  Phase9FinalVerdictGateValidationSchema,
  createDefaultPhase9DisabledFeatureMatrix,
  createPhase9FinalCloseoutReport,
  createPhase9FinalVerdictGate,
  summarizePhase9DisabledFeatureMatrix,
  validatePhase9FinalVerdictGate,
} from "./index";

describe("Phase 9L3 final verdict gate", () => {
  it("returns pass_with_notes by default", () => {
    const gate = createPhase9FinalVerdictGate();

    expect(gate).toMatchObject({
      kind: "command_center.phase_9_final_verdict_gate",
      verdict: "pass_with_notes",
      phase: "phase_9_observability_command_center_ui",
      authority_surface_verdict: "pass",
      privacy_verdict: "pass",
      replay_non_executability_verdict: "pass",
      demo_isolation_verdict: "pass",
      generated_from: "phase_9_final_verdict_gate",
      metadata_only: true,
      render_safe: true,
      non_executable: true,
      side_effect_free: true,
    });
  });

  it("includes final closeout report and disabled-feature summary", () => {
    const gate = createPhase9FinalVerdictGate();

    expect(gate.closeout_report.generated_from).toBe(
      "phase_9_observability_command_center_scaffold",
    );
    expect(gate.disabled_feature_summary).toMatchObject({
      verdict: "pass",
      enabled_forbidden_features: [],
    });
    expect(gate.test_bar).toMatchObject({
      targeted_command_center_tests: "required_pass",
      typecheck: "required_pass",
      lint: "required_pass",
      full_test_suite: "required_pass",
      runtime_hooks_exercised: false,
      live_data_inspected: false,
    });
  });

  it("fails if final closeout has a failed subsection", () => {
    const closeout = failedSubsectionCloseout(
      "phase_9a_command_center_scaffold",
    );
    const gate = createPhase9FinalVerdictGate({ closeoutReport: closeout });

    expect(gate).toMatchObject({
      verdict: "fail",
      authority_surface_verdict: "fail",
      render_safe: false,
      notes: expect.arrayContaining(["dependency_failed:final_closeout"]),
    });
  });

  it("fails if disabled-feature matrix has an enabled forbidden feature", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();
    const summary = summarizePhase9DisabledFeatureMatrix({
      ...matrix,
      guards: [
        { ...matrix.guards[0], disabled: false },
        ...matrix.guards.slice(1),
      ],
    });
    const gate = createPhase9FinalVerdictGate({
      disabledFeatureSummary: summary,
    });

    expect(gate).toMatchObject({
      verdict: "fail",
      authority_surface_verdict: "fail",
      disabled_feature_summary: expect.objectContaining({
        verdict: "fail",
        enabled_forbidden_features: ["remote_networked_dashboard_access"],
      }),
    });
  });

  it("fails if privacy closeout fails", () => {
    const gate = createPhase9FinalVerdictGate({
      closeoutReport: failedSubsectionCloseout(
        "phase_9k_privacy_telemetry_audit_scaffold",
      ),
    });

    expect(gate).toMatchObject({
      verdict: "fail",
      privacy_verdict: "fail",
      notes: expect.arrayContaining(["dependency_failed:privacy_closeout"]),
    });
  });

  it("fails if demo mode closeout fails", () => {
    const gate = createPhase9FinalVerdictGate({
      closeoutReport: failedSubsectionCloseout(
        "phase_9i_demo_portfolio_mode_scaffold",
      ),
    });

    expect(gate).toMatchObject({
      verdict: "fail",
      demo_isolation_verdict: "fail",
      notes: expect.arrayContaining(["dependency_failed:demo_mode_closeout"]),
    });
  });

  it("fails if replay or audit non-executability closeout fails", () => {
    const replayGate = createPhase9FinalVerdictGate({
      closeoutReport: failedSubsectionCloseout(
        "phase_9f_replay_trace_scaffold",
      ),
    });
    const auditGate = createPhase9FinalVerdictGate({
      closeoutReport: failedSubsectionCloseout(
        "phase_9e_audit_screen_scaffold",
      ),
    });

    expect(replayGate).toMatchObject({
      verdict: "fail",
      replay_non_executability_verdict: "fail",
      notes: expect.arrayContaining([
        "dependency_failed:replay_trace_closeout",
      ]),
    });
    expect(auditGate).toMatchObject({
      verdict: "fail",
      replay_non_executability_verdict: "fail",
      notes: expect.arrayContaining([
        "dependency_failed:audit_screen_closeout",
      ]),
    });
  });

  it("validation fails if pass_with_notes is claimed while a dependency failed", () => {
    const failedGate = createPhase9FinalVerdictGate({
      closeoutReport: failedSubsectionCloseout(
        "phase_9k_privacy_telemetry_audit_scaffold",
      ),
    });

    expect(
      validatePhase9FinalVerdictGate({
        ...failedGate,
        verdict: "pass_with_notes",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "dependency_failed",
        "verdict_mismatch",
      ]),
      failed_dependencies: expect.arrayContaining(["privacy_closeout"]),
    });
  });

  it("fails validation for raw, executable, and callback fields", () => {
    expect(
      validatePhase9FinalVerdictGate({
        ...createPhase9FinalVerdictGate(),
        raw_prompts: "withheld",
        run_button: true,
        onClick: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
        "executable_affordance_present",
        "non_serializable_value",
      ]),
      withheld_fields: expect.arrayContaining(["raw_prompts", "run_button"]),
      notes: expect.arrayContaining(["non_serializable:onClick"]),
    });
  });

  it("returns deterministic and serializable gate output", () => {
    const first = createPhase9FinalVerdictGate();
    const second = createPhase9FinalVerdictGate();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9FinalVerdictGateSchema.parse(first)).toEqual(first);
  });

  it("exports final verdict gate helpers from command-center index", () => {
    expect(typeof createPhase9FinalVerdictGate).toBe("function");
    expect(typeof validatePhase9FinalVerdictGate).toBe("function");
    expect(
      Phase9FinalVerdictGateValidationSchema.parse(
        validatePhase9FinalVerdictGate(createPhase9FinalVerdictGate()),
      ),
    ).toEqual(validatePhase9FinalVerdictGate(createPhase9FinalVerdictGate()));
  });
});

function failedSubsectionCloseout(subsectionId: string) {
  const base = createPhase9FinalCloseoutReport();
  return createPhase9FinalCloseoutReport({
    subsectionReports: base.subsection_reports.map((report) =>
      report.subsection_id === subsectionId
        ? {
            ...report,
            verdict: "fail",
            failed_guards: ["forced_failure"],
            failed_guard_count: 1,
          }
        : report,
    ),
  });
}
