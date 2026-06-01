import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_DIMENSION_IDS,
  AUDIT_PHASE_IDS,
  PHASE_20E_CLOSEOUT_CHECK_IDS,
  PHASE_20E_MODULE_IDS,
  Phase20ECloseoutReportSchema,
  buildPhase20ECloseoutReport,
  type Phase20ECloseoutReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeAudit",
  "inspectFilesystem",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

let cachedReport: Phase20ECloseoutReport | undefined;

function report(): Phase20ECloseoutReport {
  cachedReport ??= buildPhase20ECloseoutReport();
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

describe("Phase 20E.9 cross-phase audit closeout", () => {
  it("produces deterministic typed metadata-only closeout output", () => {
    const closeoutReport = report();

    expect(Phase20ECloseoutReportSchema.safeParse(closeoutReport).success).toBe(
      true,
    );
    expect(JSON.stringify(closeoutReport)).toBe(
      JSON.stringify(buildPhase20ECloseoutReport()),
    );
    expect(closeoutReport).toMatchObject({
      closeout_version: "20E.9",
      report_id: "phase-20e9-cross-phase-audit-closeout",
      phase: "20E.9",
      verdict: "pass",
      phase20e_complete: true,
      phase20f_ready_for_final_hardening: true,
    });
    expect(closeoutReport.summary).toMatchObject({
      phase20e_closeout_guard_only: true,
      phase20e_capability_neutral: true,
    });
  }, 45000);

  it("includes every Phase 20E module and closeout check", () => {
    const closeoutReport = report();

    expect(closeoutReport.module_ids).toEqual([...PHASE_20E_MODULE_IDS]);
    expect(closeoutReport.checks.map((check) => check.check_id)).toEqual([
      ...PHASE_20E_CLOSEOUT_CHECK_IDS,
    ]);
    expect(closeoutReport.summary.module_count).toBe(8);
    expect(closeoutReport.summary.check_count).toBe(27);
    expect(closeoutReport.summary.failed_check_count).toBe(0);
    expect(closeoutReport.checks.every((check) => check.passed)).toBe(true);
  });

  it("verifies audit surfaces cover Phases 10 through 20D", () => {
    const closeoutReport = report();

    expect(AUDIT_PHASE_IDS).toHaveLength(14);
    expect(closeoutReport.summary.represented_phase_count).toBe(
      AUDIT_PHASE_IDS.length,
    );
    expect(closeoutReport.summary.audit_surface_count).toBe(14);
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:surface-phase-coverage",
      ),
    ).toMatchObject({ passed: true });
  });

  it("verifies required dimensions and evidence coverage", () => {
    const closeoutReport = report();

    expect(AUDIT_DIMENSION_IDS).toHaveLength(12);
    expect(closeoutReport.summary.audit_dimension_count).toBe(
      AUDIT_DIMENSION_IDS.length,
    );
    expect(closeoutReport.summary.evidence_count).toBe(23);
    expect(closeoutReport.summary.evaluator_result_count).toBe(168);
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:dimension-coverage",
      ),
    ).toMatchObject({ passed: true });
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:evidence-coverage",
      ),
    ).toMatchObject({ passed: true });
  });

  it("represents governance, disabled-feature, authority, and report readiness coverage", () => {
    const closeoutReport = report();
    const passedCheckIds = closeoutReport.checks
      .filter((check) => check.passed)
      .map((check) => check.check_id);

    expect(passedCheckIds).toEqual(
      expect.arrayContaining([
        "phase-20e:governance-audit-coverage",
        "phase-20e:disabled-feature-audit-coverage",
        "phase-20e:authority-surface-audit-coverage",
        "phase-20e:report-closeout-readiness",
      ]),
    );
  });

  it("represents no-blocking and deferred posture", () => {
    const closeoutReport = report();

    expect(closeoutReport.summary.blocking_finding_count).toBe(0);
    expect(closeoutReport.summary.deferred_item_count).toBeGreaterThan(0);
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:no-blocking-findings",
      ),
    ).toMatchObject({ passed: true });
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:deferred-posture-represented",
      ),
    ).toMatchObject({ passed: true });
  });

  it("declares no runtime, filesystem, network, provider, UI, authority, source material, or capability affordances", () => {
    const closeoutReport = report();

    for (const posture of [
      closeoutReport.posture,
      closeoutReport.summary.posture,
      ...closeoutReport.checks.map((check) => check.posture),
    ]) {
      expect(posture.audit_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
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

  it("exports no audit execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(crossPhaseAudit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildPhase20ECloseoutReport"]),
    );
  });

  it("declares Phase 20E complete and Phase 20F ready", () => {
    const closeoutReport = report();

    expect(closeoutReport.phase20e_complete).toBe(true);
    expect(closeoutReport.phase20f_ready_for_final_hardening).toBe(true);
    expect(closeoutReport.final_closeout_statement).toContain(
      "ready for Phase 20F final hardening",
    );
    expect(
      closeoutReport.checks.find(
        (check) => check.check_id === "phase-20e:phase-20f-ready",
      ),
    ).toMatchObject({ passed: true });
  });
});
