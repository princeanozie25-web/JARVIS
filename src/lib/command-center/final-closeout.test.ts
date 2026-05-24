import { describe, expect, it } from "vitest";

import {
  PHASE_9_SUBSECTION_CLOSEOUT_IDS,
  Phase9FinalCloseoutReportSchema,
  Phase9FinalCloseoutValidationSchema,
  createPhase9FinalCloseoutReport,
  validatePhase9FinalCloseoutReport,
} from "./index";

describe("Phase 9L1 final closeout aggregator", () => {
  it("passes the default final closeout report", () => {
    const report = createPhase9FinalCloseoutReport();

    expect(report).toMatchObject({
      kind: "command_center.phase_9_final_closeout_report",
      verdict: "pass",
      failed_subsections: [],
      generated_from: "phase_9_observability_command_center_scaffold",
      metadata_only: true,
      render_safe: true,
      non_executable: true,
      side_effect_free: true,
    });
    expect(validatePhase9FinalCloseoutReport(report)).toMatchObject({
      passed: true,
      reasons: ["phase_9_final_closeout_valid"],
      missing_subsections: [],
      duplicate_subsections: [],
      unknown_subsection_count: 0,
      mutated_input: false,
    });
  });

  it("includes exactly one subsection report for every 9A through 9K section", () => {
    const report = createPhase9FinalCloseoutReport();

    expect(report.subsection_reports.map((item) => item.subsection_id)).toEqual(
      [...PHASE_9_SUBSECTION_CLOSEOUT_IDS],
    );
    expect(report.checked_subsections).toEqual([
      ...PHASE_9_SUBSECTION_CLOSEOUT_IDS,
    ]);
    expect(
      new Set(report.subsection_reports.map((item) => item.subsection_id)).size,
    ).toBe(PHASE_9_SUBSECTION_CLOSEOUT_IDS.length);
  });

  it("computes deterministic aggregate guard counts", () => {
    const first = createPhase9FinalCloseoutReport();
    const second = createPhase9FinalCloseoutReport();
    const expectedGuardCount = first.subsection_reports.reduce(
      (total, report) => total + report.checked_guards.length,
      0,
    );

    expect(first.aggregate_guard_count).toBe(expectedGuardCount);
    expect(first.aggregate_failed_guard_count).toBe(0);
    expect(first.aggregate_guard_count).toBe(second.aggregate_guard_count);
    expect(first.aggregate_failed_guard_count).toBe(
      second.aggregate_failed_guard_count,
    );
  });

  it("fails if any subsection report fails", () => {
    const base = createPhase9FinalCloseoutReport();
    const report = createPhase9FinalCloseoutReport({
      subsectionReports: [
        {
          ...base.subsection_reports[0],
          verdict: "fail",
          failed_guards: ["forced_failure"],
        },
        ...base.subsection_reports.slice(1),
      ],
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_subsections: ["phase_9a_command_center_scaffold"],
      aggregate_failed_guard_count: 1,
      render_safe: false,
    });
  });

  it("validation fails for missing subsection reports", () => {
    const report = createPhase9FinalCloseoutReport();
    const validation = validatePhase9FinalCloseoutReport({
      ...report,
      subsection_reports: report.subsection_reports.slice(1),
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_subsection"]),
      missing_subsections: ["phase_9a_command_center_scaffold"],
    });
  });

  it("validation fails for duplicate subsection reports", () => {
    const report = createPhase9FinalCloseoutReport();
    const validation = validatePhase9FinalCloseoutReport({
      ...report,
      subsection_reports: [
        report.subsection_reports[0],
        ...report.subsection_reports,
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["duplicate_subsection"]),
      duplicate_subsections: ["phase_9a_command_center_scaffold"],
    });
  });

  it("validation fails for unknown subsection reports", () => {
    const report = createPhase9FinalCloseoutReport();
    const validation = validatePhase9FinalCloseoutReport({
      ...report,
      subsection_reports: [
        ...report.subsection_reports,
        {
          ...report.subsection_reports[0],
          subsection_id: "phase_9z_unknown",
          generated_from: "phase_9z_unknown",
        },
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_subsection",
      ]),
      unknown_subsection_count: 1,
    });
  });

  it("validation fails if verdict says pass while a subsection failed", () => {
    const report = createPhase9FinalCloseoutReport();
    const validation = validatePhase9FinalCloseoutReport({
      ...report,
      verdict: "pass",
      subsection_reports: [
        {
          ...report.subsection_reports[0],
          verdict: "fail",
          failed_guards: ["forced_failure"],
          failed_guard_count: 1,
        },
        ...report.subsection_reports.slice(1),
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["verdict_mismatch"]),
      failed_subsections: ["phase_9a_command_center_scaffold"],
    });
  });

  it("returns deterministic and serializable report output", () => {
    const first = createPhase9FinalCloseoutReport();
    const second = createPhase9FinalCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9FinalCloseoutReportSchema.parse(first)).toEqual(first);
  });

  it("exports final closeout helpers from command-center index", () => {
    expect(typeof createPhase9FinalCloseoutReport).toBe("function");
    expect(typeof validatePhase9FinalCloseoutReport).toBe("function");
    expect(
      Phase9FinalCloseoutValidationSchema.parse(
        validatePhase9FinalCloseoutReport(createPhase9FinalCloseoutReport()),
      ),
    ).toEqual(
      validatePhase9FinalCloseoutReport(createPhase9FinalCloseoutReport()),
    );
  });
});
