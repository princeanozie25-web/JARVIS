import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  PHASE_20F_CLOSEOUT_CHECK_IDS,
  PHASE_20F_REQUIRED_AUDIT_IDS,
  Phase20FCloseoutReportSchema,
  assertPhase20FCloseoutPasses,
  buildPhase20FCloseoutReport,
  type Phase20FCloseoutReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "approve",
  "dispatch",
  "toolCall",
  "callProvider",
  "createUiRoute",
  "createAuthority",
  "executeDemo",
  "executeHardening",
  "recover",
  "autoFix",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
  "raw_prompt",
  "raw_output",
  "raw_audio",
  "raw_ocr",
  "raw_frame",
  "project_body",
] as const;

let cachedReport: Phase20FCloseoutReport | undefined;

function report(): Phase20FCloseoutReport {
  cachedReport ??= buildPhase20FCloseoutReport();
  return cachedReport;
}

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 20F.10 final hardening closeout", () => {
  it("produces deterministic typed metadata-only closeout output", () => {
    const closeoutReport = report();

    expect(Phase20FCloseoutReportSchema.safeParse(closeoutReport).success).toBe(
      true,
    );
    expect(JSON.stringify(closeoutReport)).toBe(JSON.stringify(report()));
    expect(closeoutReport).toMatchObject({
      report_version: "20F.10",
      report_id: "phase-20f10-final-hardening-closeout",
      phase_id: "20F",
      phase: "20F.10",
      verdict: "pass",
      final_hardening_status: "phase_20f_complete",
    });
  }, 180000);

  it("includes every required Phase 20F audit entry", () => {
    const closeoutReport = report();

    expect(closeoutReport.required_audit_ids).toEqual([
      ...PHASE_20F_REQUIRED_AUDIT_IDS,
    ]);
    expect(closeoutReport.audits.map((audit) => audit.audit_id)).toEqual([
      ...PHASE_20F_REQUIRED_AUDIT_IDS,
    ]);
    expect(closeoutReport.completed_audit_count).toBe(
      closeoutReport.required_audit_count,
    );
    expect(closeoutReport.summary).toMatchObject({
      required_audit_count: 9,
      completed_audit_count: 9,
      closeout_check_count: 15,
      passed_closeout_check_count: 15,
    });
  });

  it("aggregates pass and pass-with-notes audit verdicts", () => {
    const closeoutReport = report();

    expect(
      new Set(closeoutReport.audits.map((audit) => audit.verdict)),
    ).toEqual(new Set(["pass", "pass_with_notes"]));
    expect(closeoutReport.summary).toMatchObject({
      pass_count: 5,
      pass_with_notes_count: 4,
      blocking_issue_count: 0,
      non_blocking_note_count: 3,
    });
    expect(
      closeoutReport.audits.every((audit) =>
        ["pass", "pass_with_notes"].includes(audit.verdict),
      ),
    ).toBe(true);
  });

  it("aligns closeout summary counts with underlying hardening reports", () => {
    const closeoutReport = report();

    expect(closeoutReport.summary).toMatchObject({
      hardening_surface_count: 21,
      failure_mode_count: 24,
      hardening_result_count: 24,
      hardening_evaluation_result_count: 24,
      recovery_finding_count: 24,
      authority_regression_finding_count: 19,
      governance_invariant_count: 24,
      demo_portfolio_readiness_area_count: 13,
      system_area_count: 39,
      expansion_era_count: 7,
      core_jarvis_os_complete: true,
    });
  });

  it("has no blocking issues and preserves disabled capability continuity", () => {
    const closeoutReport = report();

    expect(closeoutReport.blocking_issue_count).toBe(0);
    expect(closeoutReport.summary).toMatchObject({
      disabled_feature_count: 18,
      disabled_capability_blocking_count: 0,
      system_completion_blocking_count: 0,
    });
    expect(closeoutReport.evidence_summary.disabled_capability).toContain(
      "disabled",
    );
    expect(
      closeoutReport.closeout_checks.map((check) => check.check_id),
    ).toContain("phase-20f-closeout:disabled-capability-continuity");
  });

  it("preserves manual-only recovery and bounded authority posture", () => {
    const closeoutReport = report();

    expect(closeoutReport.summary).toMatchObject({
      recovery_failed_finding_count: 0,
      recovery_auto_recovery_count: 0,
      authority_regression_count: 0,
      governance_integrity_pass: true,
      demo_portfolio_blocking_count: 0,
    });
    expect(closeoutReport.evidence_summary.recovery_fallback).toContain(
      "manual-only",
    );
    expect(closeoutReport.evidence_summary.authority_regression).toContain(
      "no approval bypass",
    );
  });

  it("keeps expansion-era work future-only", () => {
    const closeoutReport = report();

    expect(closeoutReport.summary.expansion_era_count).toBe(7);
    expect(closeoutReport.remaining_notes).toEqual(
      expect.arrayContaining([expect.stringContaining("Expansion-era work")]),
    );
    expect(closeoutReport.final_hardening_statement).toContain(
      "expansion-era work remains future-only",
    );
  });

  it("includes every closeout check and all checks pass", () => {
    const closeoutReport = report();

    expect(
      closeoutReport.closeout_checks.map((check) => check.check_id),
    ).toEqual([...PHASE_20F_CLOSEOUT_CHECK_IDS]);
    expect(closeoutReport.closeout_checks.every((check) => check.passed)).toBe(
      true,
    );
    expect(
      closeoutReport.closeout_checks.every((check) => !check.blocking),
    ).toBe(true);
  });

  it("declares no runtime, provider, network, filesystem, process, UI, approval, authority, source-material, or capability affordances", () => {
    const closeoutReport = report();

    for (const posture of [
      closeoutReport.posture,
      closeoutReport.summary.posture,
      ...closeoutReport.audits.map((audit) => audit.posture),
      ...closeoutReport.closeout_checks.map((check) => check.posture),
    ]) {
      expect(posture.hardening_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.shell_process_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(closeoutReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, provider, UI, approval, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "buildPhase20FCloseoutReport",
        "assertPhase20FCloseoutPasses",
      ]),
    );
  });

  it("assertion helper passes for the generated closeout report", () => {
    expect(assertPhase20FCloseoutPasses(report())).toEqual(report());
  });
});
